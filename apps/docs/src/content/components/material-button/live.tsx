"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MaterialButton, type MaterialButtonProps } from "@/components/ui/material-button";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

function ArrowIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Convert flat playground values into component props. */
function toProps(values: PlaygroundValues): MaterialButtonProps & { children?: ReactNode } {
  const colors: Record<string, string> = {};
  for (const k of ["surface", "label", "goo"] as const) {
    const v = values[`colors.${k}`];
    if (typeof v === "string" && v.trim()) colors[k] = v.trim();
  }
  const { children, ...rest } = values;
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith("colors.")) continue;
    props[k] = v;
  }
  return {
    ...(props as MaterialButtonProps),
    colors: Object.keys(colors).length ? colors : undefined,
    children: children as ReactNode,
  };
}

export const materialButtonLive: LiveModule = {
  renderPlayground: (values) => <MaterialButton {...toProps(values)} />,
  cardPreview: () => (
    <MaterialButton size="md" reach={90} tendrils={4}>
      Let’s collaborate
    </MaterialButton>
  ),
  examples: {
    basic: () => <MaterialButton size="lg">Let’s collaborate</MaterialButton>,
    sizes: () => (
      <div className="flex flex-wrap items-center justify-center gap-10">
        <MaterialButton size="sm">Small</MaterialButton>
        <MaterialButton size="md" shape="rounded">
          Rounded
        </MaterialButton>
        <MaterialButton size="lg">Large</MaterialButton>
      </div>
    ),
    bone: () => (
      <div className="rounded-xl bg-neutral-950 p-12" style={{ ["--mb-ring-offset" as string]: "#0a0a0a" }}>
        <MaterialButton tone="bone">Start a project</MaterialButton>
      </div>
    ),
    icon: () => (
      <MaterialButton>
        <ArrowIcon />
        Continue
      </MaterialButton>
    ),
    "custom-colors": () => (
      <div className="flex flex-wrap items-center justify-center gap-10">
        <MaterialButton colors={{ surface: "#1d2a6b", label: "#f2f0ff" }}>Deep blue</MaterialButton>
        <MaterialButton colors={{ surface: "#e34a1f", label: "#fff3ea", goo: "#b23510" }}>Ember</MaterialButton>
      </div>
    ),
    states: () => (
      <div className="flex flex-wrap items-center justify-center gap-10">
        <MaterialButton loading>Saving</MaterialButton>
        <MaterialButton disabled>Unavailable</MaterialButton>
      </div>
    ),
    link: () => (
      <MaterialButton asChild>
        <Link href="/docs">See pricing</Link>
      </MaterialButton>
    ),
    calm: () => (
      <MaterialButton reach={70} tendrils={3} intensity={0.6} speed={0.8} idle={false}>
        Subtle
      </MaterialButton>
    ),
  },
};
