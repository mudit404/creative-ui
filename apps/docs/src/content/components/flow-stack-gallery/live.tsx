"use client";

import { useState } from "react";
import { FlowStackGallery, type FlowStackGalleryProps, type FlowStackItem } from "@/components/ui/flow-stack-gallery";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

/** Generated SVG "photos" so the docs need no image assets. */
function svgImage(hue: number, label: string, w = 1200, h = 900): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue} 45% 80%)'/><stop offset='1' stop-color='hsl(${hue + 40} 40% 55%)'/></linearGradient></defs>
  <rect width='${w}' height='${h}' fill='url(#g)'/>
  <circle cx='${w * 0.68}' cy='${h * 0.36}' r='${h * 0.18}' fill='hsl(${hue + 20} 50% 92% / 0.7)'/>
  <path d='M0 ${h * 0.78} Q ${w * 0.3} ${h * 0.6} ${w * 0.55} ${h * 0.74} T ${w} ${h * 0.66} V ${h} H0Z' fill='hsl(${hue + 60} 35% 40% / 0.55)'/>
  <text x='48' y='${h - 56}' font-family='ui-monospace, monospace' font-size='40' fill='rgba(20,19,17,0.55)' letter-spacing='6'>${label.toUpperCase()}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const NAMES = ["Harbour", "Dunes", "Night bus", "Tide tables", "Salt", "Interval", "Reel two"];
const HUES = [24, 36, 260, 160, 190, 320, 290];
export const PHOTOS: FlowStackItem[] = NAMES.map((n, i) => ({
  id: `ph${i + 1}`,
  src: svgImage(HUES[i]!, n),
  thumb: svgImage(HUES[i]!, n, 240, 180),
  alt: `${n}, ${2021 + (i % 5)}`,
  caption: `${n} — shot on film, ${2021 + (i % 5)}`,
}));

function PlaygroundGallery({ values }: { values: PlaygroundValues }) {
  const props = values as unknown as Omit<FlowStackGalleryProps, "items" | "label">;
  return (
    <div style={{ width: "min(560px, 100%)" }}>
      <FlowStackGallery label="Lookbook" items={PHOTOS} {...props} />
    </div>
  );
}

function ControlledDemo() {
  const items = PHOTOS.slice(0, 5);
  const [i, setI] = useState(0);
  return (
    <div className="grid w-full max-w-2xl gap-6 md:grid-cols-[1fr_180px]">
      <FlowStackGallery label="Works" items={items} index={i} onIndexChange={setI} showCaptions={false} />
      <ol className="m-0 list-none p-0 text-[14px]">
        {items.map((it, n) => (
          <li key={it.id}>
            <button
              type="button"
              aria-current={n === i ? "true" : undefined}
              onClick={() => setI(n)}
              className={`w-full rounded-md px-2 py-1.5 text-left ${n === i ? "bg-[light-dark(#141311,#ecebe6)] text-[light-dark(#f3f1ec,#141311)]" : "text-[light-dark(#141311,#ecebe6)] hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.08))]"}`}
            >
              {it.alt}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export const flowStackGalleryLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundGallery values={values} />,
  cardPreview: () => (
    <div className="w-56">
      <FlowStackGallery label="Preview" items={PHOTOS.slice(0, 4)} thumbSize={36} showCaptions={false} aspect="4 / 3" />
    </div>
  ),
  examples: {
    basic: () => (
      <div style={{ width: "min(560px, 100%)" }}>
        <FlowStackGallery label="Lookbook" items={PHOTOS} />
      </div>
    ),
    deep: () => (
      <div style={{ width: "min(560px, 100%)" }}>
        <FlowStackGallery label="Archive" items={PHOTOS} stackDepth={5} spring="soft" aspect="3 / 2" thumbSize={56} />
      </div>
    ),
    controlled: () => <ControlledDemo />,
    nodrag: () => (
      <div style={{ width: "min(560px, 100%)" }}>
        <FlowStackGallery label="Steps" items={PHOTOS.slice(0, 4)} loop={false} drag={false} stackDepth={2} />
      </div>
    ),
  },
};
