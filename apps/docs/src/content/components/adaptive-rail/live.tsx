"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AdaptiveRail, AdaptiveRailItem, AdaptiveRailSeparator, type AdaptiveRailProps } from "@/components/ui/adaptive-rail";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

/* ── icons (inline so the demo has no icon dependency) ── */
const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  bookmark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  sort: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M7 12h10M10 17h4" /></svg>,
  share: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3m-4 4 4-4 4 4" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  pen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="m4 20 4-1L20 7l-3-3L5 16z" /></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>,
  comment: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" /></svg>,
  highlight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="m9 11 6-6 4 4-6 6zM5 15l4-4 4 4-2 2H7zM3 21h18" /></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>,
  prev: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zm12 0v14L9 12z" /></svg>,
  next: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM6 5v14l9-7z" /></svg>,
};

function LongContent({ lines = 24, label = "Scroll inside this panel" }: { lines?: number; label?: string }) {
  return (
    <div className="space-y-3 p-6 pb-28 text-[14px] leading-relaxed text-[rgba(20,19,17,0.7)]">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[rgba(20,19,17,0.5)]">{label}</p>
      {Array.from({ length: lines }, (_, i) => (
        <p key={i} className="rounded-lg bg-[rgba(20,19,17,0.05)] px-3 py-2">
          Paragraph {i + 1}. The rail watches this panel&apos;s scroll position and reacts to direction, not to position.
        </p>
      ))}
    </div>
  );
}

function Panel({ children, height = 360, className = "" }: { children: (panel: React.RefObject<HTMLDivElement | null>) => ReactNode; height?: number; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  return (
    <div className={`relative w-full max-w-xl overflow-hidden rounded-2xl border border-[rgba(20,19,17,0.12)] bg-[#f6f4ef] ${className}`} style={{ height }}>
      <div ref={panel} className="h-full overflow-y-auto" data-testid="rail-panel">
        <LongContent />
      </div>
      {children(panel)}
    </div>
  );
}

function PlaygroundRail({ values }: { values: PlaygroundValues }) {
  const panel = useRef<HTMLDivElement>(null);
  const props = values as unknown as Omit<AdaptiveRailProps, "label">;
  return (
    <div className="relative h-[360px] w-full max-w-xl overflow-hidden rounded-2xl border border-[rgba(20,19,17,0.12)] bg-[#f6f4ef]">
      <div ref={panel} className="h-full overflow-y-auto" data-testid="rail-panel">
        <LongContent />
      </div>
      <AdaptiveRail {...props} label="Actions" position="absolute" scrollContainer={panel}>
        <AdaptiveRailItem label="Home" priority active contexts={["browse"]}>{I.home}</AdaptiveRailItem>
        <AdaptiveRailItem label="Search" priority contexts={["browse"]}>{I.search}</AdaptiveRailItem>
        <AdaptiveRailItem label="Bookmarks" contexts={["browse"]}>{I.bookmark}</AdaptiveRailItem>
        <AdaptiveRailSeparator />
        <AdaptiveRailItem label="Settings" contexts={["browse"]}>{I.settings}</AdaptiveRailItem>
        <AdaptiveRailItem label="Share" priority contexts={["selection"]}>{I.share}</AdaptiveRailItem>
        <AdaptiveRailItem label="Delete" contexts={["selection"]}>{I.trash}</AdaptiveRailItem>
      </AdaptiveRail>
    </div>
  );
}

function ContextDemo() {
  const [selected, setSelected] = useState<number[]>([]);
  const toggle = (i: number) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  return (
    <div className="relative w-full max-w-xl rounded-2xl border border-[rgba(20,19,17,0.12)] bg-[#f6f4ef] p-5 pb-24">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[rgba(20,19,17,0.5)]">Select files</p>
      <ul className="space-y-2">
        {["Brief.pdf", "Moodboard.fig", "Contract.docx", "Logo.svg"].map((name, i) => (
          <li key={name}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-[rgba(20,19,17,0.05)] px-3 py-2 text-[14px] text-[#141311]">
              <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)} className="size-4 accent-[#141311]" />
              {name}
            </label>
          </li>
        ))}
      </ul>
      <AdaptiveRail label="Library" position="absolute" behavior="static" context={selected.length ? "selection" : "browse"} showLabels>
        <AdaptiveRailItem label="New" contexts={["browse"]}>{I.plus}</AdaptiveRailItem>
        <AdaptiveRailItem label="Sort" contexts={["browse"]}>{I.sort}</AdaptiveRailItem>
        <AdaptiveRailItem label={`Share ${selected.length || ""}`.trim()} contexts={["selection"]}>{I.share}</AdaptiveRailItem>
        <AdaptiveRailItem label="Delete" contexts={["selection"]} onClick={() => setSelected([])}>{I.trash}</AdaptiveRailItem>
      </AdaptiveRail>
    </div>
  );
}

const darkVars = {
  "--ar-surface": "#141311",
  "--ar-foreground": "#f3f1ec",
  "--ar-border": "rgba(255,255,255,0.12)",
  "--ar-item-hover": "rgba(255,255,255,0.1)",
  "--ar-item-active": "#ff4d1c",
  "--ar-item-active-foreground": "#fff",
  "--ar-ring": "#ff4d1c",
} as CSSProperties;

export const adaptiveRailLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundRail values={values} />,
  cardPreview: () => (
    <div className="relative h-32 w-72 overflow-hidden rounded-xl bg-[#f6f4ef]">
      <AdaptiveRail label="Preview" position="absolute" behavior="static" offset={16}>
        <AdaptiveRailItem label="Home" active>{I.home}</AdaptiveRailItem>
        <AdaptiveRailItem label="Search">{I.search}</AdaptiveRailItem>
        <AdaptiveRailItem label="Bookmarks">{I.bookmark}</AdaptiveRailItem>
        <AdaptiveRailSeparator />
        <AdaptiveRailItem label="Settings">{I.settings}</AdaptiveRailItem>
      </AdaptiveRail>
    </div>
  ),
  examples: {
    basic: () => (
      <Panel>
        {(panel) => (
          <AdaptiveRail label="Actions" position="absolute" scrollContainer={panel}>
            <AdaptiveRailItem label="Home" priority active>{I.home}</AdaptiveRailItem>
            <AdaptiveRailItem label="Search" priority>{I.search}</AdaptiveRailItem>
            <AdaptiveRailItem label="Bookmarks">{I.bookmark}</AdaptiveRailItem>
            <AdaptiveRailSeparator />
            <AdaptiveRailItem label="Settings">{I.settings}</AdaptiveRailItem>
          </AdaptiveRail>
        )}
      </Panel>
    ),
    context: () => <ContextDemo />,
    labels: () => (
      <div className="relative h-40 w-full max-w-xl rounded-2xl bg-[#f6f4ef]">
        <AdaptiveRail label="Editor" showLabels behavior="static" position="absolute">
          <AdaptiveRailItem label="Write" priority active>{I.pen}</AdaptiveRailItem>
          <AdaptiveRailItem label="Preview">{I.eye}</AdaptiveRailItem>
          <AdaptiveRailItem label="Publish">{I.send}</AdaptiveRailItem>
        </AdaptiveRail>
      </div>
    ),
    vertical: () => (
      <Panel>
        {(panel) => (
          <AdaptiveRail label="Tools" placement="right" behavior="hide" position="absolute" scrollContainer={panel}>
            <AdaptiveRailItem label="Comment">{I.comment}</AdaptiveRailItem>
            <AdaptiveRailItem label="Highlight">{I.highlight}</AdaptiveRailItem>
            <AdaptiveRailItem label="Share">{I.share}</AdaptiveRailItem>
          </AdaptiveRail>
        )}
      </Panel>
    ),
    themed: () => (
      <div className="relative h-40 w-full max-w-xl rounded-2xl bg-[#e9e5dc]">
        <AdaptiveRail label="Player" behavior="static" position="absolute" style={darkVars} showLabels>
          <AdaptiveRailItem label="Previous">{I.prev}</AdaptiveRailItem>
          <AdaptiveRailItem label="Play" active>{I.play}</AdaptiveRailItem>
          <AdaptiveRailItem label="Next">{I.next}</AdaptiveRailItem>
        </AdaptiveRail>
      </div>
    ),
  },
};
