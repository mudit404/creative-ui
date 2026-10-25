import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const compareWorkbenchMeta: ComponentMeta = {
  slug: "compare-workbench",
  name: "CompareWorkbench",
  title: "Compare Workbench",
  tagline: "Pick two to four, compare them in a table that knows what it doesn't know.",
  description:
    "Cards with a labelled Compare checkbox feed a persistent tray; Compare reveals an in-flow comparison table built from a declared attribute schema. Values carry units and availability, so 500 g is not equal to 500 oz, false is not missing, and \"differences only\" hides only rows proven equal. The image flight into the tray is decoration; selection is a proposal the parent may refuse. Narrow screens compare any pair of the selection through two selectors.",
  category: "layout",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["compare", "comparison", "table", "products", "plans", "pricing", "tray", "commerce", "specs"],
  registryName: "compare-workbench",
  importPath: "@/components/ui/compare-workbench",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "compare-schema"] },
  props: [
    { name: "items", type: "CompareItem[]", default: "—", description: "Required. { id, name, image?, description?, attributes: Record<key, value | { value, unit?, availability? }> }." },
    { name: "attributes", type: "AttributeDefinition[]", default: "—", description: "Required. { key, label, group?, unit?, kind?, format?, equals?, tolerance? } in display order. Rows come from this schema only." },
    { name: "selectedIds / defaultSelectedIds", type: "string[]", default: "[]", description: "Controlled or initial selection. Sanitised: unique, ordered, existing ids only." },
    { name: "onSelectedIdsChange", type: "(ids, reason) => void", default: "—", description: "Proposal with reason select | deselect | remove | clear | unavailable. A controlled parent may keep the old ids." },
    { name: "maxSelected / minSelected", type: "number", default: "4 / 2", description: "At the limit a further selection shows a message and calls onLimitReached; nothing is substituted." },
    { name: "differencesOnly / defaultDifferencesOnly", type: "boolean", default: "false", description: "Hide rows whose cells are all known, same-unit and equal. Unknown and incomparable rows stay." },
    { name: "open / defaultOpen / onOpenChange", type: "boolean / callback", default: "false", description: "In-flow comparison visibility. Compare opens it and moves focus to the heading." },
    { name: "renderCard / renderAction", type: "(item, selected) => node / (item) => node", default: "—", description: "Card body and per-column action slot. The Compare checkbox and remove buttons are always rendered." },
    { name: "onLimitReached", type: "(attemptedId) => void", default: "—", description: "Called when a selection is refused for the limit." },
    { name: "variant", type: '"products" | "plans" | "technical"', default: '"products"', description: "products shows images; plans is text-led; technical is dense." },
    { name: "label", type: "string", default: '"Compare"', description: "Accessible name of the workbench group." },
    { name: "narrowBreakpoint", type: "number", default: "640", description: "Root width below which the table compares a pair with selectors." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Image flight and tray layout animation under full motion only." },
    { name: "ref", type: "CompareWorkbenchHandle", default: "—", description: "{ root, focusComparison() }." },
  ],
  cssVars: [
    { name: "--cui-compare-text", description: "Text colour (ink)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-compare-tray", description: "Ink: selected card border, Compare button fill, checkbox accent, focus rings", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-compare-tray-text", description: "Compare button text (on ink)", default: "light-dark(#faf9f6, #141311)" },
    { name: "--cui-compare-tray-bg", description: "Tray background", default: "light-dark(rgba(20,19,17,0.06), rgba(236,235,230,0.06))" },
    { name: "--cui-compare-difference", description: "Row highlight for differing rows (acid wash; the row also says \"differs\")", default: "light-dark(rgba(200,245,90,0.25), rgba(200,245,90,0.18))" },
    { name: "--cui-compare-gridline", description: "Table, row, card and Close-button borders (decorative; one value)", default: "light-dark(rgba(20,19,17,0.15), rgba(236,235,230,0.15))" },
    { name: "--cui-compare-control-border", description: "Pair-selector outline on narrow widths (boundary, 3.4:1 / 3.8:1)", default: "light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45))" },
    { name: "--cui-compare-label-width", description: "Sticky attribute column width", default: "180px" },
    { name: "--cui-compare-surface", description: "Sticky cell and chip background (paper)", default: "light-dark(#faf9f6, #1f1f1c)" },
    { name: "--cui-compare-error", description: "Limit message colour", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    {
      id: "products",
      title: "Four products, mixed units",
      description: "Select two or more and press Compare. Weight is 500 g on two cameras and 500 oz on another: numerically equal, not comparable. Try \"Differences only\".",
      code: `<CompareWorkbench items={cameras} attributes={cameraAttributes} defaultSelectedIds={["c1", "c2"]} renderAction={(item) => <button>Buy</button>} />`,
    },
    {
      id: "limit",
      title: "Selection limit",
      description: "maxSelected is 3 here. Selecting a fourth shows a message and keeps the selection intact.",
      code: `<CompareWorkbench items={cameras} attributes={cameraAttributes} maxSelected={3} defaultSelectedIds={["c1", "c2", "c3"]} onLimitReached={(id) => console.log("refused", id)} />`,
    },
    {
      id: "plans",
      title: "Plans without imagery",
      description: "Boolean availability: No, — (not provided) and n/a (not applicable) stay distinct.",
      code: `<CompareWorkbench variant="plans" items={plans} attributes={planAttributes} defaultSelectedIds={["free", "pro", "team"]} defaultOpen />`,
    },
    {
      id: "refresh",
      title: "Data refresh removes an item",
      description: "Press the button to drop Gamma from the host data. The selection sheds it, the live region says so, and no empty column remains.",
      code: `const [items, setItems] = useState(cameras);
<button onClick={() => setItems(items.filter((i) => i.id !== "c3"))}>Remove Gamma</button>
<CompareWorkbench items={items} attributes={cameraAttributes} defaultSelectedIds={["c1", "c3", "c4"]} defaultOpen />`,
    },
    {
      id: "controlled",
      title: "Controlled selection",
      description: "The parent refuses Beta. Its checkbox never sticks.",
      code: `const [ids, setIds] = useState<string[]>([]);
<CompareWorkbench items={cameras} attributes={cameraAttributes} selectedIds={ids} onSelectedIdsChange={(next) => setIds(next.filter((id) => id !== "c2"))} />`,
    },
    {
      id: "narrow",
      title: "Narrow: pair selection",
      description: "In a 360 px container the table compares two at a time; the selectors reach every pair.",
      code: `<div style={{ width: 360 }}>
  <CompareWorkbench items={cameras} attributes={cameraAttributes} defaultSelectedIds={["c1", "c2", "c3", "c4"]} defaultOpen />
</div>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state="selecting|ready|comparing"\`. Inside: a card list (each card with a labelled Compare checkbox), a tray (\`role="group"\` "Selected for comparison") with removable chips, the Compare button and a polite status region, and, when open, a \`section\` whose heading receives focus, a Differences-only toggle, pair selectors on narrow widths and the table.

- **Selection**: checking proposes \`[...selected, id]\` with reason \`select\`; at the limit the proposal is refused locally with a message (\`onLimitReached\`). Chips and column buttons propose \`remove\`.
- **Rows**: \`buildRows\` walks the attribute schema, normalises each cell (\`value\`, \`unit\`, \`availability\`) and classifies the row \`equal\`, \`different\` or \`incomparable\`. Any unknown/not-applicable cell or mixed units makes a row incomparable; \`tolerance\` and \`equals\` are per attribute.
- **Differences only**: hides \`equal\` rows and says how many it hid.
- **Refresh**: ids missing from \`items\` are dropped from the rendered selection, announced, and reported to a controlled parent with reason \`unavailable\`.
- **Below the minimum**: the comparison stays open with guidance instead of a one-column table; the remaining selection is kept.
- **Colour**: every \`--cui-*\` default is a \`light-dark()\` pair that follows \`color-scheme\` (Chrome 123+, Safari 17.5+, Firefox 120+; older browsers get the light values).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Cards: native checkbox labelled "Compare" inside each card; the checkbox state mirrors the tray (C49-T01).
- Table: \`caption\`, \`th scope="col"\` per item, \`th scope="row"\` per attribute, \`th scope="rowgroup"\` for group rows (C49-T08). The scroll container is a focusable labelled region.
- Missing data: "—" with \`aria-label="Not provided"\`, "n/a" with "Not applicable"; differing rows carry a textual "differs" indicator as well as a background.
- Focus moves to the comparison heading only after the explicit Compare action; removing items never steals focus.
- Narrow widths expose "First/Second item to compare" selects covering every pair (C49-T07).
- Reduced motion drops the image flight and tray layout animation; nothing else changes (C49-T10).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Rows are memoised on items, schema and selection; 4 × 40 attributes renders in well under a frame. The image clone is a single fixed-position \`img\` animated for 320 ms and removed on completion. A ResizeObserver on the root drives narrow mode. Images use \`loading="lazy"\` and failures never block selection or the table (C49-T09).`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- In-flow only; a dialog mode needs its own focus and scroll contract (deferred by the brief).
- No sorting, search, currency conversion or recommendation logic; those are host features.
- Column widths are equal; very long values wrap rather than resize.`,
    },
  ],
  sourceFiles: ["components/ui/compare-workbench.tsx", "lib/compare-schema.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: Codrops Product Comparison Layout and Effect (2015, public demo; tray-and-table concept observed, no code or imagery reused; demo items are neutral generated data). Schema, missing-data and selection contracts come from Collection 02 brief #49. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const compareWorkbenchPlayground: PlaygroundDef = {
  initial: { variant: "products", maxSelected: 4, minSelected: 2, defaultDifferencesOnly: false, defaultOpen: false, narrowBreakpoint: 360 },
  defaults: { variant: "products", maxSelected: 4, minSelected: 2, defaultDifferencesOnly: false, defaultOpen: false, narrowBreakpoint: 640, motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Data", options: [{ label: "Products", value: "products" }, { label: "Plans", value: "plans" }, { label: "Technical", value: "technical" }] },
    { type: "range", prop: "maxSelected", label: "Max selected", group: "Policy", min: 2, max: 6, step: 1 },
    { type: "range", prop: "minSelected", label: "Min selected", group: "Policy", min: 1, max: 4, step: 1 },
    { type: "boolean", prop: "defaultDifferencesOnly", label: "Differences only", group: "Table" },
    { type: "boolean", prop: "defaultOpen", label: "Open initially", group: "Table" },
    { type: "range", prop: "narrowBreakpoint", label: "Narrow below", group: "Layout", min: 320, max: 1200, step: 20, unit: "px" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Plans", values: { variant: "plans", defaultOpen: true } },
    { name: "Technical, differences", values: { variant: "technical", defaultOpen: true, defaultDifferencesOnly: true } },
    { name: "Force narrow", values: { narrowBreakpoint: 1200, defaultOpen: true } },
    { name: "Component default (640)", values: { narrowBreakpoint: 640 } },
  ],
};
