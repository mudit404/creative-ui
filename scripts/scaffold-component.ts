/**
 * Scaffold a new component across the whole pipeline.
 *
 *   pnpm scaffold <slug> <ExportName> [--category buttons] [--tier free|premium]
 *   e.g. pnpm scaffold liquid-switch LiquidSwitch --category inputs --tier free
 *
 * Creates:
 *   packages/ui/src/components/ui/<slug>.tsx          component (with the authoring contract)
 *   packages/ui/src/components/ui/<slug>.test.tsx     unit tests
 *   apps/docs/src/content/components/<slug>/meta.ts   docs data + playground schema
 *   apps/docs/src/content/components/<slug>/live.tsx  live renderers
 * and registers the component in:
 *   registry/registry.json, apps/docs/src/content/components/index.ts, apps/docs/src/content/live.ts
 *
 * Routing, the explorer, the playground and the registry build pick the new
 * component up from those registrations: nothing else needs editing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const [slug, name] = args.filter((a) => !a.startsWith("--"));
const flag = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};
const category = flag("category", "buttons");
const tier = flag("tier", "free");

if (!slug || !name || !/^[a-z0-9-]+$/.test(slug) || !/^[A-Z][A-Za-z0-9]+$/.test(name)) {
  console.error("usage: pnpm scaffold <kebab-slug> <PascalName> [--category c] [--tier free|premium]");
  process.exit(1);
}

const title = name.replace(/([a-z])([A-Z])/g, "$1 $2");
const camel = name[0]!.toLowerCase() + name.slice(1);

function write(rel: string, content: string) {
  const abs = join(ROOT, rel);
  if (existsSync(abs)) {
    console.error(`✖ exists: ${rel}`);
    process.exit(1);
  }
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
  console.log(`+ ${rel}`);
}

function patch(rel: string, find: string, insert: string) {
  const abs = join(ROOT, rel);
  const src = readFileSync(abs, "utf8");
  if (!src.includes(find)) {
    console.error(`✖ could not find anchor in ${rel}: ${find}`);
    process.exit(1);
  }
  writeFileSync(abs, src.replace(find, insert + find));
  console.log(`~ ${rel}`);
}

write(
  `packages/ui/src/components/ui/${slug}.tsx`,
  `"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type ${name}Motion = "auto" | "reduced" | "off";

export interface ${name}Props extends React.HTMLAttributes<HTMLDivElement> {
  /** \`auto\` follows prefers-reduced-motion. */
  motion?: ${name}Motion;
}

/**
 * ${title}
 *
 * Authoring contract (see documentation/COMPONENT_CONTRACT.md):
 * - real semantics first; the control works with motion off
 * - no work when idle; clean up every listener, frame and timer
 * - CSS variables (--${slug.split("-").map((p) => p[0]).join("")}-*) for theming, className for the control
 * - hydration safe; nothing touches window during render
 */
export const ${name} = React.forwardRef<HTMLDivElement, ${name}Props>(function ${name}(
  { motion = "auto", className, children, ...rest },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  return (
    <div ref={ref} data-slot="${slug}" data-motion={mode} className={cn("relative inline-block", className)} {...rest}>
      {children}
    </div>
  );
});

${name}.displayName = "${name}";
`,
);

write(
  `packages/ui/src/components/ui/${slug}.test.tsx`,
  `import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ${name} } from "./${slug}";

describe("${name}", () => {
  it("renders children", () => {
    render(<${name}>Hello</${name}>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("exposes its motion mode", () => {
    const { container } = render(<${name} motion="off">x</${name}>);
    expect(container.querySelector('[data-slot="${slug}"]')).toHaveAttribute("data-motion", "off");
  });
});
`,
);

write(
  `apps/docs/src/content/components/${slug}/meta.ts`,
  `import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const ${camel}Meta: ComponentMeta = {
  slug: "${slug}",
  name: "${name}",
  title: "${title}",
  tagline: "One sentence on what it does.",
  description: "A paragraph on purpose, behaviour and where it fits.",
  category: "${category}",
  tier: "${tier}",
  status: "experimental",
  version: "0.1.0",
  keywords: [],
  registryName: "${slug}",
  importPath: "@/components/ui/${slug}",
  dependencies: { npm: ["clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion"] },
  props: [
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "Motion mode." },
  ],
  cssVars: [],
  examples: [
    { id: "basic", title: "Basic", description: "Default usage.", code: \`<${name}>Hello</${name}>\` },
  ],
  sections: [
    { id: "accessibility", title: "Accessibility", body: "- Describe keyboard, focus and reduced-motion behaviour." },
    { id: "performance", title: "Performance", body: "Describe what runs when, and what was measured." },
    { id: "limitations", title: "Known limitations", body: "- Be honest." },
  ],
  sourceFiles: ["components/ui/${slug}.tsx"],
  provenance: "Original implementation. List references and licences of anything it draws on.",
};

export const ${camel}Playground: PlaygroundDef = {
  childrenProp: "children",
  initial: { children: "Hello" },
  defaults: { motion: "auto" },
  controls: [{ type: "text", prop: "children", label: "Content", group: "Content" }],
  presets: [],
};
`,
);

write(
  `apps/docs/src/content/components/${slug}/live.tsx`,
  `"use client";

import { ${name} } from "@/components/ui/${slug}";
import type { LiveModule } from "~/content/live-types";

export const ${camel}Live: LiveModule = {
  renderPlayground: (values) => <${name} {...(values as Record<string, unknown>)}>{String(values.children ?? "")}</${name}>,
  cardPreview: () => <${name}>Hello</${name}>,
  examples: {
    basic: () => <${name}>Hello</${name}>,
  },
};
`,
);

patch(
  "apps/docs/src/content/components/index.ts",
  "import type { PlaygroundDef }",
  `import { ${camel}Meta, ${camel}Playground } from "~/content/components/${slug}/meta";\n`,
);
// a roadmap placeholder for this slug becomes the real entry
{
  const abs = join(ROOT, "apps/docs/src/content/components/index.ts");
  const src = readFileSync(abs, "utf8");
  const re = new RegExp(`^\\s*planned\\("${slug}",[^\\n]*\\n`, "m");
  if (re.test(src)) {
    writeFileSync(abs, src.replace(re, ""));
    console.log(`~ removed planned placeholder for ${slug}`);
  }
}
patch("apps/docs/src/content/components/index.ts", "  materialButtonMeta,\n];", `  ${camel}Meta,\n`);
patch("apps/docs/src/content/components/index.ts", '  "material-button": materialButtonPlayground,\n};', `  "${slug}": ${camel}Playground,\n`);
patch(
  "apps/docs/src/content/live.ts",
  "import { materialButtonLive }",
  `import { ${camel}Live } from "~/content/components/${slug}/live";\n`,
);
patch("apps/docs/src/content/live.ts", '  "material-button": materialButtonLive,\n};', `  "${slug}": ${camel}Live,\n`);

const registryPath = join(ROOT, "registry", "registry.json");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
registry.items.push({
  name: slug,
  type: "registry:ui",
  title,
  description: "One sentence on what it does.",
  dependencies: ["clsx", "tailwind-merge"],
  registryDependencies: ["utils", "use-reduced-motion"],
  files: [{ path: `packages/ui/src/components/ui/${slug}.tsx`, type: "registry:ui" }],
  meta: { tier, status: "experimental", version: "0.1.0", docs: `/components/${slug}` },
});
writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.log("~ registry/registry.json");

console.log(`
✓ scaffolded ${name}. Next:
  1. implement packages/ui/src/components/ui/${slug}.tsx and its tests
  2. fill in apps/docs/src/content/components/${slug}/meta.ts (props, examples, sections)
  3. add live renderers in live.tsx for every example id
  4. pnpm build:registry && pnpm dev → /components/${slug}
`);
