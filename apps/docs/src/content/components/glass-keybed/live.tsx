"use client";

import { useState } from "react";
import { GlassKeybed, type AudioLike, type GlassKeybedProps } from "@/components/ui/glass-keybed";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

function useNoteLog() {
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((l) => [s, ...l].slice(0, 8));
  const handlers: Partial<GlassKeybedProps> = {
    onNoteOn: (p) => push(`onNoteOn(${p.noteId}, v${p.velocity}, ${p.origin})`),
    onNoteOff: (p) => push(`onNoteOff(${p.noteId}, ${p.reason})`),
    onSoundEnabledChange: (on, reason) => push(`onSoundEnabledChange(${on}, ${reason})`),
  };
  return { log, handlers };
}

function PlaygroundKeybed({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<GlassKeybedProps>;
  const { log, handlers } = useNoteLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <GlassKeybed {...handlers} {...props} />
      <EventLog entries={log} />
    </div>
  );
}

function Logged(props: Partial<GlassKeybedProps>) {
  const { log, handlers } = useNoteLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <GlassKeybed {...handlers} {...props} />
      <EventLog entries={log} />
    </div>
  );
}

/** A context that stays suspended: what a blocked autoplay policy looks like. */
function blockedContext(): AudioLike {
  const real = new window.AudioContext();
  const proxy: AudioLike = {
    get state() {
      return "suspended" as AudioContextState;
    },
    get currentTime() {
      return real.currentTime;
    },
    destination: real.destination,
    resume: async () => {},
    createGain: () => real.createGain(),
    createOscillator: () => real.createOscillator(),
  };
  return proxy;
}

export const glassKeybedLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundKeybed values={values} />,
  cardPreview: () => <GlassKeybed variant="visual-only" notes={[{ id: "c4", label: "C4", frequency: 261.63 }, { id: "e4", label: "E4", frequency: 329.63 }, { id: "g4", label: "G4", frequency: 392 }]} label="Preview" />,
  examples: {
    glass: () => <Logged />,
    sustained: () => <Logged variant="opaque-accessible" triggerMode="sustained" polyphony={3} />,
    visual: () => <Logged variant="visual-only" />,
    blocked: () => <Logged createAudioContext={blockedContext} label="Blocked keybed" />,
  },
};
