"use client";

import { useEffect, useRef, useState } from "react";
import { TransferBoard, type ItemsByContainer, type MoveIntent, type Resolution, type TransferBoardProps, type TransferContainer, type TransferItem } from "@/components/ui/transfer-board";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

export const COLUMNS: TransferContainer[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing", capacity: 3 },
  { id: "done", label: "Done" },
  { id: "archive", label: "Archive", readOnly: true },
];
interface Task extends TransferItem {
  tag: string;
}
export const TASKS: Task[] = [
  { id: "t1", title: "Write the release notes for 2.4 including the long list of deprecations that nobody reads", tag: "docs" },
  { id: "t2", title: "Rotate the staging certificates", tag: "ops" },
  { id: "t3", title: "Fix the flaky gallery test", tag: "test" },
  { id: "t4", title: "Design the empty state", tag: "design" },
  { id: "t5", title: "Review PR 418", tag: "review" },
  { id: "t6", title: "Migrate avatars to the new bucket", tag: "ops" },
  { id: "t7", title: "Benchmark the registry build", tag: "perf" },
];
export const INITIAL: ItemsByContainer = { todo: ["t1", "t2", "t3", "t4"], doing: ["t5", "t6"], done: [], archive: ["t7"] };

function applyIntent(b: ItemsByContainer, i: MoveIntent): ItemsByContainer {
  const from = b[i.fromContainerId]!.filter((x) => x !== i.itemId);
  const base = i.fromContainerId === i.toContainerId ? from : b[i.toContainerId]!.filter((x) => x !== i.itemId);
  const idx = i.beforeItemId ? base.indexOf(i.beforeItemId) : base.length;
  return { ...b, [i.fromContainerId]: from, [i.toContainerId]: [...base.slice(0, idx), i.itemId, ...base.slice(idx)] };
}

/** Demo host: owns the board + revision, answers after a delay, can refuse. */
function useBoardHost(opts: { delay?: number; reject?: boolean } = {}) {
  const [board, setBoard] = useState<ItemsByContainer>(INITIAL);
  const [revision, setRevision] = useState(1);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 8));
  const move = (i: MoveIntent) => {
    push(`${i.source === "undo" ? "onUndoRequest" : "onMoveRequest"}(${i.itemId} → ${i.toContainerId}${i.beforeItemId ? ` before ${i.beforeItemId}` : ""}, rev ${i.baseRevision})`);
    const t = setTimeout(() => {
      if (opts.reject) {
        setResolution({ requestId: i.requestId, accepted: false, message: "Host refused: you do not own this item." });
        push("host → rejected");
        return;
      }
      setBoard((b) => applyIntent(b, i));
      setRevision((r) => r + 1);
      setResolution({ requestId: i.requestId, accepted: true });
      push("host → accepted");
    }, opts.delay ?? 500);
    timers.current.push(t);
  };
  const shuffle = () => {
    setBoard((b) => ({ ...b, todo: [...b.todo].reverse() }));
    setRevision((r) => r + 1);
    push("host → external reorder (revision bumped)");
  };
  return { board, revision, resolution, move, shuffle, log };
}

const canMove: TransferBoardProps<Task>["canMove"] = (m) => (m.fromContainerId === "todo" && m.toContainerId === "done" ? { allowed: false, reason: "Start it first (To do → Doing)." } : true);

function PlaygroundBoard({ values }: { values: PlaygroundValues }) {
  const { hostDelay, reject, ...rest } = values as { hostDelay: number; reject: boolean } & Partial<TransferBoardProps<Task>>;
  const host = useBoardHost({ delay: hostDelay, reject });
  return (
    <div className="flex w-full flex-col gap-4">
      <TransferBoard<Task> containers={COLUMNS} items={TASKS} itemsByContainer={host.board} revision={host.revision} resolution={host.resolution} onMoveRequest={host.move} onUndoRequest={host.move} canMove={canMove} {...rest} />
      <EventLog entries={host.log} />
    </div>
  );
}

function Workflow() {
  const [reject, setReject] = useState(false);
  const host = useBoardHost({ delay: 500, reject });
  return (
    <div className="flex w-full flex-col gap-3">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={reject} onChange={(e) => setReject(e.target.checked)} />
        Host refuses every move
      </label>
      <TransferBoard<Task> containers={COLUMNS} items={TASKS} itemsByContainer={host.board} revision={host.revision} resolution={host.resolution} onMoveRequest={host.move} onUndoRequest={host.move} canMove={canMove} undoEnabled />
      <EventLog entries={host.log} />
    </div>
  );
}

function External() {
  const host = useBoardHost({ delay: 300 });
  const [armed, setArmed] = useState(false);
  const arm = () => {
    setArmed(true);
    setTimeout(() => {
      host.shuffle();
      setArmed(false);
    }, 1500);
  };
  return (
    <div className="flex w-full flex-col gap-3">
      <button type="button" onClick={arm} disabled={armed} className="self-start rounded-full border border-current px-4 py-1.5 text-sm disabled:opacity-50">
        {armed ? "Server reorders in 1.5 s — start dragging" : "Reorder from the server in 1.5 s"}
      </button>
      <TransferBoard<Task> containers={COLUMNS.slice(0, 3)} items={TASKS} itemsByContainer={{ todo: host.board.todo, doing: host.board.doing, done: host.board.done }} revision={host.revision} resolution={host.resolution} onMoveRequest={host.move} />
      <EventLog entries={host.log} />
    </div>
  );
}

export const transferBoardLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundBoard key={`${values.hostDelay}-${values.reject}`} values={values} />,
  cardPreview: () => (
    <div className="grid w-56 grid-cols-3 gap-1.5" aria-hidden>
      {[3, 2, 1].map((n, c) => (
        <div key={c} className="flex flex-col gap-1 rounded-lg bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.08))] p-1.5">
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="h-4 rounded bg-[light-dark(#faf9f6,#1f1f1c)] shadow-sm" />
          ))}
        </div>
      ))}
    </div>
  ),
  examples: {
    workflow: () => <Workflow />,
    external: () => <External />,
    invalid: () => <TransferBoard containers={COLUMNS.slice(0, 2)} items={TASKS} itemsByContainer={{ todo: ["t1", "t2"], doing: ["t1", "t3"] }} revision={1} onMoveRequest={() => {}} />,
    custom: () => <CustomRows />,
  },
};

function CustomRows() {
  const host = useBoardHost({ delay: 300 });
  return (
    <TransferBoard<Task>
      variant="library"
      containers={[
        { id: "todo", label: "Inbox" },
        { id: "doing", label: "Listening" },
        { id: "done", label: "Favourites" },
      ]}
      items={TASKS}
      itemsByContainer={{ todo: host.board.todo, doing: host.board.doing, done: host.board.done }}
      revision={host.revision}
      resolution={host.resolution}
      onMoveRequest={host.move}
      renderItem={(item, ctx) => (
        <div className={`flex min-w-0 flex-1 items-center gap-2 ${ctx.pending ? "opacity-60" : ""}`}>
          {ctx.handle}
          <span className="grid size-8 shrink-0 place-items-center rounded-md text-[10px] font-bold uppercase text-[#141311]" style={{ background: `hsl(${(item.tag.length * 47) % 360} 50% 85%)` }}>
            {item.tag.slice(0, 2)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
          {ctx.moveMenu}
        </div>
      )}
    />
  );
}
