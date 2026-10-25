import { describe, expect, it } from "vitest";
import { checkCandidate, createGenerationCounter, sanitizeMaterialParams, selectionFlags, validateGroups, type OptionGroup } from "./finish-options";

export const GROUPS: OptionGroup[] = [
  {
    id: "shell",
    label: "Shell",
    options: [
      { id: "oak", name: "Oak", targets: ["Shell"], material: { color: "#b78d5a", roughness: 0.7 } },
      { id: "walnut", name: "Walnut", targets: ["Shell"], material: { color: "#5a3d2b", roughness: 0.6 } },
      { id: "black", name: "Matte black", targets: ["Shell"], material: { color: "#141311", roughness: 0.9 }, available: false, unavailableReason: "Matte black is out of stock." },
    ],
  },
  {
    id: "trim",
    label: "Trim",
    options: [
      { id: "brass", name: "Brass", targets: ["Trim"], material: { color: "#c8a000", metalness: 1, roughness: 0.3 } },
      { id: "steel", name: "Steel", targets: ["Trim"], material: { color: "#b8b8b8", metalness: 1, roughness: 0.4 }, requires: { shell: ["walnut", "black"] } },
    ],
  },
  {
    id: "fabric",
    label: "Fabric",
    options: [
      { id: "linen", name: "Linen", targets: ["Seat"], material: { color: "#e9e5dc", roughness: 1 } },
      { id: "velvet", name: "Velvet", targets: ["Seat"], material: { color: "#7a1f3d", roughness: 0.8 }, excludes: { trim: ["brass"] } },
    ],
  },
];
export const DEFAULTS = { shell: "oak", trim: "brass", fabric: "linen" };

describe("finish options", () => {
  it("validates groups and defaults", () => {
    expect(validateGroups(GROUPS, DEFAULTS)).toEqual([]);
    expect(validateGroups(GROUPS, { shell: "oak", trim: "nope", fabric: "linen" })).toEqual(['Default "nope" is not an option of group "trim".']);
    expect(validateGroups([{ id: "x", label: "X", options: [{ id: "a", name: "A", targets: [], material: {} }] }], {})).toEqual(['Option "a" declares no targets.', 'No default selection for group "x".']);
  });

  it("explains invalid combinations and unavailable options (C53-T02, C53-T05)", () => {
    expect(checkCandidate(GROUPS, DEFAULTS, "shell", "walnut")).toEqual({ allowed: true });
    expect(checkCandidate(GROUPS, DEFAULTS, "trim", "steel").reason).toBe("Steel requires Shell: Walnut or Matte black.");
    expect(checkCandidate(GROUPS, { ...DEFAULTS, shell: "walnut" }, "trim", "steel")).toEqual({ allowed: true });
    expect(checkCandidate(GROUPS, DEFAULTS, "fabric", "velvet").reason).toBe("Velvet cannot be combined with Brass.");
    expect(checkCandidate(GROUPS, { shell: "walnut", trim: "steel", fabric: "linen" }, "shell", "oak").reason).toBe("Steel requires Shell: Walnut or Matte black.");
    expect(checkCandidate(GROUPS, DEFAULTS, "shell", "black").reason).toBe("Matte black is out of stock.");
    expect(checkCandidate(GROUPS, DEFAULTS, "shell", "zzz").reason).toBe('Unknown option "zzz".');
    const flags = selectionFlags(GROUPS, { shell: "black", trim: "steel", fabric: "velvet" });
    expect(flags.shell!.reason).toBe("Matte black is out of stock.");
    expect(flags.trim).toEqual({ allowed: true });
    expect(flags.fabric!.allowed).toBe(true); // velvet + steel is fine
    expect(selectionFlags(GROUPS, DEFAULTS)).toEqual({ shell: { allowed: true }, trim: { allowed: true }, fabric: { allowed: true } });
  });

  it("allowlists material parameters", () => {
    expect(sanitizeMaterialParams({ color: "#ABCDEF", roughness: 2, metalness: -1, map: "https://x/y.png" })).toEqual({ color: "#abcdef", roughness: 1, metalness: 0, map: "https://x/y.png" });
    expect(sanitizeMaterialParams({ color: "red", map: "javascript:alert(1)" } as never)).toEqual({});
    expect(sanitizeMaterialParams(undefined)).toEqual({});
  });

  it("hands out monotonic generations", () => {
    const g = createGenerationCounter();
    expect(g.next()).toBe(1);
    expect(g.next()).toBe(2);
    expect(g.current()).toBe(2);
  });
});
