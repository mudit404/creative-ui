import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const activityCapsuleMeta: ComponentMeta = {
  slug: "activity-capsule",
  name: "ActivityCapsule",
  title: "Activity Capsule",
  tagline: "A morphing status capsule that tells the truth about your tasks.",
  description:
    "A compact 220 px capsule that summarises host-reported tasks and expands to a 360 px task list. The host owns every task: snapshots carry stable ids, attempt numbers and monotonic revisions, and a pure reducer keeps the newest valid state while rejecting stale events. Progress is shown only when reported; indeterminate tasks get a busy indicator, never a percentage. Cancel, retry and dismiss are requests; only a new snapshot changes what the capsule shows. Opening and closing never touch task state.",
  category: "navigation",
  tier: "free",
  status: "experimental",
  version: "0.1.0",
  keywords: ["status", "progress", "task", "upload", "dynamic island", "async", "toast", "job", "queue"],
  registryName: "activity-capsule",
  importPath: "@/components/ui/activity-capsule",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "task-snapshots"] },
  props: [
    { name: "tasks", type: "TaskSnapshot[]", default: "—", description: "Required. { id, attemptId, attempt, revision, label, status, progress?, detail?, priority?, updatedAt? }. May contain several snapshots per task; the newest attempt, then revision, wins." },
    { name: "expanded / defaultExpanded", type: "boolean", default: "false", description: "Disclosure state, independent of task state." },
    { name: "onExpandedChange", type: "(expanded: boolean) => void", default: "—", description: "Open/close proposals." },
    { name: "onCancelRequest", type: "(taskId, attemptId) => void", default: "—", description: "Called once per attempt. The capsule shows \"Cancel requested\" until the host sends cancelled, succeeded or failed." },
    { name: "onRetryRequest", type: "(taskId, attemptId) => void", default: "—", description: "Shown on failed and cancelled tasks. The host answers with a snapshot carrying a higher attempt." },
    { name: "onDismiss", type: "(taskId, attemptId) => void", default: "—", description: "Shown on terminal tasks. Does not cancel or delete anything; the host removes the task from tasks." },
    { name: "primaryTaskId", type: "string", default: "priority, then order", description: "Explicit primary. Otherwise the highest-priority active task (first in input order on ties), else the last terminal task." },
    { name: "placement", type: '"inline" | "bottom" | "top"', default: '"inline"', description: "inline flows with content; bottom/top are fixed with safe-area insets. No portal." },
    { name: "announce", type: '"off" | "milestones"', default: '"milestones"', description: "Polite live region for lifecycle changes and 25% progress steps. Never per render." },
    { name: "label / emptyLabel", type: "string", default: '"Activity" / "No activity"', description: "Summary button name prefix and the no-tasks text." },
    { name: "motion / durationScale", type: '"auto" | "reduced" | "off" / number', default: '"auto" / 1', description: "Shape morph (~240 ms) and text crossfade only. reduced and off change shape immediately." },
    { name: "ref", type: "HTMLButtonElement", default: "—", description: "The summary button." },
  ],
  cssVars: [
    { name: "--cui-capsule-surface", description: "Capsule background (a designed-dark pill; the dark side lifts it off dark pages)", default: "light-dark(#141311, #2a2a27)" },
    { name: "--cui-capsule-text", description: "Text colour", default: "light-dark(#faf9f6, #ecebe6)" },
    { name: "--cui-capsule-progress", description: "Progress fill and success icon (same on both schemes)", default: "#c8f55a" },
    { name: "--cui-capsule-error", description: "Failure icon (same on both schemes)", default: "#ff6b4a" },
    { name: "--cui-capsule-focus", description: "Focus ring (same on both schemes)", default: "#c8f55a" },
  ],
  examples: [
    {
      id: "upload",
      title: "Upload with a known total",
      description: "A simulated host advances completed/total; the capsule interpolates only the decorative fill. Cancel requests go to the host, which confirms a moment later.",
      code: `<ActivityCapsule
  tasks={[{ id: "up", attemptId: "a1", attempt: 1, revision, label: "Uploading 12 photos", status: "running",
            progress: { completed, total: 12, unit: "files" } }]}
  onCancelRequest={(id, attempt) => host.cancel(id, attempt)}
/>`,
    },
    {
      id: "indeterminate",
      title: "Indeterminate generation",
      description: "No total, so no percentage: a busy indicator and \"in progress\". The host finishes it after a while.",
      code: `<ActivityCapsule tasks={[{ id: "gen", attemptId: "a1", attempt: 1, revision: 1, label: "Generating summary", status: "running", progress: { indeterminate: true } }]} />`,
    },
    {
      id: "race",
      title: "Cancel racing success",
      description: "Press Cancel: the host had already finished, so the next snapshot says succeeded. The capsule renders the host's answer, not the request.",
      code: `// user clicks Cancel → onCancelRequest fires → host replies with status: "succeeded"
<ActivityCapsule tasks={[{ ..., status: "succeeded", revision: 3 }]} />`,
    },
    {
      id: "retry",
      title: "Failed task, retry, stale events",
      description: "Retry starts attempt 2. The old attempt then emits a late \"succeeded\" that is ignored (see the console warning).",
      code: `<ActivityCapsule
  tasks={[{ id: "build", attemptId: "a2", attempt: 2, revision: 1, label: "Build", status: "running" },
          { id: "build", attemptId: "a1", attempt: 1, revision: 9, label: "Build", status: "succeeded" }]} // stale: ignored
  onRetryRequest={(id, attempt) => host.retry(id, attempt)}
/>`,
    },
    {
      id: "queue",
      title: "Twenty-task queue",
      description: "Primary by priority then order; the summary counts the rest. Expand to see all.",
      code: `<ActivityCapsule tasks={twentyTasks} defaultExpanded />`,
    },
    {
      id: "focused",
      title: "Terminal task, focused dismissal",
      description: "The host would auto-remove finished tasks after 4 s, but not while the capsule has focus. Tab into it and watch the timer wait.",
      code: `// host policy: remove terminal tasks after 4s unless the capsule contains focus
<ActivityCapsule tasks={tasks} onDismiss={(id) => host.remove(id)} />`,
    },
    {
      id: "placement",
      title: "Inline status in a toolbar",
      description: "placement=\"inline\" keeps it in flow.",
      code: `<ActivityCapsule placement="inline" tasks={[...]} />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A root \`div[data-slot="activity-capsule"]\` with \`data-state="collapsed|expanded"\` and \`data-status\` of the primary task. Inside: a layout-animated shell; a summary row with one \`button[aria-expanded][aria-controls]\` and separate action buttons; a decorative progress line; and a \`region\` holding the task list.

- **Authority**: \`reduceSnapshots(tasks, previous)\` keeps, per task id, the highest attempt and then the highest revision; lower attempts or revisions are rejected with a diagnostic; terminal attempts are frozen. Progress is validated (finite, total > 0, 0 ≤ completed ≤ total).
- **Primary**: explicit \`primaryTaskId\`, else the highest \`priority\` among active tasks (input order breaks ties), else the last terminal task.
- **Requests**: Cancel marks the attempt locally as requested (button disabled, label "Cancel requested") and calls the host once. Retry and Dismiss call the host and change nothing locally.
- **Announcements**: a polite \`role="status"\` region receives a message when a task's status changes or its progress crosses a 25% milestone. The first sight of a running task at 0% is not announced.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The summary is a single button whose name summarises the primary task and the active count; action buttons sit beside it, never inside (C60-T07).
- Enter/Space toggle; Escape closes the panel and returns focus to the summary without touching tasks (C60-T06).
- Status and error are conveyed by text and icon, not colour alone. Timestamps use \`<time dateTime>\`.
- Terminal tasks persist until the host removes them; the focused-dismissal example shows a host policy that pauses while the capsule has focus (C60-T08).
- Reduced motion keeps every action and label (C60-T10).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `No timers. Re-renders happen only when the host passes new snapshots. The layout morph runs ~240 ms on open/close; the progress fill eases 160 ms per reported update; the busy indicator loops only while an indeterminate task is primary and motion is full. The task list is a plain list; virtualise above a few hundred tasks on the host side.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No portal: \`bottom\`/\`top\` use \`position: fixed\` in place. Mount it near the document root for overlay use.
- Snapshots are consumed as given; cross-tab transport, polling and job execution are host concerns (deferred by the brief).
- The "cancel requested" mark is local to the mounted instance; remounting forgets it until the host sends \`cancel-requested\`.`,
    },
  ],
  sourceFiles: ["components/ui/activity-capsule.tsx", "lib/task-snapshots.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: Cult UI Dynamic Island (public demo of a morphing capsule; no code reused). The attempt/revision authority, progress truthfulness and request-only action contract come from Collection 02 brief #60. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const activityCapsulePlayground: PlaygroundDef = {
  initial: { scenario: "upload", defaultExpanded: false, placement: "inline", announce: "milestones", durationScale: 1 },
  defaults: { scenario: "upload", defaultExpanded: false, placement: "inline", announce: "milestones", durationScale: 1, motion: "auto" },
  controls: [
    { type: "select", prop: "scenario", label: "Scenario", group: "Tasks", options: [{ label: "Upload (known total)", value: "upload" }, { label: "Indeterminate", value: "indeterminate" }, { label: "Mixed queue", value: "queue" }, { label: "Failed", value: "failed" }, { label: "Empty", value: "empty" }] },
    { type: "boolean", prop: "defaultExpanded", label: "Expanded initially", group: "State" },
    { type: "select", prop: "placement", label: "Placement", group: "Layout", options: [{ label: "Inline", value: "inline" }] },
    { type: "select", prop: "announce", label: "Announce", group: "Accessibility", options: [{ label: "Milestones", value: "milestones" }, { label: "Off", value: "off" }] },
    { type: "range", prop: "durationScale", label: "Duration scale", group: "Motion", min: 0.25, max: 3, step: 0.25 },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Queue, open", values: { scenario: "queue", defaultExpanded: true } },
    { name: "Failed", values: { scenario: "failed", defaultExpanded: true } },
  ],
};
