"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false on the server and during hydration, true afterwards. No setState-in-effect. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
