import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const fieldMagnetMeta: ComponentMeta = {
  slug: "field-magnet",
  name: "FieldMagnet",
  title: "Field Magnet",
  tagline: "A primitive that pulls any element toward a nearby pointer, on springs.",
  description:
    "Wrap a button, link, icon or card and it leans toward the pointer as it approaches, settles back when it leaves, and never changes layout. The outer frame stays put as the measurement anchor; the inner element translates and scales with springs. Children keep their own semantics. Purely decorative, so it switches itself off under reduced motion and on touch.",
  category: "primitives",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["magnetic", "magnet", "pointer", "hover", "cursor", "attract", "primitive", "parallax"],
  registryName: "field-magnet",
  importPath: "@/components/ui/field-magnet",
  dependencies: {
    npm: ["motion", "@radix-ui/react-slot", "clsx", "tailwind-merge"],
    registry: ["utils", "use-reduced-motion", "use-magnetic-field", "magnetic-field", "pointer-field", "springs"],
  },
  props: [
    { name: "radius", type: "number", default: "120", description: "Distance in px from the element's edge at which the pull begins. Proximity eases from 0 at the edge of the field to 1 at the element." },
    { name: "strength", type: "number (0–1)", default: "0.35", description: "Fraction of the pointer's offset from the centre that the element follows." },
    { name: "maxOffset", type: "number", default: "24", description: "Cap on the displacement vector in px." },
    { name: "innerStrength", type: "number", default: "0", description: "Extra pull applied to the children relative to the frame, for a parallax feel (0.5 moves the content 50% further)." },
    { name: "axis", type: '"both" | "x" | "y"', default: '"both"', description: "Restrict movement to one axis." },
    { name: "scale", type: "number", default: "1", description: "Scale reached at full proximity (1.05 is a gentle lift)." },
    { name: "spring", type: '"soft" | "snappy" | "stiff" | SpringOptions', default: '"snappy"', description: "Spring preset or a Motion SpringOptions object." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. The pull is decorative, so reduced and off both disable it." },
    { name: "disabled", type: "boolean", default: "false", description: "Switch the pull off without changing markup." },
    { name: "asChild", type: "boolean", default: "false", description: "Use the child element as the moving element (no extra span). innerStrength is ignored." },
    { name: "display", type: '"inline-block" | "block"', default: '"inline-block"', description: "Display of the static frame." },
    { name: "className", type: "string", default: "—", description: "Classes for the static frame." },
    { name: "…rest", type: "HTMLAttributes<HTMLSpanElement>", default: "—", description: "Native attributes for the frame." },
  ],
  cssVars: [],
  examples: [
    {
      id: "basic",
      title: "Magnetic button",
      description: "The common case: a call to action that leans into the pointer.",
      code: `<FieldMagnet>
  <button className="rounded-full bg-[light-dark(#141311,#ecebe6)] px-6 py-3 text-[light-dark(#f3f1ec,#141311)]">Hire us</button>
</FieldMagnet>`,
    },
    {
      id: "parallax",
      title: "Frame and content parallax",
      description: "innerStrength moves the label a little further than the frame, so the button feels like it has depth.",
      code: `<FieldMagnet innerStrength={0.6} scale={1.04} radius={140}>
  <button className="rounded-full border border-[light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45))] px-6 py-3">Get started</button>
</FieldMagnet>`,
    },
    {
      id: "icons",
      title: "A row of icons",
      description: "Independent fields per element. The shared pointer listener keeps the cost flat however many there are.",
      code: `{icons.map((Icon) => (
  <FieldMagnet key={Icon.name} radius={80} strength={0.5} maxOffset={12} spring="soft">
    <a href="#" aria-label={Icon.name} className="rounded-full bg-[light-dark(#141311,#ecebe6)] p-3 text-[light-dark(#f3f1ec,#141311)]"><Icon /></a>
  </FieldMagnet>
))}`,
    },
    {
      id: "aschild",
      title: "asChild with a link",
      description: "The anchor itself becomes the moving element.",
      code: `<FieldMagnet asChild radius={100}>
  <Link href="/pricing" className="text-[light-dark(#141311,#ecebe6)] underline underline-offset-4">See pricing</Link>
</FieldMagnet>`,
    },
    {
      id: "axis",
      title: "One axis, stiff spring",
      description: "Useful for horizontal nav items that should slide, not float.",
      code: `<FieldMagnet axis="x" strength={0.5} maxOffset={10} spring="stiff">
  <span className="px-4 py-2 text-[light-dark(#141311,#ecebe6)]">Products</span>
</FieldMagnet>`,
    },
    {
      id: "composed",
      title: "Composed with MaterialButton",
      description: "Primitives compose: the goo button inside a magnetic field.",
      code: `<FieldMagnet radius={160} strength={0.2} maxOffset={14}>
  <MaterialButton size="lg">Let’s collaborate</MaterialButton>
</FieldMagnet>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `Two elements: a static **frame** (\`span\`, \`data-slot="field-magnet"\`) and a **moving** element inside it (a span, or your child with \`asChild\`). The frame is measured with \`getBoundingClientRect\`; because it never moves, measurements never feed back into the displacement.

- Outside \`radius\`: nothing happens, no frames are scheduled.
- Inside the field: proximity eases from 0 (field edge) to 1 (element edge and inside). Displacement = (pointer − centre) × \`strength\` × proximity, capped at \`maxOffset\`. Optionally restricted to one axis.
- The displacement, the proximity-driven \`scale\` and the optional inner parallax are Motion springs, so leaving the field springs back with the same feel.
- The frame exposes \`data-active="true|false"\` while the pointer is in or out of the field, for styling or tests.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `There are no visual styles of its own: style the child. Use \`className\` on the frame for layout (\`display="block"\` + \`className="w-full"\` for full-width cards). The three spring presets cover most cases; pass a Motion \`SpringOptions\` object for anything else.

Tune the feel with \`radius\` (how early it notices), \`strength\` (how eagerly it follows), \`maxOffset\` (how far it is allowed to go) and \`innerStrength\` (parallax between frame and content). Keep \`maxOffset\` small for inline text and larger for isolated calls to action.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The primitive adds no semantics and removes none; the child's role, focus and activation are untouched.
- The pull is decorative, so \`prefers-reduced-motion\` disables it entirely (\`motion="reduced"\` and \`motion="off"\` behave the same).
- Keyboard focus does not move the element; focus rings stay where the user expects them.
- Touch pointers are ignored: there is no hover to react to, and shifting a target under a finger would hurt tap accuracy.
- Displacement never changes layout, so nothing reflows and surrounding text does not shift.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `No animation loop of its own. One shared window \`pointermove\` listener serves every instance; each visible instance does at most one \`getBoundingClientRect\` per animation frame while the pointer moves, and nothing while it is still. Motion runs the springs and stops them when settled. Instances outside the viewport (IntersectionObserver) skip measurement.

Fifty magnets on a page cost fifty rect reads per frame of pointer movement, which browsers batch; no layout is written between reads.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- Works everywhere Motion does (all modern browsers). Transforms only.
- Touch and pen "coarse" pointers are ignored by design.
- Server rendering is safe; the element renders at rest and the field attaches after hydration.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- \`asChild\` requires a single element child that forwards \`style\` and \`ref\`; \`innerStrength\` is ignored in that mode.
- A transformed ancestor with \`will-change\` or a scaled parent can make the measured box differ from the painted one; keep the frame unscaled.
- Overlapping fields each react independently; there is no arbitration between neighbours.`,
    },
  ],
  sourceFiles: [
    "components/ui/field-magnet.tsx",
    "hooks/use-magnetic-field.ts",
    "lib/magnetic-field.ts",
    "lib/pointer-field.ts",
    "lib/springs.ts",
  ],
  provenance:
    "Original implementation. The magnetic-button interaction is a widely used pattern (seen across many agency sites); no third-party code is used. Runtime dependencies: motion (MIT), @radix-ui/react-slot (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const fieldMagnetPlayground: PlaygroundDef = {
  childrenProp: "children",
  initial: {
    children: "Hire us",
    radius: 120,
    strength: 0.35,
    maxOffset: 24,
    innerStrength: 0,
    axis: "both",
    scale: 1,
    spring: "snappy",
    disabled: false,
  },
  defaults: {
    radius: 120,
    strength: 0.35,
    maxOffset: 24,
    innerStrength: 0,
    axis: "both",
    scale: 1,
    spring: "snappy",
    disabled: false,
    motion: "auto",
  },
  controls: [
    { type: "text", prop: "children", label: "Button label", group: "Content" },
    { type: "range", prop: "radius", label: "Radius", group: "Field", min: 20, max: 300, step: 5, unit: "px" },
    { type: "range", prop: "strength", label: "Strength", group: "Field", min: 0, max: 1, step: 0.05 },
    { type: "range", prop: "maxOffset", label: "Max offset", group: "Field", min: 0, max: 80, step: 1, unit: "px" },
    { type: "range", prop: "innerStrength", label: "Inner parallax", group: "Field", min: 0, max: 1.5, step: 0.05 },
    { type: "select", prop: "axis", label: "Axis", group: "Field", options: [{ label: "Both", value: "both" }, { label: "X only", value: "x" }, { label: "Y only", value: "y" }] },
    { type: "range", prop: "scale", label: "Scale at proximity", group: "Motion", min: 0.9, max: 1.3, step: 0.01, unit: "×" },
    { type: "select", prop: "spring", label: "Spring", group: "Motion", options: [{ label: "Soft", value: "soft" }, { label: "Snappy", value: "snappy" }, { label: "Stiff", value: "stiff" }] },
    { type: "boolean", prop: "disabled", label: "Disabled", group: "State" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Floaty", values: { radius: 200, strength: 0.25, maxOffset: 40, spring: "soft", scale: 1.06 } },
    { name: "Tight", values: { radius: 60, strength: 0.6, maxOffset: 10, spring: "stiff" } },
    { name: "Depth", values: { innerStrength: 0.7, scale: 1.04, radius: 150 } },
    { name: "Slide (x)", values: { axis: "x", strength: 0.5, maxOffset: 14, spring: "stiff" } },
  ],
};
