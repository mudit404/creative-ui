import { describe, expect, it } from "vitest";
import { StrandField } from "./strand-field";
import { renderStrandField } from "./strand-renderer";

/**
 * CPU cost of one frame: simulation step + building every canvas draw call,
 * with raster excluded (a no-op context). This is the JavaScript budget the
 * component spends per frame while six strands are held; it is reported in
 * the docs performance section. The assertion is a generous ceiling so CI on
 * slow runners stays green; the printed number is the useful output.
 */
describe("frame cost", () => {
  it("simulates and emits draw calls for six held strands well under a frame budget", () => {
    const f = new StrandField({}, 9);
    f.setBody({ x: 200, y: 200, w: 212, h: 60, r: 30 });
    f.setPointer({ x: 306, y: 150 });
    for (let i = 0; i < 60; i++) f.update(1 / 60);
    expect(f.strands.filter((s) => s.state === "hold").length).toBeGreaterThanOrEqual(4);

    let calls = 0;
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: () => () => {
        calls++;
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const opts = { goo: "#000", highlight: "#fff", shadow: "#000", baseRadius: 1.35 };

    // warm up
    for (let i = 0; i < 30; i++) {
      f.setPointer({ x: 306 + Math.sin(i / 5) * 20, y: 150 });
      f.update(1 / 60);
      renderStrandField(ctx, f, opts);
    }
    const N = 300;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      f.setPointer({ x: 306 + Math.sin(i / 5) * 20, y: 150 + Math.cos(i / 7) * 10 });
      f.update(1 / 60);
      renderStrandField(ctx, f, opts);
    }
    const perFrameMs = (performance.now() - t0) / N;
    console.log(`strand frame cost: ${perFrameMs.toFixed(3)} ms (sim + draw calls, raster excluded), ${Math.round(calls / (N + 30))} ctx calls/frame`);
    expect(perFrameMs).toBeLessThan(4);
  });
});
