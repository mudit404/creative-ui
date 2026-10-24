export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="relative inline-block size-5 rounded-full"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 30%, rgba(255,255,255,0.35), transparent 60%), var(--ink)",
          boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.5)",
        }}
      >
        <span
          className="absolute -right-1 top-1/2 h-[2px] w-2 -translate-y-1/2 rounded-full"
          style={{ background: "var(--ink)" }}
        />
      </span>
      <span className="font-semibold tracking-tight">Creative UI</span>
    </span>
  );
}
