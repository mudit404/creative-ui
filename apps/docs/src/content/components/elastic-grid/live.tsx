"use client";

import { useState } from "react";
import { ElasticGrid, ElasticGridItem, type ElasticGridProps } from "@/components/ui/elastic-grid";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

type Kind = "photo" | "film" | "type";
interface Work {
  id: string;
  title: string;
  kind: Kind;
  hue: number;
  year: number;
}

const WORKS: Work[] = [
  { id: "w1", title: "Harbour light", kind: "photo", hue: 24, year: 2024 },
  { id: "w2", title: "Still, moving", kind: "film", hue: 200, year: 2023 },
  { id: "w3", title: "Grotesk No. 4", kind: "type", hue: 48, year: 2025 },
  { id: "w4", title: "Tide tables", kind: "photo", hue: 160, year: 2022 },
  { id: "w5", title: "Night bus", kind: "film", hue: 260, year: 2024 },
  { id: "w6", title: "Serif study", kind: "type", hue: 10, year: 2021 },
  { id: "w7", title: "Dunes", kind: "photo", hue: 36, year: 2025 },
  { id: "w8", title: "Interval", kind: "film", hue: 320, year: 2022 },
  { id: "w9", title: "Mono variable", kind: "type", hue: 120, year: 2023 },
  { id: "w10", title: "Salt", kind: "photo", hue: 190, year: 2021 },
  { id: "w11", title: "Reel two", kind: "film", hue: 290, year: 2025 },
  { id: "w12", title: "Caps & smalls", kind: "type", hue: 70, year: 2024 },
];

function Cover({ work }: { work: Work }) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="group flex h-full w-full flex-col justify-end rounded-[inherit] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[light-dark(#141311,#ecebe6)] focus-visible:ring-offset-2"
      style={{
        background: `linear-gradient(160deg, hsl(${work.hue} 45% 78%), hsl(${work.hue + 30} 40% 60%))`,
      }}
    >
      <span className="rounded-full bg-[#141311]/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#f3f1ec]">{work.kind}</span>
      <span className="mt-1 text-[14px] font-semibold text-[#141311]">{work.title}</span>
    </a>
  );
}

function PlaygroundGrid({ values }: { values: PlaygroundValues }) {
  const { filter = "all", aspect, ...props } = values as unknown as ElasticGridProps & { filter?: string; aspect?: string };
  const visible = WORKS.filter((w) => filter === "all" || w.kind === filter);
  return (
    <div className="w-full max-w-2xl">
      <ElasticGrid aria-label="Work" {...props}>
        {visible.map((w) => (
          <ElasticGridItem key={w.id} aspect={aspect}>
            <Cover work={w} />
          </ElasticGridItem>
        ))}
      </ElasticGrid>
    </div>
  );
}

function FilterDemo() {
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [sort, setSort] = useState<"title" | "year">("title");
  const visible = WORKS.filter((w) => filter === "all" || w.kind === filter).sort((a, b) =>
    sort === "title" ? a.title.localeCompare(b.title) : b.year - a.year,
  );
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-[light-dark(#141311,#ecebe6)] bg-[light-dark(#141311,#ecebe6)] text-[light-dark(#f3f1ec,#141311)]" : "border-[light-dark(rgba(20,19,17,0.25),rgba(236,235,230,0.25))] text-[light-dark(#141311,#ecebe6)]"}`;
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter and sort">
        {(["all", "photo", "film", "type"] as const).map((k) => (
          <button key={k} type="button" className={chip(filter === k)} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[light-dark(rgba(20,19,17,0.2),rgba(236,235,230,0.2))]" aria-hidden />
        <button type="button" className={chip(sort === "title")} aria-pressed={sort === "title"} onClick={() => setSort("title")}>
          A–Z
        </button>
        <button type="button" className={chip(sort === "year")} aria-pressed={sort === "year"} onClick={() => setSort("year")}>
          Newest
        </button>
      </div>
      <ElasticGrid aria-label="Projects" columns={4} gap={8}>
        {visible.map((w) => (
          <ElasticGridItem key={w.id} aspect="1 / 1">
            <Cover work={w} />
          </ElasticGridItem>
        ))}
      </ElasticGrid>
    </div>
  );
}

const ARTICLES = [
  { id: "a1", title: "Why springs, not durations", summary: "Interruptible motion that feels physical, and how to tune it without a slider for everything." },
  { id: "a2", title: "Designing for reduced motion", summary: "A fallback is a design, not a switch. What to keep, what to drop, what to shorten." },
  { id: "a3", title: "Own the source", summary: "The registry model: files you can read, change and delete, versus a dependency you wait on." },
  { id: "a4", title: "Pointer fields", summary: "One listener, many consumers: sharing pointer state across every creative component on a page." },
  { id: "a5", title: "Canvas vs. WebGL", summary: "Where 2D rendering wins for drop-in components, and when a shader tier makes sense." },
  { id: "a6", title: "Testing motion", summary: "Pixel counts, frame captures and probes: how the docs verify what they claim." },
];

export const elasticGridLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundGrid values={values} />,
  cardPreview: () => (
    <div className="w-64">
      <ElasticGrid aria-label="Preview" columns={4} gap={6} stretch={0.6} reach={1.2}>
        {WORKS.slice(0, 8).map((w) => (
          <ElasticGridItem key={w.id} aspect="1 / 1">
            <div className="h-full w-full" style={{ background: `hsl(${w.hue} 45% 72%)` }} />
          </ElasticGridItem>
        ))}
      </ElasticGrid>
    </div>
  ),
  examples: {
    basic: () => (
      <div className="w-full max-w-2xl">
        <ElasticGrid aria-label="Work" minCellWidth={150} gap={10}>
          {WORKS.slice(0, 8).map((w) => (
            <ElasticGridItem key={w.id} aspect="4 / 3">
              <Cover work={w} />
            </ElasticGridItem>
          ))}
        </ElasticGrid>
      </div>
    ),
    filter: () => <FilterDemo />,
    content: () => (
      <div className="w-full max-w-2xl">
        <ElasticGrid aria-label="Articles" columns={3} stretch={0.25} spring="soft" gap={10}>
          {ARTICLES.map((a) => (
            <ElasticGridItem key={a.id} className="bg-[light-dark(rgba(255,255,255,0.7),rgba(255,255,255,0.08))] p-5">
              <h3 className="text-[15px] font-semibold text-[light-dark(#141311,#ecebe6)]">{a.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[light-dark(rgba(20,19,17,0.7),rgba(236,235,230,0.7))]">{a.summary}</p>
            </ElasticGridItem>
          ))}
        </ElasticGrid>
      </div>
    ),
    tuned: () => (
      <div className="w-full max-w-2xl">
        <ElasticGrid aria-label="Swatches" columns={6} stretch={0.3} reach={3} spring="soft" gap={6}>
          {WORKS.map((w) => (
            <ElasticGridItem key={w.id} aspect="1 / 1">
              <div className="h-full w-full" style={{ background: `hsl(${w.hue} 50% 70%)` }} />
            </ElasticGridItem>
          ))}
        </ElasticGrid>
      </div>
    ),
  },
};
