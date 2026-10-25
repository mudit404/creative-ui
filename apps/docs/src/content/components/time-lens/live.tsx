"use client";

import { useState } from "react";
import { TimeLens, type TimeEvent, type TimeLensProps, type TimeWindow } from "@/components/ui/time-lens";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

const H = 36e5;
export const T0 = Date.UTC(2026, 2, 8, 0, 0); // 8 March 2026, DST transition in New York
export const DAY: TimeWindow = [T0, T0 + 24 * H];
export const INCIDENTS: TimeEvent[] = [
  { id: "deploy", startMs: T0 + 2 * H, label: "Deploy 2.4", details: "Rolled out to 100% of regions." },
  { id: "alarm", startMs: T0 + 6.5 * H, label: "Alarm fired", severity: "warning" },
  { id: "latency", startMs: T0 + 6.5 * H, endMs: T0 + 8 * H, label: "API latency above SLO", severity: "major", details: "p95 above 2 s on the EU edge." },
  { id: "rollback", startMs: T0 + 7.5 * H, label: "Rollback to 2.3" },
  { id: "db", startMs: T0 + 7 * H, endMs: T0 + 9.25 * H, label: "Database failover with a deliberately long title that keeps going", severity: "critical" },
  { id: "resolved", startMs: T0 + 9.25 * H, label: "Resolved" },
  { id: "post", startMs: T0 + 20 * H, endMs: T0 + 21 * H, label: "Postmortem" },
];

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const WEEK: TimeWindow = [T0, T0 + 7 * 24 * H];
const rand = mulberry(42);
export const FIVE_HUNDRED: TimeEvent[] = Array.from({ length: 500 }, (_, i) => {
  const start = T0 + rand() * 7 * 24 * H;
  const dur = rand() < 0.3 ? rand() * 3 * H : 0;
  return { id: `e${i}`, startMs: Math.round(start), endMs: dur ? Math.round(start + dur) : undefined, label: `${["Build", "Deploy", "Alert", "Scale", "Backup", "Review"][i % 6]} #${i} ${i % 17 === 0 ? "with an unusually long descriptive title for truncation" : ""}`.trim() };
});

function PlaygroundLens({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<TimeLensProps>;
  const [log, setLog] = useState<string[]>([]);
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 6));
  const iso = (w: TimeWindow) => `${new Date(w[0]).toISOString().slice(11, 16)}–${new Date(w[1]).toISOString().slice(11, 16)}Z`;
  return (
    <div className="flex w-full flex-col gap-3">
      <TimeLens events={INCIDENTS} domain={DAY} defaultWindow={[T0 + 5 * H, T0 + 11 * H]} onWindowCommit={(w, s) => push(`commit ${iso(w)} · ${s}`)} onSelectedIdChange={(id, r) => push(`select ${id ?? "none"} · ${r}`)} {...props} />
      <EventLog entries={log} />
    </div>
  );
}

function Incidents() {
  const [zone, setZone] = useState("America/New_York");
  return (
    <div className="flex w-full flex-col gap-3">
      <div role="group" aria-label="Display zone" className="flex gap-2 text-[12px]">
        {["UTC", "America/New_York"].map((z) => (
          <button key={z} type="button" aria-pressed={zone === z} onClick={() => setZone(z)} className="rounded-full border border-current px-3 py-1 aria-pressed:bg-[light-dark(#141311,#ecebe6)] aria-pressed:text-[light-dark(#faf9f6,#141311)]">
            {z}
          </button>
        ))}
      </div>
      <TimeLens events={INCIDENTS} domain={DAY} timeZone={zone} minSpan={5 * 60_000} defaultWindow={[T0 + 6 * H, T0 + 10 * H]} />
    </div>
  );
}

function Controlled() {
  const [win, setWin] = useState<TimeWindow>([T0 + 4 * H, T0 + 12 * H]);
  const [log, setLog] = useState<string[]>([]);
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 6));
  const iso = (w: TimeWindow) => `${new Date(w[0]).toISOString().slice(11, 19)}–${new Date(w[1]).toISOString().slice(11, 19)}Z`;
  return (
    <div className="flex w-full flex-col gap-3">
      <TimeLens
        events={[...INCIDENTS, { id: "broken", startMs: T0 + 5 * H, endMs: T0 + 4 * H, label: "Ends before it starts" }]}
        domain={DAY}
        window={win}
        onWindowPreview={(w) => push(`preview ${iso(w)}`)}
        onWindowCommit={(w, s) => {
          setWin(w);
          push(`commit ${iso(w)} · ${s}`);
        }}
      />
      <EventLog entries={log} />
    </div>
  );
}

export const timeLensLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundLens values={values} />,
  cardPreview: () => (
    <div className="flex w-56 flex-col gap-1.5" aria-hidden>
      <div className="relative h-6 rounded bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.08))]">
        <div className="absolute inset-y-0 left-[30%] w-[35%] border-x-2 border-[light-dark(#1a6b45,#5fcf8f)] bg-[light-dark(rgba(26,107,69,0.15),rgba(95,207,143,0.2))]" />
      </div>
      <div className="relative h-12 rounded border border-[light-dark(rgba(20,19,17,0.12),rgba(236,235,230,0.12))]">
        {[10, 35, 55, 80].map((x, i) => (
          <span key={x} className="absolute h-2.5 rounded-full bg-[light-dark(#141311,#ecebe6)]" style={{ left: `${x}%`, top: 8 + (i % 2) * 14, width: i % 2 ? 30 : 10 }} />
        ))}
      </div>
    </div>
  ),
  examples: {
    incidents: () => <Incidents />,
    stress: () => <TimeLens events={FIVE_HUNDRED} domain={WEEK} variant="history" defaultWindow={[T0 + 24 * H, T0 + 48 * H]} />,
    controlled: () => <Controlled />,
  },
};
