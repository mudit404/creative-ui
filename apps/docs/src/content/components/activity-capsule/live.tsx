"use client";

import { useEffect, useRef, useState } from "react";
import { ActivityCapsule, type ActivityCapsuleProps, type TaskSnapshot } from "@/components/ui/activity-capsule";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

/* ── a tiny simulated host: owns tasks, answers requests with snapshots ── */

type Host = {
  tasks: TaskSnapshot[];
  log: string[];
};

function useHost(initial: () => TaskSnapshot[], opts: { tick?: (t: TaskSnapshot, i: number) => TaskSnapshot | null; interval?: number; cancelDelay?: number; raceSuccess?: boolean } = {}) {
  const [host, setHost] = useState<Host>(() => ({ tasks: initial(), log: [] }));
  const attempts = useRef<Record<string, number>>({});
  const update = (fn: (t: TaskSnapshot[]) => TaskSnapshot[], line?: string) =>
    setHost((h) => ({ tasks: fn(h.tasks), log: line ? [line, ...h.log].slice(0, 8) : h.log }));
  useEffect(() => {
    if (!opts.tick) return;
    const id = setInterval(() => update((tasks) => tasks.map((t, i) => (t.status === "running" || t.status === "cancel-requested" ? (opts.tick!(t, i) ?? t) : t))), opts.interval ?? 700);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onCancelRequest = (id: string, attemptId: string) => {
    update((t) => t, `onCancelRequest(${id}, ${attemptId})`);
    setTimeout(() => {
      update(
        (tasks) =>
          tasks.map((t) =>
            t.id === id && t.attemptId === attemptId && (t.status === "running" || t.status === "cancel-requested" || t.status === "queued")
              ? { ...t, revision: t.revision + 1, status: opts.raceSuccess ? "succeeded" : "cancelled", progress: opts.raceSuccess && t.progress && !("indeterminate" in t.progress) ? { ...t.progress, completed: t.progress.total } : t.progress, updatedAt: Date.now() }
              : t,
          ),
        opts.raceSuccess ? `host: ${id} had already succeeded` : `host: ${id} cancelled`,
      );
    }, opts.cancelDelay ?? 900);
  };
  const onRetryRequest = (id: string, attemptId: string) => {
    const n = (attempts.current[id] ?? 1) + 1;
    attempts.current[id] = n;
    update(
      (tasks) => tasks.map((t) => (t.id === id ? { ...t, attemptId: `a${n}`, attempt: n, revision: 1, status: "running", progress: t.progress && !("indeterminate" in t.progress) ? { ...t.progress, completed: 0 } : t.progress, detail: undefined, updatedAt: Date.now() } : t)),
      `onRetryRequest(${id}, ${attemptId}) → attempt ${n}`,
    );
  };
  const onDismiss = (id: string, attemptId: string) => update((tasks) => tasks.filter((t) => !(t.id === id && t.attemptId === attemptId)), `onDismiss(${id}, ${attemptId}) → removed`);
  return { host, update, onCancelRequest, onRetryRequest, onDismiss };
}

const advance = (t: TaskSnapshot): TaskSnapshot | null => {
  if (!t.progress || "indeterminate" in t.progress) return null;
  const completed = Math.min(t.progress.total, t.progress.completed + 1);
  const done = completed === t.progress.total;
  return { ...t, revision: t.revision + 1, progress: { ...t.progress, completed }, status: done ? "succeeded" : t.status, updatedAt: Date.now() };
};

/* no Date.now() here: fixtures are prerendered; hosts stamp updatedAt when they emit */
const snap = (id: string, label: string, over: Partial<TaskSnapshot> = {}): TaskSnapshot => ({ id, attemptId: "a1", attempt: 1, revision: 1, label, status: "running", ...over });

/* ── playground ── */

function scenarioTasks(s: string): TaskSnapshot[] {
  switch (s) {
    case "indeterminate":
      return [snap("gen", "Generating summary", { progress: { indeterminate: true } })];
    case "queue":
      return [
        snap("up", "Uploading 12 photos", { progress: { completed: 4, total: 12, unit: "files" }, priority: 2 }),
        snap("gen", "Generating captions", { progress: { indeterminate: true } }),
        snap("exp", "Export PDF", { status: "queued" }),
        snap("old", "Yesterday's import", { status: "succeeded" }),
        snap("bad", "Sync contacts", { status: "failed", detail: "Network timeout" }),
      ];
    case "failed":
      return [snap("build", "Build site", { status: "failed", detail: "Exit code 1 in step compile" })];
    case "empty":
      return [];
    default:
      return [snap("up", "Uploading 12 photos", { progress: { completed: 3, total: 12, unit: "files" } })];
  }
}

function PlaygroundCapsule({ values }: { values: PlaygroundValues }) {
  const { scenario, ...rest } = values as { scenario: string } & Omit<ActivityCapsuleProps, "tasks">;
  const { host, onCancelRequest, onRetryRequest, onDismiss } = useHost(() => scenarioTasks(scenario), { tick: advance, interval: 1200 });
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <ActivityCapsule tasks={host.tasks} {...rest} onCancelRequest={onCancelRequest} onRetryRequest={onRetryRequest} onDismiss={onDismiss} />
      <EventLog entries={host.log} />
    </div>
  );
}

/* ── examples ── */

function Upload() {
  const { host, onCancelRequest, onDismiss } = useHost(() => [snap("up", "Uploading 12 photos", { progress: { completed: 0, total: 12, unit: "files" } })], { tick: advance, interval: 900 });
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <ActivityCapsule tasks={host.tasks} onCancelRequest={onCancelRequest} onDismiss={onDismiss} />
      <EventLog entries={host.log} />
    </div>
  );
}

function Indeterminate() {
  const { host, update } = useHost(() => [snap("gen", "Generating summary", { progress: { indeterminate: true } })]);
  useEffect(() => {
    const id = setTimeout(() => update((t) => t.map((x) => ({ ...x, revision: 2, status: "succeeded", updatedAt: Date.now() })), "host: generation finished"), 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <ActivityCapsule tasks={host.tasks} onDismiss={() => update((t) => t.filter(() => false), "dismissed")} />
      <EventLog entries={host.log} />
    </div>
  );
}

function Race() {
  // 1.5 s gives the "Cancel requested" state time to be seen (and asserted) before the host answers
  const { host, onCancelRequest, onDismiss } = useHost(() => [snap("exp", "Exporting report", { progress: { completed: 9, total: 10 } })], { raceSuccess: true, cancelDelay: 1500 });
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <ActivityCapsule tasks={host.tasks} onCancelRequest={onCancelRequest} onDismiss={onDismiss} />
      <EventLog entries={host.log} />
    </div>
  );
}

function Retry() {
  const { host, update, onRetryRequest, onDismiss } = useHost(() => [snap("build", "Build site", { status: "failed", detail: "Exit code 1" })]);
  const staleSent = useRef(false);
  useEffect(() => {
    const running = host.tasks.find((t) => t.id === "build" && t.attempt === 2 && t.status === "running");
    if (running && !staleSent.current) {
      staleSent.current = true;
      const id = setTimeout(() => update((t) => [...t, snap("build", "Build site", { attemptId: "a1", attempt: 1, revision: 9, status: "succeeded" })], "late event from attempt a1 (succeeded) → rejected"), 1200);
      return () => clearTimeout(id);
    }
  }, [host.tasks, update]);
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <ActivityCapsule tasks={host.tasks} defaultExpanded onRetryRequest={onRetryRequest} onDismiss={onDismiss} />
      <EventLog entries={host.log} />
    </div>
  );
}

const QUEUE: TaskSnapshot[] = Array.from({ length: 20 }, (_, i) =>
  snap(`t${i}`, `Task ${i + 1}: ${["Resize", "Transcode", "Index", "Upload", "Notify"][i % 5]}`, {
    status: i < 3 ? "running" : i < 14 ? "queued" : i < 18 ? "succeeded" : "failed",
    priority: i === 1 ? 5 : 0,
    progress: i < 3 ? { completed: (i + 1) * 20, total: 100 } : undefined,
  }),
);

function Queue() {
  const { host, onCancelRequest, onRetryRequest, onDismiss } = useHost(() => QUEUE, { tick: advance, interval: 1500 });
  return <ActivityCapsule tasks={host.tasks} defaultExpanded onCancelRequest={onCancelRequest} onRetryRequest={onRetryRequest} onDismiss={onDismiss} />;
}

function Focused() {
  const { host, update, onDismiss } = useHost(() => [snap("done", "Report exported", { status: "succeeded" })]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(4);
  useEffect(() => {
    const id = setInterval(() => {
      const focused = rootRef.current?.contains(document.activeElement);
      if (focused) return; // host policy: never auto-dismiss while focused
      setLeft((n) => {
        if (n <= 1) {
          update((t) => t.filter((x) => x.id !== "done"), "host: auto-removed after 4s without focus");
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={rootRef} className="flex w-full max-w-md flex-col items-center gap-3">
      <ActivityCapsule tasks={host.tasks} onDismiss={onDismiss} />
      <p className="m-0 font-mono text-[12px] opacity-70">{host.tasks.length ? `auto-remove in ${left}s unless focused` : "removed"}</p>
      <EventLog entries={host.log} />
    </div>
  );
}

export const activityCapsuleLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundCapsule key={String(values.scenario)} values={values} />,
  cardPreview: () => <ActivityCapsule tasks={[snap("p", "Uploading 12 photos", { progress: { completed: 7, total: 12 } })]} motion="off" />,
  examples: {
    upload: () => <Upload />,
    indeterminate: () => <Indeterminate />,
    race: () => <Race />,
    retry: () => <Retry />,
    queue: () => <Queue />,
    focused: () => <Focused />,
    placement: () => (
      <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-[light-dark(rgba(20,19,17,0.12),rgba(236,235,230,0.12))] p-2">
        <span className="px-2 text-[13px] font-medium">Library</span>
        <span className="flex-1" />
        <ActivityCapsule placement="inline" tasks={[snap("sync", "Syncing 3 folders", { progress: { completed: 1, total: 3 } })]} />
      </div>
    ),
  },
};
