/**
 * Immutable board model for TransferBoard: validation of containers and
 * membership, move intents addressed by stable ids (`beforeItemId`, never a
 * numeric index), pure application for previews, and inverse moves for undo.
 */

export type ItemsByContainer = Record<string, readonly string[]>;

export interface MoveAddress {
  itemId: string;
  fromContainerId: string;
  toContainerId: string;
  /** Insert before this item, or `null` to append. */
  beforeItemId: string | null;
}

export interface MoveIntent extends MoveAddress {
  requestId: string;
  baseRevision: string | number;
  source: "pointer" | "menu" | "keyboard" | "undo";
}

export interface BoardDiagnostic {
  code: "duplicate-item" | "missing-container" | "unknown-item" | "missing-item-data";
  message: string;
}

export function validateBoard(containerIds: readonly string[], itemsByContainer: ItemsByContainer, itemIds: ReadonlySet<string>): BoardDiagnostic[] {
  const out: BoardDiagnostic[] = [];
  const seen = new Map<string, string>();
  const known = new Set(containerIds);
  for (const [cid, ids] of Object.entries(itemsByContainer)) {
    if (!known.has(cid)) out.push({ code: "missing-container", message: `itemsByContainer references unknown container "${cid}"` });
    for (const id of ids) {
      const prev = seen.get(id);
      if (prev) out.push({ code: "duplicate-item", message: `item "${id}" appears in "${prev}" and "${cid}"` });
      else seen.set(id, cid);
      if (!itemIds.has(id)) out.push({ code: "missing-item-data", message: `item "${id}" in "${cid}" has no item data` });
    }
  }
  return out;
}

export function containerOf(itemsByContainer: ItemsByContainer, itemId: string): string | null {
  for (const [cid, ids] of Object.entries(itemsByContainer)) if (ids.includes(itemId)) return cid;
  return null;
}

/** The item that currently follows `itemId` in its container (for inverse moves), or null when last. */
export function nextSiblingOf(itemsByContainer: ItemsByContainer, itemId: string): string | null {
  const cid = containerOf(itemsByContainer, itemId);
  if (!cid) return null;
  const ids = itemsByContainer[cid]!;
  const i = ids.indexOf(itemId);
  return ids[i + 1] ?? null;
}

/** Apply a move immutably. Returns the same object when the move is a no-op or invalid. */
export function applyMove(itemsByContainer: ItemsByContainer, m: MoveAddress): ItemsByContainer {
  const from = itemsByContainer[m.fromContainerId];
  const to = itemsByContainer[m.toContainerId];
  if (!from || !to || !from.includes(m.itemId)) return itemsByContainer;
  if (m.beforeItemId === m.itemId) return itemsByContainer;
  if (m.beforeItemId !== null && !to.includes(m.beforeItemId)) return itemsByContainer;
  const fromNext = from.filter((id) => id !== m.itemId);
  const base = m.fromContainerId === m.toContainerId ? fromNext : to.filter((id) => id !== m.itemId);
  const idx = m.beforeItemId === null ? base.length : base.indexOf(m.beforeItemId);
  const toNext = [...base.slice(0, idx), m.itemId, ...base.slice(idx)];
  if (m.fromContainerId === m.toContainerId) {
    if (toNext.length === from.length && toNext.every((id, i) => id === from[i])) return itemsByContainer;
    return { ...itemsByContainer, [m.toContainerId]: toNext };
  }
  return { ...itemsByContainer, [m.fromContainerId]: fromNext, [m.toContainerId]: toNext };
}

export function isNoopMove(itemsByContainer: ItemsByContainer, m: MoveAddress): boolean {
  return applyMove(itemsByContainer, m) === itemsByContainer;
}

/**
 * Inverse of an accepted move, addressed against the *current* board. Returns
 * a conflict message when the original container is gone or the item moved
 * elsewhere since.
 */
export function inverseMove(current: ItemsByContainer, accepted: MoveAddress, originalNext: string | null): { move: MoveAddress } | { conflict: string } {
  if (!(accepted.fromContainerId in current)) return { conflict: `Cannot undo: "${accepted.fromContainerId}" no longer exists.` };
  const where = containerOf(current, accepted.itemId);
  if (where !== accepted.toContainerId) return { conflict: where ? `Cannot undo: the item has since moved to "${where}".` : "Cannot undo: the item no longer exists." };
  const before = originalNext && current[accepted.fromContainerId]!.includes(originalNext) ? originalNext : null;
  return { move: { itemId: accepted.itemId, fromContainerId: accepted.toContainerId, toContainerId: accepted.fromContainerId, beforeItemId: before } };
}
