"use client";

import { useState } from "react";
import { LiquidSwitch, type LiquidSwitchProps } from "@/components/ui/liquid-switch";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";

function toProps(values: PlaygroundValues): LiquidSwitchProps {
  const colors: Record<string, string> = {};
  for (const k of ["trackOn", "trackOff", "thumb"] as const) {
    const v = values[`colors.${k}`];
    if (typeof v === "string" && v.trim()) colors[k] = v.trim();
  }
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (!k.startsWith("colors.")) props[k] = v;
  return { ...(props as LiquidSwitchProps), colors: Object.keys(colors).length ? colors : undefined };
}

function Controlled() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-4 text-[15px]">
      <LiquidSwitch checked={on} onCheckedChange={setOn} aria-label="Wi-Fi" />
      <span>{on ? "Connected" : "Off"}</span>
    </div>
  );
}

const labelClass = "flex items-center gap-3 text-[15px] font-medium";

export const liquidSwitchLive: LiveModule = {
  renderPlayground: (values) => {
    const props = toProps(values);
    // remount when the initial state control changes so defaultChecked applies
    return (
      <label className={labelClass}>
        <LiquidSwitch key={String(props.defaultChecked)} {...props} />
        Email notifications
      </label>
    );
  },
  cardPreview: () => (
    <div className="flex items-center gap-6">
      <LiquidSwitch size="lg" defaultChecked aria-label="Preview on" />
      <LiquidSwitch size="lg" aria-label="Preview off" viscosity={0.9} />
    </div>
  ),
  examples: {
    basic: () => (
      <label htmlFor="notify" className={labelClass}>
        <LiquidSwitch id="notify" defaultChecked />
        Email notifications
      </label>
    ),
    controlled: () => <Controlled />,
    sizes: () => (
      <div className="flex items-center gap-8">
        <LiquidSwitch size="sm" aria-label="Small" />
        <LiquidSwitch size="md" aria-label="Medium" defaultChecked />
        <LiquidSwitch size="lg" aria-label="Large" />
      </div>
    ),
    colors: () => (
      <div className="flex items-center gap-8">
        <LiquidSwitch defaultChecked aria-label="Blue" colors={{ trackOn: "#1d2a6b", trackOff: "#cfd3e6", thumb: "#fff" }} />
        <LiquidSwitch defaultChecked aria-label="Ember" colors={{ trackOn: "#e34a1f", thumb: "#fff3ea" }} />
        <LiquidSwitch defaultChecked aria-label="Acid" colors={{ trackOn: "#1f7a4f", trackOff: "#2b2b2b", thumb: "#c8f55a" }} />
      </div>
    ),
    viscosity: () => (
      <div className="flex items-center gap-8">
        <LiquidSwitch viscosity={0} aria-label="Rigid" />
        <LiquidSwitch viscosity={0.6} aria-label="Default" />
        <LiquidSwitch viscosity={1} aria-label="Syrup" />
      </div>
    ),
    form: () => (
      <form
        className="flex items-center gap-4 text-[15px]"
        onSubmit={(e) => {
          e.preventDefault();
          const data = [...new FormData(e.currentTarget)].map(([k, v]) => `${k}=${v}`).join("&") || "(nothing checked)";
          alert(data);
        }}
      >
        <label className={labelClass}>
          <LiquidSwitch name="marketing" value="yes" />
          Marketing emails
        </label>
        <button type="submit" className="rounded-full border border-current px-4 py-1.5 text-sm">
          Save
        </button>
      </form>
    ),
    states: () => (
      <div className="flex items-center gap-8">
        <LiquidSwitch disabled aria-label="Off, disabled" />
        <LiquidSwitch disabled defaultChecked aria-label="On, disabled" />
      </div>
    ),
  },
};
