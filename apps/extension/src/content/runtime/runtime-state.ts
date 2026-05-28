/**
 * Observable runtime state machine for the overlay orchestration flow.
 *
 * States are recorded for telemetry and debug visibility — they do NOT gate
 * any logic. Flow control stays in portal-runner.ts. Adding this layer lets
 * us observe exactly where the pipeline is at any moment without touching
 * the existing control flow.
 */

export const enum RuntimeState {
  IDLE               = "idle",
  DETECTING          = "detecting",
  STABILIZING        = "stabilizing",
  EXTRACTING         = "extracting",
  AI_RECOVERING      = "ai_recovering",
  FINGERPRINTING     = "fingerprinting",
  RESOLVING          = "resolving",
  READY              = "ready",
  TRACKING           = "tracking",
  // User clicked Apply — session is active, following user across portals
  ACTIVE_APPLICATION = "active_application",
  SUBMITTED          = "submitted",
  FAILED             = "failed",
}

type TransitionListener = (from: RuntimeState, to: RuntimeState, portal: string) => void;

class _RuntimeStateManager {
  private _state: RuntimeState = RuntimeState.IDLE;
  private _portal = "";
  private _listeners: TransitionListener[] = [];

  transition(to: RuntimeState, portal?: string): void {
    const from = this._state;
    this._state = to;
    if (portal !== undefined) this._portal = portal;
    this._listeners.forEach((fn) => {
      try {
        fn(from, to, this._portal);
      } catch {
        // Listener errors must never break the main flow
      }
    });
  }

  get state(): RuntimeState { return this._state; }
  get portal(): string { return this._portal; }

  /**
   * Register a listener that fires on every state transition.
   * Returns a cleanup function that removes the listener.
   */
  onTransition(fn: TransitionListener): () => void {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }
}

export const runtimeState = new _RuntimeStateManager();
