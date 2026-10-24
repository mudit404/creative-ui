import { describe, expect, it, vi } from "vitest";
import { StrandField } from "./strand-field";
import { renderStrandField } from "./strand-renderer";

function fakeCtx() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, key: string) {
      return (..._args: unknown[]) => {
        calls.push(key);
      };
    },
    set() {
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("renderStrandField", () => {
  it("draws nothing for an idle field", () => {
    const f = new StrandField();
    const { ctx, calls } = fakeCtx();
    renderStrandField(ctx, f, { goo: "#000", highlight: "#fff", shadow: "#000", baseRadius: 1.7 });
    expect(calls.filter((c) => c === "fill" || c === "stroke")).toHaveLength(0);
  });

  it("fills ribbons, fillets and highlights for active strands", () => {
    const f = new StrandField({}, 5);
    f.setBody({ x: 200, y: 200, w: 212, h: 60, r: 30 });
    f.setPointer({ x: 306, y: 150 });
    for (let i = 0; i < 40; i++) f.update(1 / 60);
    const { ctx, calls } = fakeCtx();
    const spy = vi.fn();
    void spy;
    renderStrandField(ctx, f, { goo: "#000", highlight: "#fff", shadow: "#000", baseRadius: 1.7 });
    expect(calls.filter((c) => c === "fill").length).toBeGreaterThan(f.strands.length);
    expect(calls.filter((c) => c === "stroke").length).toBeGreaterThan(0);
  });
});
