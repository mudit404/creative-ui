import Link from "next/link";
import { Hero } from "~/components/site/hero";
import { ComponentCard } from "~/components/catalog/component-card";
import { components } from "~/content/components";
import { registryItemUrl } from "~/lib/registry-url";

export default function HomePage() {
  const featured = components.filter((c) => c.status !== "planned");
  const upcoming = components.filter((c) => c.status === "planned").slice(0, 5);
  const install = `npx shadcn@latest add ${registryItemUrl("material-button")}`;

  return (
    <main>
      <Hero installCommand={install} />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h2 className="display text-4xl text-ink">Featured</h2>
            <p className="mt-2 max-w-lg text-ink-2">
              Every preview on this site is the real, installable component. No simplified demo builds.
            </p>
          </div>
          <Link href="/components" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ember">
            All components →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c) => (
            <ComponentCard key={c.slug} meta={c} />
          ))}
          {upcoming.map((c) => (
            <ComponentCard key={c.slug} meta={c} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Principle
            n="01"
            title="Real semantics first"
            body="Native elements, keyboard parity, visible focus, aria states. Motion decorates a control that already works."
          />
          <Principle
            n="02"
            title="Own the source"
            body="Components install as files into your project through the shadcn registry. Fork, restyle, rewrite. No runtime package to wait on."
          />
          <Principle
            n="03"
            title="Graceful by default"
            body="Reduced motion, touch, SSR and off-screen instances are handled in the component, not left to you."
          />
        </div>
      </section>
    </main>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-card">
      <div className="font-mono text-[11px] text-muted">{n}</div>
      <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}
