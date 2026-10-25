import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const asciiMediaMeta: ComponentMeta = {
  slug: "ascii-media",
  name: "AsciiMedia",
  title: "ASCII Media",
  tagline: "An image or video as a calibrated glyph grid, with the original one button away.",
  description:
    "The native image or video stays the accessible representation and the timeline authority; a single aria-hidden canvas draws its luminance as glyphs from a measured ramp through a pre-rendered atlas. Columns adapt to the container width with a measured 0.6 cell aspect so the grid preserves the media's proportions. Video is sampled per presented frame up to maxFps and stops while paused or hidden. Cross-origin pixels that cannot be read, a failed font and a failed media load all fall back to the original with a readable reason, and reduced motion shows the native player instead of a running conversion.",
  category: "media",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["ascii", "glyph", "text art", "canvas", "video", "image", "retro", "terminal"],
  registryName: "ascii-media",
  importPath: "@/components/ui/ascii-media",
  dependencies: { npm: ["clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "ascii-grid"] },
  props: [
    { name: "source", type: "{ kind: \"image\", src, alt } | { kind: \"video\", src, poster?, description, muted?, loop? }", default: "—", description: "Required. The native element renders first and stays mounted." },
    { name: "columns / narrowColumns / narrowBreakpoint", type: "number / number / px", default: "96 / 48 / 640", description: "Glyph columns by container width; rows follow the media aspect." },
    { name: "glyphRamp", type: "string", default: '" .:-=+*#%@"', description: "Lightest to darkest; validated (≥2 single-width glyphs) or the default is used with a notice." },
    { name: "colorMode", type: '"mono" | "source-color"', default: "variant", description: "One foreground token or per-cell source colour." },
    { name: "invert", type: "boolean", default: "false", description: "Dark media on light backgrounds." },
    { name: "maxFps", type: "number", default: "24", description: "Upper bound on video sampling; frames are never duplicated or faked." },
    { name: "showOriginal / defaultShowOriginal / onShowOriginalChange", type: "boolean / boolean / callback", default: "false", description: "Toggle between glyphs and the original without resetting playback." },
    { name: "onReady / onError", type: "callbacks", default: "—", description: "ready({ cols, rows }); error({ reason: media | font | origin | renderer, message })." },
    { name: "fontFamily", type: "string", default: "ui-monospace stack", description: "Fixed-cell font; a load failure reports and falls back to monospace." },
    { name: "sampler", type: "FrameSampler", default: "canvas sampler", description: "Injectable frame reader (tests, custom pipelines)." },
    { name: "hoverReveal", type: "boolean", default: "false", description: "Hover shows the original (decorative; the button always exists)." },
    { name: "variant", type: '"mono" | "source-color" | "poster"', default: '"mono"', description: "poster converts only images and leaves video native." },
    { name: "quality", type: '"auto" | "high" | "balanced" | "low"', default: '"auto"', description: "Device-pixel-ratio cap for the canvas." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Reduced motion shows the native player for video." },
    { name: "ref", type: "AsciiMediaHandle", default: "—", description: "{ root, media }." },
  ],
  cssVars: [
    { name: "--cui-ascii-background", description: "Canvas background (designed dark on both schemes; may hold var() or light-dark(), resolved before drawing)", default: "#141311" },
    { name: "--cui-ascii-foreground", description: "Mono glyph colour (designed light on both schemes; resolved like the background)", default: "#faf9f6" },
    { name: "--cui-ascii-control", description: "Control text and focus ring (ink)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-ascii-border", description: "Toggle button border (decorative; the button is labelled)", default: "light-dark(rgba(20,19,17,0.25), rgba(236,235,230,0.25))" },
    { name: "--cui-ascii-error", description: "Error text", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    { id: "image", title: "Static image, mono", description: "A generated scene; the grid reports its cell count. Show original keeps the same <img>.", code: `<AsciiMedia source={{ kind: "image", src, alt }} />` },
    { id: "color", title: "Source colour and inverted ramp", description: "Per-cell colour and invert for a light theme. A light canvas needs a dark foreground too, or mono glyphs would vanish.", code: `<AsciiMedia variant="source-color" invert style={{ "--cui-ascii-background": "#faf9f6", "--cui-ascii-foreground": "#141311" }} … />` },
    { id: "video", title: "Video at 12 fps", description: "Play the native controls: glyphs follow presented frames; pausing stops sampling; Show original never resets the time.", code: `<AsciiMedia source={{ kind: "video", src: "/media/film.webm", description }} maxFps={12} />` },
    { id: "tainted", title: "Cross-origin read failure (simulated)", description: "A sampler that throws SecurityError stands in for a tainted canvas: the original returns with a reason.", code: `<AsciiMedia sampler={taintedSampler} onError={log} />` },
    { id: "ramp", title: "Invalid ramp and reduced motion", description: "An emoji ramp is rejected (default used, notice shown); motion=\"reduced\" on video shows the native player.", code: `<AsciiMedia glyphRamp="🙂" … /> <AsciiMedia motion="reduced" source={video} />` },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (original | preparing | ascii | error), \`data-showing\` (ascii | original), \`data-cols\` / \`data-rows\`. The stage holds the native \`<img>\` or \`<video controls>\` and one aria-hidden canvas; below are the Show original toggle (\`aria-pressed\`) and a status.

- **Grid**: \`gridSize\` keeps the media aspect with a 0.6 cell aspect; \`responsiveColumns\` switches below the breakpoint (C55-T01, C55-T02).
- **Sampling**: one \`getImageData\` per frame at cols×rows; \`sampleCells\` yields luminance and colour; glyphs come from \`glyphIndex\` over the validated ramp (C55-T08).
- **Video**: \`requestVideoFrameCallback\` (or rAF) gated by \`maxFps\`, \`paused\`, \`ended\` and \`document.hidden\` (C55-T03); a new source bumps a generation so old callbacks are ignored (C55-T07).
- **Fallbacks**: SecurityError → origin; missing font → font (monospace fallback); failed load → media (C55-T05).
- **Canvas colours**: \`--cui-ascii-background\` and \`--cui-ascii-foreground\` are read through a probe element's computed colour at each draw, so they may hold \`var()\` or \`light-dark()\` values Canvas itself cannot parse. The control and error tokens default to \`light-dark()\` pairs and follow \`color-scheme\` (Chrome 123+, Safari 17.5+, Firefox 120+; older browsers get the light values).`,
    },
    { id: "accessibility", title: "Accessibility", body: `- Glyphs never enter the accessibility tree (one canvas, C55-T06); alt text / description and native controls carry meaning.\n- The toggle is a real button; Show original keeps the same element so playback and focus survive (C55-T04).\n- Reduced motion: video shows the native player and the toggle is disabled with a reason (C55-T09).` },
    { id: "performance", title: "Performance", body: `One glyph atlas per font/size/ramp, one small offscreen read per frame, no per-cell DOM. Sampling stops when paused, hidden or unmounted; atlases are released with the instance (C55-T10).` },
    { id: "limitations", title: "Known limitations", body: `- Webcam input is deferred (would need separate consent).\n- Complex-script glyph ramps are rejected rather than shaped.\n- Source-colour mode draws text per cell (slower than the atlas path at very high densities).` },
  ],
  sourceFiles: ["components/ui/ascii-media.tsx", "lib/ascii-grid.ts", "hooks/use-reduced-motion.ts"],
  provenance: "Original implementation. References studied: classic luminance-to-glyph converters and the Codrops ASCII video article (concepts only; no code). Contracts from Collection 02 brief #55. Runtime dependencies: clsx (MIT), tailwind-merge (MIT). The demo film is generated in this repository.",
};

export const asciiMediaPlayground: PlaygroundDef = {
  initial: { columns: 72, variant: "mono", glyphRamp: " .:-=+*#%@", invert: false, maxFps: 24, hoverReveal: false },
  defaults: { columns: 96, narrowColumns: 48, variant: "mono", glyphRamp: " .:-=+*#%@", invert: false, maxFps: 24, hoverReveal: false, quality: "auto", motion: "auto" },
  controls: [
    { type: "range", prop: "columns", label: "Columns", min: 24, max: 160, step: 4, group: "Grid" },
    { type: "text", prop: "glyphRamp", label: "Glyph ramp", group: "Grid" },
    { type: "select", prop: "variant", label: "Variant", group: "Rendering", options: [{ label: "Mono", value: "mono" }, { label: "Source colour", value: "source-color" }, { label: "Poster", value: "poster" }] },
    { type: "boolean", prop: "invert", label: "Invert", group: "Rendering" },
    { type: "boolean", prop: "hoverReveal", label: "Hover reveals original", group: "Rendering" },
    { type: "range", prop: "maxFps", label: "Max FPS", min: 1, max: 60, step: 1, group: "Video" },
  ],
  presets: [{ name: "Dense mono", values: { columns: 140 } }, { name: "Blocky colour", values: { columns: 40, variant: "source-color" } }],
};
