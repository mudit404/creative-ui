import { readdirSync, readFileSync } from "node:fs";
import { URL as NodeURL, fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * DECISIONS 018: every colour default a component ships is a `light-dark(<light>, <dark>)` pair, so a
 * consumer who sets `color-scheme: dark` gets readable components without installing any CSS. This
 * test reads the distributed sources and fails when a `var(--token, <colour>)` fallback or an arbitrary
 * Tailwind colour value (`bg-[#…]`, `text-[rgba(…)]`) is a single light value. Deliberate exceptions
 * are listed below with the reason; add to the lists only with a reason that holds on both schemes.
 */

// Node's URL class: under the jsdom environment the global URL is jsdom's and fileURLToPath rejects it.
const DIR = fileURLToPath(new NodeURL("./components/ui/", import.meta.url));

/** Tokens whose one default is correct on both schemes. */
const SCHEME_INDEPENDENT_TOKENS = new Set([
  "--cui-capsule-focus", // acid on the capsule's own dark surface (≥10:1 on both)
  "--cui-capsule-progress",
  "--cui-capsule-error", // #ff6b4a on the capsule surface (≥5.3:1 on both)
  "--cui-ascii-background", // the ASCII canvas is designed dark on both schemes
  "--cui-ascii-foreground",
  "--cui-cut-cap", // Three.js material colour, not a surface colour
  "--cui-deck-shadow", // a shadow
  "--mm-backdrop", // MosaicMenu's full-screen overlay is designed dark on both schemes
  "--mm-foreground",
  "--mm-tile",
  "--cui-film-progress", // acid on the dark film
  "--cui-film-caption-bg", // caption plate over video
]);

/** Arbitrary colour utilities that sit on a fixed-colour fill, per file. */
const FIXED_FILL_LITERALS: Record<string, string[]> = {
  "activity-capsule.tsx": ["text-[#141311]"], // status glyph on the fixed acid / error fills
  "mosaic-menu.tsx": ["focus-visible:ring-offset-[rgba(20,19,17,0.9)]"], // inside the dark overlay
  "palette-composer.tsx": ["text-[#141311]", "bg-[#141311]"], // Locked badge chosen from the swatch's own luminance
};

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\bwhite\b|\bblack\b/;

function varFallbacks(src: string): { name: string; fallback: string; line: number }[] {
  const out: { name: string; fallback: string; line: number }[] = [];
  const re = /var\(\s*(--[a-z0-9-]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = re.lastIndex;
    let depth = 1;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    out.push({
      name: m[1]!,
      fallback: src.slice(start, i - 1).trim(),
      line: src.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

const ARBITRARY =
  /\b(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|outline|accent|decoration|placeholder|ring-offset|border-[trblxy])-\[(?:#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\)|hsla?\([^\]]*\))\]/g;

const files = readdirSync(DIR).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"));

describe("component colour defaults are light-dark() pairs (DECISIONS 018)", () => {
  it("scans every component", () => {
    expect(files.length).toBeGreaterThanOrEqual(30);
  });

  for (const file of files) {
    it(file, () => {
      const src = readFileSync(DIR + file, "utf8");
      const problems: string[] = [];
      for (const v of varFallbacks(src)) {
        if (!COLOUR.test(v.fallback)) continue; // lengths, shadows without colours, etc.
        if (v.fallback.includes("light-dark(")) continue;
        if (SCHEME_INDEPENDENT_TOKENS.has(v.name)) continue;
        problems.push(
          `line ${v.line}: var(${v.name}, ${v.fallback}) has a single-scheme colour default`,
        );
      }
      const allowed = new Set(FIXED_FILL_LITERALS[file] ?? []);
      let m: RegExpExecArray | null;
      ARBITRARY.lastIndex = 0;
      while ((m = ARBITRARY.exec(src))) {
        if (allowed.has(m[0])) continue;
        problems.push(
          `line ${src.slice(0, m.index).split("\n").length}: ${m[0]} is a single-scheme colour`,
        );
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});
