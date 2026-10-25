import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const splitFlapBoardMeta: ComponentMeta = {
  slug: "split-flap-board",
  name: "SplitFlapBoard",
  title: "Split Flap Board",
  tagline: "Mechanical flap cells for status values that change, with one truthful string underneath.",
  description:
    "A departures-board treatment for short strings and numbers. The accessible content is always the current value in a single selectable span; the flaps are aria-hidden decoration. Only cells that changed flip, staggered left to right within a settle budget, and a value that changes mid-flip is re-routed toward the newest text without finishing the stale one. Scripts the character set cannot show (or any grapheme outside it) fall back to whole-content swaps. Reduced motion and paused boards update instantly; off-screen tabs stop the mechanism and catch up on return.",
  category: "text",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["split-flap", "departures", "board", "status", "counter", "odometer", "ticker", "flip"],
  registryName: "split-flap-board",
  importPath: "@/components/ui/split-flap-board",
  dependencies: { npm: ["clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "flap-cells"] },
  props: [
    { name: "value", type: "string | number", default: "—", description: "Required. The truthful current value; the accessible text always equals it." },
    { name: "variant", type: '"characters" | "whole" | "numeric"', default: '"characters"', description: "Per-cell flips, whole-content swaps (shaped scripts), or right-aligned numeric formatting." },
    { name: "characterSet", type: "readonly string[]", default: "A–Z 0–9 punctuation", description: "Glyphs the cells can show; anything else forces whole-content mode." },
    { name: "cells", type: "number", default: "value length", description: "Fixed cell count; numeric right-aligns, text left-aligns with trailing blanks." },
    { name: "flipDuration / stagger / maxSettle", type: "ms", default: "200 / 20 / 600", description: "Per-cell flip time, inter-cell delay and the budget the stagger is compressed to fit." },
    { name: "animateOnMount", type: "boolean", default: "false", description: "Flip from blanks on first paint instead of rendering the value at rest." },
    { name: "paused", type: "boolean", default: "false", description: "Pauses decoration only; the accessible value still updates." },
    { name: "overflow", type: '"wrap" | "scroll" | "ellipsis"', default: '"wrap"', description: "Long values wrap, scroll horizontally or clip with an ellipsis (the full string stays accessible)." },
    { name: "announce", type: '"off" | "polite"', default: '"off"', description: "Polite status announcements of the final value; off keeps the board silent." },
    { name: "placeholder", type: "string", default: '"—"', description: "Shown for NaN / unformattable numeric input." },
    { name: "onSettled", type: "(value) => void", default: "—", description: "Decorative completion of the newest value; never a data event." },
    { name: "label", type: "string", default: '"Status board"', description: "Accessible name of the value." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Reduced or off swaps instantly without flaps." },
    { name: "ref", type: "SplitFlapBoardHandle", default: "—", description: "{ root, text }." },
  ],
  cssVars: [
    { name: "--cui-flap-face", description: "Flap face background", default: "light-dark(#faf9f6, #2a2a27)" },
    { name: "--cui-flap-glyph", description: "Glyph colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-flap-hinge", description: "Horizontal hinge line across each cell", default: "light-dark(rgba(20,19,17,0.35), rgba(236,235,230,0.35))" },
    { name: "--cui-flap-width", description: "Cell width (characters and numeric variants)", default: "36px" },
    { name: "--cui-flap-height", description: "Cell height; the glyph size is 60% of it", default: "52px" },
  ],
  examples: [
    { id: "counter", title: "Numeric counter", description: "Only changed digits flip; a second update mid-flip re-routes to the newest number. onSettled is logged separately from the value.", code: `<SplitFlapBoard variant="numeric" value={count} cells={6} onSettled={log} />` },
    { id: "departures", title: "Departures rows", description: "Fixed-width text cells; a status rotates every 3 s. Pause stops the flaps but not the text.", code: `<SplitFlapBoard value="ON TIME" cells={8} paused={paused} />` },
    { id: "scripts", title: "Shaped scripts and unknown glyphs", description: "Arabic and Devanagari values switch to whole-content mode automatically; the Latin set keeps per-cell flips.", code: `<SplitFlapBoard value="مرحبا" />` },
    { id: "reduced", title: "Reduced motion and announcements", description: "motion=\"reduced\" swaps instantly; announce=\"polite\" reads the settled value once.", code: `<SplitFlapBoard value={v} motion="reduced" announce="polite" />` },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (settled | flipping), \`data-variant\` and \`data-motion\`. Inside: one \`sr-only\` span holding the full current value (the only text in the accessibility tree; \`role="status"\` when announcing) and an aria-hidden row of cells carrying \`data-cell\` / \`data-phase\` (0 settled, 1 front half, 2 landing).

- **Scheduling**: \`changedCells\` picks only the cells that differ; \`staggerSchedule\` spaces their starts and compresses the stagger so the last cell lands within \`maxSettle\` (C47-T01, C47-T04).
- **Interruption**: a new value replaces the pending target; already-flipping cells finish their half-turn to the newest glyph, never to a stale one (C47-T03).
- **Numbers**: \`formatNumeric\` right-aligns and pads; NaN renders the placeholder and never animates (C47-T05).
- **Visibility**: \`visibilitychange\` pauses timers and shows the latest value on return (C47-T06).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The value is one selectable, copyable string; thousands of flap faces never reach assistive tech (C47-T02).
- \`announce="polite"\` announces the settled value once per change; the default is silent for boards that update often.
- Reduced motion (preference or prop) removes all flipping; colour contrast is set by the face and glyph tokens, whose defaults follow \`color-scheme\` via \`light-dark()\` (Chrome 123+, Safari 17.5+, Firefox 120+; older browsers get the light values).`,
    },
    { id: "performance", title: "Performance", body: `No timers while settled. Each flip is two timers per changed cell; CSS keyframes do the rotation. A 40-cell row updating every second schedules at most 80 short timers and no layout work beyond the cell swaps.` },
    { id: "limitations", title: "Known limitations", body: `- No mechanical audio (deferred; would need explicit consent).\n- Locale digit grouping and odometer separators are not formatted; pass a formatted string.\n- Whole-content mode swaps the entire value at once by design.` },
  ],
  sourceFiles: ["components/ui/split-flap-board.tsx", "lib/flap-cells.ts", "hooks/use-reduced-motion.ts"],
  provenance: "Original implementation. References studied: the react-split-flap-effect demo and classic Solari boards (behaviour only; no code). Contracts from Collection 02 brief #47. Runtime dependencies: clsx (MIT), tailwind-merge (MIT).",
};

export const splitFlapBoardPlayground: PlaygroundDef = {
  initial: { value: "BOARDING", variant: "characters", flipDuration: 200, stagger: 20, animateOnMount: true },
  defaults: { variant: "characters", flipDuration: 200, stagger: 20, maxSettle: 600, animateOnMount: false, announce: "off", motion: "auto", overflow: "wrap" },
  controls: [
    { type: "text", prop: "value", label: "Value", group: "Content" },
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Characters", value: "characters" }, { label: "Whole", value: "whole" }, { label: "Numeric", value: "numeric" }] },
    { type: "range", prop: "flipDuration", label: "Flip duration", min: 80, max: 600, step: 20, unit: "ms", group: "Motion" },
    { type: "range", prop: "stagger", label: "Stagger", min: 0, max: 120, step: 5, unit: "ms", group: "Motion" },
    { type: "boolean", prop: "animateOnMount", label: "Animate on mount", group: "Motion" },
    { type: "select", prop: "announce", label: "Announce", group: "Accessibility", options: [{ label: "Off", value: "off" }, { label: "Polite", value: "polite" }] },
  ],
  presets: [
    { name: "Departures", values: { value: "ON TIME", variant: "characters" } },
    { name: "Counter", values: { value: "001234", variant: "numeric" } },
  ],
};
