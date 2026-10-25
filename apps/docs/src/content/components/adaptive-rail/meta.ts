import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const adaptiveRailMeta: ComponentMeta = {
  slug: "adaptive-rail",
  name: "AdaptiveRail",
  title: "Contextual Floating Rail",
  tagline: "A floating action rail that adapts to scroll and context.",
  description:
    "A floating toolbar pinned to a viewport edge. While the user scrolls down it collapses to its priority items (or slides away); it expands on scroll-up, when scrolling stops, on hover, and whenever it holds keyboard focus. Items can be scoped to a context so one rail serves browsing and selection. Arrow keys move between items; each item has a subtle magnetic pull.",
  category: "navigation",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["toolbar", "rail", "dock", "floating", "action bar", "scroll", "collapse", "context", "navigation"],
  registryName: "adaptive-rail",
  importPath: "@/components/ui/adaptive-rail",
  dependencies: {
    npm: ["motion", "clsx", "tailwind-merge"],
    registry: ["utils", "use-reduced-motion", "use-scroll-direction", "use-magnetic-field", "magnetic-field", "pointer-field", "springs"],
  },
  props: [
    { name: "label", type: "string", default: "—", description: "Accessible name of the toolbar (required)." },
    { name: "placement", type: '"bottom" | "top" | "left" | "right"', default: '"bottom"', description: "Edge the rail floats against. Left and right rails are vertical." },
    { name: "align", type: '"start" | "center" | "end"', default: '"center"', description: "Alignment along that edge." },
    { name: "offset", type: "number", default: "24", description: "Distance from the edge in px." },
    { name: "position", type: '"fixed" | "absolute"', default: '"fixed"', description: "fixed floats over the viewport; absolute floats inside a positioned ancestor (panels, demos)." },
    { name: "behavior", type: '"collapse" | "hide" | "static"', default: '"collapse"', description: "While scrolling down: keep only priority items, slide off the edge, or ignore scrolling." },
    { name: "scrollContainer", type: "RefObject<HTMLElement>", default: "window", description: "Scrollable element to observe instead of the window." },
    { name: "context", type: "string", default: "—", description: "Current context. Items with contexts render only when it matches." },
    { name: "showLabels", type: "boolean", default: "false", description: "Render item labels next to icons while expanded." },
    { name: "magnetic", type: "boolean", default: "true", description: "Subtle magnetic pull on each item (off under reduced motion)." },
    { name: "expanded", type: "boolean", default: "—", description: "Force the expanded state, for example while a popover anchored to an item is open." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced uses short fades, off is instant." },
    { name: "Item.label", type: "string", default: "—", description: "Accessible name of the item; visible when showLabels is on." },
    { name: "Item.priority", type: "boolean", default: "false", description: "Stays visible while the rail is collapsed." },
    { name: "Item.contexts", type: "string[]", default: "—", description: "Show only when the rail's context is one of these." },
    { name: "Item.active", type: "boolean", default: "—", description: "aria-pressed on buttons, aria-current on links, plus the active style." },
    { name: "Item.href", type: "string", default: "—", description: "Render an anchor instead of a button." },
    { name: "Separator", type: "component", default: "—", description: "role=separator; hidden while collapsed." },
  ],
  cssVars: [
    { name: "--ar-surface", description: "Rail background (translucent over the blurred page)", default: "light-dark(rgba(250,249,246,0.82), rgba(31,31,28,0.88))" },
    { name: "--ar-border", description: "Rail border and separators (decorative; one value for both)", default: "light-dark(rgba(20,19,17,0.15), rgba(236,235,230,0.15))" },
    { name: "--ar-foreground", description: "Icon and label colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--ar-item-hover", description: "Item hover background", default: "light-dark(rgba(20,19,17,0.08), rgba(236,235,230,0.08))" },
    { name: "--ar-item-active", description: "Active item background (ink)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--ar-item-active-foreground", description: "Active item icon and label colour (on ink)", default: "light-dark(#f3f1ec, #141311)" },
    { name: "--ar-ring", description: "Focus ring colour (solid ink)", default: "light-dark(#141311, #ecebe6)" },
  ],
  examples: [
    {
      id: "basic",
      title: "Scroll-aware dock",
      description: "Scroll the panel: the rail collapses to its priority items on the way down and expands when you stop or scroll up.",
      code: `const panel = useRef<HTMLDivElement>(null);

<div ref={panel} className="relative h-80 overflow-y-auto">
  <LongContent />
  <AdaptiveRail label="Actions" position="absolute" scrollContainer={panel}>
    <AdaptiveRail.Item label="Home" priority active><HomeIcon /></AdaptiveRail.Item>
    <AdaptiveRail.Item label="Search" priority><SearchIcon /></AdaptiveRail.Item>
    <AdaptiveRail.Item label="Bookmarks"><BookmarkIcon /></AdaptiveRail.Item>
    <AdaptiveRail.Separator />
    <AdaptiveRail.Item label="Settings"><SettingsIcon /></AdaptiveRail.Item>
  </AdaptiveRail>
</div>`,
    },
    {
      id: "context",
      title: "Contextual: browse vs. selection",
      description: "Select items in the list and the rail swaps to selection actions. Same rail, one context prop.",
      code: `<AdaptiveRail label="Library" context={selected.length ? "selection" : "browse"} behavior="static">
  <AdaptiveRail.Item label="New" contexts={["browse"]}><PlusIcon /></AdaptiveRail.Item>
  <AdaptiveRail.Item label="Sort" contexts={["browse"]}><SortIcon /></AdaptiveRail.Item>
  <AdaptiveRail.Item label="Share" contexts={["selection"]}><ShareIcon /></AdaptiveRail.Item>
  <AdaptiveRail.Item label="Delete" contexts={["selection"]}><TrashIcon /></AdaptiveRail.Item>
</AdaptiveRail>`,
    },
    {
      id: "labels",
      title: "With labels",
      description: "showLabels renders each item's label while expanded; collapsed items fall back to icons.",
      code: `<AdaptiveRail label="Editor" showLabels behavior="static" position="absolute">
  <AdaptiveRail.Item label="Write" priority active><PenIcon /></AdaptiveRail.Item>
  <AdaptiveRail.Item label="Preview"><EyeIcon /></AdaptiveRail.Item>
  <AdaptiveRail.Item label="Publish"><SendIcon /></AdaptiveRail.Item>
</AdaptiveRail>`,
    },
    {
      id: "vertical",
      title: "Vertical, hide on scroll",
      description: "A right-hand rail that slides away while scrolling down and returns on scroll-up. Up and Down arrows move focus.",
      code: `<AdaptiveRail label="Tools" placement="right" behavior="hide" position="absolute" scrollContainer={panel}>
  <AdaptiveRail.Item label="Comment"><CommentIcon /></AdaptiveRail.Item>
  <AdaptiveRail.Item label="Highlight"><HighlightIcon /></AdaptiveRail.Item>
  <AdaptiveRail.Item label="Share"><ShareIcon /></AdaptiveRail.Item>
</AdaptiveRail>`,
    },
    {
      id: "themed",
      title: "Themed",
      description: "CSS variables restyle the surface, items and ring.",
      code: `<AdaptiveRail
  label="Player"
  behavior="static"
  position="absolute"
  style={{ "--ar-surface": "#141311", "--ar-foreground": "#f3f1ec", "--ar-border": "rgba(255,255,255,0.12)", "--ar-item-hover": "rgba(255,255,255,0.1)", "--ar-item-active": "#ff4d1c", "--ar-item-active-foreground": "#141311", "--ar-ring": "#ff4d1c" }}
>
  …
</AdaptiveRail>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `The rail is a \`div role="toolbar"\` with \`aria-label\` and \`aria-orientation\`. Items are buttons (or anchors with \`href\`) with \`aria-label\`; separators are \`role="separator"\`.

- **Scroll**: \`useScrollDirection\` watches the window or \`scrollContainer\` and reports up / down / idle, re-rendering only on change. Scrolling down past the start collapses (\`behavior="collapse"\`) or hides (\`"hide"\`) the rail; scrolling up, stopping for ~160 ms, hovering with a mouse, holding focus or \`expanded\` restore it.
- **Collapse**: items without \`priority\` animate out (scale and width to zero) so the pill shrinks around the survivors; separators disappear. Items with \`contexts\` follow the \`context\` prop the same way.
- **Layout**: the rail animates its own size with Motion \`layout\`; placement is a fixed or absolute offset from an edge with start/center/end alignment.
- **Magnet**: each item is wrapped in a small magnetic field (radius 44 px, up to 5 px of travel) via \`useMagneticField\`.
- \`data-state="expanded|collapsed|hidden"\` is exposed for styling and tests.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Theme with the \`--ar-*\` variables on the rail or an ancestor. Every default is a \`light-dark()\` pair, so the rail follows the \`color-scheme\` of its surroundings without any \`.dark\` selector; override a variable to pin either side. \`className\` on the rail composes with the pill styles; \`className\` on an item composes with the 40 px round target. Put any icon set inside items; SVG children are sized to 20 px.

Use \`position="absolute"\` to float the rail inside a panel (give the panel \`position: relative\`) and \`scrollContainer\` to react to that panel's scrolling. Use \`expanded\` to pin it open while a popover or menu anchored to an item is visible.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Toolbar pattern: Tab enters the rail, arrow keys (Left/Right, or Up/Down for vertical rails), Home and End move between visible items, which wrap around.
- The rail never collapses while it holds focus, so keyboard users always see every item.
- Each item needs a \`label\`; it becomes \`aria-label\` and the visible label with \`showLabels\`. \`active\` maps to \`aria-pressed\` on buttons and \`aria-current="page"\` on links.
- Collapsed and out-of-context items are unmounted, not just hidden, so they leave the tab order and the accessibility tree.
- Items are 40 px tall with at least 40 px width.
- Reduced motion replaces springs with short fades and disables the magnetic pull; \`motion="off"\` is instant.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `One passive scroll listener per rail, with state updates only when the direction changes (not per event). Item magnets share the global pointer listener and do one rect read per frame while the pointer moves near the rail. Collapse and expand run Motion layout animations for a few hundred milliseconds; nothing animates at rest.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- \`backdrop-filter\` blur is used for the surface; browsers without it show the solid fallback colour.
- Colour defaults follow \`color-scheme\` via \`light-dark()\` (Chrome 123+, Safari 17.5+, Firefox 120+); older browsers get the light values.
- Touch: no hover expansion (there is no hover); scrolling still collapses and expands. Tapping an item works as usual.
- Server rendering is safe: the rail renders expanded and attaches its scroll listener after hydration.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Priority items are decided by you; the rail does not measure available space to decide what fits.
- Overflow menus ("more…") are not built in; compose one from your menu component and pass \`expanded\` while it is open.
- With \`position="fixed"\`, nested scroll containers are not auto-detected; pass \`scrollContainer\`.`,
    },
  ],
  sourceFiles: ["components/ui/adaptive-rail.tsx", "hooks/use-scroll-direction.ts", "hooks/use-magnetic-field.ts", "lib/magnetic-field.ts"],
  provenance:
    "Original implementation. Floating docks and scroll-hiding toolbars are common UI patterns; no third-party code is used. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const adaptiveRailPlayground: PlaygroundDef = {
  initial: { placement: "bottom", align: "center", behavior: "collapse", showLabels: false, magnetic: true, context: "browse" },
  defaults: { placement: "bottom", align: "center", behavior: "collapse", showLabels: false, magnetic: true, offset: 24, motion: "auto" },
  controls: [
    { type: "select", prop: "placement", label: "Placement", group: "Layout", options: [{ label: "Bottom", value: "bottom" }, { label: "Top", value: "top" }, { label: "Left", value: "left" }, { label: "Right", value: "right" }] },
    { type: "select", prop: "align", label: "Align", group: "Layout", options: [{ label: "Start", value: "start" }, { label: "Center", value: "center" }, { label: "End", value: "end" }] },
    { type: "select", prop: "behavior", label: "On scroll down", group: "Behaviour", options: [{ label: "Collapse to priority", value: "collapse" }, { label: "Hide", value: "hide" }, { label: "Static", value: "static" }] },
    { type: "select", prop: "context", label: "Context", group: "Behaviour", options: [{ label: "Browse", value: "browse" }, { label: "Selection", value: "selection" }] },
    { type: "boolean", prop: "showLabels", label: "Show labels", group: "Appearance" },
    { type: "boolean", prop: "magnetic", label: "Magnetic items", group: "Appearance" },
  ],
  presets: [
    { name: "Dock", values: {} },
    { name: "Selection toolbar", values: { context: "selection", behavior: "static", showLabels: true } },
    { name: "Side tools", values: { placement: "right", behavior: "hide" } },
    { name: "Top bar", values: { placement: "top", align: "end", showLabels: true } },
  ],
};
