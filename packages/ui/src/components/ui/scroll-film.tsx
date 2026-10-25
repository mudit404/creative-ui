"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { activeChapter, createSeekScheduler, fractionToTime, scrollFraction, validateChapters, type Chapter, type SeekState } from "@/lib/seek-scheduler";

export type { Chapter, SeekState } from "@/lib/seek-scheduler";

export type FilmMode = "story" | "native";

export interface FilmSource {
  src: string;
  type?: string;
}

export interface TrackDescriptor {
  src: string;
  srclang: string;
  label: string;
  kind?: "subtitles" | "captions" | "descriptions";
  default?: boolean;
}

export interface TimeState extends SeekState {
  mode: FilmMode;
  buffering: boolean;
}

export interface ScrollFilmHandle {
  root: HTMLDivElement | null;
  video: HTMLVideoElement | null;
}

export interface ScrollFilmProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  src: string | FilmSource[];
  poster: string;
  /** Meaningful description of the film (also the video's accessible name). */
  description: string;
  chapters?: readonly Chapter[];
  /** Media-time bounds scrubbed by the scroll segment; defaults to the finite duration. */
  videoRange?: [number, number];
  /** Scrolling element whose scrollTop drives the film; defaults to the window. */
  scrollRoot?: React.RefObject<HTMLElement | null>;
  /** Explicit scroll positions (px) of the segment; defaults to this component's own scroll wrapper. */
  scrollStart?: number;
  scrollEnd?: number;
  /** Height of the built-in scroll wrapper in viewport heights (sticky-story). */
  scrollLength?: number;
  mode?: FilmMode;
  defaultMode?: FilmMode;
  onModeChange?: (mode: FilmMode, reason: "user" | "preference" | "unsupported" | "error") => void;
  /** Authored transcript; never generated. */
  transcript: React.ReactNode;
  tracks?: readonly TrackDescriptor[];
  onTimeState?: (state: TimeState) => void;
  preload?: "none" | "metadata" | "auto";
  variant?: "sticky-story" | "inline" | "native";
  label?: string;
  motion?: "auto" | "reduced" | "off";
}

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * ScrollFilm — a scroll-synchronised film with an honest seek contract.
 *
 * The poster, description, transcript, chapter links and a native video are
 * server-rendered. Story mode maps a declared scroll segment to a clamped
 * media-time range and asks the video to seek with at most one seek in
 * flight; requested and presented times are reported separately. "Play
 * normally" hands control to the native player and stays there until the
 * user returns. Reduced motion, media errors and nonfinite durations fall
 * back to the native player with the same transcript and chapters.
 */
export const ScrollFilm = React.forwardRef<ScrollFilmHandle, ScrollFilmProps>(function ScrollFilm(
  {
    src,
    poster,
    description,
    chapters = [],
    videoRange,
    scrollRoot,
    scrollStart,
    scrollEnd,
    scrollLength = 3,
    mode: modeProp,
    defaultMode = "story",
    onModeChange,
    transcript,
    tracks = [],
    onTimeState,
    preload = "metadata",
    variant = "sticky-story",
    label = "Film",
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const motionMode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  // only a reduced-motion preference forces the native player; "off" merely removes smooth scrolling
  const prefersNative = motionMode === "reduced";
  const sources = typeof src === "string" ? [{ src }] : src;
  const sourceKey = sources.map((s) => s.src).join("|");

  /* mode: user playback wins; preference/unsupported/error force native */
  const [internalMode, setInternalMode] = React.useState<FilmMode>(variant === "native" ? "native" : defaultMode);
  const [forced, setForced] = React.useState<{ reason: "preference" | "unsupported" | "error"; message: string } | null>(null);
  const mode: FilmMode = forced || prefersNative ? "native" : (modeProp ?? internalMode);
  const setMode = (next: FilmMode, reason: "user" | "preference" | "unsupported" | "error") => {
    if (modeProp === undefined) setInternalMode(next);
    onModeChange?.(next, reason);
  };

  /* media state */
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [duration, setDuration] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [buffering, setBuffering] = React.useState(false);
  const range: [number, number] | null = React.useMemo(() => {
    if (videoRange) return videoRange;
    return duration !== null && Number.isFinite(duration) && duration > 0 ? [0, duration] : null;
  }, [videoRange, duration]);
  const diagnostics = React.useMemo(() => validateChapters(chapters, range ?? [0, Number.POSITIVE_INFINITY]), [chapters, range]);

  /* seek scheduler bound to the video element */
  const [seekState, setSeekState] = React.useState<SeekState>({ requested: null, presented: null, seeking: false, generation: 1 });
  const scheduler = React.useMemo(
    () =>
      createSeekScheduler({
        seek: (t) => {
          const v = videoRef.current;
          if (!v) return;
          try {
            v.currentTime = t;
          } catch {
            /* not seekable yet */
          }
        },
      }),
    [],
  );
  React.useEffect(() => scheduler.subscribe(setSeekState), [scheduler]);
  const generationRef = React.useRef(1);
  // a new source invalidates in-flight callbacks (C50-T03)
  const [seenSource, setSeenSource] = React.useState(sourceKey);
  if (seenSource !== sourceKey) {
    setSeenSource(sourceKey);
    setDuration(null);
    setFailed(null);
    setForced(null);
  }
  React.useEffect(() => {
    generationRef.current = scheduler.reset();
    const v = videoRef.current;
    if (v && typeof v.load === "function") {
      try {
        v.load();
      } catch {
        /* jsdom */
      }
    }
  }, [sourceKey, scheduler]);

  /* media events */
  React.useEffect(() => {
    const v = videoRef.current as VideoWithRVFC | null;
    if (!v) return;
    const gen = generationRef.current;
    const onMeta = () => {
      if (!Number.isFinite(v.duration) || v.duration <= 0) {
        setForced({ reason: "unsupported", message: "This media has no finite duration (live or unknown length), so scroll scrubbing is unavailable. Use the player below." });
        setDuration(null);
        return;
      }
      setDuration(v.duration);
      scheduler.onPresented(v.currentTime, gen); // the first frame is already presented; a seek to it would never report
    };
    const onSeeked = () => scheduler.onSeeked(v.currentTime, gen);
    const onError = () => setFailed("The video could not be loaded. The poster, transcript and chapters remain available.");
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("error", onError);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("playing", onCanPlay);
    if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    let rvfc: number | null = null;
    if (typeof v.requestVideoFrameCallback === "function") {
      const tick = (_now: number, meta: { mediaTime: number }) => {
        scheduler.onPresented(meta.mediaTime, gen);
        rvfc = v.requestVideoFrameCallback!(tick);
      };
      rvfc = v.requestVideoFrameCallback(tick);
    } else {
      const onTime = () => scheduler.onPresented(v.currentTime, gen);
      v.addEventListener("timeupdate", onTime);
      return () => {
        v.removeEventListener("loadedmetadata", onMeta);
        v.removeEventListener("durationchange", onMeta);
        v.removeEventListener("seeked", onSeeked);
        v.removeEventListener("error", onError);
        v.removeEventListener("waiting", onWaiting);
        v.removeEventListener("canplay", onCanPlay);
        v.removeEventListener("playing", onCanPlay);
        v.removeEventListener("timeupdate", onTime);
      };
    }
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onError);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("playing", onCanPlay);
      if (rvfc !== null && typeof v.cancelVideoFrameCallback === "function") v.cancelVideoFrameCallback(rvfc);
    };
  }, [sourceKey, scheduler]);

  /* reduced motion → native mode with the same content (C50-T05) */
  React.useEffect(() => {
    if (prefersNative && (modeProp ?? internalMode) === "story") onModeChange?.("native", "preference");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersNative]);

  /* scroll mapping: only in story mode with a usable range (C50-T04) */
  const storyActive = mode === "story" && range !== null && !failed && diagnostics.length === 0;
  const segment = () => {
    if (scrollStart !== undefined && scrollEnd !== undefined) return [scrollStart, scrollEnd] as const;
    const wrap = wrapRef.current;
    if (!wrap) return [0, 1] as const;
    const rootEl = scrollRoot?.current ?? null;
    const vh = rootEl ? rootEl.clientHeight : window.innerHeight;
    const top = rootEl ? wrap.offsetTop - rootEl.offsetTop : wrap.getBoundingClientRect().top + window.scrollY;
    // sticky: the stage is pinned while the wrapper scrolls past; inline: the film scrubs as the stage crosses the viewport
    return variant === "sticky-story" ? ([top, top + wrap.offsetHeight - vh] as const) : ([top - vh, top + wrap.offsetHeight] as const);
  };
  const currentScroll = () => (scrollRoot?.current ? scrollRoot.current.scrollTop : window.scrollY);
  const latest = React.useRef({ range, storyActive, scrollStart, scrollEnd });
  React.useEffect(() => {
    latest.current = { range, storyActive, scrollStart, scrollEnd };
  });
  React.useEffect(() => {
    if (!storyActive) return;
    const v = videoRef.current;
    if (v && typeof v.pause === "function") {
      try {
        v.pause();
      } catch {
        /* jsdom */
      }
    }
    const target: HTMLElement | Window = scrollRoot?.current ?? window;
    let queued = false; // a flag, not the frame id: re-entrant when rAF runs synchronously
    let raf = 0;
    const update = () => {
      queued = false;
      const st = latest.current;
      if (!st.storyActive || !st.range) return;
      const [a, b] = segment();
      scheduler.request(fractionToTime(scrollFraction(currentScroll(), a, b), st.range));
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (queued) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyActive, scheduler, scrollRoot]);

  React.useEffect(() => {
    onTimeState?.({ ...seekState, mode, buffering });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekState, mode, buffering]);

  /* chapters */
  const requestedTime = seekState.requested ?? range?.[0] ?? 0;
  const active = activeChapter(chapters, requestedTime);
  const goToChapter = (c: Chapter) => {
    if (storyActive && range) {
      const [a, b] = segment();
      const f = (c.startTime - range[0]) / (range[1] - range[0] || 1);
      const y = a + Math.max(0, Math.min(1, f)) * (b - a);
      const rootEl = scrollRoot?.current;
      if (rootEl) rootEl.scrollTo({ top: y, behavior: motionMode === "full" ? "smooth" : "auto" });
      else window.scrollTo({ top: y, behavior: motionMode === "full" ? "smooth" : "auto" });
    } else {
      const v = videoRef.current;
      if (v) {
        try {
          v.currentTime = c.startTime;
        } catch {
          /* not ready */
        }
      }
    }
  };

  React.useImperativeHandle(ref, () => ({ root: rootRef.current, video: videoRef.current }));
  const uid = React.useId();
  const progress = range && seekState.requested !== null ? (seekState.requested - range[0]) / (range[1] - range[0] || 1) : 0;
  const presentedLag = seekState.requested !== null && seekState.presented !== null && Math.abs(seekState.requested - seekState.presented) > 0.05;
  const sticky = variant === "sticky-story" && storyActive && scrollStart === undefined;

  const stage = (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black" data-stage>
      <video
        ref={videoRef}
        key={sourceKey}
        src={sources.length === 1 ? sources[0]!.src : undefined}
        poster={poster}
        preload={preload}
        muted={mode === "story"}
        playsInline
        controls={mode === "native"}
        aria-label={description}
        className="size-full object-cover"
        data-mode={mode}
      >
        {sources.length > 1 &&
          sources.map((s, i) => (
            // the last <source> failing is the only signal the element gives for an unloadable set
            <source key={s.src} src={s.src} type={s.type} onError={i === sources.length - 1 ? () => setFailed("The video could not be loaded. The poster, transcript and chapters remain available.") : undefined} />
          ))}
        {tracks.map((t) => (
          <track key={t.src} src={t.src} srcLang={t.srclang} label={t.label} kind={t.kind ?? "captions"} default={t.default} />
        ))}
      </video>
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center text-[13px] text-white" role="alert">
          {failed}
        </div>
      )}
      {mode === "story" && (
        <>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div className="h-full bg-[var(--cui-film-progress,#c8f55a)]" style={{ width: `${progress * 100}%` }} data-progress />
          </div>
          {(seekState.seeking || buffering || presentedLag) && (
            <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white" data-buffering>
              {buffering ? "Buffering…" : "Seeking…"}
            </div>
          )}
          {active && (
            <div className="absolute inset-x-3 bottom-4 rounded-lg bg-[var(--cui-film-caption-bg,rgba(0,0,0,0.65))] px-3 py-1.5 text-[13px] text-white" data-caption>
              {active.label}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      data-slot="scroll-film"
      data-variant={variant}
      data-motion={motionMode}
      data-mode={mode}
      data-state={failed ? "fallback" : forced ? "fallback" : range === null ? "poster" : seekState.seeking ? "seeking" : "ready"}
      role="group"
      aria-label={label}
      className={cn("flex w-full flex-col gap-3 text-[var(--cui-film-text,light-dark(#141311,#ecebe6))]", className)}
      {...rest}
    >
      {sticky ? (
        <div ref={wrapRef} style={{ height: `${scrollLength * 100}vh` }} data-scroll-wrapper>
          <div className="sticky top-0 flex min-h-screen flex-col justify-center py-4">{stage}</div>
        </div>
      ) : (
        <div ref={wrapRef}>{stage}</div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {mode === "story" ? (
          <button type="button" onClick={() => setMode("native", "user")} className={BTN}>
            Play normally
          </button>
        ) : (
          !forced &&
          !prefersNative &&
          variant !== "native" && (
            <button type="button" onClick={() => setMode("story", "user")} className={BTN}>
              Back to story mode
            </button>
          )
        )}
        <span role="status" aria-live="polite" className="opacity-80">
          {forced?.message ?? (failed ? "" : mode === "story" ? (seekState.requested !== null ? `Requested ${seekState.requested.toFixed(2)} s · presented ${seekState.presented !== null ? seekState.presented.toFixed(2) : "—"} s` : "Scroll to scrub the film.") : "Native playback: use the player controls.")}
        </span>
        {diagnostics.length > 0 && (
          <span role="note" className="text-[var(--cui-film-error,light-dark(#b8310c,#ff8a65))]">
            {diagnostics.join(" ")}
          </span>
        )}
      </div>

      {chapters.length > 0 && (
        <nav aria-label="Chapters">
          <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0 text-[12px]">
            {chapters.map((c) => (
              <li key={c.id}>
                <button type="button" aria-current={active?.id === c.id ? "true" : undefined} onClick={() => goToChapter(c)} className={cn(BTN, active?.id === c.id && "border-[var(--cui-film-chapter-active,light-dark(#141311,#ecebe6))] bg-[var(--cui-film-chapter-active,light-dark(#141311,#ecebe6))] text-[light-dark(#faf9f6,#141311)]")}>
                  {c.label}
                  <span className="ml-1 font-mono text-current/65">{formatTime(c.startTime)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <details open={mode === "native" || !!failed} className="rounded-xl border border-[var(--cui-film-border,light-dark(rgba(20,19,17,0.25),rgba(236,235,230,0.25)))] p-3 text-[13px]">
        <summary id={`${uid}-transcript`} className="cursor-pointer font-medium">
          Transcript
        </summary>
        <div className="mt-2 opacity-85">{transcript}</div>
      </details>
    </div>
  );
});
ScrollFilm.displayName = "ScrollFilm";

const BTN =
  "inline-flex h-7 items-center rounded-full border border-[var(--cui-film-border,light-dark(rgba(20,19,17,0.25),rgba(236,235,230,0.25)))] px-2.5 text-[12px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06))] focus-visible:ring-2 focus-visible:ring-[var(--cui-film-focus,light-dark(#141311,#ecebe6))]";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
