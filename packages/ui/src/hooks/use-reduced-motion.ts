"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

function getSnapshot() {
  return typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Hydration-safe `prefers-reduced-motion` flag. Returns `false` during SSR and
 * the first client render, then the real value. Components should treat the
 * flag as "render the reduced variant" rather than "skip rendering".
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
