"use client";

import { useState } from "react";
import { DetentDial, type DetentDialProps } from "@/components/ui/detent-dial";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

const PLAYGROUND_DETENTS = [0, 25, 50, 75, 100];

function PlaygroundDial({ values }: { values: PlaygroundValues }) {
  const props = values as unknown as Omit<DetentDialProps, "label">;
  const [log, setLog] = useState<string[]>([]);
  const [previews, setPreviews] = useState(0);
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const detents = PLAYGROUND_DETENTS.map((p) => min + ((max - min) * p) / 100).map((v) => Math.round(v * 10) / 10);
  const key = `${props.variant}-${props.scale}-${min}-${max}-${props.step}`;
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <DetentDial
        key={key}
        label="Level"
        defaultValue={detents[2]}
        detents={detents}
        {...props}
        onValuePreview={() => setPreviews((n) => n + 1)}
        onValueCommit={(v, meta) => setLog((l) => [`commit ${v} · ${meta.source}${meta.detent ? " · detent" : ""}`, ...l].slice(0, 8))}
      />
      <div className="flex w-full items-center justify-between font-mono text-[11px] opacity-70">
        <span>previews: {previews}</span>
        <span>commits: {log.length}</span>
      </div>
      <EventLog entries={log} />
    </div>
  );
}

function Basic() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <DetentDial label="Gain" unit="dB" min={-60} max={12} step={1} detents={[-12, -6, 0, 6]} defaultValue={-6} resetValue={0} onValueCommit={(v, meta) => setLog((l) => [`commit ${v} dB · ${meta.source}${meta.detent ? " · detent" : ""}`, ...l].slice(0, 5))} />
      <EventLog entries={log} />
    </div>
  );
}

function Clamped() {
  const [v, setV] = useState(50);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-col items-center gap-3">
      <DetentDial
        label="Clamped"
        value={v}
        onValueCommit={(next) => {
          const c = Math.min(80, Math.max(20, next));
          setV(c);
          setMsg(c === next ? `accepted ${next}` : `clamped ${next} → ${c}`);
        }}
      />
      <p className="m-0 font-mono text-[12px]" aria-live="polite">
        {msg || "parent clamps to 20–80"}
      </p>
    </div>
  );
}

const QUALITY = ["Draft", "Low", "Medium", "High", "Ultra"];

export const detentDialLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundDial values={values} />,
  cardPreview: () => <DetentDial label="Preview" defaultValue={62} detents={[0, 50, 100]} showInput={false} showStepButtons={false} showReset={false} />,
  examples: {
    basic: () => <Basic />,
    log: () => <DetentDial label="Frequency" unit="Hz" scale="log" min={20} max={20000} step={1} detents={[100, 1000, 10000]} defaultValue={1000} />,
    diagnostic: () => <DetentDial label="Broken" scale="log" min={0} max={1000} defaultValue={500} />,
    stepped: () => <DetentDial label="Quality" variant="stepped" detents={[0, 25, 50, 75, 100]} defaultValue={50} formatValue={(v) => QUALITY[Math.round(v / 25)] ?? String(v)} />,
    controlled: () => <Clamped />,
    studio: () => (
      <div className="flex items-start gap-8">
        <DetentDial label="Pan" variant="studio" size="compact" min={-100} max={100} defaultValue={0} detents={[0]} wheel="focused" />
        <DetentDial label="Send" variant="studio" size="compact" defaultValue={30} wheel="focused" />
      </div>
    ),
  },
};
