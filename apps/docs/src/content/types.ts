/**
 * Content model for the documentation site. Everything in this file is plain
 * data so it can be read by server components, the registry build and tests.
 * Live parts (playground renderers, example components) live in `live.tsx`
 * files and are joined to this data by slug on the client.
 */

export type ComponentCategory =
  | "buttons"
  | "inputs"
  | "navigation"
  | "text"
  | "layout"
  | "media"
  | "primitives";

export type ComponentTier = "free" | "premium";
export type ComponentStatus = "stable" | "experimental" | "planned";

export interface PropDoc {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export interface ExampleDoc {
  id: string;
  title: string;
  description: string;
  /** Source shown under the live example. Must match the live renderer in `live.tsx`. */
  code: string;
}

export interface DocSection {
  id: string;
  title: string;
  /** Markdown-lite: paragraphs separated by blank lines, `-` bullets, inline code with backticks. */
  body: string;
}

export interface ComponentMeta {
  slug: string;
  /** Exported symbol, e.g. `MaterialButton`. */
  name: string;
  /** Human title, e.g. `Material Button`. */
  title: string;
  tagline: string;
  description: string;
  category: ComponentCategory;
  tier: ComponentTier;
  status: ComponentStatus;
  version: string;
  keywords: string[];
  /** Registry item name (`/r/<name>.json`). Absent for planned components. */
  registryName?: string;
  /** Path of the component file within the consumer project. */
  importPath?: string;
  dependencies: { npm: string[]; registry: string[] };
  props: PropDoc[];
  cssVars: { name: string; description: string; default: string }[];
  examples: ExampleDoc[];
  sections: DocSection[];
  /** Files (relative to packages/ui/src) shown in the Source view. */
  sourceFiles: string[];
  /** Reference and license notes. */
  provenance: string;
}

/* ── playground ── */

export type ControlDef =
  | { type: "select"; prop: string; label: string; options: { label: string; value: string }[]; group?: string }
  | { type: "boolean"; prop: string; label: string; group?: string }
  | { type: "range"; prop: string; label: string; min: number; max: number; step: number; unit?: string; group?: string }
  | { type: "text"; prop: string; label: string; placeholder?: string; group?: string }
  | { type: "color"; prop: string; label: string; group?: string };

export interface PlaygroundPreset {
  name: string;
  description?: string;
  values: Record<string, unknown>;
}

export interface PlaygroundDef {
  /** Prop values when the playground loads; omitted props use component defaults. */
  initial: Record<string, unknown>;
  /** Component defaults, used to omit props from generated code. */
  defaults: Record<string, unknown>;
  controls: ControlDef[];
  presets: PlaygroundPreset[];
  /** Prop that carries the text content (rendered as children). */
  childrenProp?: string;
}
