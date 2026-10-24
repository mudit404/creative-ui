import { highlight } from "~/lib/highlight";
import { CopyButton } from "~/components/docs/copy-button";

export function CodeBlock({
  code,
  lang = "tsx",
  title,
  className = "",
  maxHeight,
}: {
  code: string;
  lang?: "tsx" | "bash" | "json" | "css" | "text";
  title?: string;
  className?: string;
  maxHeight?: number;
}) {
  const html = highlight(code.replace(/\n$/, ""), lang);
  return (
    <div className={`group relative overflow-hidden rounded-xl border border-line-strong/40 ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-white/10 bg-code-bg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-code-fg/60">
          <span>{title}</span>
        </div>
      )}
      <div className="absolute right-2 top-2 z-10">
        <CopyButton text={code} />
      </div>
      <pre
        className="code-block scroll-thin m-0 overflow-auto p-4 pr-14"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
