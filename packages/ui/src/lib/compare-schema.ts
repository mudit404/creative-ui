/**
 * Attribute normalisation and comparison for CompareWorkbench. Pure and
 * schema-driven: rows come from the declared attribute definitions, never
 * from object-property enumeration. Values carry availability so that
 * false, zero, unknown and not-applicable stay distinct, and values with
 * different units are incomparable rather than "equal".
 */

export type Availability = "known" | "unknown" | "not-applicable";

export interface AttributeValue {
  value?: number | string | boolean | null;
  unit?: string;
  availability?: Availability;
}

export interface AttributeDefinition {
  key: string;
  label: string;
  group?: string;
  /** Expected unit; a value with a different unit is incomparable. */
  unit?: string;
  kind?: "number" | "text" | "boolean";
  /** Custom display. */
  format?: (value: AttributeValue) => string;
  /** Custom equality for two known, same-unit values. */
  equals?: (a: AttributeValue, b: AttributeValue) => boolean;
  /** Numeric tolerance for equality (absolute). */
  tolerance?: number;
}

export interface CompareItem {
  id: string;
  name: string;
  image?: string;
  description?: string;
  attributes: Record<string, AttributeValue | number | string | boolean | null | undefined>;
}

export type CellStatus = "known" | "unknown" | "not-applicable";

export interface CompareCell {
  itemId: string;
  status: CellStatus;
  display: string;
  raw: AttributeValue;
}

export type RowEquality = "equal" | "different" | "incomparable";

export interface CompareRow {
  key: string;
  label: string;
  group: string;
  cells: CompareCell[];
  equality: RowEquality;
}

export interface CompareGroup {
  group: string;
  rows: CompareRow[];
}

/** Accept shorthand primitives in item data and normalise them to AttributeValue. */
export function normalizeValue(raw: CompareItem["attributes"][string], def: AttributeDefinition): AttributeValue {
  if (raw === undefined) return { availability: "unknown" };
  if (raw === null) return { value: null, availability: "unknown" };
  if (typeof raw === "object") {
    const availability = raw.availability ?? (raw.value === undefined || raw.value === null ? "unknown" : "known");
    return { ...raw, availability, unit: raw.unit ?? def.unit };
  }
  return { value: raw, unit: def.unit, availability: "known" };
}

export function formatCell(v: AttributeValue, def: AttributeDefinition): string {
  if (v.availability === "not-applicable") return "n/a";
  if (v.availability === "unknown" || v.value === undefined || v.value === null) return "—";
  if (def.format) return def.format(v);
  if (typeof v.value === "boolean") return v.value ? "Yes" : "No";
  if (typeof v.value === "number") return v.unit ? `${v.value} ${v.unit}` : String(v.value);
  return String(v.value);
}

function cellsEqual(a: AttributeValue, b: AttributeValue, def: AttributeDefinition): boolean {
  if (def.equals) return def.equals(a, b);
  if (typeof a.value === "number" && typeof b.value === "number") {
    return def.tolerance ? Math.abs(a.value - b.value) <= def.tolerance : a.value === b.value;
  }
  if (typeof a.value !== typeof b.value) return false;
  return a.value === b.value;
}

/** Equality of a row across the selected items (C49-T03/T04/T05). */
export function rowEquality(cells: CompareCell[], def: AttributeDefinition): RowEquality {
  if (cells.length < 2) return "incomparable";
  if (cells.some((c) => c.status !== "known")) return "incomparable";
  const units = new Set(cells.map((c) => c.raw.unit ?? ""));
  if (units.size > 1) return "incomparable";
  const first = cells[0]!.raw;
  for (let i = 1; i < cells.length; i++) if (!cellsEqual(first, cells[i]!.raw, def)) return "different";
  return "equal";
}

export function buildRows(items: readonly CompareItem[], attributes: readonly AttributeDefinition[], selectedIds: readonly string[]): CompareRow[] {
  const selected = selectedIds.map((id) => items.find((i) => i.id === id)).filter((i): i is CompareItem => !!i);
  return attributes.map((def) => {
    const cells = selected.map((item) => {
      const raw = normalizeValue(item.attributes[def.key], def);
      return { itemId: item.id, status: raw.availability ?? "known", display: formatCell(raw, def), raw };
    });
    return { key: def.key, label: def.label, group: def.group ?? "", cells, equality: rowEquality(cells, def) };
  });
}

/** Group rows preserving schema order; `differencesOnly` hides only rows proven equal. */
export function groupRows(rows: readonly CompareRow[], differencesOnly: boolean): CompareGroup[] {
  const groups: CompareGroup[] = [];
  for (const row of rows) {
    if (differencesOnly && row.equality === "equal") continue;
    let g = groups.find((x) => x.group === row.group);
    if (!g) {
      g = { group: row.group, rows: [] };
      groups.push(g);
    }
    g.rows.push(row);
  }
  return groups;
}

/** Selection policy: unique, ordered, only existing ids. */
export function sanitizeSelection(ids: readonly string[], items: readonly CompareItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id) || !items.some((i) => i.id === id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
