import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const mosaicMenuMeta: ComponentMeta = {
  slug: "mosaic-menu",
  name: "MosaicMenu",
  title: "MosaicRoute Menu",
  tagline: "A full-screen route menu built from shifting mosaic tiles.",
  description:
    "A trigger opens a full-screen modal menu: route tiles assemble into a mosaic with staggered choreography radiating from the centre, shift lightly toward the pointer, and scatter out on close. It is a proper dialog (focus trap, Escape, backdrop click, body scroll lock, focus return) over a nav of real links; arrow keys move across the mosaic in two dimensions and the current route is marked.",
  category: "navigation",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["menu", "navigation", "full-screen", "overlay", "mosaic", "tiles", "routes", "dialog", "mega menu"],
  registryName: "mosaic-menu",
  importPath: "@/components/ui/mosaic-menu",
  dependencies: {
    npm: ["motion", "@radix-ui/react-slot", "clsx", "tailwind-merge"],
    registry: ["utils", "use-reduced-motion", "use-magnetic-field", "magnetic-field", "pointer-field", "springs"],
  },
  props: [
    { name: "tiles", type: "{ id, href, title, description?, accent?, foreground?, span?, current?, media? }[]", default: "—", description: "The routes. span 2 makes a wide tile; current marks the active route; accent is the tile background." },
    { name: "label", type: "string", default: "—", description: "Accessible name of the dialog and its nav (required)." },
    { name: "open / defaultOpen / onOpenChange", type: "boolean / boolean / (open) => void", default: "— / false / —", description: "Controlled or uncontrolled open state." },
    { name: "minTileWidth", type: "number", default: "220", description: "Minimum tile width; the mosaic auto-fills columns with dense packing." },
    { name: "gap", type: "number", default: "10", description: "Gap in px." },
    { name: "stagger", type: "number", default: "0.035", description: "Seconds between tile launches, ordered by distance from the centre of the list." },
    { name: "linkComponent", type: "ElementType", default: '"a"', description: "Link component for client-side routing, e.g. Next's Link. Must accept href, className, children and aria props." },
    { name: "onNavigate", type: "(tile) => void | boolean", default: "—", description: "Called when a tile is activated. Return false to keep the menu open." },
    { name: "footer", type: "ReactNode", default: "—", description: "Content under the mosaic (contact, social, legal)." },
    { name: "magnetic", type: "boolean", default: "true", description: "Light magnetic shift on tiles (off under reduced motion)." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced fades tiles in place; off is instant." },
    { name: "className / style", type: "string / CSSProperties", default: "—", description: "Applied to the overlay." },
    { name: "Trigger", type: "component", default: "—", description: "The menu button with aria-haspopup=dialog; default renders a grid icon and “Menu”, or asChild for your own element." },
  ],
  cssVars: [
    { name: "--mm-backdrop", description: "Overlay background (designed dark on both themes)", default: "rgba(20,19,17,0.92)" },
    { name: "--mm-foreground", description: "Overlay text and tile focus ring colour (designed dark on both themes)", default: "#f3f1ec" },
    { name: "--mm-tile", description: "Tile background when no accent is set", default: "rgba(255,255,255,0.08)" },
    { name: "--mm-radius", description: "Tile corner radius", default: "16px" },
    { name: "--mm-trigger / --mm-trigger-foreground / --mm-trigger-border", description: "Default trigger colours: background, text and decorative border (the trigger carries a label)", default: "transparent / light-dark(#141311, #ecebe6) / light-dark(rgba(20,19,17,0.25), rgba(236,235,230,0.25))" },
    { name: "--mm-ring", description: "Trigger focus ring colour", default: "light-dark(#141311, #ecebe6)" },
  ],
  examples: [
    {
      id: "basic",
      title: "Site menu",
      description: "Open the menu, move with the arrow keys, Escape to close. The tiles assemble from the centre outward.",
      code: `<MosaicMenu label="Site menu" tiles={routes} footer={<a href="mailto:hello@studio.example">hello@studio.example</a>}>
  <MosaicMenu.Trigger />
</MosaicMenu>`,
    },
    {
      id: "accents",
      title: "Accented tiles with spans",
      description: "Each route can carry its own colour and a 2-column span; dense packing fills the gaps.",
      code: `const routes = [
  { id: "work", href: "/work", title: "Work", description: "Selected projects", accent: "#ff4d1c", foreground: "#fff", span: 2 },
  { id: "studio", href: "/studio", title: "Studio", accent: "#1d2a6b", foreground: "#f2f0ff", current: true },
  …
];`,
    },
    {
      id: "router",
      title: "With a router link",
      description: "Pass your framework's Link for client-side navigation; onNavigate can also run analytics or keep the menu open.",
      code: `import Link from "next/link";

<MosaicMenu label="Menu" tiles={routes} linkComponent={Link} onNavigate={(t) => track("nav", t.id)}>
  <MosaicMenu.Trigger asChild>
    <button className="…">Explore</button>
  </MosaicMenu.Trigger>
</MosaicMenu>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `\`MosaicMenu\` renders its children in place (the \`Trigger\`) and, while open, a portal into \`document.body\`: a fixed overlay (backdrop, blur) containing a \`role="dialog" aria-modal\` with a header (label, Close), a \`nav\` of tiles and an optional footer.

- **Open**: the overlay fades in; each tile launches from a deterministic scatter vector with a spring, delayed by its distance from the centre of the list, so the mosaic assembles from the middle outward. Focus moves to the current route's tile (or the first).
- **Shift**: each tile sits in a small magnetic field (40 px, up to 4 px) and leans toward the pointer; hover lifts it slightly.
- **Close**: Escape, the Close button, a backdrop click, or activating a tile (unless \`onNavigate\` returns false). Tiles scatter back along their vectors, then the overlay fades. Focus returns to the trigger; body scroll is restored.
- **Grid**: \`repeat(auto-fill, minmax(minTileWidth, 1fr))\` with \`grid-auto-flow: dense\`, so \`span: 2\` tiles pack without holes.
- \`data-state\` on the trigger; \`data-motion\` on the overlay; \`data-mosaic-tile\` on tile links.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Theme with the \`--mm-*\` variables (overlay, text, tile, radius, trigger). The overlay is designed dark on both themes; the trigger's defaults follow \`color-scheme\` via \`light-dark()\` (Chrome 123+, Safari 17.5+, Firefox 120+; older browsers get the light values). Give tiles their own \`accent\`/\`foreground\`, a \`media\` node (an image or icon behind the text) and \`span: 2\` for emphasis. \`className\`/\`style\` apply to the overlay; the \`Trigger\` takes classes or \`asChild\`.

Tune the choreography with \`stagger\` (0 for a single burst, 0.08 for a slow ripple). Pass \`linkComponent\` for client-side routing.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Trigger: \`aria-haspopup="dialog"\`, \`aria-expanded\`, \`aria-controls\`.
- Dialog: \`role="dialog"\`, \`aria-modal="true"\`, labelled; Tab and Shift+Tab are trapped inside; Escape closes; focus returns to the trigger on close.
- Tiles are links in a labelled \`nav\`; the current route has \`aria-current="page"\` and a ring. Arrow keys move by one (Left/Right) or by a row (Up/Down) using the rendered column count; Home/End jump.
- Body scrolling is locked while open; the overlay itself scrolls if the mosaic is taller than the viewport.
- Reduced motion: tiles fade in place with no scatter, lift or magnetism; \`motion="off"\` is instant.
- Tile text uses \`clamp()\` sizing and keeps at least 120 px of height for comfortable targets.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Nothing is rendered while closed except the trigger (the portal mounts only when open). Opening animates one spring per tile plus the overlay fade; magnets share the global pointer listener. With dozens of tiles the choreography is still transform-only.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- \`backdrop-filter\` blur is progressive; without it the overlay is a solid tint.
- The portal requires a client mount; on the server only the trigger renders, and \`defaultOpen\` applies after hydration.
- Touch: no magnetism; tap tiles or the backdrop. The overlay scrolls natively.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- One level of routes; no nested sections or submenus yet.
- Arrow-key rows assume equal-width tiles; with \`span: 2\` tiles Up/Down may land one tile off.
- The focus trap covers the dialog subtree only; browser chrome (the address bar) remains reachable, as it should.
- No route-change listener: in client-side routers, close the menu via \`onNavigate\` (default) or control \`open\`.`,
    },
  ],
  sourceFiles: ["components/ui/mosaic-menu.tsx", "hooks/use-magnetic-field.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Full-screen tile menus are a common editorial-site pattern; the dialog keyboard model follows the WAI-ARIA Authoring Practices. No third-party code. Runtime dependencies: motion (MIT), @radix-ui/react-slot (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const mosaicMenuPlayground: PlaygroundDef = {
  initial: { minTileWidth: 220, gap: 10, stagger: 0.035, magnetic: true, tileSet: "accents" },
  defaults: { minTileWidth: 220, gap: 10, stagger: 0.035, magnetic: true, motion: "auto", tileSet: "accents" },
  controls: [
    { type: "select", prop: "tileSet", label: "Tiles (demo)", group: "Content", options: [{ label: "Accented", value: "accents" }, { label: "Plain", value: "plain" }] },
    { type: "range", prop: "minTileWidth", label: "Min tile width", group: "Layout", min: 140, max: 360, step: 10, unit: "px" },
    { type: "range", prop: "gap", label: "Gap", group: "Layout", min: 0, max: 24, step: 2, unit: "px" },
    { type: "range", prop: "stagger", label: "Stagger", group: "Motion", min: 0, max: 0.12, step: 0.005, unit: "s" },
    { type: "boolean", prop: "magnetic", label: "Magnetic tiles", group: "Motion" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Slow ripple", values: { stagger: 0.09 } },
    { name: "Dense", values: { minTileWidth: 150, gap: 4, stagger: 0.02 } },
  ],
};
