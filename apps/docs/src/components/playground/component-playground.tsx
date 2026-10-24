"use client";

import { Playground } from "~/components/playground/playground";
import { getLive } from "~/content/live";
import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export function ComponentPlayground({
  meta,
  def,
}: {
  meta: Pick<ComponentMeta, "slug" | "name" | "importPath" | "title">;
  def: PlaygroundDef;
}) {
  const live = getLive(meta.slug);
  if (!live) return null;
  return <Playground meta={meta} def={def} render={live.renderPlayground} />;
}
