import type { ComponentMeta } from "~/content/types";
import { materialButtonMeta, materialButtonPlayground } from "~/content/components/material-button/meta";
import { liquidSwitchMeta, liquidSwitchPlayground } from "~/content/components/liquid-switch/meta";
import { adaptiveRailMeta, adaptiveRailPlayground } from "~/content/components/adaptive-rail/meta";
import { ghostTraceTextMeta, ghostTraceTextPlayground } from "~/content/components/ghost-trace-text/meta";
import { orbitalMenuMeta, orbitalMenuPlayground } from "~/content/components/orbital-menu/meta";
import { elasticGridMeta, elasticGridPlayground } from "~/content/components/elastic-grid/meta";
import { expandingProductGridMeta, expandingProductGridPlayground } from "~/content/components/expanding-product-grid/meta";
import { flowStackGalleryMeta, flowStackGalleryPlayground } from "~/content/components/flow-stack-gallery/meta";
import { mosaicMenuMeta, mosaicMenuPlayground } from "~/content/components/mosaic-menu/meta";
import { activityCapsuleMeta, activityCapsulePlayground } from "~/content/components/activity-capsule/meta";
import { compareWorkbenchMeta, compareWorkbenchPlayground } from "~/content/components/compare-workbench/meta";
import { elasticRangeMeta, elasticRangePlayground } from "~/content/components/elastic-range/meta";
import { detentDialMeta, detentDialPlayground } from "~/content/components/detent-dial/meta";
import { paletteComposerMeta, paletteComposerPlayground } from "~/content/components/palette-composer/meta";
import { decisionDeckMeta, decisionDeckPlayground } from "~/content/components/decision-deck/meta";
import { transferBoardMeta, transferBoardPlayground } from "~/content/components/transfer-board/meta";
import { cablePatchbayMeta, cablePatchbayPlayground } from "~/content/components/cable-patchbay/meta";
import { timeLensMeta, timeLensPlayground } from "~/content/components/time-lens/meta";
import { continuityChartMeta, continuityChartPlayground } from "~/content/components/continuity-chart/meta";
import { focusGraphMeta, focusGraphPlayground } from "~/content/components/focus-graph/meta";
import { scrollFilmMeta, scrollFilmPlayground } from "~/content/components/scroll-film/meta";
import { explodedProductMeta, explodedProductPlayground } from "~/content/components/exploded-product/meta";
import { cutawayViewerMeta, cutawayViewerPlayground } from "~/content/components/cutaway-viewer/meta";
import { finishConfiguratorMeta, finishConfiguratorPlayground } from "~/content/components/finish-configurator/meta";
import { splitFlapBoardMeta, splitFlapBoardPlayground } from "~/content/components/split-flap-board/meta";
import { particleMorphMeta, particleMorphPlayground } from "~/content/components/particle-morph/meta";
import { asciiMediaMeta, asciiMediaPlayground } from "~/content/components/ascii-media/meta";
import { glassKeybedMeta, glassKeybedPlayground } from "~/content/components/glass-keybed/meta";
import { dockWorkspaceMeta, dockWorkspacePlayground } from "~/content/components/dock-workspace/meta";
import type { PlaygroundDef } from "~/content/types";
import { fieldMagnetMeta, fieldMagnetPlayground } from "~/content/components/field-magnet/meta";

/**
 * Catalog. Every component carries a registry item and a live module. Order =
 * roadmap order. A roadmap placeholder can be added back as a "planned" entry
 * (status: "planned", no registryName) and the scaffold replaces it.
 */
export const components: ComponentMeta[] = [
  fieldMagnetMeta,
  liquidSwitchMeta,
  adaptiveRailMeta,
  ghostTraceTextMeta,
  orbitalMenuMeta,
  elasticGridMeta,
  expandingProductGridMeta,
  flowStackGalleryMeta,
  mosaicMenuMeta,
  activityCapsuleMeta,
  compareWorkbenchMeta,
  elasticRangeMeta,
  detentDialMeta,
  paletteComposerMeta,
  decisionDeckMeta,
  transferBoardMeta,
  cablePatchbayMeta,
  timeLensMeta,
  continuityChartMeta,
  focusGraphMeta,
  scrollFilmMeta,
  explodedProductMeta,
  cutawayViewerMeta,
  finishConfiguratorMeta,
  splitFlapBoardMeta,
  particleMorphMeta,
  asciiMediaMeta,
  glassKeybedMeta,
  dockWorkspaceMeta,
  materialButtonMeta,
];

export const playgrounds: Record<string, PlaygroundDef> = {
  "field-magnet": fieldMagnetPlayground,
  "liquid-switch": liquidSwitchPlayground,
  "adaptive-rail": adaptiveRailPlayground,
  "ghost-trace-text": ghostTraceTextPlayground,
  "orbital-menu": orbitalMenuPlayground,
  "elastic-grid": elasticGridPlayground,
  "expanding-product-grid": expandingProductGridPlayground,
  "flow-stack-gallery": flowStackGalleryPlayground,
  "mosaic-menu": mosaicMenuPlayground,
  "activity-capsule": activityCapsulePlayground,
  "compare-workbench": compareWorkbenchPlayground,
  "elastic-range": elasticRangePlayground,
  "detent-dial": detentDialPlayground,
  "palette-composer": paletteComposerPlayground,
  "decision-deck": decisionDeckPlayground,
  "transfer-board": transferBoardPlayground,
  "cable-patchbay": cablePatchbayPlayground,
  "time-lens": timeLensPlayground,
  "continuity-chart": continuityChartPlayground,
  "focus-graph": focusGraphPlayground,
  "scroll-film": scrollFilmPlayground,
  "exploded-product": explodedProductPlayground,
  "cutaway-viewer": cutawayViewerPlayground,
  "finish-configurator": finishConfiguratorPlayground,
  "split-flap-board": splitFlapBoardPlayground,
  "particle-morph": particleMorphPlayground,
  "ascii-media": asciiMediaPlayground,
  "glass-keybed": glassKeybedPlayground,
  "dock-workspace": dockWorkspacePlayground,
  "material-button": materialButtonPlayground,
};

export function getComponent(slug: string): ComponentMeta | undefined {
  return components.find((c) => c.slug === slug);
}

export const implementedComponents = components.filter((c) => c.status !== "planned");

export const categoryLabels: Record<ComponentMeta["category"], string> = {
  buttons: "Buttons",
  inputs: "Inputs",
  navigation: "Navigation",
  text: "Text",
  layout: "Layout",
  media: "Media",
  primitives: "Primitives",
};
