/**
 * Voice bookkeeping for GlassKeybed: bounded polyphony with oldest-eligible
 * eviction, note validation and the percussive envelope shape. Pure; the
 * Web Audio adapter lives in the component.
 */

export interface NoteDefinition {
  id: string;
  label: string;
  /** Hz, finite and positive. */
  frequency: number;
}

export interface Voice {
  voiceId: string;
  noteId: string;
  velocity: number;
  startedAt: number;
  /** Sustained voices wait for noteOff; percussive ones expire by envelope. */
  sustained: boolean;
}

export function validateNotes(notes: readonly NoteDefinition[], range: [number, number] = [80, 2000]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const n of notes) {
    if (ids.has(n.id)) out.push(`Duplicate note id "${n.id}".`);
    ids.add(n.id);
    if (!Number.isFinite(n.frequency) || n.frequency <= 0) out.push(`Note "${n.id}" needs a finite positive frequency.`);
    else if (n.frequency < range[0] || n.frequency > range[1]) out.push(`Note "${n.id}" (${n.frequency} Hz) is outside the supported ${range[0]}–${range[1]} Hz range.`);
  }
  return out;
}

export const clampVelocity = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8);

export interface VoicePool {
  /** Register a voice; returns the voice and any evicted voice ids (oldest first). */
  noteOn(noteId: string, velocity: number, sustained: boolean, now: number): { voice: Voice; evicted: Voice[] };
  noteOff(voiceId: string): Voice | null;
  /** Remove every voice; returns them so the adapter can release each. */
  stopAll(): Voice[];
  active(): Voice[];
  size(): number;
}

let voiceCounter = 0;

/** Bounded pool: exceeding `max` evicts the oldest voice (C58-T04). */
export function createVoicePool(max: number): VoicePool {
  const voices: Voice[] = [];
  const cap = Math.max(1, Math.floor(max));
  return {
    noteOn(noteId, velocity, sustained, now) {
      const evicted: Voice[] = [];
      while (voices.length >= cap) evicted.push(voices.shift()!);
      const voice: Voice = { voiceId: `v${++voiceCounter}`, noteId, velocity: clampVelocity(velocity), startedAt: now, sustained };
      voices.push(voice);
      return { voice, evicted };
    },
    noteOff(voiceId) {
      const i = voices.findIndex((v) => v.voiceId === voiceId);
      if (i === -1) return null;
      return voices.splice(i, 1)[0]!;
    },
    stopAll() {
      return voices.splice(0, voices.length);
    },
    active: () => [...voices],
    size: () => voices.length,
  };
}

/** Percussive mallet envelope in seconds: fast attack, exponential-ish decay scaled by velocity. */
export function malletEnvelope(velocity: number): { attack: number; decay: number; peak: number } {
  const v = clampVelocity(velocity);
  return { attack: 0.004, decay: 0.45 + v * 0.55, peak: 0.15 + v * 0.6 };
}

/** Default eight-note example set (C major-ish pentatonic plus octave), within 80–2000 Hz. */
export const DEFAULT_NOTES: NoteDefinition[] = [
  { id: "c4", label: "C4", frequency: 261.63 },
  { id: "d4", label: "D4", frequency: 293.66 },
  { id: "e4", label: "E4", frequency: 329.63 },
  { id: "g4", label: "G4", frequency: 392.0 },
  { id: "a4", label: "A4", frequency: 440.0 },
  { id: "c5", label: "C5", frequency: 523.25 },
  { id: "d5", label: "D5", frequency: 587.33 },
  { id: "e5", label: "E5", frequency: 659.25 },
];
