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
import { ElasticRange } from "@/components/ui/elastic-range";
import { DetentDial } from "@/components/ui/detent-dial";
import { ActivityCapsule } from "@/components/ui/activity-capsule";
import { CompareWorkbench } from "@/components/ui/compare-workbench";
import { PaletteComposer } from "@/components/ui/palette-composer";
import { DecisionDeck } from "@/components/ui/decision-deck";
import { TransferBoard } from "@/components/ui/transfer-board";
import { CablePatchbay } from "@/components/ui/cable-patchbay";
import { TimeLens } from "@/components/ui/time-lens";
import { ContinuityChart } from "@/components/ui/continuity-chart";
import { FocusGraph } from "@/components/ui/focus-graph";
import { ScrollFilm } from "@/components/ui/scroll-film";
import { ExplodedProduct } from "@/components/ui/exploded-product";
import { CutawayViewer } from "@/components/ui/cutaway-viewer";
import { FinishConfigurator } from "@/components/ui/finish-configurator";
import { SplitFlapBoard } from "@/components/ui/split-flap-board";
import { ParticleMorph } from "@/components/ui/particle-morph";
import { AsciiMedia } from "@/components/ui/ascii-media";
import { GlassKeybed } from "@/components/ui/glass-keybed";
import { DockWorkspace } from "@/components/ui/dock-workspace";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

function tinyModel() {
  const root = new Group();
  for (const [name, y] of [["Top", 0.6], ["Base", -0.6]] as const) {
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#b78d5a" }));
    m.name = name;
    m.position.y = y;
    m.userData.closed = true;
    root.add(m);
  }
  return root;
}

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

      <section className="flex w-full flex-col gap-8">
        <ElasticRange variant="interval" labels={{ label: "Budget" }} min={0} max={1000} step={10} minGap={50} defaultValue={[200, 650]} name="budget" />
        <div className="flex items-start gap-8">
          <DetentDial label="Gain" unit="dB" min={-60} max={12} detents={[-12, -6, 0, 6]} defaultValue={-6} resetValue={0} />
          <ActivityCapsule
            tasks={[{ id: "up", attemptId: "a1", attempt: 1, revision: 3, label: "Uploading 12 photos", status: "running", progress: { completed: 3, total: 12, unit: "files" } }]}
            onCancelRequest={(id, attempt) => alert(`cancel ${id} ${attempt}`)}
          />
        </div>
        <CompareWorkbench
          items={[
            { id: "a", name: "Alpha", attributes: { weight: 500, wifi: false, price: 99 } },
            { id: "b", name: "Beta", attributes: { weight: { value: 500, unit: "oz" }, wifi: { availability: "unknown" }, price: 99 } },
            { id: "c", name: "Gamma", attributes: { weight: 600, wifi: true, price: 149 } },
          ]}
          attributes={[
            { key: "weight", label: "Weight", group: "Specs", unit: "g", kind: "number" },
            { key: "wifi", label: "Wi-Fi", group: "Specs", kind: "boolean" },
            { key: "price", label: "Price", group: "Price", unit: "USD", kind: "number" },
          ]}
          defaultSelectedIds={["a", "b"]}
        />
      </section>

      <section className="flex w-full flex-col gap-8">
        <PaletteComposer count={4} allowUrl={false} defaultPalette={[{ id: "slot-1", color: "#ff4d1c", locked: true, origin: "edited" }]} />
        <DecisionDeck
          items={[{ id: "a", title: "First" }, { id: "b", title: "Second" }]}
          outcomes={[{ id: "reject", label: "Reject" }, { id: "accept", label: "Accept" }]}
          onDecisionRequest={(i) => alert(`${i.outcomeId} ${i.itemId}`)}
          renderCard={(item) => <div className="p-6">{item.title}</div>}
          undo={false}
        />
        <TransferBoard
          containers={[{ id: "todo", label: "To do" }, { id: "done", label: "Done" }]}
          items={[{ id: "x", title: "Ship it" }, { id: "y", title: "Test it" }]}
          itemsByContainer={{ todo: ["x", "y"], done: [] }}
          revision={1}
          onMoveRequest={(i) => alert(`move ${i.itemId} → ${i.toContainerId}`)}
        />
      </section>

      <section className="flex w-full flex-col gap-8">
        <CablePatchbay
          ports={[
            { id: "o", nodeId: "src", label: "Out", direction: "output", dataType: "audio" },
            { id: "i", nodeId: "dst", label: "In", direction: "input", dataType: "audio" },
          ]}
          connections={[]}
          onConnectRequest={(i) => alert(`connect ${i.sourcePortId} → ${i.targetPortId}`)}
        />
        <TimeLens events={[{ id: "a", startMs: 0, label: "Start" }, { id: "b", startMs: 3_600_000, endMs: 5_400_000, label: "Window" }]} domain={[0, 7_200_000]} />
        <ContinuityChart snapshots={[{ id: "s", label: "Now", unit: "%", rows: [{ id: "x", label: "X", value: 40 }, { id: "y", label: "Y", value: -5 }, { id: "z", label: "Z", value: null }] }]} summary="A tiny install check chart" />
        <FocusGraph nodes={[{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }]} edges={[{ source: "a", target: "b" }, { source: "b", target: "c" }]} directed />
      </section>

      <section className="flex w-full flex-col gap-8">
        <ScrollFilm variant="inline" src="/film.webm" poster="/poster.png" description="Install check film" transcript="No narration." chapters={[{ id: "a", label: "Start", startTime: 0 }]} />
        <ExplodedProduct model={{ kind: "scene", build: tinyModel }} poster="/poster.png" alt="Two boxes" parts={[{ id: "top", nodePath: "Top", label: "Top", offset: [0, 1, 0] }, { id: "base", nodePath: "Base", label: "Base", offset: [0, -1, 0] }]} />
        <CutawayViewer model={{ kind: "scene", build: tinyModel }} poster="/poster.png" description="Two boxes" defaultEnabled />
        <FinishConfigurator
          model={{ kind: "scene", build: tinyModel }}
          poster="/poster.png"
          description="Two boxes"
          groups={[{ id: "wood", label: "Wood", options: [{ id: "oak", name: "Oak", targets: ["Top", "Base"], material: { color: "#b78d5a" } }, { id: "walnut", name: "Walnut", targets: ["Top", "Base"], material: { color: "#5a3d2b" } }] }]}
          defaultSelection={{ wood: "oak" }}
        />
      </section>

      <section className="flex w-full flex-col gap-8">
        <SplitFlapBoard value="ON TIME" cells={8} label="Install check board" />
        <ParticleMorph
          targets={[
            { id: "disc", label: "Disc", type: "image", src: "/poster.png", fallback: "/poster.png" },
            { id: "cloud", label: "Cloud", type: "points", points: Float32Array.from({ length: 300 }, (_, i) => Math.sin(i * 1.7)), fallback: "/poster.png" },
          ]}
          pointCount={2000}
          className="h-48"
        />
        <AsciiMedia source={{ kind: "image", src: "/poster.png", alt: "Install check poster" }} columns={48} />
        <GlassKeybed variant="opaque-accessible" onNoteOn={(n) => console.log("note", n.noteId)} />
        <DockWorkspace
          panels={[
            { id: "a", title: "A", render: () => <p>Panel A</p> },
            { id: "b", title: "B", render: () => <p>Panel B</p> },
            { id: "c", title: "C", render: () => <p>Panel C</p>, closable: false },
          ]}
          compactBreakpoint={320}
          className="h-64"
        />
      </section>

      <section className="brand-blue rounded-2xl bg-neutral-900 p-12">
        <MaterialButton>Themed with CSS variables</MaterialButton>
      </section>
    </main>
  );
}
