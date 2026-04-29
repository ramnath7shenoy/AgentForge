// ─────────────────────────────────────────────────────────────────────────────
// ApprovalGate — shared approval pause/resume primitive
//
// Extracted into its own module to break the circular dependency:
//   flowStore  →  clientExecutor  →  flowStore
//
// Both flowStore and clientExecutor import only from here; neither imports
// from the other for approval purposes.
// ─────────────────────────────────────────────────────────────────────────────

let _resolve: ((approved: boolean) => void) | null = null;

/** Suspend current execution until resolveApproval() is called. */
export function waitForApproval(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    _resolve = resolve;
  });
}

/** Call this to resume a flow paused at an approval/gatekeeper node. */
export function resolveApproval(approved: boolean): void {
  if (_resolve) {
    _resolve(approved);
    _resolve = null;
  }
}

/** True while a flow is suspended waiting for human input. */
export function isApprovalPending(): boolean {
  return _resolve !== null;
}
