"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FieldMagnet, type FieldMagnetProps } from "@/components/ui/field-magnet";
import { MaterialButton } from "@/components/ui/material-button";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

const demoButton = "rounded-full bg-[#141311] px-6 py-3 text-[15px] font-semibold text-[#f3f1ec] shadow-md";
const outlineButton = "rounded-full border border-[rgba(20,19,17,0.3)] bg-white/60 px-6 py-3 text-[15px] font-semibold text-[#141311]";

function Icon({ d, label }: { d: string; label: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      onClick={(e) => e.preventDefault()}
      className="flex size-12 items-center justify-center rounded-full bg-[#141311] text-[#f3f1ec]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </a>
  );
}

const ICONS = [
  { label: "Mail", d: "M4 6h16v12H4zM4 7l8 6 8-6" },
  { label: "Globe", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" },
  { label: "Star", d: "m12 3 2.8 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.8 6.3 20.7l1.1-6.4L2.8 9.8l6.4-.9z" },
  { label: "Heart", d: "M12 21s-7-4.6-9.3-9A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9.3 5.4C19 16.4 12 21 12 21z" },
];

function toProps(values: PlaygroundValues): FieldMagnetProps & { children?: ReactNode } {
  const { children, ...rest } = values;
  return { ...(rest as FieldMagnetProps), children: children as ReactNode };
}

export const fieldMagnetLive: LiveModule = {
  renderPlayground: (values) => {
    const { children, ...props } = toProps(values);
    return (
      <FieldMagnet {...props}>
        <button type="button" className={demoButton}>
          {children}
        </button>
      </FieldMagnet>
    );
  },
  cardPreview: () => (
    <FieldMagnet radius={90} scale={1.04} innerStrength={0.4}>
      <button type="button" className={demoButton}>
        Hire us
      </button>
    </FieldMagnet>
  ),
  examples: {
    basic: () => (
      <FieldMagnet>
        <button type="button" className={demoButton}>
          Hire us
        </button>
      </FieldMagnet>
    ),
    parallax: () => (
      <FieldMagnet innerStrength={0.6} scale={1.04} radius={140}>
        <button type="button" className={outlineButton}>
          Get started
        </button>
      </FieldMagnet>
    ),
    icons: () => (
      <div className="flex items-center gap-6">
        {ICONS.map((i) => (
          <FieldMagnet key={i.label} radius={80} strength={0.5} maxOffset={12} spring="soft">
            <Icon d={i.d} label={i.label} />
          </FieldMagnet>
        ))}
      </div>
    ),
    aschild: () => (
      <FieldMagnet asChild radius={100}>
        <Link href="/docs" className="text-[#141311] underline underline-offset-4">
          See pricing
        </Link>
      </FieldMagnet>
    ),
    axis: () => (
      <nav className="flex gap-2 text-[15px] font-medium text-[#141311]">
        {["Products", "Studio", "Journal", "Contact"].map((t) => (
          <FieldMagnet key={t} axis="x" strength={0.5} maxOffset={10} spring="stiff">
            <span className="block px-4 py-2">{t}</span>
          </FieldMagnet>
        ))}
      </nav>
    ),
    composed: () => (
      <FieldMagnet radius={160} strength={0.2} maxOffset={14}>
        <MaterialButton size="lg">Let’s collaborate</MaterialButton>
      </FieldMagnet>
    ),
  },
};
