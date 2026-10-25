/**
 * Task-snapshot authority for ActivityCapsule. Pure functions: the host owns
 * tasks; this reducer validates snapshots, keeps the current attempt per task,
 * rejects stale revisions/attempts, freezes terminal attempts and selects a
 * primary task deterministically. No timers, no invented progress.
 */

export type TaskStatus = "queued" | "running" | "cancel-requested" | "succeeded" | "failed" | "cancelled";

export type TaskProgress = { indeterminate: true } | { completed: number; total: number; unit?: string };

export interface TaskSnapshot {
  id: string;
  /** Host-assigned attempt id used in callbacks. */
  attemptId: string;
  /** Monotonic per task; a higher number is a newer attempt (never compare attemptId strings). */
  attempt: number;
  /** Monotonic per attempt. */
  revision: number;
  label: string;
  status: TaskStatus;
  progress?: TaskProgress;
  detail?: string;
  /** Higher wins primary selection among active tasks. */
  priority?: number;
  startedAt?: number;
  updatedAt?: number;
}

export const TERMINAL: ReadonlySet<TaskStatus> = new Set(["succeeded", "failed", "cancelled"]);
export const isTerminal = (s: TaskStatus) => TERMINAL.has(s);
export const isActive = (s: TaskStatus) => !TERMINAL.has(s);

export interface ReduceResult {
  /** One current snapshot per task id, in first-seen input order. */
  tasks: TaskSnapshot[];
  /** Human-readable validation and rejection notes (development aid). */
  diagnostics: string[];
}

export function validateProgress(p: TaskProgress | undefined): string | null {
  if (!p) return null;
  if ("indeterminate" in p) return p.indeterminate === true ? null : "indeterminate must be true";
  if (![p.completed, p.total].every(Number.isFinite)) return "progress values must be finite";
  if (p.total <= 0) return "progress.total must be > 0";
  if (p.completed < 0 || p.completed > p.total) return "progress.completed must be within 0..total";
  return null;
}

/**
 * Reduce a list of snapshots (which may contain several per task, e.g. an
 * appended event stream) into the authoritative current snapshot per task.
 * `previous` carries forward attempts already seen so that a later render
 * cannot be overwritten by an older attempt or revision (C60-T04).
 */
export function reduceSnapshots(input: readonly TaskSnapshot[], previous: readonly TaskSnapshot[] = []): ReduceResult {
  const diagnostics: string[] = [];
  const current = new Map<string, TaskSnapshot>();
  const order: string[] = [];
  for (const t of previous) {
    current.set(t.id, t);
    order.push(t.id);
  }
  for (const s of input) {
    if (!s || typeof s.id !== "string" || !s.id) {
      diagnostics.push("snapshot without id ignored");
      continue;
    }
    if (!Number.isFinite(s.attempt) || !Number.isFinite(s.revision)) {
      diagnostics.push(`${s.id}: attempt and revision must be finite numbers`);
      continue;
    }
    const perr = validateProgress(s.progress);
    if (perr) {
      diagnostics.push(`${s.id}: ${perr}`);
      continue;
    }
    const prev = current.get(s.id);
    if (!prev) {
      current.set(s.id, s);
      order.push(s.id);
      continue;
    }
    if (s.attempt < prev.attempt) {
      diagnostics.push(`${s.id}: stale attempt ${s.attempt} ignored (current ${prev.attempt})`);
      continue;
    }
    if (s.attempt > prev.attempt) {
      current.set(s.id, s); // a newer attempt replaces everything
      continue;
    }
    if (s.revision <= prev.revision) {
      if (s.revision < prev.revision) diagnostics.push(`${s.id}: stale revision ${s.revision} ignored (current ${prev.revision})`);
      continue;
    }
    if (isTerminal(prev.status) && !isTerminal(s.status)) {
      diagnostics.push(`${s.id}: terminal attempt ${s.attempt} cannot return to ${s.status}`);
      continue;
    }
    current.set(s.id, s);
  }
  return { tasks: order.map((id) => current.get(id)!), diagnostics };
}

/** Primary task: highest priority among active tasks (first input order breaks ties); else the last terminal task; else null. */
export function selectPrimary(tasks: readonly TaskSnapshot[], explicitId?: string): TaskSnapshot | null {
  if (explicitId) {
    const t = tasks.find((x) => x.id === explicitId);
    if (t) return t;
  }
  let best: TaskSnapshot | null = null;
  for (const t of tasks) {
    if (!isActive(t.status)) continue;
    if (!best || (t.priority ?? 0) > (best.priority ?? 0)) best = t;
  }
  if (best) return best;
  for (let i = tasks.length - 1; i >= 0; i--) if (isTerminal(tasks[i]!.status)) return tasks[i]!;
  return null;
}

/** Authoritative percentage (0..100) for known progress, or null for unknown/indeterminate. */
export function percentOf(p: TaskProgress | undefined): number | null {
  if (!p || "indeterminate" in p) return null;
  return Math.round((p.completed / p.total) * 100);
}

/** The milestone (0, 25, 50, 75, 100) a percentage has reached, for restrained announcements. */
export function milestoneOf(percent: number | null): number | null {
  if (percent === null) return null;
  return Math.floor(percent / 25) * 25;
}

export function statusLabel(t: TaskSnapshot, cancelRequested: boolean): string {
  switch (t.status) {
    case "queued":
      return "Queued";
    case "running":
      return cancelRequested ? "Cancel requested" : "Running";
    case "cancel-requested":
      return "Cancel requested";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}
