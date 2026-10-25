import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const cutawayViewerMeta: ComponentMeta = {
  slug: "cutaway-viewer",
  name: "CutawayViewer",
  title: "Cutaway Viewer",
  tagline: "Clip a real model with a plane and show the cut honestly.",
  description:
    "An axis selector, a depth control and named presets drive one clipping plane across the model-local bounding box. The removed half is absent, not masked; meshes the asset declares closed and opaque get a flat cap on the cut surface (the Three.js stencil technique), everything else is clipped uncapped with a visible warning. Axis changes update the plane in place and reuse the stencil helpers. Without WebGL the poster (or a sectional poster) and the explanations remain.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["3d", "cutaway", "section", "clipping", "stencil", "three.js", "inspector", "slice"],
  registryName: "cutaway-viewer",
  importPath: "@/components/ui/cutaway-viewer",
  dependencies: { npm: ["three", "motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "three-stage", "clip-plane"] },
  props: [
    { name: "model / poster / description", type: "ModelSource / string / string", default: "—", description: "Required. The source geometry must include the interior being shown." },
    { name: "axis / defaultAxis", type: '"x" | "y" | "z"', default: '"y"', description: "Model-local clipping orientation." },
    { name: "offset / defaultOffset", type: "−1…1", default: "0", description: "Position across the model-local bounds on that axis." },
    { name: "enabled / defaultEnabled", type: "boolean", default: "false", description: "Uncut until enabled; any depth change enables." },
    { name: "invert / defaultInvert", type: "boolean", default: "false", description: "Which half is retained." },
    { name: "capMode", type: '"auto" | "off" | "required"', default: '"auto"', description: "required disables the cut visibly when a mesh cannot be capped." },
    { name: "presets", type: "{ id, label, axis, offset, invert?, description? }[]", default: "[]", description: "Named slices with explanatory text." },
    { name: "onSliceChange", type: "(slice, source) => void", default: "—", description: "{ axis, offset, invert, enabled, localCut, plane: { normal, constant } }." },
    { name: "onAssetWarning", type: "(warnings) => void", default: "—", description: "uncapped | cap-required | load | renderer, with unsupported node names." },
    { name: "showGuide / quality / camera / views / sectionPoster", type: "various", default: "true / auto / three-quarter / [] / —", description: "Translucent plane guide, DPR cap, camera and presets, optional sectional poster for the fallback." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "260 ms plane tween under full motion only; labels never tween through fabricated values." },
    { name: "renderer", type: '"auto" | "none"', default: '"auto"', description: "none skips WebGL." },
    { name: "ref", type: "CutawayViewerHandle", default: "—", description: "{ root, resetView() }." },
  ],
  cssVars: [
    { name: "--cui-cut-cap", description: "Cap colour (Three.js material) and slider accent; not scheme-aware", default: "#ff4d1c" },
    { name: "--cui-cut-guide", description: "Guide plane colour (set in the material); not scheme-aware", default: "#1f7a4f" },
    { name: "--cui-cut-text", description: "Text", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-cut-background", description: "Stage background", default: "light-dark(#e9e5dc, #2a2a27)" },
    { name: "--cui-cut-border", description: "Axis group frame and button outlines (decorative)", default: "light-dark(rgba(20,19,17,0.25), rgba(236,235,230,0.25))" },
    { name: "--cui-cut-boundary", description: "Depth value field outline", default: "light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45))" },
    { name: "--cui-cut-focus", description: "Focus ring and active axis fill", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-cut-warn", description: "Warnings", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    {
      id: "layered",
      title: "Closed layered box with real inner objects",
      description: "Three authored slice presets with descriptions; every mesh is declared closed, so caps are drawn.",
      code: `<CutawayViewer model={{ kind: "scene", build: buildLayeredBox }} presets={presets} poster={poster} description="A layered box" />`,
    },
    {
      id: "open",
      title: "Open mesh",
      description: "The shell is not declared closed: the cut shows no cap for it and the warning names the node.",
      code: `<CutawayViewer model={{ kind: "scene", build: () => buildLayeredBox({ open: true }) }} … />`,
    },
    {
      id: "glass",
      title: "Transparent mesh with capMode=\"required\"",
      description: "A transparent shell cannot be capped: with capMode required the cut is disabled and explained.",
      code: `<CutawayViewer capMode="required" model={{ kind: "scene", build: () => buildLayeredBox({ glass: true }) }} … />`,
    },
    {
      id: "fallback",
      title: "Static fallback",
      description: "No renderer: sectional poster, controls with their explanation, and the legend.",
      code: `<CutawayViewer renderer="none" sectionPoster={section} … />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\`, \`data-axis\`, \`data-offset\`, \`data-enabled\`, \`data-invert\` and \`data-capped\`. The stage holds the poster, canvas and a legend line ("Interior detail comes from the supplied model"). Controls: Cut enabled, Keep other half, an Axis group, −/slider/+ with a numeric field, a readout of the model-local cut, presets, views and Reset.

- **Bounds**: \`computeLocalBounds\` unions every mesh box in the model's local space; offset −1/0/1 maps to min/mid/max (C52-T01, C52-T09).
- **Plane**: \`planeFor\` builds the world plane through the model matrix; invert flips the normal, never the model (C52-T02). One \`Plane\` object is updated in place and shared by all owned materials (C52-T05).
- **Caps**: per supported mesh, back/front stencil helper meshes follow the mesh; one cap plane draws where the stencil is non-zero (Three.js technique). Unsupported meshes (not declared closed, transparent, skinned) are reported and left uncapped (C52-T04, C52-T08).
- **Presets** reproduce axis/offset/invert deterministically and show their description (C52-T06).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Every slice is reachable with buttons, the slider and numeric entry (C52-T07); axis buttons use \`aria-pressed\`.
- The readout and a hidden live region state the cut in model units; nothing tweens through fabricated numbers.
- Warnings are a \`role="note"\`; the poster carries the description.
- Reduced motion jumps the plane; static content never depends on the canvas (C52-T10).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Demand rendering; the cap adds two stencil passes per supported mesh plus one cap draw, created once at load. Profiled with the 5-mesh fixture; larger assets should be measured. Owned materials, helpers and guide are disposed on unmount.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Axis-aligned planes only; free rotation, multiple slices and exploded composition are deferred.
- Watertightness is declared by the asset (\`userData.closed\`), not verified; a wrong declaration produces a wrong cap, which is why unknown meshes stay uncapped.
- Offsets are dimensionless; real-world distances need a host-supplied scale.`,
    },
  ],
  sourceFiles: ["components/ui/cutaway-viewer.tsx", "lib/clip-plane.ts", "lib/three-stage.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: the Three.js stencil clipping example (technique; the official example's approach to stencil caps is followed, no code copied). Three.js r180 (MIT). Contracts from Collection 02 brief #52 and WCAG 2.2 SC 2.5.7. Runtime dependencies: three (MIT), motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const cutawayViewerPlayground: PlaygroundDef = {
  initial: { defaultAxis: "y", defaultOffset: 0.2, defaultEnabled: true, defaultInvert: false, capMode: "auto", showGuide: true, quality: "auto" },
  defaults: { defaultAxis: "y", defaultOffset: 0, defaultEnabled: false, defaultInvert: false, capMode: "auto", showGuide: true, quality: "auto", motion: "auto" },
  controls: [
    { type: "select", prop: "defaultAxis", label: "Default axis", group: "Slice", options: [{ label: "X", value: "x" }, { label: "Y", value: "y" }, { label: "Z", value: "z" }] },
    { type: "range", prop: "defaultOffset", label: "Offset", group: "Slice", min: -1, max: 1, step: 0.05 },
    { type: "boolean", prop: "defaultEnabled", label: "Enabled", group: "Slice" },
    { type: "boolean", prop: "defaultInvert", label: "Keep other half", group: "Slice" },
    { type: "select", prop: "capMode", label: "Cap mode", group: "Caps", options: [{ label: "Auto", value: "auto" }, { label: "Off", value: "off" }, { label: "Required", value: "required" }] },
    { type: "boolean", prop: "showGuide", label: "Show guide", group: "Caps" },
    { type: "select", prop: "quality", label: "Quality", group: "Rendering", options: [{ label: "Auto", value: "auto" }, { label: "High", value: "high" }, { label: "Low", value: "low" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Uncapped reveal", values: { capMode: "off", defaultAxis: "x", defaultOffset: 0 } },
  ],
};
