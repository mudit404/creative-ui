import { describe, expect, it } from "vitest";
import { milestoneOf, percentOf, reduceSnapshots, selectPrimary, type TaskSnapshot } from "./task-snapshots";

const snap = (over: Partial<TaskSnapshot>): TaskSnapshot => ({
  id: "t1",
  attemptId: "a1",
  attempt: 1,
  revision: 1,
  label: "Upload",
  status: "running",
  ...over,
});

describe("task snapshots", () => {
  it("keeps the highest revision per attempt and ignores stale revisions", () => {
    const r = reduceSnapshots([snap({ revision: 3, progress: { completed: 3, total: 10 } }), snap({ revision: 2, progress: { completed: 2, total: 10 } })]);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0]!.revision).toBe(3);
    expect(r.diagnostics[0]).toMatch(/stale revision/);
  });

  it("ignores late events from an older attempt (C60-T04)", () => {
    const first = reduceSnapshots([snap({ status: "failed", revision: 5 })]);
    const retried = reduceSnapshots([snap({ attemptId: "a2", attempt: 2, revision: 1, status: "running" })], first.tasks);
    expect(retried.tasks[0]!.attemptId).toBe("a2");
    const late = reduceSnapshots([snap({ attemptId: "a1", attempt: 1, revision: 9, status: "succeeded" })], retried.tasks);
    expect(late.tasks[0]!.attemptId).toBe("a2");
    expect(late.tasks[0]!.status).toBe("running");
    expect(late.diagnostics[0]).toMatch(/stale attempt/);
  });

  it("freezes a terminal attempt", () => {
    const done = reduceSnapshots([snap({ status: "succeeded", revision: 4 })]);
    const regress = reduceSnapshots([snap({ status: "running", revision: 5 })], done.tasks);
    expect(regress.tasks[0]!.status).toBe("succeeded");
    expect(regress.diagnostics[0]).toMatch(/terminal/);
  });

  it("resolves a cancel/success race by host authority (C60-T03)", () => {
    const r = reduceSnapshots([snap({ status: "cancel-requested", revision: 2 }), snap({ status: "succeeded", revision: 3 })]);
    expect(r.tasks[0]!.status).toBe("succeeded");
  });

  it("rejects invalid progress", () => {
    const r = reduceSnapshots([snap({ progress: { completed: 11, total: 10 } }), snap({ id: "t2", progress: { completed: 1, total: 0 } }), snap({ id: "t3", progress: { indeterminate: true } })]);
    expect(r.tasks.map((t) => t.id)).toEqual(["t3"]);
    expect(r.diagnostics).toHaveLength(2);
  });

  it("selects the primary task by priority, then input order, then last terminal", () => {
    const tasks = [snap({ id: "a", status: "queued" }), snap({ id: "b", status: "running", priority: 5 }), snap({ id: "c", status: "running", priority: 5 })];
    expect(selectPrimary(tasks)!.id).toBe("b");
    expect(selectPrimary(tasks, "c")!.id).toBe("c");
    const done = [snap({ id: "a", status: "succeeded" }), snap({ id: "b", status: "failed" })];
    expect(selectPrimary(done)!.id).toBe("b");
    expect(selectPrimary([])).toBeNull();
  });

  it("reports authoritative percentages and milestones without inventing values (C60-T01, C60-T05)", () => {
    expect(percentOf({ indeterminate: true })).toBeNull();
    expect(percentOf(undefined)).toBeNull();
    expect(percentOf({ completed: 10, total: 10 })).toBe(100);
    expect(milestoneOf(null)).toBeNull();
    expect(milestoneOf(49)).toBe(25);
    expect(milestoneOf(100)).toBe(100);
  });
});
