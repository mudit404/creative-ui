import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const expandingProductGridMeta: ComponentMeta = {
  slug: "expanding-product-grid",
  name: "ExpandingProductGrid",
  title: "ProductCard Expand",
  tagline: "Product cards that expand in place into a detail view.",
  description:
    "A product grid where activating a card's title expands that card to span the full row, revealing a detail region beside its media while the other cards reflow around it. One card is open at a time; Escape or the close button collapses it and focus returns to the title. Cards are articles in a list, the title is a real button with aria-expanded, and the detail is a labelled region.",
  category: "layout",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["product", "card", "expand", "detail", "grid", "catalog", "shop", "accordion", "layout"],
  registryName: "expanding-product-grid",
  importPath: "@/components/ui/expanding-product-grid",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion"] },
  props: [
    { name: "expandedId / defaultExpandedId / onExpandedChange", type: "string | null", default: "— / null / —", description: "Controlled or uncontrolled id of the open card." },
    { name: "minCardWidth", type: "number", default: "200", description: "Minimum card width; the grid auto-fills columns (CSS, no JS)." },
    { name: "gap", type: "number", default: "16", description: "Gap in px." },
    { name: "detailLayout", type: '"side" | "stack"', default: '"side"', description: "In an expanded card, place the detail beside the media (from md up) or below it." },
    { name: "spring", type: '"soft" | "snappy" | "stiff"', default: '"snappy"', description: "Layout-animation spring for the reflow and media morph." },
    { name: "scrollIntoView", type: "boolean", default: "true", description: "Scroll the expanded card into view (nearest edge)." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced uses short fades without layout springs; off is instant." },
    { name: "Card.id", type: "string", default: "—", description: "Unique id used for the expanded state." },
    { name: "Card.title", type: "ReactNode", default: "—", description: "Title and accessible name of the expand button (rendered inside an h3)." },
    { name: "Card.media", type: "ReactNode", default: "—", description: "Image or visual, shown in both states; img children are object-fit cover." },
    { name: "Card.summary", type: "ReactNode", default: "—", description: "Collapsed-state content under the title (price, meta)." },
    { name: "Card.detail", type: "ReactNode", default: "—", description: "Expanded-state content (description, options, actions)." },
    { name: "Card.mediaAspect", type: "string", default: '"4 / 5"', description: "Aspect ratio of the media while collapsed." },
    { name: "Card.disabled", type: "boolean", default: "false", description: "Cannot be expanded." },
  ],
  cssVars: [
    { name: "--epg-card", description: "Card background", default: "#faf9f6" },
    { name: "--epg-foreground", description: "Card text colour", default: "#141311" },
    { name: "--epg-media", description: "Media placeholder background", default: "rgba(20,19,17,0.06)" },
    { name: "--epg-radius", description: "Card corner radius", default: "16px" },
    { name: "--epg-ring", description: "Expanded card ring and close-button border", default: "rgba(20,19,17,0.12)" },
  ],
  examples: [
    {
      id: "basic",
      title: "Shop grid",
      description: "Click a title to expand the card in place. Other cards reflow around it; Escape closes.",
      code: `<ExpandingProductGrid aria-label="Products" minCardWidth={180}>
  {products.map((p) => (
    <ExpandingProductGrid.Card
      key={p.id}
      id={p.id}
      title={p.name}
      media={<img src={p.image} alt="" />}
      summary={<span>{p.price}</span>}
      detail={<ProductDetail product={p} />}
    />
  ))}
</ExpandingProductGrid>`,
    },
    {
      id: "stack",
      title: "Stacked detail, soft spring",
      description: "detailLayout=\"stack\" keeps the media on top and grows the card downward.",
      code: `<ExpandingProductGrid aria-label="Prints" detailLayout="stack" spring="soft" minCardWidth={160}>
  …
</ExpandingProductGrid>`,
    },
    {
      id: "controlled",
      title: "Controlled with deep link",
      description: "Own the expanded id, for example to sync it with the URL.",
      code: `const [open, setOpen] = useState<string | null>(searchParams.get("item"));

<ExpandingProductGrid aria-label="Products" expandedId={open} onExpandedChange={setOpen}>
  …
</ExpandingProductGrid>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`<ul>\` laid out with \`repeat(auto-fill, minmax(minCardWidth, 1fr))\`. Each \`Card\` is an \`<li>\` holding an \`<article>\` with the media, an \`<h3>\` whose content is the expand \`button\`, the collapsed \`summary\`, and, while expanded, a \`section role="region"\` with the \`detail\` and a Close button.

- **Expand**: the card sets \`grid-column: 1 / -1\`. The \`li\` and the media box are Motion \`layout\` elements, so the card morphs from its cell to the full row and the media from its aspect box to the side panel while every other card slides to its new place.
- **Detail**: fades and rises in slightly after the morph starts; collapsing fades it out.
- **One at a time**: expanding a card collapses the open one.
- **Focus**: on expand, focus moves to Close (and the card scrolls into view); on collapse it returns to the title button.
- \`data-state="expanded|collapsed"\` on cards and \`data-expanded="<id>"\` on the list.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Theme with the \`--epg-*\` variables; \`className\` on the grid or a card composes with the defaults. \`media\`, \`summary\` and \`detail\` are free-form slots: put your own price row, option pickers, add-to-cart button or carousel inside. \`mediaAspect\` sets the collapsed image shape; the expanded side layout gives the media 45% of the width from md up.

Prefer \`detailLayout="stack"\` for narrow containers or tall imagery, and \`spring="soft"\` for large photography.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- List of articles, each labelled by its title heading. The title is a native button with \`aria-expanded\` and \`aria-controls\` pointing at the detail region.
- Enter/Space toggle; Escape inside an expanded card collapses it. Focus moves to Close on expand and back to the title on collapse, so keyboard and screen-reader users never lose their place.
- The detail region is \`role="region"\` with \`aria-labelledby\` the card title.
- \`disabled\` cards render a disabled button.
- Reduced motion: no layout springs or morph, short fades only; \`motion="off"\` is instant. Scrolling into view uses \`behavior: auto\` under reduced motion.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Nothing animates at rest. On expand or collapse, Motion runs one layout animation per visible card (transforms only) plus the media morph and a detail fade, for a few hundred milliseconds. Column layout is pure CSS; no observers or listeners are attached.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- \`grid-column: 1 / -1\`, \`aspect-ratio\` and \`min()\` are supported in all modern browsers.
- Layout animations are transform-based; images inside the media box should use \`object-fit: cover\` (applied to direct \`img\` children) to avoid distortion during the morph.
- Server rendering outputs the collapsed grid (or the \`defaultExpandedId\` card expanded) with no client-only layout.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- An expanded card always spans the full row; there is no 2×2 mode.
- Only direct \`img\` children of \`media\` get object-fit cover automatically.
- Layout animation measures on React commits; resizing the window mid-animation may cause a brief jump.
- No built-in URL sync; use the controlled API.`,
    },
  ],
  sourceFiles: ["components/ui/expanding-product-grid.tsx", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Expand-in-place product cards are a common e-commerce pattern; no third-party code. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const expandingProductGridPlayground: PlaygroundDef = {
  initial: { minCardWidth: 170, gap: 12, detailLayout: "side", spring: "snappy", defaultExpandedId: "p2" },
  defaults: { minCardWidth: 200, gap: 16, detailLayout: "side", spring: "snappy", scrollIntoView: true, motion: "auto", defaultExpandedId: null },
  controls: [
    { type: "select", prop: "defaultExpandedId", label: "Open initially", group: "State", options: [{ label: "None", value: "" }, { label: "Field jacket", value: "p1" }, { label: "Trail boot", value: "p2" }, { label: "Merino crew", value: "p3" }] },
    { type: "range", prop: "minCardWidth", label: "Min card width", group: "Layout", min: 120, max: 320, step: 10, unit: "px" },
    { type: "range", prop: "gap", label: "Gap", group: "Layout", min: 0, max: 32, step: 2, unit: "px" },
    { type: "select", prop: "detailLayout", label: "Detail layout", group: "Layout", options: [{ label: "Side", value: "side" }, { label: "Stack", value: "stack" }] },
    { type: "select", prop: "spring", label: "Spring", group: "Motion", options: [{ label: "Soft", value: "soft" }, { label: "Snappy", value: "snappy" }, { label: "Stiff", value: "stiff" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Stacked, soft", values: { detailLayout: "stack", spring: "soft", minCardWidth: 150 } },
    { name: "Dense", values: { minCardWidth: 130, gap: 8, spring: "stiff" } },
  ],
};
