import { describe, expect, it } from "vitest";
import { applyMove, inverseMove, isNoopMove, nextSiblingOf, validateBoard } from "./board-moves";
import { createRequestId, matchResolution } from "./transactions";

const board = { todo: ["a", "b", "c"], doing: ["d"], done: [] as string[] };

describe("board moves", () => {
  it("moves before a stable id or appends with null (C44-T03)", () => {
    const next = applyMove(board, { itemId: "c", fromContainerId: "todo", toContainerId: "todo", beforeItemId: "a" });
    expect(next.todo).toEqual(["c", "a", "b"]);
    const empty = applyMove(board, { itemId: "a", fromContainerId: "todo", toContainerId: "done", beforeItemId: null });
    expect(empty.done).toEqual(["a"]);
    expect(empty.todo).toEqual(["b", "c"]);
    const before = applyMove(board, { itemId: "a", fromContainerId: "todo", toContainerId: "doing", beforeItemId: "d" });
    expect(before.doing).toEqual(["a", "d"]);
    expect(board.todo).toEqual(["a", "b", "c"]); // immutable
  });

  it("treats no-ops and invalid addresses as identity", () => {
    expect(isNoopMove(board, { itemId: "b", fromContainerId: "todo", toContainerId: "todo", beforeItemId: "c" })).toBe(true);
    expect(isNoopMove(board, { itemId: "c", fromContainerId: "todo", toContainerId: "todo", beforeItemId: null })).toBe(true);
    expect(applyMove(board, { itemId: "zzz", fromContainerId: "todo", toContainerId: "done", beforeItemId: null })).toBe(board);
    expect(applyMove(board, { itemId: "a", fromContainerId: "todo", toContainerId: "nope", beforeItemId: null })).toBe(board);
    expect(applyMove(board, { itemId: "a", fromContainerId: "todo", toContainerId: "doing", beforeItemId: "zzz" })).toBe(board);
  });

  it("validates duplicates, unknown containers and missing item data (C44-T10)", () => {
    const d = validateBoard(["todo", "doing"], { todo: ["a", "b"], doing: ["a"], ghost: ["q"] }, new Set(["a", "b"]));
    expect(d.map((x) => x.code).sort()).toEqual(["duplicate-item", "missing-container", "missing-item-data"]);
    expect(validateBoard(["todo", "doing", "done"], board, new Set(["a", "b", "c", "d"]))).toEqual([]);
  });

  it("builds inverse moves against the current board and reports conflicts (C44-T06)", () => {
    const moved = applyMove(board, { itemId: "a", fromContainerId: "todo", toContainerId: "done", beforeItemId: null });
    const originalNext = nextSiblingOf(board, "a");
    expect(originalNext).toBe("b");
    const inv = inverseMove(moved, { itemId: "a", fromContainerId: "todo", toContainerId: "done", beforeItemId: null }, originalNext);
    expect(inv).toEqual({ move: { itemId: "a", fromContainerId: "done", toContainerId: "todo", beforeItemId: "b" } });
    expect(applyMove(moved, (inv as { move: never }).move)).toEqual(board);
    const { todo: _gone, ...noTodo } = moved;
    void _gone;
    expect(inverseMove(noTodo, { itemId: "a", fromContainerId: "todo", toContainerId: "done", beforeItemId: null }, "b")).toEqual({ conflict: 'Cannot undo: "todo" no longer exists.' });
    const movedAgain = applyMove(moved, { itemId: "a", fromContainerId: "done", toContainerId: "doing", beforeItemId: null });
    expect(inverseMove(movedAgain, { itemId: "a", fromContainerId: "todo", toContainerId: "done", beforeItemId: null }, "b")).toEqual({ conflict: 'Cannot undo: the item has since moved to "doing".' });
  });
});

describe("transactions", () => {
  it("creates unique ids and matches only the pending one", () => {
    const a = createRequestId();
    const b = createRequestId("undo");
    expect(a).not.toBe(b);
    expect(b.startsWith("undo-")).toBe(true);
    expect(matchResolution(null, a)).toBe("none");
    expect(matchResolution({ requestId: a, accepted: true }, a)).toBe("accepted");
    expect(matchResolution({ requestId: a, accepted: false }, a)).toBe("rejected");
    expect(matchResolution({ requestId: b, accepted: true }, a)).toBe("stale");
    expect(matchResolution({ requestId: a, accepted: true }, null)).toBe("stale");
  });
});
