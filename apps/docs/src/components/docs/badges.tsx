import type { ComponentStatus, ComponentTier } from "~/content/types";

export function TierBadge({ tier }: { tier: ComponentTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
        tier === "premium" ? "border-ember/40 text-ember-ink" : "border-line-strong text-ink-2"
      }`}
    >
      {tier}
    </span>
  );
}

export function StatusBadge({ status }: { status: ComponentStatus }) {
  const styles: Record<ComponentStatus, string> = {
    stable: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
    experimental: "border-amber-600/40 text-amber-700 dark:text-amber-400",
    planned: "border-line text-muted",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}
