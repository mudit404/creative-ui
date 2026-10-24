"use client";

import { useEffect, useState, type RefObject } from "react";

export type ScrollDirection = "up" | "down" | "idle";

export interface ScrollDirectionState {
  direction: ScrollDirection;
  /** Scrolled to (or within `threshold` of) the start. */
  atStart: boolean;
}

export interface UseScrollDirectionOptions {
  /** Minimum movement (px) between events to count as a direction change. */
  threshold?: number;
  /** Milliseconds without scroll events before the direction becomes "idle". */
  idleMs?: number;
  /** Observe a scrollable element instead of the window. */
  container?: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

/**
 * Direction of the last meaningful scroll movement, settling to "idle" when
 * scrolling stops. Re-renders only when the state changes, not per event.
 */
export function useScrollDirection({
  threshold = 6,
  idleMs = 160,
  container,
  enabled = true,
}: UseScrollDirectionOptions = {}): ScrollDirectionState {
  const [state, setState] = useState<ScrollDirectionState>({ direction: "idle", atStart: true });

  useEffect(() => {
    if (!enabled) return;
    const el = container ? container.current : null;
    if (container && !el) return;
    const target: HTMLElement | Window = el ?? window;
    const read = () => (el ? el.scrollTop : window.scrollY);

    let last = read();
    let current: ScrollDirectionState = { direction: "idle", atStart: last <= threshold };
    let idleTimer: ReturnType<typeof setTimeout> | 0 = 0;
    const commit = (next: ScrollDirectionState) => {
      if (next.direction === current.direction && next.atStart === current.atStart) return;
      current = next;
      setState(next);
    };
    commit(current);

    const onScroll = () => {
      const y = read();
      const delta = y - last;
      const atStart = y <= threshold;
      if (Math.abs(delta) >= threshold) {
        commit({ direction: delta > 0 ? "down" : "up", atStart });
        last = y;
      } else if (atStart !== current.atStart) {
        commit({ ...current, atStart });
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idleTimer = 0;
        commit({ direction: "idle", atStart: read() <= threshold });
      }, idleMs);
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [container, enabled, threshold, idleMs]);

  return state;
}
