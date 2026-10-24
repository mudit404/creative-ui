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
