"use client";

import { MosaicMenu, MosaicMenuTrigger, type MosaicMenuProps, type MosaicTile } from "@/components/ui/mosaic-menu";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

const ACCENTED: MosaicTile[] = [
  { id: "work", href: "#work", title: "Work", description: "Selected projects, 2019–2026", accent: "#ff4d1c", foreground: "#fff", span: 2 },
  { id: "studio", href: "#studio", title: "Studio", description: "Who we are", accent: "#1d2a6b", foreground: "#f2f0ff", current: true },
  { id: "journal", href: "#journal", title: "Journal", description: "Notes and process", accent: "#1f7a4f", foreground: "#eafbe7" },
  { id: "shop", href: "#shop", title: "Shop", description: "Prints and objects", accent: "#c8f55a", foreground: "#141311" },
  { id: "contact", href: "#contact", title: "Contact", description: "Start a project", accent: "#e9e5dc", foreground: "#141311", span: 2 },
  { id: "careers", href: "#careers", title: "Careers", accent: "#7a4fff", foreground: "#fff" },
];

const PLAIN: MosaicTile[] = ACCENTED.map((t) => ({ id: t.id, href: t.href, title: t.title, description: t.description, span: t.span, current: t.current }));

const footer = (
  <div className="flex flex-wrap gap-x-6 gap-y-1">
    <a href="#mail" className="underline-offset-4 hover:underline">hello@studio.example</a>
    <a href="#ig" className="underline-offset-4 hover:underline">Instagram</a>
    <a href="#li" className="underline-offset-4 hover:underline">LinkedIn</a>
  </div>
);

function PlaygroundMenu({ values }: { values: PlaygroundValues }) {
  const { tileSet, ...props } = values as unknown as Partial<MosaicMenuProps> & { tileSet?: string };
  return (
    <div className="flex flex-col items-center gap-4">
      <MosaicMenu label="Site menu" tiles={tileSet === "plain" ? PLAIN : ACCENTED} footer={footer} onNavigate={() => false} {...props}>
        <MosaicMenuTrigger />
      </MosaicMenu>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[rgba(20,19,17,0.5)]">Opens full-screen · Escape closes</p>
    </div>
  );
}

export const mosaicMenuLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundMenu values={values} />,
  cardPreview: () => (
    <div className="grid w-56 grid-cols-3 gap-1.5" aria-hidden>
      {ACCENTED.map((t) => (
        <div key={t.id} className="h-10 rounded-md" style={{ background: t.accent ?? "rgba(20,19,17,0.15)", gridColumn: t.span === 2 ? "span 2" : undefined }} />
      ))}
    </div>
  ),
  examples: {
    basic: () => (
      <MosaicMenu label="Site menu" tiles={PLAIN} footer={footer} onNavigate={() => false}>
        <MosaicMenuTrigger />
      </MosaicMenu>
    ),
    accents: () => (
      <MosaicMenu label="Explore" tiles={ACCENTED} footer={footer} onNavigate={() => false} stagger={0.05}>
        <MosaicMenuTrigger>Explore the studio</MosaicMenuTrigger>
      </MosaicMenu>
    ),
    router: () => (
      <MosaicMenu label="Menu" tiles={ACCENTED} onNavigate={() => false}>
        <MosaicMenuTrigger asChild>
          <button type="button" className="rounded-full bg-[#141311] px-5 py-3 text-[14px] font-semibold text-[#f3f1ec]">
            Explore
          </button>
        </MosaicMenuTrigger>
      </MosaicMenu>
    ),
  },
};
