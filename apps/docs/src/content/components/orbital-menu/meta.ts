import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const orbitalMenuMeta: ComponentMeta = {
  slug: "orbital-menu",
  name: "OrbitalMenu",
  title: "Orbital Action Menu",
  tagline: "Actions that orbit a trigger and settle into reach.",
  description:
    "A radial action menu. Press the trigger and the items launch from its centre on staggered springs, swinging through an arc into their orbit; each one then leans toward the pointer. It is a real menu: the trigger has aria-haspopup and aria-expanded, the ring is role=menu with menuitems, arrow keys move around the ring, Escape and outside clicks close it and focus returns to the trigger. Radius, sweep and start angle shape the ring; reduced motion fades items in place.",
  category: "navigation",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["menu", "radial", "orbit", "fab", "actions", "speed dial", "circular", "navigation"],
  registryName: "orbital-menu",
  importPath: "@/components/ui/orbital-menu",
  dependencies: {
    npm: ["motion", "@radix-ui/react-slot", "clsx", "tailwind-merge"],
    registry: ["utils", "use-reduced-motion", "use-magnetic-field", "magnetic-field", "pointer-field", "springs"],
  },
  props: [
    { name: "open / defaultOpen / onOpenChange", type: "boolean / boolean / (open) => void", default: "— / false / —", description: "Controlled or uncontrolled open state." },
    { name: "radius", type: "number", default: "96", description: "Distance from the trigger centre to item centres, px." },
    { name: "startAngle", type: "number", default: "-90", description: "Angle of the first item in degrees. 0 is right, -90 is up; clockwise positive." },
    { name: "sweep", type: "number", default: "360", description: "Degrees the items spread across. 360 is a full ring (evenly spaced); less is an arc from the start angle." },
    { name: "swing", type: "number", default: "40", description: "Degrees each item swings through while flying out." },
    { name: "stagger", type: "number", default: "0.045", description: "Seconds between each item's launch." },
    { name: "spring", type: '"soft" | "snappy" | "stiff"', default: '"snappy"', description: "Launch spring feel." },
    { name: "closeOnSelect", type: "boolean", default: "true", description: "Close after an item is selected." },
    { name: "magnetic", type: "boolean", default: "true", description: "Subtle magnetic pull on items (off under reduced motion)." },
    { name: "showLabels", type: "boolean", default: "false", description: "Render a label pill under each item." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced fades items in place; off is instant." },
    { name: "Trigger", type: "component", default: "—", description: "The menu button. Default renders a round button with a plus that rotates when open; asChild uses your element." },
    { name: "Ring", type: "component", default: "—", description: "Wraps the items; rendered only while open." },
    { name: "Item.label", type: "string", default: "—", description: "Accessible name; visible with showLabels." },
    { name: "Item.onSelect", type: "() => void", default: "—", description: "Called on click, Enter or Space." },
    { name: "Item.href", type: "string", default: "—", description: "Render an anchor instead of a button." },
    { name: "Item.disabled", type: "boolean", default: "false", description: "Skipped by keyboard navigation and not selectable." },
  ],
  cssVars: [
    { name: "--om-trigger / --om-trigger-foreground", description: "Trigger background and icon colour", default: "#141311 / #f3f1ec" },
    { name: "--om-item / --om-item-foreground", description: "Item background and icon colour", default: "#faf9f6 / #141311" },
    { name: "--om-item-hover / --om-item-hover-foreground", description: "Item hover colours", default: "#141311 / #f3f1ec" },
    { name: "--om-label / --om-label-foreground", description: "Label pill colours", default: "#141311 / #f3f1ec" },
    { name: "--om-ring", description: "Focus ring colour", default: "#141311" },
  ],
  examples: [
    {
      id: "basic",
      title: "Full ring",
      description: "Six actions evenly spaced around the trigger.",
      code: `<OrbitalMenu>
  <OrbitalMenu.Trigger aria-label="Create" />
  <OrbitalMenu.Ring>
    <OrbitalMenu.Item label="Note" onSelect={…}><NoteIcon /></OrbitalMenu.Item>
    <OrbitalMenu.Item label="Photo" onSelect={…}><CameraIcon /></OrbitalMenu.Item>
    …
  </OrbitalMenu.Ring>
</OrbitalMenu>`,
    },
    {
      id: "arc",
      title: "Quarter arc from a corner",
      description: "A floating action button in a corner fans its actions into the free quadrant.",
      code: `<OrbitalMenu startAngle={-180} sweep={90} radius={110} showLabels>
  <OrbitalMenu.Trigger aria-label="Actions" />
  <OrbitalMenu.Ring>
    <OrbitalMenu.Item label="Compose">…</OrbitalMenu.Item>
    <OrbitalMenu.Item label="Upload">…</OrbitalMenu.Item>
    <OrbitalMenu.Item label="Record">…</OrbitalMenu.Item>
  </OrbitalMenu.Ring>
</OrbitalMenu>`,
    },
    {
      id: "half",
      title: "Half ring above, custom trigger",
      description: "asChild makes any element the trigger. Items spread over the upper half.",
      code: `<OrbitalMenu startAngle={-180} sweep={180} spring="soft" swing={60}>
  <OrbitalMenu.Trigger asChild>
    <button className="rounded-full border px-5 py-3">Share to…</button>
  </OrbitalMenu.Trigger>
  <OrbitalMenu.Ring>…</OrbitalMenu.Ring>
</OrbitalMenu>`,
    },
    {
      id: "controlled",
      title: "Controlled",
      description: "Own the open state and keep the menu open after selecting.",
      code: `const [open, setOpen] = useState(false);
const [picked, setPicked] = useState<string | null>(null);

<OrbitalMenu open={open} onOpenChange={setOpen} closeOnSelect={false}>
  <OrbitalMenu.Trigger aria-label="Pick a colour" />
  <OrbitalMenu.Ring>
    {colors.map((c) => (
      <OrbitalMenu.Item key={c} label={c} onSelect={() => setPicked(c)}>
        <span style={{ background: c }} className="size-5 rounded-full" />
      </OrbitalMenu.Item>
    ))}
  </OrbitalMenu.Ring>
</OrbitalMenu>`,
    },
    {
      id: "themed",
      title: "Themed",
      description: "CSS variables restyle trigger, items and labels.",
      code: `<OrbitalMenu showLabels style={{ "--om-trigger": "#ff4d1c", "--om-item": "#1b1b19", "--om-item-foreground": "#f3f1ec", "--om-item-hover": "#ff4d1c", "--om-label": "#ff4d1c" }}>
  …
</OrbitalMenu>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `\`OrbitalMenu\` (root, \`position: relative\`) holds a \`Trigger\` and a \`Ring\`. The ring is a zero-size \`role="menu"\` box at the trigger's centre; each \`Item\` is positioned by a polar coordinate from it.

- **Launch**: each item animates a progress value 0 → 1 with a spring, staggered by \`stagger\`. Radius grows with progress; the angle starts \`swing\` degrees before its resting angle and arrives as progress reaches 1, so items swing into orbit rather than sliding straight out. Overshoot carries them slightly past the ring before settling.
- **Settle**: each item's wrapper is a small magnetic field (48 px, up to 6 px of travel) via \`useMagneticField\`.
- **Layout**: a full \`sweep\` (360) spaces items evenly around the ring; a smaller sweep spreads them from \`startAngle\` across the arc with items at both ends.
- **Close**: items scale and fade out; Escape, Tab, outside pointer-down, selecting (with \`closeOnSelect\`) or the trigger all close it.
- \`data-state="open|closed"\` on the root and trigger; \`data-motion\` on the root.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Theme with the \`--om-*\` variables on the root or an ancestor. The default trigger is a 56 px round button with a rotating plus; pass children for a different icon, or \`asChild\` to use your own element (it must forward \`ref\` and spread props). Items are 44 px round buttons; put any icon inside (SVG children are sized to 20 px) and add \`className\` for variants.

Shape the ring with \`radius\`, \`startAngle\` and \`sweep\`; a quarter or half arc suits corners and edges. \`swing\`, \`stagger\` and \`spring\` tune the launch. The menu renders inline (no portal), so give its ancestors \`overflow: visible\` or enough room.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Trigger: \`aria-haspopup="menu"\`, \`aria-expanded\`, \`aria-controls\`; Enter/Space toggle, ArrowDown/ArrowUp open.
- Ring: \`role="menu"\`; items are \`role="menuitem"\` buttons or links with \`aria-label\`. Opening moves focus to the first enabled item.
- Keyboard: ArrowRight/ArrowDown next, ArrowLeft/ArrowUp previous (wrapping), Home/End, Enter/Space select, Escape closes and returns focus to the trigger, Tab closes.
- Disabled items are \`aria-disabled\`, skipped by navigation and not selectable.
- Reduced motion: items fade in place with no orbit or magnetism; \`motion="off"\` is instant.
- Items are 44 px touch targets; keep \`radius\` large enough that they do not overlap (about 14 px of arc per item at 44 px).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Nothing runs while closed. Opening animates one spring per item (progress → x, y, scale, opacity through transforms) for a few hundred milliseconds; magnets share the global pointer listener. The ring unmounts when closed, so a page with many menus holds no live animation state.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- Transforms only; works in all modern browsers.
- Touch: tap to open, tap an item to select, tap outside to close. No magnetism on touch.
- Server rendering renders the closed state (or the ring at rest for \`defaultOpen\`); springs start on the client.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No portal: the ring is positioned inside the root, so clipping ancestors cut it off and stacking contexts apply.
- No nested submenus or typeahead.
- Items are placed by angle only; the menu does not detect viewport edges. Choose \`startAngle\` and \`sweep\` for where the trigger sits.`,
    },
  ],
  sourceFiles: ["components/ui/orbital-menu.tsx", "hooks/use-magnetic-field.ts", "lib/magnetic-field.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Radial / speed-dial menus are a common pattern; the menu-button keyboard model follows the WAI-ARIA Authoring Practices. No third-party code. Runtime dependencies: motion (MIT), @radix-ui/react-slot (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const orbitalMenuPlayground: PlaygroundDef = {
  initial: { defaultOpen: true, radius: 100, startAngle: -90, sweep: 360, swing: 40, stagger: 0.045, spring: "snappy", showLabels: false, closeOnSelect: false, magnetic: true, items: 6 },
  defaults: { defaultOpen: false, radius: 96, startAngle: -90, sweep: 360, swing: 40, stagger: 0.045, spring: "snappy", showLabels: false, closeOnSelect: true, magnetic: true, motion: "auto", items: 6 },
  controls: [
    { type: "range", prop: "items", label: "Items", group: "Content", min: 2, max: 8, step: 1 },
    { type: "boolean", prop: "showLabels", label: "Show labels", group: "Content" },
    { type: "range", prop: "radius", label: "Radius", group: "Ring", min: 60, max: 150, step: 2, unit: "px" },
    { type: "range", prop: "sweep", label: "Sweep", group: "Ring", min: 60, max: 360, step: 10, unit: "°" },
    { type: "range", prop: "startAngle", label: "Start angle", group: "Ring", min: -180, max: 180, step: 5, unit: "°" },
    { type: "range", prop: "swing", label: "Swing", group: "Motion", min: 0, max: 120, step: 5, unit: "°" },
    { type: "range", prop: "stagger", label: "Stagger", group: "Motion", min: 0, max: 0.15, step: 0.005, unit: "s" },
    { type: "select", prop: "spring", label: "Spring", group: "Motion", options: [{ label: "Soft", value: "soft" }, { label: "Snappy", value: "snappy" }, { label: "Stiff", value: "stiff" }] },
    { type: "boolean", prop: "magnetic", label: "Magnetic items", group: "Motion" },
    { type: "boolean", prop: "closeOnSelect", label: "Close on select", group: "Behaviour" },
    { type: "boolean", prop: "defaultOpen", label: "Open initially", group: "Behaviour" },
  ],
  presets: [
    { name: "Full ring", values: {} },
    { name: "Corner fan", values: { startAngle: -180, sweep: 90, radius: 120, items: 3, showLabels: true } },
    { name: "Half above", values: { startAngle: -180, sweep: 180, spring: "soft", swing: 60, items: 5 } },
    { name: "Tight and quick", values: { radius: 72, spring: "stiff", swing: 15, stagger: 0.02, items: 4 } },
  ],
};
