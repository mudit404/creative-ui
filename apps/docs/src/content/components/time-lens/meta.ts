import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const timeLensMeta: ComponentMeta = {
  slug: "time-lens",
  name: "TimeLens",
  title: "Time Lens",
  tagline: "An overview you brush and a detail lane that magnifies it, on an honest time axis.",
  description:
    "Events are epoch milliseconds on a linear scale: equal intervals take equal space, and nothing is ever evenly spaced for looks. The overview band shows the whole domain with a draggable window and two handles; the detail lane magnifies that window with real ticks, lane-stacked durations and a stationary focus marker. Zoom buttons, an ISO interval editor and an event list do everything a drag does. Display uses an explicit IANA zone; values never change.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["timeline", "time", "events", "brush", "zoom", "incidents", "releases", "history", "overview", "detail"],
  registryName: "time-lens",
  importPath: "@/components/ui/time-lens",
  dependencies: { npm: ["clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "time-scale"] },
  props: [
    { name: "events", type: "TimeEvent[]", default: "—", description: "Required. { id, startMs, endMs?, label, details?, severity? }. Malformed events are listed as diagnostics." },
    { name: "domain", type: "[startMs, endMs]", default: "—", description: "Required full time range." },
    { name: "window / defaultWindow", type: "[startMs, endMs]", default: "domain", description: "Controlled or initial visible interval; always clamped to the domain and minSpan." },
    { name: "minSpan", type: "number (ms)", default: "60000", description: "Smallest visible interval." },
    { name: "timeZone", type: "IANA name", default: '"UTC"', description: "Display only." },
    { name: "selectedId / defaultSelectedId / onSelectedIdChange", type: "string | null / (id, reason) => void", default: "null", description: "Selection independent of the window; selecting an off-screen event recentres the window at the same zoom." },
    { name: "onWindowPreview / onWindowCommit", type: "(window, source) => void", default: "—", description: "Transient during brush/pan/handle drags; one commit per release, zoom, editor apply, fit or select." },
    { name: "wheelZoom", type: '"off" | "ctrl" | "alt" | "shift"', default: '"off"', description: "Opt-in wheel zoom with a modifier while the lane is focused; never captures ordinary scrolling." },
    { name: "renderEvent / renderDetails", type: "slots", default: "—", description: "Custom mark content and detail card." },
    { name: "variant", type: '"incidents" | "releases" | "history"', default: '"incidents"', description: "Styling only." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "240 ms axis/mark transitions under full motion only." },
    { name: "ref", type: "TimeLensHandle", default: "—", description: "{ root, focusEvent(id), fitWindow(window?) }." },
  ],
  cssVars: [
    { name: "--cui-time-text", description: "Text colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-time-band", description: "Overview band background", default: "light-dark(rgba(20,19,17,0.06), rgba(236,235,230,0.08))" },
    { name: "--cui-time-axis", description: "Lane, axis and detail-card borders, tick marks and button outlines (decorative)", default: "light-dark(rgba(20,19,17,0.2), rgba(236,235,230,0.2))" },
    { name: "--cui-time-input-border", description: "Interval editor input outline (the input's only boundary)", default: "light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45))" },
    { name: "--cui-time-selection", description: "Window borders, handles and the selected event's ring", default: "light-dark(#1a6b45, #5fcf8f)" },
    { name: "--cui-time-selection-fill", description: "Window fill and the selected list row", default: "light-dark(rgba(26,107,69,0.15), rgba(95,207,143,0.2))" },
    { name: "--cui-time-event", description: "Event marks", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-time-event-text", description: "Label text on duration marks", default: "light-dark(#faf9f6, #141311)" },
    { name: "--cui-time-focus", description: "Focus ring and stationary marker", default: "light-dark(#141311, #ecebe6)" },
    { name: "--cui-time-error", description: "Diagnostics and editor errors", default: "light-dark(#b8310c, #ff8a65)" },
  ],
  examples: [
    {
      id: "incidents",
      title: "24 hours across a DST change",
      description: "8 March 2026 in New York: the clock skips 02:00. Compare the UTC and New York displays; order and spacing never change.",
      code: `<TimeLens events={incidents} domain={[T0, T0 + 24 * H]} timeZone="America/New_York" minSpan={5 * 60_000} />`,
    },
    {
      id: "stress",
      title: "500 deterministic events",
      description: "Overlapping durations stack into lanes; long titles truncate in the lane and stay complete in the list.",
      code: `<TimeLens events={fiveHundred} domain={week} variant="history" />`,
    },
    {
      id: "controlled",
      title: "Controlled window with an invalid event",
      description: "The parent owns the window and logs previews vs commits. One event ends before it starts and is reported, not drawn.",
      code: `<TimeLens window={win} onWindowPreview={log} onWindowCommit={(w) => { setWin(w); log(w); }} … />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-state\` (ready | brushing). The overview band (88 px) draws every event faintly and a window \`div\` with two \`role="slider"\` handles; clicking the band recentres the window. Controls: + / − / Fit, an ISO editor and the zone name. The detail lane (\`role="region"\` named with the window summary) draws ticks and lane-stacked event buttons; a detail card and the full event list follow.

- **Scale**: \`linearTimeScale(window, width)\` maps ms to px; ticks come from a nice-step table aligned to UTC multiples (C46-T01).
- **Window**: pan drags move both ends; handle drags move one, clamped to \`minSpan\` and the domain (C46-T03). Pointer moves emit \`onWindowPreview\`; release commits once (C46-T02).
- **No-drag**: zoom halves/doubles the span around the centre; the editor accepts ISO-8601 with an offset only, so DST-ambiguous local times cannot be entered (C46-T04).
- **Revisions**: a changed domain or event list during a brush cancels it, releases the pointer and reclamps the committed window (C46-T07).
- **Selection**: from the lane or the list; an off-screen event is brought into view at the current span (C46-T08).`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Handles are sliders with \`aria-valuetext\` in the display zone; Arrow keys move them by 5% of the window.
- Every event is a button in the lane (when visible) and in the list (always); the list is the functional equivalent for the chart.
- A hidden status summarises the window and visible count; frames are never announced.
- \`wheelZoom="off"\` leaves page scrolling alone (C46-T06); opt-in zoom needs a modifier and focus, and uses a non-passive native listener.
- Reduced motion removes the 240 ms transitions; nothing else changes.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Rendering is O(events) per window change with plain DOM marks; the 500-event fixture renders instantly. Lanes are allocated once per data revision. No timers, no listeners at rest beyond a ResizeObserver on the band.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No Canvas adapter; beyond a few thousand visible events, filter on the host side.
- Ticks are UTC-aligned steps, so day boundaries in other zones fall between ticks at sub-day zooms.
- Single track; multitrack synchronisation is deferred by the brief.`,
    },
  ],
  sourceFiles: ["components/ui/time-lens.tsx", "lib/time-scale.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Reference studied: Michelle Barker's scrollable/draggable timeline tutorial (Codrops, 2022; concept only, no code or GSAP). Scale, window and timezone contracts from Collection 02 brief #46 and WCAG 2.2 SC 2.5.7. Runtime dependencies: clsx (MIT), tailwind-merge (MIT).",
};

export const timeLensPlayground: PlaygroundDef = {
  initial: { timeZone: "UTC", minSpan: 300000, wheelZoom: "off", variant: "incidents" },
  defaults: { timeZone: "UTC", minSpan: 60000, wheelZoom: "off", variant: "incidents", motion: "auto" },
  controls: [
    { type: "select", prop: "timeZone", label: "Time zone", group: "Display", options: [{ label: "UTC", value: "UTC" }, { label: "America/New_York", value: "America/New_York" }, { label: "Europe/Berlin", value: "Europe/Berlin" }, { label: "Asia/Kolkata", value: "Asia/Kolkata" }] },
    { type: "range", prop: "minSpan", label: "Min span", group: "Window", min: 60000, max: 3600000, step: 60000, unit: "ms" },
    { type: "select", prop: "wheelZoom", label: "Wheel zoom", group: "Interaction", options: [{ label: "Off", value: "off" }, { label: "Ctrl + wheel", value: "ctrl" }, { label: "Shift + wheel", value: "shift" }] },
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Incidents", value: "incidents" }, { label: "Releases", value: "releases" }, { label: "History", value: "history" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "New York, DST day", values: { timeZone: "America/New_York" } },
    { name: "Ctrl-wheel zoom", values: { wheelZoom: "ctrl" } },
  ],
};
