"use client";

import * as React from "react";
import { AnimatePresence, motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { isActive, isTerminal, milestoneOf, percentOf, reduceSnapshots, selectPrimary, statusLabel, type TaskSnapshot } from "@/lib/task-snapshots";

export type { TaskProgress, TaskSnapshot, TaskStatus } from "@/lib/task-snapshots";

export type ActivityCapsuleMotion = "auto" | "reduced" | "off";
export type ActivityCapsulePlacement = "inline" | "bottom" | "top";

export interface ActivityCapsuleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Host-supplied snapshots. May contain several per task (an event stream); the newest valid attempt/revision wins. */
  tasks: readonly TaskSnapshot[];
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Request only. The host confirms by sending a `cancelled` (or `succeeded`/`failed`) snapshot. */
  onCancelRequest?: (taskId: string, attemptId: string) => void;
  /** Request only. The host answers with a snapshot carrying a new attempt. */
  onRetryRequest?: (taskId: string, attemptId: string) => void;
  /** Hide a terminal task. Does not touch the backend job. */
  onDismiss?: (taskId: string, attemptId: string) => void;
  /** Explicit primary task; defaults to priority, then input order. */
  primaryTaskId?: string;
  placement?: ActivityCapsulePlacement;
  /** `milestones` announces lifecycle changes and 25% progress steps; `off` renders no live region. */
  announce?: "off" | "milestones";
  /** Accessible name of the summary button. */
  label?: string;
  /** Text shown when no tasks are present. */
  emptyLabel?: string;
  motion?: ActivityCapsuleMotion;
  /** Multiplies the shape-morph duration. */
  durationScale?: number;
}

const ICONS: Record<TaskSnapshot["status"], string> = {
  queued: "◌",
  running: "◐",
  "cancel-requested": "◑",
  succeeded: "✓",
  failed: "!",
  cancelled: "⊘",
};

/**
 * ActivityCapsule — a compact, morphing status surface for host-reported tasks.
 *
 * The host owns the tasks: snapshots come in, a pure reducer keeps the newest
 * attempt/revision per task and rejects stale events. The capsule never
 * invents progress, never completes a task because an animation finished,
 * and never changes task state when it opens or closes. Cancel, retry and
 * dismiss are requests; only new snapshots change what is shown.
 */
export const ActivityCapsule = React.forwardRef<HTMLButtonElement, ActivityCapsuleProps>(function ActivityCapsule(
  {
    tasks: input,
    expanded: expandedProp,
    defaultExpanded = false,
    onExpandedChange,
    onCancelRequest,
    onRetryRequest,
    onDismiss,
    primaryTaskId,
    placement = "inline",
    announce = "milestones",
    label = "Activity",
    emptyLabel = "No activity",
    motion = "auto",
    durationScale = 1,
    className,
    ...rest
  },
  ref,
) {
  /* authority: reduce against what we have already accepted */
  const prevRef = React.useRef<readonly TaskSnapshot[]>([]);
  // eslint-disable-next-line react-hooks/refs -- the reducer's "previous" is read-only memoised state, not render output
  const reduced = React.useMemo(() => reduceSnapshots(input, prevRef.current), [input]);
  React.useEffect(() => {
    prevRef.current = reduced.tasks;
  }, [reduced]);
  const { tasks, diagnostics } = reduced;
  React.useEffect(() => {
    if (diagnostics.length) {
      for (const d of diagnostics) console.warn(`[ActivityCapsule] ${d}`);
    }
  }, [diagnostics]);

  const primary = selectPrimary(tasks, primaryTaskId);
  const activeCount = tasks.filter((t) => isActive(t.status)).length;

  /* disclosure */
  const [internalOpen, setInternalOpen] = React.useState(defaultExpanded);
  const open = expandedProp ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (expandedProp === undefined) setInternalOpen(next);
    onExpandedChange?.(next);
  };

  /* local "cancel requested" marks until the host confirms */
  const [requested, setRequested] = React.useState<Set<string>>(() => new Set());
  const requestCancel = (t: TaskSnapshot) => {
    const key = `${t.id}:${t.attemptId}`;
    if (requested.has(key)) return;
    setRequested((s) => new Set(s).add(key));
    onCancelRequest?.(t.id, t.attemptId);
  };
  const cancelRequested = (t: TaskSnapshot) => t.status === "cancel-requested" || requested.has(`${t.id}:${t.attemptId}`);

  /* motion */
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const morph = mode === "full" ? { type: "spring" as const, duration: 0.24 * durationScale, bounce: 0.1 } : { duration: 0 };

  /* restrained announcements: lifecycle changes + 25% milestones (C60-T09) */
  // Derived from the previous render's "seen" map (state-from-previous-render pattern, no effects).
  const [ann, setAnn] = React.useState<{ seen: ReadonlyMap<string, string>; text: string }>(() => ({ seen: new Map(), text: "" }));
  const seenNext = new Map(ann.seen);
  const messages: string[] = [];
  for (const t of tasks) {
    const pct = percentOf(t.progress);
    const id = `${t.id}:${t.attemptId}`;
    const key = `${t.status}|${isActive(t.status) ? milestoneOf(pct) : ""}`;
    const prev = ann.seen.get(id);
    if (prev === key) continue;
    seenNext.set(id, key);
    if (prev === undefined && t.status === "running" && (pct === null || pct === 0)) continue; // first sight of a plain running task is not news
    messages.push(`${t.label}: ${statusLabel(t, false)}${isActive(t.status) && pct !== null ? `, ${pct}%` : ""}`);
  }
  if (seenNext.size !== ann.seen.size || messages.length) {
    setAnn({ seen: seenNext, text: messages.length ? messages.join(". ") : ann.text });
  }
  const announcement = ann.text;

  const panelId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false); // closes the panel only; tasks untouched (C60-T06)
      (rootRef.current?.querySelector("[data-summary]") as HTMLElement | null)?.focus();
    }
  };

  const primaryPct = primary ? percentOf(primary.progress) : null;
  const primaryStatus = primary ? statusLabel(primary, cancelRequested(primary)) : emptyLabel;

  return (
    <div
      ref={rootRef}
      data-slot="activity-capsule"
      data-motion={mode}
      data-state={open ? "expanded" : "collapsed"}
      data-placement={placement}
      data-status={primary?.status}
      onKeyDown={onKeyDown}
      className={cn(
        "text-[var(--cui-capsule-text,light-dark(#faf9f6,#ecebe6))]",
        placement === "inline" && "relative inline-flex",
        placement === "bottom" && "fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 flex justify-center px-4",
        placement === "top" && "fixed inset-x-0 top-[max(16px,env(safe-area-inset-top))] z-40 flex justify-center px-4",
        className,
      )}
      {...rest}
    >
      <m.div
        layout={mode !== "off"}
        transition={morph}
        className="flex max-w-full flex-col overflow-hidden rounded-[28px] bg-[var(--cui-capsule-surface,light-dark(#141311,#2a2a27))] shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
        style={{ width: open ? 360 : 220, borderRadius: 28 }}
      >
        {/* summary row: one button + separate action buttons (C60-T07) */}
        <div className="flex items-center gap-1 p-1.5">
          <button
            ref={ref}
            type="button"
            data-summary
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${label}: ${primary ? `${primary.label}, ${primaryStatus}${primaryPct !== null && isActive(primary.status) ? `, ${primaryPct}%` : ""}` : emptyLabel}${activeCount > 1 ? `, ${activeCount} active` : ""}`}
            onClick={() => setOpen(!open)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full px-2.5 py-1.5 text-left outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--cui-capsule-focus,#c8f55a)]"
          >
            <StatusIcon task={primary} requested={primary ? cancelRequested(primary) : false} mode={mode} />
            <span className="min-w-0 flex-1">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={`${primary?.id ?? "empty"}:${primaryStatus}`}
                  initial={mode === "full" ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  exit={mode === "full" ? { opacity: 0 } : undefined}
                  transition={{ duration: mode === "full" ? 0.16 : 0 }}
                  className="block truncate text-[13px] font-medium leading-tight"
                >
                  {primary ? primary.label : emptyLabel}
                </m.span>
              </AnimatePresence>
              <span className="block truncate text-[11px] leading-tight opacity-70">
                {primary ? primaryStatus : null}
                {primary && isActive(primary.status) && primaryPct !== null ? ` · ${primaryPct}%` : null}
                {activeCount > 1 ? ` · +${activeCount - 1}` : null}
              </span>
            </span>
          </button>
          {primary && isActive(primary.status) && onCancelRequest && !open && (
            <ActionButton label={`Cancel ${primary.label}`} disabled={cancelRequested(primary)} onClick={() => requestCancel(primary)}>
              ✕
            </ActionButton>
          )}
          {primary && isTerminal(primary.status) && onDismiss && !open && (
            <ActionButton label={`Dismiss ${primary.label}`} onClick={() => onDismiss(primary.id, primary.attemptId)}>
              ✕
            </ActionButton>
          )}
        </div>
        {/* decorative progress fill: eased to the reported value; text is authoritative */}
        {primary && isActive(primary.status) && (
          <div aria-hidden className="mx-3 mb-1.5 h-0.5 overflow-hidden rounded-full bg-white/15">
            {primaryPct === null ? (
              <m.div
                data-busy
                className="h-full w-1/3 rounded-full bg-[var(--cui-capsule-progress,#c8f55a)]"
                animate={mode === "full" ? { x: ["-100%", "300%"] } : { x: "100%" }}
                transition={mode === "full" ? { duration: 1.2, ease: "easeInOut", repeat: Infinity } : { duration: 0 }}
              />
            ) : (
              <m.div
                className="h-full rounded-full bg-[var(--cui-capsule-progress,#c8f55a)]"
                initial={false}
                animate={{ width: `${primaryPct}%` }}
                transition={{ duration: mode === "full" ? 0.16 : 0, ease: "easeOut" }}
              />
            )}
          </div>
        )}

        {/* expanded task list */}
        <div id={panelId} role="region" aria-label={`${label} tasks`} hidden={!open} className="border-t border-white/10">
          {open && (
            <ul className="max-h-[320px] overflow-y-auto p-1.5">
              {tasks.length === 0 && <li className="px-3 py-2 text-[13px] opacity-70">{emptyLabel}</li>}
              {tasks.map((t) => (
                <TaskRow key={`${t.id}:${t.attemptId}`} task={t} requested={cancelRequested(t)} mode={mode} onCancel={onCancelRequest ? () => requestCancel(t) : undefined} onRetry={onRetryRequest ? () => onRetryRequest(t.id, t.attemptId) : undefined} onDismiss={onDismiss ? () => onDismiss(t.id, t.attemptId) : undefined} />
              ))}
            </ul>
          )}
        </div>
      </m.div>
      {announce !== "off" && (
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
      )}
    </div>
  );
});
ActivityCapsule.displayName = "ActivityCapsule";

function StatusIcon({ task, requested, mode }: { task: TaskSnapshot | null; requested: boolean; mode: "full" | "reduced" | "off" }) {
  const status = task?.status ?? "queued";
  const glyph = requested && task && isActive(task.status) ? ICONS["cancel-requested"] : ICONS[status];
  return (
    <span
      aria-hidden
      data-status={status}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold",
        status === "failed" ? "bg-[var(--cui-capsule-error,#ff6b4a)] text-[#141311]" : status === "succeeded" ? "bg-[var(--cui-capsule-progress,#c8f55a)] text-[#141311]" : "bg-white/10",
        status === "running" && !requested && mode === "full" && "[&>span]:animate-spin",
      )}
    >
      <span className="inline-block">{glyph}</span>
    </span>
  );
}

function ActionButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--cui-capsule-focus,#c8f55a)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function TaskRow({ task: t, requested, mode, onCancel, onRetry, onDismiss }: { task: TaskSnapshot; requested: boolean; mode: "full" | "reduced" | "off"; onCancel?: () => void; onRetry?: () => void; onDismiss?: () => void }) {
  const pct = percentOf(t.progress);
  const active = isActive(t.status);
  const progress = t.progress && !("indeterminate" in t.progress) ? t.progress : null;
  return (
    <li className="flex items-start gap-2.5 rounded-2xl px-2 py-2 hover:bg-white/5" data-task={t.id} data-status={t.status}>
      <StatusIcon task={t} requested={requested} mode={mode} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{t.label}</div>
        <div className="text-[11px] opacity-70">
          <span data-status-label>{statusLabel(t, requested)}</span>
          {active && pct !== null && progress && (
            <>
              {" · "}
              <span data-progress-text>
                {progress.completed}/{progress.total}
                {progress.unit ? ` ${progress.unit}` : ""} ({pct}%)
              </span>
            </>
          )}
          {active && pct === null && " · in progress"}
          {t.detail && <span className="block truncate">{t.detail}</span>}
          {t.updatedAt && <time dateTime={new Date(t.updatedAt).toISOString()} className="block">{new Date(t.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        {active && onCancel && (
          <ActionButton label={`Cancel ${t.label}`} disabled={requested} onClick={onCancel}>
            ✕
          </ActionButton>
        )}
        {(t.status === "failed" || t.status === "cancelled") && onRetry && (
          <ActionButton label={`Retry ${t.label}`} onClick={onRetry}>
            ↻
          </ActionButton>
        )}
        {isTerminal(t.status) && onDismiss && (
          <ActionButton label={`Dismiss ${t.label}`} onClick={onDismiss}>
            ✕
          </ActionButton>
        )}
      </div>
    </li>
  );
}
