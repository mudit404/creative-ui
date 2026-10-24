import { describe, expect, it } from "vitest";
import { StrandField } from "./strand-field";

const body = { x: 200, y: 200, w: 212, h: 60, r: 30 };

function makeField(seed = 3) {
  const f = new StrandField({}, seed);
  f.setBody(body);
  return f;
}

function run(f: StrandField, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) f.update(dt);
}

describe("StrandField", () => {
  it("is idle with no pointer", () => {
    const f = makeField();
    run(f, 0.5);
    expect(f.strands).toHaveLength(0);
    expect(f.isActive()).toBe(false);
  });

  it("launches strands when the pointer comes within reach, and more as it gets closer", () => {
    const f = makeField();
    f.setPointer({ x: 306, y: 200 - 100 }); // 100px above the top edge, inside reach (120)
    run(f, 0.6);
    const live = f.strands.filter((s) => s.kind === "reach");
    expect(live.length).toBeGreaterThanOrEqual(2);
    expect(live.length).toBeLessThanOrEqual(6);
    const far = live.length;
    f.setPointer({ x: 306, y: 200 - 30 });
    run(f, 0.6);
    const near = f.strands.filter((s) => s.kind === "reach" && s.state !== "recoil").length;
    expect(near).toBeGreaterThan(far);
    expect(near).toBe(6);
  });

  it("does not launch beyond reach but fizzes and bows within awareness", () => {
    const f = makeField();
    f.setPointer({ x: 306, y: 200 - 170 });
    run(f, 0.8);
    expect(f.strands.filter((s) => s.kind === "reach")).toHaveLength(0);
    expect(f.fizz.level).toBeGreaterThan(0.05);
    expect(f.bow.y).toBeLessThan(0); // leans upward toward the pointer
    expect(f.isActive()).toBe(true);
  });

  it("lets go and clears when the pointer leaves", () => {
    const f = makeField();
    f.setPointer({ x: 306, y: 150 });
    run(f, 0.6);
    expect(f.strands.length).toBeGreaterThan(0);
    f.setPointer(null);
    run(f, 0.05);
    expect(f.strands.every((s) => s.state === "snap" || s.state === "recoil")).toBe(true);
    run(f, 1.5);
    expect(f.strands).toHaveLength(0);
    expect(f.isActive()).toBe(false);
  });

  it("snaps when stretched past the limit", () => {
    const f = makeField();
    f.setPointer({ x: 306, y: 150 });
    run(f, 0.6);
    const holding = f.strands.filter((s) => s.state === "hold");
    expect(holding.length).toBeGreaterThan(0);
    // yank the pointer far away but still inside awareness
    f.setPointer({ x: 306, y: 200 - 215 });
    run(f, 0.2);
    expect(f.strands.some((s) => s.state === "snap" || s.state === "recoil")).toBe(true);
  });

  it("releases when the pointer lands on the body", () => {
    const f = makeField();
    f.setPointer({ x: 306, y: 150 });
    run(f, 0.6);
    f.setPointer({ x: 306, y: 230 });
    run(f, 0.05);
    expect(f.inside).toBe(true);
    expect(f.strands.every((s) => s.state !== "hold" && s.state !== "launch")).toBe(true);
  });

  it("bursts idle probes that rise and sink within about a second", () => {
    const f = makeField();
    f.burst(3);
    expect(f.strands).toHaveLength(3);
    run(f, 0.3);
    const heights = f.strands.map((s) => Math.hypot(s.tipX - s.root.x, s.tipY - s.root.y));
    expect(Math.max(...heights)).toBeGreaterThan(5);
    run(f, 1.2);
    expect(f.strands).toHaveLength(0);
  });

  it("keeps the strand chain continuous and anchored", () => {
    const f = makeField();
    f.setPointer({ x: 306, y: 150 });
    run(f, 0.5);
    for (const s of f.strands) {
      const seg = s.rest / (s.n - 1);
      for (let i = 1; i < s.n; i++) {
        const d = Math.hypot(s.px[i] - s.px[i - 1], s.py[i] - s.py[i - 1]);
        expect(d).toBeLessThan(seg * 2.2);
      }
      expect(Math.hypot(s.px[0] - s.root.x, s.py[0] - s.root.y)).toBeLessThan(4);
    }
  });

  it("is deterministic for a seed", () => {
    const a = makeField(11);
    const b = makeField(11);
    for (const f of [a, b]) {
      f.setPointer({ x: 306, y: 150 });
      run(f, 0.4);
    }
    expect(a.strands.length).toBe(b.strands.length);
    expect(Array.from(a.strands[0]!.px)).toEqual(Array.from(b.strands[0]!.px));
  });

  it("never produces NaN under extreme input", () => {
    const f = makeField();
    f.setConfig({ reach: 400, maxLength: 1000, maxStrands: 12, speed: 4 });
    for (let i = 0; i < 300; i++) {
      f.setPointer(i % 7 === 0 ? null : { x: 306 + Math.sin(i) * 500, y: 230 + Math.cos(i * 1.3) * 500 });
      f.update(i % 5 === 0 ? 0.3 : 1 / 60);
    }
    for (const s of f.strands) {
      for (let i = 0; i < s.n; i++) {
        expect(Number.isFinite(s.px[i])).toBe(true);
        expect(Number.isFinite(s.py[i])).toBe(true);
      }
    }
  });
});
