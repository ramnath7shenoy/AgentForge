// ─────────────────────────────────────────────────────────────────────────────
// ApprovalGate — shared approval pause/resume primitive
//
// Extracted into its own module to break the circular dependency:
//   flowStore  →  clientExecutor  →  flowStore
//
// Both flowStore and clientExecutor import only from here; neither imports
// from the other for approval purposes.
// ─────────────────────────────────────────────────────────────────────────────

const _resolveQueue: Array<(approved: boolean) => void> = [];

/** Suspend current execution until resolveApproval() is called. */
export function waitForApproval(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    _resolveQueue.push(resolve);
  });
}

/** Call this to resume a flow paused at an approval/gatekeeper node. */
export function resolveApproval(approved: boolean): void {
  const resolve = _resolveQueue.shift();
  if (resolve) resolve(approved);
}

/** True while at least one flow is suspended waiting for human input. */
export function isApprovalPending(): boolean {
  return _resolveQueue.length > 0;
}
