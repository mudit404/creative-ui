"use client";

import * as React from "react";
import { motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  containerOf,
  inverseMove,
  isNoopMove,
  nextSiblingOf,
  validateBoard,
  type BoardDiagnostic,
  type ItemsByContainer,
  type MoveAddress,
  type MoveIntent,
} from "@/lib/board-moves";
import { createRequestId, matchResolution, type Resolution } from "@/lib/transactions";

export type { ItemsByContainer, MoveAddress, MoveIntent } from "@/lib/board-moves";
export type { Resolution } from "@/lib/transactions";

export interface TransferContainer {
  id: string;
  label: string;
  /** Items cannot be moved into a read-only container. */
  readOnly?: boolean;
  /** Maximum number of items the container accepts. */
  capacity?: number;
}

export interface TransferItem {
  id: string;
  title: string;
}

export type CanMoveResult = boolean | { allowed: boolean; reason?: string };

export interface RenderItemContext {
  /** The drag handle (a button). Place it where the user grabs. */
  handle: React.ReactNode;
  /** The click/tap Move control with its menu. */
  moveMenu: React.ReactNode;
  pending: boolean;
  dragging: boolean;
}

export interface TransferBoardHandle {
  root: HTMLDivElement | null;
  focusItem: (id: string) => void;
}

export interface TransferBoardProps<T extends TransferItem = TransferItem> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  containers: readonly TransferContainer[];
  items: readonly T[];
  /** Authoritative membership and order: container id → item ids. */
  itemsByContainer: ItemsByContainer;
  /** Opaque host version carried in every intent as `baseRevision`. */
  revision: string | number;
  canMove?: (move: MoveAddress) => CanMoveResult;
  onMoveRequest: (intent: MoveIntent) => void;
  onUndoRequest?: (intent: MoveIntent) => void;
  /** Latest host answer; only a matching request id settles the pending move. */
  resolution?: Resolution | null;
  /** Items the host marks busy (in addition to the board's own pending move). */
  pendingItemIds?: readonly string[];
  renderItem?: (item: T, ctx: RenderItemContext) => React.ReactNode;
  autoscroll?: boolean;
  undoEnabled?: boolean;
  variant?: "workflow" | "library" | "priority";
  label?: string;
  motion?: "auto" | "reduced" | "off";
}

interface DragState {
  itemId: string;
  from: string;
  pointerId: number;
  el: HTMLElement;
  startX: number;
  startY: number;
  lifted: boolean;
  /** Current candidate target, or null when over nothing. */
  target: { to: string; before: string | null; allowed: boolean; reason?: string } | null;
  dx: number;
  dy: number;
}

const POSITION_END = "__end__";

function TransferBoardInner<T extends TransferItem>(
  {
    containers,
    items,
    itemsByContainer,
    revision,
    canMove,
    onMoveRequest,
    onUndoRequest,
    resolution = null,
    pendingItemIds = [],
    renderItem,
    autoscroll = true,
    undoEnabled = false,
    variant = "workflow",
    label = "Transfer board",
    motion = "auto",
    className,
    ...rest
  }: TransferBoardProps<T>,
  ref: React.ForwardedRef<TransferBoardHandle>,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  /* validation (C44-T10) */
  const itemMap = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const diagnostics = React.useMemo<BoardDiagnostic[]>(
    () =>
      validateBoard(
        containers.map((c) => c.id),
        itemsByContainer,
        new Set(itemMap.keys()),
      ),
    [containers, itemsByContainer, itemMap],
  );
  const invalid = diagnostics.length > 0;
  React.useEffect(() => {
    for (const d of diagnostics) console.warn(`[TransferBoard] ${d.message}`);
  }, [diagnostics]);

  /* structural policy */
  const evaluate = (move: MoveAddress): { allowed: boolean; reason?: string } => {
    const to = containers.find((c) => c.id === move.toContainerId);
    if (!to) return { allowed: false, reason: "Unknown destination." };
    if (to.readOnly) return { allowed: false, reason: `${to.label} is read-only.` };
    if (
      to.capacity !== undefined &&
      move.fromContainerId !== move.toContainerId &&
      (itemsByContainer[to.id]?.length ?? 0) >= to.capacity
    )
      return { allowed: false, reason: `${to.label} is full (${to.capacity}).` };
    if (canMove) {
      const r = canMove(move);
      if (typeof r === "boolean") return { allowed: r, reason: r ? undefined : "Not allowed." };
      return r;
    }
    return { allowed: true };
  };

  /* transaction state */
  const [pending, setPending] = React.useState<{
    intent: MoveIntent;
    originalNext: string | null;
    undo: boolean;
  } | null>(null);
  const [lastAccepted, setLastAccepted] = React.useState<{
    move: MoveAddress;
    originalNext: string | null;
  } | null>(null);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean }>({ text: "" });
  const [handled, setHandled] = React.useState<string | null>(null);
  const [focusRequest, setFocusRequest] = React.useState<{ id: string; key: number } | null>(null);
  if (resolution && resolution.requestId !== handled) {
    setHandled(resolution.requestId);
    const match = matchResolution(resolution, pending?.intent.requestId ?? null);
    if (pending && match === "accepted") {
      const it = itemMap.get(pending.intent.itemId);
      setPending(null);
      setLastAccepted(
        pending.undo ? null : { move: pending.intent, originalNext: pending.originalNext },
      );
      setNotice({
        text: `${it?.title ?? pending.intent.itemId} moved to ${containers.find((c) => c.id === pending.intent.toContainerId)?.label ?? pending.intent.toContainerId}.`,
      });
      setFocusRequest((f) => ({ id: pending.intent.itemId, key: (f?.key ?? 0) + 1 }));
    } else if (pending && match === "rejected") {
      setPending(null);
      setNotice({ text: resolution.message ?? "The move was not accepted.", error: true });
      setFocusRequest((f) => ({ id: pending.intent.itemId, key: (f?.key ?? 0) + 1 }));
    }
  }
  const request = (move: MoveAddress, source: MoveIntent["source"], undo = false) => {
    if (pending || invalid) return;
    const intent: MoveIntent = {
      ...move,
      requestId: createRequestId(undo ? "undo" : "move"),
      baseRevision: revision,
      source,
    };
    setPending({ intent, originalNext: nextSiblingOf(itemsByContainer, move.itemId), undo });
    setNotice({ text: `Moving ${itemMap.get(move.itemId)?.title ?? move.itemId}…` });
    if (undo) onUndoRequest?.(intent);
    else onMoveRequest(intent);
  };
  const requestUndo = () => {
    if (!lastAccepted || pending) return;
    const inv = inverseMove(itemsByContainer, lastAccepted.move, lastAccepted.originalNext);
    if ("conflict" in inv) {
      setNotice({ text: inv.conflict, error: true }); // explained, not forced (C44-T06)
      return;
    }
    request(inv.move, "undo", true);
  };

  /* drag (enhancement over the Move menu) */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const setDragBoth = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };
  const autoscrollRaf = React.useRef<number | null>(null);
  const stopAutoscroll = () => {
    if (autoscrollRaf.current !== null) cancelAnimationFrame(autoscrollRaf.current);
    autoscrollRaf.current = null;
  };
  const cancelDrag = (reason?: string) => {
    const d = dragRef.current;
    if (!d) return;
    try {
      d.el.releasePointerCapture(d.pointerId);
    } catch {
      /* not captured */
    }
    stopAutoscroll();
    setDragBoth(null);
    if (reason) setNotice({ text: reason });
  };
  // a parent revision change mid-drag discards the preview (C44-T04). Reordering rows can make the
  // browser drop pointer capture before this effect runs, so remember whether the previous render was lifted.
  const revisionRef = React.useRef(revision);
  const liftedRef = React.useRef(false);
  React.useEffect(() => {
    if (revisionRef.current !== revision) {
      revisionRef.current = revision;
      if (dragRef.current || liftedRef.current) {
        cancelDrag();
        setNotice({ text: "The board changed; the drag was cancelled." });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);
  React.useEffect(() => {
    liftedRef.current = !!drag?.lifted;
  });
  // Escape anywhere cancels a lifted drag (the handle may not hold focus)
  React.useEffect(() => {
    if (!drag?.lifted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDrag("Drag cancelled.");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.lifted]);
  React.useEffect(() => () => stopAutoscroll(), []);

  const onHandleDown = (item: T, from: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || pending || invalid || pendingItemIds.includes(item.id)) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.focus();
    el.setPointerCapture(e.pointerId);
    setDragBoth({
      itemId: item.id,
      from,
      pointerId: e.pointerId,
      el,
      startX: e.clientX,
      startY: e.clientY,
      lifted: false,
      target: null,
      dx: 0,
      dy: 0,
    });
  };
  const resolveTarget = (clientX: number, clientY: number, d: DragState): DragState["target"] => {
    if (typeof document.elementFromPoint !== "function") return null;
    const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const col = hit?.closest<HTMLElement>("[data-container]");
    if (!col || !rootRef.current?.contains(col)) return null;
    const to = col.dataset.container!;
    const ids = (itemsByContainer[to] ?? []).filter((id) => id !== d.itemId);
    let before: string | null = null;
    for (const id of ids) {
      const row = col.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`);
      if (!row) continue;
      const r = row.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        before = id;
        break;
      }
    }
    const move: MoveAddress = {
      itemId: d.itemId,
      fromContainerId: d.from,
      toContainerId: to,
      beforeItemId: before,
    };
    if (isNoopMove(itemsByContainer, move))
      return { to, before, allowed: true, reason: "No change" };
    const ev = evaluate(move);
    return { to, before, allowed: ev.allowed, reason: ev.reason };
  };
  const onHandleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.lifted && Math.hypot(dx, dy) < 6) return;
    const target = resolveTarget(e.clientX, e.clientY, d);
    const next: DragState = { ...d, lifted: true, dx, dy, target };
    setDragBoth(next);
    if (autoscroll) tickAutoscroll(e.clientY);
  };
  const tickAutoscroll = (clientY: number) => {
    const root = scrollRef.current;
    stopAutoscroll();
    if (!root) return;
    const r = root.getBoundingClientRect();
    const edge = 40;
    const dir = clientY < r.top + edge ? -1 : clientY > r.bottom - edge ? 1 : 0;
    if (!dir || clientY < r.top || clientY > r.bottom) return; // bounded to the board; pauses outside
    const step = () => {
      if (!dragRef.current) return;
      root.scrollTop += dir * 8;
      autoscrollRaf.current = requestAnimationFrame(step);
    };
    autoscrollRaf.current = requestAnimationFrame(step);
  };
  const onHandleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const target = d.lifted ? d.target : null;
    cancelDrag();
    if (!target || !target.allowed || target.reason === "No change") return;
    request(
      {
        itemId: d.itemId,
        fromContainerId: d.from,
        toContainerId: target.to,
        beforeItemId: target.before,
      },
      "pointer",
    );
  };
  const onHandleCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    cancelDrag(d.lifted ? "Drag cancelled." : undefined);
  };

  /* preview: a placeholder marks the candidate slot; the source collections are never touched,
     and the dragged row (with its captured handle) stays mounted in its own container, collapsed */
  const placeholder =
    drag?.lifted && drag.target?.allowed && drag.target.reason !== "No change"
      ? { itemId: drag.itemId, to: drag.target.to, before: drag.target.before }
      : null;

  /* focus management */
  const itemRefs = React.useRef(new Map<string, HTMLElement>());
  React.useEffect(() => {
    if (!focusRequest) return;
    itemRefs.current
      .get(focusRequest.id)
      ?.querySelector<HTMLElement>("[data-move-button]")
      ?.focus();
  }, [focusRequest]);
  React.useImperativeHandle(
    ref,
    () => ({
      root: rootRef.current,
      focusItem: (id) =>
        itemRefs.current.get(id)?.querySelector<HTMLElement>("[data-move-button]")?.focus(),
    }),
    [],
  );

  /* move menu */
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const uid = React.useId();
  const liveMove =
    drag?.lifted && drag.target
      ? drag.target.allowed
        ? drag.target.reason === "No change"
          ? ""
          : `Drop to move to ${containers.find((c) => c.id === drag.target!.to)?.label}${drag.target.before ? ` before ${itemMap.get(drag.target.before)?.title}` : ""}`
        : `Cannot drop here: ${drag.target.reason}`
      : drag?.lifted
        ? "Dragging"
        : "";

  return (
    <div
      ref={rootRef}
      data-slot="transfer-board"
      data-variant={variant}
      data-motion={mode}
      data-state={pending ? "pending" : drag?.lifted ? "preview" : "idle"}
      data-invalid={invalid || undefined}
      role="group"
      aria-label={label}
      className={cn(
        "relative flex w-full flex-col gap-3 text-[var(--cui-transfer-text,light-dark(#141311,#ecebe6))]",
        className,
      )}
      {...rest}
    >
      {invalid && (
        <div
          role="note"
          className="rounded-xl border border-[var(--cui-transfer-blocked,light-dark(#b8310c,#ff8a65))] bg-[light-dark(rgba(184,49,12,0.06),rgba(255,138,101,0.08))] p-3 text-[12px] text-[var(--cui-transfer-blocked,light-dark(#b8310c,#ff8a65))]"
        >
          <strong>Board data is invalid; moves are disabled.</strong>
          <ul className="m-0 mt-1 list-disc pl-4">
            {diagnostics.map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div
        ref={scrollRef}
        className={cn(
          "flex snap-x snap-mandatory gap-[var(--cui-transfer-gap,12px)] overflow-x-auto overflow-y-auto pb-2",
          variant === "priority" && "flex-col",
        )}
        style={{ maxHeight: "var(--cui-transfer-max-height, 70vh)" }}
      >
        {containers.map((col) => {
          const ids = itemsByContainer[col.id] ?? [];
          const count = ids.length; // authoritative count, not the preview
          const slot = placeholder?.to === col.id ? placeholder : null;
          const placeholderRow = slot && (
            <li
              key="__placeholder"
              data-placeholder={slot.itemId}
              aria-hidden
              className="h-10 rounded-xl border border-dashed border-[var(--cui-transfer-placeholder,light-dark(rgba(20,19,17,0.35),rgba(236,235,230,0.35)))] bg-[light-dark(rgba(20,19,17,0.03),rgba(236,235,230,0.05))]"
            />
          );
          const isTarget = drag?.lifted && drag.target?.to === col.id;
          const blocked = isTarget && !drag!.target!.allowed;
          return (
            <section
              key={col.id}
              data-container={col.id}
              data-target={isTarget ? (blocked ? "blocked" : "valid") : undefined}
              aria-labelledby={`${uid}-${col.id}`}
              className={cn(
                "flex min-w-[var(--cui-transfer-column-width,180px)] flex-1 snap-start flex-col gap-2 rounded-2xl border-2 bg-[var(--cui-transfer-column,light-dark(rgba(20,19,17,0.04),rgba(236,235,230,0.06)))] p-2",
                isTarget && !blocked
                  ? "border-[var(--cui-transfer-valid,light-dark(#1a6b45,#5fcf8f))]"
                  : blocked
                    ? "border-dashed border-[var(--cui-transfer-blocked,light-dark(#b8310c,#ff8a65))]"
                    : "border-transparent",
              )}
            >
              <header className="flex items-center justify-between px-1 text-[13px]">
                <h3 id={`${uid}-${col.id}`} className="m-0 font-semibold">
                  {col.label}
                </h3>
                <span className="font-mono text-[11px] opacity-70" aria-label={`${count} items`}>
                  {count}
                  {col.capacity !== undefined ? `/${col.capacity}` : ""}
                  {col.readOnly ? " · read-only" : ""}
                </span>
              </header>
              {isTarget && (
                <div
                  aria-hidden
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    blocked
                      ? "bg-[light-dark(rgba(184,49,12,0.1),rgba(255,138,101,0.12))] text-[var(--cui-transfer-blocked,light-dark(#b8310c,#ff8a65))]"
                      : "bg-[light-dark(rgba(26,107,69,0.15),rgba(95,207,143,0.2))] text-[var(--cui-transfer-valid,light-dark(#1a6b45,#5fcf8f))]",
                  )}
                >
                  {blocked
                    ? `⊘ ${drag!.target!.reason}`
                    : drag!.target!.reason === "No change"
                      ? "Same position"
                      : "Drop here"}
                </div>
              )}
              <ul
                className="m-0 flex min-h-[56px] list-none flex-col gap-2 p-0"
                aria-label={`${col.label} items`}
              >
                {ids.length === 0 && !slot && (
                  <li
                    aria-hidden
                    className="grid h-14 place-items-center rounded-xl border border-dashed border-[var(--cui-transfer-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] text-[12px] text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]"
                  >
                    {col.readOnly ? "Read-only" : "Empty"}
                  </li>
                )}
                {slot && slot.before === null && ids.every((id) => id === slot.itemId)
                  ? placeholderRow
                  : null}
                {ids.map((id) => {
                  const item = itemMap.get(id);
                  if (!item) return null;
                  const isDragged = drag?.lifted && drag.itemId === id;
                  const isPending = pending?.intent.itemId === id || pendingItemIds.includes(id);
                  const from = containerOf(itemsByContainer, id) ?? col.id;
                  const handle = (
                    <button
                      type="button"
                      aria-label={`Drag ${item.title}`}
                      data-handle
                      disabled={!!pending || invalid || isPending}
                      onPointerDown={onHandleDown(item, from)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      onPointerCancel={onHandleCancel}
                      onLostPointerCapture={onHandleCancel}
                      className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-[16px] leading-none text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))] outline-none hover:bg-[light-dark(rgba(20,19,17,0.08),rgba(236,235,230,0.1))] hover:text-[var(--cui-transfer-text,light-dark(#141311,#ecebe6))] focus-visible:ring-2 focus-visible:ring-[var(--cui-transfer-focus,light-dark(#141311,#ecebe6))] active:cursor-grabbing disabled:cursor-not-allowed"
                    >
                      ⋮⋮
                    </button>
                  );
                  const moveMenu = (
                    <MoveMenu
                      item={item}
                      from={from}
                      containers={containers}
                      itemsByContainer={itemsByContainer}
                      itemMap={itemMap}
                      open={menuFor === id}
                      disabled={!!pending || invalid || isPending}
                      evaluate={evaluate}
                      onOpenChange={(o) => setMenuFor(o ? id : null)}
                      onMove={(move) => {
                        setMenuFor(null);
                        request(move, "menu");
                      }}
                      uid={`${uid}-${id}`}
                    />
                  );
                  return (
                    <React.Fragment key={id}>
                      {slot && slot.before === id ? placeholderRow : null}
                      <m.li
                        ref={(el) => {
                          if (el) itemRefs.current.set(id, el);
                          else itemRefs.current.delete(id);
                        }}
                        layout={mode === "full" && !isDragged ? "position" : false}
                        transition={{ type: "spring", stiffness: 500, damping: 36 }}
                        data-item={id}
                        data-pending={isPending || undefined}
                        data-dragging={isDragged || undefined}
                        aria-busy={isPending || undefined}
                        className={cn(
                          "relative flex items-center gap-1 rounded-xl border bg-[var(--cui-transfer-surface,light-dark(#faf9f6,#1f1f1c))] p-2 shadow-sm",
                          isDragged
                            ? "-mt-2 h-0 overflow-hidden border-0 p-0 opacity-0 shadow-none"
                            : "border-[var(--cui-transfer-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))]",
                          isPending && "opacity-60",
                        )}
                      >
                        {/* the content (and its captured handle) stays mounted while dragged; the row becomes the placeholder */}
                        <div
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-1",
                            isDragged && "invisible",
                          )}
                          aria-hidden={isDragged || undefined}
                        >
                          {renderItem ? (
                            renderItem(item, {
                              handle,
                              moveMenu,
                              pending: isPending,
                              dragging: !!isDragged,
                            })
                          ) : (
                            <>
                              {handle}
                              <span className="min-w-0 flex-1 truncate text-[13px]">
                                {item.title}
                              </span>
                              {moveMenu}
                            </>
                          )}
                        </div>
                      </m.li>
                    </React.Fragment>
                  );
                })}
                {slot && slot.before === null && !ids.every((id) => id === slot.itemId)
                  ? placeholderRow
                  : null}
              </ul>
            </section>
          );
        })}
      </div>

      {/* lifted preview follows the pointer */}
      {drag?.lifted && itemMap.get(drag.itemId) && (
        <div
          aria-hidden
          data-drag-preview
          className="pointer-events-none fixed z-50 rounded-xl border border-[var(--cui-transfer-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] bg-[var(--cui-transfer-surface,light-dark(#faf9f6,#1f1f1c))] px-3 py-2 text-[13px] shadow-[0_12px_32px_rgba(0,0,0,0.2)]"
          style={{
            left: drag.startX - 12,
            top: drag.startY - 18,
            transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(1.5deg)`,
            maxWidth: 260,
          }}
        >
          {itemMap.get(drag.itemId)!.title}
        </div>
      )}

      <div className="flex items-center gap-3">
        {undoEnabled && (
          <button
            type="button"
            onClick={requestUndo}
            disabled={!lastAccepted || !!pending || invalid}
            className="inline-flex h-8 items-center rounded-full border border-[var(--cui-transfer-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] px-3 text-[13px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.08))] focus-visible:ring-2 focus-visible:ring-[var(--cui-transfer-focus,light-dark(#141311,#ecebe6))] disabled:opacity-40"
          >
            Undo last move
          </button>
        )}
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-[1.5rem] flex-1 text-[12px]",
            notice.error ? "text-[var(--cui-transfer-blocked,light-dark(#b8310c,#ff8a65))]" : "opacity-80",
          )}
        >
          {liveMove || notice.text}
        </div>
      </div>
    </div>
  );
}

function MoveMenu<T extends TransferItem>({
  item,
  from,
  containers,
  itemsByContainer,
  itemMap,
  open,
  disabled,
  evaluate,
  onOpenChange,
  onMove,
  uid,
}: {
  item: T;
  from: string;
  containers: readonly TransferContainer[];
  itemsByContainer: ItemsByContainer;
  itemMap: Map<string, T>;
  open: boolean;
  disabled: boolean;
  evaluate: (m: MoveAddress) => { allowed: boolean; reason?: string };
  onOpenChange: (open: boolean) => void;
  onMove: (m: MoveAddress) => void;
  uid: string;
}) {
  const [to, setTo] = React.useState(from);
  const [before, setBefore] = React.useState<string>(POSITION_END);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setTo(from);
      setBefore(POSITION_END);
    }
  }
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("select")?.focus();
  }, [open]);
  const candidates = (itemsByContainer[to] ?? []).filter((id) => id !== item.id);
  const move: MoveAddress = {
    itemId: item.id,
    fromContainerId: from,
    toContainerId: to,
    beforeItemId: before === POSITION_END ? null : before,
  };
  const noop = isNoopMove(itemsByContainer, move);
  const ev = noop ? { allowed: false, reason: "Already there." } : evaluate(move);
  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        data-move-button
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${uid}-menu`}
        aria-label={`Move ${item.title}`}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-8 items-center rounded-md px-2 text-[12px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.08),rgba(236,235,230,0.1))] focus-visible:ring-2 focus-visible:ring-[var(--cui-transfer-focus,light-dark(#141311,#ecebe6))] disabled:opacity-40"
      >
        Move
      </button>
      {open && (
        <div
          ref={panelRef}
          id={`${uid}-menu`}
          role="dialog"
          aria-label={`Move ${item.title}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onOpenChange(false);
              btnRef.current?.focus();
            }
          }}
          className="absolute right-0 top-full z-20 mt-1 flex w-64 flex-col gap-2 rounded-xl border border-[var(--cui-transfer-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] bg-[var(--cui-transfer-surface,light-dark(#faf9f6,#1f1f1c))] p-3 text-[12px] shadow-lg"
        >
          <label className="flex flex-col gap-1">
            <span className="font-medium">Destination</span>
            <select
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setBefore(POSITION_END);
              }}
              className="h-8 rounded-md border border-[var(--cui-transfer-input-border,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))] bg-transparent px-1"
            >
              {containers.map((c) => {
                const probe = evaluate({
                  itemId: item.id,
                  fromContainerId: from,
                  toContainerId: c.id,
                  beforeItemId: null,
                });
                return (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.id === from
                      ? " (current)"
                      : probe.allowed
                        ? ""
                        : ` — ${probe.reason ?? "blocked"}`}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Position</span>
            <select
              value={before}
              onChange={(e) => setBefore(e.target.value)}
              className="h-8 rounded-md border border-[var(--cui-transfer-input-border,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))] bg-transparent px-1"
            >
              {candidates.map((id) => (
                <option key={id} value={id}>
                  Before {itemMap.get(id)?.title ?? id}
                </option>
              ))}
              <option value={POSITION_END}>At the end</option>
            </select>
          </label>
          {!ev.allowed && (
            <p role="alert" className="m-0 text-[var(--cui-transfer-blocked,light-dark(#b8310c,#ff8a65))]">
              ⊘ {ev.reason}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                btnRef.current?.focus();
              }}
              className="h-8 rounded-full px-3 outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.08))] focus-visible:ring-2 focus-visible:ring-[var(--cui-transfer-focus,light-dark(#141311,#ecebe6))]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!ev.allowed}
              onClick={() => onMove(move)}
              className="h-8 rounded-full bg-[var(--cui-transfer-focus,light-dark(#141311,#ecebe6))] px-3 text-[var(--cui-transfer-surface,light-dark(#faf9f6,#1f1f1c))] outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--cui-transfer-focus,light-dark(#141311,#ecebe6))] disabled:opacity-40"
            >
              Move here
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TransferBoard — move items between named containers with authority.
 *
 * Membership and order are controlled. A drop or a Move-menu confirmation
 * emits one `onMoveRequest` addressed by stable ids (`beforeItemId`, null to
 * append) with the host's `baseRevision`; the board shows pending until a
 * matching resolution arrives. Rejection restores and announces; a revision
 * change mid-drag discards the preview; undo submits the inverse move or
 * explains the conflict. The Move menu is the primary, click-only path;
 * handle drag is an enhancement with bounded autoscroll.
 */
export const TransferBoard = React.forwardRef(TransferBoardInner) as <T extends TransferItem>(
  props: TransferBoardProps<T> & React.RefAttributes<TransferBoardHandle>,
) => React.ReactElement;
(TransferBoard as unknown as { displayName: string }).displayName = "TransferBoard";
