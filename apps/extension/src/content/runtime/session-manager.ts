import type { LinkedInJobData } from "@applyflow/shared";
import type { JobFingerprint } from "../tracking/fingerprint";

export type TabSession = {
  jobData: LinkedInJobData;
  fingerprint: JobFingerprint;
  applicationId?: string;
  stopDetector?: () => void;
  startedAt: number;
};

let session: TabSession | null = null;

export function setSession(s: Omit<TabSession, "startedAt">): void {
  // Stop any running detector from the previous job before replacing
  session?.stopDetector?.();
  session = { ...s, startedAt: Date.now() };
}

export function getSession(): TabSession | null {
  return session;
}

export function setApplicationId(id: string): void {
  if (session) session.applicationId = id;
}

export function setStopDetector(fn: () => void): void {
  if (session) session.stopDetector = fn;
}

export function clearSession(): void {
  session?.stopDetector?.();
  session = null;
}
