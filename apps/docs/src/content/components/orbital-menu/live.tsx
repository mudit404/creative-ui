"use client";

import { useState, type CSSProperties } from "react";
import { OrbitalMenu, OrbitalMenuItem, OrbitalMenuRing, OrbitalMenuTrigger, type OrbitalMenuProps } from "@/components/ui/orbital-menu";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

const ICONS: { label: string; d: string }[] = [
  { label: "Note", d: "M5 4h10l4 4v12H5zM15 4v4h4M8 13h8M8 17h5" },
  { label: "Photo", d: "M4 7h3l2-2h6l2 2h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { label: "Link", d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" },
  { label: "Voice", d: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" },
  { label: "Event", d: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { label: "Task", d: "M9 6h12M9 12h12M9 18h12M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" },
  { label: "Map", d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" },
  { label: "Tag", d: "M3 12V4h8l9 9-8 8zM8 8h.01" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function PlaygroundMenu({ values }: { values: PlaygroundValues }) {
  const { items = 6, ...props } = values as unknown as OrbitalMenuProps & { items?: number };
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex h-[300px] w-[300px] items-center justify-center">
        <OrbitalMenu key={`${props.defaultOpen}-${items}`} {...props}>
          <OrbitalMenuTrigger aria-label="Create" />
          <OrbitalMenuRing>
            {ICONS.slice(0, Number(items)).map((i) => (
              <OrbitalMenuItem key={i.label} label={i.label} onSelect={() => setLast(i.label)}>
                <Icon d={i.d} />
              </OrbitalMenuItem>
            ))}
          </OrbitalMenuRing>
        </OrbitalMenu>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]" aria-live="polite">
        {last ? `Selected: ${last}` : "Nothing selected yet"}
      </p>
    </div>
  );
}

function Controlled() {
  const colors = ["#ff4d1c", "#1d2a6b", "#1f7a4f", "#c8f55a", "#141311"];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-6">
      <OrbitalMenu open={open} onOpenChange={setOpen} closeOnSelect={false} startAngle={-180} sweep={180} radius={90}>
        <OrbitalMenuTrigger aria-label="Pick a colour" style={{ background: picked ?? undefined }} />
        <OrbitalMenuRing>
          {colors.map((c) => (
            <OrbitalMenuItem key={c} label={c} onSelect={() => setPicked(c)}>
              <span className="size-5 rounded-full" style={{ background: c }} />
            </OrbitalMenuItem>
          ))}
        </OrbitalMenuRing>
      </OrbitalMenu>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]">{picked ? `picked ${picked}` : open ? "menu open" : "menu closed"}</p>
    </div>
  );
}

const themed = {
  "--om-trigger": "#ff4d1c",
  "--om-trigger-foreground": "#fff",
  "--om-item": "#1b1b19",
  "--om-item-foreground": "#f3f1ec",
  "--om-item-hover": "#ff4d1c",
  "--om-item-hover-foreground": "#fff",
  "--om-label": "#ff4d1c",
  "--om-label-foreground": "#fff",
  "--om-ring": "#ff4d1c",
} as CSSProperties;

function ring(count: number, onSelect?: (l: string) => void) {
  return ICONS.slice(0, count).map((i) => (
    <OrbitalMenuItem key={i.label} label={i.label} onSelect={() => onSelect?.(i.label)}>
      <Icon d={i.d} />
    </OrbitalMenuItem>
  ));
}

export const orbitalMenuLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundMenu values={values} />,
  cardPreview: () => (
    <div className="flex h-40 w-full items-center justify-center">
      <OrbitalMenu defaultOpen radius={58} closeOnSelect={false}>
        <OrbitalMenuTrigger aria-label="Create" className="!size-11" />
        <OrbitalMenuRing>{ring(5)}</OrbitalMenuRing>
      </OrbitalMenu>
    </div>
  ),
  examples: {
    basic: () => (
      <div className="flex h-[280px] items-center justify-center">
        <OrbitalMenu>
          <OrbitalMenuTrigger aria-label="Create" />
          <OrbitalMenuRing>{ring(6)}</OrbitalMenuRing>
        </OrbitalMenu>
      </div>
    ),
    arc: () => (
      <div className="relative h-[260px] w-full max-w-md rounded-2xl bg-[light-dark(rgba(20,19,17,0.05),rgba(236,235,230,0.05))]">
        <div className="absolute bottom-6 right-6">
          <OrbitalMenu startAngle={-180} sweep={90} radius={110} showLabels>
            <OrbitalMenuTrigger aria-label="Actions" />
            <OrbitalMenuRing>{ring(3)}</OrbitalMenuRing>
          </OrbitalMenu>
        </div>
      </div>
    ),
    half: () => (
      <div className="flex h-[240px] items-end justify-center pb-4">
        <OrbitalMenu startAngle={-180} sweep={180} spring="soft" swing={60}>
          <OrbitalMenuTrigger asChild>
            <button type="button" className="rounded-full border border-[light-dark(#141311,#ecebe6)] bg-[light-dark(rgba(255,255,255,0.6),rgba(255,255,255,0.08))] px-5 py-3 text-[15px] font-semibold text-[light-dark(#141311,#ecebe6)]">
              Share to…
            </button>
          </OrbitalMenuTrigger>
          <OrbitalMenuRing>{ring(5)}</OrbitalMenuRing>
        </OrbitalMenu>
      </div>
    ),
    controlled: () => <Controlled />,
    themed: () => (
      <div className="flex h-[280px] items-center justify-center">
        <OrbitalMenu showLabels style={themed}>
          <OrbitalMenuTrigger aria-label="Create" />
          <OrbitalMenuRing>{ring(5)}</OrbitalMenuRing>
        </OrbitalMenu>
      </div>
    ),
  },
};
