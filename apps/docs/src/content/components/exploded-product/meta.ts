import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const explodedProductMeta: ComponentMeta = {
  slug: "exploded-product",
  name: "ExplodedProduct",
  title: "Exploded Product",
  tagline: "Authored parts move apart along authored vectors; the parts list stays in charge.",
  description:
    "A poster and a semantic parts list render first. The model loads (a prepared GLB or a built Three.js scene), every part path resolves uniquely, rest transforms are snapshotted once, and each position is derived from rest + offset × progress, never accumulated. Selecting a part from the list highlights its mesh and shows its description; Assemble/Explode, a slider and view presets cover inspection without dragging. Without WebGL the poster and list remain and the controller still works.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["3d", "exploded view", "product", "parts", "three.js", "glb", "assembly", "explorer"],
  registryName: "exploded-product",
  importPath: "@/components/ui/exploded-product",
  dependencies: { npm: ["three", "motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "three-stage", "exploded-parts"] },
  props: [
    { name: "model", type: '{ kind: "url", src } | { kind: "scene", build: () => Object3D }', default: "—", description: "Required. A licensed, prepared glTF/GLB, or a builder for fixtures and procedural demos." },
    { name: "poster / alt", type: "string", default: "—", description: "Required fallback image and its text." },
    { name: "parts", type: "{ id, nodePath, label, description?, offset: [x, y, z] }[]", default: "—", description: "Required. Offsets are parent-local, in the asset's units. Node paths must resolve uniquely; nested part roots are rejected." },
    { name: "progress / defaultProgress / onProgressChange", type: "0–1 / (progress, source) => void", default: "0", description: "0 assembled, 1 fully offset. source is slider | button | keyboard." },
    { name: "selectedId / defaultSelectedId / onSelectedIdChange", type: "string | null / (id, reason) => void", default: "null", description: "Selection independent of the camera." },
    { name: "camera / views", type: "OrbitState / ViewPreset[]", default: "three-quarter view", description: "Authored default camera (yaw, pitch, distance, target) and labelled presets; distance limits derive from the default." },
    { name: "onAssetError / onReady", type: "callbacks", default: "—", description: "Structured diagnostics (load | parts | renderer) and the resolved part ids." },
    { name: "quality", type: '"auto" | "high" | "balanced" | "low"', default: '"auto"', description: "Device-pixel-ratio cap: 1.5 by default, 2 high, 1 low." },
    { name: "variant", type: '"linear" | "radial" | "inspection"', default: '"linear"', description: "Styling only; offsets are authored either way." },
    { name: "motion / durationScale", type: '"auto" | "reduced" | "off" / number', default: '"auto" / 1', description: "700 ms assemble/explode and 400 ms camera travel under full motion; reduced and off jump." },
    { name: "renderer", type: '"auto" | "none"', default: '"auto"', description: "none skips WebGL (tests, SSR previews): the poster, list and controller still work." },
    { name: "ref", type: "ExplodedProductHandle", default: "—", description: "{ root, focusPart(id), resetView() }." },
  ],
  cssVars: [
    { name: "--cui-explode-text", description: "Text colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-explode-selection", description: "Selected part accent, slider and focus rings", default: "light-dark(#1a6b45, #5fcf8f)" },
    { name: "--cui-explode-label", description: "Leader label background (its text is the inverse)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-explode-background", description: "Stage background", default: "light-dark(#e9e5dc, #2a2a27)" },
    { name: "--cui-explode-border", description: "Button and details-card border (decorative)", default: "light-dark(rgba(20,19,17,0.2), rgba(236,235,230,0.2))" },
    { name: "--cui-explode-error", description: "Diagnostics", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    {
      id: "speaker",
      title: "12-part desk speaker",
      description: "A procedural model with a nested Body group (parent-local offsets). Explode, select parts, use the view presets.",
      code: `<ExplodedProduct model={{ kind: "scene", build: buildSpeaker }} poster={poster} alt="Desk speaker" parts={SPEAKER_PARTS} views={views} />`,
    },
    {
      id: "missing",
      title: "Missing node map",
      description: "Two parts point at nodes that do not exist: the diagnostic names them, the rest explode normally.",
      code: `parts={[...SPEAKER_PARTS, { id: "ghost", nodePath: "Body/Ghost", … }]}`,
    },
    {
      id: "pair",
      title: "Two simultaneous instances",
      description: "Each instance owns its transforms and materials; exploding one leaves the other assembled.",
      code: `<ExplodedProduct … defaultProgress={1} /> <ExplodedProduct … />`,
    },
    {
      id: "fallback",
      title: "Static fallback",
      description: "renderer=\"none\" shows what users without WebGL get: poster, list, descriptions and working controls.",
      code: `<ExplodedProduct renderer="none" … />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (poster | loading | ready | fallback | error) and \`data-progress\`. The stage holds the poster image (always the accessible representation), a canvas, a DOM leader label for the selected part and status messages. Below: Assemble, an Assembly slider, Explode, view presets and Reset view. Beside: the parts list (buttons with \`aria-pressed\`, unmapped parts flagged) and the details card.

- **Loading**: \`loadModel\` → \`validateParts\` (unique paths, no ancestor/descendant roots) → per-instance material clones → \`snapshotRest\` once (C51-T03, C51-T06).
- **Progress**: a motion value tweens toward the committed progress (700 ms) and \`applyProgress\` sets every position from rest + offset × p; retargets reverse from the current visual state (C51-T01, C51-T02, C51-T05).
- **Renderer**: \`createStage\` is demand-rendered; frames are requested on progress, selection and camera changes only. Context loss shows the fallback; restore resumes the authoritative state.
- **Replacement**: a new model re-validates; a selection is cleared only when its id no longer exists (C51-T08).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The parts list and descriptions are DOM; the poster carries \`alt\`; the canvas is aria-hidden.
- Assemble/Explode buttons, the slider and view presets provide inspection without dragging (C51-T07).
- Unmapped parts carry the diagnostic as an accessible description.
- Reduced motion jumps to the chosen assembly state and camera without travel (C51-T09).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Demand rendering only; DPR capped at 1.5 by default. The fixture is 12 meshes; the brief's starting budget (50 parts, 150k triangles, 2K textures) is a profiling target, not a verified claim. Owned materials and (for URL models) geometry are disposed on unmount; built scenes are left to their owner (C51-T10).`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Translation offsets only; rotation offsets, sequenced steps and constraints are deferred.
- No raycast selection on the canvas yet; selection comes from the list (the enhancement the brief allows to come later).
- Models must be prepared with separate, named meshes; nothing is segmented automatically.`,
    },
  ],
  sourceFiles: ["components/ui/exploded-product.tsx", "lib/exploded-parts.ts", "lib/three-stage.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: Adam Naili's exploded-view tutorial (concept only; no code or assets). Three.js r180 (MIT) is the renderer; React Three Fiber is not used. Demo models are procedural (apps/docs/src/content/fixtures/three-models.ts). Contracts from Collection 02 brief #51. Runtime dependencies: three (MIT), motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const explodedProductPlayground: PlaygroundDef = {
  initial: { defaultProgress: 0, quality: "auto", durationScale: 1, variant: "linear" },
  defaults: { defaultProgress: 0, quality: "auto", durationScale: 1, variant: "linear", motion: "auto" },
  controls: [
    { type: "range", prop: "defaultProgress", label: "Initial progress", group: "State", min: 0, max: 1, step: 0.05 },
    { type: "select", prop: "quality", label: "Quality", group: "Rendering", options: [{ label: "Auto", value: "auto" }, { label: "High", value: "high" }, { label: "Balanced", value: "balanced" }, { label: "Low", value: "low" }] },
    { type: "range", prop: "durationScale", label: "Duration scale", group: "Motion", min: 0.25, max: 3, step: 0.25 },
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Linear", value: "linear" }, { label: "Radial", value: "radial" }, { label: "Inspection", value: "inspection" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Exploded, slow", values: { defaultProgress: 1, durationScale: 3 } },
  ],
};
