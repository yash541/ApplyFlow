/**
 * Combines network + DOM signals to decide whether an application was submitted.
 *
 * Confidence model:
 *   network only (0.6)  → "Did you apply?" suggestion toast (no auto-advance)
 *   DOM only    (0.75+) → auto-advance to "applied"
 *   network+DOM (0.95)  → auto-advance to "applied" with high confidence
 *
 * AUTO_ADVANCE_THRESHOLD (0.72) sits between the two tiers so that DOM signals
 * always trigger auto-advance while network-only signals never do.
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

const AUTO_ADVANCE_THRESHOLD = 0.72;
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
