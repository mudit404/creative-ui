"use client";

import { useState } from "react";
import { GhostTraceText, type GhostTraceTextProps } from "@/components/ui/ghost-trace-text";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

const display = "display text-[clamp(2.5rem,7vw,5rem)] leading-none text-[#141311]";
const sans = "text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-none tracking-tight text-[#141311]";

function toProps(values: PlaygroundValues): GhostTraceTextProps & { font?: string } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if ((k === "ghost" || k === "fill") && (typeof v !== "string" || !v.trim())) continue;
    out[k] = v;
  }
  return out as unknown as GhostTraceTextProps & { font?: string };
}

function ManualDemo() {
  const [play, setPlay] = useState(false);
  return (
    <div className="flex flex-col items-center gap-6">
      <GhostTraceText trigger="manual" play={play} className={display}>
        Press play
      </GhostTraceText>
      <button
        type="button"
        className="rounded-full border border-[#141311] px-4 py-1.5 text-sm text-[#141311]"
        onClick={() => {
          setPlay(false);
          requestAnimationFrame(() => setPlay(true));
        }}
      >
        Replay
      </button>
    </div>
  );
}

export const ghostTraceTextLive: LiveModule = {
  renderPlayground: (values) => {
    const { font, children, ...props } = toProps(values);
    return (
      <GhostTraceText {...props} className={font === "sans" ? sans : display}>
        {String(children ?? "").replace(/\\n/g, "\n")}
      </GhostTraceText>
    );
  },
  cardPreview: () => (
    <GhostTraceText trigger="inView" repeat className="display text-[44px] leading-none text-[#141311]" duration={1.4}>
      Ghost trace
    </GhostTraceText>
  ),
  examples: {
    basic: () => (
      <GhostTraceText as="h1" className={display} repeat>
        Make it move
      </GhostTraceText>
    ),
    lines: () => (
      <GhostTraceText as="h2" className={display} stagger={0.5} repeat>
        {["Designed to", "be touched."]}
      </GhostTraceText>
    ),
    ghost: () => (
      <GhostTraceText className={display} ghost="#ff4d1c" fill="#141311" strokeWidth={1.5} keepStroke repeat>
        Outline and ink
      </GhostTraceText>
    ),
    manual: () => <ManualDemo />,
    sans: () => (
      <GhostTraceText className={sans} duration={2.4} strokeWidth={2} repeat>
        HEAVY
      </GhostTraceText>
    ),
  },
};
