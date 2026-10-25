import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const particleMorphMeta: ComponentMeta = {
  slug: "particle-morph",
  name: "ParticleMorph",
  title: "Particle Morph",
  tagline: "A point cloud that morphs between named emblems, with the label and a flat image always truthful.",
  description:
    "Image masks or precomputed point sets become bounded, deterministically sampled point clouds rendered with Three.js Points. Requesting a target prepares it (decode, threshold, sample, Morton-order) behind an abortable cache, then morphs from the points' current positions along eased, bowed paths; a newer request interrupts cleanly and only the latest target ever completes. A fallback image and a text label for the requested emblem stay in the DOM, so a missing asset, a lost context or no WebGL at all still identifies the emblem. Reduced motion jumps straight to the target.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["particles", "morph", "points", "three.js", "emblem", "logo", "webgl", "hero"],
  registryName: "particle-morph",
  importPath: "@/components/ui/particle-morph",
  dependencies: { npm: ["three", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "three-stage", "point-targets"] },
  props: [
    { name: "targets", type: "MorphTarget[]", default: "—", description: "Required. { id, label, type: \"image\", src, fallback } or { id, label, type: \"points\", points, colors?, fallback }." },
    { name: "targetId / defaultTargetId", type: "string", default: "first target", description: "Controlled or initial target; requests are proposed through onTargetRequest." },
    { name: "pointCount", type: "number", default: "quality budget", description: "Fixed cloud size (high 24k, balanced 12k, low 4k). Every target is resampled to exactly this count." },
    { name: "duration / spread / seed", type: "ms / fraction / number", default: "900 / 0.12 / 1", description: "Morph time, mid-flight bow and the deterministic sampling seed." },
    { name: "colorMode / themeColor", type: '"source" | "theme" / string', default: '"source" / #141311', description: "Per-point source colours or one theme colour." },
    { name: "onTargetRequest / onTargetReady / onTargetError", type: "callbacks", default: "—", description: "Request (id), prepared (id), failed (id, message). Readiness is not completion." },
    { name: "onMorphComplete", type: "(id, revision) => void", default: "—", description: "The newest target finished its morph; stale morphs never complete." },
    { name: "quality", type: '"auto" | "high" | "balanced" | "low"', default: '"auto"', description: "Point budget and DPR cap." },
    { name: "decoder", type: "MaskDecoder", default: "browserMaskDecoder", description: "Injectable mask decoding (tests, workers)." },
    { name: "showControls", type: "boolean", default: "true", description: "Target buttons under the stage (aria-pressed for the requested one)." },
    { name: "variant", type: '"silhouette" | "volume" | "minimal"', default: '"silhouette"', description: "Point size and spread presets." },
    { name: "renderer", type: '"auto" | "none"', default: '"auto"', description: "none keeps the fallback image, label and controls without WebGL." },
    { name: "motion / durationScale", type: "shared", default: "auto / 1", description: "Reduced motion jumps to the target." },
    { name: "ref", type: "ParticleMorphHandle", default: "—", description: "{ root, requestTarget(id), focusControls(), getPositions() }." },
  ],
  cssVars: [
    { name: "--cui-particle-background", description: "Stage background", default: "#faf9f6" },
    { name: "--cui-particle-color", description: "Theme colour and selected control", default: "#141311" },
    { name: "--cui-particle-border", description: "Control borders", default: "rgba(20,19,17,0.25)" },
    { name: "--cui-particle-error", description: "Error text", default: "#c8360d" },
  ],
  examples: [
    { id: "emblems", title: "Four emblems", description: "SVG masks and a generated spiral. Readiness and completion are logged with revisions; click quickly to see only the latest target complete.", code: `<ParticleMorph targets={TARGETS} onMorphComplete={log} />` },
    { id: "rapid", title: "Rapid requests", description: "A button fires 20 alternating requests in 400 ms; the final target is the one shown and the only one that completes.", code: `ref.current.requestTarget(id) // ×20` },
    { id: "missing", title: "Missing asset", description: "The fourth target points at a file that does not exist: the label and fallback image show it, the last complete emblem stays, and the error is reported.", code: `{ id: "missing", type: "image", src: "/nope.png", fallback }` },
    { id: "fallback", title: "No renderer", description: "renderer=\"none\": the fallback image is the emblem; controls and callbacks still work.", code: `<ParticleMorph renderer="none" … />` },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (preparing | ready | fallback | error), \`data-target\` (requested) and \`data-shown\` (last completed). The stage holds the fallback \`<img>\` (hidden only while points are visible), the canvas and an error status. Below: the live label and target buttons.

- **Preparation**: \`sampleMask\` thresholds alpha, samples deterministically (mulberry32) and Morton-orders points so nearby pixels map to nearby indices; results are cached per \`id|count|seed\` and aborted on unmount or when superseded (C54-T02, C54-T08).
- **Morph**: start positions are a snapshot of the live buffer, so interrupting mid-flight continues from where the points are; \`evaluateMorph\` writes into the existing buffer with no allocation per frame (C54-T03, C54-T04).
- **Truth**: a stale morph never reports completion; readiness, completion and errors are separate (C54-T05).`,
    },
    { id: "accessibility", title: "Accessibility", body: `- The emblem is identified by the fallback image's alt and the visible label, not by the particles.\n- Controls are buttons with \`aria-pressed\`; \`focusControls()\` moves focus to them.\n- Reduced motion shows the target immediately and reports no fake progress (C54-T06, C54-T09).` },
    { id: "performance", title: "Performance", body: `Fixed point budget; all Float32Array buffers are preallocated once per count. Demand rendering: frames run only during a morph. Masks decode at ≤256 px. Textures/contexts are released on unmount.` },
    { id: "limitations", title: "Known limitations", body: `- No mesh-surface sampling, optimal assignment or depth sorting (deferred).\n- Text rasterisation is left to the host (provide an image mask).\n- One renderer per instance; several instances share nothing.` },
  ],
  sourceFiles: ["components/ui/particle-morph.tsx", "lib/point-targets.ts", "lib/three-stage.ts", "hooks/use-reduced-motion.ts"],
  provenance: "Original implementation. References studied: StringTune 3D and classic three.js particle morph demos (concepts only; no code). Three.js r180 (MIT). Contracts from Collection 02 brief #54. Runtime dependencies: three (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const particleMorphPlayground: PlaygroundDef = {
  initial: { variant: "silhouette", pointCount: 8000, duration: 900, spread: 0.12, colorMode: "source", quality: "auto", seed: 1 },
  defaults: { variant: "silhouette", duration: 900, spread: 0.12, colorMode: "source", quality: "auto", seed: 1, motion: "auto", showControls: true },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Silhouette", value: "silhouette" }, { label: "Volume", value: "volume" }, { label: "Minimal", value: "minimal" }] },
    { type: "range", prop: "pointCount", label: "Points", min: 1000, max: 24000, step: 1000, group: "Rendering" },
    { type: "range", prop: "duration", label: "Duration", min: 200, max: 2400, step: 100, unit: "ms", group: "Motion" },
    { type: "range", prop: "spread", label: "Spread", min: 0, max: 0.5, step: 0.02, group: "Motion" },
    { type: "range", prop: "seed", label: "Seed", min: 1, max: 9, step: 1, group: "Rendering" },
    { type: "select", prop: "colorMode", label: "Colour", group: "Rendering", options: [{ label: "Source", value: "source" }, { label: "Theme", value: "theme" }] },
    { type: "select", prop: "quality", label: "Quality", group: "Rendering", options: [{ label: "Auto", value: "auto" }, { label: "High", value: "high" }, { label: "Balanced", value: "balanced" }, { label: "Low", value: "low" }] },
  ],
  presets: [{ name: "Default", values: {} }, { name: "Theme minimal", values: { variant: "minimal", colorMode: "theme" } }],
};
