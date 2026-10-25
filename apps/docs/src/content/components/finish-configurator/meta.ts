import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const finishConfiguratorMeta: ComponentMeta = {
  slug: "finish-configurator",
  name: "FinishConfigurator",
  title: "Finish Configurator",
  tagline: "Real finishes on named parts, with rules that explain themselves.",
  description:
    "Option groups render as radio groups with text names, swatches and unavailable reasons before the stage loads. A choice is checked synchronously against availability and declared requires/excludes rules (plus your own validator) before it is proposed; a controlled host selection stays authoritative. Allowlisted material parameters are applied to per-instance material clones, textures load behind generation ids so a late finish never overwrites a newer one, and the previous valid surface stays while a new one prepares. Reset returns to the declared default. Price, stock and purchase are never fabricated.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["3d", "configurator", "finish", "material", "colour", "product", "three.js", "swatch", "commerce"],
  registryName: "finish-configurator",
  importPath: "@/components/ui/finish-configurator",
  dependencies: { npm: ["three", "motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "three-stage", "finish-options"] },
  props: [
    { name: "model / poster / description", type: "ModelSource / string / string", default: "—", description: "Required prepared product assets." },
    { name: "groups", type: "{ id, label, options: { id, name, targets, material, thumbnail?, available?, unavailableReason?, requires?, excludes?, image? }[] }[]", default: "—", description: "Required. targets are mesh or material names; material is { color, roughness, metalness, map } (allowlisted)." },
    { name: "selection / defaultSelection", type: "Record<groupId, optionId>", default: "—", description: "defaultSelection is required and is what Reset returns to." },
    { name: "validateSelection", type: "(candidate, change) => boolean | { allowed, reason? }", default: "—", description: "Host rule after structural checks; server validation stays separate." },
    { name: "onSelectionChange", type: "(selection, { groupId, optionId, reason, requestId }) => void", default: "—", description: "Semantic configuration proposal/update." },
    { name: "configurationKey", type: "string", default: "—", description: "Host-supplied identifier shown with the selection; never inferred from colour." },
    { name: "textureLoader", type: "(url, signal) => Promise<Texture>", default: "TextureLoader", description: "Injectable loader (tests, caching)." },
    { name: "onAssetError / onVisualReady", type: "callbacks", default: "—", description: "load | renderer | texture diagnostics; visual readiness is not purchase confirmation." },
    { name: "quality / camera / views", type: "various", default: "auto / three-quarter / []", description: "DPR cap, authored camera and labelled presets." },
    { name: "variant", type: '"color" | "material" | "variants"', default: '"material"', description: "Styling only." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "220 ms colour blend under full motion; otherwise instant." },
    { name: "renderer", type: '"auto" | "none"', default: '"auto"', description: "none skips WebGL: options, rules and the summary still work." },
    { name: "ref", type: "FinishConfiguratorHandle", default: "—", description: "{ root, focusOption(groupId, optionId), resetView() }." },
  ],
  cssVars: [
    { name: "--cui-finish-text", description: "Text colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-finish-swatch-border", description: "Option and button border (decorative; the selected option uses --cui-finish-selected)", default: "light-dark(rgba(20,19,17,0.2), rgba(236,235,230,0.2))" },
    { name: "--cui-finish-selected", description: "Selected option border and ring, focus rings", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-finish-unavailable", description: "Unavailable/incompatible text and flags", default: "light-dark(#b8310c, #ff8a65)" },
    { name: "--cui-finish-stage", description: "Stage background", default: "light-dark(#e9e5dc, #2a2a27)" },
  ],
  examples: [
    {
      id: "chair",
      title: "Three groups with dependent options",
      description: "Steel trim requires a walnut or black shell; velvet excludes brass; matte black is out of stock. Each refusal explains itself.",
      code: `<FinishConfigurator model={{ kind: "scene", build: buildChair }} groups={groups} defaultSelection={{ shell: "oak", trim: "brass", fabric: "linen" }} onSelectionChange={log} />`,
    },
    {
      id: "slow",
      title: "Two slow textures",
      description: "Textures take 2 s: pick Leather, then quickly Canvas; the late Leather texture is discarded and Canvas wins.",
      code: `<FinishConfigurator textureLoader={slowLoader} groups={textured} … />`,
    },
    {
      id: "pair",
      title: "Two simultaneous instances",
      description: "Different selections, no cache contamination.",
      code: `<FinishConfigurator … defaultSelection={a} /> <FinishConfigurator … defaultSelection={b} />`,
    },
    {
      id: "fallback",
      title: "GPU-disabled fallback",
      description: "renderer=\"none\": the option image for the selected shell, the accepted option ids and the configuration key.",
      code: `<FinishConfigurator renderer="none" configurationKey="CHAIR-OAK-BRASS-LINEN" … />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (poster | loading | ready | preparing | fallback | error). The stage holds the poster (or the selected option's image in the fallback), the canvas and a "Loading <finish>…" badge. Beside: one \`fieldset\` per group with the selected name, a flag when the selection is no longer available, a \`radiogroup\` of options, Reset, a status and a "Selected: …" summary.

- **Rules**: \`checkCandidate\` rejects unknown, unavailable, requires-violating and excludes-violating options with a reason before any request; \`validateSelection\` runs last (C53-T02).
- **Painting**: \`sanitizeMaterialParams\` allowlists colour, roughness, metalness and map; targets map mesh/material names to per-instance clones (C53-T01, C53-T04). Colour blends 220 ms under full motion.
- **Textures**: each target keeps a generation; a resolved texture is applied only if its generation is current, otherwise disposed (C53-T03). Failures keep the last visual and report (C53-T08).
- **Availability**: a selected option that becomes unavailable stays selected and flagged; nothing is substituted (C53-T05). Reset reproduces \`defaultSelection\` (C53-T06).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Options are \`role="radio"\` buttons with text names; blocked options carry the reason as an accessible description and a textual badge (unavailable / incompatible), not colour alone.
- Keyboard and tap select every available option (C53-T07); the poster carries the description.
- The fallback summary lists the accepted option ids and the host key (C53-T09); no price, stock or purchase text is ever generated (C53-T10).
- A visible disclaimer states that display appearance varies.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Demand rendering; textures are loaded once per selection change and disposed when superseded. Material clones are per instance and disposed on unmount; immutable geometry of built scenes is left to its owner.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- glTF material variants (KHR_materials_variants) are not applied yet; the variants styling is cosmetic.
- No AR hand-off, pricing or cart integration (deferred by the brief).
- Textures are not reference-counted across instances.`,
    },
  ],
  sourceFiles: ["components/ui/finish-configurator.tsx", "lib/finish-options.ts", "lib/three-stage.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. References studied: Kyle Wetton's 3D model customiser tutorial and model-viewer's scene-graph examples (concepts only; no code). Three.js r180 (MIT); model-viewer is not used. Contracts from Collection 02 brief #53. Runtime dependencies: three (MIT), motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const finishConfiguratorPlayground: PlaygroundDef = {
  initial: { variant: "material", quality: "auto" },
  defaults: { variant: "material", quality: "auto", motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Material", value: "material" }, { label: "Color", value: "color" }, { label: "Variants", value: "variants" }] },
    { type: "select", prop: "quality", label: "Quality", group: "Rendering", options: [{ label: "Auto", value: "auto" }, { label: "High", value: "high" }, { label: "Low", value: "low" }] },
  ],
  presets: [{ name: "Default", values: {} }],
};
