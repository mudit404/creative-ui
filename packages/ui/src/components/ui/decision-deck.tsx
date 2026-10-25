"use client";

import * as React from "react";
import { AnimatePresence, animate, motion as m, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { createRequestId, matchResolution, type Resolution } from "@/lib/transactions";

export type { Resolution } from "@/lib/transactions";

export interface DeckItem {
  id: string;
  title: string;
}

export interface DeckOutcome {
  id: string;
  label: string;
  /** Short text for the stamp shown during a gesture; defaults to label. */
  stamp?: string;
}

export interface Decision {
  decisionId: string;
  itemId: string;
  outcomeId: string;
  requestId: string;
  at?: number;
}

export interface DecisionIntent {
  requestId: string;
  itemId: string;
  outcomeId: string;
  source: "pointer" | "keyboard" | "button";
}

export interface UndoIntent {
  requestId: string;
  decisionId: string;
  itemId: string;
}

export type DecisionDeckVariant = "review" | "shortlist" | "study";
export type DecisionDeckMotion = "auto" | "reduced" | "off";

export interface DecisionDeckHandle {
  container: HTMLDivElement | null;
  focusActive: () => void;
}

export interface RenderCardContext {
  active: boolean;
  /** 0 for the foreground card, 1–2 for backing cards. */
  depth: number;
  pending: boolean;
}

export interface DecisionDeckProps<T extends DeckItem = DeckItem> extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  items: readonly T[];
  /** Authoritative history. The first item without a decision is active. */
  decisions?: readonly Decision[];
  /** Latest host answer. Only a resolution matching the pending request id settles it. */
  resolution?: Resolution | null;
  onDecisionRequest: (intent: DecisionIntent) => void;
  onUndoRequest?: (intent: UndoIntent) => void;
  /** [left-swipe outcome, right-swipe outcome]. */
  outcomes: readonly [DeckOutcome, DeckOutcome];
  /** Fraction of card width to commit on release. */
  swipeThreshold?: number;
  /** px/s horizontal flick that commits with at least 15% travel. */
  flickVelocity?: number;
  maxRotation?: number;
  renderCard: (item: T, ctx: RenderCardContext) => React.ReactNode;
  renderEmpty?: (history: readonly Decision[]) => React.ReactNode;
  variant?: DecisionDeckVariant;
  label?: string;
  /** Show the Undo button (requires onUndoRequest). */
  undo?: boolean;
  motion?: DecisionDeckMotion;
  durationScale?: number;
}

type Pending = { kind: "decision"; requestId: string; itemId: string; outcomeId: string } | { kind: "undo"; requestId: string; decisionId: string };

const INTERACTIVE = 'a,button,input,textarea,select,[contenteditable="true"],[data-no-drag]';

function DecisionDeckInner<T extends DeckItem>(
  {
    items,
    decisions = [],
    resolution = null,
    onDecisionRequest,
    onUndoRequest,
    outcomes,
    swipeThreshold = 0.3,
    flickVelocity = 700,
    maxRotation = 8,
    renderCard,
    renderEmpty,
    variant = "review",
    label = "Decision deck",
    undo,
    motion = "auto",
    durationScale = 1,
    className,
    ...rest
  }: DecisionDeckProps<T>,
  ref: React.ForwardedRef<DecisionDeckHandle>,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const showUndo = undo ?? !!onUndoRequest;

  /* derived deck */
  const decided = React.useMemo(() => new Set(decisions.map((d) => d.itemId)), [decisions]);
  const undecided = React.useMemo(() => items.filter((i) => !decided.has(i.id)), [items, decided]);
  const active = undecided[0] ?? null;
  const backing = undecided.slice(1, 3);
  const latestDecision = decisions.length ? decisions[decisions.length - 1]! : null;

  /* transaction state */
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState("");
  const [handledResolution, setHandledResolution] = React.useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = React.useState<{ itemId: string; dir: -1 | 1 } | null>(null);
  const [focusAfter, setFocusAfter] = React.useState<{ outcomeId: string; forItem: string | null } | null>(null);

  // settle the pending request from the latest resolution (state-from-props pattern)
  if (resolution && resolution.requestId !== handledResolution) {
    setHandledResolution(resolution.requestId);
    const match = matchResolution(resolution, pending?.requestId ?? null);
    if (match === "accepted" && pending) {
      setPending(null);
      setError(null);
      if (pending.kind === "decision") {
        const dir: -1 | 1 = pending.outcomeId === outcomes[0].id ? -1 : 1;
        setLastOutcome({ itemId: pending.itemId, dir });
        const next = items.find((i) => !decided.has(i.id) && i.id !== pending.itemId);
        setNotice(next ? `${outcomes.find((o) => o.id === pending.outcomeId)?.label ?? "Done"}. Next: ${next.title}.` : "Deck complete.");
        setFocusAfter({ outcomeId: pending.outcomeId, forItem: next?.id ?? null });
      } else {
        setNotice("Decision undone.");
      }
    } else if (match === "rejected" && pending) {
      setPending(null);
      setError(resolution.message ?? (pending.kind === "undo" ? "Undo was refused." : "The decision was not accepted."));
      setLastOutcome(null);
    }
    // stale: ignored (C43-T05)
  }

  /* gesture */
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const width = useMotionValue(360); // measured on pointer down; a motion value so transforms may read it
  const rotate = useTransform(x, (v) => Math.max(-maxRotation, Math.min(maxRotation, (v / Math.max(1, width.get())) * maxRotation * 2)));
  const stampLeft = useTransform(x, (v) => Math.max(0, Math.min(1, (-v / Math.max(1, width.get() * swipeThreshold)) * 1.2)));
  const stampRight = useTransform(x, (v) => Math.max(0, Math.min(1, (v / Math.max(1, width.get() * swipeThreshold)) * 1.2)));
  const drag = React.useRef<{ el: HTMLElement; pointerId: number; startX: number; startY: number; lifted: boolean; abandoned: boolean; lastX: number; lastT: number; vx: number; itemId: string } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const request = (outcomeId: string, source: DecisionIntent["source"]) => {
    if (!active || pending) return; // one request per item (C43-T03)
    const intent: DecisionIntent = { requestId: createRequestId("decision"), itemId: active.id, outcomeId, source };
    setPending({ kind: "decision", requestId: intent.requestId, itemId: active.id, outcomeId });
    setError(null);
    onDecisionRequest(intent);
  };
  const requestUndo = () => {
    if (!latestDecision || pending || !onUndoRequest) return;
    const intent: UndoIntent = { requestId: createRequestId("undo"), decisionId: latestDecision.decisionId, itemId: latestDecision.itemId };
    setPending({ kind: "undo", requestId: intent.requestId, decisionId: latestDecision.decisionId });
    setError(null);
    onUndoRequest(intent);
  };

  const settle = (toX: number) => {
    if (mode === "off") x.set(toX);
    else animate(x, toX, { duration: (mode === "full" ? 0.22 : 0.12) * durationScale, ease: [0.2, 0.8, 0.2, 1] });
  };
  const endDrag = (el: HTMLElement | null, pointerId: number) => {
    try {
      el?.releasePointerCapture(pointerId);
    } catch {
      /* not captured */
    }
    drag.current = null;
    setDragging(false);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || pending || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return; // editable content stays usable (C43-T08)
    width.set(e.currentTarget.getBoundingClientRect().width || 360);
    x.stop(); // a return animation from a previous short swipe must not overwrite the new drag
    drag.current = { el: e.currentTarget, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, lifted: false, abandoned: false, lastX: e.clientX, lastT: e.timeStamp, vx: 0, itemId: active.id };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || d.abandoned) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.lifted) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        d.abandoned = true; // vertical intent: leave scrolling alone
        return;
      }
      if (Math.abs(dx) < 8) return;
      d.lifted = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.vx = ((e.clientX - d.lastX) / dt) * 1000;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    x.set(dx);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = e.currentTarget;
    if (!d.lifted) {
      endDrag(el, e.pointerId);
      return;
    }
    const w = width.get();
    const dx = x.get();
    const frac = Math.abs(dx) / w;
    const commit = frac >= swipeThreshold || (Math.abs(d.vx) >= flickVelocity && frac >= 0.15 && Math.sign(d.vx) === Math.sign(dx));
    endDrag(el, e.pointerId);
    if (commit && active && !pending) {
      request(dx < 0 ? outcomes[0].id : outcomes[1].id, "pointer");
      settle(0);
    } else settle(0); // short swipe resets (C43-T01)
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    endDrag(e.currentTarget, e.pointerId);
    settle(0);
  };
  // an item removed externally mid-gesture releases capture (C43-T07)
  React.useEffect(() => {
    const d = drag.current;
    if (d && d.itemId !== active?.id) {
      endDrag(d.el, d.pointerId);
      x.set(0);
    }
  }, [active?.id, x]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      request(outcomes[0].id, "keyboard");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      request(outcomes[1].id, "keyboard");
    } else if (e.key === "Escape" && drag.current) {
      endDrag(drag.current.el, drag.current.pointerId);
      settle(0);
    }
  };

  /* focus hand-off after an accepted decision */
  const buttonRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useEffect(() => {
    if (!focusAfter || focusAfter.forItem !== (active?.id ?? null)) return;
    buttonRefs.current.get(focusAfter.outcomeId)?.focus();
  }, [focusAfter, active?.id]);
  React.useImperativeHandle(ref, () => ({ container: containerRef.current, focusActive: () => cardRef.current?.focus() }), []);

  const uid = React.useId();
  const isPendingDecision = pending?.kind === "decision";
  const remaining = undecided.length;
  const kept = variant === "shortlist" ? decisions.filter((d) => d.outcomeId === outcomes[1].id).length : null;
  const cardStyle = { x, rotate };
  const exitVariants = {
    exit: (dir: -1 | 1) => ({ x: dir * 560, rotate: dir * maxRotation * 1.5, opacity: 0, transition: { duration: 0.28 * durationScale, ease: [0.4, 0, 1, 1] as [number, number, number, number] } }),
  };

  const foreground = active && (
    <m.div
      key={active.id}
      ref={cardRef}
      role="group"
      aria-label={active.title}
      aria-busy={isPendingDecision || undefined}
      tabIndex={0}
      data-card="active"
      data-pending={isPendingDecision || undefined}
      data-dragging={dragging || undefined}
      custom={lastOutcome?.dir ?? 1}
      variants={mode === "full" ? exitVariants : undefined}
      exit={mode === "full" ? "exit" : undefined}
      style={cardStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onKeyDown={onKeyDown}
      className={cn(
        "relative z-[3] w-full touch-pan-y select-none rounded-2xl bg-[var(--cui-deck-surface,#faf9f6)] shadow-[var(--cui-deck-shadow,0_12px_32px_rgba(0,0,0,0.18))] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-deck-focus,#141311)]",
        pending ? "cursor-default" : "cursor-grab",
        dragging && "cursor-grabbing",
      )}
    >
      {renderCard(active, { active: true, depth: 0, pending: isPendingDecision })}
      {/* outcome stamps near the leading edge (text, not colour alone) */}
      <m.span aria-hidden style={{ opacity: stampLeft }} className="pointer-events-none absolute left-3 top-3 rounded-md border-2 border-[var(--cui-deck-reject,#c8360d)] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-[var(--cui-deck-reject,#c8360d)]">
        {outcomes[0].stamp ?? outcomes[0].label}
      </m.span>
      <m.span aria-hidden style={{ opacity: stampRight }} className="pointer-events-none absolute right-3 top-3 rounded-md border-2 border-[var(--cui-deck-accept,#1f7a4f)] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-[var(--cui-deck-accept,#1f7a4f)]">
        {outcomes[1].stamp ?? outcomes[1].label}
      </m.span>
    </m.div>
  );

  return (
    <div
      ref={containerRef}
      data-slot="decision-deck"
      data-variant={variant}
      data-motion={mode}
      data-state={pending ? "pending" : active ? (dragging ? "dragging" : "ready") : "empty"}
      role="group"
      aria-label={label}
      className={cn("flex w-full max-w-[360px] flex-col gap-[var(--cui-deck-gap,12px)] text-[var(--cui-deck-text,#141311)]", className)}
      {...rest}
    >
      {/* stack */}
      <div className="relative" style={{ minHeight: 120 }}>
        {backing.map((item, i) => (
          <div
            key={item.id}
            aria-hidden
            data-card={`backing-${i + 1}`}
            className="pointer-events-none absolute inset-x-0 top-0 rounded-2xl bg-[var(--cui-deck-surface,#faf9f6)] shadow-[var(--cui-deck-shadow,0_12px_32px_rgba(0,0,0,0.18))]"
            style={{ transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.04})`, zIndex: 2 - i, transformOrigin: "top center" }}
          >
            {renderCard(item, { active: false, depth: i + 1, pending: false })}
          </div>
        ))}
        {mode === "full" ? (
          <AnimatePresence initial={false} custom={lastOutcome?.dir ?? 1}>
            {foreground}
          </AnimatePresence>
        ) : (
          foreground
        )}
        {!active && (
          <div data-card="empty" className="rounded-2xl border border-dashed border-[var(--cui-deck-border,rgba(20,19,17,0.25))] p-6 text-center text-[14px]">
            {renderEmpty ? renderEmpty(decisions) : (
              <>
                <p className="m-0 font-medium">All done.</p>
                <p className="m-0 mt-1 text-[12px] opacity-70">{decisions.length} decision{decisions.length === 1 ? "" : "s"} recorded.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* controls: the no-drag path */}
      <div className="flex items-center justify-between gap-2">
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set(outcomes[0].id, el);
          }} type="button" onClick={() => request(outcomes[0].id, "button")} disabled={!active || !!pending} className={cn(BTN, "border-[var(--cui-deck-reject,#c8360d)] text-[var(--cui-deck-reject,#c8360d)]")}>
          {outcomes[0].label}
        </button>
        {showUndo && (
          <button type="button" onClick={requestUndo} disabled={!latestDecision || !!pending} className={BTN} aria-describedby={`${uid}-count`}>
            Undo
          </button>
        )}
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set(outcomes[1].id, el);
          }} type="button" onClick={() => request(outcomes[1].id, "button")} disabled={!active || !!pending} className={cn(BTN, "border-[var(--cui-deck-accept,#1f7a4f)] text-[var(--cui-deck-accept,#1f7a4f)]")}>
          {outcomes[1].label}
        </button>
      </div>
      <div className="flex items-center justify-between text-[12px] opacity-80">
        <span id={`${uid}-count`}>
          {remaining} remaining{kept !== null ? ` · ${kept} kept` : ""}
        </span>
        <span>{decisions.length} decided</span>
      </div>
      {/* stable status strip */}
      <div role="status" aria-live="polite" className={cn("min-h-[1.5rem] text-[12px]", error ? "text-[var(--cui-deck-reject,#c8360d)]" : "opacity-80")}>
        {pending ? (pending.kind === "undo" ? "Undo requested…" : `${outcomes.find((o) => o.id === pending.outcomeId)?.label ?? "Decision"} requested…`) : (error ?? notice)}
      </div>
    </div>
  );
}

const BTN =
  "inline-flex h-9 min-w-[88px] items-center justify-center rounded-full border border-[var(--cui-deck-border,rgba(20,19,17,0.25))] px-4 text-[13px] font-medium outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-deck-focus,#141311)] disabled:cursor-not-allowed disabled:opacity-40";

/**
 * DecisionDeck — an undoable, transactional card stack.
 *
 * Items and decisions are controlled: a gesture, key or button emits one
 * `onDecisionRequest` with a fresh request id and the deck shows pending until
 * a matching resolution arrives. Accepted resolutions advance (the host has
 * appended the decision); rejected ones restore the card and show the host's
 * message; stale ones are ignored. Undo asks the host to reverse the latest
 * decision by id. Buttons and arrow keys are full no-drag alternatives.
 */
export const DecisionDeck = React.forwardRef(DecisionDeckInner) as <T extends DeckItem>(props: DecisionDeckProps<T> & React.RefAttributes<DecisionDeckHandle>) => React.ReactElement;
(DecisionDeck as unknown as { displayName: string }).displayName = "DecisionDeck";
