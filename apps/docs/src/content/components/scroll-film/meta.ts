import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const scrollFilmMeta: ComponentMeta = {
  slug: "scroll-film",
  name: "ScrollFilm",
  title: "Scroll Film",
  tagline: "Scroll scrubs the film; the player, transcript and chapters never depend on it.",
  description:
    "A poster, a meaningful description, a native video, an authored transcript and chapter links render on the server. Story mode maps a declared scroll segment to a clamped media-time range and asks the video to seek with at most one seek in flight, reporting requested and presented times separately. \"Play normally\" hands control to the native player and stays there until the user returns. Reduced motion, media errors and nonfinite durations fall back to the native player with the same transcript and chapters. Audio never starts on its own.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["video", "scroll", "scrub", "film", "story", "chapters", "transcript", "seek", "sticky"],
  registryName: "scroll-film",
  importPath: "@/components/ui/scroll-film",
  dependencies: { npm: ["clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion", "seek-scheduler"] },
  props: [
    { name: "src / poster / description", type: "string | { src, type }[] / string / string", default: "—", description: "Required. The host owns media rights; description names the video." },
    { name: "chapters", type: "{ id, label, startTime, endTime?, transcriptAnchor? }[]", default: "[]", description: "Seconds in media time, ordered; overlaps are diagnosed and disable story mode." },
    { name: "videoRange", type: "[seconds, seconds]", default: "[0, duration]", description: "Media-time bounds the scroll segment maps to." },
    { name: "scrollRoot / scrollStart / scrollEnd", type: "RefObject<HTMLElement> / number / number", default: "window / own wrapper", description: "Explicit progress mapping. Without start/end the component's own wrapper (scrollLength × 100vh, sticky stage) is the segment." },
    { name: "scrollLength", type: "number (viewport heights)", default: "3", description: "Height of the built-in sticky wrapper." },
    { name: "mode / defaultMode / onModeChange", type: '"story" | "native" / (mode, reason) => void', default: '"story"', description: "reason is user | preference | unsupported | error. User playback wins." },
    { name: "transcript", type: "ReactNode", default: "—", description: "Required authored transcript; never generated." },
    { name: "tracks", type: "{ src, srclang, label, kind?, default? }[]", default: "[]", description: "Caption/subtitle tracks." },
    { name: "onTimeState", type: "({ requested, presented, seeking, generation, mode, buffering }) => void", default: "—", description: "Truthful synchronisation diagnostics." },
    { name: "preload", type: '"none" | "metadata" | "auto"', default: '"metadata"', description: "Native preload hint." },
    { name: "variant", type: '"sticky-story" | "inline" | "native"', default: '"sticky-story"', description: "native is the permanent fallback composition." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "A reduced-motion preference forces native mode; off only removes smooth chapter scrolling." },
    { name: "ref", type: "ScrollFilmHandle", default: "—", description: "{ root, video } — the native element, not the scheduler." },
  ],
  cssVars: [
    { name: "--cui-film-caption-bg", description: "Chapter caption background on the stage", default: "rgba(0,0,0,0.65)" },
    { name: "--cui-film-progress", description: "Requested-time progress line", default: "#c8f55a" },
    { name: "--cui-film-chapter-active", description: "Active chapter button", default: "#141311" },
    { name: "--cui-film-border", description: "Buttons and transcript border", default: "rgba(20,19,17,0.25)" },
  ],
  examples: [
    {
      id: "story",
      title: "12-second authored film with three chapters",
      description: "A generated silent test film (WebM, VP9, 640×360, ~570 KB; a fixture, not an encoding recommendation). Scroll through the tall section to scrub; the status shows requested vs presented time.",
      code: `<ScrollFilm src="/media/film.webm" poster={poster} description="Assembling the desk speaker" chapters={chapters} transcript={<Transcript />} />`,
    },
    {
      id: "failed",
      title: "Failed URL",
      description: "A missing file: poster, error, transcript and chapters remain; nothing is pinned blank.",
      code: `<ScrollFilm src="/media/does-not-exist.webm" … />`,
    },
    {
      id: "replace",
      title: "Source replacement",
      description: "Swap the source while scrubbing: callbacks from the old video are ignored by generation.",
      code: `<button onClick={() => setSrc(other)}>Swap source</button>`,
    },
    {
      id: "native",
      title: "Native variant",
      description: "The permanent fallback: an ordinary player with controls, the transcript open, chapters seeking the player.",
      code: `<ScrollFilm variant="native" … />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`role="group"\` root with \`data-mode\` (story | native) and \`data-state\` (poster | ready | seeking | fallback). The stage holds the native \`video\` (poster, preload, muted in story mode, controls in native mode), a progress line of the requested time, a buffering/seeking badge, and a chapter caption. Below: the mode button, a status line, chapter navigation and a transcript disclosure.

- **Mapping**: \`scrollFraction(scrollY, start, end)\` → \`fractionToTime(fraction, videoRange)\`, clamped at both ends (C50-T01). The browser's scroll position is never rewritten.
- **Seeking**: the scheduler issues one seek and keeps only the latest pending target; the next seek is issued on \`seeked\` (C50-T02). Presented time comes from \`requestVideoFrameCallback\` where available, else \`timeupdate\` (C50-T06).
- **Generations**: a source change resets the scheduler; callbacks from the old element carry the old generation and are ignored (C50-T03).
- **Native mode**: scroll listeners are removed, controls appear, muting is lifted; scrolling cannot interrupt playback (C50-T04). Re-entering story mode is a user action.
- **Fallbacks**: nonfinite duration (C50-T07), media error (C50-T09) and a reduced-motion preference (C50-T05) all land on the native player with the same transcript and chapters.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- The transcript and chapter links work without any scrolling; chapters are buttons that scroll the page in story mode or seek the player in native mode (C50-T08).
- The video is named by \`description\`; caption tracks are forwarded as \`<track>\` elements.
- A polite status reports requested vs presented time or the current mode, never per frame.
- Audio never starts on its own: story mode is muted and paused; native mode waits for the user to press play (C50-T10).`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `One passive scroll listener throttled to animation frames; seeks are back-pressured by the media element itself. No Canvas reads, no smooth-scroll library. Scrub quality depends on the asset's keyframe interval: the fixture is encoded with frequent keyframes, which is the asset profile to document for your own films.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- No frame-perfect guarantee: compressed video seeks to the nearest decodable frame; presented time tells the truth about where it landed.
- Image-sequence backends and authored frame preloading are deferred.
- The built-in sticky wrapper assumes a window scroller; inside a custom scroll root pass explicit scrollStart/scrollEnd.`,
    },
  ],
  sourceFiles: ["components/ui/scroll-film.tsx", "lib/seek-scheduler.ts", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. References studied: Luis Riancho's scroll-synced video experiment (concept only; demo not exercised), MDN requestVideoFrameCallback. GSAP ScrollTrigger is not used. Seek, mode and fallback contracts from Collection 02 brief #50. The demo film is generated by tests/e2e/scripts/make-film.mjs with MediaRecorder. Runtime dependencies: clsx (MIT), tailwind-merge (MIT).",
};

export const scrollFilmPlayground: PlaygroundDef = {
  initial: { variant: "inline", scrollLength: 3, preload: "metadata" },
  defaults: { variant: "sticky-story", scrollLength: 3, preload: "metadata", motion: "auto" },
  controls: [
    { type: "select", prop: "variant", label: "Variant", group: "Shape", options: [{ label: "Inline", value: "inline" }, { label: "Sticky story", value: "sticky-story" }, { label: "Native", value: "native" }] },
    { type: "range", prop: "scrollLength", label: "Scroll length", group: "Scroll", min: 1.5, max: 6, step: 0.5, unit: "vh×" },
    { type: "select", prop: "preload", label: "Preload", group: "Media", options: [{ label: "metadata", value: "metadata" }, { label: "auto", value: "auto" }, { label: "none", value: "none" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Sticky story", values: { variant: "sticky-story" } },
    { name: "Native player", values: { variant: "native" } },
  ],
};
