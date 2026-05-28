/**
 * Form-step tracking for multi-step ATS forms.
 *
 * Tracks which field-set hashes have been successfully filled in the current
 * page session. Used by the application assistant to display step progress
 * and to prevent duplicate autofill prompts on the same step.
 *
 * Intentionally lightweight — this is additive to autofill.ts's existing
 * waitingForNextStep / lastFilledKey logic, not a replacement.
 */

import type { DetectedField } from "@applyflow/shared";

export type FormStep = {
  stepHash: string;
  fieldCount: number;
  completed: boolean;
  filledAt?: number;
};

// Per-page session memory — cleared on page unload naturally
const completedSteps = new Map<string, FormStep>();

/**
 * Compute a deterministic hash for a field set by sorting and joining selectors.
 * Same as autofill.ts's getFieldsKey — kept separate to avoid coupling.
 */
export function computeStepHash(fields: DetectedField[]): string {
  return fields
    .map((f) => f.selector)
    .sort()
    .join("|");
}

export function isStepCompleted(stepHash: string): boolean {
  return completedSteps.get(stepHash)?.completed ?? false;
}

export function markStepCompleted(stepHash: string, fields: DetectedField[]): void {
  completedSteps.set(stepHash, {
    stepHash,
    fieldCount: fields.length,
    completed: true,
    filledAt: Date.now(),
  });
}

export function getCompletedStepCount(): number {
  return [...completedSteps.values()].filter((s) => s.completed).length;
}

export function getTotalStepCount(): number {
  return completedSteps.size;
}

/** Clear step history — called when a new apply session starts. */
export function clearStepHistory(): void {
  completedSteps.clear();
}
