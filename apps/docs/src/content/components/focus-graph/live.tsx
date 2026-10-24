"use client";

import { useState } from "react";
import { FocusGraph, type FocusGraphProps, type GraphEdge, type GraphNode, type Position } from "@/components/ui/focus-graph";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

export const SERVICES: GraphNode[] = [
  { id: "web", label: "Web app", category: "frontend", description: "Next.js storefront" },
  { id: "admin", label: "Admin", category: "frontend" },
  { id: "gateway", label: "API gateway", category: "service" },
  { id: "orders", label: "Orders", category: "service" },
  { id: "payments", label: "Payments", category: "service" },
  { id: "catalog", label: "Catalog", category: "service" },
  { id: "search", label: "Search", category: "service" },
  { id: "pg", label: "Postgres", category: "store" },
  { id: "redis", label: "Redis", category: "store" },
  { id: "es", label: "Elasticsearch", category: "store" },
  { id: "mailer", label: "Mailer", category: "service" },
  { id: "island", label: "Legacy export", category: "service", description: "No longer called by anything." },
];
export const CALLS: GraphEdge[] = [
  { id: "c1", source: "web", target: "gateway" },
  { id: "c2", source: "admin", target: "gateway" },
  { id: "c3", source: "gateway", target: "orders" },
  { id: "c4", source: "gateway", target: "catalog" },
  { id: "c5", source: "gateway", target: "search" },
  { id: "c6", source: "orders", target: "payments" },
  { id: "c7", source: "orders", target: "pg" },
  { id: "c8", source: "payments", target: "pg" },
  { id: "c9", source: "catalog", target: "pg" },
  { id: "c10", source: "catalog", target: "redis" },
  { id: "c11", source: "search", target: "es" },
  { id: "c12", source: "orders", target: "mailer" },
  { id: "c13", source: "mailer", target: "orders" }, // cycle
  { id: "c14", source: "payments", target: "ledger" }, // invalid: no such node
];

const TOPICS = ["Colour", "Typography", "Grid", "Motion", "Contrast", "Hierarchy", "Rhythm", "Whitespace", "Icons", "Tokens", "Themes", "Accessibility", "Layout", "Spacing", "Elevation", "States", "Focus", "Forms", "Tables", "Charts"];
export const AUTHORED_NODES: GraphNode[] = TOPICS.map((t, i) => ({ id: t.toLowerCase(), label: t, category: i < 7 ? "foundation" : i < 14 ? "system" : "pattern" }));
export const AUTHORED_EDGES: GraphEdge[] = [
  ["colour", "contrast"], ["colour", "themes"], ["colour", "tokens"], ["typography", "hierarchy"], ["typography", "rhythm"], ["grid", "layout"], ["grid", "spacing"], ["motion", "states"], ["motion", "focus"], ["contrast", "accessibility"], ["hierarchy", "whitespace"], ["icons", "tokens"], ["tokens", "themes"], ["themes", "elevation"], ["accessibility", "forms"], ["accessibility", "focus"], ["layout", "tables"], ["layout", "charts"], ["spacing", "forms"], ["states", "forms"], ["charts", "colour"],
].map(([s, t], i) => ({ id: `a${i}`, source: s!, target: t! }));
export const AUTHORED_POS: Record<string, Position> = Object.fromEntries(TOPICS.map((t, i) => [t.toLowerCase(), { x: 80 + (i % 5) * 140, y: 70 + Math.floor(i / 5) * 110 + (i % 2) * 25 }]));

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
const rand = mulberry(7);
export const BIG_NODES: GraphNode[] = Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}`, category: ["alpha", "beta", "gamma"][i % 3] }));
export const BIG_EDGES: GraphEdge[] = Array.from({ length: 420 }, (_, i) => {
  const s = Math.floor(rand() * 300);
  const t = Math.min(299, s + 1 + Math.floor(rand() * 12));
  return { id: `b${i}`, source: `n${s}`, target: `n${t}` };
});

function PlaygroundGraph({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<FocusGraphProps>;
  const authored = props.variant === "authored";
  return (
    <div className="w-full">
      <FocusGraph nodes={authored ? AUTHORED_NODES : SERVICES} edges={authored ? AUTHORED_EDGES : CALLS} positions={authored ? AUTHORED_POS : undefined} {...props} />
    </div>
  );
}

function Deletion() {
  const [nodes, setNodes] = useState(SERVICES);
  const [selected, setSelected] = useState<string | null>("orders");
  return (
    <div className="flex w-full flex-col gap-3">
      <button type="button" disabled={!selected} onClick={() => setNodes((n) => n.filter((x) => x.id !== selected))} className="self-start rounded-full border border-current px-4 py-1.5 text-sm disabled:opacity-40">
        Delete selected{selected ? ` (${selected})` : ""}
      </button>
      <FocusGraph directed nodes={nodes} edges={CALLS} selectedId={selected} onSelectedIdChange={(id) => setSelected(id)} />
    </div>
  );
}

export const focusGraphLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundGraph key={String(values.variant)} values={values} />,
  cardPreview: () => (
    <svg viewBox="0 0 200 100" className="h-24 w-52" aria-hidden>
      {[[30, 50, 90, 30], [90, 30, 150, 50], [90, 30, 110, 80], [150, 50, 110, 80]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(20,19,17,0.35)" strokeWidth={1.5} />
      ))}
      {[[30, 50, "#1d2a6b"], [90, 30, "#ff4d1c"], [150, 50, "#1f7a4f"], [110, 80, "#c8a000"]].map(([x, y, c]) => (
        <circle key={String(x) + String(y)} cx={x as number} cy={y as number} r={x === 90 ? 10 : 7} fill={c as string} />
      ))}
    </svg>
  ),
  examples: {
    authored: () => <FocusGraph layout="authored" nodes={AUTHORED_NODES} edges={AUTHORED_EDGES} positions={AUTHORED_POS} />,
    dependencies: () => <FocusGraph directed nodes={SERVICES} edges={CALLS} defaultSelectedId="gateway" />,
    stress: () => <FocusGraph nodes={BIG_NODES} edges={BIG_EDGES} seed={7} settleBudget={300} />,
    deletion: () => <Deletion />,
  },
};
