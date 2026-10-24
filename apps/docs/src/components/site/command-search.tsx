"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchIndex, type SearchEntry } from "~/content/search-index";

/** Lightweight ⌘K search over components and docs. No dependencies. */
export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const openPalette = () => {
    setQuery("");
    setActive(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setQuery("");
            setActive(0);
          }
          return !o;
        });
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => filterEntries(searchIndex, query).slice(0, 8), [query]);

  const go = (entry: SearchEntry) => {
    setOpen(false);
    router.push(entry.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="hidden h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:bg-paper-2 hover:text-ink sm:inline-flex"
        aria-label="Search components and docs"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>Search</span>
        <kbd className="ml-2 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">⌘K</kbd>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-card shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(results.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && results[active]) {
                  go(results[active]);
                }
              }}
              placeholder="Search components, docs, props…"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
              className="w-full border-b border-line bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted"
            />
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li>
              )}
              {results.map((r, i) => (
                <li
                  key={r.href}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    i === active ? "bg-paper-2 text-ink" : "text-ink-2"
                  }`}
                >
                  <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                    {r.kind}
                  </span>
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-auto truncate text-xs text-muted">{r.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function filterEntries(entries: SearchEntry[], q: string): SearchEntry[] {
  const query = q.trim().toLowerCase();
  if (!query) return entries;
  const terms = query.split(/\s+/);
  return entries
    .map((e) => {
      const hay = `${e.title} ${e.description} ${e.keywords.join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (e.title.toLowerCase().startsWith(t)) score += 4;
        else if (e.title.toLowerCase().includes(t)) score += 3;
        else if (hay.includes(t)) score += 1;
        else return null;
      }
      return { e, score };
    })
    .filter((x): x is { e: SearchEntry; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}
