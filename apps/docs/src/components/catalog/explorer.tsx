"use client";

import { useMemo, useState } from "react";
import type { ComponentCategory, ComponentMeta, ComponentStatus, ComponentTier } from "~/content/types";
import { categoryLabels } from "~/content/components";
import { ComponentCard } from "~/components/catalog/component-card";

export function Explorer({ items }: { items: ComponentMeta[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ComponentCategory | "all">("all");
  const [tier, setTier] = useState<ComponentTier | "all">("all");
  const [status, setStatus] = useState<ComponentStatus | "all">("all");

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))] as ComponentCategory[],
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank: Record<string, number> = { stable: 0, experimental: 1, planned: 2 };
    return [...items].sort((a, b) => rank[a.status]! - rank[b.status]!).filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (tier !== "all" && c.tier !== tier) return false;
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      const hay = `${c.title} ${c.name} ${c.tagline} ${c.keywords.join(" ")}`.toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [items, query, category, tier, status]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4">
        <label className="relative block max-w-md">
          <span className="sr-only">Search components</span>
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            data-testid="explorer-search"
            className="h-10 w-full rounded-lg border border-line bg-card pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ember/60"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {categoryLabels[c]}
            </Chip>
          ))}
          <span className="mx-2 h-5 w-px bg-line" aria-hidden />
          <Select label="Tier" value={tier} onChange={(v) => setTier(v as typeof tier)} options={["all", "free", "premium"]} />
          <Select label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={["all", "stable", "experimental", "planned"]} />
        </div>
      </div>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-wider text-muted" aria-live="polite">
        {filtered.length} of {items.length} components
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="explorer-grid">
        {filtered.map((c) => (
          <ComponentCard key={c.slug} meta={c} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">
          Nothing matches. Try a different term or clear the filters.
        </p>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-line bg-card px-2 text-sm text-ink"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "all" ? "Any" : o}
          </option>
        ))}
      </select>
    </label>
  );
}
