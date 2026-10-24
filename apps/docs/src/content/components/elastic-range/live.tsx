"use client";

import { useState } from "react";
import { ElasticRange, type ElasticRangeMeta, type ElasticRangeProps, type ElasticRangeValue } from "@/components/ui/elastic-range";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

export function EventLog({ entries }: { entries: string[] }) {
  return (
    <ol aria-label="Event log" className="m-0 max-h-28 w-full list-none overflow-y-auto rounded-lg bg-[rgba(20,19,17,0.05)] p-2 font-mono text-[11px] leading-relaxed">
      {entries.length === 0 && <li className="opacity-50">no commits yet</li>}
      {entries.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ol>
  );
}

function fmt(v: ElasticRangeValue) {
  return Array.isArray(v) ? `[${v[0]}, ${v[1]}]` : String(v);
}

function PlaygroundRange({ values }: { values: PlaygroundValues }) {
  const props = values as unknown as Omit<ElasticRangeProps, "labels">;
  const [log, setLog] = useState<string[]>([]);
  const [previews, setPreviews] = useState(0);
  const key = `${props.variant}-${props.min}-${props.max}-${props.step}`;
  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <ElasticRange
        key={key}
        labels={{ label: props.variant === "interval" ? "Range" : "Value" }}
        defaultValue={props.variant === "interval" ? undefined : ((props.min ?? 0) + (props.max ?? 100)) / 2}
        {...props}
        onValuePreview={() => setPreviews((n) => n + 1)}
        onValueCommit={(v, meta: ElasticRangeMeta) => setLog((l) => [`commit ${fmt(v)} · ${meta.source}${meta.thumb && props.variant === "interval" ? ` · ${meta.thumb}` : ""}`, ...l].slice(0, 8))}
      />
      <div className="flex items-center justify-between font-mono text-[11px] opacity-70">
        <span>previews: {previews}</span>
        <span>commits: {log.length}</span>
      </div>
      <EventLog entries={log} />
    </div>
  );
}

function Basic() {
  const [v, setV] = useState<number>(40);
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <ElasticRange
        labels={{ label: "Volume" }}
        value={v}
        onValueCommit={(next, meta) => {
          setV(next as number);
          setLog((l) => [`commit ${next} · ${meta.source}`, ...l].slice(0, 5));
        }}
      />
      <EventLog entries={log} />
    </div>
  );
}

function Refusing() {
  const [v, setV] = useState(50);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <ElasticRange
        labels={{ label: "Allocation" }}
        value={v}
        onValueCommit={(next) => {
          const n = next as number;
          if (n % 10 === 0) {
            setV(n);
            setMsg(`accepted ${n}`);
          } else setMsg(`refused ${n}: only multiples of 10`);
        }}
      />
      <p className="m-0 font-mono text-[12px]" aria-live="polite">
        {msg || "parent accepts multiples of 10"}
      </p>
    </div>
  );
}

export const elasticRangeLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundRange values={values} />,
  cardPreview: () => (
    <div className="w-56">
      <ElasticRange variant="interval" labels={{ label: "Preview" }} defaultValue={[25, 70]} showInput={false} showStepButtons={false} />
    </div>
  ),
  examples: {
    basic: () => <Basic />,
    interval: () => (
      <div className="w-full max-w-lg">
        <ElasticRange variant="interval" labels={{ label: "Price", lower: "Minimum price", upper: "Maximum price" }} min={0} max={1000} step={10} minGap={50} defaultValue={[200, 650]} formatValue={(v) => `€${v}`} />
      </div>
    ),
    precision: () => (
      <div className="w-full max-w-md">
        <ElasticRange variant="precision" labels={{ label: "Gain" }} min={0} max={1} step={0.1} defaultValue={0.3} />
      </div>
    ),
    controlled: () => <Refusing />,
    form: () => (
      <form
        className="flex w-full max-w-lg flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          alert([...new FormData(e.currentTarget)].map(([k, v]) => `${k}=${v}`).join("&"));
        }}
      >
        <ElasticRange variant="interval" name="budget" labels={{ label: "Budget" }} defaultValue={[20, 60]} />
        <div className="flex gap-2">
          <button type="submit" className="rounded-full bg-[#141311] px-4 py-1.5 text-sm text-[#faf9f6]">
            Save
          </button>
          <button type="reset" className="rounded-full border border-current px-4 py-1.5 text-sm">
            Reset
          </button>
        </div>
      </form>
    ),
    states: () => (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ElasticRange labels={{ label: "Disabled" }} defaultValue={30} disabled />
        <ElasticRange labels={{ label: "Read only" }} defaultValue={70} readOnly />
      </div>
    ),
  },
};
