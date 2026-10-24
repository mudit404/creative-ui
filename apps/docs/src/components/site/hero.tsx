"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { MaterialButton } from "@/components/ui/material-button";
import { CopyButton } from "~/components/docs/copy-button";
import { useMounted } from "~/lib/use-mounted";

export function Hero({ installCommand }: { installCommand: string }) {
  // The CTA sits on the page background, so its material follows the theme.
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const ctaTone = mounted && resolvedTheme === "dark" ? "bone" : "ink";
  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-20">
      <div className="relative z-10">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span className="size-1.5 rounded-full bg-ember" aria-hidden />
          Source-first · shadcn-compatible registry
        </p>
        <h1 className="display text-[clamp(3rem,7.5vw,6.2rem)] text-ink">
          Components that
          <br />
          behave like <em>material.</em>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
          Creative UI is a library of production-ready React interactions with real physics, real
          semantics and real fallbacks. Install the source with the shadcn CLI, keep the code, make it
          yours.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <MaterialButton asChild size="lg" tone={ctaTone} style={{ ["--mb-ring-offset" as string]: "var(--paper)" }}>
            <Link href="/components/material-button">Try the Material Button</Link>
          </MaterialButton>
          <Link
            href="/components"
            className="rounded-full border border-line-strong px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper-2"
          >
            Browse components
          </Link>
        </div>
        <div className="mt-8 flex max-w-xl items-center gap-2 overflow-hidden rounded-lg border border-line bg-code-bg pl-4 pr-2 font-mono text-[12.5px] text-code-fg">
          <span className="select-none text-code-fg/40">$</span>
          <span className="truncate py-2.5">{installCommand}</span>
          <span className="ml-auto shrink-0">
            <CopyButton text={installCommand} />
          </span>
        </div>
      </div>

      <div className="stage relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-3xl border border-line shadow-card lg:min-h-[520px]">
        <div className="stage-label absolute left-4 top-4 font-mono text-[11px] uppercase tracking-wider">
          Live · move your pointer toward it
        </div>
        <MaterialButton size="lg" reach={140} tendrils={7}>
          Let’s collaborate
        </MaterialButton>
      </div>
    </section>
  );
}
