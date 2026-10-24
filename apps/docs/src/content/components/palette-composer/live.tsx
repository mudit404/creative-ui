"use client";

import { useEffect, useState } from "react";
import { PaletteComposer, browserDecoder, type Decoder, type PaletteComposerProps, type PaletteSource, type Swatch } from "@/components/ui/palette-composer";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

/* ── generated fixtures (SVG data URLs decode like any image and are not cross-origin) ── */
function svg(body: string, w = 400, h = 300) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}`;
}
const SIX_COLOURS = ["#dc281e", "#1e5ac8", "#28aa50", "#f0c828", "#783ca0", "#141414"];
export const FIXTURES: Record<string, { url: string; alt: string }> = {
  six: { url: svg(SIX_COLOURS.map((c, i) => `<rect x='${(i % 3) * 134}' y='${Math.floor(i / 3) * 150}' width='134' height='150' fill='${c}'/>`).join("")), alt: "Six colour test card" },
  mono: { url: svg(`<rect width='400' height='300' fill='#5a5a5a'/><rect x='40' y='40' width='320' height='220' fill='#5e5a5a'/>`), alt: "Monochrome grey" },
  transparent: { url: svg(`<rect width='400' height='300' fill='#ff0000' fill-opacity='0.15'/><rect x='150' y='110' width='100' height='80' fill='#0000ff'/>`), alt: "Mostly transparent red with an opaque blue square" },
  huge: { url: svg(`<rect width='10000' height='10000' fill='#1e5ac8'/>`, 10000, 10000), alt: "100 megapixel image" },
  photo: { url: svg(`<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f3d6a3'/><stop offset='1' stop-color='#1d2a6b'/></linearGradient></defs><rect width='400' height='300' fill='url(#g)'/><circle cx='300' cy='90' r='50' fill='#ff4d1c'/><path d='M0 240 Q 120 180 220 230 T 400 210 V300 H0Z' fill='#1f7a4f'/>`), alt: "Generated landscape" },
};
const source = (key: string, revision: string | number): PaletteSource => ({ kind: "url", url: FIXTURES[key]!.url, revision, alt: FIXTURES[key]!.alt });

function PlaygroundComposer({ values }: { values: PlaygroundValues }) {
  const { fixture, ...rest } = values as { fixture: string } & Omit<PaletteComposerProps, "source">;
  const [log, setLog] = useState<string[]>([]);
  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 8));
  // controlled source so a fixture change re-extracts into the same slots (locks survive)
  const [src, setSrc] = useState<PaletteSource | null>(() => (fixture === "none" ? null : source(fixture, fixture)));
  const [seenFixture, setSeenFixture] = useState(fixture);
  if (seenFixture !== fixture) {
    setSeenFixture(fixture);
    setSrc(fixture === "none" ? null : source(fixture, fixture));
  }
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <PaletteComposer
        source={src}
        onSourceChange={setSrc}
        slotLabels={rest.variant === "brand" ? ["Accent", "Background", "Surface", "Text", "Muted", "Border"] : undefined}
        {...rest}
        onExtractionStateChange={(s) => push(`state → ${s}`)}
        onExtractionError={(e) => push(`error ${e.reason}: ${e.message}`)}
        onPaletteChange={(p: Swatch[], meta) => push(`onPaletteChange(${meta.reason}) [${p.map((s) => s.color ?? "·").join(" ")}]`)}
      />
      <EventLog entries={log} />
    </div>
  );
}

function Fixtures() {
  const [key, setKey] = useState("six");
  const [rev, setRev] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(["six", "mono", "transparent", "huge"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={key === k} onClick={() => { setKey(k); setRev((r) => r + 1); }} className="rounded-full border border-current px-3 py-1 text-[12px] aria-pressed:bg-[#141311] aria-pressed:text-[#faf9f6]">
            {FIXTURES[k]!.alt}
          </button>
        ))}
      </div>
      <PaletteComposer source={source(key, rev)} onSourceChange={() => {}} allowUrl={false} onExtractionError={(e) => setLog((l) => [`error ${e.reason}: ${e.message}`, ...l].slice(0, 5))} onExtractionStateChange={(s) => setLog((l) => [`state → ${s}`, ...l].slice(0, 5))} />
      <EventLog entries={log} />
    </div>
  );
}

const slowDecoder: Decoder = async (input, limits, signal) => {
  if (input.url === FIXTURES.photo!.url) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 1500);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        resolve();
      });
    });
    if (signal.aborted) throw { reason: "aborted", message: "Superseded." };
  }
  return browserDecoder(input, limits, signal);
};

function Race() {
  const [current, setCurrent] = useState<PaletteSource | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const start = () => {
    setLog([]);
    setCurrent({ ...source("photo", `a-${Date.now()}`), alt: "A (slow landscape)" });
    setTimeout(() => setCurrent({ ...source("six", `b-${Date.now()}`), alt: "B (six colours)" }), 150);
  };
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <button type="button" onClick={start} className="self-start rounded-full bg-[#141311] px-4 py-1.5 text-sm text-[#faf9f6]">
        Load A, then B 150 ms later
      </button>
      <PaletteComposer decoder={slowDecoder} source={current} onSourceChange={setCurrent} allowUrl={false} onPaletteChange={(p, meta) => setLog((l) => [`onPaletteChange(${meta.reason}, request ${meta.requestId}) ${p[0]?.color ?? ""}`, ...l].slice(0, 5))} onExtractionStateChange={(s) => setLog((l) => [`state → ${s}`, ...l].slice(0, 5))} />
      <EventLog entries={log} />
    </div>
  );
}

const BRAND: Swatch[] = [
  { id: "slot-1", color: "#ff4d1c", locked: true, origin: "edited" },
  { id: "slot-2", color: "#faf9f6", locked: false, origin: "edited" },
  { id: "slot-3", color: "#e9e5dc", locked: false, origin: "edited" },
  { id: "slot-4", color: "#141311", locked: false, origin: "edited" },
];

function Locked() {
  const [key, setKey] = useState<"six" | "photo">("six");
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <button type="button" onClick={() => setKey((k) => (k === "six" ? "photo" : "six"))} className="self-start rounded-full border border-current px-4 py-1.5 text-sm">
        Load the other image
      </button>
      <PaletteComposer source={source(key, key)} onSourceChange={() => {}} allowUrl={false} defaultPalette={[BRAND[0]!]} />
    </div>
  );
}

function ClipboardDenied() {
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!denied) return;
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
    const stub = { writeText: () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) };
    Object.defineProperty(navigator, "clipboard", { value: stub, configurable: true });
    return () => {
      // restore the real clipboard
      delete (navigator as unknown as Record<string, unknown>).clipboard;
      if (original) Object.defineProperty(Navigator.prototype, "clipboard", original);
    };
  }, [denied]);
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={denied} onChange={(e) => setDenied(e.target.checked)} />
        Simulate denied clipboard
      </label>
      <PaletteComposer defaultPalette={BRAND} count={4} allowUrl={false} variant="editor" />
    </div>
  );
}

export const paletteComposerLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundComposer values={values} />,
  cardPreview: () => (
    <div className="flex w-56 flex-col gap-2" aria-hidden>
      <div className="h-16 rounded-lg" style={{ background: "linear-gradient(135deg, #f3d6a3, #1d2a6b)" }} />
      <div className="grid grid-cols-6 gap-1">
        {["#f3d6a3", "#1d2a6b", "#ff4d1c", "#1f7a4f", "#7a4fff", "#141311"].map((c) => (
          <div key={c} className="h-6 rounded" style={{ background: c }} />
        ))}
      </div>
    </div>
  ),
  examples: {
    fixtures: () => <Fixtures />,
    race: () => <Race />,
    locked: () => <Locked />,
    clipboard: () => <ClipboardDenied />,
    brand: () => (
      <div className="w-full max-w-2xl">
        <PaletteComposer variant="brand" exportPrefix="acme" slotLabels={["Accent", "Background", "Surface", "Text"]} count={4} defaultPalette={BRAND} allowUrl={false} />
      </div>
    ),
  },
};
