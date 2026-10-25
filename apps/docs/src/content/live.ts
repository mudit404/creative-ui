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
import { activityCapsuleLive } from "~/content/components/activity-capsule/live";
import { compareWorkbenchLive } from "~/content/components/compare-workbench/live";
import { elasticRangeLive } from "~/content/components/elastic-range/live";
import { detentDialLive } from "~/content/components/detent-dial/live";
import { paletteComposerLive } from "~/content/components/palette-composer/live";
import { decisionDeckLive } from "~/content/components/decision-deck/live";
import { transferBoardLive } from "~/content/components/transfer-board/live";
import { cablePatchbayLive } from "~/content/components/cable-patchbay/live";
import { timeLensLive } from "~/content/components/time-lens/live";
import { continuityChartLive } from "~/content/components/continuity-chart/live";
import { focusGraphLive } from "~/content/components/focus-graph/live";
import { scrollFilmLive } from "~/content/components/scroll-film/live";
import { explodedProductLive } from "~/content/components/exploded-product/live";
import { cutawayViewerLive } from "~/content/components/cutaway-viewer/live";
import { finishConfiguratorLive } from "~/content/components/finish-configurator/live";
import { splitFlapBoardLive } from "~/content/components/split-flap-board/live";
import { particleMorphLive } from "~/content/components/particle-morph/live";
import { asciiMediaLive } from "~/content/components/ascii-media/live";
import { glassKeybedLive } from "~/content/components/glass-keybed/live";
import { dockWorkspaceLive } from "~/content/components/dock-workspace/live";
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
  "activity-capsule": activityCapsuleLive,
  "compare-workbench": compareWorkbenchLive,
  "elastic-range": elasticRangeLive,
  "detent-dial": detentDialLive,
  "palette-composer": paletteComposerLive,
  "decision-deck": decisionDeckLive,
  "transfer-board": transferBoardLive,
  "cable-patchbay": cablePatchbayLive,
  "time-lens": timeLensLive,
  "continuity-chart": continuityChartLive,
  "focus-graph": focusGraphLive,
  "scroll-film": scrollFilmLive,
  "exploded-product": explodedProductLive,
  "cutaway-viewer": cutawayViewerLive,
  "finish-configurator": finishConfiguratorLive,
  "split-flap-board": splitFlapBoardLive,
  "particle-morph": particleMorphLive,
  "ascii-media": asciiMediaLive,
  "glass-keybed": glassKeybedLive,
  "dock-workspace": dockWorkspaceLive,
  "material-button": materialButtonLive,
};

export function getLive(slug: string): LiveModule | undefined {
  return liveModules[slug];
}
