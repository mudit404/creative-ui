"use client";

import * as React from "react";
import { AnimatePresence, motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { buildRows, groupRows, sanitizeSelection, type AttributeDefinition, type CompareItem, type CompareRow } from "@/lib/compare-schema";

export type { AttributeDefinition, AttributeValue, CompareItem } from "@/lib/compare-schema";

export type CompareWorkbenchVariant = "products" | "plans" | "technical";
export type CompareWorkbenchMotion = "auto" | "reduced" | "off";
export type SelectionReason = "select" | "deselect" | "remove" | "clear" | "unavailable";

export interface CompareWorkbenchHandle {
  root: HTMLDivElement | null;
  focusComparison: () => void;
}

export interface CompareWorkbenchProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  items: readonly CompareItem[];
  attributes: readonly AttributeDefinition[];
  selectedIds?: readonly string[];
  defaultSelectedIds?: readonly string[];
  onSelectedIdsChange?: (ids: string[], reason: SelectionReason) => void;
  maxSelected?: number;
  minSelected?: number;
  differencesOnly?: boolean;
  defaultDifferencesOnly?: boolean;
  onDifferencesOnlyChange?: (next: boolean) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Custom card body. The Compare checkbox is always rendered by the workbench. */
  renderCard?: (item: CompareItem, selected: boolean) => React.ReactNode;
  /** Per-column action slot in the comparison table (e.g. a Buy button). */
  renderAction?: (item: CompareItem) => React.ReactNode;
  onLimitReached?: (attemptedId: string) => void;
  variant?: CompareWorkbenchVariant;
  /** Accessible name of the workbench. */
  label?: string;
  /** Width below which the table compares two items at a time. */
  narrowBreakpoint?: number;
  motion?: CompareWorkbenchMotion;
}

/**
 * CompareWorkbench — select two to four items into a tray and compare them in
 * a semantic table built from a declared attribute schema.
 *
 * Selection is a proposal (`onSelectedIdsChange`) that the parent may accept
 * or refuse. The flying image is decoration under full motion only. Unknown,
 * not-applicable, false and zero stay distinct; different units are
 * incomparable rather than equal; "differences only" hides only rows proven
 * equal. On narrow widths the table compares a pair chosen with selectors.
 */
export const CompareWorkbench = React.forwardRef<CompareWorkbenchHandle, CompareWorkbenchProps>(function CompareWorkbench(
  {
    items,
    attributes,
    selectedIds: selectedProp,
    defaultSelectedIds = [],
    onSelectedIdsChange,
    maxSelected = 4,
    minSelected = 2,
    differencesOnly: diffProp,
    defaultDifferencesOnly = false,
    onDifferencesOnlyChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    renderCard,
    renderAction,
    onLimitReached,
    variant = "products",
    label = "Compare",
    narrowBreakpoint = 640,
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const max = Math.max(1, maxSelected);
  const min = Math.min(Math.max(1, minSelected), max);

  /* selection */
  const [internalSel, setInternalSel] = React.useState<string[]>(() => sanitizeSelection(defaultSelectedIds, items));
  const rawSelected = selectedProp ?? internalSel;
  const selected = React.useMemo(() => sanitizeSelection(rawSelected, items), [rawSelected, items]);
  const propose = (ids: string[], reason: SelectionReason) => {
    if (selectedProp === undefined) setInternalSel(ids);
    onSelectedIdsChange?.(ids, reason);
  };

  /* announce items that vanished on a data refresh (C49-T06 / behaviour 7) */
  const [notice, setNotice] = React.useState("");
  const removed = React.useMemo(() => rawSelected.filter((id) => !items.some((i) => i.id === id)), [rawSelected, items]);
  const removedKey = removed.join(",");
  const [seenRemoved, setSeenRemoved] = React.useState("");
  if (removedKey !== seenRemoved) {
    setSeenRemoved(removedKey);
    if (removedKey) {
      setNotice(`${removed.length === 1 ? "An item is" : `${removed.length} items are`} no longer available and ${removed.length === 1 ? "was" : "were"} removed from the comparison.`);
      if (selectedProp === undefined) setInternalSel(sanitizeSelection(rawSelected, items));
    }
  }
  const notifyUnavailable = React.useRef(onSelectedIdsChange);
  React.useEffect(() => {
    notifyUnavailable.current = onSelectedIdsChange;
  });
  React.useEffect(() => {
    // tell a controlled parent that its selection now contains unavailable ids
    if (removedKey && selectedProp !== undefined) notifyUnavailable.current?.(selected, "unavailable");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removedKey]);

  /* limit message (C49-T02) */
  const [limitMsg, setLimitMsg] = React.useState("");
  const toggle = (id: string, next: boolean) => {
    if (next) {
      if (selected.includes(id)) return;
      if (selected.length >= max) {
        setLimitMsg(`You can compare up to ${max} items. Remove one from the tray to add ${items.find((i) => i.id === id)?.name ?? "another"}.`);
        onLimitReached?.(id);
        return;
      }
      setLimitMsg("");
      launchFlight(id);
      propose([...selected, id], "select");
    } else {
      setLimitMsg("");
      propose(selected.filter((x) => x !== id), "deselect");
    }
  };
  const remove = (id: string) => {
    setLimitMsg("");
    propose(selected.filter((x) => x !== id), "remove");
  };

  /* differences + open */
  const [internalDiff, setInternalDiff] = React.useState(defaultDifferencesOnly);
  const differencesOnly = diffProp ?? internalDiff;
  const setDiff = (v: boolean) => {
    if (diffProp === undefined) setInternalDiff(v);
    onDifferencesOnlyChange?.(v);
  };
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const focusPending = React.useRef(false);
  React.useEffect(() => {
    if (focusPending.current && open) {
      focusPending.current = false;
      headingRef.current?.focus();
    }
  }, [open]);
  const compare = () => {
    if (selected.length < min) return;
    focusPending.current = true; // focus moves only after this explicit action (behaviour 3)
    setOpen(true);
    if (open) headingRef.current?.focus();
  };
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusComparison: () => headingRef.current?.focus() }), []);

  /* motion */
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  /* decorative image flight (full motion only) */
  const trayRef = React.useRef<HTMLDivElement>(null);
  const cardImgRefs = React.useRef(new Map<string, HTMLElement>());
  const [flights, setFlights] = React.useState<{ key: number; src: string; from: DOMRect; to: DOMRect }[]>([]);
  const flightKey = React.useRef(0);
  const launchFlight = (id: string) => {
    if (mode !== "full") return;
    const item = items.find((i) => i.id === id);
    const img = cardImgRefs.current.get(id);
    const tray = trayRef.current;
    if (!item?.image || !img || !tray) return;
    const from = img.getBoundingClientRect();
    const trayBox = tray.getBoundingClientRect();
    if (!from.width || !trayBox.width) return;
    const slot = 8 + selected.length * 56;
    const to = new DOMRect(trayBox.left + slot, trayBox.top + 8, 48, 48);
    flightKey.current += 1;
    setFlights((f) => [...f, { key: flightKey.current, src: item.image!, from, to }]);
  };

  /* narrow pair mode (C49-T07) */
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < narrowBreakpoint));
    ro.observe(el);
    return () => ro.disconnect();
  }, [narrowBreakpoint]);
  const [pair, setPair] = React.useState<[string, string]>(["", ""]);
  const first = selected.includes(pair[0]) ? pair[0] : (selected[0] ?? "");
  const second = selected.includes(pair[1]) && pair[1] !== first ? pair[1] : (selected.find((id) => id !== first) ?? "");
  const pairIds: [string, string] = [first, second];
  const columnIds = React.useMemo(() => (narrow ? [first, second].filter(Boolean) : selected), [narrow, first, second, selected]);

  /* rows */
  const rows = React.useMemo(() => buildRows(items, attributes, columnIds), [items, attributes, columnIds]);
  const groups = React.useMemo(() => groupRows(rows, differencesOnly), [rows, differencesOnly]);
  const hiddenEqual = differencesOnly ? rows.filter((r) => r.equality === "equal").length : 0;
  const columns = columnIds.map((id) => items.find((i) => i.id === id)).filter((i): i is CompareItem => !!i);

  const uid = React.useId();
  const ready = selected.length >= min;
  const selectedItems = selected.map((id) => items.find((i) => i.id === id)).filter((i): i is CompareItem => !!i);

  return (
    <div
      ref={rootRef}
      data-slot="compare-workbench"
      data-variant={variant}
      data-motion={mode}
      data-state={open ? "comparing" : ready ? "ready" : "selecting"}
      data-narrow={narrow || undefined}
      role="group"
      aria-label={label}
      className={cn("relative flex w-full flex-col gap-5 text-[var(--cui-compare-text,#141311)]", className)}
      style={{ ["--cui-compare-label-width" as string]: "var(--cui-compare-label-width, 180px)" }}
      {...rest}
    >
      {/* cards */}
      <ul className={cn("grid gap-3", variant === "plans" ? "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(160px,1fr))]")}>
        {items.map((item) => {
          const isSel = selected.includes(item.id);
          const cbId = `${uid}-cb-${item.id}`;
          return (
            <li key={item.id} data-item={item.id} data-selected={isSel || undefined} className={cn("flex flex-col gap-2 rounded-2xl border p-3", isSel ? "border-[var(--cui-compare-tray,#141311)]" : "border-[var(--cui-compare-gridline,rgba(20,19,17,0.15))]")}>
              {renderCard ? (
                renderCard(item, isSel)
              ) : (
                <>
                  {item.image && variant !== "plans" && (
                    <div className="aspect-square overflow-hidden rounded-xl bg-[rgba(20,19,17,0.05)]">
                      <img
                        ref={(el) => {
                          if (el) cardImgRefs.current.set(item.id, el);
                          else cardImgRefs.current.delete(item.id);
                        }}
                        src={item.image}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </div>
                  )}
                  <div className="text-[14px] font-semibold leading-tight">{item.name}</div>
                  {item.description && <div className="text-[12px] opacity-70">{item.description}</div>}
                </>
              )}
              <label htmlFor={cbId} className="mt-auto flex items-center gap-2 text-[13px]">
                <input id={cbId} type="checkbox" checked={isSel} onChange={(e) => toggle(item.id, e.target.checked)} className="size-4 accent-[var(--cui-compare-tray,#141311)]" />
                Compare
              </label>
            </li>
          );
        })}
      </ul>

      {/* tray */}
      <div ref={trayRef} data-tray className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--cui-compare-tray-bg,rgba(20,19,17,0.06))] p-2 pl-3" role="group" aria-label="Selected for comparison">
        <span className="mr-1 text-[13px] font-medium">
          {selected.length}/{max} selected
        </span>
        <ul className="flex flex-wrap items-center gap-2">
          <AnimatePresence initial={false}>
            {selectedItems.map((item) => (
              <m.li
                key={item.id}
                layout={mode === "full"}
                initial={mode === "full" ? { opacity: 0, scale: 0.8 } : false}
                animate={{ opacity: 1, scale: 1 }}
                exit={mode === "full" ? { opacity: 0, scale: 0.8 } : undefined}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5 rounded-full bg-[var(--cui-compare-surface,#faf9f6)] py-1 pl-1 pr-1.5 text-[12px] shadow-sm"
              >
                {item.image ? <img src={item.image} alt="" className="size-6 rounded-full object-cover" /> : <span className="grid size-6 place-items-center rounded-full bg-[rgba(20,19,17,0.1)] text-[10px] font-bold">{item.name[0]}</span>}
                <span className="max-w-[9rem] truncate">{item.name}</span>
                <button type="button" aria-label={`Remove ${item.name} from comparison`} onClick={() => remove(item.id)} className="grid size-5 place-items-center rounded-full outline-none hover:bg-[rgba(20,19,17,0.1)] focus-visible:ring-2 focus-visible:ring-[var(--cui-compare-tray,#141311)]">
                  ✕
                </button>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
        <button
          type="button"
          onClick={compare}
          disabled={!ready}
          aria-describedby={`${uid}-hint`}
          className="ml-auto rounded-full bg-[var(--cui-compare-tray,#141311)] px-4 py-1.5 text-[13px] font-medium text-[var(--cui-compare-surface,#faf9f6)] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--cui-compare-tray,#141311)] disabled:opacity-40"
        >
          Compare{selected.length ? ` (${selected.length})` : ""}
        </button>
        <p id={`${uid}-hint`} className="w-full text-[12px] opacity-70">
          {ready ? "" : `Select at least ${min} items to compare.`}
        </p>
        <div role="status" aria-live="polite" className={cn("w-full text-[12px]", limitMsg ? "text-[var(--cui-compare-error,#c8360d)]" : "sr-only")}>
          {limitMsg || notice}
        </div>
      </div>

      {/* decorative flights */}
      <AnimatePresence>
        {flights.map((f) => (
          <m.img
            key={f.key}
            src={f.src}
            alt=""
            aria-hidden
            className="pointer-events-none fixed z-50 rounded-xl object-cover"
            initial={{ left: f.from.left, top: f.from.top, width: f.from.width, height: f.from.height, opacity: 1 }}
            animate={{ left: f.to.left, top: f.to.top, width: f.to.width, height: f.to.height, opacity: 0.9, borderRadius: 24 }}
            transition={{ duration: 0.32, ease: [0.3, 0.9, 0.3, 1] }}
            onAnimationComplete={() => setFlights((all) => all.filter((x) => x.key !== f.key))}
          />
        ))}
      </AnimatePresence>

      {/* comparison region */}
      {open && (
        <section aria-labelledby={`${uid}-heading`} data-comparison className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id={`${uid}-heading`} ref={headingRef} tabIndex={-1} className="text-[18px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-compare-tray,#141311)]">
              Comparing {selected.length} {selected.length === 1 ? "item" : "items"}
            </h2>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={differencesOnly} onChange={(e) => setDiff(e.target.checked)} className="size-4 accent-[var(--cui-compare-tray,#141311)]" />
              Differences only
              {differencesOnly && hiddenEqual > 0 && <span className="opacity-70">({hiddenEqual} equal hidden)</span>}
            </label>
            <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-full border border-[var(--cui-compare-gridline,rgba(20,19,17,0.2))] px-3 py-1 text-[13px] outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-compare-tray,#141311)]">
              Close comparison
            </button>
          </div>

          {selected.length < min ? (
            <p className="rounded-2xl border border-dashed border-[var(--cui-compare-gridline,rgba(20,19,17,0.2))] p-4 text-[13px]" data-guidance>
              {selected.length === 0 ? "Nothing selected. " : `${selected.length} item selected. `}
              Select at least {min} items to compare them side by side.
            </p>
          ) : (
            <>
              {narrow && (
                <div className="flex items-center gap-2 text-[13px]" data-pair-selectors>
                  {([0, 1] as const).map((slot) => (
                    <label key={slot} className="flex flex-1 flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-wide opacity-70">{slot === 0 ? "First" : "Second"}</span>
                      <select
                        aria-label={slot === 0 ? "First item to compare" : "Second item to compare"}
                        value={pairIds[slot]}
                        onChange={(e) => setPair(slot === 0 ? [e.target.value, pairIds[1] === e.target.value ? (selected.find((x) => x !== e.target.value) ?? "") : pairIds[1]] : [pairIds[0] === e.target.value ? (selected.find((x) => x !== e.target.value) ?? "") : pairIds[0], e.target.value])}
                        className="rounded-lg border border-[var(--cui-compare-gridline,rgba(20,19,17,0.2))] bg-transparent px-2 py-1.5"
                      >
                        {selectedItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              <div role="region" aria-label="Comparison table" tabIndex={0} className="overflow-x-auto rounded-2xl border border-[var(--cui-compare-gridline,rgba(20,19,17,0.15))] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-compare-tray,#141311)]">
                <table className="w-full border-collapse text-[13px]" style={{ minWidth: 180 + columns.length * 160 }}>
                  <caption className="sr-only">Comparison of {columns.map((c) => c.name).join(", ")}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="sticky left-0 z-10 w-[var(--cui-compare-label-width,180px)] min-w-[var(--cui-compare-label-width,180px)] bg-[var(--cui-compare-surface,#faf9f6)] p-3 text-left font-medium opacity-70">
                        Attribute
                      </th>
                      {columns.map((c) => (
                        <th key={c.id} scope="col" className="p-3 text-left align-top" style={{ width: `${100 / columns.length}%` }}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {c.image && variant === "products" && <img src={c.image} alt="" className="mb-2 size-14 rounded-xl object-cover" />}
                              <div className="font-semibold">{c.name}</div>
                            </div>
                            <button type="button" aria-label={`Remove ${c.name} from comparison`} onClick={() => remove(c.id)} className="grid size-6 shrink-0 place-items-center rounded-full outline-none hover:bg-[rgba(20,19,17,0.1)] focus-visible:ring-2 focus-visible:ring-[var(--cui-compare-tray,#141311)]">
                              ✕
                            </button>
                          </div>
                          {renderAction && <div className="mt-2">{renderAction(c)}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <React.Fragment key={g.group || "_"}>
                        {g.group && (
                          <tr data-group={g.group}>
                            <th scope="rowgroup" colSpan={columns.length + 1} className="sticky left-0 bg-[rgba(20,19,17,0.06)] px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                              {g.group}
                            </th>
                          </tr>
                        )}
                        {g.rows.map((r) => (
                          <Row key={r.key} row={r} />
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
});
CompareWorkbench.displayName = "CompareWorkbench";

function Row({ row }: { row: CompareRow }) {
  const diff = row.equality === "different";
  return (
    <tr data-row={row.key} data-equality={row.equality} className={cn("border-t border-[var(--cui-compare-gridline,rgba(20,19,17,0.12))]", diff && "bg-[var(--cui-compare-difference,rgba(200,245,90,0.25))]")}>
      <th scope="row" className="sticky left-0 z-10 bg-[var(--cui-compare-surface,#faf9f6)] p-3 text-left font-medium">
        {row.label}
        {diff && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">differs</span>}
        {row.equality === "incomparable" && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">not comparable</span>}
      </th>
      {row.cells.map((c) => (
        <td key={c.itemId} className="p-3 align-top" data-status={c.status}>
          {c.status === "unknown" ? (
            <span aria-label="Not provided" title="Not provided">
              —
            </span>
          ) : c.status === "not-applicable" ? (
            <span aria-label="Not applicable" title="Not applicable">
              n/a
            </span>
          ) : (
            c.display
          )}
        </td>
      ))}
    </tr>
  );
}
