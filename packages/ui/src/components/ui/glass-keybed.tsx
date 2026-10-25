"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { DEFAULT_NOTES, clampVelocity, createVoicePool, malletEnvelope, validateNotes, type NoteDefinition, type Voice } from "@/lib/voice-pool";

export type { NoteDefinition, Voice } from "@/lib/voice-pool";

export interface NotePayload {
  voiceId: string;
  noteId: string;
  velocity: number;
  origin: "pointer" | "keyboard" | "shortcut" | "api";
}

/** Minimal Web Audio surface the built-in mallet needs (so tests can inject a fake). */
export interface AudioLike {
  state: AudioContextState;
  currentTime: number;
  destination: AudioNode;
  resume(): Promise<void>;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
}

export interface SoundAdapter {
  /** Called inside the user gesture; must resolve to a ready context or throw. */
  start(ctx: AudioLike): Promise<void> | void;
  noteOn(ctx: AudioLike, out: GainNode, note: NoteDefinition, velocity: number, sustained: boolean): { release: (now: number) => void };
}

export interface GlassKeybedHandle {
  root: HTMLDivElement | null;
  focusKey: (noteId: string) => void;
  stopAll: () => void;
}

export interface GlassKeybedProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  notes?: readonly NoteDefinition[];
  sound?: SoundAdapter;
  soundEnabled?: boolean;
  defaultSoundEnabled?: boolean;
  onSoundEnabledChange?: (enabled: boolean, reason: "user" | "blocked" | "unsupported") => void;
  /** 0–1 master gain for this component's routing only. */
  volume?: number;
  muted?: boolean;
  polyphony?: number;
  triggerMode?: "percussive" | "sustained";
  onNoteOn?: (payload: NotePayload) => void;
  onNoteOff?: (payload: NotePayload & { reason: "release" | "envelope" | "evicted" | "stopAll" | "blur" | "hidden" }) => void;
  /** Global shortcuts (number row) are never on by default. */
  keyboardMode?: "focused-controls" | "shortcuts";
  /** A borrowed AudioContext is never closed by this component. */
  audioContext?: AudioLike;
  /** Factory for an owned context (defaults to window.AudioContext). */
  createAudioContext?: () => AudioLike;
  variant?: "glass-mallet" | "opaque-accessible" | "visual-only";
  label?: string;
  motion?: "auto" | "reduced" | "off";
}

/** Built-in percussive mallet: sine + faint overtone through an authored envelope; every node is released. */
export const malletSound: SoundAdapter = {
  async start(ctx) {
    if (ctx.state !== "running") await ctx.resume();
  },
  noteOn(ctx, out, note, velocity, sustained) {
    const env = malletEnvelope(velocity);
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = note.frequency;
    osc2.type = "triangle";
    osc2.frequency.value = note.frequency * 2.76; // glassy inharmonic partial
    const partial = ctx.createGain();
    partial.gain.value = 0.18;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(env.peak, now + env.attack);
    if (!sustained) gain.gain.exponentialRampToValueAtTime(0.0001, now + env.attack + env.decay);
    osc.connect(gain);
    osc2.connect(partial).connect(gain);
    gain.connect(out);
    osc.start(now);
    osc2.start(now);
    let released = false;
    const cleanup = (at: number) => {
      osc.stop(at);
      osc2.stop(at);
      const dispose = () => {
        osc.disconnect();
        osc2.disconnect();
        partial.disconnect();
        gain.disconnect();
      };
      osc.onended = dispose;
    };
    if (!sustained) cleanup(now + env.attack + env.decay + 0.05);
    return {
      release: (at: number) => {
        if (released) return;
        released = true;
        gain.gain.cancelScheduledValues(at);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        cleanup(at + 0.15);
      },
    };
  },
};

/**
 * GlassKeybed — a finite, labelled, playable keybed with explicit audio consent.
 *
 * Keys are native buttons with note labels; nothing sounds until the user
 * enables sound in a gesture, and a blocked or unsupported audio stack leaves
 * a fully usable visual-only instrument. Each activation creates one voice
 * (never twice from pointer and click), voices are bounded by `polyphony`,
 * Stop all and document hiding release everything, and a borrowed
 * AudioContext is never closed. Reduced motion keeps labels and colour
 * feedback but removes the swing.
 */
export const GlassKeybed = React.forwardRef<GlassKeybedHandle, GlassKeybedProps>(function GlassKeybed(
  {
    notes = DEFAULT_NOTES,
    sound = malletSound,
    soundEnabled: enabledProp,
    defaultSoundEnabled = false,
    onSoundEnabledChange,
    volume = 0.2,
    muted = false,
    polyphony = 8,
    triggerMode = "percussive",
    onNoteOn,
    onNoteOff,
    keyboardMode = "focused-controls",
    audioContext,
    createAudioContext,
    variant = "glass-mallet",
    label = "Keybed",
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const diagnostics = React.useMemo(() => validateNotes(notes), [notes]);
  const visualOnly = variant === "visual-only";

  /* audio state */
  const [internalEnabled, setInternalEnabled] = React.useState(defaultSoundEnabled && !visualOnly);
  const enabled = visualOnly ? false : (enabledProp ?? internalEnabled);
  const [audioState, setAudioState] = React.useState<"silent" | "enabling" | "ready" | "blocked">("silent");
  const [blockedReason, setBlockedReason] = React.useState<string | null>(null);
  const ctxRef = React.useRef<{ ctx: AudioLike; owned: boolean; master: GainNode } | null>(null);
  const pool = React.useRef(createVoicePool(polyphony));
  const voices = React.useRef(new Map<string, { release: (at: number) => void; timer: ReturnType<typeof setTimeout> | null }>());
  const [active, setActive] = React.useState<Record<string, number>>({}); // noteId → pulse key
  const latest = React.useRef({ onNoteOn, onNoteOff, sound, notes, enabled, audioState, triggerMode });
  React.useEffect(() => {
    latest.current = { onNoteOn, onNoteOff, sound, notes, enabled, audioState, triggerMode };
  });

  const setEnabled = (next: boolean, reason: "user" | "blocked" | "unsupported") => {
    if (enabledProp === undefined) setInternalEnabled(next);
    onSoundEnabledChange?.(next, reason);
  };

  /** Create/resume audio inside a user gesture (C58-T01, C58-T02). */
  const enableSound = async () => {
    if (visualOnly) return;
    setAudioState("enabling");
    try {
      let entry = ctxRef.current;
      if (!entry) {
        const borrowed = audioContext ?? null;
        const ctx = borrowed ?? (createAudioContext ? createAudioContext() : typeof window !== "undefined" && "AudioContext" in window ? new window.AudioContext() : null);
        if (!ctx) throw new Error("Web Audio is not supported here.");
        const master = ctx.createGain();
        master.connect(ctx.destination);
        entry = { ctx, owned: !borrowed, master };
        ctxRef.current = entry;
      }
      await latest.current.sound.start(entry.ctx);
      if (entry.ctx.state !== "running") throw new Error("The browser blocked audio playback.");
      entry.master.gain.value = muted ? 0 : clampVelocity(volume);
      setAudioState("ready");
      setBlockedReason(null);
      setEnabled(true, "user");
    } catch (e) {
      setAudioState("blocked");
      setBlockedReason(e instanceof Error ? e.message : "Audio could not start.");
      setEnabled(false, e instanceof Error && /not supported/.test(e.message) ? "unsupported" : "blocked");
    }
  };
  const disableSound = () => {
    stopAll("stopAll");
    setEnabled(false, "user");
    setAudioState("silent");
  };
  // volume/mute only touch this component's master gain (C58-T08)
  React.useEffect(() => {
    const entry = ctxRef.current;
    if (entry) entry.master.gain.value = muted ? 0 : clampVelocity(volume);
  }, [volume, muted, audioState]);

  /* voices */
  const pulseKey = React.useRef(0);
  const noteOn = (note: NoteDefinition, velocity: number, origin: NotePayload["origin"]) => {
    const sustained = latest.current.triggerMode === "sustained";
    const now = ctxRef.current?.ctx.currentTime ?? performance.now() / 1000;
    const { voice, evicted } = pool.current.noteOn(note.id, velocity, sustained, now);
    for (const ev of evicted) releaseVoice(ev, "evicted"); // bounded polyphony (C58-T04)
    const entry = ctxRef.current;
    if (enabled && audioState === "ready" && entry) {
      const handle = latest.current.sound.noteOn(entry.ctx, entry.master, note, voice.velocity, sustained);
      const env = malletEnvelope(voice.velocity);
      const timer = sustained
        ? null
        : setTimeout(() => {
            if (pool.current.noteOff(voice.voiceId)) {
              voices.current.delete(voice.voiceId);
              latest.current.onNoteOff?.({ voiceId: voice.voiceId, noteId: note.id, velocity: voice.velocity, origin, reason: "envelope" });
            }
          }, (env.attack + env.decay) * 1000);
      voices.current.set(voice.voiceId, { release: handle.release, timer });
    } else {
      // visual-only: the voice still expires by envelope so bookkeeping stays bounded
      const env = malletEnvelope(voice.velocity);
      const timer = sustained
        ? null
        : setTimeout(() => {
            if (pool.current.noteOff(voice.voiceId)) {
              voices.current.delete(voice.voiceId);
              latest.current.onNoteOff?.({ voiceId: voice.voiceId, noteId: note.id, velocity: voice.velocity, origin, reason: "envelope" });
            }
          }, (env.attack + env.decay) * 1000);
      voices.current.set(voice.voiceId, { release: () => {}, timer });
    }
    pulseKey.current += 1;
    setActive((a) => ({ ...a, [note.id]: pulseKey.current }));
    latest.current.onNoteOn?.({ voiceId: voice.voiceId, noteId: note.id, velocity: voice.velocity, origin });
    return voice;
  };
  const releaseVoice = (voice: Voice, reason: NonNullable<Parameters<NonNullable<GlassKeybedProps["onNoteOff"]>>[0]>["reason"]) => {
    const v = voices.current.get(voice.voiceId);
    if (v) {
      if (v.timer) clearTimeout(v.timer);
      v.release(ctxRef.current?.ctx.currentTime ?? 0);
      voices.current.delete(voice.voiceId);
    }
    latest.current.onNoteOff?.({ voiceId: voice.voiceId, noteId: voice.noteId, velocity: voice.velocity, origin: "api", reason });
  };
  const noteOff = (noteId: string, reason: "release" | "blur" | "hidden") => {
    for (const v of pool.current.active()) {
      if (v.noteId === noteId && v.sustained) {
        pool.current.noteOff(v.voiceId);
        releaseVoice(v, reason);
      }
    }
    setActive((a) => {
      const { [noteId]: _gone, ...restA } = a;
      void _gone;
      return restA;
    });
  };
  const stopAll = (reason: "stopAll" | "hidden" = "stopAll") => {
    for (const v of pool.current.stopAll()) releaseVoice(v, reason);
    setActive({});
  };

  // Stop all on hide and unmount; borrowed contexts are never closed (C58-T05, C58-T06)
  React.useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopAll("hidden");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(
    () => () => {
      for (const v of pool.current.stopAll()) {
        const h = voices.current.get(v.voiceId);
        if (h?.timer) clearTimeout(h.timer);
        h?.release(ctxRef.current?.ctx.currentTime ?? 0);
      }
      voices.current.clear();
      const entry = ctxRef.current;
      if (entry) {
        entry.master.disconnect();
        if (entry.owned && "close" in entry.ctx && typeof (entry.ctx as { close?: () => Promise<void> }).close === "function") void (entry.ctx as { close: () => Promise<void> }).close();
      }
      ctxRef.current = null;
    },
    [],
  );

  /* activation: one path per input type (C58-T03) */
  const onKeyPointerDown = (note: NoteDefinition) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no focus steal, and the synthetic click must not play again
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // synthetic or already-released pointers (tests, assistive input) have no capture to take
    }
    noteOn(note, 0.8, "pointer");
  };
  const onKeyPointerUp = (note: NoteDefinition) => () => {
    if (latest.current.triggerMode === "sustained") noteOff(note.id, "release");
  };
  const onKeyKeyDown = (note: NoteDefinition) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      noteOn(note, 0.8, "keyboard");
    }
  };
  const onKeyKeyUp = (note: NoteDefinition) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === "Enter" || e.key === " ") && latest.current.triggerMode === "sustained") noteOff(note.id, "release");
  };
  // optional global shortcuts: digits 1–9 map to notes; ignored in text inputs and with modifiers
  React.useEffect(() => {
    if (keyboardMode !== "shortcuts") return;
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const i = parseInt(e.key, 10);
      if (!Number.isFinite(i) || i < 1) return;
      const note = latest.current.notes[i - 1];
      if (note) noteOn(note, 0.8, "shortcut");
    };
    const onUp = (e: KeyboardEvent) => {
      const i = parseInt(e.key, 10);
      const note = Number.isFinite(i) ? latest.current.notes[i - 1] : undefined;
      if (note) noteOff(note.id, "release");
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardMode]);

  const keyRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusKey: (id) => keyRefs.current.get(id)?.focus(), stopAll: () => stopAll("stopAll") }));
  const rootRef = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();
  const glass = variant === "glass-mallet";

  return (
    <div
      ref={rootRef}
      data-slot="glass-keybed"
      data-variant={variant}
      data-motion={mode}
      data-audio={visualOnly ? "visual-only" : audioState}
      data-trigger={triggerMode}
      role="group"
      aria-label={label}
      className={cn("flex w-full flex-col gap-3 text-[var(--cui-key-label,light-dark(#141311,#ecebe6))]", className)}
      {...rest}
    >
      {/* control bar */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {!visualOnly &&
          (enabled && audioState === "ready" ? (
            <button type="button" onClick={disableSound} className={BTN}>
              Disable sound
            </button>
          ) : (
            <button type="button" onClick={() => void enableSound()} disabled={audioState === "enabling"} className={cn(BTN, "bg-[var(--cui-key-active,light-dark(#1a6b45,#5fcf8f))] text-[light-dark(#ffffff,#121210)]")}>
              {audioState === "enabling" ? "Enabling…" : "Enable sound"}
            </button>
          ))}
        <label className="flex items-center gap-1">
          <span>Volume</span>
          <input type="range" aria-label="Volume" min={0} max={1} step={0.01} value={volume} readOnly={true} disabled className="w-20" />
        </label>
        <button type="button" onClick={() => stopAll("stopAll")} className={BTN}>
          Stop all
        </button>
        <span role="status" aria-live="polite" className={cn(blockedReason ? "text-[var(--cui-key-error,light-dark(#b8310c,#ff8a65))]" : "opacity-70")}>
          {visualOnly ? "Visual-only instrument." : blockedReason ? `${blockedReason} Visual-only mode is active.` : audioState === "ready" ? (muted ? "Sound on (muted)." : "Sound on.") : "Silent until you enable sound."}
        </span>
      </div>
      {diagnostics.length > 0 && (
        <div role="note" className="rounded-lg border border-[var(--cui-key-error,light-dark(#b8310c,#ff8a65))] p-2 text-[12px] text-[var(--cui-key-error,light-dark(#b8310c,#ff8a65))]">
          {diagnostics.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
      )}
      {/* keys */}
      <div role="group" aria-label={`${label} keys`} className="flex gap-2 overflow-x-auto pb-2" style={{ perspective: 800 }} data-keys>
        {notes.map((n, i) => {
          const pulse = active[n.id];
          const hue = 200 + (i / Math.max(1, notes.length - 1)) * 120;
          return (
            <button
              key={n.id}
              ref={(el) => {
                if (el) keyRefs.current.set(n.id, el);
                else keyRefs.current.delete(n.id);
              }}
              type="button"
              data-key={n.id}
              data-active={pulse ? "true" : undefined}
              aria-label={`${n.label} note`}
              aria-describedby={`${uid}-hint`}
              onPointerDown={onKeyPointerDown(n)}
              onPointerUp={onKeyPointerUp(n)}
              onPointerCancel={onKeyPointerUp(n)}
              onLostPointerCapture={onKeyPointerUp(n)}
              onKeyDown={onKeyKeyDown(n)}
              onKeyUp={onKeyKeyUp(n)}
              onBlur={() => noteOff(n.id, "blur")}
              className={cn(
                "relative flex h-40 w-14 shrink-0 select-none flex-col items-center justify-end rounded-xl border pb-3 text-[12px] font-medium outline-none touch-none focus-visible:ring-2 focus-visible:ring-[var(--cui-key-focus,light-dark(#141311,#ecebe6))]",
                glass ? "border-[light-dark(rgba(255,255,255,0.6),rgba(255,255,255,0.25))] bg-[var(--cui-key-glass,light-dark(rgba(255,255,255,0.35),rgba(255,255,255,0.1)))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(20,19,17,0.15)] backdrop-blur-md" : "border-[light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45))] bg-[var(--cui-key-glass,light-dark(#faf9f6,#2a2a27))]",
                pulse && (mode === "full" && glass ? "animate-[cui-key-swing_420ms_ease-out]" : "translate-y-[2px]"),
              )}
              style={{ transformOrigin: "top center", ["--cui-key-tint" as string]: `hsl(${hue} 70% 60%)` }}
            >
              <span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-xl", glass ? "bg-[linear-gradient(180deg,transparent,var(--cui-key-tint))] opacity-25" : "")} />
              {pulse && <span key={pulse} aria-hidden data-pulse className={cn("pointer-events-none absolute inset-2 rounded-lg bg-[var(--cui-key-active,light-dark(#1a6b45,#5fcf8f))]", mode === "full" ? "animate-[cui-key-pulse_600ms_ease-out_forwards]" : "opacity-40")} />}
              <span className="relative">{n.label}</span>
            </button>
          );
        })}
      </div>
      <p id={`${uid}-hint`} className="sr-only">
        Press to play. Enter or Space plays from the keyboard.
      </p>
      <style>{`@keyframes cui-key-swing{0%{transform:translateY(4px) rotateX(0deg)}30%{transform:translateY(2px) rotateX(6deg)}60%{transform:translateY(0) rotateX(-3deg)}100%{transform:none}}@keyframes cui-key-pulse{0%{opacity:.7;transform:scale(.6)}100%{opacity:0;transform:scale(1.15)}}`}</style>
    </div>
  );
});
GlassKeybed.displayName = "GlassKeybed";

const BTN =
  "inline-flex h-7 items-center rounded-full border border-[var(--cui-key-focus,light-dark(#141311,#ecebe6))] px-2.5 text-[12px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06))] focus-visible:ring-2 focus-visible:ring-[var(--cui-key-focus,light-dark(#141311,#ecebe6))] disabled:opacity-40";
