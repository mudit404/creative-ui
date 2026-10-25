"use client";

import { useEffect } from "react";

/**
 * Marks the document once the page segment has hydrated. Render it as the last
 * child of every page, not in the root layout: under Next's cacheComponents
 * the page sits inside nested <Activity> boundaries that React hydrates in a
 * later, idle-priority pass, so a root-layout effect would fire while the page
 * is still server markup. Keep it inside the same boundary as the interactive
 * content it vouches for; a future loading.tsx, <Suspense> or next/dynamic
 * boundary needs its own signal.
 *
 * The server never renders the attribute, so `html[data-hydrated="true"]` only
 * exists after the client commit. The e2e fixture waits for it before
 * interacting: a value filled into a not-yet-hydrated controlled input becomes
 * React's change baseline and onChange never fires, which only shows on slow
 * machines.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);
  return null;
}
