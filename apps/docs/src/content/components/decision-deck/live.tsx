"use client";

import { useEffect, useRef, useState } from "react";
import { DecisionDeck, type Decision, type DecisionDeckProps, type DecisionIntent, type DeckItem, type Resolution, type UndoIntent } from "@/components/ui/decision-deck";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

interface Card extends DeckItem {
  body: string;
  hue: number;
}
const CARDS: Card[] = [
  { id: "c1", title: "Rename the billing page", body: "Proposes “Plans & usage” instead of “Billing”. Two reviewers approved the copy.", hue: 24 },
  { id: "c2", title: "Bump node to 24", body: "CI green on all three platforms. Changelog attached.", hue: 200 },
  { id: "c3", title: "Delete the legacy exporter", body: "Removes 2 400 lines. One customer still calls the endpoint weekly.", hue: 0 },
  { id: "c4", title: "Dark mode for the docs", body: "Tokens only; no component changes. Screenshots in the thread.", hue: 260 },
  { id: "c5", title: "Retry failed webhooks", body: "Exponential backoff, five attempts, dead-letter after that.", hue: 140 },
];
const REVIEW = [
  { id: "reject", label: "Reject" },
  { id: "accept", label: "Approve", stamp: "Approved" },
] as const;

/** A demo host: owns decisions, answers requests after a delay, may refuse one item once. */
function useDeckHost(opts: { delay?: number; refuse?: Set<string>; undoRefuse?: boolean; initial?: Decision[] } = {}) {
  const [decisions, setDecisions] = useState<Decision[]>(opts.initial ?? []);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const refused = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void) => {
    const t = setTimeout(fn, opts.delay ?? 600);
    timers.current.push(t);
  };
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 8));
  const decide = (i: DecisionIntent) => {
    push(`onDecisionRequest(${i.itemId}, ${i.outcomeId}, ${i.source})`);
    later(() => {
      if (opts.refuse?.has(i.itemId) && !refused.current.has(i.itemId)) {
        refused.current.add(i.itemId);
        setResolution({ requestId: i.requestId, accepted: false, message: "Host refused: this item needs a second reviewer." });
        push(`host → rejected ${i.itemId}`);
        return;
      }
      setDecisions((d) => [...d, { decisionId: `d-${d.length + 1}`, itemId: i.itemId, outcomeId: i.outcomeId, requestId: i.requestId, at: Date.now() }]);
      setResolution({ requestId: i.requestId, accepted: true });
      push(`host → accepted ${i.itemId}`);
    });
  };
  const undo = (i: UndoIntent) => {
    push(`onUndoRequest(${i.decisionId})`);
    later(() => {
      if (opts.undoRefuse) {
        setResolution({ requestId: i.requestId, accepted: false, message: "Host refused undo: already published." });
        push("host → undo refused");
        return;
      }
      setDecisions((d) => d.filter((x) => x.decisionId !== i.decisionId));
      setResolution({ requestId: i.requestId, accepted: true });
      push(`host → undone ${i.decisionId}`);
    });
  };
  return { decisions, resolution, decide, undo, log };
}

const renderCard = (c: Card) => (
  <article className="p-5">
    <div className="mb-3 h-20 rounded-xl" style={{ background: `linear-gradient(135deg, hsl(${c.hue} 60% 85%), hsl(${c.hue + 30} 45% 60%))` }} aria-hidden />
    <h4 className="m-0 text-[15px] font-semibold">{c.title}</h4>
    <p className="m-0 mt-1 text-[13px] opacity-75">{c.body}</p>
  </article>
);

function PlaygroundDeck({ values }: { values: PlaygroundValues }) {
  const { hostDelay, rejectThird, ...rest } = values as { hostDelay: number; rejectThird: boolean } & Partial<DecisionDeckProps<Card>>;
  const host = useDeckHost({ delay: hostDelay, refuse: rejectThird ? new Set(["c3"]) : undefined });
  const outcomes = rest.variant === "shortlist" ? ([{ id: "skip", label: "Skip" }, { id: "keep", label: "Keep" }] as const) : rest.variant === "study" ? ([{ id: "revisit", label: "Revisit" }, { id: "know", label: "Know it" }] as const) : REVIEW;
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <DecisionDeck<Card> items={CARDS} decisions={host.decisions} resolution={host.resolution} outcomes={outcomes} onDecisionRequest={host.decide} onUndoRequest={host.undo} renderCard={renderCard} {...rest} />
      <EventLog entries={host.log} />
    </div>
  );
}

function Review() {
  const host = useDeckHost({ delay: 600, refuse: new Set(["c3"]) });
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <DecisionDeck<Card> items={CARDS} decisions={host.decisions} resolution={host.resolution} outcomes={REVIEW} onDecisionRequest={host.decide} onUndoRequest={host.undo} renderCard={renderCard} />
      <EventLog entries={host.log} />
    </div>
  );
}

function Removal() {
  const host = useDeckHost({ delay: 400 });
  const [items, setItems] = useState(CARDS);
  const decided = new Set(host.decisions.map((d) => d.itemId));
  const active = items.find((i) => !decided.has(i.id));
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <button type="button" disabled={!active} onClick={() => setItems((x) => x.filter((i) => i.id !== active!.id))} className="rounded-full border border-current px-4 py-1.5 text-sm disabled:opacity-40">
        Remove active item{active ? ` (${active.title})` : ""}
      </button>
      <DecisionDeck<Card> items={items} decisions={host.decisions} resolution={host.resolution} outcomes={REVIEW} onDecisionRequest={host.decide} renderCard={renderCard} undo={false} />
    </div>
  );
}

function Editable() {
  const host = useDeckHost({ delay: 300 });
  return (
    <DecisionDeck<Card>
      items={CARDS.slice(0, 3)}
      decisions={host.decisions}
      resolution={host.resolution}
      outcomes={REVIEW}
      onDecisionRequest={host.decide}
      renderCard={(c) => (
        <div className="flex flex-col gap-2 p-5">
          <a href="#editable" className="text-[15px] font-semibold underline">
            {c.title}
          </a>
          <textarea aria-label={`Notes for ${c.title}`} rows={2} placeholder="Reviewer notes…" className="rounded-md border border-[light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45))] p-2 text-[13px]" />
          <button type="button" className="self-start rounded-full border border-current px-3 py-1 text-[12px]" onClick={() => alert("Opened details")}>
            Details
          </button>
        </div>
      )}
      undo={false}
    />
  );
}

function Complete() {
  const two = CARDS.slice(0, 2);
  const host = useDeckHost({ delay: 500, initial: two.map((c, i) => ({ decisionId: `seed-${i + 1}`, itemId: c.id, outcomeId: i === 0 ? "accept" : "reject", requestId: `seed-${i + 1}` })) });
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <DecisionDeck<Card> items={two} decisions={host.decisions} resolution={host.resolution} outcomes={REVIEW} onDecisionRequest={host.decide} onUndoRequest={host.undo} renderCard={renderCard} renderEmpty={(h) => <p className="m-0">Review complete — {h.length} decisions. Undo reverses the latest.</p>} />
      <EventLog entries={host.log} />
    </div>
  );
}

export const decisionDeckLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundDeck key={`${values.hostDelay}-${values.rejectThird}-${values.variant}`} values={values} />,
  cardPreview: () => (
    <div className="relative h-24 w-40" aria-hidden>
      <div className="absolute inset-x-3 top-4 h-16 rounded-xl bg-[light-dark(rgba(20,19,17,0.12),rgba(236,235,230,0.12))]" />
      <div className="absolute inset-x-1.5 top-2 h-16 rounded-xl bg-[light-dark(rgba(20,19,17,0.2),rgba(236,235,230,0.2))]" />
      <div className="absolute inset-x-0 top-0 h-16 rotate-[-4deg] rounded-xl bg-[light-dark(#faf9f6,#1f1f1c)] shadow-[0_8px_20px_rgba(0,0,0,0.2)]" />
    </div>
  ),
  examples: {
    review: () => <Review />,
    removal: () => <Removal />,
    editable: () => <Editable />,
    complete: () => <Complete />,
  },
};
