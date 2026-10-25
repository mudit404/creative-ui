"use client";

import { useEffect, useState } from "react";
import { SplitFlapBoard, type SplitFlapBoardProps } from "@/components/ui/split-flap-board";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

const BTN = "rounded-full border border-[rgba(20,19,17,0.25)] px-3 py-1 text-[12px] hover:bg-[rgba(20,19,17,0.06)]";

function PlaygroundBoard({ values }: { values: PlaygroundValues }) {
  const { value, ...rest } = values as Partial<SplitFlapBoardProps> & { value?: string | number };
  return <SplitFlapBoard value={value ?? ""} {...rest} />;
}

function Counter() {
  const [count, setCount] = useState(1234);
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-3">
      <SplitFlapBoard variant="numeric" value={count} cells={6} label="Counter" onSettled={(v) => setLog((l) => [`onSettled(${v})`, ...l].slice(0, 6))} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={() => setCount((c) => c + 1)}>+1</button>
        <button type="button" className={BTN} onClick={() => setCount((c) => c + 137)}>+137</button>
        <button type="button" className={BTN} onClick={() => { setCount((c) => c + 1000); setTimeout(() => setCount((c) => c + 5), 60); }}>+1000 then +5 (interrupt)</button>
        <button type="button" className={BTN} onClick={() => setCount(Number.NaN)}>NaN</button>
        <button type="button" className={BTN} onClick={() => setCount(0)}>Reset</button>
      </div>
      <p className="m-0 font-mono text-[11px] opacity-70">value: {String(count)}</p>
      <EventLog entries={log} />
    </div>
  );
}

const STATUSES = ["ON TIME", "BOARDING", "DELAYED", "GATE B12", "DEPARTED"];
const ROWS: [string, string, string][] = [
  ["09:40", "LHR", "LONDON"],
  ["09:55", "CDG", "PARIS"],
  ["10:10", "AMS", "AMSTERDAM"],
];
function Departures() {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex w-full flex-col gap-3">
      <div role="table" aria-label="Departures" className="grid grid-cols-[auto_auto_1fr_auto] gap-x-4 gap-y-2">
        {ROWS.map(([time, code, city], i) => (
          <div role="row" key={code} className="contents">
            <SplitFlapBoard value={time} cells={5} label={`${city} departure time`} paused={paused} />
            <SplitFlapBoard value={code} cells={3} label={`${city} code`} paused={paused} />
            <SplitFlapBoard value={city} cells={10} label="Destination" paused={paused} />
            <SplitFlapBoard value={STATUSES[(tick + i) % STATUSES.length]!} cells={8} label={`${city} status`} paused={paused} />
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12px]">
        <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause flaps (text still updates)
      </label>
    </div>
  );
}

function Scripts() {
  const [i, setI] = useState(0);
  const values = ["WELCOME", "مرحبا", "स्वागत है", "WILLKOMMEN"];
  return (
    <div className="flex w-full flex-col gap-3">
      <SplitFlapBoard value={values[i % values.length]!} cells={12} label="Greeting" />
      <button type="button" className={`${BTN} self-start`} onClick={() => setI((n) => n + 1)}>Next language</button>
    </div>
  );
}

function Reduced() {
  const [v, setV] = useState("READY");
  return (
    <div className="flex w-full flex-col gap-3">
      <SplitFlapBoard value={v} cells={8} motion="reduced" announce="polite" label="Reduced board" />
      <button type="button" className={`${BTN} self-start`} onClick={() => setV((x) => (x === "READY" ? "RUNNING" : "READY"))}>Toggle</button>
    </div>
  );
}

export const splitFlapBoardLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundBoard values={values} />,
  cardPreview: () => <SplitFlapBoard value="ON TIME" cells={7} animateOnMount label="Preview" />,
  examples: {
    counter: () => <Counter />,
    departures: () => <Departures />,
    scripts: () => <Scripts />,
    reduced: () => <Reduced />,
  },
};
