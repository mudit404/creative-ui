import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const elasticGridMeta: ComponentMeta = {
  slug: "elastic-grid",
  name: "ElasticGrid",
  title: "ElasticCatalog",
  tagline: "A catalog grid whose cells stretch and settle as you browse.",
  description:
    "A responsive catalog grid with elastic columns. The column under the pointer (or holding keyboard focus) stretches wider while its neighbours yield, on springs, and everything settles back when you leave. Filtering, sorting or reordering the children animates cells to their new places. It is a plain list for assistive tech; put links, buttons or cards inside the cells.",
  category: "layout",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["grid", "catalog", "gallery", "elastic", "stretch", "layout", "filter", "sort", "masonry", "cards"],
  registryName: "elastic-grid",
  importPath: "@/components/ui/elastic-grid",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "pointer-field"] },
  props: [
    { name: "columns", type: "number", default: "—", description: "Fixed column count. When omitted, columns are derived from minCellWidth and the container width (ResizeObserver)." },
    { name: "minCellWidth", type: "number", default: "180", description: "Minimum cell width in px used to derive the column count." },
    { name: "maxColumns", type: "number", default: "6", description: "Cap for the derived column count (hard limit 12)." },
    { name: "gap", type: "number", default: "12", description: "Gap between cells in px." },
    { name: "stretch", type: "number (0–1)", default: "0.4", description: "How much the column under the pointer grows: 0.4 is 40% wider than a resting column." },
    { name: "reach", type: "number", default: "1.5", description: "Reach in columns: neighbours within this distance yield proportionally (quadratic falloff)." },
    { name: "spring", type: '"soft" | "snappy" | "stiff"', default: '"snappy"', description: "Spring feel of the track weights." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced disables stretch and shortens reflows; off is instant with fixed tracks." },
    { name: "Item.aspect", type: "string", default: "—", description: "CSS aspect-ratio for the cell (e.g. \"4 / 3\"). Omit for content-sized cells." },
    { name: "Item (…rest)", type: "LiHTMLAttributes", default: "—", description: "Native li attributes; className composes with the cell styles." },
    { name: "className / …rest", type: "HTMLAttributes<ul>", default: "—", description: "Native ul attributes; use aria-label to name the list." },
  ],
  cssVars: [
    { name: "--eg-cell", description: "Cell background", default: "rgba(20,19,17,0.06)" },
    { name: "--eg-radius", description: "Cell corner radius", default: "14px" },
  ],
  examples: [
    {
      id: "basic",
      title: "Elastic columns",
      description: "Move across the grid: the column under the pointer stretches, neighbours yield, and the grid settles when you leave. Tab through the links to see the same from the keyboard.",
      code: `<ElasticGrid aria-label="Work" minCellWidth={150} gap={10}>
  {projects.map((p) => (
    <ElasticGrid.Item key={p.id} aspect="4 / 3">
      <a href={p.href} className="block h-full">
        <img src={p.cover} alt="" className="h-full w-full object-cover" />
        <span className="…">{p.title}</span>
      </a>
    </ElasticGrid.Item>
  ))}
</ElasticGrid>`,
    },
    {
      id: "filter",
      title: "Filter and sort with layout animation",
      description: "Change the children and cells glide to their new positions; removed cells fade out, new ones scale in.",
      code: `const visible = projects.filter((p) => filter === "all" || p.kind === filter).sort(sorter);

<ElasticGrid aria-label="Projects" columns={4}>
  {visible.map((p) => (
    <ElasticGrid.Item key={p.id} aspect="1 / 1">…</ElasticGrid.Item>
  ))}
</ElasticGrid>`,
    },
    {
      id: "content",
      title: "Content-sized cells",
      description: "Without an aspect ratio, cells size to their content; text reflows as columns stretch.",
      code: `<ElasticGrid aria-label="Articles" columns={3} stretch={0.25} spring="soft">
  {articles.map((a) => (
    <ElasticGrid.Item key={a.id} className="p-5">
      <h3>{a.title}</h3>
      <p>{a.summary}</p>
    </ElasticGrid.Item>
  ))}
</ElasticGrid>`,
    },
    {
      id: "tuned",
      title: "Wide reach, gentle stretch",
      description: "A long reach spreads the yielding across the whole row for a wave-like feel.",
      code: `<ElasticGrid aria-label="Swatches" columns={6} stretch={0.3} reach={3} spring="soft" gap={6}>
  …
</ElasticGrid>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`<ul role=list>\` laid out with CSS grid; each \`Item\` is an \`<li>\` and a Motion \`layout\` element.

- **Tracks**: the grid keeps a pool of twelve track weights on springs and renders the first \`columns\` of them as \`fr\` units. With no pointer every weight is 1.
- **Stretch**: while the pointer is over the grid, each column's weight becomes \`1 + stretch × (1 − d/reach)²\` where \`d\` is the distance in columns from the pointer to the column centre. The pointer is sampled at most once per frame through the shared pointer listener.
- **Keyboard**: focus inside a cell stretches that cell's column the same way and wins over the pointer until focus leaves.
- **Settle**: leaving the grid (or losing focus) sets every weight back to 1; the springs carry the motion.
- **Reflow**: cells use \`layout="position"\`, so filtering, sorting or inserting children animates them to their new places; \`AnimatePresence\` fades removed cells and scales in new ones.
- \`data-columns\`, \`data-active-column\` on the list and \`data-column\`, \`data-hovered\` on cells are exposed for styling and tests.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Cells are plain containers (\`--eg-cell\`, \`--eg-radius\`, or \`className\`); put your own card, link or image inside. Use \`object-fit: cover\` on images so they fill a stretching cell without distortion, and \`min-w-0\` / truncation for text that must not wrap.

Choose \`columns\` for a fixed layout or \`minCellWidth\` + \`maxColumns\` for a responsive one. \`stretch\` and \`reach\` set the feel: small reach is a dock-like bump, large reach a slow wave. \`spring="soft"\` suits large imagery, \`"stiff"\` dense swatches.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- List semantics: name the list with \`aria-label\`; cells are list items. Interactive content inside keeps its own roles.
- Keyboard focus inside a cell stretches its column, so keyboard users get the same emphasis as pointer users. Nothing moves focus.
- Reduced motion disables the stretch (fixed equal tracks) and shortens reflow animations; \`motion="off"\` is instant.
- Touch pointers do not stretch (no hover); tapping behaves as a normal grid.
- Column stretch changes widths only; reading order and DOM order never change.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `While the pointer is over the grid, one \`getBoundingClientRect\` per animation frame and up to twelve spring updates drive a single \`grid-template-columns\` style on the list. That is a layout change on the grid container each frame, which browsers handle well for a few dozen cells; for hundreds of cells prefer a smaller \`stretch\` or \`motion="reduced"\`. Nothing runs while the pointer is outside the grid. Reflow animations run only when children change.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- \`aspect-ratio\` and \`fr\` tracks are supported in all modern browsers.
- Stretching changes cell widths, so cells with fixed-width content may overflow; use \`min-w-0\` and responsive content.
- Server rendering outputs equal tracks; the column count is derived on the client when \`columns\` is omitted (pass \`columns\` for a layout-stable first paint).`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Only columns are elastic; rows take their height from content or aspect ratio.
- Column count is capped at 12 (track pool); \`maxColumns\` defaults to 6.
- Layout animation and a stretching container can interact when children change while the pointer is inside; cells settle correctly once the springs finish.
- Items must be direct children of the grid.`,
    },
  ],
  sourceFiles: ["components/ui/elastic-grid.tsx", "lib/pointer-field.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Pointer-weighted tracks are a generalisation of the classic dock magnification; no third-party code. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const elasticGridPlayground: PlaygroundDef = {
  initial: { columns: 4, gap: 10, stretch: 0.4, reach: 1.5, spring: "snappy", filter: "all", aspect: "4 / 3" },
  defaults: { gap: 12, stretch: 0.4, reach: 1.5, spring: "snappy", motion: "auto", filter: "all", aspect: "4 / 3" },
  controls: [
    { type: "select", prop: "filter", label: "Filter (demo)", group: "Content", options: [{ label: "All", value: "all" }, { label: "Photo", value: "photo" }, { label: "Film", value: "film" }, { label: "Type", value: "type" }] },
    { type: "select", prop: "aspect", label: "Cell aspect", group: "Content", options: [{ label: "4 / 3", value: "4 / 3" }, { label: "1 / 1", value: "1 / 1" }, { label: "3 / 4", value: "3 / 4" }] },
    { type: "range", prop: "columns", label: "Columns", group: "Layout", min: 2, max: 6, step: 1 },
    { type: "range", prop: "gap", label: "Gap", group: "Layout", min: 0, max: 32, step: 1, unit: "px" },
    { type: "range", prop: "stretch", label: "Stretch", group: "Elastic", min: 0, max: 1, step: 0.05 },
    { type: "range", prop: "reach", label: "Reach", group: "Elastic", min: 0.5, max: 4, step: 0.1, unit: " cols" },
    { type: "select", prop: "spring", label: "Spring", group: "Elastic", options: [{ label: "Soft", value: "soft" }, { label: "Snappy", value: "snappy" }, { label: "Stiff", value: "stiff" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Dock bump", values: { stretch: 0.8, reach: 1, spring: "stiff", columns: 6, aspect: "1 / 1", gap: 6 } },
    { name: "Slow wave", values: { stretch: 0.3, reach: 3.5, spring: "soft", columns: 5 } },
    { name: "Film only", values: { filter: "film", columns: 3, aspect: "3 / 4" } },
  ],
};
