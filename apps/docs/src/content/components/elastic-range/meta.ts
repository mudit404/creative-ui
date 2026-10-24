import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const elasticRangeMeta: ComponentMeta = {
  slug: "elastic-range",
  name: "ElasticRange",
  title: "Elastic Range",
  tagline: "A bounded slider whose track bows past its ends, but whose number never does.",
  description:
    "A single or interval range input. Dragging previews a clamped, quantized candidate; releasing commits once. Past either end the track bows and the thumb squashes a little, purely as decoration: the value is clamped before any callback. Arrow and Page keys, Home/End, +/- buttons and a numeric field make every value reachable without dragging. Interval mode keeps two thumbs apart by a minimum gap and serialises as name.lower / name.upper.",
  category: "inputs",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["slider", "range", "interval", "input", "numeric", "elastic", "form", "bounded", "price range"],
  registryName: "elastic-range",
  importPath: "@/components/ui/elastic-range",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "bounded-value"] },
  props: [
    { name: "labels", type: "{ label: string; lower?: string; upper?: string }", default: "—", description: "Required. Accessible name of the slider (single) or group (interval), plus optional thumb names (default \"Lower bound\" / \"Upper bound\")." },
    { name: "value / defaultValue", type: "number | [number, number]", default: "min", description: "Controlled or initial value. A tuple in interval mode." },
    { name: "min / max / step", type: "number", default: "0 / 100 / 1", description: "Domain. Invalid domains fall back to 0–100 step 1 with a console warning." },
    { name: "minGap", type: "number", default: "0", description: "Minimum distance between interval thumbs, in domain units. Enforced for pointer, keyboard and text input." },
    { name: "variant", type: '"bounded" | "precision" | "interval"', default: '"bounded"', description: "precision draws ticks and disables the bow; interval renders two thumbs." },
    { name: "onValuePreview", type: "(value, meta) => void", default: "—", description: "Transient candidate during a drag. Never a commit." },
    { name: "onValueCommit", type: "(value, meta: { source, thumb? }) => void", default: "—", description: "Exactly one call per release, key action, button or valid text entry. source is pointer | keyboard | input | button." },
    { name: "showInput / showStepButtons", type: "boolean", default: "true", description: "Numeric field and −/+ buttons per thumb." },
    { name: "elasticity", type: "number (0–1)", default: "0.5", description: "How strongly the track bows per pixel of overshoot." },
    { name: "maxStretch", type: "number", default: "12", description: "Cap on the decorative bow, in CSS px." },
    { name: "name", type: "string", default: "—", description: "Form field name via hidden inputs. Interval uses name.lower and name.upper." },
    { name: "formatValue", type: "(v: number) => string", default: "step precision", description: "Formats aria-valuetext, the min/max labels and the numeric field." },
    { name: "disabled / readOnly", type: "boolean", default: "false", description: "Inert control; disabled also drops it from form submission." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced and off remove the bow and squash; editing is unaffected." },
  ],
  cssVars: [
    { name: "--cui-range-track", description: "Track colour", default: "rgba(20,19,17,0.15)" },
    { name: "--cui-range-fill", description: "Active segment, thumb ring and button focus", default: "#141311" },
    { name: "--cui-range-thumb", description: "Thumb fill", default: "#faf9f6" },
    { name: "--cui-range-focus", description: "Thumb focus ring", default: "rgba(20,19,17,0.25)" },
    { name: "--cui-range-tick", description: "Precision tick colour", default: "rgba(20,19,17,0.25)" },
    { name: "--cui-range-error", description: "Invalid input border", default: "#c8360d" },
  ],
  examples: [
    {
      id: "basic",
      title: "Single value",
      description: "Drag, tap the track, use the keyboard or type. The commit log shows one entry per release.",
      code: `const [v, setV] = useState(40);

<ElasticRange labels={{ label: "Volume" }} value={v} onValueCommit={(next) => setV(next as number)} />`,
    },
    {
      id: "interval",
      title: "Interval with a minimum gap",
      description: "Two thumbs that cannot cross or come closer than 50. Taps go to the nearest thumb (ties favour the lower one).",
      code: `<ElasticRange
  variant="interval"
  labels={{ label: "Price", lower: "Minimum price", upper: "Maximum price" }}
  min={0} max={1000} step={10} minGap={50}
  defaultValue={[200, 650]}
  formatValue={(v) => \`€\${v}\`}
/>`,
    },
    {
      id: "precision",
      title: "Precision, step 0.1",
      description: "Ten arrow presses from 0 land on exactly 1.0: quantization counts integer steps from min and rounds to the step's decimals.",
      code: `<ElasticRange variant="precision" labels={{ label: "Gain" }} min={0} max={1} step={0.1} defaultValue={0.3} />`,
    },
    {
      id: "controlled",
      title: "Controlled parent that refuses",
      description: "The parent accepts only multiples of 10. Other commits are proposed, refused, and the slider snaps back to the authoritative value.",
      code: `const [v, setV] = useState(50);

<ElasticRange
  labels={{ label: "Allocation" }}
  value={v}
  onValueCommit={(next) => { if ((next as number) % 10 === 0) setV(next as number); }}
/>`,
    },
    {
      id: "form",
      title: "In a form",
      description: "Interval values submit as budget.lower and budget.upper. Reset restores the defaults.",
      code: `<form>
  <ElasticRange variant="interval" name="budget" labels={{ label: "Budget" }} defaultValue={[20, 60]} />
  <button type="submit">Save</button>
  <button type="reset">Reset</button>
</form>`,
    },
    {
      id: "states",
      title: "Disabled and read-only",
      description: "Both are inert; disabled also leaves the form.",
      code: `<ElasticRange labels={{ label: "Disabled" }} defaultValue={30} disabled />
<ElasticRange labels={{ label: "Read only" }} defaultValue={70} readOnly />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A root \`div[data-slot="elastic-range"]\` holds a pointer-captured track, one or two \`role="slider"\` thumbs, a numeric field with −/+ buttons per thumb, min/max labels and hidden form inputs. In interval mode the root is a \`role="group"\` named by \`labels.label\`.

- **Preview vs commit**: pointer moves emit \`onValuePreview\` with a clamped, quantized candidate and set \`data-previewing\`. Release emits \`onValueCommit\` once. Escape, pointercancel, lost capture, disabling or a parent value change cancels the preview without a commit.
- **Quantization**: computed as an integer step count from \`min\` and rounded to the step's decimal places, so \`step=0.1\` never drifts to 0.30000000000000004.
- **Interval**: the thumb nearest the pointer moves (ties go to the lower one). \`minGap\` is enforced on every input path; the other thumb never moves implicitly.
- **Decoration**: overshoot past an end bows the SVG track by up to \`maxStretch\` px and squashes the thumb by at most 8%. Both are motion values driven by a spring and run only while a drag overshoots.
- **Compact**: below 240px wide the inputs drop beneath the track (\`data-compact\`).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Each thumb is a \`role="slider"\` with \`aria-valuemin/max/now/text\`, \`aria-orientation\` and \`aria-disabled\`; interval thumbs are named "Lower bound" / "Upper bound" or your \`labels\`.
- Keyboard: Arrow keys move one step, Page keys ten, Home/End to the ends. The numeric field commits on Enter or blur; invalid text sets \`aria-invalid\` and keeps the prior value.
- Every value is reachable without dragging: taps, buttons and typing (C41-T07).
- Reduced motion removes the bow and squash; nothing else changes (C41-T09).
- Touch: the track is 44px tall with \`touch-action: none\` and pointer capture, so drags survive leaving the track.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Idle cost is zero: no listeners beyond React's delegated pointer handlers, no animation frames. During a drag two motion values update (bow and squash) and one SVG path is re-rendered; the active segment is plain CSS. A ResizeObserver watches the root for the compact breakpoint.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Horizontal only; no vertical orientation yet.
- No tooltip; the numeric field is the readout. Hide it with \`showInput={false}\` if you render your own.
- The bow is drawn inside the track's box, so it clips against tight containers with \`overflow: hidden\`.`,
    },
  ],
  sourceFiles: ["components/ui/elastic-range.tsx", "lib/bounded-value.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: React Bits Elastic Slider (public demo; stretch-and-return behaviour observed, no code reused). The preview/commit, quantization, interval and form contracts come from the Collection 02 brief #41. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const elasticRangePlayground: PlaygroundDef = {
  initial: { variant: "bounded", min: 0, max: 100, step: 1, minGap: 0, elasticity: 0.5, maxStretch: 12, showInput: true, showStepButtons: true, disabled: false },
  defaults: { variant: "bounded", min: 0, max: 100, step: 1, minGap: 0, elasticity: 0.5, maxStretch: 12, showInput: true, showStepButtons: true, disabled: false, readOnly: false, motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Bounded", value: "bounded" }, { label: "Precision", value: "precision" }, { label: "Interval", value: "interval" }] },
    { type: "range", prop: "min", label: "Min", group: "Domain", min: -100, max: 100, step: 1 },
    { type: "range", prop: "max", label: "Max", group: "Domain", min: 1, max: 1000, step: 1 },
    { type: "range", prop: "step", label: "Step", group: "Domain", min: 0.1, max: 25, step: 0.1 },
    { type: "range", prop: "minGap", label: "Min gap (interval)", group: "Domain", min: 0, max: 50, step: 1 },
    { type: "range", prop: "elasticity", label: "Elasticity", group: "Motion", min: 0, max: 1, step: 0.05 },
    { type: "range", prop: "maxStretch", label: "Max stretch", group: "Motion", min: 0, max: 24, step: 1, unit: "px" },
    { type: "boolean", prop: "showInput", label: "Numeric input", group: "Controls" },
    { type: "boolean", prop: "showStepButtons", label: "Step buttons", group: "Controls" },
    { type: "boolean", prop: "disabled", label: "Disabled", group: "State" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Price range", values: { variant: "interval", min: 0, max: 1000, step: 10, minGap: 50 } },
    { name: "Fine gain", values: { variant: "precision", min: 0, max: 1, step: 0.1 } },
    { name: "Rubber", values: { elasticity: 1, maxStretch: 24 } },
  ],
};
