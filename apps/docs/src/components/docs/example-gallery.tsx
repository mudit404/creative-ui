"use client";

import { useState } from "react";
import type { ExampleDoc } from "~/content/types";
import { getLive } from "~/content/live";
import { highlight } from "~/lib/highlight";
import { CopyButton } from "~/components/docs/copy-button";

export function ExampleGallery({ slug, examples }: { slug: string; examples: ExampleDoc[] }) {
  const live = getLive(slug);
  if (!live) return null;
  return (
    <div className="flex flex-col gap-10">
      {examples.map((ex) => (
        <Example key={ex.id} example={ex} render={live.examples[ex.id]} />
      ))}
    </div>
  );
}

function Example({ example, render }: { example: ExampleDoc; render?: () => React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [showCode, setShowCode] = useState(true);
  return (
    <article id={`example-${example.id}`} className="scroll-mt-24" data-testid={`example-${example.id}`}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink">{example.title}</h3>
          <p className="mt-1 text-sm text-ink-2">{example.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="rounded-md border border-line px-2 py-1 text-muted hover:text-ink"
            aria-pressed={dark}
            data-testid="example-surface"
          >
            {dark ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            onClick={() => setShowCode((s) => !s)}
            className="rounded-md border border-line px-2 py-1 text-muted hover:text-ink"
            aria-expanded={showCode}
          >
            Code
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line shadow-card">
        <div className={`flex min-h-[260px] items-center justify-center p-12 ${dark ? "stage-dark dark" : "stage"}`}>
          {render ? render() : <span className="text-sm text-muted">Example renderer missing: {example.id}</span>}
        </div>
        {showCode && (
          <div className="relative border-t border-line">
            <div className="absolute right-2 top-2 z-10">
              <CopyButton text={example.code} />
            </div>
            <pre className="code-block scroll-thin m-0 overflow-auto p-4 pr-24">
              <code dangerouslySetInnerHTML={{ __html: highlight(example.code, "tsx") }} />
            </pre>
          </div>
        )}
      </div>
    </article>
  );
}
