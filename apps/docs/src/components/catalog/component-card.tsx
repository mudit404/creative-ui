import Link from "next/link";
import type { ComponentMeta } from "~/content/types";
import { categoryLabels } from "~/content/components";
import { StatusBadge, TierBadge } from "~/components/docs/badges";
import { CardPreview } from "~/components/catalog/card-preview";

export function ComponentCard({ meta }: { meta: ComponentMeta }) {
  const planned = meta.status === "planned";
  const inner = (
    <>
      <div className={`stage relative flex h-48 items-center justify-center overflow-hidden border-b border-line ${planned ? "opacity-70" : ""}`}>
        {planned ? (
          <div className="flex flex-col items-center gap-2 text-muted">
            <span className="rounded-full border border-dashed border-line-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wider">
              Planned
            </span>
          </div>
        ) : (
          <CardPreview slug={meta.slug} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{meta.title}</h3>
          <span className="ml-auto flex gap-1.5">
            <TierBadge tier={meta.tier} />
            <StatusBadge status={meta.status} />
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink-2">{meta.tagline}</p>
        <div className="mt-auto pt-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          {categoryLabels[meta.category]}
        </div>
      </div>
    </>
  );
  const className =
    "group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card transition-colors";
  if (planned) {
    return (
      <div className={className} data-testid="component-card" data-status="planned">
        {inner}
      </div>
    );
  }
  return (
    <Link href={`/components/${meta.slug}`} className={`${className} hover:border-line-strong`} data-testid="component-card" data-status={meta.status}>
      {inner}
    </Link>
  );
}
