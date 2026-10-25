"use client";

import { useRef, useState } from "react";
import { ScrollFilm, type Chapter, type ScrollFilmProps, type TimeState } from "@/components/ui/scroll-film";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { posterSvg } from "~/content/fixtures/three-models";

export const FILM = "/media/film.webm";
export const POSTER = posterSvg("Desk speaker assembly film", 230);
export const CHAPTERS: Chapter[] = [
  { id: "unboxing", label: "Unboxing", startTime: 0, endTime: 4 },
  { id: "assembly", label: "Assembly", startTime: 4, endTime: 8 },
  { id: "finish", label: "Finish", startTime: 8 },
];
const Transcript = () => (
  <ol className="m-0 pl-4">
    <li>0:00 — The speaker arrives in two boxes: cabinet and base.</li>
    <li>0:04 — The baffle slides onto the cabinet; the drivers click into their cutouts.</li>
    <li>0:08 — The brass knob and the badge finish the front; the cable loops at the rear.</li>
  </ol>
);

function PlaygroundFilm({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<ScrollFilmProps>;
  const [state, setState] = useState<TimeState | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrap} className="flex w-full flex-col gap-2">
      <ScrollFilm src={FILM} poster={POSTER} description="Assembling the desk speaker" chapters={CHAPTERS} transcript={<Transcript />} onTimeState={setState} {...props} />
      <pre className="m-0 rounded-lg bg-[light-dark(rgba(20,19,17,0.05),rgba(236,235,230,0.05))] p-2 font-mono text-[11px]" data-time-state>
        {state ? `mode=${state.mode} requested=${state.requested?.toFixed(2) ?? "—"} presented=${state.presented?.toFixed(2) ?? "—"} seeking=${state.seeking} buffering=${state.buffering} gen=${state.generation}` : "no time state yet"}
      </pre>
    </div>
  );
}

function Replace() {
  const [src, setSrc] = useState(FILM);
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-2">
      <button type="button" onClick={() => setSrc((s) => (s === FILM ? `${FILM}?v=2` : FILM))} className="self-start rounded-full border border-current px-4 py-1.5 text-sm">
        Swap source ({src.endsWith("?v=2") ? "B" : "A"})
      </button>
      <ScrollFilm variant="inline" src={src} poster={POSTER} description="Assembling the desk speaker" chapters={CHAPTERS} transcript={<Transcript />} onTimeState={(s) => setLog((l) => [`gen ${s.generation} · requested ${s.requested?.toFixed(2) ?? "—"}`, ...l].slice(0, 4))} />
      <ol className="m-0 list-none p-0 font-mono text-[11px] opacity-70">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </div>
  );
}

export const scrollFilmLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundFilm key={String(values.variant)} values={values} />,
  cardPreview: () => (
    <div className="flex w-56 flex-col gap-1.5" aria-hidden>
      <div className="relative aspect-video rounded-lg bg-[#1d2a6b]">
        <span className="absolute left-3 top-3 size-4 rounded-full bg-[#faf9f6]" />
        <span className="absolute inset-x-0 bottom-0 h-1 w-1/3 bg-[#c8f55a]" />
      </div>
      <div className="flex gap-1">
        {["Unboxing", "Assembly", "Finish"].map((c, i) => (
          <span key={c} className={`rounded-full px-2 py-0.5 text-[9px] ${i === 0 ? "bg-[light-dark(#141311,#ecebe6)] text-[light-dark(#faf9f6,#141311)]" : "border border-[light-dark(rgba(20,19,17,0.3),rgba(236,235,230,0.3))]"}`}>
            {c}
          </span>
        ))}
      </div>
    </div>
  ),
  examples: {
    story: () => <ScrollFilm src={FILM} poster={POSTER} description="Assembling the desk speaker" chapters={CHAPTERS} transcript={<Transcript />} scrollLength={2.5} />,
    failed: () => <ScrollFilm variant="inline" src="/media/does-not-exist.webm" poster={POSTER} description="A film that will not load" chapters={CHAPTERS} transcript={<Transcript />} />,
    replace: () => <Replace />,
    native: () => <ScrollFilm variant="native" src={FILM} poster={POSTER} description="Assembling the desk speaker" chapters={CHAPTERS} transcript={<Transcript />} />,
  },
};
