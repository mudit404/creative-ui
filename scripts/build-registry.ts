/**
 * Builds the public shadcn-compatible registry.
 *
 *   pnpm build:registry            → writes apps/docs/public/r/*.json
 *   pnpm check:registry            → validates without writing (CI)
 *
 * Reads registry/registry.json, inlines file contents from packages/ui/src,
 * resolves internal registryDependencies to absolute item URLs (shadcn/ui
 * names like "utils" are left as-is so the CLI resolves them from ui.shadcn.com),
 * validates against the official JSON schemas (fetched once, cached in
 * node_modules/.cache) and emits one JSON per item plus the index.
 *
 * Set REGISTRY_URL (or NEXT_PUBLIC_SITE_URL) to the public site origin when
 * building for deployment.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { z } from "zod";

const ROOT = resolve(import.meta.dirname, "..");
const REGISTRY_SRC = join(ROOT, "registry", "registry.json");
const OUT_DIR = join(ROOT, "apps", "docs", "public", "r");
const CHECK_ONLY = process.argv.includes("--check");
const BASE_URL = (process.env.REGISTRY_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const fileSchema = z.object({
  path: z.string(),
  type: z.string(),
  target: z.string().optional(),
  content: z.string().optional(),
});

const itemSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum([
    "registry:lib",
    "registry:block",
    "registry:component",
    "registry:ui",
    "registry:hook",
    "registry:theme",
    "registry:page",
    "registry:file",
    "registry:style",
    "registry:base",
    "registry:item",
  ]),
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  files: z.array(fileSchema).optional(),
  cssVars: z.record(z.string(), z.unknown()).optional(),
  css: z.record(z.string(), z.unknown()).optional(),
  categories: z.array(z.string()).optional(),
  docs: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const registrySchema = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  homepage: z.string(),
  items: z.array(itemSchema),
});

type Item = z.infer<typeof itemSchema>;

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function main() {
  const raw = JSON.parse(readFileSync(REGISTRY_SRC, "utf8"));
  const parsed = registrySchema.safeParse(raw);
  if (!parsed.success) fail(`registry.json invalid:\n${parsed.error.message}`);
  const registry = parsed.data;
  const names = new Set(registry.items.map((i) => i.name));

  const built: Item[] = registry.items.map((item) => {
    const files = (item.files ?? []).map((f) => {
      const abs = join(ROOT, f.path);
      if (!existsSync(abs)) fail(`${item.name}: missing file ${f.path}`);
      const content = readFileSync(abs, "utf8");
      if (/from ["']~\//.test(content)) fail(`${item.name}: ${f.path} imports a docs-only alias (~/)`);
      // shadcn installs by basename + type; keep the import-friendly relative path
      const rel = f.path.replace(/^packages\/ui\/src\//, "");
      return { path: rel, type: f.type, ...(f.target ? { target: f.target } : {}), content };
    });
    const registryDependencies = item.registryDependencies?.map((dep) =>
      names.has(dep) ? `${BASE_URL}/r/${dep}.json` : dep,
    );
    // check that every @/ import maps to a declared dependency or a shadcn/ui item
    for (const f of files) {
      for (const m of f.content.matchAll(/from ["']@\/([\w/-]+)["']/g)) {
        const target = basename(m[1]!);
        const satisfied =
          (item.files ?? []).some((x) => basename(x.path).replace(/\.tsx?$/, "") === target) ||
          (item.registryDependencies ?? []).some((d) => d === target || d.endsWith(`/${target}.json`)) ||
          transitive(registry.items, item, target);
        if (!satisfied) fail(`${item.name}: ${f.path} imports @/${m[1]} which is not a declared registryDependency`);
      }
    }
    return {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      ...item,
      ...(registryDependencies ? { registryDependencies } : {}),
      files,
    } as Item;
  });

  const index = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: registry.name,
    homepage: BASE_URL,
    items: built.map(({ files, ...rest }) => ({
      ...rest,
      files: files?.map(({ content: _c, ...f }) => f),
    })),
  };

  if (CHECK_ONLY) {
    console.log(`✓ registry valid: ${built.length} items`);
    return;
  }

  if (existsSync(OUT_DIR)) {
    for (const f of readdirSync(OUT_DIR)) if (f.endsWith(".json")) rmSync(join(OUT_DIR, f));
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const item of built) {
    writeFileSync(join(OUT_DIR, `${item.name}.json`), JSON.stringify(item, null, 2) + "\n");
  }
  writeFileSync(join(OUT_DIR, "registry.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(`✓ wrote ${built.length} items to apps/docs/public/r (base ${BASE_URL})`);
}

/** Does `item` reach `target` through its registryDependencies (transitively)? */
function transitive(items: Item[], item: Item, target: string, seen = new Set<string>()): boolean {
  for (const dep of item.registryDependencies ?? []) {
    if (seen.has(dep)) continue;
    seen.add(dep);
    const found = items.find((i) => i.name === dep);
    if (!found) {
      if (dep === target) return true; // shadcn/ui item such as "utils"
      continue;
    }
    if ((found.files ?? []).some((f) => basename(f.path).replace(/\.tsx?$/, "") === target)) return true;
    if (transitive(items, found, target, seen)) return true;
  }
  return false;
}

main();
