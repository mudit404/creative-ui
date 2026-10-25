"use client";

import { useState } from "react";
import { DockWorkspace, type DockLayout, type DockPanel, type DockWorkspaceProps } from "@/components/ui/dock-workspace";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

function Draft({ label, onChange }: { label: string; onChange?: (v: string) => void }) {
  const [text, setText] = useState("");
  return (
    <label className="flex h-full flex-col gap-1 text-[12px]">
      <span className="opacity-70">{label}</span>
      <textarea
        aria-label={label}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange?.(e.target.value);
        }}
        className="min-h-20 flex-1 resize-none rounded-md border border-[rgba(20,19,17,0.2)] bg-white/60 p-2 font-mono text-[12px]"
        placeholder="Type here; this state survives moves and tab switches"
      />
    </label>
  );
}
const Body = ({ children }: { children: string }) => <p className="m-0 text-[12px] opacity-80">{children}</p>;

export function makePanels(onNotes?: (v: string) => void): DockPanel[] {
  return [
    { id: "canvas", title: "Canvas", minWidth: 200, render: () => <Body>The main canvas. Minimum width 200 px.</Body> },
    { id: "layers", title: "Layers", render: () => <Body>Layer list.</Body> },
    { id: "props", title: "Properties", render: () => <Draft label="Properties draft" /> },
    { id: "output", title: "Output", render: () => <Body>Build output and logs.</Body> },
    { id: "notes", title: "Notes", closable: true, render: () => <Draft label="Notes draft" onChange={onNotes} /> },
  ];
}
const PANELS = makePanels();

function useLayoutLog() {
  const [log, setLog] = useState<string[]>([]);
  const onLayoutChange: DockWorkspaceProps["onLayoutChange"] = (next, meta) => setLog((l) => [`onLayoutChange(${meta.reason}${meta.panelId ? ` ${meta.panelId}` : ""}${meta.problems ? `: ${meta.problems.join(" ")}` : ""}) → ${countGroups(next)} groups`, ...l].slice(0, 6));
  return { log, onLayoutChange };
}
const countGroups = (l: DockLayout): number => {
  const walk = (n: DockLayout["root"]): number => (n.type === "group" ? 1 : n.children.reduce((a, c) => a + walk(c), 0));
  return walk(l.root);
};

function PlaygroundDock({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<DockWorkspaceProps>;
  const { log, onLayoutChange } = useLayoutLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <DockWorkspace key={String(props.variant)} panels={PANELS} onLayoutChange={onLayoutChange} className="h-80" {...props} />
      <EventLog entries={log} />
    </div>
  );
}

function Studio() {
  const { log, onLayoutChange } = useLayoutLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <DockWorkspace panels={PANELS} onLayoutChange={onLayoutChange} compactBreakpoint={480} />
      <EventLog entries={log} />
    </div>
  );
}

function Dirty() {
  const [draft] = useState({ current: "" }); // plain mutable holder read by onBeforeClose
  const [panels] = useState(() =>
    makePanels((v) => {
      draft.current = v;
    }),
  );
  const { log, onLayoutChange } = useLayoutLog();
  const [decisions, setDecisions] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-3">
      <DockWorkspace
        panels={panels}
        compactBreakpoint={480}
        onLayoutChange={onLayoutChange}
        onBeforeClose={async (id) => {
          await new Promise((r) => setTimeout(r, 200));
          const ok = id !== "notes" || draft.current.trim() === "";
          setDecisions((d) => [`onBeforeClose(${id}) → ${ok ? "allowed" : "declined (unsaved draft)"}`, ...d].slice(0, 4));
          return ok;
        }}
      />
      <EventLog entries={[...decisions, ...log]} />
    </div>
  );
}

const CORRUPT: DockLayout = {
  schemaVersion: 1,
  root: {
    type: "split",
    id: "s",
    direction: "row",
    ratios: [0.5, 0.5],
    children: [
      { type: "group", id: "g1", tabs: ["canvas", "ghost"], active: "canvas" },
      { type: "group", id: "g2", tabs: ["canvas", "layers"], active: "layers" },
    ],
  },
};
function Invalid() {
  const { log, onLayoutChange } = useLayoutLog();
  return (
    <div className="flex w-full flex-col gap-3">
      <DockWorkspace panels={PANELS} defaultLayout={CORRUPT} onLayoutChange={onLayoutChange} compactBreakpoint={480} className="h-64" />
      <EventLog entries={log} />
    </div>
  );
}

function Narrow() {
  const oversized = [{ ...PANELS[0]!, minWidth: 2000 }, ...PANELS.slice(1)];
  return (
    <div className="flex w-full flex-col gap-4">
      <div style={{ width: 420 }} data-narrow>
        <DockWorkspace panels={PANELS} label="Narrow workspace" className="h-72" />
      </div>
      <div data-oversized>
        <DockWorkspace panels={oversized} compactBreakpoint={320} label="Over-constrained workspace" className="h-64" />
      </div>
    </div>
  );
}

function Controlled() {
  const [layout, setLayout] = useState<DockLayout | null>(null);
  const [refuse, setRefuse] = useState(false);
  const { log, onLayoutChange } = useLayoutLog();
  const [initial] = useState<DockLayout>(() => ({
    schemaVersion: 1,
    root: { type: "split", id: "s-root", direction: "row", ratios: [0.6, 0.4], children: [{ type: "group", id: "g-main", tabs: ["canvas", "props"], active: "canvas" }, { type: "group", id: "g-side", tabs: ["layers", "output", "notes"], active: "layers" }] },
  }));
  return (
    <div className="flex w-full flex-col gap-3">
      <label className="flex items-center gap-2 text-[12px]">
        <input type="checkbox" checked={refuse} onChange={(e) => setRefuse(e.target.checked)} /> Refuse proposals (parent keeps its layout)
      </label>
      <DockWorkspace
        panels={PANELS}
        layout={layout ?? initial}
        compactBreakpoint={480}
        onLayoutChange={(next, meta) => {
          onLayoutChange(next, meta);
          if (!refuse) setLayout(next);
        }}
        className="h-72"
      />
      <EventLog entries={log} />
    </div>
  );
}

export const dockWorkspaceLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundDock values={values} />,
  cardPreview: () => <DockWorkspace panels={PANELS.slice(0, 3)} compactBreakpoint={200} label="Preview" className="h-40" />,
  examples: {
    studio: () => <Studio />,
    dirty: () => <Dirty />,
    invalid: () => <Invalid />,
    narrow: () => <Narrow />,
    controlled: () => <Controlled />,
  },
};
