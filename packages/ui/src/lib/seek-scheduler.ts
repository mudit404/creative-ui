/**
 * Latest-target seek scheduler for ScrollFilm. At most one seek is in flight;
 * newer targets replace the pending one instead of queueing. A generation
 * token invalidates callbacks from a previous media source. Pure: it talks to
 * a minimal `SeekTarget` interface so tests can drive it without a browser.
 */

export interface SeekTarget {
  /** Issue a seek; the scheduler waits for `onSeeked` before issuing the next. */
  seek(time: number): void;
}

export interface SeekState {
  requested: number | null;
  presented: number | null;
  seeking: boolean;
  generation: number;
}

export interface SeekScheduler {
  /** Ask for a time; coalesces while a seek is in flight. */
  request(time: number): void;
  /** Media reported that a seek finished (or a frame was presented) at `time`. */
  onSeeked(time: number, generation?: number): void;
  /** Media reported a presented frame time without a seek (e.g. playback). */
  onPresented(time: number, generation?: number): void;
  /** Invalidate everything in flight (source replaced). Returns the new generation. */
  reset(): number;
  state(): SeekState;
  subscribe(cb: (s: SeekState) => void): () => void;
}

export function createSeekScheduler(target: SeekTarget, opts: { epsilon?: number; timeoutMs?: number } = {}): SeekScheduler {
  const eps = opts.epsilon ?? 0.001;
  const timeoutMs = opts.timeoutMs ?? 1500;
  let st: SeekState = { requested: null, presented: null, seeking: false, generation: 1 };
  let pending: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const subs = new Set<(s: SeekState) => void>();
  const emit = () => subs.forEach((s) => s(st));
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const issue = (t: number) => {
    st = { ...st, requested: t, seeking: true };
    emit();
    target.seek(t);
    clearTimer();
    // browsers may never report `seeked` for a no-op seek; release the slot without inventing a presented time
    timer = setTimeout(() => {
      timer = null;
      if (!st.seeking) return;
      st = { ...st, seeking: false };
      emit();
      if (pending !== null) {
        const next = pending;
        pending = null;
        issue(next);
      }
    }, timeoutMs);
  };
  return {
    request(time) {
      if (!Number.isFinite(time)) return;
      if (st.seeking) {
        pending = time; // keep only the latest (C50-T02)
        if (st.requested !== time) {
          st = { ...st, requested: time };
          emit();
        }
        return;
      }
      if (st.presented !== null && Math.abs(st.presented - time) < eps) {
        if (st.requested !== time) {
          st = { ...st, requested: time };
          emit();
        }
        return;
      }
      issue(time);
    },
    onSeeked(time, generation) {
      if (generation !== undefined && generation !== st.generation) return; // stale source (C50-T03)
      clearTimer();
      st = { ...st, presented: time, seeking: false };
      emit();
      if (pending !== null) {
        const next = pending;
        pending = null;
        if (Math.abs(next - time) >= eps) issue(next);
      }
    },
    onPresented(time, generation) {
      if (generation !== undefined && generation !== st.generation) return;
      if (st.presented !== time) {
        st = { ...st, presented: time };
        emit();
      }
    },
    reset() {
      pending = null;
      clearTimer();
      st = { requested: null, presented: null, seeking: false, generation: st.generation + 1 };
      emit();
      return st.generation;
    },
    state: () => st,
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

/** Clamp a normalised scroll fraction into the configured video range (C50-T01). */
export function fractionToTime(fraction: number, range: readonly [number, number]): number {
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  return Math.round((range[0] + f * (range[1] - range[0])) * 1e6) / 1e6; // media-time precision, no float noise
}

/** Progress of the viewport through a scroll segment [start, end] in document px; clamped. */
export function scrollFraction(scrollY: number, start: number, end: number): number {
  if (!Number.isFinite(scrollY) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
}

export interface Chapter {
  id: string;
  label: string;
  startTime: number;
  endTime?: number;
  transcriptAnchor?: string;
}

/** Validate chapters: finite, ordered, non-overlapping; a usable video range. */
export function validateChapters(chapters: readonly Chapter[], range: readonly [number, number]): string[] {
  const out: string[] = [];
  if (!Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[1] <= range[0]) out.push("videoRange must be finite with end after start (live/nonfinite media is unsupported for scrubbing).");
  let last = -Infinity;
  for (const c of chapters) {
    if (!Number.isFinite(c.startTime) || (c.endTime !== undefined && (!Number.isFinite(c.endTime) || c.endTime < c.startTime))) out.push(`Chapter "${c.id}" has an invalid time.`);
    else if (c.startTime < last) out.push(`Chapter "${c.id}" overlaps the previous chapter.`);
    else last = c.endTime ?? c.startTime;
  }
  return out;
}

export function activeChapter(chapters: readonly Chapter[], time: number): Chapter | null {
  let active: Chapter | null = null;
  for (const c of chapters) if (time >= c.startTime && (c.endTime === undefined || time < c.endTime || c === chapters[chapters.length - 1])) active = c;
  return active;
}
