import { useState } from "react";
import { MaterialButton } from "@/components/ui/material-button";
import { FieldMagnet } from "@/components/ui/field-magnet";
import { LiquidSwitch } from "@/components/ui/liquid-switch";
import { GhostTraceText } from "@/components/ui/ghost-trace-text";
import { OrbitalMenu, OrbitalMenuItem, OrbitalMenuRing, OrbitalMenuTrigger } from "@/components/ui/orbital-menu";
import { ElasticGrid, ElasticGridItem } from "@/components/ui/elastic-grid";
import { ExpandingProductGrid, ExpandingProductCard } from "@/components/ui/expanding-product-grid";
import { FlowStackGallery } from "@/components/ui/flow-stack-gallery";
import { MosaicMenu, MosaicMenuTrigger } from "@/components/ui/mosaic-menu";
import { AdaptiveRail, AdaptiveRailItem, AdaptiveRailSeparator } from "@/components/ui/adaptive-rail";

/**
 * Consumer smoke test: the component installed from the registry, used the
 * way a real app would. Covers default usage, a custom theme via CSS
 * variables, a loading state, and a link.
 */
export default function App() {
  const [saving, setSaving] = useState(false);
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-16 p-10">
      <GhostTraceText as="h1" className="text-5xl font-semibold" trigger="mount">
        Creative UI install check
      </GhostTraceText>

      <section className="flex flex-wrap items-center justify-center gap-12">
        <MaterialButton size="lg" onClick={() => alert("clicked")}>
          Let’s collaborate
        </MaterialButton>
        <MaterialButton
          loading={saving}
          onClick={() => {
            setSaving(true);
            setTimeout(() => setSaving(false), 1500);
          }}
        >
          Save changes
        </MaterialButton>
        <MaterialButton asChild tone="ink" shape="rounded" size="sm">
          <a href="https://example.com">Read the docs</a>
        </MaterialButton>
      </section>

      <section className="flex items-center gap-10">
        <FieldMagnet>
          <button type="button" className="rounded-full bg-black px-6 py-3 text-white">
            Magnetic
          </button>
        </FieldMagnet>
        <FieldMagnet asChild radius={100} axis="x">
          <a href="https://example.com" className="underline">
            Magnetic link
          </a>
        </FieldMagnet>
      </section>

      <section className="flex items-center gap-8">
        <label className="flex items-center gap-3">
          <LiquidSwitch name="notify" defaultChecked />
          Notifications
        </label>
        <LiquidSwitch size="lg" aria-label="Large" colors={{ trackOn: "#1d2a6b" }} />
      </section>

      <OrbitalMenu>
        <OrbitalMenuTrigger aria-label="Create" />
        <OrbitalMenuRing>
          <OrbitalMenuItem label="Note" onSelect={() => alert("note")}>N</OrbitalMenuItem>
          <OrbitalMenuItem label="Photo" onSelect={() => alert("photo")}>P</OrbitalMenuItem>
          <OrbitalMenuItem label="Link" href="https://example.com">L</OrbitalMenuItem>
        </OrbitalMenuRing>
      </OrbitalMenu>

      <ElasticGrid aria-label="Swatches" columns={4} gap={8}>
        {["#ff4d1c", "#1d2a6b", "#1f7a4f", "#c8f55a", "#141311", "#e9e5dc", "#7a4fff", "#ffb347"].map((c) => (
          <ElasticGridItem key={c} aspect="1 / 1">
            <div className="h-full w-full" style={{ background: c }} />
          </ElasticGridItem>
        ))}
      </ElasticGrid>

      <ExpandingProductGrid aria-label="Products" minCardWidth={160} className="w-full">
        {[
          { id: "a", name: "Field jacket", price: "$240" },
          { id: "b", name: "Trail boot", price: "$310" },
          { id: "c", name: "Merino crew", price: "$95" },
        ].map((p) => (
          <ExpandingProductCard key={p.id} id={p.id} title={p.name} media={<div className="h-full w-full bg-neutral-300" />} summary={<span>{p.price}</span>} detail={<p>Details for {p.name}.</p>} />
        ))}
      </ExpandingProductGrid>

      <FlowStackGallery
        label="Gallery"
        items={[1, 2, 3].map((n) => ({ id: String(n), src: `https://picsum.photos/seed/${n}/800/600`, alt: `Photo ${n}` }))}
      />

      <MosaicMenu
        label="Site menu"
        tiles={[
          { id: "work", href: "#work", title: "Work", span: 2, accent: "#ff4d1c", foreground: "#fff" },
          { id: "studio", href: "#studio", title: "Studio", current: true },
          { id: "contact", href: "#contact", title: "Contact" },
        ]}
      >
        <MosaicMenuTrigger />
      </MosaicMenu>

      <AdaptiveRail label="Page actions">
        <AdaptiveRailItem label="Top" priority onClick={() => window.scrollTo({ top: 0 })}>
          ↑
        </AdaptiveRailItem>
        <AdaptiveRailItem label="Docs" href="https://example.com">
          ?
        </AdaptiveRailItem>
        <AdaptiveRailSeparator />
        <AdaptiveRailItem label="Share">⇪</AdaptiveRailItem>
      </AdaptiveRail>

      <section className="brand-blue rounded-2xl bg-neutral-900 p-12">
        <MaterialButton>Themed with CSS variables</MaterialButton>
      </section>
    </main>
  );
}
