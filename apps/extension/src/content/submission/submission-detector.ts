/**
 * Combines network + DOM signals to decide whether an application was submitted.
 *
 * Confidence model:
 *   network only   (0.60) → "Did you apply?" suggestion toast (no auto-advance)
 *   DOM text/elem  (0.75) → "Did you apply?" suggestion toast (no auto-advance)
 *   URL pattern    (0.80) → auto-advance to "applied" (unambiguous success URL)
 *   network+DOM    (0.93–0.95) → auto-advance with high confidence
 *
 * AUTO_ADVANCE_THRESHOLD (0.80) prevents false positives where the source portal
 * briefly shows "Application submitted! Redirecting…" text before sending the
 * user to an external ATS form (Instahyre, Workday, etc.). DOM-text signals
 * alone (0.75) are no longer sufficient for auto-advance — only an explicit
 * success URL or combined network+DOM signal crosses the threshold.
 */

import { startNetworkDetector, type NetworkSignal } from "./network-detector";
import { startSuccessDetector, type SuccessSignal } from "./success-detector";

export type SubmissionEvent = {
  confidence: number;
  autoAdvanced: boolean;
  networkSignal?: NetworkSignal;
  successSignal?: SuccessSignal;
  atsMetadata: Record<string, unknown>;
};

const AUTO_ADVANCE_THRESHOLD = 0.80;
const SUGGEST_THRESHOLD = 0.55;

export function startSubmissionDetector(
  applicationId: string,
  onDetected: (event: SubmissionEvent) => void,
  onSuggestion: (confidence: number) => void,
): () => void {
  let networkSignal: NetworkSignal | undefined;
  let successSignal: SuccessSignal | undefined;
  let fired = false;

  function evaluate() {
    if (fired) return;

    let confidence = 0;
    if (networkSignal && successSignal) {
      // Both signals — cap at 0.95
      confidence = Math.min(networkSignal.confidence + successSignal.confidence * 0.6, 0.95);
    } else if (successSignal) {
      confidence = successSignal.confidence;
    } else if (networkSignal) {
      confidence = networkSignal.confidence;
    }

    if (confidence < SUGGEST_THRESHOLD) return;

    fired = true;
    const autoAdvanced = confidence >= AUTO_ADVANCE_THRESHOLD;

    if (autoAdvanced) {
      onDetected({
        confidence,
        autoAdvanced,
        networkSignal,
        successSignal,
        atsMetadata: {
          applicationId,
          detectedAt: new Date().toISOString(),
          networkEndpoint: networkSignal?.url,
          domSignalKind: successSignal?.kind,
          domSignalDetail: successSignal?.detail?.slice(0, 200),
          confidence,
        },
      });
    } else {
      // Network-only: suggest but don't auto-advance
      onSuggestion(confidence);
    }
  }

  const stopNetwork = startNetworkDetector((sig) => {
    networkSignal = sig;
    evaluate();
  });

  const stopSuccess = startSuccessDetector((sig) => {
    successSignal = sig;
    evaluate();
  });

  return () => {
    stopNetwork();
    stopSuccess();
  };
}
