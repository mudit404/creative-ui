import { describe, expect, it } from "vitest";
import { buildRows, groupRows, sanitizeSelection, type AttributeDefinition, type CompareItem } from "./compare-schema";

const attributes: AttributeDefinition[] = [
  { key: "weight", label: "Weight", group: "Specs", unit: "g", kind: "number" },
  { key: "wifi", label: "Wi-Fi", group: "Specs", kind: "boolean" },
  { key: "ports", label: "Ports", group: "Specs", kind: "number" },
  { key: "price", label: "Price", group: "Price", unit: "USD", kind: "number", tolerance: 0.01 },
];

const items: CompareItem[] = [
  { id: "a", name: "A", attributes: { weight: 500, wifi: false, ports: 0, price: 99.99 } },
  { id: "b", name: "B", attributes: { weight: { value: 500, unit: "oz" }, wifi: { availability: "unknown" }, ports: 0, price: 99.995 } },
  { id: "c", name: "C", attributes: { weight: 500, wifi: { availability: "not-applicable" }, ports: 2, price: { value: 99.99, unit: "EUR" } } },
];

describe("compare schema", () => {
  it("builds rows from the schema in order with normalised cells", () => {
    const rows = buildRows(items, attributes, ["a", "b"]);
    expect(rows.map((r) => r.key)).toEqual(["weight", "wifi", "ports", "price"]);
    expect(rows[0]!.cells[0]!.display).toBe("500 g");
    expect(rows[0]!.cells[1]!.display).toBe("500 oz");
    expect(rows[1]!.cells[0]!.display).toBe("No");
    expect(rows[1]!.cells[1]!.display).toBe("—");
  });

  it("does not treat matching numbers with different units as equal (C49-T03)", () => {
    const rows = buildRows(items, attributes, ["a", "b"]);
    expect(rows[0]!.equality).toBe("incomparable");
    const same = buildRows(items, attributes, ["a", "c"]);
    expect(same[0]!.equality).toBe("equal");
    expect(same[3]!.equality).toBe("incomparable"); // USD vs EUR
  });

  it("keeps false, zero, unknown and not-applicable distinct (C49-T04)", () => {
    const rows = buildRows(items, attributes, ["a", "b", "c"]);
    const wifi = rows[1]!;
    expect(wifi.cells.map((c) => c.status)).toEqual(["known", "unknown", "not-applicable"]);
    expect(wifi.cells.map((c) => c.display)).toEqual(["No", "—", "n/a"]);
    expect(wifi.equality).toBe("incomparable");
    const ports = rows[2]!;
    expect(ports.cells.map((c) => c.display)).toEqual(["0", "0", "2"]);
    expect(ports.equality).toBe("different");
    expect(buildRows(items, attributes, ["a", "b"])[2]!.equality).toBe("equal");
  });

  it("applies numeric tolerance", () => {
    const rows = buildRows(items, attributes, ["a", "b"]);
    expect(rows[3]!.equality).toBe("equal"); // 99.99 vs 99.995 within 0.01
  });

  it("differences-only hides only proven-equal rows (C49-T05)", () => {
    const rows = buildRows(items, attributes, ["a", "b"]);
    const groups = groupRows(rows, true);
    const keys = groups.flatMap((g) => g.rows.map((r) => r.key));
    expect(keys).toContain("weight"); // incomparable stays
    expect(keys).toContain("wifi"); // unknown stays
    expect(keys).not.toContain("ports"); // equal hidden
    expect(keys).not.toContain("price");
    expect(groupRows(rows, false).map((g) => g.group)).toEqual(["Specs", "Price"]);
  });

  it("sanitises selections against available items", () => {
    expect(sanitizeSelection(["b", "zzz", "a", "b"], items)).toEqual(["b", "a"]);
  });
});
