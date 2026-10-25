import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const dockWorkspaceMeta: ComponentMeta = {
  slug: "dock-workspace",
  name: "DockWorkspace",
  title: "Dock Workspace",
  tagline: "Registered panels in split and tab groups, with a versioned layout you can save.",
  description:
    "A limited, independent docking surface (not a full docking engine): panels are registered by id, arranged by a serializable tree of row/column splits and tab groups, and positioned from that tree's ratios alone, so panel content stays mounted across tab switches, resizes, moves and the compact mode. Dragging a tab shows only a translucent preview that snaps to a legal edge or group; releasing proposes one layout, and controlled hosts stay authoritative. The panel menu offers the same moves, Join and Close without dragging; resize handles work by pointer, arrow keys and Enter. Closing asks onBeforeClose and keeps the panel when declined. Invalid or stale persisted layouts recover to the default with a reason, and narrow or over-constrained containers show one panel at a time.",
  category: "layout",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["dock", "panels", "workspace", "split", "tabs", "layout", "ide", "resizable", "editor"],
  registryName: "dock-workspace",
  importPath: "@/components/ui/dock-workspace",
  dependencies: { npm: ["clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "dock-layout"] },
  props: [
    { name: "panels", type: "{ id, title, render, minWidth?, minHeight?, closable? }[]", default: "—", description: "Required. Minimums default to 120 × 80 px; closable defaults to true." },
    { name: "layout / defaultLayout", type: "DockLayout", default: "variant default", description: "{ schemaVersion: 1, root: split | group }. Validated against panel ids; invalid input recovers to the default." },
    { name: "onLayoutChange", type: "(next, { reason, panelId?, problems? }) => void", default: "—", description: "One call per accepted operation: move | resize | close | activate | reset | recover. Previews never call it." },
    { name: "onBeforeClose", type: "(panelId) => boolean | Promise<boolean>", default: "—", description: "Return false to keep the panel; it stays present until accepted." },
    { name: "activePanelId / defaultActivePanelId / onActivePanelChange", type: "string / string / callback", default: "first panel", description: "Selection, distinct from mounting." },
    { name: "compactBreakpoint", type: "px", default: "768", description: "Container width (not viewport) below which one panel shows at a time." },
    { name: "variant", type: '"studio" | "analysis"', default: '"studio"', description: "Fallback layout shape: main + side, or balanced columns." },
    { name: "resizeStep", type: "px", default: "24", description: "Arrow-key step on a handle; Shift steps 10 %, Enter evens the pair." },
    { name: "motion / durationScale", type: "shared", default: "auto / 1", description: "180 ms settle after an accepted layout; none during drags or under reduced motion." },
    { name: "ref", type: "DockWorkspaceHandle", default: "—", description: "{ root, focusPanel(id), resetLayout() }." },
  ],
  cssVars: [
    { name: "--cui-dock-tab", description: "Tab strip background", default: "#efede8" },
    { name: "--cui-dock-active", description: "Active tab and panel background", default: "#faf9f6" },
    { name: "--cui-dock-divider", description: "Dividers and handles", default: "rgba(20,19,17,0.15)" },
    { name: "--cui-dock-preview", description: "Valid docking preview", default: "#1f7a4f" },
    { name: "--cui-dock-focus", description: "Focus ring and hovered handle", default: "#141311" },
  ],
  examples: [
    { id: "studio", title: "Five-panel editor", description: "Drag tabs to edges or groups, or use each panel's ▾ menu. Resize with the handle (pointer or arrow keys). Every accepted layout is logged with its reason.", code: `<DockWorkspace panels={PANELS} onLayoutChange={log} />` },
    { id: "dirty", title: "Dirty panel", description: "Type into Notes, then close it: onBeforeClose declines while the draft is unsaved and the content stays. Clear the draft to allow the close.", code: `onBeforeClose={(id) => id !== "notes" || draft === ""}` },
    { id: "invalid", title: "Invalid persisted layout", description: "A saved layout with an unknown and a duplicated panel id recovers to the default and reports the problems.", code: `<DockWorkspace defaultLayout={corrupt} onLayoutChange={log} />` },
    { id: "narrow", title: "Compact and over-constrained", description: "A 420 px container, and a wide container whose Canvas needs 2000 px: both show one panel with a tab selector.", code: `<div style={{ width: 420 }}><DockWorkspace … /></div>` },
    { id: "controlled", title: "Controlled host", description: "The parent owns the layout and can refuse proposals: with Refuse on, a drag or menu move proposes but nothing changes.", code: `<DockWorkspace layout={layout} onLayoutChange={(l) => !refuse && setLayout(l)} />` },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (ready | previewing | close-pending | compact), \`data-compact\` and \`data-recovered\`. Per group a \`role="tablist"\` strip of \`role="tab"\` buttons (each with a ▾ menu button), one \`role="tabpanel"\` per registered panel positioned absolutely from the layout geometry, \`role="separator"\` resize handles with \`aria-valuenow\`, a docking preview overlay, a \`role="menu"\` popover and a status line.

- **Layout model**: \`validateLayout\` (version, unknown/duplicate ids, ratio bounds, structure, cycles), \`movePanel\`/\`removePanel\` (pure; same object on a no-op), \`clampRatios\` against minimum sizes, \`layoutGeometry\` for rects and handles, \`hitTest\` for drop zones (C59-T02, C59-T03, C59-T05, C59-T06).
- **Previews**: drag and resize change only local preview state; \`onLayoutChange\` fires once on release. Escape or releasing outside cancels (C59-T01, C59-T08).
- **Mounting policy**: panels render once in a flat list and are positioned, never re-parented, so hidden and moved panels keep their React state. Closing removes the panel from the layout; the host removes it from \`panels\` when it should stop existing (C59-T09).
- **Closing**: \`onBeforeClose\` may be async; while pending the panel is marked \`data-closing\`; a decline is reported in the status and focus returns to the tab (C59-T04).`,
    },
    { id: "accessibility", title: "Accessibility", body: `- Tabs follow the APG pattern (roving focus, arrow keys, Delete closes); menus are real \`menuitem\`s with Escape returning focus.\n- Every drag has a menu equivalent; resize handles are focusable separators with arrow, Shift+arrow, Home/End and Enter.\n- Focus follows a moved panel and goes to the neighbouring tab after a close (C59-T07).\n- Compact mode presents the same panels as one tablist.` },
    { id: "performance", title: "Performance", body: `Geometry is pure arithmetic from ratios; a resize preview updates one state object per pointer move and no panel re-renders its content. No listeners while idle beyond the ResizeObserver; drag and menu listeners attach only while active.` },
    { id: "limitations", title: "Known limitations", body: `- Not a docking engine: no floating panels, popouts, cross-window or multi-monitor restoration (deferred by the brief).\n- Moving a panel re-measures nothing but does re-position; inline content that depends on its own size should use its own ResizeObserver.\n- Panel ids must be unique and stable; the host owns persistence and version migration.` },
  ],
  sourceFiles: ["components/ui/dock-workspace.tsx", "lib/dock-layout.ts", "hooks/use-reduced-motion.ts"],
  provenance: "Original implementation. Dockview was reviewed as the brief's candidate adapter and not used (its enterprise tier and redistribution terms were not cleared; see DECISIONS 017). Contracts from Collection 02 brief #59. Runtime dependencies: clsx (MIT), tailwind-merge (MIT).",
};

export const dockWorkspacePlayground: PlaygroundDef = {
  initial: { variant: "studio", compactBreakpoint: 360, resizeStep: 24 },
  defaults: { variant: "studio", compactBreakpoint: 768, resizeStep: 24, motion: "auto", durationScale: 1 },
  controls: [
    { type: "select", prop: "variant", label: "Fallback layout", group: "Shape", options: [{ label: "Studio", value: "studio" }, { label: "Analysis", value: "analysis" }] },
    { type: "range", prop: "compactBreakpoint", label: "Compact below", min: 320, max: 1200, step: 20, unit: "px", group: "Responsive" },
    { type: "range", prop: "resizeStep", label: "Resize step", min: 4, max: 96, step: 4, unit: "px", group: "Input" },
  ],
  presets: [{ name: "Studio", values: { variant: "studio" } }, { name: "Analysis", values: { variant: "analysis" } }, { name: "Force compact", values: { compactBreakpoint: 1200 } }],
};
