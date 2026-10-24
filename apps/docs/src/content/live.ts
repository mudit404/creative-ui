"use client";

import type { LiveModule } from "~/content/live-types";
import { liquidSwitchLive } from "~/content/components/liquid-switch/live";
import { adaptiveRailLive } from "~/content/components/adaptive-rail/live";
import { ghostTraceTextLive } from "~/content/components/ghost-trace-text/live";
import { orbitalMenuLive } from "~/content/components/orbital-menu/live";
import { elasticGridLive } from "~/content/components/elastic-grid/live";
import { expandingProductGridLive } from "~/content/components/expanding-product-grid/live";
import { flowStackGalleryLive } from "~/content/components/flow-stack-gallery/live";
import { mosaicMenuLive } from "~/content/components/mosaic-menu/live";
import { materialButtonLive } from "~/content/components/material-button/live";
import { fieldMagnetLive } from "~/content/components/field-magnet/live";

/**
 * slug → live module. Adding a component means adding one line here
 * (the scaffold script does it for you).
 */
export const liveModules: Record<string, LiveModule> = {
  "field-magnet": fieldMagnetLive,
  "liquid-switch": liquidSwitchLive,
  "adaptive-rail": adaptiveRailLive,
  "ghost-trace-text": ghostTraceTextLive,
  "orbital-menu": orbitalMenuLive,
  "elastic-grid": elasticGridLive,
  "expanding-product-grid": expandingProductGridLive,
  "flow-stack-gallery": flowStackGalleryLive,
  "mosaic-menu": mosaicMenuLive,
  "material-button": materialButtonLive,
};

export function getLive(slug: string): LiveModule | undefined {
  return liveModules[slug];
}
