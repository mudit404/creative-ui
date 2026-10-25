"use client";

import { useState } from "react";
import { Texture } from "three";
import { FinishConfigurator, type FinishConfiguratorProps, type OptionGroup, type Selection, type TextureLoaderFn } from "@/components/ui/finish-configurator";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { buildChair, posterSvg } from "~/content/fixtures/three-models";
import { EventLog } from "~/content/components/elastic-range/live";

const POSTER = posterSvg("Lounge chair", 30);
export const GROUPS: OptionGroup[] = [
  {
    id: "shell",
    label: "Shell",
    options: [
      { id: "oak", name: "Oak", targets: ["Shell"], material: { color: "#b78d5a", roughness: 0.7 }, image: posterSvg("Oak chair", 35) },
      { id: "walnut", name: "Walnut", targets: ["Shell"], material: { color: "#5a3d2b", roughness: 0.6 }, image: posterSvg("Walnut chair", 20) },
      { id: "black", name: "Matte black", targets: ["Shell"], material: { color: "#141311", roughness: 0.9 }, available: false, unavailableReason: "Matte black is out of stock." },
    ],
  },
  {
    id: "trim",
    label: "Trim",
    options: [
      { id: "brass", name: "Brass", targets: ["Trim"], material: { color: "#c8a000", metalness: 1, roughness: 0.3 } },
      { id: "steel", name: "Steel", targets: ["Trim"], material: { color: "#b8b8b8", metalness: 1, roughness: 0.4 }, requires: { shell: ["walnut", "black"] } },
    ],
  },
  {
    id: "fabric",
    label: "Fabric",
    options: [
      { id: "linen", name: "Linen", targets: ["Seat"], material: { color: "#e9e5dc", roughness: 1 } },
      { id: "velvet", name: "Velvet", targets: ["Seat"], material: { color: "#7a1f3d", roughness: 0.8 }, excludes: { trim: ["brass"] } },
    ],
  },
];
export const DEFAULTS: Selection = { shell: "oak", trim: "brass", fabric: "linen" };
const base = { model: { kind: "scene" as const, build: buildChair }, poster: POSTER, description: "A lounge chair" };

function PlaygroundConfigurator({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<FinishConfiguratorProps>;
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-3">
      <FinishConfigurator {...base} groups={GROUPS} defaultSelection={DEFAULTS} configurationKey="CHAIR-DEMO" onSelectionChange={(s, m) => setLog((l) => [`onSelectionChange(${m.groupId}=${m.optionId}, ${m.reason}) → ${Object.values(s).join("/")}`, ...l].slice(0, 6))} {...props} />
      <EventLog entries={log} />
    </div>
  );
}

function textureDataUrl(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='${color}'/><path d='M0 32 H64 M32 0 V64' stroke='rgba(0,0,0,0.25)' stroke-width='6'/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const slowLoader: TextureLoaderFn = (url, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        const tex = new Texture(img);
        tex.needsUpdate = true;
        resolve(tex);
      };
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    }, 2000);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
const TEXTURED: OptionGroup[] = [
  {
    id: "seat",
    label: "Seat",
    options: [
      { id: "linen", name: "Linen", targets: ["Seat"], material: { color: "#e9e5dc", roughness: 1 } },
      { id: "leather", name: "Leather (slow)", targets: ["Seat"], material: { color: "#5a3d2b", roughness: 0.5, map: textureDataUrl("#5a3d2b") } },
      { id: "canvas", name: "Canvas (slow)", targets: ["Seat"], material: { color: "#7a7a5a", roughness: 0.9, map: textureDataUrl("#7a7a5a") } },
      { id: "broken", name: "Broken texture", targets: ["Seat"], material: { color: "#333333", map: "https://invalid.invalid/missing.png" } },
    ],
  },
];

export const finishConfiguratorLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundConfigurator key={String(values.quality)} values={values} />,
  cardPreview: () => (
    <div className="flex w-56 flex-col gap-2" aria-hidden>
      <div className="h-14 rounded-lg bg-[#b78d5a]" />
      <div className="flex gap-1.5">
        {["#b78d5a", "#5a3d2b", "#c8a000", "#e9e5dc", "#7a1f3d"].map((c) => (
          <span key={c} className="size-6 rounded-full border border-black/10" style={{ background: c }} />
        ))}
      </div>
    </div>
  ),
  examples: {
    chair: () => <PlaygroundConfigurator values={{}} />,
    slow: () => <FinishConfigurator {...base} groups={TEXTURED} defaultSelection={{ seat: "linen" }} textureLoader={slowLoader} />,
    pair: () => (
      <div className="grid w-full gap-4 lg:grid-cols-2">
        <FinishConfigurator {...base} label="Instance A" groups={GROUPS} defaultSelection={{ shell: "walnut", trim: "steel", fabric: "velvet" }} />
        <FinishConfigurator {...base} label="Instance B" groups={GROUPS} defaultSelection={DEFAULTS} />
      </div>
    ),
    fallback: () => <FinishConfigurator {...base} groups={GROUPS} defaultSelection={DEFAULTS} renderer="none" configurationKey="CHAIR-OAK-BRASS-LINEN" />,
  },
};
