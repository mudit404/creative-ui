import type { Metadata } from "next";
import Link from "next/link";
import { DocsSidebar } from "~/components/site/docs-sidebar";
import { HydrationMarker } from "~/components/site/hydration-marker";
import { StatusBadge, TierBadge } from "~/components/docs/badges";
import { components, categoryLabels } from "~/content/components";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Build order and status of the Creative UI catalog.",
};

export default function RoadmapPage() {
  return (
    <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="scroll-thin sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain pb-6 pr-2">
          <DocsSidebar />
        </div>
      </aside>
      <main className="prose-docs min-w-0 max-w-3xl">
        <h1 className="display text-5xl text-ink">Roadmap</h1>
        <p className="mt-4 text-lg">
          The initial collection from the product brief, in delivery order. The flagship was built
          first to prove the full path from specification to installable component; the primitives
          follow because later components compose them.
        </p>
        <ol className="!list-none !pl-0">
          {components.map((c, i) => (
            <li
              key={c.slug}
              className="my-2 flex items-start gap-4 rounded-xl border border-line bg-card p-4"
            >
              <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {c.status === "planned" ? (
                    <span className="font-semibold text-ink">{c.title}</span>
                  ) : (
                    <Link href={`/components/${c.slug}`} className="font-semibold">
                      {c.title}
                    </Link>
                  )}
                  <code className="!text-xs">{c.name}</code>
                  <span className="ml-auto flex gap-1.5">
                    <TierBadge tier={c.tier} />
                    <StatusBadge status={c.status} />
                  </span>
                </div>
                <p className="!my-1 text-sm">{c.tagline}</p>
                <p className="!my-0 font-mono text-[11px] uppercase tracking-wider text-muted">
                  {categoryLabels[c.category]}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <h2>Shared foundations already in place</h2>
        <ul>
          <li>
            <code>useReducedMotion</code>: hydration-safe media query hook.
          </li>
          <li>
            <code>pointer-field</code>: one shared window pointer listener for every instance.
          </li>
          <li>
            <code>springs</code>: damped spring step, easing, seeded RNG.
          </li>
          <li>
            <code>rounded-outline</code>: arc-length parameterised rounded-rect outline (roots,
            normals, closest point).
          </li>
          <li>
            <code>StrandField</code> + <code>strand-renderer</code>: Verlet strand simulation and
            Canvas 2D goo renderer, reusable by future components (for example a goo toggle or drag
            handle).
          </li>
          <li>
            <code>useStrandField</code>: canvas lifecycle, visibility gating, idle scheduling.
          </li>
          <li>
            <code>magnetic-field</code> + <code>useMagneticField</code>: sprung pull toward a nearby
            pointer, shared by FieldMagnet and AdaptiveRail items.
          </li>
          <li>
            <code>useScrollDirection</code>: up/down/idle scroll state for the window or a
            container, re-rendering only on change.
          </li>
        </ul>
        <h2>Next up</h2>
        <p>
          All ten components of the initial collection have shipped. Next: hardening toward stable
          status, automated prop tables, cross-platform visual baselines, and the authenticated
          premium registry; new components will follow the catalog briefs as they arrive. See{" "}
          <code>documentation/ROADMAP.md</code> in the repository for the dependency map and exit
          gates.
        </p>
      </main>
      <HydrationMarker />
    </div>
  );
}
