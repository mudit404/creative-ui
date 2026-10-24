import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const detentDialMeta: ComponentMeta = {
  slug: "detent-dial",
  name: "DetentDial",
  title: "Detent Dial",
  tagline: "A rotary control with detents that click into place and never flicker.",
  description:
    "A knob for bounded numbers. Vertical drag previews a value across the whole domain in 120 px; release commits once. Detents snap with hysteresis (snap in at 2% of the span, out at 4%), so a slow pass across a detent cannot flicker. Linear or logarithmic scale, with a diagnostic and linear fallback when a log scale gets min ≤ 0. Arrows, Shift for fine steps, Home/End, −/+ buttons, a numeric field and Reset make it fully usable without dragging or a wheel. The angle is derived from the value; the value is the only truth.",
  category: "inputs",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["knob", "dial", "rotary", "input", "numeric", "detent", "audio", "log scale", "slider"],
  registryName: "detent-dial",
  importPath: "@/components/ui/detent-dial",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "bounded-value"] },
  props: [
    { name: "label", type: "string", default: "—", description: "Required accessible name. Also names the buttons (\"Increase Gain\", \"Reset Gain\")." },
    { name: "value / defaultValue", type: "number", default: "min", description: "Controlled or initial value." },
    { name: "min / max / step", type: "number", default: "0 / 100 / 1", description: "Domain. step is the arrow and button increment." },
    { name: "fineStep", type: "number", default: "0.1", description: "Increment for Shift+Arrow. Coarse steps keep a fine offset (5.9 → 4.9)." },
    { name: "scale", type: '"linear" | "log"', default: '"linear"', description: "log needs min > 0; otherwise a diagnostic is shown (data-diagnostic, role=note) and the dial stays linear." },
    { name: "detents", type: "number[]", default: "[]", description: "Snap points in domain units. Drawn as heavier ticks." },
    { name: "snapIn / snapOut", type: "number (fraction of span)", default: "0.02 / 0.04", description: "Hysteresis thresholds. snapOut is forced ≥ snapIn." },
    { name: "dragDistance", type: "number", default: "120", description: "Vertical travel in px that covers the whole domain." },
    { name: "angleStart / angleEnd", type: "number (deg)", default: "-135 / 135", description: "Arc. The unused 90° at the bottom is never crossed." },
    { name: "variant", type: '"instrument" | "stepped" | "studio"', default: '"instrument"', description: "stepped commits only detents (arrows move between them); studio adds a bezel ring." },
    { name: "size", type: '"default" | "compact"', default: '"default"', description: "80 px or 56 px knob." },
    { name: "unit / formatValue", type: "string / (v) => string", default: "—", description: "Readout and aria-valuetext formatting." },
    { name: "resetValue", type: "number", default: "initial value", description: "Value Reset returns to. Documented and testable; not always zero." },
    { name: "showInput / showStepButtons / showReset", type: "boolean", default: "true", description: "Non-drag controls rendered below the knob." },
    { name: "wheel", type: '"off" | "focused"', default: '"off"', description: "Mouse wheel changes the value only while the knob is focused, and only when enabled." },
    { name: "onValuePreview / onValueCommit", type: "(value, meta: { source, detent }) => void", default: "—", description: "Preview during a drag; one commit per release, key, button, input, wheel or reset." },
    { name: "name", type: "string", default: "—", description: "Hidden form input with the committed value." },
    { name: "disabled / readOnly", type: "boolean", default: "false", description: "Inert: no preview, no commit, no overshoot animation." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Only the 4° overshoot on release is animated; reduced and off remove it." },
    { name: "ref", type: "DetentDialHandle", default: "—", description: "{ focusDial(), focusValueInput() } — requests, not internals." },
  ],
  cssVars: [
    { name: "--cui-dial-face", description: "Knob face", default: "#e9e5dc" },
    { name: "--cui-dial-notch", description: "Position notch", default: "#141311" },
    { name: "--cui-dial-arc", description: "Active arc and button focus", default: "#141311" },
    { name: "--cui-dial-arc-track", description: "Inactive arc", default: "rgba(20,19,17,0.12)" },
    { name: "--cui-dial-tick", description: "Minor ticks", default: "rgba(20,19,17,0.35)" },
    { name: "--cui-dial-detent", description: "Detent ticks", default: "#141311" },
    { name: "--cui-dial-focus", description: "Knob focus ring", default: "rgba(20,19,17,0.25)" },
    { name: "--cui-dial-error", description: "Diagnostic text and invalid input", default: "#c8360d" },
  ],
  examples: [
    {
      id: "basic",
      title: "Gain with detents",
      description: "Detents at −12, −6, 0 and +6 dB. Drag slowly across one: it snaps in once and lets go once. Reset returns to 0 dB.",
      code: `<DetentDial label="Gain" unit="dB" min={-60} max={12} step={1} detents={[-12, -6, 0, 6]} defaultValue={-6} resetValue={0}
  onValueCommit={(v, meta) => console.log(v, meta.source, meta.detent)} />`,
    },
    {
      id: "log",
      title: "Logarithmic frequency",
      description: "20 Hz to 20 kHz on a log scale with detents at the octaves of 1 kHz.",
      code: `<DetentDial label="Frequency" unit="Hz" scale="log" min={20} max={20000} step={1} detents={[100, 1000, 10000]} defaultValue={1000} />`,
    },
    {
      id: "diagnostic",
      title: "Misconfigured log scale",
      description: "min=0 with scale=\"log\" cannot work. The dial says so, keeps a usable linear scale and exposes data-diagnostic.",
      code: `<DetentDial label="Broken" scale="log" min={0} max={1000} defaultValue={500} />`,
    },
    {
      id: "stepped",
      title: "Stepped selector",
      description: "Only detents are committable. Arrows move between them; typed values snap to the nearest.",
      code: `<DetentDial label="Quality" variant="stepped" detents={[0, 25, 50, 75, 100]} defaultValue={50} formatValue={(v) => ["Draft", "Low", "Medium", "High", "Ultra"][v / 25]} />`,
    },
    {
      id: "controlled",
      title: "Controlled with a clamped parent",
      description: "The parent clamps commits to 20–80. The knob always shows the parent's value.",
      code: `const [v, setV] = useState(50);
<DetentDial label="Clamped" value={v} onValueCommit={(next) => setV(Math.min(80, Math.max(20, next)))} />`,
    },
    {
      id: "studio",
      title: "Studio, compact",
      description: "Two compact studio knobs with the wheel enabled while focused.",
      code: `<DetentDial label="Pan" variant="studio" size="compact" min={-100} max={100} defaultValue={0} detents={[0]} wheel="focused" />
<DetentDial label="Send" variant="studio" size="compact" defaultValue={30} wheel="focused" />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A root \`div[data-slot="detent-dial"]\` contains the knob (\`role="slider"\`, an SVG with ticks, detent ticks, inactive and active arcs, a face and a rotating notch), a readout, and a row of −/+ buttons, a numeric field and Reset. The angle is \`angleStart + fraction(value) × (angleEnd − angleStart)\`; nothing stores an angle.

- **Drag**: pointer capture on the knob. Vertical movement maps to the domain fraction over \`dragDistance\`; the candidate is quantized, passed through detent hysteresis, previewed, and committed once on release. Escape, pointercancel, lost capture, disabling or a parent value change cancels the preview.
- **Hysteresis**: \`resolveDetent\` keeps the current detent until the value leaves by \`snapOut × span\`, and snaps to a new one within \`snapIn × span\`. Walking 46→56 past a detent at 50 produces exactly one snapped run.
- **Commit precision**: coarse steps move by \`step\` relative to the current value at \`fineStep\` precision, so fine offsets survive. Typed values quantize to \`step\`.
- **Overshoot**: on release under full motion the notch overshoots by up to 4° and springs back. The value never changes; the arc and readout show the committed value.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- \`role="slider"\` with \`aria-valuemin/max/now/text\` (text includes the unit) and a visually hidden hint describing drag, arrows and typing.
- Keyboard: Arrow Up/Right and Down/Left step; Shift steps by \`fineStep\`; Page keys ten steps; Home/End reach the ends (same endpoints as dragging, C42-T03).
- The numeric field accepts a decimal point or comma, commits on Enter or blur, and keeps the previous value on invalid text with \`aria-invalid\` (C42-T07).
- Reset returns to \`resetValue\` or the initial value (C42-T05). Every adjustment works without drag or wheel (C42-T08).
- Disabled and reduced motion run no rotation animation; labels and controls stay accurate (C42-T09).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Nothing runs at rest. A drag re-renders one SVG (about 30 elements) per pointer move. The overshoot is one spring on a motion value lasting around 180 ms. No wheel listener fires unless \`wheel="focused"\` and the knob has focus.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No circular drag (following the pointer around the knob); vertical drag is deliberate so the indicator can never cross the unused arc (C42-T06).
- No audio feedback; the brief explicitly forbids it while disabled or reduced, and it is deferred entirely.
- Detents are rendered as ticks only; no labels under them yet.`,
    },
  ],
  sourceFiles: ["components/ui/detent-dial.tsx", "lib/bounded-value.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: React Knob Headless documentation (API shape only, no code reused). Hysteresis, scale fallback, commit precision and the non-drag contract come from Collection 02 brief #42. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const detentDialPlayground: PlaygroundDef = {
  initial: { variant: "instrument", size: "default", min: 0, max: 100, step: 1, scale: "linear", dragDistance: 120, snapIn: 0.02, snapOut: 0.04, wheel: "off", showInput: true, showStepButtons: true, showReset: true, disabled: false },
  defaults: { variant: "instrument", size: "default", min: 0, max: 100, step: 1, fineStep: 0.1, scale: "linear", dragDistance: 120, snapIn: 0.02, snapOut: 0.04, wheel: "off", showInput: true, showStepButtons: true, showReset: true, disabled: false, motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Instrument", value: "instrument" }, { label: "Stepped", value: "stepped" }, { label: "Studio", value: "studio" }] },
    { type: "select", prop: "size", label: "Size", group: "Shape", options: [{ label: "Default (80px)", value: "default" }, { label: "Compact (56px)", value: "compact" }] },
    { type: "select", prop: "scale", label: "Scale", group: "Domain", options: [{ label: "Linear", value: "linear" }, { label: "Logarithmic", value: "log" }] },
    { type: "range", prop: "min", label: "Min", group: "Domain", min: 0, max: 100, step: 1 },
    { type: "range", prop: "max", label: "Max", group: "Domain", min: 10, max: 20000, step: 10 },
    { type: "range", prop: "step", label: "Step", group: "Domain", min: 0.1, max: 10, step: 0.1 },
    { type: "range", prop: "dragDistance", label: "Drag distance", group: "Interaction", min: 40, max: 400, step: 10, unit: "px" },
    { type: "range", prop: "snapIn", label: "Snap in", group: "Interaction", min: 0, max: 0.1, step: 0.005 },
    { type: "range", prop: "snapOut", label: "Snap out", group: "Interaction", min: 0, max: 0.2, step: 0.005 },
    { type: "select", prop: "wheel", label: "Wheel", group: "Interaction", options: [{ label: "Off", value: "off" }, { label: "While focused", value: "focused" }] },
    { type: "boolean", prop: "showInput", label: "Numeric input", group: "Controls" },
    { type: "boolean", prop: "showStepButtons", label: "Step buttons", group: "Controls" },
    { type: "boolean", prop: "showReset", label: "Reset button", group: "Controls" },
    { type: "boolean", prop: "disabled", label: "Disabled", group: "State" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Log frequency", values: { scale: "log", min: 20, max: 20000, step: 1 } },
    { name: "Broken log (min 0)", values: { scale: "log", min: 0, max: 1000 } },
    { name: "Stepped", values: { variant: "stepped" } },
    { name: "Studio compact", values: { variant: "studio", size: "compact", wheel: "focused" } },
  ],
};
