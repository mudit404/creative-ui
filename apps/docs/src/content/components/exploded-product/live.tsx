"use client";

import { ExplodedProduct, type ExplodedProductProps, type ViewPreset } from "@/components/ui/exploded-product";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { SPEAKER_PARTS, buildSpeaker, posterSvg } from "~/content/fixtures/three-models";

export const POSTER = posterSvg("Desk speaker", 24);
export const VIEWS: ViewPreset[] = [
  { id: "front", label: "Front", yaw: 0, pitch: 0.15 },
  { id: "side", label: "Side", yaw: Math.PI / 2, pitch: 0.2 },
  { id: "top", label: "Top", yaw: 0.4, pitch: 1.2 },
];
const base = { model: { kind: "scene" as const, build: buildSpeaker }, poster: POSTER, alt: "Desk speaker", parts: SPEAKER_PARTS, views: VIEWS };

function PlaygroundProduct({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<ExplodedProductProps>;
  return (
    <div className="w-full">
      <ExplodedProduct {...base} {...props} />
    </div>
  );
}

export const explodedProductLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundProduct key={`${values.defaultProgress}-${values.quality}`} values={values} />,
  cardPreview: () => (
    <svg viewBox="0 0 200 100" className="h-24 w-52" aria-hidden>
      <rect x="40" y="30" width="60" height="50" rx="6" fill="#3d3a35" />
      <rect x="110" y="30" width="8" height="50" rx="2" fill="#e9e5dc" />
      <circle cx="140" cy="60" r="12" fill="#141311" />
      <circle cx="140" cy="38" r="6" fill="#1d2a6b" />
      <rect x="35" y="86" width="70" height="6" rx="3" fill="#b8b8b8" />
      <line x1="100" y1="55" x2="128" y2="55" stroke="#1f7a4f" strokeDasharray="3 3" />
    </svg>
  ),
  examples: {
    speaker: () => <ExplodedProduct {...base} />,
    missing: () => <ExplodedProduct {...base} parts={[...SPEAKER_PARTS, { id: "ghost", nodePath: "Body/Ghost", label: "Ghost panel", offset: [0, 1, 0] }, { id: "lid", nodePath: "Lid", label: "Lid", offset: [0, 1, 0] }]} />,
    pair: () => (
      <div className="grid w-full gap-4 lg:grid-cols-2">
        <ExplodedProduct {...base} label="Instance A" defaultProgress={1} />
        <ExplodedProduct {...base} label="Instance B" />
      </div>
    ),
    fallback: () => <ExplodedProduct {...base} renderer="none" defaultSelectedId="woofer" />,
  },
};
