import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const liquidSwitchMeta: ComponentMeta = {
  slug: "liquid-switch",
  name: "LiquidSwitch",
  title: "LiquidSnap Toggle",
  tagline: "A switch whose thumb pours from one side to the other.",
  description:
    "A real switch (button role=\"switch\") with controlled and uncontrolled state and form participation. When toggled, the thumb leads and a lagging tail follows; a gooey SVG filter joins the two so the thumb stretches into a drop, pinches off and is absorbed on the far side. The track colour pours with it. Under reduced motion it slides plainly; with motion off it snaps.",
  category: "inputs",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["switch", "toggle", "checkbox", "liquid", "goo", "fluid", "input", "form"],
  registryName: "liquid-switch",
  importPath: "@/components/ui/liquid-switch",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion"] },
  props: [
    { name: "checked", type: "boolean", default: "—", description: "Controlled state. Pair with onCheckedChange." },
    { name: "defaultChecked", type: "boolean", default: "false", description: "Initial state when uncontrolled." },
    { name: "onCheckedChange", type: "(checked: boolean) => void", default: "—", description: "Called with the next state on every toggle." },
    { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "40×22, 52×30 or 68×38 px." },
    { name: "viscosity", type: "number (0–1)", default: "0.6", description: "How much the thumb stretches and how long the tail lingers. 0 is a near-rigid slide, 1 is syrup." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced keeps a short slide without goo. off snaps instantly." },
    { name: "disabled", type: "boolean", default: "false", description: "Native disabled; no toggling, 50% opacity." },
    { name: "required", type: "boolean", default: "false", description: "Sets aria-required and the hidden checkbox's required attribute." },
    { name: "name", type: "string", default: "—", description: "Renders a hidden checkbox with this name so the switch submits with forms." },
    { name: "value", type: "string", default: '"on"', description: "Value submitted when checked." },
    { name: "colors", type: "{ trackOff?, trackOn?, thumb? }", default: "—", description: "Colour overrides, equivalent to the --ls-track-off, --ls-track-on and --ls-thumb variables." },
    { name: "…rest", type: "ButtonHTMLAttributes", default: "—", description: "Native button attributes: id, aria-label, aria-labelledby, aria-describedby, onFocus…" },
  ],
  cssVars: [
    { name: "--ls-track-off", description: "Track colour when unchecked", default: "#c9c6bf" },
    { name: "--ls-track-on", description: "Track colour when checked", default: "#141311" },
    { name: "--ls-thumb", description: "Thumb colour", default: "#ffffff" },
    { name: "--ls-ring", description: "Focus ring colour", default: "track-on colour" },
    { name: "--ls-ring-offset", description: "Focus ring offset colour (your page background)", default: "white" },
  ],
  examples: [
    {
      id: "basic",
      title: "With a label",
      description: "Label it like any form control. Click the label or the switch; Space and Enter toggle it from the keyboard.",
      code: `<label htmlFor="notify" className="flex items-center gap-3">
  <LiquidSwitch id="notify" defaultChecked />
  Email notifications
</label>`,
    },
    {
      id: "controlled",
      title: "Controlled",
      description: "Own the state and react to changes.",
      code: `const [on, setOn] = useState(false);

<LiquidSwitch checked={on} onCheckedChange={setOn} aria-label="Wi-Fi" />
<span>{on ? "Connected" : "Off"}</span>`,
    },
    {
      id: "sizes",
      title: "Sizes",
      description: "Three sizes; the goo scales with the thumb.",
      code: `<LiquidSwitch size="sm" aria-label="Small" />
<LiquidSwitch size="md" aria-label="Medium" defaultChecked />
<LiquidSwitch size="lg" aria-label="Large" />`,
    },
    {
      id: "colors",
      title: "Colours",
      description: "Props or CSS variables. The thumb can be any colour; keep contrast against both track colours.",
      code: `<LiquidSwitch defaultChecked colors={{ trackOn: "#1d2a6b", trackOff: "#cfd3e6", thumb: "#fff" }} />
<LiquidSwitch defaultChecked colors={{ trackOn: "#e34a1f", thumb: "#fff3ea" }} />
<LiquidSwitch defaultChecked colors={{ trackOn: "#1f7a4f", trackOff: "#2b2b2b", thumb: "#c8f55a" }} />`,
    },
    {
      id: "viscosity",
      title: "Viscosity",
      description: "From a near-rigid slide to syrup.",
      code: `<LiquidSwitch viscosity={0} aria-label="Rigid" />
<LiquidSwitch viscosity={0.6} aria-label="Default" />
<LiquidSwitch viscosity={1} aria-label="Syrup" />`,
    },
    {
      id: "form",
      title: "In a form",
      description: "With name it submits like a checkbox.",
      code: `<form onSubmit={(e) => { e.preventDefault(); alert([...new FormData(e.currentTarget)].join()); }}>
  <LiquidSwitch name="marketing" value="yes" aria-label="Marketing emails" />
  <button type="submit">Save</button>
</form>`,
    },
    {
      id: "states",
      title: "Disabled",
      description: "Both states, disabled.",
      code: `<LiquidSwitch disabled aria-label="Off, disabled" />
<LiquidSwitch disabled defaultChecked aria-label="On, disabled" />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`button role="switch"\` is the track. Inside it: an on-colour layer whose opacity follows the lead spring, and an SVG holding the thumb (an ellipse), a tail (a circle) and two decorative ellipses for sheen and contact shadow. With \`name\`, a visually hidden checkbox mirrors the state for form submission.

- **Toggle**: the target flips 0 ↔ 1. The thumb follows with a stiff spring, the tail with a soft one whose stiffness and damping fall as \`viscosity\` rises.
- **Pour**: while the two are apart the thumb stretches along the travel axis and the tail shrinks. The gooey filter (Gaussian blur, then an alpha threshold) merges them into a single drop with a thinning neck that pinches off as the tail is absorbed.
- **Track**: the on colour fades in with the lead spring, so the track "fills" in step with the thumb.
- \`data-state="checked|unchecked"\` and \`data-motion\` are exposed for styling and tests.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Colours come from \`--ls-track-off\`, \`--ls-track-on\` and \`--ls-thumb\`, set per instance with \`colors\` or globally in CSS on \`[data-slot="liquid-switch"]\`. The focus ring uses \`--ls-ring\` (defaults to the on colour) and \`--ls-ring-offset\` (set it to your page background).

\`size\` fixes the geometry; \`className\` composes with it for margins and layout. The sheen and contact shadow are intentionally subtle and not configurable; override the SVG with CSS if you need a flat thumb.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Native button with \`role="switch"\` and \`aria-checked\`; screen readers announce "switch, on/off".
- Label with \`<label htmlFor>\`, \`aria-label\` or \`aria-labelledby\`; the examples show all three patterns.
- Keyboard: Tab to focus, Space or Enter to toggle. Visible \`:focus-visible\` ring.
- \`disabled\` uses the native attribute; \`required\` sets \`aria-required\` and the hidden checkbox's \`required\`.
- Reduced motion removes the goo filter and tail; the thumb still slides briefly so the state change stays visible. \`motion="off"\` snaps.
- Smallest size is 22px tall; wrap it in a label with padding for a 44px touch target.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Nothing runs at rest. On toggle, Motion animates two springs for roughly 400–700 ms and the SVG filter rasterises a region about the size of the track (around 60×40 px at the default size). The filter is present in the DOM but idle when the springs are settled. Fifty switches on a page cost nothing until one is toggled.

The hidden checkbox is a plain input; no listeners are attached beyond the button's click.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- SVG \`feGaussianBlur\` + \`feColorMatrix\` gooey filters work in Chrome, Edge, Safari and Firefox. Safari renders the threshold slightly softer.
- Touch: a tap toggles; there is no drag-to-toggle yet.
- Server rendering is safe; the SVG renders at the resting position.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No drag gesture; toggling is click/tap/keyboard only.
- The goo is drawn inside the SVG only; it cannot pour outside the track.
- With very high \`viscosity\` and rapid repeated toggling, the tail can lag a full cycle behind; it always catches up.`,
    },
  ],
  sourceFiles: ["components/ui/liquid-switch.tsx", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. The SVG gooey-filter technique (blur + colour-matrix alpha threshold) is a widely documented public technique (Lucas Bebber, CSS-Tricks, 2015). No third-party code. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const liquidSwitchPlayground: PlaygroundDef = {
  initial: { defaultChecked: false, size: "md", viscosity: 0.6, disabled: false, "colors.trackOn": "", "colors.trackOff": "", "colors.thumb": "" },
  defaults: { defaultChecked: false, size: "md", viscosity: 0.6, disabled: false, motion: "auto", "colors.trackOn": "", "colors.trackOff": "", "colors.thumb": "" },
  controls: [
    { type: "boolean", prop: "defaultChecked", label: "Checked initially", group: "State" },
    { type: "boolean", prop: "disabled", label: "Disabled", group: "State" },
    { type: "select", prop: "size", label: "Size", group: "Appearance", options: [{ label: "Small", value: "sm" }, { label: "Medium", value: "md" }, { label: "Large", value: "lg" }] },
    { type: "color", prop: "colors.trackOn", label: "Track on", group: "Colours" },
    { type: "color", prop: "colors.trackOff", label: "Track off", group: "Colours" },
    { type: "color", prop: "colors.thumb", label: "Thumb", group: "Colours" },
    { type: "range", prop: "viscosity", label: "Viscosity", group: "Motion", min: 0, max: 1, step: 0.05 },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Syrup", values: { viscosity: 1, size: "lg" } },
    { name: "Rigid", values: { viscosity: 0 } },
    { name: "Ink on bone", values: { "colors.trackOn": "#141311", "colors.trackOff": "#e6e2d8", "colors.thumb": "#ffffff" } },
    { name: "Acid", values: { "colors.trackOn": "#1f7a4f", "colors.trackOff": "#2b2b2b", "colors.thumb": "#c8f55a", defaultChecked: true } },
  ],
};
