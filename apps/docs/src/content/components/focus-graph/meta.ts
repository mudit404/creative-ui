import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const focusGraphMeta: ComponentMeta = {
  slug: "focus-graph",
  name: "FocusGraph",
  title: "Focus Graph",
  tagline: "A constellation you can search, with neighbours you can read.",
  description:
    "Nodes and edges are supplied data, never inferred. A search box and a complete node list sit beside a bounded SVG canvas; selecting a node from either place highlights its one-hop neighbourhood and opens a details card with inbound/outbound (or connected) lists you can click through. The layout is a deterministic, seeded force simulation with an iteration cap, or authored positions; under full motion the nodes settle once from their seeds, under reduced motion they appear settled. Zoom, pan, Fit and Focus only move the viewBox.",
  category: "navigation",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["graph", "network", "nodes", "edges", "dependencies", "knowledge map", "force layout", "search", "svg"],
  registryName: "focus-graph",
  importPath: "@/components/ui/focus-graph",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "graph-model"] },
  props: [
    { name: "nodes / edges", type: "GraphNode[] / GraphEdge[]", default: "—", description: "Required. { id, label, category?, description? } and { id?, source, target, label? }. Edges to missing nodes are diagnosed and excluded." },
    { name: "directed", type: "boolean", default: "false", description: "Arrowheads and inbound/outbound terminology." },
    { name: "selectedId / defaultSelectedId / onSelectedIdChange", type: "string | null / (id, reason) => void", default: "null", description: "reason is canvas | list | neighbor | clear | removed." },
    { name: "layout", type: '"seeded-force" | "authored"', default: '"seeded-force"', description: "authored uses positions verbatim and runs no simulation." },
    { name: "seed / settleBudget", type: "number / iterations", default: "1 / 300", description: "Deterministic seed and the hard iteration cap of the synchronous layout." },
    { name: "positions", type: "Record<id, { x, y }>", default: "—", description: "Authored coordinates (required for authored); pins otherwise." },
    { name: "renderDetails / nodeLabel / nodeDescription", type: "slots / accessors", default: "—", description: "Custom details card and label/description sources." },
    { name: "categoryColors", type: "Record<category, color>", default: "palette", description: "Legend colours." },
    { name: "variant", type: '"dependencies" | "knowledge" | "authored"', default: '"knowledge"', description: "authored implies the authored layout." },
    { name: "narrowBreakpoint", type: "number", default: "640", description: "Below this width the list comes first and the graph opens on request." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Settle animation and 260 ms camera moves under full motion only." },
    { name: "ref", type: "FocusGraphHandle", default: "—", description: "{ root, focusNode(id), fitViewport() }." },
  ],
  cssVars: [
    { name: "--cui-graph-node", description: "Node colour for uncategorised nodes", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-graph-edge", description: "Edge stroke and arrowheads", default: "light-dark(rgba(20,19,17,0.35), rgba(236,235,230,0.35))" },
    { name: "--cui-graph-selected", description: "Selected node ring, highlighted edges, focus ring", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-graph-muted", description: "Edges outside the selected neighbourhood", default: "light-dark(rgba(20,19,17,0.12), rgba(236,235,230,0.12))" },
    { name: "--cui-graph-border", description: "Outline of the search box, camera buttons and neighbour chips", default: "light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45))" },
    { name: "--cui-graph-line", description: "Decorative border of the details card and the canvas", default: "light-dark(rgba(20,19,17,0.12), rgba(236,235,230,0.12))" },
    { name: "--cui-graph-bg", description: "Canvas background", default: "light-dark(#faf9f6, #1f1f1c)" },
    { name: "--cui-graph-text", description: "Text and node labels", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-graph-error", description: "Diagnostics text and border", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    {
      id: "authored",
      title: "Authored 20-node map",
      description: "Fixed positions, no simulation; the reproducible baseline. Undirected links with categories.",
      code: `<FocusGraph layout="authored" nodes={nodes} edges={edges} positions={positions} />`,
    },
    {
      id: "dependencies",
      title: "Directed dependencies with a cycle and an invalid edge",
      description: "Arrowheads, “Depends on” vs “Used by”, a disconnected node, and one edge pointing at a node that does not exist.",
      code: `<FocusGraph directed nodes={services} edges={calls} />`,
    },
    {
      id: "stress",
      title: "300-node seeded stress fixture",
      description: "Deterministic seed, 300 iterations, labels culled to the selection and its neighbours.",
      code: `<FocusGraph nodes={big.nodes} edges={big.edges} seed={7} settleBudget={300} />`,
    },
    {
      id: "deletion",
      title: "Live deletion of the selected node",
      description: "Select a node, then remove it from the data: the details clear and say why.",
      code: `<button onClick={() => setNodes(nodes.filter((n) => n.id !== selected))}>Delete selected</button>`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-layout\`, \`data-settled\` and \`data-narrow\`. Left: a search box, counts, the node list (buttons with \`aria-pressed\`), a diagnostic note and the details card with neighbour lists. Right: zoom/pan/fit/reset buttons, a legend, and an SVG \`role="img"\` with a title.

- **Validation**: \`validateGraph\` drops duplicate nodes and edges to unknown nodes with messages and a visible count (C56-T01); adjacency is built once per revision.
- **Layout**: \`forceLayout\` runs synchronously with repulsion, edge springs, centre gravity and cooling, capped at \`settleBudget\` iterations or an early settle (C56-T04). Authored positions are used verbatim (C56-T08). Dragging a node pins it locally; Reset layout clears pins; data is untouched.
- **Camera**: zoom/pan/fit/focus change only the viewBox (C56-T06); under full motion the viewBox animates 260 ms.
- **Selection**: list, canvas and neighbour buttons all set the same selection (C56-T02); directed graphs list Depends on / Used by (C56-T03); a deleted selection clears with a notice and reports \`reason: "removed"\` (C56-T05).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Everything is reachable without the canvas: search, list, details and neighbour buttons (C56-T07). Narrow layouts show the list first and open the graph on request.
- Camera controls are buttons (WCAG 2.2 SC 2.5.7); the document wheel is never captured.
- Node size is constant; categories are colour plus a legend and text, never colour alone.
- A hidden status announces the selected node and its neighbour count.
- Reduced motion never plays the settle animation (C56-T09).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `The layout is O(n²) per iteration; 300 nodes × 300 iterations completes in tens of milliseconds and runs only when data, seed or pins change. Labels are culled above 24 nodes except for the selection and its neighbours. Only the 2D SVG path ships: no Canvas, 3D or VR bundles (C56-T10).`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No incremental/animated simulation and no clustering; large graphs should supply authored positions or a host-side layout.
- Edges are straight lines; curved multi-edges are not drawn.
- Pinning is local state; persist it on the host if needed.`,
    },
  ],
  sourceFiles: ["components/ui/focus-graph.tsx", "lib/graph-model.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. References studied: react-force-graph (feature set considered; not a dependency) and WCAG 2.2 SC 2.5.7. The force layout is a small Fruchterman–Reingold-style routine written for this library. Semantic-first contracts from Collection 02 brief #56. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const focusGraphPlayground: PlaygroundDef = {
  initial: { directed: true, seed: 1, settleBudget: 300, variant: "dependencies", narrowBreakpoint: 360 },
  defaults: { directed: false, seed: 1, settleBudget: 300, variant: "knowledge", narrowBreakpoint: 640, motion: "auto" },
  controls: [
    { type: "boolean", prop: "directed", label: "Directed", group: "Data" },
    { type: "range", prop: "seed", label: "Seed", group: "Layout", min: 1, max: 20, step: 1 },
    { type: "range", prop: "settleBudget", label: "Settle budget", group: "Layout", min: 5, max: 600, step: 5, unit: "iterations" },
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Dependencies", value: "dependencies" }, { label: "Knowledge", value: "knowledge" }, { label: "Authored", value: "authored" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Barely settled", values: { settleBudget: 5 } },
    { name: "Authored", values: { variant: "authored" } },
  ],
};
