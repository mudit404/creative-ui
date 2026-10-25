"use client";

import { useEffect, useRef, useState } from "react";
import { CablePatchbay, type CablePatchbayProps, type ConnectIntent, type Connection, type DisconnectIntent, type Port, type ReconnectIntent, type Resolution } from "@/components/ui/cable-patchbay";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

export const PORTS: Port[] = [
  { id: "osc", nodeId: "osc", label: "Osc out", direction: "output", dataType: "audio" },
  { id: "noise", nodeId: "noise", label: "Noise out", direction: "output", dataType: "audio" },
  { id: "lfo", nodeId: "lfo", label: "LFO out", direction: "output", dataType: "cv" },
  { id: "env", nodeId: "lfo", label: "Envelope out", direction: "output", dataType: "cv" },
  { id: "amp", nodeId: "amp", label: "Amp in", direction: "input", dataType: "audio" },
  { id: "gain", nodeId: "amp", label: "Gain cv", direction: "input", dataType: "cv" },
  { id: "fx", nodeId: "fx", label: "FX in", direction: "input", dataType: "audio" },
  { id: "cutoff", nodeId: "filter", label: "Cutoff cv", direction: "input", dataType: "cv" },
  { id: "rec", nodeId: "rec", label: "Rec in", direction: "input", dataType: "audio" },
];
export const MODULES = [
  { id: "osc", label: "Oscillator" },
  { id: "noise", label: "Noise" },
  { id: "lfo", label: "Modulators" },
  { id: "amp", label: "Amplifier" },
  { id: "fx", label: "Effects" },
  { id: "filter", label: "Filter" },
  { id: "rec", label: "Recorder" },
];
export const INITIAL: Connection[] = [
  { id: "c1", sourcePortId: "osc", targetPortId: "amp" },
  { id: "bad", sourcePortId: "lfo", targetPortId: "fx" }, // deliberate invalid edge (cv → audio)
];

function usePatchHost(opts: { delay?: number; reject?: boolean } = {}) {
  const [connections, setConnections] = useState<Connection[]>(INITIAL);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const n = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 8));
  const later = (fn: () => void) => {
    const t = setTimeout(fn, opts.delay ?? 500);
    timers.current.push(t);
  };
  const answer = (requestId: string, apply: () => void, what: string) =>
    later(() => {
      if (opts.reject) {
        setResolution({ requestId, accepted: false, message: `Host refused: ${what}.` });
        push(`host → rejected (${what})`);
        return;
      }
      apply();
      setResolution({ requestId, accepted: true });
      push(`host → accepted (${what})`);
    });
  const connect = (i: ConnectIntent) => {
    push(`onConnectRequest(${i.sourcePortId} → ${i.targetPortId}, ${i.source})`);
    answer(i.requestId, () => setConnections((c) => [...c, { id: `c${++n.current}`, sourcePortId: i.sourcePortId, targetPortId: i.targetPortId }]), "connect");
  };
  const reconnect = (i: ReconnectIntent) => {
    push(`onReconnectRequest(${i.connectionId} → ${i.targetPortId}, ${i.source})`);
    answer(i.requestId, () => setConnections((c) => c.map((x) => (x.id === i.connectionId ? { ...x, targetPortId: i.targetPortId } : x))), "reconnect");
  };
  const disconnect = (i: DisconnectIntent) => {
    push(`onDisconnectRequest(${i.connectionId}, ${i.source})`);
    answer(i.requestId, () => setConnections((c) => c.filter((x) => x.id !== i.connectionId)), "disconnect");
  };
  return { connections, resolution, connect, reconnect, disconnect, log };
}

function PlaygroundBay({ values }: { values: PlaygroundValues }) {
  const { hostDelay, reject, ...rest } = values as { hostDelay: number; reject: boolean } & Partial<CablePatchbayProps>;
  const host = usePatchHost({ delay: hostDelay, reject });
  return (
    <div className="flex w-full flex-col gap-4">
      <CablePatchbay ports={PORTS} modules={MODULES} connections={host.connections} resolution={host.resolution} onConnectRequest={host.connect} onReconnectRequest={host.reconnect} onDisconnectRequest={host.disconnect} {...rest} />
      <EventLog entries={host.log} />
    </div>
  );
}

function Synth() {
  const [reject, setReject] = useState(false);
  const host = usePatchHost({ delay: 500, reject });
  return (
    <div className="flex w-full flex-col gap-3">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={reject} onChange={(e) => setReject(e.target.checked)} />
        Host refuses every request
      </label>
      <CablePatchbay ports={PORTS} modules={MODULES} connections={host.connections} resolution={host.resolution} onConnectRequest={host.connect} onReconnectRequest={host.reconnect} onDisconnectRequest={host.disconnect} />
      <EventLog entries={host.log} />
    </div>
  );
}

const FEEDBACK_PORTS: Port[] = [
  { id: "a-out", nodeId: "a", label: "A out", direction: "output", dataType: "audio" },
  { id: "b-out", nodeId: "b", label: "B out", direction: "output", dataType: "audio" },
  { id: "a-in", nodeId: "a", label: "A in", direction: "input", dataType: "audio" },
  { id: "b-in", nodeId: "b", label: "B in", direction: "input", dataType: "audio" },
];

function Rule() {
  const host = usePatchHost({ delay: 300 });
  return (
    <CablePatchbay
      ports={FEEDBACK_PORTS}
      modules={[
        { id: "a", label: "Module A" },
        { id: "b", label: "Module B" },
      ]}
      connections={host.connections.filter((c) => FEEDBACK_PORTS.some((p) => p.id === c.sourcePortId))}
      resolution={host.resolution}
      onConnectRequest={host.connect}
      onDisconnectRequest={host.disconnect}
      validateConnection={(c, { source, target }) => (source.nodeId === target.nodeId ? { allowed: false, reason: "Would feed a module into itself." } : true)}
    />
  );
}

function Scroll() {
  const host = usePatchHost({ delay: 300 });
  return (
    <div className="h-[260px] w-full overflow-auto rounded-xl border border-[rgba(20,19,17,0.15)] p-3" data-scroll-panel>
      <p className="m-0 mb-3 text-[13px] opacity-70">Scroll this panel while watching the cables.</p>
      <CablePatchbay ports={PORTS} modules={MODULES} connections={host.connections} resolution={host.resolution} onConnectRequest={host.connect} onDisconnectRequest={host.disconnect} />
    </div>
  );
}

const MAP_PORTS: Port[] = [
  { id: "f-name", nodeId: "csv", label: "full_name", direction: "output", dataType: "text" },
  { id: "f-mail", nodeId: "csv", label: "email", direction: "output", dataType: "text" },
  { id: "f-age", nodeId: "csv", label: "age", direction: "output", dataType: "number" },
  { id: "t-name", nodeId: "crm", label: "Display name", direction: "input", dataType: "text" },
  { id: "t-mail", nodeId: "crm", label: "Primary email", direction: "input", dataType: "text" },
  { id: "t-years", nodeId: "crm", label: "Years", direction: "input", dataType: "number" },
  { id: "t-note", nodeId: "crm", label: "Note", direction: "input", dataType: "text" },
];

function Mapping() {
  const [connections, setConnections] = useState<Connection[]>([{ id: "m1", sourcePortId: "f-name", targetPortId: "t-name" }]);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  return (
    <CablePatchbay
      variant="mapping"
      ports={MAP_PORTS}
      modules={[
        { id: "csv", label: "CSV columns" },
        { id: "crm", label: "CRM fields" },
      ]}
      connections={connections}
      resolution={resolution}
      onConnectRequest={(i) => {
        setConnections((c) => [...c, { id: `m${c.length + 1}`, sourcePortId: i.sourcePortId, targetPortId: i.targetPortId }]);
        setResolution({ requestId: i.requestId, accepted: true });
      }}
      onDisconnectRequest={(i) => {
        setConnections((c) => c.filter((x) => x.id !== i.connectionId));
        setResolution({ requestId: i.requestId, accepted: true });
      }}
    />
  );
}

export const cablePatchbayLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundBay key={`${values.hostDelay}-${values.reject}`} values={values} />,
  cardPreview: () => (
    <svg viewBox="0 0 200 90" className="h-24 w-52" aria-hidden>
      {[20, 45, 70].map((y, i) => (
        <g key={y}>
          <circle cx={16} cy={y} r={5} fill="#141311" />
          <circle cx={184} cy={[45, 20, 70][i]} r={5} fill="#141311" />
          <path d={`M 16 ${y} C 70 ${y + 25}, 130 ${[45, 20, 70][i]! + 25}, 184 ${[45, 20, 70][i]}`} fill="none" stroke={i === 1 ? "#1f7a4f" : "#141311"} strokeWidth={3} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  ),
  examples: {
    synth: () => <Synth />,
    rule: () => <Rule />,
    scroll: () => <Scroll />,
    mapping: () => <Mapping />,
  },
};
