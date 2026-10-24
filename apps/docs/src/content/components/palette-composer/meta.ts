import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const paletteComposerMeta: ComponentMeta = {
  slug: "palette-composer",
  name: "PaletteComposer",
  title: "Palette Composer",
  tagline: "Pull an editable palette out of an image, locally, and export it as CSS.",
  description:
    "Choose a local image (or a CORS-enabled URL): it is decoded into a bounded sampling bitmap, colours are extracted on the client, and six stable slots fill with the result while small discs travel from the image into the tiles. Slots can be edited (validated, committed once), locked (surviving the next extraction) and exported as sanitised CSS variables. A newer source supersedes an older request so stale results never land; errors keep the last palette; nothing is uploaded anywhere.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["palette", "colour", "color", "extract", "swatch", "theme", "brand", "image", "css variables"],
  registryName: "palette-composer",
  importPath: "@/components/ui/palette-composer",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "palette-extract"] },
  props: [
    { name: "source / defaultSource / onSourceChange", type: "PaletteSource | null", default: "null", description: "{ kind: \"file\", file, revision, alt? } or { kind: \"url\", url, revision, alt? }. The built-in file input and URL field propose sources through onSourceChange." },
    { name: "palette / defaultPalette / onPaletteChange", type: "Swatch[] / (palette, meta) => void", default: "[]", description: "Swatch = { id, color (#rrggbb | null), locked, label?, origin }. meta.reason is extract | edit | lock | unlock | clear." },
    { name: "decoder", type: "Decoder", default: "browserDecoder", description: "(input, limits, signal) => Promise<DecodedPixels>. Inject pixel fixtures in tests; the default decodes with an Image and samples through Canvas 2D." },
    { name: "extractor", type: "Extractor", default: "defaultExtractor", description: "(pixels + count + alphaThreshold, signal) => Promise<ExtractedColor[]>. Plug node-vibrant or a worker here." },
    { name: "count", type: "number", default: "6", description: "Number of slots." },
    { name: "sampleMaxSide", type: "number", default: "256", description: "Longest side of the sampling bitmap." },
    { name: "maxFileBytes / maxPixels", type: "number", default: "20 MiB / 24 000 000", description: "Guardrails checked separately; failures surface as typed errors." },
    { name: "alphaThreshold", type: "number (0–1)", default: "0.5", description: "Pixels below this alpha are ignored." },
    { name: "onExtractionError", type: "(error: { reason, message }) => void", default: "—", description: "reason is type | size | decode | cors | network | algorithm | aborted." },
    { name: "onExtractionStateChange", type: "(state) => void", default: "—", description: "empty | decoding | extracting | ready | error. Never a fabricated percentage." },
    { name: "exportPrefix", type: "string", default: '"palette"', description: "Sanitised to [a-z0-9-] for CSS variable names." },
    { name: "slotLabels", type: "string[]", default: "—", description: "Named slots (brand variant); used as CSS suffixes." },
    { name: "variant", type: '"harvest" | "editor" | "brand"', default: '"harvest"', description: "Image-led, compact editor with the export open, or named brand slots." },
    { name: "allowUrl", type: "boolean", default: "true", description: "Show the URL field. URLs load with crossOrigin=\"anonymous\"; tainted images report a cors error." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Disc flights and the busy bar only under full motion." },
    { name: "ref", type: "PaletteComposerHandle", default: "—", description: "{ root, focusSourceInput() }." },
  ],
  cssVars: [
    { name: "--cui-palette-surface", description: "Preview and rail background", default: "rgba(20,19,17,0.06)" },
    { name: "--cui-palette-gap", description: "Gap between tiles and sections", default: "16px" },
    { name: "--cui-palette-focus", description: "Focus ring", default: "#141311" },
    { name: "--cui-palette-input", description: "Field and tile surface", default: "#faf9f6" },
    { name: "--cui-palette-accent", description: "Locked tile accent", default: "#141311" },
    { name: "--cui-palette-error", description: "Error text and invalid borders", default: "#c8360d" },
  ],
  examples: [
    {
      id: "fixtures",
      title: "Fixtures: six colours, monochrome, transparent, oversized",
      description: "Load each fixture. The transparent image is 90% see-through red over opaque blue: blue wins. The oversized one is rejected by maxPixels without freezing anything.",
      code: `<PaletteComposer source={{ kind: "url", url: sixColourSvg, revision: 1, alt: "Six colour test card" }} />`,
    },
    {
      id: "race",
      title: "Rapid A → B source change",
      description: "A is slow to decode (simulated); B arrives before A finishes. A's result is discarded; the palette belongs to B.",
      code: `// decoder delays "A" by 1500 ms; click "A then B" to start both
<PaletteComposer decoder={slowDecoder} source={current} onSourceChange={setCurrent} />`,
    },
    {
      id: "locked",
      title: "Locked accent survives re-extraction",
      description: "Lock slot 1, then load a different image: slot 1 keeps its id and colour; the rest refill.",
      code: `<PaletteComposer defaultPalette={[{ id: "slot-1", color: "#ff4d1c", locked: true, origin: "edited" }]} />`,
    },
    {
      id: "clipboard",
      title: "Clipboard denied",
      description: "Tick the checkbox to simulate a rejected clipboard write. Copy reports the failure and reveals selectable CSS instead of pretending it worked.",
      code: `// demo only: navigator.clipboard.writeText is replaced with a rejecting stub while checked
<PaletteComposer defaultPalette={brandPalette} />`,
    },
    {
      id: "brand",
      title: "Brand slots, editor layout",
      description: "Named slots become CSS variable suffixes: --acme-accent, --acme-background…",
      code: `<PaletteComposer variant="brand" exportPrefix="acme" slotLabels={["Accent", "Background", "Surface", "Text"]} count={4} defaultPalette={brandPalette} />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (empty | decoding | extracting | ready | error). Inside: the 4:3 preview (\`img\` with the source's alt), an extraction rail, the labelled file input, URL field, Remove button and a polite status strip; a list of tiles (colour field, label surface with the slot name and a text field, lock button); export buttons and a read-only textarea.

- **Pipeline**: a new source revision creates a request; the decoder returns bounded pixels (default: Image + Canvas, longest side \`sampleMaxSide\`); the extractor returns colours with real sample coordinates; only the newest request fills the unlocked slots (C48-T02). Cancel, a newer source, Remove or unmount aborts the signal.
- **Slots**: ids are \`slot-1…n\` and never change. Locked slots are skipped. Too few colours leave "Unused" slots. Duplicates collapse under an RGB distance of 40.
- **Edits**: a field commits on Enter or blur. \`#rgb\`, \`#rrggbb\` and \`rgb()\` are accepted; anything else sets \`aria-invalid\` and keeps the value.
- **Export**: \`:root { --prefix-n: #rrggbb }\` with sanitised names and validated colours only (C48-T08). Copy reports success only after the clipboard promise resolves.
- **Decoration**: discs start at each colour's sample point in the preview (or the rail when no location exists) and travel 380 ms, staggered 30 ms, after the result exists.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The file input is labelled "Choose image"; the URL field "Image URL"; every tile has "Slot n colour" and "Lock Slot n" controls, so the whole workflow is keyboard-only (C48-T09).
- Hex labels sit on the tile's surface, never on the swatch colour.
- Completion and errors are announced once through one \`role="status"\` region; the busy bar is decorative.
- A CORS failure explains itself and offers "Choose a local file" (C48-T06); clipboard denial reveals a selectable textarea (C48-T07).
- Reduced motion drops the disc flights; nothing else changes.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Decoding draws once into a canvas no larger than \`sampleMaxSide\`² (65 536 pixels by default) and reads it back once; the canvas is zeroed afterwards. Extraction is O(pixels) with a 32 768-bucket map. Object URLs are revoked when the file changes, the source is removed or the component unmounts (C48-T10). No worker is created by default; the extractor adapter is where one belongs.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- The built-in extractor is a population-weighted bucket quantiser, not a perceptual clusterer; results are deterministic but can differ from node-vibrant. Plug that in through \`extractor\` if you need its output.
- No eyedropper, reordering, contrast recommendations or multi-image merging (deferred by the brief).
- In React StrictMode development renders the object URL may be created twice; the extra one is revoked with the next change.`,
    },
  ],
  sourceFiles: ["components/ui/palette-composer.tsx", "lib/palette-extract.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. References studied: Codrops Color Extraction Effect (2015 demo; swatch-arrival idea only, no code), node-vibrant (API shape considered for the extractor adapter; not a dependency). Workflow, provenance and resource contracts from Collection 02 brief #48. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const paletteComposerPlayground: PlaygroundDef = {
  initial: { fixture: "six", variant: "harvest", count: 6, sampleMaxSide: 256, alphaThreshold: 0.5, exportPrefix: "palette", allowUrl: true },
  defaults: { fixture: "six", variant: "harvest", count: 6, sampleMaxSide: 256, alphaThreshold: 0.5, exportPrefix: "palette", allowUrl: true, motion: "auto" },
  controls: [
    { type: "select", prop: "fixture", label: "Image", group: "Source", options: [{ label: "Six colours", value: "six" }, { label: "Monochrome", value: "mono" }, { label: "Mostly transparent", value: "transparent" }, { label: "Oversized (rejected)", value: "huge" }, { label: "None", value: "none" }] },
    { type: "select", prop: "variant", label: "Variant", group: "Layout", options: [{ label: "Harvest", value: "harvest" }, { label: "Editor", value: "editor" }, { label: "Brand", value: "brand" }] },
    { type: "range", prop: "count", label: "Slots", group: "Extraction", min: 1, max: 8, step: 1 },
    { type: "range", prop: "sampleMaxSide", label: "Sample side", group: "Extraction", min: 32, max: 512, step: 32, unit: "px" },
    { type: "range", prop: "alphaThreshold", label: "Alpha threshold", group: "Extraction", min: 0, max: 1, step: 0.05 },
    { type: "text", prop: "exportPrefix", label: "Export prefix", group: "Export" },
    { type: "boolean", prop: "allowUrl", label: "URL input", group: "Source" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Editor, 4 slots", values: { variant: "editor", count: 4 } },
    { name: "Transparent, low threshold", values: { fixture: "transparent", alphaThreshold: 0.1 } },
  ],
};
