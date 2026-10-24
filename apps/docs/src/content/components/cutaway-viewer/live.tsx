"use client";

import { CutawayViewer, type CutawayViewerProps, type SlicePreset } from "@/components/ui/cutaway-viewer";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { buildLayeredBox, posterSvg } from "~/content/fixtures/three-models";

const POSTER = posterSvg("Layered box", 140);
const SECTION = posterSvg("Layered box, sectioned", 20);
export const PRESETS: SlicePreset[] = [
  { id: "mid", label: "Midplane", axis: "y", offset: 0, description: "Cuts through the core and the battery; the board sits just below." },
  { id: "front", label: "Front quarter", axis: "z", offset: 0.5, description: "Removes the front quarter to show the liner thickness." },
  { id: "keep-top", label: "Keep top", axis: "y", offset: -0.4, invert: true, description: "Keeps the upper section, cutting below the board." },
];
const VIEWS = [
  { id: "front", label: "Front", yaw: 0, pitch: 0.1 },
  { id: "side", label: "Side", yaw: Math.PI / 2, pitch: 0.1 },
  { id: "top", label: "Top", yaw: 0.3, pitch: 1.25 },
];
const base = { poster: POSTER, description: "A layered box with inner objects", presets: PRESETS, views: VIEWS };

function PlaygroundViewer({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<CutawayViewerProps>;
  return (
    <div className="w-full">
      <CutawayViewer model={{ kind: "scene", build: () => buildLayeredBox() }} {...base} {...props} />
    </div>
  );
}

export const cutawayViewerLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundViewer key={`${values.defaultAxis}-${values.defaultOffset}-${values.defaultEnabled}-${values.defaultInvert}-${values.capMode}`} values={values} />,
  cardPreview: () => (
    <svg viewBox="0 0 200 100" className="h-24 w-52" aria-hidden>
      <path d="M40 25 L120 25 L120 85 L40 85 Z" fill="#e9e5dc" stroke="#141311" />
      <path d="M120 25 L160 10 L160 70 L120 85 Z" fill="#ff4d1c" opacity="0.85" />
      <circle cx="80" cy="55" r="14" fill="#1d2a6b" />
      <rect x="60" y="72" width="40" height="5" fill="#1f7a4f" />
    </svg>
  ),
  examples: {
    layered: () => <CutawayViewer model={{ kind: "scene", build: () => buildLayeredBox() }} {...base} defaultEnabled defaultOffset={0.1} />,
    open: () => <CutawayViewer model={{ kind: "scene", build: () => buildLayeredBox({ open: true }) }} {...base} description="A box whose shell is not declared closed" defaultEnabled />,
    glass: () => <CutawayViewer model={{ kind: "scene", build: () => buildLayeredBox({ glass: true }) }} {...base} description="A box with a transparent shell" capMode="required" />,
    fallback: () => <CutawayViewer model={{ kind: "scene", build: () => buildLayeredBox() }} {...base} renderer="none" sectionPoster={SECTION} defaultEnabled />,
  },
};
