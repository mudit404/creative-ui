import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const ghostTraceTextMeta: ComponentMeta = {
  slug: "ghost-trace-text",
  name: "GhostTraceText",
  title: "GhostTrace Headline",
  tagline: "A headline traced by a ghost stroke before it settles into type.",
  description:
    "Renders a headline as SVG text whose outline is drawn by a thin ghost stroke, then fills in as the stroke fades. The real words stay in a semantic heading for screen readers, selection and search; the SVG is decorative. It traces when it scrolls into view (or on mount, or on demand), staggers across lines, scales with its container, and renders the plain headline under reduced motion.",
  category: "text",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["text", "headline", "heading", "trace", "outline", "stroke", "reveal", "typography", "hybrid"],
  registryName: "ghost-trace-text",
  importPath: "@/components/ui/ghost-trace-text",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion"] },
  props: [
    { name: "children", type: "string | string[]", default: "—", description: "The headline. Use \\n or an array for multiple lines." },
    { name: "as", type: '"h1" | "h2" | "h3" | "h4" | "p" | "span" | "div"', default: '"h2"', description: "Semantic element rendered around the text." },
    { name: "trigger", type: '"inView" | "mount" | "manual"', default: '"inView"', description: "When the trace starts. inView uses an IntersectionObserver at 35% visibility." },
    { name: "play", type: "boolean", default: "false", description: "For trigger=manual: set true to trace; false then true again replays." },
    { name: "duration", type: "number", default: "1.6", description: "Seconds the ghost stroke takes to trace one line. Fill and stroke fades follow inside this window." },
    { name: "stagger", type: "number", default: "0.35", description: "Seconds between lines." },
    { name: "delay", type: "number", default: "0", description: "Seconds before the first line starts." },
    { name: "strokeWidth", type: "number", default: "1", description: "Ghost stroke width in px at the rendered font size." },
    { name: "ghost", type: "string", default: '"currentColor"', description: "Ghost stroke colour." },
    { name: "fill", type: "string", default: '"currentColor"', description: "Final fill colour." },
    { name: "keepStroke", type: "boolean", default: "false", description: "Leave the stroke visible after settling for an outlined look." },
    { name: "repeat", type: "boolean", default: "false", description: "Replay each time the headline re-enters the viewport (inView trigger)." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion; reduced and off render the plain filled headline with no SVG." },
    { name: "onTraceStart / onTraceComplete", type: "() => void", default: "—", description: "Lifecycle callbacks." },
    { name: "className / style", type: "string / CSSProperties", default: "—", description: "Applied to the semantic element; font-size, font-family, colour and letter-spacing are inherited by the SVG text." },
  ],
  cssVars: [],
  examples: [
    {
      id: "basic",
      title: "Hero headline",
      description: "Scrolls into view and traces once. Font, size and colour come from the heading's own styles.",
      code: `<GhostTraceText as="h1" className="display text-6xl">
  Make it move
</GhostTraceText>`,
    },
    {
      id: "lines",
      title: "Multiple lines, staggered",
      description: "Lines trace one after another.",
      code: `<GhostTraceText as="h2" className="display text-5xl" stagger={0.5}>
  {["Designed to", "be touched."]}
</GhostTraceText>`,
    },
    {
      id: "ghost",
      title: "Coloured ghost, kept outline",
      description: "A different stroke colour and keepStroke for an outlined finish.",
      code: `<GhostTraceText className="display text-5xl" ghost="#ff4d1c" fill="#141311" strokeWidth={1.5} keepStroke>
  Outline and ink
</GhostTraceText>`,
    },
    {
      id: "manual",
      title: "Manual replay",
      description: "trigger=manual with a play prop; toggle it to replay.",
      code: `const [play, setPlay] = useState(false);

<GhostTraceText trigger="manual" play={play} className="display text-5xl">
  Press play
</GhostTraceText>
<button onClick={() => { setPlay(false); requestAnimationFrame(() => setPlay(true)); }}>Replay</button>`,
    },
    {
      id: "sans",
      title: "Sans, slow, thick",
      description: "Works with any font; heavier strokes suit bold sans-serifs.",
      code: `<GhostTraceText className="text-6xl font-extrabold tracking-tight" duration={2.4} strokeWidth={2}>
  HEAVY
</GhostTraceText>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `The semantic element (\`as\`, default \`h2\`) contains a visually hidden copy of the text and an \`aria-hidden\` SVG. Each line is an SVG \`<text>\` that inherits the element's font. After mount (and again after \`document.fonts.ready\` and on resize) the glyph runs are measured with \`getBBox\` to size the viewBox; before that an estimate keeps the layout close.

- **Trace**: the stroke uses a dash longer than the outline; animating the dash offset to zero runs the ghost along the glyphs. Eased so it starts quickly and slows into the last letters.
- **Settle**: at ~55% of the trace the fill rises; at ~75% the stroke fades (unless \`keepStroke\`).
- **Lines** start \`stagger\` seconds apart. \`onTraceComplete\` fires after the last line.
- \`data-state="idle|tracing|settled"\` and \`data-motion\` are exposed for styling and tests.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Style the heading as you normally would: \`font-size\`, \`font-family\`, \`font-weight\`, \`letter-spacing\` and \`color\` are inherited by the SVG text. The SVG is \`width: 100%\` with an aspect ratio from the measured text and a \`max-width\` equal to the text's natural width, so it scales down on narrow screens without wrapping.

\`ghost\` and \`fill\` accept any CSS colour; \`strokeWidth\` is in px at the rendered size (1–2 px reads well for display type). For an outlined look keep \`keepStroke\`. Use \`trigger="manual"\` with \`play\` to sync with other choreography.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The accessible name is the real text in the semantic element (\`sr-only\`); the SVG is \`aria-hidden\`. Screen readers announce the heading once, with the right level.
- Under \`prefers-reduced-motion\` (or \`motion="reduced"|"off"\`) the plain headline renders with no SVG, so nothing is traced and text wraps normally.
- The visual text is not selectable while the SVG is shown; the hidden copy is, so copy and find-in-page work.
- Colour contrast is your responsibility; the ghost stroke is transient, the fill is the final state.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `A dash-offset animation plus two opacity tweens per line, driven by Motion, for the duration of the trace only. One IntersectionObserver and one ResizeObserver per instance; three \`getBBox\` reads per measure. Stroking text is rasterised by the browser's SVG engine and is cheap at headline sizes.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- \`paint-order: stroke\` keeps the stroke behind the fill in all modern browsers.
- Dash animation on SVG text works in Chrome, Edge, Safari and Firefox; the visual speed along the outline varies slightly with glyph complexity.
- Before web fonts load, the estimate may differ from the final size for a frame; the component re-measures on \`document.fonts.ready\`.
- Server rendering is safe: the plain estimate is rendered, measured on the client.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No automatic wrapping: break lines yourself with \`\\n\` or an array.
- The dash length is an estimate, so the trace reaches the last letter slightly before \`duration\` on short words and slightly after on very long lines.
- The SVG text cannot be selected or searched directly (the hidden copy can).
- Very thin fonts need \`strokeWidth\` ≥ 1 to be visible as a ghost.`,
    },
  ],
  sourceFiles: ["components/ui/ghost-trace-text.tsx", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. SVG stroke-dash text reveals are a long-standing public technique; no third-party code is used. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const ghostTraceTextPlayground: PlaygroundDef = {
  childrenProp: "children",
  initial: { children: "Make it move", trigger: "mount", duration: 1.6, stagger: 0.35, strokeWidth: 1, ghost: "", fill: "", keepStroke: false, font: "display" },
  defaults: { trigger: "inView", duration: 1.6, stagger: 0.35, strokeWidth: 1, ghost: "", fill: "", keepStroke: false, repeat: false, delay: 0, motion: "auto", font: "display" },
  controls: [
    { type: "text", prop: "children", label: "Text (\\n for lines)", group: "Content" },
    { type: "select", prop: "font", label: "Font", group: "Content", options: [{ label: "Display serif", value: "display" }, { label: "Sans bold", value: "sans" }] },
    { type: "range", prop: "duration", label: "Duration", group: "Timing", min: 0.4, max: 4, step: 0.1, unit: "s" },
    { type: "range", prop: "stagger", label: "Line stagger", group: "Timing", min: 0, max: 1.5, step: 0.05, unit: "s" },
    { type: "range", prop: "strokeWidth", label: "Stroke width", group: "Look", min: 0.5, max: 4, step: 0.25, unit: "px" },
    { type: "color", prop: "ghost", label: "Ghost colour", group: "Look" },
    { type: "color", prop: "fill", label: "Fill colour", group: "Look" },
    { type: "boolean", prop: "keepStroke", label: "Keep stroke", group: "Look" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Two lines", values: { children: "Designed to\nbe touched.", stagger: 0.5 } },
    { name: "Ember outline", values: { ghost: "#ff4d1c", keepStroke: true, strokeWidth: 1.5 } },
    { name: "Heavy sans", values: { font: "sans", children: "HEAVY", strokeWidth: 2, duration: 2.4 } },
  ],
};
