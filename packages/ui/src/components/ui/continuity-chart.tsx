"use client";

import * as React from "react";
import { AnimatePresence, motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { layoutRows, sharedDomain, validateSnapshots, valueTicks, type ChartRow, type Snapshot, type SortMode } from "@/lib/chart-layout";

export type { ChartRow, Snapshot, SortMode } from "@/lib/chart-layout";

export type ChartMode = "bars" | "dots";

export interface ContinuityChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  snapshots: readonly Snapshot[];
  snapshotId?: string;
  defaultSnapshotId?: string;
  onSnapshotChange?: (id: string) => void;
  mode?: ChartMode;
  defaultMode?: ChartMode;
  onModeChange?: (mode: ChartMode) => void;
  /** Explicit value domain; otherwise shared across snapshots and including zero. */
  domain?: [number, number];
  sort?: SortMode;
  formatValue?: (value: number, unit: string) => string;
  /** Required meaningful description of what the chart shows. */
  summary: string;
  /** Show the data table by default. */
  defaultShowTable?: boolean;
  variant?: "ranking" | "comparison" | "explanation";
  label?: string;
  motion?: "auto" | "reduced" | "off";
  durationScale?: number;
}

const ROW_H = 28;
const LABEL_W = 140;
const VALUE_W = 72;
const COLORS = ["#ff4d1c", "#1d2a6b", "#1f7a4f", "#c8a000", "#7a4fff", "#0f8b8d", "#b5176b", "#5c6b73", "#e07a5f", "#3d405b", "#81b29a", "#f2cc8f"];

/**
 * ContinuityChart — keyed bars that morph into dots and reorder across
 * snapshots without losing identity.
 *
 * Every mark is keyed by entity id, so rows travel to their new rank and a
 * colour belongs to an entity, never to a position. Bars start at zero;
 * negatives extend left; null is "Not available" and never a zero-length
 * bar. Values shown in text, tooltips and the table are always the committed
 * snapshot's values; only geometry interpolates.
 */
export const ContinuityChart = React.forwardRef<HTMLDivElement, ContinuityChartProps>(function ContinuityChart(
  {
    snapshots,
    snapshotId: snapshotProp,
    defaultSnapshotId,
    onSnapshotChange,
    mode: modeProp,
    defaultMode = "bars",
    onModeChange,
    domain: domainProp,
    sort: sortProp,
    formatValue,
    summary,
    defaultShowTable = false,
    variant = "ranking",
    label = "Chart",
    motion = "auto",
    durationScale = 1,
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const animate = mode === "full";

  /* validation: table-only on failure (C57-T04, C57-T10) */
  const diagnostics = React.useMemo(() => validateSnapshots(snapshots), [snapshots]);
  const invalid = diagnostics.length > 0;

  /* selection */
  const [internalSnap, setInternalSnap] = React.useState<string | undefined>(defaultSnapshotId);
  const requestedId = snapshotProp ?? internalSnap;
  const snapshot = snapshots.find((s) => s.id === requestedId) ?? snapshots[0] ?? null;
  const selectSnapshot = (id: string) => {
    if (snapshotProp === undefined) setInternalSnap(id);
    onSnapshotChange?.(id);
  };
  const [internalMode, setInternalMode] = React.useState<ChartMode>(defaultMode);
  const markMode = modeProp ?? internalMode;
  const selectMode = (next: ChartMode) => {
    if (modeProp === undefined) setInternalMode(next);
    onModeChange?.(next);
  };
  const sort: SortMode = sortProp ?? (variant === "comparison" ? "input" : variant === "ranking" ? "descending" : "input");
  const [showTable, setShowTable] = React.useState(defaultShowTable);
  const [selectedRow, setSelectedRow] = React.useState<string | null>(null);

  /* transition label: visible while geometry interpolates, never a measurement */
  const [transitioning, setTransitioning] = React.useState(false);
  const stamp = `${snapshot?.id ?? ""}|${markMode}`;
  const [seenStamp, setSeenStamp] = React.useState(stamp);
  if (seenStamp !== stamp) {
    setSeenStamp(stamp);
    if (animate) setTransitioning(true);
  }
  React.useEffect(() => {
    if (!transitioning) return;
    const t = setTimeout(() => setTransitioning(false), 520 * durationScale);
    return () => clearTimeout(t);
  }, [transitioning, stamp, durationScale]);

  /* measurement */
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0]?.contentRect.width ?? el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const plotW = Math.max(120, (width || 640) - LABEL_W - VALUE_W);

  /* layout (pure) */
  const domain = React.useMemo<[number, number]>(() => domainProp ?? sharedDomain(snapshots), [domainProp, snapshots]);
  const rows = React.useMemo(() => (snapshot ? layoutRows(snapshot.rows, { domain, width: plotW, rowHeight: ROW_H, sort }) : []), [snapshot, domain, plotW, sort]);
  const colorOf = React.useMemo(() => {
    const ids = new Set<string>();
    for (const s of snapshots) for (const r of s.rows) ids.add(r.id);
    const ordered = [...ids];
    return (id: string, row?: ChartRow) => row?.color ?? snapshots.flatMap((s) => s.rows).find((r) => r.id === id)?.color ?? COLORS[ordered.indexOf(id) % COLORS.length]!;
  }, [snapshots]);
  const unit = snapshot?.unit ?? "";
  const fmt = (v: number | null) => (v === null ? "Not available" : formatValue ? formatValue(v, unit) : `${Number.isInteger(v) ? v : v.toFixed(1)}${unit ? ` ${unit}` : ""}`);
  const ticks = valueTicks(domain, 5);
  const zeroX = ((0 - domain[0]) / (domain[1] - domain[0] || 1)) * plotW;
  const height = rows.length * ROW_H;
  const uid = React.useId();
  const spring = { type: "spring" as const, duration: (markMode === "dots" ? 0.36 : 0.5) * durationScale, bounce: 0 };
  const rowFor = (id: string) => snapshot?.rows.find((r) => r.id === id);

  return (
    <div
      ref={ref}
      data-slot="continuity-chart"
      data-variant={variant}
      data-motion={mode}
      data-mode={markMode}
      data-state={invalid ? "table-only" : transitioning ? "morphing" : "ready"}
      role="group"
      aria-label={label}
      className={cn("flex w-full flex-col gap-3 text-[var(--cui-chart-text,#141311)]", className)}
      {...rest}
    >
      <p className="m-0 text-[13px]" id={`${uid}-summary`}>
        {summary}
      </p>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <div role="group" aria-label="Representation" className="inline-flex rounded-full border border-[var(--cui-chart-axis,rgba(20,19,17,0.25))] p-0.5">
          {(["bars", "dots"] as const).map((mm) => (
            <button key={mm} type="button" aria-pressed={markMode === mm} disabled={invalid} onClick={() => selectMode(mm)} className={cn("rounded-full px-3 py-1 capitalize outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-chart-selected,#141311)]", markMode === mm && "bg-[var(--cui-chart-selected,#141311)] text-[var(--cui-chart-bg,#faf9f6)]")}>
              {mm}
            </button>
          ))}
        </div>
        {snapshots.length > 1 && (
          <label className="flex items-center gap-1">
            <span>Snapshot</span>
            <select aria-label="Snapshot" value={snapshot?.id ?? ""} onChange={(e) => selectSnapshot(e.target.value)} disabled={invalid} className="h-7 rounded-md border border-[var(--cui-chart-axis,rgba(20,19,17,0.25))] bg-transparent px-1">
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" aria-pressed={showTable} aria-controls={`${uid}-table`} onClick={() => setShowTable((v) => !v)} className="rounded-full border border-[var(--cui-chart-axis,rgba(20,19,17,0.25))] px-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-chart-selected,#141311)]">
          {showTable ? "Hide table" : "Show table"}
        </button>
        <span role="status" aria-live="polite" className="ml-auto opacity-70">
          {invalid ? "Chart unavailable; see the table." : transitioning ? "Transitioning…" : snapshot ? `${snapshot.label}, ${snapshot.rows.length} categories` : ""}
        </span>
      </div>

      {invalid && (
        <div role="note" className="rounded-lg border border-[var(--cui-chart-error,#c8360d)] p-2 text-[12px] text-[var(--cui-chart-error,#c8360d)]">
          <ul className="m-0 list-disc pl-4">
            {diagnostics.map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* chart */}
      {!invalid && snapshot && (
        <div ref={wrapRef} className="w-full" data-chart aria-describedby={`${uid}-summary`}>
          <div className="relative" style={{ height: height + 28 }}>
            {/* axis */}
            <div aria-hidden className="absolute bottom-0 h-6 border-t border-[var(--cui-chart-axis,rgba(20,19,17,0.25))]" style={{ left: LABEL_W, width: plotW }}>
              {ticks.map((t) => (
                <span key={t} className="absolute top-1 -translate-x-1/2 font-mono text-[10px] opacity-70" style={{ left: ((t - domain[0]) / (domain[1] - domain[0] || 1)) * plotW }}>
                  {t}
                </span>
              ))}
              <span className="absolute -top-1 right-0 translate-y-6 font-mono text-[10px] opacity-70">{unit}</span>
            </div>
            <svg aria-hidden className="absolute left-0 top-0 overflow-visible" width={LABEL_W + plotW + VALUE_W} height={height} style={{ left: 0 }}>
              <g transform={`translate(${LABEL_W},0)`}>
                {ticks.map((t) => (
                  <line key={t} x1={((t - domain[0]) / (domain[1] - domain[0] || 1)) * plotW} x2={((t - domain[0]) / (domain[1] - domain[0] || 1)) * plotW} y1={0} y2={height} stroke="var(--cui-chart-grid, rgba(20,19,17,0.08))" />
                ))}
                <line x1={zeroX} x2={zeroX} y1={0} y2={height} stroke="var(--cui-chart-axis, rgba(20,19,17,0.5))" />
                <AnimatePresence initial={false}>
                  {rows.map((r) => {
                    const color = colorOf(r.id, rowFor(r.id));
                    const isDot = markMode === "dots";
                    const x = Math.min(r.x0, r.x1);
                    const wBar = Math.abs(r.x1 - r.x0);
                    const thickness = isDot ? 12 : 18;
                    const rect = { x: isDot ? r.x1 - 6 : x, width: isDot ? 12 : Math.max(0.5, wBar), y: (ROW_H - thickness) / 2, height: thickness, rx: isDot ? 6 : 3 };
                    const dim = selectedRow && selectedRow !== r.id ? 0.35 : 1;
                    const content =
                      r.value !== null ? (
                        <>
                          {animate ? (
                            <m.rect data-bar initial={false} animate={{ attrX: rect.x, attrY: rect.y, width: rect.width, height: rect.height, rx: rect.rx }} transition={spring} fill={color} opacity={dim} />
                          ) : (
                            <rect data-bar {...rect} fill={color} opacity={dim} />
                          )}
                          {r.overflow && (
                            <text x={r.x1 + 4} y={ROW_H / 2 + 4} fontSize={11} fill="var(--cui-chart-error, #c8360d)">
                              ⚠
                            </text>
                          )}
                        </>
                      ) : (
                        <text x={zeroX + 6} y={ROW_H / 2 + 4} fontSize={11} fill="var(--cui-chart-axis, rgba(20,19,17,0.6))">
                          — Not available
                        </text>
                      );
                    // reduced/off: plain SVG so geometry is exact and synchronous; full: Motion springs
                    return animate ? (
                      <m.g key={r.id} data-mark={r.id} initial={{ opacity: 0, y: r.y }} animate={{ opacity: 1, y: r.y }} exit={{ opacity: 0 }} transition={spring} style={{ x: 0 }}>
                        {content}
                      </m.g>
                    ) : (
                      <g key={r.id} data-mark={r.id} transform={`translate(0 ${r.y})`}>
                        {content}
                      </g>
                    );
                  })}
                </AnimatePresence>
              </g>
            </svg>
            {/* persistent label + value columns, keyed: authoritative text, never interpolated */}
            <ul className="absolute left-0 top-0 m-0 list-none p-0" style={{ width: LABEL_W + plotW + VALUE_W }} aria-label="Categories">
              <AnimatePresence initial={false}>
                {rows.map((r) => {
                  const inner = (
                    <>
                      <button
                        type="button"
                        aria-pressed={selectedRow === r.id}
                        aria-label={`${r.label}: ${fmt(r.value)}`}
                        title={`${r.label}: ${fmt(r.value)}`}
                        onClick={() => setSelectedRow((s) => (s === r.id ? null : r.id))}
                        className={cn("flex h-full items-center gap-2 truncate rounded px-1 text-left text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-chart-selected,#141311)]", selectedRow === r.id && "font-semibold")}
                        style={{ width: LABEL_W }}
                      >
                        <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: colorOf(r.id, rowFor(r.id)) }} />
                        <span className="truncate">{r.label}</span>
                      </button>
                      <span aria-hidden className="pointer-events-none" style={{ width: plotW }} />
                      <span data-value className="w-[72px] shrink-0 pl-2 text-right font-mono text-[11px] tabular-nums" aria-hidden>
                        {r.value === null ? "—" : fmt(r.value)}
                      </span>
                    </>
                  );
                  const cls = "absolute left-0 flex w-full items-center";
                  return animate ? (
                    <m.li key={r.id} data-row={r.id} initial={{ opacity: 0, y: r.y }} animate={{ opacity: 1, y: r.y }} exit={{ opacity: 0 }} transition={spring} className={cls} style={{ height: ROW_H, top: 0 }}>
                      {inner}
                    </m.li>
                  ) : (
                    <li key={r.id} data-row={r.id} className={cls} style={{ height: ROW_H, top: 0, transform: `translateY(${r.y}px)` }}>
                      {inner}
                    </li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        </div>
      )}

      {/* data table: the non-animated, always-truthful view */}
      <table id={`${uid}-table`} hidden={!showTable && !invalid} className="w-full border-collapse text-[12px]" data-table>
        <caption className="sr-only">
          {snapshot?.label ?? "Data"} ({unit})
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-[var(--cui-chart-axis,rgba(20,19,17,0.25))] py-1 text-left">
              Category
            </th>
            <th scope="col" className="border-b border-[var(--cui-chart-axis,rgba(20,19,17,0.25))] py-1 text-right">
              Value{unit ? ` (${unit})` : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {(snapshot?.rows ?? []).map((r) => (
            <tr key={r.id} data-table-row={r.id}>
              <th scope="row" className="py-0.5 text-left font-normal">
                {r.label}
              </th>
              <td className="py-0.5 text-right font-mono tabular-nums">{r.value === null ? "Not available" : fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
ContinuityChart.displayName = "ContinuityChart";
