"use client";

import { useState } from "react";
import { ExpandingProductCard, ExpandingProductGrid, type ExpandingProductGridProps } from "@/components/ui/expanding-product-grid";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

interface Product {
  id: string;
  name: string;
  price: string;
  hue: number;
  blurb: string;
  sizes: string[];
}

const PRODUCTS: Product[] = [
  { id: "p1", name: "Field jacket", price: "$240", hue: 30, blurb: "Waxed cotton shell, three bellows pockets, corduroy collar. Made to be re-waxed, not replaced.", sizes: ["S", "M", "L", "XL"] },
  { id: "p2", name: "Trail boot", price: "$310", hue: 20, blurb: "Full-grain leather on a stitched, resoleable sole. Breaks in over a month and lasts a decade.", sizes: ["41", "42", "43", "44"] },
  { id: "p3", name: "Merino crew", price: "$95", hue: 210, blurb: "Extra-fine 18.5 micron merino, knitted in one piece. Warm, light, odour-resistant.", sizes: ["S", "M", "L"] },
  { id: "p4", name: "Canvas tote", price: "$60", hue: 48, blurb: "24 oz canvas, bar-tacked handles, one inside pocket. Carries groceries and a laptop.", sizes: ["One size"] },
  { id: "p5", name: "Wool beanie", price: "$45", hue: 150, blurb: "Ribbed lambswool, cuffed. Sits above the ears without creeping.", sizes: ["One size"] },
  { id: "p6", name: "Linen shirt", price: "$120", hue: 190, blurb: "Washed European linen, mother-of-pearl buttons. Softens with every wash.", sizes: ["S", "M", "L", "XL"] },
];

function Media({ hue, name }: { hue: number; name: string }) {
  return (
    <div
      aria-hidden
      className="flex h-full w-full items-end p-3 font-mono text-[11px] uppercase tracking-wider text-[rgba(20,19,17,0.55)]"
      style={{ background: `linear-gradient(150deg, hsl(${hue} 40% 82%), hsl(${hue + 25} 35% 64%))` }}
    >
      {name}
    </div>
  );
}

function Detail({ product }: { product: Product }) {
  const [size, setSize] = useState(product.sizes[0]);
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[14px] leading-relaxed text-[rgba(20,19,17,0.75)]">{product.blurb}</p>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Size">
        {product.sizes.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={size === s}
            onClick={() => setSize(s)}
            className={`h-8 min-w-8 rounded-full border px-2.5 text-[12px] ${size === s ? "border-[#141311] bg-[#141311] text-[#f3f1ec]" : "border-[rgba(20,19,17,0.25)] text-[#141311]"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[16px] font-semibold">{product.price}</span>
        <button type="button" className="h-9 rounded-full bg-[#141311] px-4 text-[13px] font-medium text-[#f3f1ec]" onClick={(e) => e.preventDefault()}>
          Add to bag
        </button>
      </div>
    </div>
  );
}

function cards(list: Product[]) {
  return list.map((p) => (
    <ExpandingProductCard key={p.id} id={p.id} title={p.name} media={<Media hue={p.hue} name={p.name} />} summary={<span>{p.price}</span>} detail={<Detail product={p} />} />
  ));
}

function PlaygroundGrid({ values }: { values: PlaygroundValues }) {
  const { defaultExpandedId, ...props } = values as unknown as ExpandingProductGridProps;
  const initial = defaultExpandedId ? String(defaultExpandedId) : null;
  return (
    <div style={{ width: "min(680px, 100%)" }}>
      <ExpandingProductGrid key={initial ?? "none"} aria-label="Products" {...props} defaultExpandedId={initial} scrollIntoView={false}>
        {cards(PRODUCTS)}
      </ExpandingProductGrid>
    </div>
  );
}

function ControlledDemo() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{ width: "min(680px, 100%)" }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PRODUCTS.slice(0, 3).map((p) => (
          <button key={p.id} type="button" className="rounded-full border border-[rgba(20,19,17,0.25)] px-3 py-1 text-xs text-[#141311]" onClick={() => setOpen(p.id)}>
            Open {p.name}
          </button>
        ))}
        <span className="font-mono text-[11px] uppercase tracking-wider text-[rgba(20,19,17,0.5)]">?item={open ?? "none"}</span>
      </div>
      <ExpandingProductGrid aria-label="Products" expandedId={open} onExpandedChange={setOpen} minCardWidth={150} gap={10} scrollIntoView={false}>
        {cards(PRODUCTS.slice(0, 3))}
      </ExpandingProductGrid>
    </div>
  );
}

export const expandingProductGridLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundGrid values={values} />,
  cardPreview: () => (
    <div className="w-72">
      <ExpandingProductGrid aria-label="Preview" minCardWidth={70} gap={6} defaultExpandedId="p1" detailLayout="side" scrollIntoView={false}>
        {PRODUCTS.slice(0, 3).map((p) => (
          <ExpandingProductCard key={p.id} id={p.id} title={<span className="text-[12px]">{p.name}</span>} media={<Media hue={p.hue} name="" />} summary={<span className="text-[11px]">{p.price}</span>} detail={<p className="m-0 text-[11px]">{p.blurb}</p>} mediaAspect="1 / 1" />
        ))}
      </ExpandingProductGrid>
    </div>
  ),
  examples: {
    basic: () => (
      <div style={{ width: "min(680px, 100%)" }}>
        <ExpandingProductGrid aria-label="Products" minCardWidth={180} scrollIntoView={false}>
          {cards(PRODUCTS)}
        </ExpandingProductGrid>
      </div>
    ),
    stack: () => (
      <div style={{ width: "min(680px, 100%)" }}>
        <ExpandingProductGrid aria-label="Prints" detailLayout="stack" spring="soft" minCardWidth={160} scrollIntoView={false}>
          {cards(PRODUCTS.slice(0, 4))}
        </ExpandingProductGrid>
      </div>
    ),
    controlled: () => <ControlledDemo />,
  },
};
