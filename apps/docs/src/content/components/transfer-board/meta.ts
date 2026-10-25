import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const transferBoardMeta: ComponentMeta = {
  slug: "transfer-board",
  name: "TransferBoard",
  title: "Transfer Board",
  tagline: "Move items between columns with a Move menu first and a spring-loaded drag second.",
  description:
    "Two to four named containers with authoritative membership and order. Every item has a click-only Move control (destination + position) and a drag handle. A drop or a confirmed Move emits one request addressed by stable ids with the host's revision; the item shows pending until the host answers. Rejection restores membership, order and focus with the host's reason; a revision change mid-drag discards the preview; undo submits the inverse move or explains the conflict. Read-only and capacity-limited columns refuse with a visible reason, and duplicate ids disable moves with a diagnostic.",
  category: "layout",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["kanban", "board", "drag", "drop", "sortable", "columns", "move", "workflow", "undo", "playlist"],
  registryName: "transfer-board",
  importPath: "@/components/ui/transfer-board",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "board-moves", "transactions"] },
  props: [
    { name: "containers", type: "{ id, label, readOnly?, capacity? }[]", default: "—", description: "Required. Column definitions." },
    { name: "items", type: "{ id, title, … }[]", default: "—", description: "Required. Item data; ids must be unique across the board." },
    { name: "itemsByContainer", type: "Record<containerId, itemId[]>", default: "—", description: "Required, controlled. Membership and order." },
    { name: "revision", type: "string | number", default: "—", description: "Required. Opaque host version; every intent carries it as baseRevision. A change during a drag cancels the preview." },
    { name: "canMove", type: "(move) => boolean | { allowed, reason? }", default: "structural rules", description: "Host policy on top of read-only and capacity checks." },
    { name: "onMoveRequest", type: "(intent) => void", default: "—", description: "Required. { requestId, itemId, fromContainerId, toContainerId, beforeItemId | null, baseRevision, source }." },
    { name: "onUndoRequest", type: "(intent) => void", default: "—", description: "Receives the inverse move (source \"undo\")." },
    { name: "resolution", type: "{ requestId, accepted, message? } | null", default: "null", description: "Only the pending request id settles." },
    { name: "pendingItemIds", type: "string[]", default: "[]", description: "Extra items the host marks busy." },
    { name: "renderItem", type: "(item, { handle, moveMenu, pending, dragging }) => ReactNode", default: "title row", description: "Place the provided handle and Move control inside your row." },
    { name: "autoscroll", type: "boolean", default: "true", description: "Scroll the board near its edges during a drag; bounded to the board, paused outside it." },
    { name: "undoEnabled", type: "boolean", default: "false", description: "Show Undo last move (needs onUndoRequest)." },
    { name: "variant", type: '"workflow" | "library" | "priority"', default: '"workflow"', description: "priority stacks containers vertically." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Neighbour rows shift with a spring under full motion only." },
    { name: "ref", type: "TransferBoardHandle", default: "—", description: "{ root, focusItem(id) } — focuses the item's Move control." },
  ],
  cssVars: [
    { name: "--cui-transfer-gap", description: "Gap between columns", default: "12px" },
    { name: "--cui-transfer-column-width", description: "Minimum column width", default: "180px" },
    { name: "--cui-transfer-max-height", description: "Board scroll height", default: "70vh" },
    { name: "--cui-transfer-text", description: "Text colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-transfer-surface", description: "Row, Move menu and drag-preview surface; label on the primary button", default: "light-dark(#faf9f6, #1f1f1c)" },
    { name: "--cui-transfer-column", description: "Column background", default: "light-dark(rgba(20,19,17,0.04), rgba(236,235,230,0.06))" },
    { name: "--cui-transfer-border", description: "Row, menu, empty-slot and Undo outlines (decorative)", default: "light-dark(rgba(20,19,17,0.15), rgba(236,235,230,0.15))" },
    { name: "--cui-transfer-input-border", description: "Outline of the Move menu selects (their only boundary)", default: "light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45))" },
    { name: "--cui-transfer-placeholder", description: "Drop placeholder outline", default: "light-dark(rgba(20,19,17,0.35), rgba(236,235,230,0.35))" },
    { name: "--cui-transfer-valid", description: "Valid target outline and label", default: "light-dark(#1a6b45, #5fcf8f)" },
    { name: "--cui-transfer-blocked", description: "Blocked target, errors and diagnostics", default: "light-dark(#b8310c, #ff8a65)" },
    { name: "--cui-transfer-focus", description: "Focus ring and primary button", default: "light-dark(#141311, #ecebe6)" },
  ],
  examples: [
    {
      id: "workflow",
      title: "Workflow with a demo host",
      description: "Four columns: one empty, one read-only (Archive), one capacity-limited (Doing, 3). The host accepts after 500 ms; tick the box to make it refuse. Try the Move menu, a drag, and Undo.",
      code: `<TransferBoard containers={columns} items={tasks} itemsByContainer={host.board} revision={host.revision}
  resolution={host.resolution} onMoveRequest={host.move} onUndoRequest={host.move} undoEnabled
  canMove={(m) => (m.toContainerId === "done" && m.fromContainerId === "todo" ? { allowed: false, reason: "Start it first." } : true)} />`,
    },
    {
      id: "external",
      title: "External reorder during a drag",
      description: "Press the button while dragging: the host's revision changes, the preview is discarded and the board shows the new order.",
      code: `<button onClick={host.shuffle}>Reorder from the server</button>`,
    },
    {
      id: "invalid",
      title: "Duplicate ids",
      description: "The same item listed in two columns produces a visible diagnostic and disables every move.",
      code: `<TransferBoard itemsByContainer={{ todo: ["a", "b"], doing: ["a"] }} … />`,
    },
    {
      id: "custom",
      title: "Custom rows (library variant)",
      description: "renderItem receives the handle and the Move control; put them where they belong.",
      code: `renderItem={(item, ctx) => <div className="flex items-center gap-2">{ctx.handle}<img … /><span>{item.title}</span>{ctx.moveMenu}</div>}`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (idle | preview | pending) and an optional \`role="note"\` diagnostic. A horizontally scrollable, snap-aligned board holds one \`section\` per container (heading + authoritative count, target label while dragging, a labelled list of rows). Each row has a drag handle button and a Move button that opens an inline \`role="dialog"\` with Destination and Position selects, a reason when blocked, Cancel and Move here.

- **Move menu**: destination options show why they are blocked; positions are "Before <item>" or "At the end"; confirmation emits one intent with \`source: "menu"\` (C44-T07).
- **Drag**: the handle captures the pointer after 6 px. \`elementFromPoint\` finds the container and the row whose midpoint is below the pointer gives \`beforeItemId\` (C44-T03). The source lists are never modified: a placeholder row marks the candidate slot and the dragged row collapses in place so its captured handle stays mounted. Counts stay authoritative.
- **Policy**: read-only and capacity checks run first, then \`canMove\`; blocked targets show "⊘ reason" and a drop there emits nothing (C44-T02).
- **Transaction**: a drop or confirmation calls \`onMoveRequest\` once with \`baseRevision\`; the row is \`aria-busy\` until a matching resolution. Accepted: the host's new board renders and the item's Move control is focused. Rejected: nothing changed locally, the reason is announced, focus returns (C44-T05).
- **Undo**: the inverse of the last accepted move, addressed against the current board (\`beforeItemId\` = the original next sibling if still there); a missing origin container is explained, not forced (C44-T06).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The Move menu works with clicks and taps alone (WCAG 2.2 SC 2.5.7); keyboard users get the same dialog, Escape closes it and returns focus.
- Handles are buttons named "Drag <title>" with \`touch-action: none\` on themselves only; the board and page keep scrolling (C44-T08).
- One polite status region announces pickup targets ("Drop to move to Done before Task B"), blocked reasons, pending, completion and rejection; never pixel positions.
- Column headers are headings; lists are labelled "<Column> items"; counts carry an aria-label.
- Reduced motion removes the spring shifts; preview, placeholder and all controls remain.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Rows use Motion \`layout="position"\` so neighbours spring into place without remounting. Hit testing runs one \`elementFromPoint\` per pointer move plus rect reads for the rows of one column. Autoscroll is a requestAnimationFrame loop that exists only while the pointer is within 40 px of the board's top or bottom edge and stops on cancel or leave (C44-T09). Verified at 5 columns × 20 rows in the docs; larger boards should virtualise on the host side.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- One item at a time; no multi-select, cross-window drag or virtualisation (deferred).
- The drag engine is a minimal Pointer Events implementation rather than dnd-kit (see DECISIONS 014); hosts that need dnd-kit's sensors can wrap the Move-menu core with their own engine.
- Horizontal autoscroll across columns is not implemented; narrow screens scroll columns by swipe and use the Move menu.`,
    },
  ],
  sourceFiles: ["components/ui/transfer-board.tsx", "lib/board-moves.ts", "lib/transactions.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. References studied: dnd kit's multiple sortable lists guide (contract shape only; not a dependency, see DECISIONS 014) and WCAG 2.2 SC 2.5.7. Move intent, revision and undo contracts from Collection 02 brief #44. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const transferBoardPlayground: PlaygroundDef = {
  initial: { variant: "workflow", autoscroll: true, undoEnabled: true, hostDelay: 500, reject: false },
  defaults: { variant: "workflow", autoscroll: true, undoEnabled: false, hostDelay: 500, reject: false, motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Workflow", value: "workflow" }, { label: "Library", value: "library" }, { label: "Priority", value: "priority" }] },
    { type: "boolean", prop: "autoscroll", label: "Autoscroll", group: "Drag" },
    { type: "boolean", prop: "undoEnabled", label: "Undo button", group: "Controls" },
    { type: "range", prop: "hostDelay", label: "Host delay (demo)", group: "Demo host", min: 0, max: 3000, step: 100, unit: "ms" },
    { type: "boolean", prop: "reject", label: "Host refuses (demo)", group: "Demo host" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Refusing host", values: { reject: true } },
    { name: "Priority list", values: { variant: "priority" } },
  ],
};
