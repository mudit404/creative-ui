/**
 * Request/resolution helpers shared by transactional components
 * (DecisionDeck, TransferBoard). A component emits one request with a fresh
 * `requestId`, remembers it as pending, and only a resolution carrying that
 * exact id may settle it. Anything else is stale and ignored.
 */

export interface Resolution {
  requestId: string;
  accepted: boolean;
  message?: string;
  /** Host revision after the operation (informational). */
  revision?: string | number;
}

let counter = 0;

/** Unique within a page session; readable in logs. */
export function createRequestId(prefix = "req"): string {
  counter += 1;
  const rnd = Math.floor(Math.random() * 0xffffff).toString(36);
  return `${prefix}-${counter}-${rnd}`;
}

export type ResolutionMatch = "accepted" | "rejected" | "stale" | "none";

/** Classify a resolution against the pending request id. */
export function matchResolution(resolution: Resolution | null | undefined, pendingRequestId: string | null): ResolutionMatch {
  if (!resolution) return "none";
  if (!pendingRequestId || resolution.requestId !== pendingRequestId) return "stale";
  return resolution.accepted ? "accepted" : "rejected";
}
