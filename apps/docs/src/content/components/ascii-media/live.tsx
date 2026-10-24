"use client";

import { useState } from "react";
import { AsciiMedia, type AsciiMediaProps, type FrameSampler } from "@/components/ui/ascii-media";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

export const SCENE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'><defs><radialGradient id='sky' cx='35%' cy='25%' r='80%'><stop offset='0' stop-color='#ffffff'/><stop offset='0.5' stop-color='#7a93b8'/><stop offset='1' stop-color='#141b2d'/></radialGradient><linearGradient id='sea' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2f6b4f'/><stop offset='1' stop-color='#0d2418'/></linearGradient></defs><rect width='800' height='500' fill='url(#sky)'/><circle cx='580' cy='150' r='80' fill='#f3c969'/><path d='M0 360 Q200 300 400 360 T800 360 V500 H0Z' fill='url(#sea)'/><rect x='110' y='210' width='40' height='170' fill='#faf9f6'/><polygon points='105,210 155,210 130,160' fill='#c8360d'/><rect x='118' y='230' width='24' height='18' fill='#141311'/></svg>`,
)}`;
const VIDEO = { kind: "video" as const, src: "/media/film.webm", description: "Generated demo film: coloured panels moving across a dark field", loop: true };
const IMAGE = { kind: "image" as const, src: SCENE, alt: "A lighthouse on a green shore under a bright sun" };

const tainted: FrameSampler = () => {
  throw new DOMException("The canvas has been tainted by cross-origin data.", "SecurityError");
};

function PlaygroundAscii({ values }: { values: PlaygroundValues }) {
  const props = values as Partial<AsciiMediaProps>;
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-3">
      <AsciiMedia source={IMAGE} onReady={(g) => setLog((l) => [`onReady(${g.cols}×${g.rows})`, ...l].slice(0, 6))} onError={(e) => setLog((l) => [`onError(${e.reason}): ${e.message}`, ...l].slice(0, 6))} onShowOriginalChange={(s) => setLog((l) => [`onShowOriginalChange(${s})`, ...l].slice(0, 6))} {...props} />
      <EventLog entries={log} />
    </div>
  );
}

function Tainted() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-3">
      <AsciiMedia source={IMAGE} sampler={tainted} onError={(e) => setLog((l) => [`onError(${e.reason}): ${e.message}`, ...l])} />
      <EventLog entries={log} />
    </div>
  );
}

export const asciiMediaLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundAscii values={values} />,
  cardPreview: () => <AsciiMedia source={IMAGE} columns={48} label="Preview" />,
  examples: {
    image: () => <AsciiMedia source={IMAGE} />,
    color: () => <AsciiMedia source={IMAGE} variant="source-color" invert columns={72} style={{ ["--cui-ascii-background" as string]: "#faf9f6" }} />,
    video: () => <AsciiMedia source={VIDEO} maxFps={12} columns={80} />,
    tainted: () => <Tainted />,
    ramp: () => (
      <div className="grid w-full gap-4 md:grid-cols-2">
        <AsciiMedia source={IMAGE} glyphRamp="🙂" columns={48} label="Invalid ramp" />
        <AsciiMedia source={VIDEO} motion="reduced" label="Reduced motion video" />
      </div>
    ),
  },
};
