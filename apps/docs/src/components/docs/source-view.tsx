"use client";

import { useState } from "react";
import { highlight } from "~/lib/highlight";
import { CopyButton } from "~/components/docs/copy-button";

export function SourceView({ files }: { files: { path: string; content: string }[] }) {
  const [active, setActive] = useState(0);
  const file = files[active];
  if (!file) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line-strong/40">
      <div className="scroll-thin flex overflow-x-auto border-b border-white/10 bg-code-bg" role="tablist" aria-label="Source files">
        {files.map((f, i) => (
          <button
            key={f.path}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`shrink-0 border-b-2 px-3 py-2 font-mono text-[11px] ${
              i === active ? "border-ember text-code-fg" : "border-transparent text-code-fg/70 hover:text-code-fg"
            }`}
          >
            {f.path}
          </button>
        ))}
      </div>
      <div className="relative">
        <div className="absolute right-2 top-2 z-10">
          <CopyButton text={file.content} />
        </div>
        <pre className="code-block scroll-thin m-0 max-h-[560px] overflow-auto p-4 pr-20">
          <code dangerouslySetInnerHTML={{ __html: highlight(file.content, "tsx") }} />
        </pre>
      </div>
    </div>
  );
}
