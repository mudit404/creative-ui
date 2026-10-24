"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { allocateLanes, clampWindow, formatInZone, levelForStep, linearTimeScale, parseIsoWithOffset, sortEvents, ticksFor, toIso, validateDomain, validateEvents, zoomWindow, type TimeEvent, type TimeWindow } from "@/lib/time-scale";

export type { TimeEvent, TimeWindow } from "@/lib/time-scale";

export type WindowSource = "brush" | "pan" | "handle" | "zoom" | "editor" | "fit" | "select";

export interface TimeLensHandle {
  root: HTMLDivElement | null;
  /** Select an event and bring it into view (requests, not mutations). */
  focusEvent: (id: string) => void;
  fitWindow: (win?: TimeWindow) => void;
}

export interface TimeLensProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  events: readonly TimeEvent[];
  domain: TimeWindow;
  window?: TimeWindow;
  defaultWindow?: TimeWindow;
  minSpan?: number;
  /** IANA zone used for display only; values stay epoch ms. */
  timeZone?: string;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelectedIdChange?: (id: string | null, reason: "canvas" | "list" | "clear") => void;
  onWindowPreview?: (win: TimeWindow, source: WindowSource) => void;
  onWindowCommit?: (win: TimeWindow, source: WindowSource) => void;
  /** Wheel zoom only with this modifier held and the lane focused; never unconditional. */
  wheelZoom?: "off" | "ctrl" | "alt" | "shift";
  renderEvent?: (event: TimeEvent, selected: boolean) => React.ReactNode;
  renderDetails?: (event: TimeEvent) => React.ReactNode;
  variant?: "incidents" | "releases" | "history";
  label?: string;
  motion?: "auto" | "reduced" | "off";
}

const OVERVIEW_H = 88;
const LANE_H = 28;

/**
 * TimeLens — an overview band with a brushed window above a magnified detail
 * lane. Timestamps are epoch milliseconds and never change; the window is a
 * clamped interval that pointer gestures preview and release commits. Zoom
 * buttons, an ISO interval editor and an event list give the same control
 * without dragging.
 */
export const TimeLens = React.forwardRef<TimeLensHandle, TimeLensProps>(function TimeLens(
  {
    events: eventsProp,
    domain,
    window: windowProp,
    defaultWindow,
    minSpan = 60_000,
    timeZone = "UTC",
    selectedId: selectedProp,
    defaultSelectedId = null,
    onSelectedIdChange,
    onWindowPreview,
    onWindowCommit,
    wheelZoom = "off",
    renderEvent,
    renderDetails,
    variant = "incidents",
    label = "Timeline",
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  /* data */
  const domainError = validateDomain(domain);
  const d0 = domain[0];
  const d1 = domain[1];
  const dom = React.useMemo<TimeWindow>(() => (domainError ? [0, 36e5] : [d0, d1]), [domainError, d0, d1]);
  const { valid, diagnostics } = React.useMemo(() => validateEvents(eventsProp), [eventsProp]);
  const sorted = React.useMemo(() => sortEvents(valid), [valid]);
  // point events reserve 2% of the domain so simultaneous points and starts stack instead of overlapping
  const lanes = React.useMemo(() => allocateLanes(sorted, (dom[1] - dom[0]) * 0.02), [sorted, dom]);
  const laneCount = Math.max(1, lanes.size ? Math.max(...lanes.values()) + 1 : 1);

  /* window */
  const [internalWin, setInternalWin] = React.useState<TimeWindow>(() => clampWindow(defaultWindow ?? dom, dom, minSpan));
  const committed = React.useMemo(() => clampWindow(windowProp ?? internalWin, dom, minSpan), [windowProp, internalWin, dom, minSpan]);
  const [preview, setPreview] = React.useState<TimeWindow | null>(null);
  const win = preview ?? committed;
  const commit = (next: TimeWindow, source: WindowSource) => {
    const c = clampWindow(next, dom, minSpan);
    setPreview(null);
    if (windowProp === undefined) setInternalWin(c);
    onWindowCommit?.(c, source);
  };
  const previewWin = (next: TimeWindow, source: WindowSource) => {
    const c = clampWindow(next, dom, minSpan);
    setPreview(c);
    onWindowPreview?.(c, source);
  };

  /* selection */
  const [internalSel, setInternalSel] = React.useState<string | null>(defaultSelectedId);
  const selectedId = selectedProp !== undefined ? selectedProp : internalSel;
  const selected = selectedId ? sorted.find((e) => e.id === selectedId) ?? null : null;
  const select = (id: string | null, reason: "canvas" | "list" | "clear") => {
    if (selectedProp === undefined) setInternalSel(id);
    onSelectedIdChange?.(id, reason);
    if (id) {
      const e = valid.find((x) => x.id === id);
      if (e && (e.startMs < committed[0] || (e.endMs ?? e.startMs) > committed[1])) {
        const span = committed[1] - committed[0];
        const mid = e.endMs ? (e.startMs + e.endMs) / 2 : e.startMs;
        commit([mid - span / 2, mid + span / 2], "select"); // bring into view at the same zoom (C46-T08)
      }
    }
  };

  /* a data/domain revision during a brush cancels it (C46-T07) */
  const dataKey = `${dom[0]}:${dom[1]}:${valid.length}:${valid[0]?.id ?? ""}`;
  const [seenKey, setSeenKey] = React.useState(dataKey);
  const gesture = React.useRef<{ kind: "pan" | "start" | "end"; pointerId: number; el: HTMLElement; startX: number; base: TimeWindow } | null>(null);
  if (seenKey !== dataKey) {
    setSeenKey(dataKey);
    if (preview) setPreview(null);
  }
  React.useEffect(() => {
    if (gesture.current && seenKey === dataKey && preview === null) {
      // a revision cleared the preview: release the pointer too
      try {
        gesture.current.el.releasePointerCapture(gesture.current.pointerId);
      } catch {
        /* released */
      }
      gesture.current = null;
    }
  }, [seenKey, dataKey, preview]);

  /* measurement */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bandRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = bandRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0]?.contentRect.width ?? el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = width || 600;
  const overview = linearTimeScale(dom, w);
  const detail = linearTimeScale(win, w);

  /* overview gestures */
  const beginGesture = (kind: "pan" | "start" | "end") => (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { kind, pointerId: e.pointerId, el: e.currentTarget, startX: e.clientX, base: committed };
    previewWin(committed, kind === "pan" ? "pan" : "handle");
  };
  const moveGesture = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dms = ((e.clientX - g.startX) / w) * overview.span;
    if (g.kind === "pan") previewWin([g.base[0] + dms, g.base[1] + dms], "pan");
    else if (g.kind === "start") previewWin([Math.min(g.base[0] + dms, g.base[1] - minSpan), g.base[1]], "handle");
    else previewWin([g.base[0], Math.max(g.base[1] + dms, g.base[0] + minSpan)], "handle");
  };
  const endGesture = (e: React.PointerEvent<HTMLElement>, cancelled = false) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    try {
      g.el.releasePointerCapture(g.pointerId);
    } catch {
      /* released */
    }
    gesture.current = null;
    if (cancelled || !preview) setPreview(null);
    else commit(preview, g.kind === "pan" ? "pan" : "handle");
  };
  const onBandClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // click on the overview (not on the window) recentres the window there
    if ((e.target as HTMLElement).closest("[data-window]")) return;
    const rr = e.currentTarget.getBoundingClientRect();
    const ms = overview.toMs(e.clientX - rr.left);
    const span = committed[1] - committed[0];
    commit([ms - span / 2, ms + span / 2], "brush");
  };

  /* keyboard on handles */
  const stepKeys = (which: "start" | "end") => (e: React.KeyboardEvent<HTMLElement>) => {
    const step = Math.max(minSpan, (committed[1] - committed[0]) * 0.05);
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next: TimeWindow = which === "start" ? [Math.min(committed[0] + dir * step, committed[1] - minSpan), committed[1]] : [committed[0], Math.max(committed[1] + dir * step, committed[0] + minSpan)];
    commit(next, "handle");
  };

  /* zoom */
  const zoom = (factor: number) => commit(zoomWindow(committed, factor, dom, minSpan), "zoom");
  const fit = (target?: TimeWindow) => commit(target ?? dom, "fit");
  // React registers wheel listeners as passive, so an opt-in zoom needs a native non-passive listener.
  const laneRef = React.useRef<HTMLDivElement>(null);
  const wheelState = React.useRef({ committed, dom, minSpan, w, commit });
  React.useEffect(() => {
    wheelState.current = { committed, dom, minSpan, w, commit };
  });
  React.useEffect(() => {
    const el = laneRef.current;
    if (!el || wheelZoom === "off") return; // ordinary page scroll (C46-T06)
    const onWheel = (e: WheelEvent) => {
      const held = wheelZoom === "ctrl" ? e.ctrlKey || e.metaKey : wheelZoom === "alt" ? e.altKey : e.shiftKey;
      if (!held || document.activeElement !== el) return;
      e.preventDefault();
      const st = wheelState.current;
      const rr = el.getBoundingClientRect();
      const scale = linearTimeScale(st.committed, st.w);
      st.commit(zoomWindow(st.committed, e.deltaY < 0 ? 0.5 : 2, st.dom, st.minSpan, scale.toMs(e.clientX - rr.left)), "zoom");
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheelZoom]);

  /* editor */
  const [editStart, setEditStart] = React.useState(() => toIso(committed[0]));
  const [editEnd, setEditEnd] = React.useState(() => toIso(committed[1]));
  const [editError, setEditError] = React.useState<string | null>(null);
  const [syncedWin, setSyncedWin] = React.useState(committed);
  if (syncedWin[0] !== committed[0] || syncedWin[1] !== committed[1]) {
    setSyncedWin(committed);
    setEditStart(toIso(committed[0]));
    setEditEnd(toIso(committed[1]));
    setEditError(null);
  }
  const applyEditor = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseIsoWithOffset(editStart);
    const t = parseIsoWithOffset(editEnd);
    if (s === null || t === null) {
      setEditError("Use ISO-8601 with an offset, e.g. 2026-03-08T06:30:00Z.");
      return;
    }
    if (t <= s) {
      setEditError("End must be after start.");
      return;
    }
    if (t - s < minSpan) {
      setEditError(`The interval must be at least ${Math.round(minSpan / 1000)} s.`);
      return;
    }
    setEditError(null);
    commit([s, t], "editor");
  };

  const eventRefs = React.useRef(new Map<string, HTMLElement>());
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusEvent: (id) => { select(id, "list"); eventRefs.current.get(id)?.focus(); }, fitWindow: (x) => fit(x) }));

  const uid = React.useId();
  const ticks = ticksFor(win, Math.max(3, Math.floor(w / 110)));
  const level = levelForStep(ticks[0]?.step ?? 36e5);
  const visible = sorted.filter((e) => (e.endMs ?? e.startMs) >= win[0] && e.startMs <= win[1]);
  const transition = mode === "full" ? "left 240ms cubic-bezier(.2,.8,.2,1), width 240ms cubic-bezier(.2,.8,.2,1)" : undefined;
  const fmt = (ms: number, lvl: "date" | "datetime" | "time" | "full" = "full") => formatInZone(ms, timeZone, lvl);
  const summary = `${fmt(win[0], "datetime")} to ${fmt(win[1], "datetime")} (${timeZone}), ${visible.length} of ${sorted.length} events`;

  return (
    <div
      ref={rootRef}
      data-slot="time-lens"
      data-variant={variant}
      data-motion={mode}
      data-state={preview ? "brushing" : "ready"}
      role="group"
      aria-label={label}
      className={cn("flex w-full flex-col gap-3 text-[var(--cui-time-text,#141311)]", className)}
      {...rest}
    >
      {(domainError || diagnostics.length > 0) && (
        <div role="note" className="rounded-lg border border-[var(--cui-time-error,#c8360d)] p-2 text-[12px] text-[var(--cui-time-error,#c8360d)]">
          {domainError && <div>Invalid domain: {domainError}. Showing a placeholder hour.</div>}
          {diagnostics.map((d) => (
            <div key={d.id + d.message}>{d.message}</div>
          ))}
        </div>
      )}

      {/* overview band */}
      <div ref={bandRef} data-overview role="presentation" onClick={onBandClick} className="relative select-none overflow-hidden rounded-xl bg-[var(--cui-time-axis,rgba(20,19,17,0.06))]" style={{ height: OVERVIEW_H }}>
        {sorted.map((e) => (
          <span key={e.id} aria-hidden className="absolute top-3 h-1.5 rounded-full bg-[var(--cui-time-event,#141311)] opacity-50" style={{ left: overview.toX(e.startMs), width: Math.max(2, overview.toX(e.endMs ?? e.startMs) - overview.toX(e.startMs)) }} />
        ))}
        <div
          data-window
          role="presentation"
          onPointerDown={beginGesture("pan")}
          onPointerMove={moveGesture}
          onPointerUp={(e) => endGesture(e)}
          onPointerCancel={(e) => endGesture(e, true)}
          className="absolute inset-y-0 cursor-grab touch-none border-x-2 border-[var(--cui-time-selection,#1f7a4f)] bg-[var(--cui-time-selection-fill,rgba(31,122,79,0.15))]"
          style={{ left: overview.toX(win[0]), width: Math.max(4, overview.toX(win[1]) - overview.toX(win[0])) }}
        >
          {(["start", "end"] as const).map((which) => (
            <div
              key={which}
              role="slider"
              tabIndex={0}
              aria-label={which === "start" ? "Window start" : "Window end"}
              aria-valuemin={dom[0]}
              aria-valuemax={dom[1]}
              aria-valuenow={which === "start" ? win[0] : win[1]}
              aria-valuetext={fmt(which === "start" ? win[0] : win[1])}
              data-handle={which}
              onPointerDown={beginGesture(which)}
              onPointerMove={moveGesture}
              onPointerUp={(e) => endGesture(e)}
              onPointerCancel={(e) => endGesture(e, true)}
              onKeyDown={stepKeys(which)}
              className={cn("absolute inset-y-0 w-4 cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-time-focus,#141311)]", which === "start" ? "-left-2" : "-right-2")}
            >
              <span aria-hidden className="absolute left-1/2 top-1/2 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--cui-time-selection,#1f7a4f)]" />
            </div>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <button type="button" onClick={() => zoom(0.5)} className={BTN} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoom(2)} className={BTN} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => fit()} className={BTN}>
          Fit
        </button>
        <form onSubmit={applyEditor} className="flex flex-wrap items-center gap-1" aria-label="Interval editor">
          <input aria-label="Window start (ISO)" value={editStart} onChange={(e) => setEditStart(e.target.value)} aria-invalid={!!editError || undefined} className={INPUT} />
          <span aria-hidden>→</span>
          <input aria-label="Window end (ISO)" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} aria-invalid={!!editError || undefined} className={INPUT} />
          <button type="submit" className={BTN}>
            Apply
          </button>
          {editError && (
            <span role="alert" className="text-[var(--cui-time-error,#c8360d)]">
              {editError}
            </span>
          )}
        </form>
        <span className="ml-auto opacity-70">{timeZone}</span>
      </div>

      {/* detail lane */}
      <div
        ref={laneRef}
        data-detail
        tabIndex={wheelZoom === "off" ? undefined : 0}
        aria-label={`Detail: ${summary}`}
        role="region"
        className="relative overflow-hidden rounded-xl border border-[var(--cui-time-axis,rgba(20,19,17,0.12))] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-time-focus,#141311)]"
        style={{ height: Math.max(240, 40 + laneCount * LANE_H + 16) }}
      >
        {sorted.length === 0 && <p className="absolute inset-0 m-0 grid place-items-center text-[13px] opacity-70">No events in this timeline.</p>}
        {sorted.length > 0 && visible.length === 0 && <p className="absolute inset-0 m-0 grid place-items-center text-[13px] opacity-70">No events in this interval. Zoom out or Fit.</p>}
        {/* axis */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-8 border-b border-[var(--cui-time-axis,rgba(20,19,17,0.12))]">
          {ticks.map((t) => (
            <span key={t.ms} data-tick className="absolute top-1 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] opacity-70" style={{ left: detail.toX(t.ms), transition }}>
              {fmt(t.ms, level)}
            </span>
          ))}
          {ticks.map((t) => (
            <span key={`l${t.ms}`} className="absolute bottom-0 h-2 w-px bg-[var(--cui-time-axis,rgba(20,19,17,0.3))]" style={{ left: detail.toX(t.ms), transition }} />
          ))}
        </div>
        {/* stationary focus marker */}
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-[var(--cui-time-focus,#141311)] opacity-30" />
        {visible.map((e) => {
          const lane = lanes.get(e.id) ?? 0;
          const x0 = detail.toX(e.startMs);
          const x1 = detail.toX(e.endMs ?? e.startMs);
          const isSel = e.id === selectedId;
          return (
            <button
              key={e.id}
              ref={(el) => {
                if (el) eventRefs.current.set(e.id, el);
                else eventRefs.current.delete(e.id);
              }}
              type="button"
              data-event={e.id}
              aria-pressed={isSel}
              aria-label={`${e.label}, ${fmt(e.startMs)}${e.endMs ? ` to ${fmt(e.endMs)}` : ""}`}
              onClick={() => select(isSel ? null : e.id, isSel ? "clear" : "canvas")}
              className={cn(
                "absolute flex h-6 items-center gap-1 rounded-full px-1.5 text-left text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-time-focus,#141311)]",
                e.endMs ? "bg-[var(--cui-time-event,#141311)] text-[var(--cui-time-event-text,#faf9f6)]" : "bg-transparent",
                isSel && "ring-2 ring-[var(--cui-time-selection,#1f7a4f)]",
              )}
              style={{ left: Math.max(-4, x0), width: e.endMs ? Math.max(8, Math.min(x1, w + 4) - Math.max(-4, x0)) : undefined, top: 40 + lane * LANE_H, transition }}
            >
              {!e.endMs && <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--cui-time-event,#141311)]" />}
              {renderEvent ? renderEvent(e, isSel) : <span className="truncate">{e.label}</span>}
            </button>
          );
        })}
      </div>

      {/* details + list */}
      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,1.4fr)]">
        <div aria-live="polite" className="rounded-xl border border-[var(--cui-time-axis,rgba(20,19,17,0.12))] p-3 text-[13px]" data-details>
          {selected ? (
            renderDetails ? (
              renderDetails(selected)
            ) : (
              <>
                <div className="font-semibold">{selected.label}</div>
                <div className="font-mono text-[11px] opacity-70">
                  {fmt(selected.startMs)}
                  {selected.endMs ? ` → ${fmt(selected.endMs)}` : ""}
                </div>
                {selected.severity && <div className="mt-1 text-[11px] uppercase tracking-wide opacity-70">{selected.severity}</div>}
                {selected.details && <p className="m-0 mt-1 opacity-80">{selected.details}</p>}
              </>
            )
          ) : (
            <span className="opacity-60">Select an event to see details.</span>
          )}
        </div>
        <div className="min-w-0">
          <h3 id={`${uid}-list`} className="m-0 mb-1 text-[12px] font-semibold uppercase tracking-wide opacity-70">
            All events ({sorted.length})
          </h3>
          <ul aria-labelledby={`${uid}-list`} className="m-0 max-h-48 list-none overflow-y-auto p-0 text-[13px]">
            {sorted.map((e) => (
              <li key={e.id}>
                <button type="button" aria-pressed={e.id === selectedId} onClick={() => select(e.id, "list")} className={cn("flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left outline-none hover:bg-[rgba(20,19,17,0.05)] focus-visible:ring-2 focus-visible:ring-[var(--cui-time-focus,#141311)]", e.id === selectedId && "bg-[rgba(31,122,79,0.1)]")}>
                  <span className="shrink-0 font-mono text-[11px] opacity-70">{fmt(e.startMs, "datetime")}</span>
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div role="status" className="sr-only">
        {summary}
      </div>
    </div>
  );
});
TimeLens.displayName = "TimeLens";

const BTN =
  "inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--cui-time-axis,rgba(20,19,17,0.25))] px-2 text-[12px] outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-time-focus,#141311)] disabled:opacity-40";
const INPUT = "h-7 w-[180px] rounded-md border border-[var(--cui-time-axis,rgba(20,19,17,0.25))] bg-transparent px-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-time-focus,#141311)] aria-[invalid]:border-[var(--cui-time-error,#c8360d)]";
