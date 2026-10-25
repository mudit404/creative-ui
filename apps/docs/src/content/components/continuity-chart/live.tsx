"use client";

import { ContinuityChart, type ContinuityChartProps, type Snapshot } from "@/components/ui/continuity-chart";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

const CATS = ["Price", "Battery", "Camera", "Screen", "Weight", "Speed", "Storage", "Support", "Design", "Durability", "Audio", "Software"];
const mk = (id: string, label: string, values: (number | null)[], unit = "%"): Snapshot => ({ id, label, unit, rows: CATS.slice(0, values.length).map((c, i) => ({ id: c.toLowerCase(), label: c, value: values[i]! })) });
export const QUARTERS: Snapshot[] = [
  mk("q1", "Q1 2026", [42, 38, 55, 21, 12, 47, 33, 9, 26, 18, 14, 30]),
  mk("q2", "Q2 2026", [35, 44, 58, 25, 15, 39, 40, 11, 31, 22, 17, 28]),
  { ...mk("q3", "Q3 2026", [30, 51, 49, 29, 15, 36, 45, 13, 34, 27, 19]), rows: [...mk("q3", "Q3 2026", [30, 51, 49, 29, 15, 36, 45, 13, 34, 27, 19]).rows, { id: "privacy", label: "Privacy", value: 24 }] }, // Software leaves, Privacy enters
];
const DELTAS: Snapshot = { id: "d", label: "Change vs last quarter", unit: "pts", rows: [{ id: "price", label: "Price", value: -7 }, { id: "battery", label: "Battery", value: 6 }, { id: "camera", label: "Camera", value: 3 }, { id: "screen", label: "Screen", value: 3 }, { id: "weight", label: "Weight", value: null }, { id: "speed", label: "Speed", value: -8 }, { id: "storage", label: "Storage", value: 0 }] };

function PlaygroundChart({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<ContinuityChartProps>;
  return (
    <div className="w-full">
      <ContinuityChart snapshots={QUARTERS} summary="Share of respondents naming each factor as decisive, by quarter" {...props} />
    </div>
  );
}

export const continuityChartLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundChart key={`${values.defaultMode}-${values.sort}-${values.defaultShowTable}`} values={values} />,
  cardPreview: () => (
    <div className="flex w-56 flex-col gap-1.5" aria-hidden>
      {[["#ff4d1c", 90], ["#1d2a6b", 70], ["#1f7a4f", 55], ["#c8a000", 30]].map(([c, w]) => (
        <div key={c as string} className="flex items-center gap-2">
          <span className="h-2 w-10 rounded bg-[rgba(20,19,17,0.15)]" />
          <span className="h-3 rounded-sm" style={{ width: `${w}%`, background: c as string }} />
        </div>
      ))}
    </div>
  ),
  examples: {
    ranking: () => <ContinuityChart snapshots={QUARTERS} summary="Share of respondents naming each factor as decisive, by quarter" />,
    negative: () => <ContinuityChart variant="comparison" snapshots={[DELTAS]} summary="Change in score versus last quarter; Weight was not measured" />,
    units: () => <ContinuityChart snapshots={[QUARTERS[0]!, { ...QUARTERS[1]!, id: "pts", label: "Points", unit: "pts" }]} summary="A chart that refuses to compare percent with points" />,
  },
};
