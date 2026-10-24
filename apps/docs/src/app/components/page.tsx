import type { Metadata } from "next";
import { Explorer } from "~/components/catalog/explorer";
import { components } from "~/content/components";

export const metadata: Metadata = {
  title: "Components",
  description: "Browse every Creative UI component: live previews, tiers and status.",
};

export default function ComponentsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <h1 className="display text-5xl text-ink">Components</h1>
        <p className="mt-3 max-w-xl text-ink-2">
          Every component has a live preview, a playground and a registry entry. Free ones are the
          foundation; premium ones are the signature interactions.
        </p>
      </div>
      <Explorer items={components} />
    </main>
  );
}
