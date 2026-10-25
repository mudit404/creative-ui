/**
 * Option model for FinishConfigurator. Pure: group/option validation,
 * synchronous compatibility rules with reasons, availability flags on the
 * current selection, an allowlist for material parameters, and a generation
 * counter so late assets cannot overwrite newer finishes.
 */

export interface MaterialParams {
  /** `#rrggbb` */
  color?: string;
  roughness?: number;
  metalness?: number;
  /** Texture URL (http(s), data or blob). */
  map?: string;
}

export interface FinishOption {
  id: string;
  name: string;
  /** Mesh or material names this option applies to. */
  targets: string[];
  material: MaterialParams;
  thumbnail?: string;
  /** Host availability; absent means available. */
  available?: boolean;
  unavailableReason?: string;
  /** groupId → option ids that must be selected for this option. */
  requires?: Record<string, string[]>;
  /** groupId → option ids that cannot be selected together with this option. */
  excludes?: Record<string, string[]>;
  /** Host image for the GPU-disabled fallback. */
  image?: string;
}

export interface OptionGroup {
  id: string;
  label: string;
  options: FinishOption[];
}

export type Selection = Record<string, string>;

export interface Verdict {
  allowed: boolean;
  reason?: string;
}

export function validateGroups(groups: readonly OptionGroup[], defaults: Selection): string[] {
  const out: string[] = [];
  const gids = new Set<string>();
  for (const g of groups) {
    if (gids.has(g.id)) out.push(`Duplicate group id "${g.id}".`);
    gids.add(g.id);
    const oids = new Set<string>();
    for (const o of g.options) {
      if (oids.has(o.id)) out.push(`Group "${g.id}" lists option "${o.id}" twice.`);
      oids.add(o.id);
      if (!o.targets?.length) out.push(`Option "${o.id}" declares no targets.`);
    }
    if (!(g.id in defaults)) out.push(`No default selection for group "${g.id}".`);
    else if (!oids.has(defaults[g.id]!)) out.push(`Default "${defaults[g.id]}" is not an option of group "${g.id}".`);
  }
  return out;
}

export function findOption(groups: readonly OptionGroup[], groupId: string, optionId: string): FinishOption | null {
  return groups.find((g) => g.id === groupId)?.options.find((o) => o.id === optionId) ?? null;
}

/** Synchronous compatibility check before any request (C53-T02). */
export function checkCandidate(groups: readonly OptionGroup[], selection: Selection, groupId: string, optionId: string): Verdict {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return { allowed: false, reason: `Unknown group "${groupId}".` };
  const opt = group.options.find((o) => o.id === optionId);
  if (!opt) return { allowed: false, reason: `Unknown option "${optionId}".` };
  if (opt.available === false) return { allowed: false, reason: opt.unavailableReason ?? `${opt.name} is unavailable.` };
  const next = { ...selection, [groupId]: optionId };
  for (const [gid, ids] of Object.entries(opt.requires ?? {})) {
    if (!ids.includes(next[gid] ?? "")) {
      const names = ids.map((id) => findOption(groups, gid, id)?.name ?? id).join(" or ");
      return { allowed: false, reason: `${opt.name} requires ${groups.find((g) => g.id === gid)?.label ?? gid}: ${names}.` };
    }
  }
  for (const [gid, ids] of Object.entries(opt.excludes ?? {})) {
    if (ids.includes(next[gid] ?? "")) {
      const cur = findOption(groups, gid, next[gid]!);
      return { allowed: false, reason: `${opt.name} cannot be combined with ${cur?.name ?? next[gid]}.` };
    }
  }
  // other groups' current choices may require/exclude this one
  for (const g of groups) {
    if (g.id === groupId) continue;
    const cur = findOption(groups, g.id, next[g.id] ?? "");
    if (!cur) continue;
    const req = cur.requires?.[groupId];
    if (req && !req.includes(optionId)) return { allowed: false, reason: `${cur.name} requires ${group.label}: ${req.map((id) => findOption(groups, groupId, id)?.name ?? id).join(" or ")}.` };
    if (cur.excludes?.[groupId]?.includes(optionId)) return { allowed: false, reason: `${cur.name} cannot be combined with ${opt.name}.` };
  }
  return { allowed: true };
}

/** Flags for the current selection: options that are unavailable or no longer compatible stay selected but flagged (C53-T05). */
export function selectionFlags(groups: readonly OptionGroup[], selection: Selection): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  for (const g of groups) {
    const id = selection[g.id];
    if (!id) {
      out[g.id] = { allowed: false, reason: "Nothing selected." };
      continue;
    }
    const opt = findOption(groups, g.id, id);
    if (!opt) {
      out[g.id] = { allowed: false, reason: `"${id}" is no longer an option.` };
      continue;
    }
    if (opt.available === false) {
      out[g.id] = { allowed: false, reason: opt.unavailableReason ?? `${opt.name} is unavailable.` };
      continue;
    }
    const { [g.id]: _self, ...others } = selection;
    void _self;
    out[g.id] = checkCandidate(groups, others, g.id, id);
  }
  return out;
}

const HEX = /^#[0-9a-f]{6}$/i;
const URL_OK = /^(https?:\/\/|data:image\/|blob:)/;

/** Allowlisted material parameters; anything else is dropped (no shader code, no arbitrary CSS). */
export function sanitizeMaterialParams(p: MaterialParams | undefined): MaterialParams {
  const out: MaterialParams = {};
  if (!p) return out;
  if (typeof p.color === "string" && HEX.test(p.color)) out.color = p.color.toLowerCase();
  if (typeof p.roughness === "number" && Number.isFinite(p.roughness)) out.roughness = Math.max(0, Math.min(1, p.roughness));
  if (typeof p.metalness === "number" && Number.isFinite(p.metalness)) out.metalness = Math.max(0, Math.min(1, p.metalness));
  if (typeof p.map === "string" && URL_OK.test(p.map)) out.map = p.map;
  return out;
}

/** Monotonic generation ids (C53-T03). */
export function createGenerationCounter() {
  let n = 0;
  return { next: () => ++n, current: () => n };
}
