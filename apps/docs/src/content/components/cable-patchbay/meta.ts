import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const cablePatchbayMeta: ComponentMeta = {
  slug: "cable-patchbay",
  name: "CablePatchbay",
  title: "Cable Patchbay",
  tagline: "Patch typed outputs into inputs with cables that sag, snap and never lie.",
  description:
    "Source modules on the left, destination modules on the right, SVG cables between them. Start a connection by dragging an output, tapping it, pressing Enter on it, or using the list form; every path validates the candidate (direction, type, duplicates, input capacity, your own rule) with a visible reason and emits one request. The host owns the connections and settles each request by id; a rejected reconnection leaves the original cable in place. Invalid initial edges go to a diagnostic list instead of vanishing.",
  category: "inputs",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["patchbay", "cables", "connections", "ports", "routing", "mapping", "modular", "graph", "audio"],
  registryName: "cable-patchbay",
  importPath: "@/components/ui/cable-patchbay",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "patch-graph", "transactions"] },
  props: [
    { name: "ports", type: "Port[]", default: "—", description: "Required. { id, nodeId, label, direction: \"input\" | \"output\", dataType }." },
    { name: "modules", type: "{ id, label }[]", default: "from nodeIds", description: "Module headings; outputs render on the left, inputs on the right." },
    { name: "connections", type: "{ id, sourcePortId, targetPortId }[]", default: "[]", description: "Controlled. Invalid ones are listed as diagnostics, never drawn or dropped silently." },
    { name: "validateConnection", type: "(candidate, ctx) => boolean | { allowed, reason? }", default: "structural rules", description: "Host rule after type/duplicate/capacity checks, e.g. cycle prevention." },
    { name: "onConnectRequest / onReconnectRequest / onDisconnectRequest", type: "(intent) => void", default: "—", description: "Intents carry requestId, port ids and source: pointer | tap | keyboard | list | cable." },
    { name: "resolution", type: "{ requestId, accepted, message? } | null", default: "null", description: "Settles the pending request; stale ids are ignored." },
    { name: "snapRadius", type: "number (px)", default: "24", description: "Distance within which the free end snaps to a compatible socket." },
    { name: "cableSlack / maxSlackPx", type: "number", default: "0.18 / 120", description: "Sag as a fraction of endpoint distance, clamped." },
    { name: "maxConnectionsPerInput", type: "number", default: "1", description: "Outputs fan out freely; inputs are capped." },
    { name: "variant", type: '"patch" | "mapping" | "lesson"', default: '"patch"', description: "mapping draws straight S-curves without sag." },
    { name: "renderPort / renderConnectionLabel", type: "slots", default: "—", description: "Custom port body and list label; sockets and buttons stay." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Elastic lag on the free end under full motion only." },
    { name: "ref", type: "CablePatchbayHandle", default: "—", description: "{ root, focusPort(id) }." },
  ],
  cssVars: [
    { name: "--cui-cable-stroke", description: "Cable and collar colour (ink)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-cable-active", description: "Hovered/selected cable, eligible sockets, temp cable, Disconnect pill (accent)", default: "light-dark(#1a6b45, #5fcf8f)" },
    { name: "--cui-port-fill", description: "Socket ring and connected fill (ink)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-port-invalid", description: "Invalid socket ring, error text and the diagnostics note (error)", default: "light-dark(#b8310c, #ff8a65)" },
    { name: "--cui-patch-background", description: "Board background and unconnected socket fill; also the Connect button text (paper)", default: "light-dark(#faf9f6, #1f1f1c)" },
    { name: "--cui-patch-focus", description: "Focus ring and primary button fill (ink)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-patch-text", description: "Text colour (ink)", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-patch-border", description: "Module and form frames (decorative)", default: "light-dark(rgba(20,19,17,0.15), rgba(236,235,230,0.15))" },
    { name: "--cui-patch-control-border", description: "Button and select outlines (boundary, 3.4:1 / 3.8:1)", default: "light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45))" },
    { name: "--cui-patch-module", description: "Module background tint", default: "light-dark(rgba(20,19,17,0.03), rgba(236,235,230,0.03))" },
  ],
  examples: [
    {
      id: "synth",
      title: "Synth with a demo host",
      description: "Three sources, four destinations, two types, one occupied input and a deliberately invalid initial edge. The host accepts after 500 ms; tick the box to make it refuse.",
      code: `<CablePatchbay ports={ports} modules={modules} connections={host.connections} resolution={host.resolution}
  onConnectRequest={host.connect} onReconnectRequest={host.reconnect} onDisconnectRequest={host.disconnect} />`,
    },
    {
      id: "rule",
      title: "Host rule: no cycles",
      description: "validateConnection rejects a connection that would route a module back into itself, with a reason.",
      code: `validateConnection={(c, { source, target }) => (source.nodeId === target.nodeId ? { allowed: false, reason: "Would feed a module into itself." } : true)}`,
    },
    {
      id: "scroll",
      title: "Inside a scrolling panel",
      description: "Scroll the panel: cables stay attached to their sockets.",
      code: `<div style={{ height: 260, overflow: "auto" }}><CablePatchbay … /></div>`,
    },
    {
      id: "mapping",
      title: "Mapping variant",
      description: "Field mapping with straight paths and fan-out from one output.",
      code: `<CablePatchbay variant="mapping" maxConnectionsPerInput={1} … />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (idle | connecting | dragging | pending). The board holds module \`section\`s with port buttons (44 px targets around a 10 px socket) and an aria-hidden SVG overlay of cables. Below: a status strip with Cancel, the connection list with Disconnect/Reconnect controls and a diagnostic note, and a Source/Target/Connect form.

- **Geometry**: sockets are measured relative to the root on mount, resize (ResizeObserver on root and sockets), window resize and any scroll (capture), so endpoints follow their ports (C45-T05).
- **Drag**: 6 px intent lifts a temp cable from the output; the free end snaps to the nearest compatible input within \`snapRadius\`. Invalid sockets under the pointer show the exact reason; release on an invalid socket creates nothing (C45-T02).
- **Tap/keyboard**: activating an output enters connect mode, names the source, and marks inputs eligible or invalid (with \`aria-describedby\` reasons). Activating an eligible input requests the connection; Escape or Cancel leaves.
- **Requests**: one at a time; a pending dashed cable stays until the matching resolution arrives (C45-T06). Reconnect keeps the original edge drawn until accepted (C45-T03).
- **Removal**: if the source port disappears mid-gesture the gesture is cancelled and other edges remain (C45-T04).
- **Colour**: every \`--cui-*\` default is a \`light-dark()\` pair that follows \`color-scheme\` (Chrome 123+, Safari 17.5+, Firefox 120+; older browsers get the light values). Cables are SVG strokes and read the same tokens.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Ports are buttons named "<label> (<type> <direction>)", with \`aria-pressed\` on the active output and invalid reasons as accessible descriptions.
- The connection list is a functional equivalent: every edge is readable and has a Disconnect button; selecting one exposes Reconnect (C45-T08). The form connects any pair without dragging (WCAG 2.2 SC 2.5.7).
- One polite status region announces snap targets, reasons, pending and results.
- Selected cables are dashed and thicker, not just recoloured.
- Reduced motion removes the elastic lag; snapping and validation are unchanged (C45-T09).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Cables are plain paths recomputed from a small geometry map; nothing runs idle. During a drag one spring pair drives the free end. Observers and window listeners are removed on unmount (C45-T10). Profiled fixture: 7 ports, 2 edges; the brief's 40-port/60-edge budget should hold since cost is linear in edges.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Fixed layout: modules do not move; pan/zoom and routing around obstacles are deferred to a React Flow adapter (not shipped).
- Cables cannot be dragged off an input to reconnect; use the list's Reconnect control.
- No data-flow animation along cables.`,
    },
  ],
  sourceFiles: ["components/ui/cable-patchbay.tsx", "lib/patch-graph.ts", "lib/transactions.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. References studied: React Flow custom connection line example (concept only; not a dependency) and WCAG 2.2 SC 2.5.7. Validation, request and list-equivalence contracts from Collection 02 brief #45. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const cablePatchbayPlayground: PlaygroundDef = {
  initial: { variant: "patch", snapRadius: 24, cableSlack: 0.18, maxConnectionsPerInput: 1, hostDelay: 500, reject: false },
  defaults: { variant: "patch", snapRadius: 24, cableSlack: 0.18, maxSlackPx: 120, maxConnectionsPerInput: 1, hostDelay: 500, reject: false, motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Patch", value: "patch" }, { label: "Mapping", value: "mapping" }, { label: "Lesson", value: "lesson" }] },
    { type: "range", prop: "snapRadius", label: "Snap radius", group: "Interaction", min: 8, max: 64, step: 2, unit: "px" },
    { type: "range", prop: "cableSlack", label: "Cable slack", group: "Shape", min: 0, max: 0.5, step: 0.02 },
    { type: "range", prop: "maxConnectionsPerInput", label: "Input capacity", group: "Rules", min: 1, max: 3, step: 1 },
    { type: "range", prop: "hostDelay", label: "Host delay (demo)", group: "Demo host", min: 0, max: 3000, step: 100, unit: "ms" },
    { type: "boolean", prop: "reject", label: "Host refuses (demo)", group: "Demo host" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Mapping, fan-in 2", values: { variant: "mapping", maxConnectionsPerInput: 2 } },
    { name: "Refusing host", values: { reject: true } },
  ],
};
