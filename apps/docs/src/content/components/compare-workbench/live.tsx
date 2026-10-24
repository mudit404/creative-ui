"use client";

import { useState } from "react";
import { CompareWorkbench, type AttributeDefinition, type CompareItem, type CompareWorkbenchProps } from "@/components/ui/compare-workbench";
import type { LiveModule } from "~/content/live-types";
import type { PlaygroundValues } from "~/components/playground/playground";
import { EventLog } from "~/content/components/elastic-range/live";

function svgImage(hue: number, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' rx='32' fill='hsl(${hue} 40% 82%)'/><circle cx='200' cy='170' r='90' fill='hsl(${hue} 45% 45%)'/><circle cx='200' cy='170' r='46' fill='hsl(${hue} 30% 20%)'/><rect x='70' y='280' width='260' height='60' rx='14' fill='hsl(${hue} 35% 60%)'/><text x='200' y='320' text-anchor='middle' font-family='ui-monospace,monospace' font-size='28' fill='rgba(20,19,17,0.7)' letter-spacing='4'>${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ── neutral camera fixture: 4 products × 40 attributes, mixed units, equal values, false/zero/unknown ── */

const GROUPS = ["Sensor", "Body", "Video", "Connectivity", "Price & availability"] as const;
export const CAMERA_ATTRIBUTES: AttributeDefinition[] = [
  { key: "sensor", label: "Sensor format", group: "Sensor", kind: "text" },
  { key: "mp", label: "Resolution", group: "Sensor", unit: "MP", kind: "number" },
  { key: "iso", label: "Max ISO", group: "Sensor", kind: "number" },
  { key: "dr", label: "Dynamic range", group: "Sensor", unit: "stops", kind: "number", tolerance: 0.2 },
  { key: "ibis", label: "In-body stabilisation", group: "Sensor", kind: "boolean" },
  { key: "shutter", label: "Max shutter", group: "Sensor", unit: "s", kind: "text" },
  { key: "fps", label: "Burst rate", group: "Sensor", unit: "fps", kind: "number" },
  { key: "af", label: "AF points", group: "Sensor", kind: "number" },
  { key: "weight", label: "Weight", group: "Body", unit: "g", kind: "number" },
  { key: "width", label: "Width", group: "Body", unit: "mm", kind: "number" },
  { key: "height", label: "Height", group: "Body", unit: "mm", kind: "number" },
  { key: "depth", label: "Depth", group: "Body", unit: "mm", kind: "number" },
  { key: "sealed", label: "Weather sealed", group: "Body", kind: "boolean" },
  { key: "evf", label: "Viewfinder", group: "Body", kind: "text" },
  { key: "screen", label: "Screen", group: "Body", unit: "in", kind: "number" },
  { key: "tilt", label: "Articulating screen", group: "Body", kind: "boolean" },
  { key: "slots", label: "Card slots", group: "Body", kind: "number" },
  { key: "battery", label: "Shots per charge", group: "Body", kind: "number" },
  { key: "v4k", label: "4K recording", group: "Video", kind: "boolean" },
  { key: "v4kfps", label: "4K frame rate", group: "Video", unit: "fps", kind: "number" },
  { key: "v8k", label: "8K recording", group: "Video", kind: "boolean" },
  { key: "log", label: "Log profile", group: "Video", kind: "boolean" },
  { key: "bitrate", label: "Max bitrate", group: "Video", unit: "Mbps", kind: "number" },
  { key: "mic", label: "Mic input", group: "Video", kind: "boolean" },
  { key: "headphone", label: "Headphone output", group: "Video", kind: "boolean" },
  { key: "reclimit", label: "Recording limit", group: "Video", unit: "min", kind: "number" },
  { key: "wifi", label: "Wi-Fi", group: "Connectivity", kind: "boolean" },
  { key: "bt", label: "Bluetooth", group: "Connectivity", kind: "text" },
  { key: "usb", label: "USB", group: "Connectivity", kind: "text" },
  { key: "hdmi", label: "HDMI", group: "Connectivity", kind: "text" },
  { key: "gps", label: "GPS", group: "Connectivity", kind: "boolean" },
  { key: "tether", label: "Tethering", group: "Connectivity", kind: "boolean" },
  { key: "ports", label: "Accessory ports", group: "Connectivity", kind: "number" },
  { key: "nfc", label: "NFC", group: "Connectivity", kind: "boolean" },
  { key: "price", label: "Body price", group: "Price & availability", unit: "USD", kind: "number" },
  { key: "kit", label: "Kit price", group: "Price & availability", unit: "USD", kind: "number" },
  { key: "warranty", label: "Warranty", group: "Price & availability", unit: "years", kind: "number" },
  { key: "stock", label: "In stock", group: "Price & availability", kind: "boolean" },
  { key: "ship", label: "Ships in", group: "Price & availability", unit: "days", kind: "number" },
  { key: "released", label: "Released", group: "Price & availability", kind: "number" },
];
void GROUPS;

const U = { availability: "unknown" } as const;
const NA = { availability: "not-applicable" } as const;

export const CAMERAS: CompareItem[] = [
  {
    id: "c1",
    name: "Alpha One",
    image: svgImage(24, "ALPHA"),
    description: "Full-frame hybrid",
    attributes: { sensor: "Full frame", mp: 24, iso: 51200, dr: 14.1, ibis: true, shutter: "1/8000", fps: 10, af: 693, weight: 500, width: 128, height: 96, depth: 70, sealed: true, evf: "OLED 3.69M", screen: 3, tilt: true, slots: 2, battery: 580, v4k: true, v4kfps: 60, v8k: false, log: true, bitrate: 200, mic: true, headphone: true, reclimit: 0, wifi: true, bt: "5.0", usb: "USB-C", hdmi: "Micro", gps: false, tether: true, ports: 3, nfc: true, price: 1999, kit: 2399, warranty: 2, stock: true, ship: 2, released: 2024 },
  },
  {
    id: "c2",
    name: "Beta Compact",
    image: svgImage(200, "BETA"),
    description: "APS-C travel body",
    attributes: { sensor: "APS-C", mp: 26, iso: 51200, dr: 13.9, ibis: false, shutter: "1/4000", fps: 20, af: 425, weight: { value: 500, unit: "oz" }, width: 118, height: 83, depth: 46, sealed: false, evf: "OLED 2.36M", screen: 3, tilt: true, slots: 1, battery: 440, v4k: true, v4kfps: 30, v8k: false, log: true, bitrate: 200, mic: true, headphone: false, reclimit: 30, wifi: U, bt: "4.2", usb: "USB-C", hdmi: "Micro", gps: NA, tether: false, ports: 0, nfc: false, price: 1099, kit: 1399, warranty: 1, stock: true, ship: 5, released: 2023 },
  },
  {
    id: "c3",
    name: "Gamma Pro",
    image: svgImage(140, "GAMMA"),
    description: "Stacked-sensor flagship",
    attributes: { sensor: "Full frame", mp: 45, iso: 102400, dr: 14.3, ibis: true, shutter: "1/32000", fps: 30, af: 1053, weight: 500, width: 138, height: 98, depth: 88, sealed: true, evf: "OLED 9.44M", screen: 3.2, tilt: true, slots: 2, battery: 620, v4k: true, v4kfps: 120, v8k: true, log: true, bitrate: 600, mic: true, headphone: true, reclimit: 0, wifi: true, bt: "5.0", usb: "USB-C", hdmi: "Full", gps: true, tether: true, ports: 4, nfc: false, price: { value: 3899, unit: "EUR" }, kit: U, warranty: 2, stock: false, ship: 21, released: 2024 },
  },
  {
    id: "c4",
    name: "Delta Cine",
    image: svgImage(300, "DELTA"),
    description: "Box-style cinema body",
    attributes: { sensor: "Full frame", mp: 24, iso: 409600, dr: 15, ibis: false, shutter: "1/8000", fps: 10, af: 759, weight: 700, width: 130, height: 100, depth: 110, sealed: true, evf: NA, screen: NA, tilt: NA, slots: 2, battery: U, v4k: true, v4kfps: 120, v8k: false, log: true, bitrate: 600, mic: true, headphone: true, reclimit: 0, wifi: true, bt: "5.0", usb: "USB-C", hdmi: "Full", gps: false, tether: true, ports: 6, nfc: false, price: 3499, kit: NA, warranty: 2, stock: true, ship: 2, released: 2022 },
  },
];

export const PLAN_ATTRIBUTES: AttributeDefinition[] = [
  { key: "price", label: "Monthly price", group: "Price", unit: "USD", kind: "number" },
  { key: "seats", label: "Seats", group: "Limits", kind: "number" },
  { key: "projects", label: "Projects", group: "Limits", kind: "number" },
  { key: "storage", label: "Storage", group: "Limits", unit: "GB", kind: "number" },
  { key: "sso", label: "Single sign-on", group: "Security", kind: "boolean" },
  { key: "audit", label: "Audit log", group: "Security", kind: "boolean" },
  { key: "sla", label: "Uptime SLA", group: "Support", unit: "%", kind: "number" },
  { key: "support", label: "Support", group: "Support", kind: "text" },
];
export const PLANS: CompareItem[] = [
  { id: "free", name: "Free", attributes: { price: 0, seats: 1, projects: 3, storage: 1, sso: false, audit: false, sla: NA, support: "Community" } },
  { id: "pro", name: "Pro", attributes: { price: 12, seats: 1, projects: 50, storage: 100, sso: false, audit: U, sla: 99.9, support: "Email" } },
  { id: "team", name: "Team", attributes: { price: 29, seats: 10, projects: 0, storage: 1000, sso: true, audit: true, sla: 99.9, support: "Priority" } },
  { id: "ent", name: "Enterprise", attributes: { price: U, seats: 0, projects: 0, storage: U, sso: true, audit: true, sla: 99.99, support: "Dedicated" } },
];

const TECH_ATTRIBUTES = CAMERA_ATTRIBUTES;

function dataFor(variant: string) {
  return variant === "plans" ? { items: PLANS, attributes: PLAN_ATTRIBUTES, ids: ["free", "pro", "team"] } : { items: CAMERAS, attributes: variant === "technical" ? TECH_ATTRIBUTES : CAMERA_ATTRIBUTES, ids: ["c1", "c2"] };
}

function PlaygroundBench({ values }: { values: PlaygroundValues }) {
  const props = values as unknown as Omit<CompareWorkbenchProps, "items" | "attributes">;
  const { items, attributes, ids } = dataFor(String(props.variant ?? "products"));
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-4">
      <CompareWorkbench
        items={items}
        attributes={attributes}
        defaultSelectedIds={ids}
        {...props}
        onSelectedIdsChange={(next, reason) => setLog((l) => [`onSelectedIdsChange([${next.join(", ")}], ${reason})`, ...l].slice(0, 6))}
        onLimitReached={(id) => setLog((l) => [`onLimitReached(${id})`, ...l].slice(0, 6))}
        onOpenChange={(o) => setLog((l) => [`onOpenChange(${o})`, ...l].slice(0, 6))}
        renderAction={props.variant === "plans" ? undefined : (item) => <button type="button" className="rounded-full border border-current px-3 py-1 text-[12px]">Buy {item.name}</button>}
      />
      <EventLog entries={log} />
    </div>
  );
}

function Refresh() {
  const [items, setItems] = useState(CAMERAS);
  return (
    <div className="flex w-full flex-col gap-3">
      <button type="button" onClick={() => setItems((x) => x.filter((i) => i.id !== "c3"))} disabled={items.length < 4} className="self-start rounded-full border border-current px-4 py-1.5 text-sm disabled:opacity-40">
        {items.length < 4 ? "Gamma removed from host data" : "Remove Gamma from host data"}
      </button>
      <CompareWorkbench items={items} attributes={CAMERA_ATTRIBUTES} defaultSelectedIds={["c1", "c3", "c4"]} defaultOpen />
    </div>
  );
}

function Controlled() {
  const [ids, setIds] = useState<string[]>([]);
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="m-0 font-mono text-[12px] opacity-70">parent refuses Beta · selected: [{ids.join(", ")}]</p>
      <CompareWorkbench items={CAMERAS} attributes={CAMERA_ATTRIBUTES} selectedIds={ids} onSelectedIdsChange={(next) => setIds(next.filter((id) => id !== "c2"))} />
    </div>
  );
}

export const compareWorkbenchLive: LiveModule = {
  renderPlayground: (values) => <PlaygroundBench key={String(values.variant)} values={values} />,
  cardPreview: () => (
    <div className="flex w-56 flex-col gap-1.5" aria-hidden>
      <div className="flex gap-1.5">
        {[24, 200, 140].map((h) => (
          <div key={h} className="h-10 flex-1 rounded-lg" style={{ background: `hsl(${h} 40% 78%)` }} />
        ))}
      </div>
      {[0, 1, 2].map((r) => (
        <div key={r} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-1.5">
          <div className="h-2.5 rounded bg-[rgba(20,19,17,0.25)]" />
          {[0, 1, 2].map((c) => (
            <div key={c} className="h-2.5 rounded" style={{ background: r === 1 && c === 2 ? "rgba(200,245,90,0.9)" : "rgba(20,19,17,0.12)" }} />
          ))}
        </div>
      ))}
    </div>
  ),
  examples: {
    products: () => <CompareWorkbench items={CAMERAS} attributes={CAMERA_ATTRIBUTES} defaultSelectedIds={["c1", "c2"]} renderAction={(item) => <button type="button" className="rounded-full border border-current px-3 py-1 text-[12px]">Buy {item.name}</button>} />,
    limit: () => <CompareWorkbench items={CAMERAS} attributes={CAMERA_ATTRIBUTES} maxSelected={3} defaultSelectedIds={["c1", "c2", "c3"]} />,
    plans: () => <CompareWorkbench variant="plans" items={PLANS} attributes={PLAN_ATTRIBUTES} defaultSelectedIds={["free", "pro", "team"]} defaultOpen />,
    refresh: () => <Refresh />,
    controlled: () => <Controlled />,
    narrow: () => (
      <div style={{ width: 360, maxWidth: "100%" }}>
        <CompareWorkbench items={CAMERAS} attributes={CAMERA_ATTRIBUTES} defaultSelectedIds={["c1", "c2", "c3", "c4"]} defaultOpen />
      </div>
    ),
  },
};
