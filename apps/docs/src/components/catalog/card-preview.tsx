"use client";

import { getLive } from "~/content/live";

export function CardPreview({ slug }: { slug: string }) {
  const live = getLive(slug);
  if (!live) return null;
  return <div className="pointer-events-auto">{live.cardPreview()}</div>;
}
