import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const decisionDeckMeta: ComponentMeta = {
  slug: "decision-deck",
  name: "DecisionDeck",
  title: "Decision Deck",
  tagline: "A card stack that records decisions, not swipes.",
  description:
    "One readable card with two shallow backing cards. Swipe past 30% of the width (or flick), press an arrow key, or click Reject/Accept: each path emits one decision request with a fresh id. The deck shows pending until the host answers; accepted resolutions advance the deck from the host's updated history, rejected ones restore the card with the host's message, stale ones are ignored. Undo asks the host to reverse the latest decision by id. Buttons are a full no-drag path; links and inputs inside cards keep working.",
  category: "layout",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["cards", "swipe", "review", "triage", "queue", "undo", "stack", "decision", "approve"],
  registryName: "decision-deck",
  importPath: "@/components/ui/decision-deck",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "transactions"] },
  props: [
    { name: "items", type: "DeckItem[] ({ id, title, … })", default: "—", description: "Required. The first item without a decision is active." },
    { name: "decisions", type: "Decision[]", default: "[]", description: "Authoritative history: { decisionId, itemId, outcomeId, requestId }. Controlled by the host." },
    { name: "resolution", type: "{ requestId, accepted, message?, revision? } | null", default: "null", description: "Latest host answer. Only the pending request id settles; others are ignored." },
    { name: "onDecisionRequest", type: "(intent: { requestId, itemId, outcomeId, source }) => void", default: "—", description: "Required. Exactly one call per item while pending." },
    { name: "onUndoRequest", type: "(intent: { requestId, decisionId, itemId }) => void", default: "—", description: "Targets the latest decision id; the host decides reversibility." },
    { name: "outcomes", type: "[DeckOutcome, DeckOutcome]", default: "—", description: "Required. [left-swipe, right-swipe] with stable ids, labels and optional stamp text." },
    { name: "swipeThreshold", type: "number (fraction)", default: "0.3", description: "Travel needed on release." },
    { name: "flickVelocity", type: "number (px/s)", default: "700", description: "A flick this fast commits with at least 15% travel." },
    { name: "maxRotation", type: "number (deg)", default: "8", description: "Decorative tilt while dragging." },
    { name: "renderCard", type: "(item, { active, depth, pending }) => ReactNode", default: "—", description: "Required. Card content; interactive descendants never start a gesture." },
    { name: "renderEmpty", type: "(history) => ReactNode", default: "All done + count", description: "Completion slot." },
    { name: "variant", type: '"review" | "shortlist" | "study"', default: '"review"', description: "shortlist adds a kept count." },
    { name: "undo", type: "boolean", default: "!!onUndoRequest", description: "Show the Undo button." },
    { name: "motion / durationScale", type: '"auto" | "reduced" | "off" / number', default: '"auto" / 1', description: "Exit flight (≤ 280 ms) and 220 ms return under full motion only." },
    { name: "ref", type: "DecisionDeckHandle", default: "—", description: "{ container, focusActive() }." },
  ],
  cssVars: [
    { name: "--cui-deck-gap", description: "Vertical gap between stack, controls and status", default: "12px" },
    { name: "--cui-deck-shadow", description: "Card shadow", default: "0 12px 32px rgba(0,0,0,0.18)" },
    { name: "--cui-deck-text", description: "Text", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-deck-accept", description: "Right outcome colour (stamp, button)", default: "light-dark(#1a6b45, #5fcf8f)" },
    { name: "--cui-deck-reject", description: "Left outcome colour and error text", default: "light-dark(#b8310c, #ff8a65)" },
    { name: "--cui-deck-surface", description: "Card background", default: "light-dark(#faf9f6, #1f1f1c)" },
    { name: "--cui-deck-border", description: "Empty-state and button outlines (decorative)", default: "light-dark(rgba(20,19,17,0.25), rgba(236,235,230,0.25))" },
    { name: "--cui-deck-focus", description: "Focus ring", default: "light-dark(#141311, #ecebe6)" },
  ],
  examples: [
    {
      id: "review",
      title: "Review queue with a demo host",
      description: "Five cards. The host acknowledges after 600 ms and refuses card 3 once. Swipe, use ← →, or the buttons. The log shows every intent and resolution.",
      code: `<DecisionDeck items={cards} decisions={host.decisions} resolution={host.resolution}
  outcomes={[{ id: "reject", label: "Reject" }, { id: "accept", label: "Approve" }]}
  onDecisionRequest={host.decide} onUndoRequest={host.undo}
  renderCard={(c) => <article className="p-5"><h4>{c.title}</h4><p>{c.body}</p></article>} />`,
    },
    {
      id: "removal",
      title: "External removal mid-gesture",
      description: "Press the button while dragging (or not): the active item disappears from items, capture is released and the next card is active.",
      code: `<button onClick={() => setItems(items.filter((i) => i.id !== activeId))}>Remove active item</button>`,
    },
    {
      id: "editable",
      title: "Editable card content",
      description: "Gestures ignore inputs, links and buttons inside the card; the drag surface is the card itself.",
      code: `renderCard={(c) => <div className="p-5"><a href="#">{c.title}</a><textarea aria-label="Notes" /></div>}`,
    },
    {
      id: "complete",
      title: "Completed deck with undo",
      description: "All decided. History stays; Undo asks the host to reverse the last one.",
      code: `<DecisionDeck items={two} decisions={allDecided} … />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (ready | dragging | pending | empty). The stack holds up to two aria-hidden backing cards and the active card: a focusable \`role="group"\` named by the item title, with two text stamps near the top edges. Below: Reject/Undo/Accept buttons, a counter and a \`role="status"\` strip.

- **Gesture**: an 8 px horizontal intent lifts the card and captures the pointer; vertical intent leaves scrolling alone. Release past \`swipeThreshold\` × width, or a flick above \`flickVelocity\` with ≥ 15% travel, requests the outcome; otherwise the card returns in 220 ms (C43-T01).
- **Transaction**: \`request()\` creates a request id, stores it as pending, locks the buttons and gestures for that item (C43-T03) and calls \`onDecisionRequest\`. The resolution is matched during render against the pending id; accepted advances (the host appended the decision), rejected restores with the message (C43-T04), stale is ignored (C43-T05).
- **Exit**: under full motion the accepted card flies out in ≤ 280 ms via AnimatePresence; reduced and off replace it immediately. The flight never reports success.
- **Undo**: \`onUndoRequest\` carries the latest decision id; while pending nothing is reversed locally (C43-T06).
- **External removal**: if the dragged item leaves \`items\`, capture is released and the gesture reset (C43-T07).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Visible buttons are the single-pointer, no-drag path (WCAG 2.2 dragging movements); ← and → on the focused card are the keyboard path (C43-T09).
- Stamps are text with colour, not colour alone; the status strip has a fixed height so pending and error feedback never resize the stack.
- After an accepted decision, focus moves to the same outcome button for the next item and the status announces "Next: <title>" once; drag frames are never announced.
- Interactive descendants (links, inputs, buttons, contenteditable, \`[data-no-drag]\`) never start a gesture, so card forms stay usable (C43-T08).
- Focus is never moved on mount.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Only three cards render. A drag updates one motion value (x); rotation and stamp opacity derive from it without React renders. Return and exit are single Motion animations. No timers, no listeners at rest.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Two outcomes only; no batch or optimistic pipelining (deferred by the brief).
- The demo host in the examples acknowledges synchronously after a delay; a real host must own the decisions array and resolution.
- Backing cards are static (no parallax); they do not react to the drag.`,
    },
  ],
  sourceFiles: ["components/ui/decision-deck.tsx", "lib/transactions.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: Codrops Elastic Stack (2013 tutorial and demo; stacked-card dragging as visual inspiration only, no code). Transaction, undo and no-drag contracts from Collection 02 brief #43 and WCAG 2.2 SC 2.5.7. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const decisionDeckPlayground: PlaygroundDef = {
  initial: { variant: "review", swipeThreshold: 0.3, flickVelocity: 700, maxRotation: 8, undo: true, hostDelay: 600, rejectThird: true },
  defaults: { variant: "review", swipeThreshold: 0.3, flickVelocity: 700, maxRotation: 8, undo: true, hostDelay: 600, rejectThird: true, motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Review", value: "review" }, { label: "Shortlist", value: "shortlist" }, { label: "Study", value: "study" }] },
    { type: "range", prop: "swipeThreshold", label: "Swipe threshold", group: "Gesture", min: 0.1, max: 0.6, step: 0.05 },
    { type: "range", prop: "flickVelocity", label: "Flick velocity", group: "Gesture", min: 200, max: 2000, step: 50, unit: "px/s" },
    { type: "range", prop: "maxRotation", label: "Max rotation", group: "Motion", min: 0, max: 20, step: 1, unit: "°" },
    { type: "boolean", prop: "undo", label: "Undo button", group: "Controls" },
    { type: "range", prop: "hostDelay", label: "Host delay (demo)", group: "Demo host", min: 0, max: 3000, step: 100, unit: "ms" },
    { type: "boolean", prop: "rejectThird", label: "Host refuses card 3 (demo)", group: "Demo host" },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Shortlist, instant host", values: { variant: "shortlist", hostDelay: 0, rejectThird: false } },
    { name: "Slow host", values: { hostDelay: 2500 } },
  ],
};
