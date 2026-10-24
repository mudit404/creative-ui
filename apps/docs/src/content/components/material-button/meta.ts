import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const materialButtonMeta: ComponentMeta = {
  slug: "material-button",
  name: "MaterialButton",
  title: "Material Button",
  tagline: "A slab of goo that reaches for the pointer, grips it, and snaps back.",
  description:
    "A real <button> whose surface behaves like a material. Bring the pointer close and stretchy strands lunge out of the edge, web together and coil around the cursor. Pull away and they neck, snap and recoil. Hovering lifts the slab off the floor; pressing squashes it. Keyboard and touch users get a burst of strands as press feedback. Everything degrades to a well-styled button when motion is reduced or unavailable.",
  category: "buttons",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["venom", "goo", "tendrils", "strands", "symbiote", "button", "cta", "canvas", "physics", "magnetic"],
  registryName: "material-button",
  importPath: "@/components/ui/material-button",
  dependencies: {
    npm: ["motion", "@radix-ui/react-slot", "clsx", "tailwind-merge"],
    registry: ["utils", "use-reduced-motion", "use-strand-field", "strand-field", "strand-renderer", "pointer-field"],
  },
  props: [
    { name: "tone", type: '"ink" | "bone"', default: '"ink"', description: "Colour preset. ink is a jet-black slab for light surfaces, bone an off-white slab for dark ones." },
    { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "36, 48 or 60px tall. Strand thickness scales with size." },
    { name: "shape", type: '"pill" | "rounded"', default: '"pill"', description: "Fully rounded ends, or a rounded rectangle." },
    { name: "finish", type: '"silver" | "flat"', default: '"silver"', description: "Polished-metal gradient on text labels, or a flat label colour. Icon children always use the flat colour." },
    { name: "colors", type: "{ surface?, label?, goo? }", default: "—", description: "Colour overrides. Equivalent to setting --mb-surface, --mb-label and --mb-goo. goo defaults to surface." },
    { name: "reach", type: "number", default: "120", description: "Distance in px from the edge at which strands launch. The surface starts to lean and fizz at about 1.85× this distance." },
    { name: "tendrils", type: "number", default: "6", description: "Maximum simultaneous strands. Two launch at the edge of reach, more as the pointer gets closer." },
    { name: "intensity", type: "number (0–1)", default: "1", description: "Scales strand count, thickness and magnetism together. 0 disables strands entirely." },
    { name: "speed", type: "number", default: "1", description: "Time multiplier for lunges, snaps and recoil." },
    { name: "idle", type: "boolean", default: "true", description: "Small bursts of strands along the edge every ~2s while nobody is near. Paused off-screen and in hidden tabs." },
    { name: "lift", type: "number", default: "10", description: "Hover lift in px. Clamped to 4px under reduced motion." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced keeps a short lift and press but no strands. off disables all motion." },
    { name: "loading", type: "boolean", default: "false", description: "Shows a spinner, sets aria-busy and blocks activation while keeping the label in the accessible name." },
    { name: "disabled", type: "boolean", default: "false", description: "Native disabled. No strands, no lift, no activation." },
    { name: "asChild", type: "boolean", default: "false", description: "Render the child element (for example a Next.js Link) as the control. Its children become the label." },
    { name: "className", type: "string", default: "—", description: "Classes for the control itself." },
    { name: "wrapperClassName", type: "string", default: "—", description: "Classes for the outer inline-block wrapper, for layout (e.g. w-full)." },
    { name: "…rest", type: "ButtonHTMLAttributes", default: "—", description: "All native button attributes and handlers (onClick, type, form, aria-*)." },
  ],
  cssVars: [
    { name: "--mb-surface", description: "Slab colour", default: "#0b0b0c (ink)" },
    { name: "--mb-label", description: "Label colour; the silver finish derives its gradient from it", default: "#d9d9dc (ink)" },
    { name: "--mb-goo", description: "Strand colour", default: "same as surface" },
    { name: "--mb-sheen", description: "Highlight colour used by the rim light, glint and pointer sheen", default: "rgba(255,255,255,0.16)" },
    { name: "--mb-shade", description: "Bottom shading of the face", default: "rgba(0,0,0,0.5)" },
    { name: "--mb-shadow", description: "Floor shadow colour", default: "rgba(12,12,18,0.55)" },
    { name: "--mb-ring", description: "Focus ring colour", default: "same as surface" },
    { name: "--mb-ring-offset", description: "Focus ring offset colour (set to your page background)", default: "white" },
  ],
  examples: [
    {
      id: "basic",
      title: "Call to action",
      description: "The default: ink tone, silver label, full motion. Approach it slowly, hover, press, pull away.",
      code: `<MaterialButton size="lg">Let’s collaborate</MaterialButton>`,
    },
    {
      id: "sizes",
      title: "Sizes and shapes",
      description: "Three sizes, two shapes. Strand thickness and reach feel proportional at every size.",
      code: `<MaterialButton size="sm">Small</MaterialButton>
<MaterialButton size="md" shape="rounded">Rounded</MaterialButton>
<MaterialButton size="lg">Large</MaterialButton>`,
    },
    {
      id: "bone",
      title: "Bone tone on dark",
      description: "The off-white preset for dark surfaces. Shadows, sheen and strands all follow the tone.",
      code: `<div className="rounded-xl bg-neutral-950 p-12">
  <MaterialButton tone="bone">Start a project</MaterialButton>
</div>`,
    },
    {
      id: "icon",
      title: "With an icon",
      description: "Any children work. Icons use the flat label colour and inherit the button's gap.",
      code: `<MaterialButton>
  <ArrowIcon />
  Continue
</MaterialButton>`,
    },
    {
      id: "custom-colors",
      title: "Custom colours",
      description: "Pass colours as props, or set the CSS variables in a stylesheet for theming.",
      code: `<MaterialButton colors={{ surface: "#1d2a6b", label: "#f2f0ff" }}>
  Deep blue
</MaterialButton>
<MaterialButton colors={{ surface: "#e34a1f", label: "#fff3ea", goo: "#b23510" }}>
  Ember
</MaterialButton>`,
    },
    {
      id: "states",
      title: "Loading and disabled",
      description: "Both states drop the strands and the lift. Loading keeps the label in the accessible name.",
      code: `<MaterialButton loading>Saving</MaterialButton>
<MaterialButton disabled>Unavailable</MaterialButton>`,
    },
    {
      id: "link",
      title: "As a link",
      description: "asChild turns a Link into the control while keeping the material.",
      code: `<MaterialButton asChild>
  <Link href="/pricing">See pricing</Link>
</MaterialButton>`,
    },
    {
      id: "calm",
      title: "Calmer tuning",
      description: "Fewer, slower strands with a shorter reach for interfaces that need restraint.",
      code: `<MaterialButton reach={70} tendrils={3} intensity={0.6} speed={0.8} idle={false}>
  Subtle
</MaterialButton>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `The control is a native \`<button>\` (or your own element with \`asChild\`). Around it sit two floor shadows and a canvas overlay that bleeds beyond the button by the maximum strand length. The canvas is \`pointer-events: none\` and \`aria-hidden\`, so it never affects hit-testing, layout or the accessibility tree.

- **Awareness** (≈1.85× \`reach\`): the slab leans toward the pointer and tiny strings fizz along the facing edge.
- **Reach** (\`reach\`): strands launch one every 30–60ms. Two at the edge of reach, up to \`tendrils\` close in. Each lunges with a second-order spring, webs with its neighbours and coils around the pointer.
- **Hold**: strands conserve volume (longer means thinner) and creep under slow pulls. Fast pulls past 1.6× rest length, or past 1.35× \`reach\`, pinch off at the neck and recoil along their own path.
- **Hover**: the slab lifts (\`lift\`) and the contact shadow gives way to a soft drop shadow. A sheen follows the pointer across the face.
- **Press**: the slab squashes slightly and sinks. Keyboard activation and touch presses trigger a ring burst of strands.
- **Idle**: every 1.8–2.3s a few strands rise out of a new spot on the edge and sink back.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Use \`tone\` for the two built-in materials, \`colors\` for quick overrides, or the CSS variables for theming across an app. The variables are read from the wrapper element, so you can set them in a stylesheet with a selector like \`[data-slot="material-button"]\` or on any ancestor.

The strands are drawn on a canvas and cannot read CSS at paint time, so the component resolves \`--mb-goo\`, \`--mb-sheen\` and \`--mb-shadow\` with \`getComputedStyle\` whenever the button is measured. Change them with a class or inline style and they apply on the next resize or remount; the \`colors\` prop applies immediately.

\`className\` styles the control, \`wrapperClassName\` the inline-block wrapper (useful for \`w-full\`). The face background and inset bevel are inline styles that use the variables, so Tailwind utilities for padding, font and radius compose naturally. Avoid overriding \`background\` with a utility unless you also want to replace the material look.

Tune the physics with \`reach\`, \`tendrils\`, \`intensity\` and \`speed\`. For a restrained interface, start from the "Calm" preset in the playground.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Semantic \`<button type="button">\` by default; native attributes pass through, so \`type="submit"\`, \`form\`, \`aria-*\` and \`name\` all work.
- Keyboard: Tab focuses it, Enter and Space activate it. A visible focus ring appears for \`:focus-visible\` only. Keyboard activation plays the press squash and a strand burst, so keyboard users get the same feedback as pointer users.
- \`loading\` sets \`aria-busy="true"\` and disables the control while keeping the label in the accessible name. The spinner is \`aria-hidden\`.
- \`prefers-reduced-motion: reduce\` removes strands, idle bursts, the rim glint and most of the lift. The button remains fully usable. Force the behaviour with \`motion="reduced"\` or \`motion="off"\`.
- The canvas and decorative layers are \`aria-hidden\` and never receive pointer events.
- Touch targets: the smallest size is 36px tall; prefer \`md\` or \`lg\` for primary touch actions.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `The animation loop runs only while something is moving: when the pointer is within awareness, while strands exist, or during an idle burst. Otherwise no \`requestAnimationFrame\` is scheduled. A single shared \`pointermove\` listener serves every instance on the page; idle instances do one \`getBoundingClientRect\` per frame while the pointer moves, and nothing while it is still.

Instances pause when scrolled out of view (IntersectionObserver with a 64px margin) and when the tab is hidden. Canvas resolution is capped at 2× device pixel ratio. The physics uses fixed 120Hz substeps with a cap of 6 per frame, so long frames degrade gracefully instead of exploding.

Measured (24 Oct 2026, Apple Silicon laptop, Node 24): the simulation step plus building every canvas draw call for six held strands costs **≈0.09 ms per frame** with raster excluded (\`strand-field.bench.test.ts\`, about 720 context calls per frame). Rasterising those calls on a 2× DPR canvas is the larger share and depends on the GPU; in the docs playground on the same machine (Chromium, 2× DPR) the page held 60 fps with a longest frame of 18.4 ms while six strands were held. Measure in your own layout before relying on these numbers.

Slab lift, press and shadows are transforms and opacity driven by Motion springs. The rim glint is a CSS transform animation. Nothing animates layout properties.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- Requires Canvas 2D (every modern browser). No WebGL is used, so there is no context limit: dozens of instances on a page are fine.
- Touch devices get no hover strands (there is no hover). Presses trigger a ring burst, release lets it sink. Lift is skipped for touch.
- The silver label uses \`background-clip: text\`, supported everywhere the library targets (Chrome, Edge, Safari 16.4+, Firefox).
- \`color-mix()\` is used for derived tints; it needs Chrome 111+, Safari 16.2+ or Firefox 113+. Older browsers fall back to the raw label colour.
- Server rendering is safe: nothing touches \`window\` during render, and the reduced-motion hook is hydration-safe (false on the server, then the real value).`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- The strand canvas bleeds up to ~190px beyond the button (at the default reach). An ancestor with \`overflow: hidden\` will clip the strands. Place the button where the goo has room, or lower \`reach\`.
- Strands render beneath the button but above anything behind it, including neighbouring elements. Visually this reads as the goo lying on the page; it does not occlude text correctly if the button overlaps other content.
- The pointer coil draws around the OS cursor rather than replacing it. The reference effect morphs the cursor into a hand; that is out of scope for a drop-in component.
- Colour variables changed purely in CSS (no prop change) are picked up on resize or remount, not on the next frame.
- Only text children get the silver finish. Mixed children (icon + text) use the flat label colour.`,
    },
  ],
  sourceFiles: [
    "components/ui/material-button.tsx",
    "hooks/use-strand-field.ts",
    "hooks/use-reduced-motion.ts",
    "lib/strand-field.ts",
    "lib/strand-renderer.ts",
    "lib/pointer-field.ts",
    "lib/rounded-outline.ts",
    "lib/springs.ts",
  ],
  provenance:
    "Original implementation in TypeScript, Canvas 2D and Motion. The interaction is inspired by exteestudio's “Venom Button” demo (MIT licensed, a single-file WebGL2 ray marcher with Verlet tendrils). No code, shaders, fonts or cursor artwork from the reference are used. Smooth-min-style fillets and Rayleigh–Plateau beading are standard techniques. Runtime dependencies: motion (MIT), @radix-ui/react-slot (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const materialButtonPlayground: PlaygroundDef = {
  childrenProp: "children",
  initial: {
    children: "Let’s collaborate",
    tone: "ink",
    size: "lg",
    shape: "pill",
    finish: "silver",
    reach: 120,
    tendrils: 6,
    intensity: 1,
    speed: 1,
    idle: true,
    lift: 10,
    loading: false,
    disabled: false,
    "colors.surface": "",
    "colors.label": "",
    "colors.goo": "",
  },
  defaults: {
    tone: "ink",
    size: "md",
    shape: "pill",
    finish: "silver",
    reach: 120,
    tendrils: 6,
    intensity: 1,
    speed: 1,
    idle: true,
    lift: 10,
    loading: false,
    disabled: false,
    motion: "auto",
    "colors.surface": "",
    "colors.label": "",
    "colors.goo": "",
  },
  controls: [
    { type: "text", prop: "children", label: "Label", group: "Content" },
    { type: "select", prop: "tone", label: "Tone", group: "Appearance", options: [{ label: "Ink", value: "ink" }, { label: "Bone", value: "bone" }] },
    { type: "select", prop: "size", label: "Size", group: "Appearance", options: [{ label: "Small", value: "sm" }, { label: "Medium", value: "md" }, { label: "Large", value: "lg" }] },
    { type: "select", prop: "shape", label: "Shape", group: "Appearance", options: [{ label: "Pill", value: "pill" }, { label: "Rounded", value: "rounded" }] },
    { type: "select", prop: "finish", label: "Label finish", group: "Appearance", options: [{ label: "Silver", value: "silver" }, { label: "Flat", value: "flat" }] },
    { type: "color", prop: "colors.surface", label: "Surface colour", group: "Colours" },
    { type: "color", prop: "colors.label", label: "Label colour", group: "Colours" },
    { type: "color", prop: "colors.goo", label: "Strand colour", group: "Colours" },
    { type: "range", prop: "reach", label: "Reach", group: "Physics", min: 40, max: 220, step: 5, unit: "px" },
    { type: "range", prop: "tendrils", label: "Tendrils", group: "Physics", min: 0, max: 10, step: 1 },
    { type: "range", prop: "intensity", label: "Intensity", group: "Physics", min: 0, max: 1, step: 0.05 },
    { type: "range", prop: "speed", label: "Speed", group: "Physics", min: 0.3, max: 2.5, step: 0.1, unit: "×" },
    { type: "range", prop: "lift", label: "Hover lift", group: "Physics", min: 0, max: 24, step: 1, unit: "px" },
    { type: "boolean", prop: "idle", label: "Idle life", group: "Physics" },
    { type: "boolean", prop: "loading", label: "Loading", group: "State" },
    { type: "boolean", prop: "disabled", label: "Disabled", group: "State" },
  ],
  presets: [
    { name: "Studio default", values: {} },
    { name: "Calm", description: "Fewer, slower strands", values: { reach: 70, tendrils: 3, intensity: 0.6, speed: 0.8, idle: false } },
    { name: "Feral", description: "Everything up", values: { reach: 200, tendrils: 10, intensity: 1, speed: 1.6, lift: 16 } },
    { name: "Bone on dark", values: { tone: "bone", children: "Start a project" } },
    { name: "Ember", values: { "colors.surface": "#e34a1f", "colors.label": "#fff3ea", "colors.goo": "#b23510", children: "Ship it" } },
    { name: "Compact rounded", values: { size: "sm", shape: "rounded", children: "Add to cart", lift: 6 } },
  ],
};
