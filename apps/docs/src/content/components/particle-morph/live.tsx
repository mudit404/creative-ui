"use client";

import { useRef, useState } from "react";
import { ParticleMorph, type MorphTarget, type ParticleMorphHandle, type ParticleMorphProps } from "@/components/ui/particle-morph";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

const svg = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>${body}</svg>`)}`;
const star = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 48 : 110;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${128 + r * Math.cos(a)},${128 + r * Math.sin(a)}`);
  }
  return pts.join(" ");
})();
const spiral = (() => {
  const n = 3000;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 8;
    const r = 0.15 + (i / n) * 0.8;
    p[i * 3] = Math.cos(t) * r;
    p[i * 3 + 1] = Math.sin(t) * r;
    p[i * 3 + 2] = (i / n - 0.5) * 0.4;
  }
  return p;
})();
export const TARGETS: MorphTarget[] = [
  { id: "disc", label: "Disc", type: "image", src: svg("<circle cx='128' cy='128' r='96' fill='#c8360d'/>"), fallback: svg("<circle cx='128' cy='128' r='96' fill='#c8360d'/>") },
  { id: "star", label: "Star", type: "image", src: svg(`<polygon points='${star}' fill='#1f7a4f'/>`), fallback: svg(`<polygon points='${star}' fill='#1f7a4f'/>`) },
  { id: "ring", label: "Ring", type: "image", src: svg("<circle cx='128' cy='128' r='84' fill='none' stroke='#1b4a8a' stroke-width='36'/>"), fallback: svg("<circle cx='128' cy='128' r='84' fill='none' stroke='#1b4a8a' stroke-width='36'/>") },
  { id: "spiral", label: "Spiral", type: "points", points: spiral, fallback: svg("<text x='128' y='140' text-anchor='middle' font-size='40' font-family='ui-sans-serif'>Spiral</text>") },
];
const MISSING: MorphTarget = { id: "missing", label: "Missing asset", type: "image", src: "/media/does-not-exist.png", fallback: svg("<rect x='40' y='40' width='176' height='176' rx='24' fill='#efede8' stroke='#c8360d' stroke-width='6'/><text x='128' y='140' text-anchor='middle' font-size='24' font-family='ui-sans-serif'>Missing</text>") };

function useMorphLog() {
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((l) => [s, ...l].slice(0, 8));
  const handlers: Partial<ParticleMorphProps> = {
    onTargetRequest: (id) => push(`onTargetRequest(${id})`),
    onTargetReady: (id) => push(`onTargetReady(${id})`),
    onTargetError: (id, m) => push(`onTargetError(${id}): ${m}`),
    onMorphComplete: (id, rev) => push(`onMorphComplete(${id}, rev ${rev})`),
  };
  return { log, handlers };
}

function PlaygroundMorph({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<ParticleMorphProps>;
  const { log, handlers } = useMorphLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <ParticleMorph targets={TARGETS} {...handlers} {...props} className="h-72" />
      <EventLog entries={log} />
    </div>
  );
}

function Emblems() {
  const { log, handlers } = useMorphLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <ParticleMorph targets={TARGETS} pointCount={8000} {...handlers} className="h-80" />
      <EventLog entries={log} />
    </div>
  );
}

function Rapid() {
  const ref = useRef<ParticleMorphHandle>(null);
  const { log, handlers } = useMorphLog();
  const burst = () => {
    for (let i = 0; i < 20; i++) setTimeout(() => ref.current?.requestTarget(i % 2 ? "star" : "ring"), i * 20);
  };
  return (
    <div className="flex w-full flex-col gap-3">
      <ParticleMorph ref={ref} targets={TARGETS} pointCount={6000} showControls={false} {...handlers} className="h-64" />
      <button type="button" onClick={burst} className="self-start rounded-full border border-[light-dark(rgba(20,19,17,0.25),rgba(236,235,230,0.25))] px-3 py-1 text-[12px] hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.08))]">
        Fire 20 requests (ends on Star)
      </button>
      <EventLog entries={log} />
    </div>
  );
}

function Missing() {
  const { log, handlers } = useMorphLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <ParticleMorph targets={[...TARGETS.slice(0, 2), MISSING]} pointCount={6000} {...handlers} className="h-64" />
      <EventLog entries={log} />
    </div>
  );
}

export const particleMorphLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundMorph values={values} />,
  cardPreview: () => <ParticleMorph targets={TARGETS.slice(0, 2)} pointCount={2000} showControls={false} className="h-40" />,
  examples: {
    emblems: () => <Emblems />,
    rapid: () => <Rapid />,
    missing: () => <Missing />,
    fallback: () => <ParticleMorph targets={TARGETS} renderer="none" pointCount={2000} className="h-64" />,
  },
};
