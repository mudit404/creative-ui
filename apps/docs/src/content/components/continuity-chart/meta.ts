import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const continuityChartMeta: ComponentMeta = {
  slug: "continuity-chart",
  name: "ContinuityChart",
  title: "Continuity Chart",
  tagline: "Bars that become dots and rows that change rank, without anyone losing their identity.",
  description:
    "A horizontal bar chart keyed by entity id. Switching Bars/Dots shrinks each bar to a dot at the same data coordinate; switching snapshots moves rows to their new rank while labels, colours and the table update immediately to the authoritative values. Bars grow from zero, negatives extend left, null is “Not available”, mismatched units produce a diagnostic and a table instead of a misleading animation. A Transitioning label covers the 500 ms morph so intermediate geometry is never mistaken for data.",
  category: "media",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["chart", "bar", "dots", "ranking", "object constancy", "snapshot", "morph", "data", "svg"],
  registryName: "continuity-chart",
  importPath: "@/components/ui/continuity-chart",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "chart-layout"] },
  props: [
    { name: "snapshots", type: "Snapshot[]", default: "—", description: "Required. { id, label, unit, rows: { id, label, value: number | null, color? }[] }. Units must match across snapshots." },
    { name: "snapshotId / defaultSnapshotId / onSnapshotChange", type: "string / (id) => void", default: "first", description: "Dataset selection by id, never by index." },
    { name: "mode / defaultMode / onModeChange", type: '"bars" | "dots"', default: '"bars"', description: "Representation only; the metric and scale are unchanged." },
    { name: "domain", type: "[number, number]", default: "shared, zero-inclusive", description: "Explicit value domain; out-of-domain values are clipped with a ⚠ marker." },
    { name: "sort", type: '"input" | "ascending" | "descending"', default: "by variant", description: "ranking sorts descending; ties break by id." },
    { name: "formatValue", type: "(value, unit) => string", default: "value + unit", description: "Formatting for labels, tooltips and the table." },
    { name: "summary", type: "string", default: "—", description: "Required meaningful description shown above the chart and linked with aria-describedby." },
    { name: "defaultShowTable", type: "boolean", default: "false", description: "Start with the data table visible." },
    { name: "variant", type: '"ranking" | "comparison" | "explanation"', default: '"ranking"', description: "Default sort policy." },
    { name: "motion / durationScale", type: '"auto" | "reduced" | "off" / number', default: '"auto" / 1', description: "360 ms bars↔dots, 500 ms row travel under full motion; reduced and off update instantly." },
  ],
  cssVars: [
    { name: "--cui-chart-mark", description: "Fallback mark colour (rows without a colour use a palette)", default: "palette" },
    { name: "--cui-chart-text", description: "Text", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-chart-axis", description: "Axis baseline, control frames and table rule (decorative lines)", default: "light-dark(rgba(20,19,17,0.25), rgba(236,235,230,0.25))" },
    { name: "--cui-chart-boundary", description: "Zero line and the Snapshot select outline (essential boundaries)", default: "light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45))" },
    { name: "--cui-chart-label", description: "Tick labels, unit and Not-available text", default: "light-dark(rgba(20,19,17,0.65), rgba(236,235,230,0.65))" },
    { name: "--cui-chart-selected", description: "Selected control fill and focus ring", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-chart-bg", description: "Text on the selected control", default: "light-dark(#faf9f6, #1f1f1c)" },
    { name: "--cui-chart-grid", description: "Grid lines", default: "light-dark(rgba(20,19,17,0.08), rgba(236,235,230,0.08))" },
    { name: "--cui-chart-error", description: "Diagnostics and overflow markers", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    {
      id: "ranking",
      title: "Three snapshots of twelve categories",
      description: "Switch snapshots: rows travel to their new rank, keep their colour, and new or removed categories fade in or out. Switch to dots: endpoints stay put.",
      code: `<ContinuityChart snapshots={[q1, q2, q3]} summary="Share of respondents choosing each option, by quarter" />`,
    },
    {
      id: "negative",
      title: "Negative, null and tied values",
      description: "Negatives extend left of the zero line, null rows say Not available, and ties keep a stable id order.",
      code: `<ContinuityChart variant="comparison" snapshots={[deltas]} summary="Change in score versus last quarter" />`,
    },
    {
      id: "units",
      title: "Mismatched units",
      description: "The second snapshot is in points, not percent: no chart, a diagnostic, and the table.",
      code: `<ContinuityChart snapshots={[percent, points]} summary="…" />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (ready | morphing | table-only) and \`data-mode\`. Above the chart: the summary, a Bars/Dots segmented control, a Snapshot select, a table toggle and a status. The chart is an SVG of keyed marks beside a keyed list of label/value rows (persistent text), with a value axis; the table is always in the DOM.

- **Layout** is pure (\`layoutRows\`): a zero-inclusive domain shared across snapshots, \`x0\` at zero, \`x1\` at the value (C57-T02, C57-T03).
- **Identity**: marks and rows are keyed by entity id; colours are assigned per id across all snapshots, so a category never borrows another's mark (C57-T01, C57-T05).
- **Morph**: under full motion Motion springs animate rect x/width and row y; the status shows "Transitioning…" for ~500 ms and tooltips/table keep the committed values (C57-T07). Rapid snapshot changes retarget from current geometry; the last selection wins (C57-T06).
- **Validation**: mixed units, duplicate ids or non-finite values put the chart in table-only mode with a note (C57-T04, C57-T10).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The table has column headers and row headers and is the non-animated, always-truthful view; it can be shown at any time.
- Each row label is a button named "<label>: <value>" with a title tooltip; selection dims other marks and never changes data.
- Colour is never the only identity cue: labels stay beside every mark.
- Snapshot changes are announced once through a status; frames are not.
- Reduced motion updates positions immediately with every control intact (C57-T08).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Twelve to fifty rows render as a few hundred SVG nodes; springs run only during the ~500 ms morph. A ResizeObserver tracks width. No Canvas.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Horizontal bars only; scatter, treemap and radial morphs are deferred.
- Label column width is fixed (140 px); very long labels truncate with a full title on hover.
- No pagination; beyond ~50 rows, page on the host side.`,
    },
  ],
  sourceFiles: ["components/ui/continuity-chart.tsx", "lib/chart-layout.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: Mike Bostock's Object Constancy essay (principle only; no code). Data-honesty and identity contracts from Collection 02 brief #57. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const continuityChartPlayground: PlaygroundDef = {
  initial: { defaultMode: "bars", sort: "descending", durationScale: 1, defaultShowTable: false },
  defaults: { defaultMode: "bars", sort: "descending", durationScale: 1, defaultShowTable: false, motion: "auto" },
  controls: [
    { type: "select", prop: "defaultMode", label: "Representation", group: "Marks", options: [{ label: "Bars", value: "bars" }, { label: "Dots", value: "dots" }] },
    { type: "select", prop: "sort", label: "Sort", group: "Order", options: [{ label: "Descending", value: "descending" }, { label: "Ascending", value: "ascending" }, { label: "Input order", value: "input" }] },
    { type: "range", prop: "durationScale", label: "Duration scale", group: "Motion", min: 0.25, max: 3, step: 0.25 },
    { type: "boolean", prop: "defaultShowTable", label: "Show table", group: "Table" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Dots, input order", values: { defaultMode: "dots", sort: "input" } },
    { name: "Slow morph", values: { durationScale: 3 } },
  ],
};
