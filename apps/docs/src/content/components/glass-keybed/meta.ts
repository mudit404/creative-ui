import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const glassKeybedMeta: ComponentMeta = {
  slug: "glass-keybed",
  name: "GlassKeybed",
  title: "Glass Keybed",
  tagline: "A finite, labelled, playable keybed that stays silent until you ask for sound.",
  description:
    "Eight (or your own) labelled note keys as real buttons. Nothing touches Web Audio until the user enables sound inside a gesture; a blocked or unsupported audio stack leaves a fully usable visual-only instrument with a reason. The built-in mallet voice is a sine plus one glassy partial through an authored envelope, every node released; voices are bounded by polyphony with oldest-first eviction, Stop all and document hiding release everything, and a borrowed AudioContext is never closed. One activation produces exactly one note whether it comes from a pointer, Enter/Space or an opt-in number-row shortcut. Reduced motion keeps labels and colour feedback and removes the swing.",
  category: "inputs",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["audio", "web audio", "keyboard", "instrument", "synth", "glass", "mallet", "notes", "polyphony"],
  registryName: "glass-keybed",
  importPath: "@/components/ui/glass-keybed",
  dependencies: { npm: ["clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "voice-pool"] },
  props: [
    { name: "notes", type: "{ id, label, frequency }[]", default: "C4–E5 pentatonic (8)", description: "Finite note set; frequencies outside 80–2000 Hz and duplicate ids are reported." },
    { name: "sound", type: "SoundAdapter", default: "malletSound", description: "{ start(ctx), noteOn(ctx, out, note, velocity, sustained) → { release } }." },
    { name: "soundEnabled / defaultSoundEnabled / onSoundEnabledChange", type: "boolean / boolean / (enabled, reason) => void", default: "false", description: "Explicit consent; reasons are user | blocked | unsupported." },
    { name: "volume / muted", type: "0–1 / boolean", default: "0.2 / false", description: "Drive only this component's master gain." },
    { name: "polyphony", type: "number", default: "8", description: "Maximum simultaneous voices; the oldest is evicted." },
    { name: "triggerMode", type: '"percussive" | "sustained"', default: '"percussive"', description: "Envelope release or hold while pressed." },
    { name: "onNoteOn / onNoteOff", type: "(payload) => void", default: "—", description: "{ voiceId, noteId, velocity, origin }; off adds reason (release | envelope | evicted | stopAll | blur | hidden)." },
    { name: "keyboardMode", type: '"focused-controls" | "shortcuts"', default: '"focused-controls"', description: "Shortcuts map 1–9 to notes and ignore text fields and modifiers; never on by default." },
    { name: "audioContext / createAudioContext", type: "AudioLike / () => AudioLike", default: "window.AudioContext", description: "Borrow a context (never closed) or inject a factory." },
    { name: "variant", type: '"glass-mallet" | "opaque-accessible" | "visual-only"', default: '"glass-mallet"', description: "Glass with swing, opaque high-contrast, or no audio controls at all." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Reduced removes the swing; colour pulse remains." },
    { name: "ref", type: "GlassKeybedHandle", default: "—", description: "{ root, focusKey(id), stopAll() }." },
  ],
  cssVars: [
    { name: "--cui-key-glass", description: "Key face; the glass-mallet variant falls back to a translucent slab, opaque-accessible to a solid one", default: "light-dark(rgba(255,255,255,0.35), rgba(255,255,255,0.1)) / light-dark(#faf9f6, #2a2a27)" },
    { name: "--cui-key-active", description: "Note pulse and Enable button", default: "light-dark(#1a6b45, #5fcf8f)" },
    { name: "--cui-key-label", description: "Text colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-key-focus", description: "Focus ring and control-bar button borders", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-key-error", description: "Blocked/diagnostic text and border", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    { id: "glass", title: "Glass mallet with event log", description: "Silent on mount. Enable sound, play keys by pointer or Enter/Space; every note is one onNoteOn with its origin.", code: `<GlassKeybed onNoteOn={log} onNoteOff={log} />` },
    { id: "sustained", title: "Opaque, sustained, polyphony 3", description: "Hold keys to sustain; a fourth note evicts the oldest (reason \"evicted\"). Stop all releases everything.", code: `<GlassKeybed variant="opaque-accessible" triggerMode="sustained" polyphony={3} />` },
    { id: "visual", title: "Visual-only", description: "No Enable button, no audio graph; keys still report notes.", code: `<GlassKeybed variant="visual-only" />` },
    { id: "blocked", title: "Blocked audio", description: "An injected context that refuses to resume: the component reports blocked and stays usable.", code: `<GlassKeybed createAudioContext={() => blockedContext} />` },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-audio\` (silent | enabling | ready | blocked | visual-only), \`data-trigger\` and \`data-motion\`. A control bar (Enable/Disable sound, Volume, Stop all, a polite status), optional diagnostics, and a row of \`<button data-key>\` keys with \`data-active\` while a voice sounds.

- **Consent**: no AudioContext exists before Enable sound; it is created/resumed inside the click and a failure records a reason (C58-T01, C58-T02, C58-T10).
- **One activation, one voice**: \`pointerdown\` plays and prevents the synthetic click; Enter/Space play on keydown without repeat (C58-T03, C58-T07).
- **Voices**: \`createVoicePool\` bounds polyphony; evicted voices are released and reported (C58-T04). Envelope expiry, release, Stop all, hiding and unmount all go through the same release path (C58-T05).
- **Ownership**: a borrowed context is never closed; an owned one is closed on unmount (C58-T06). Volume and mute touch only the component's master gain (C58-T08).`,
    },
    { id: "accessibility", title: "Accessibility", body: `- Keys are buttons named "<label> note" with a shared hint; focus is visible.\n- Shortcuts are opt-in and skip inputs, textareas, contenteditable and modified keys.\n- Reduced motion removes the swing and keeps labels and pulse (C58-T09).` },
    { id: "performance", title: "Performance", body: `No audio graph until enabled; each voice is three nodes released on end. No timers while idle except per-voice envelope timeouts. Keys animate with CSS keyframes only.` },
    { id: "limitations", title: "Known limitations", body: `- No MIDI, recording, samples or AudioWorklet synthesis (deferred).\n- The built-in voice is a simple mallet; bring a SoundAdapter for richer timbres.\n- The Volume slider is display-only; drive \`volume\` from the host.` },
  ],
  sourceFiles: ["components/ui/glass-keybed.tsx", "lib/voice-pool.ts", "hooks/use-reduced-motion.ts"],
  provenance: "Original implementation. References studied: the Codrops glass keyboard demo (concepts only; no code, no Three.js renderer here). Contracts from Collection 02 brief #58. Runtime dependencies: clsx (MIT), tailwind-merge (MIT). Web Audio only; no samples shipped.",
};

export const glassKeybedPlayground: PlaygroundDef = {
  initial: { variant: "glass-mallet", triggerMode: "percussive", polyphony: 8, volume: 0.2, muted: false, keyboardMode: "focused-controls" },
  defaults: { variant: "glass-mallet", triggerMode: "percussive", polyphony: 8, volume: 0.2, muted: false, keyboardMode: "focused-controls", motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Glass mallet", value: "glass-mallet" }, { label: "Opaque accessible", value: "opaque-accessible" }, { label: "Visual only", value: "visual-only" }] },
    { type: "select", prop: "triggerMode", label: "Trigger", group: "Sound", options: [{ label: "Percussive", value: "percussive" }, { label: "Sustained", value: "sustained" }] },
    { type: "range", prop: "polyphony", label: "Polyphony", min: 1, max: 16, step: 1, group: "Sound" },
    { type: "range", prop: "volume", label: "Volume", min: 0, max: 1, step: 0.05, group: "Sound" },
    { type: "boolean", prop: "muted", label: "Muted", group: "Sound" },
    { type: "select", prop: "keyboardMode", label: "Keyboard", group: "Input", options: [{ label: "Focused controls", value: "focused-controls" }, { label: "Shortcuts 1–9", value: "shortcuts" }] },
  ],
  presets: [{ name: "Default", values: {} }, { name: "Hold notes", values: { triggerMode: "sustained", variant: "opaque-accessible" } }],
};
