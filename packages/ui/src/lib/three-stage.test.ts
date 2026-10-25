import { describe, expect, it } from "vitest";
import { cameraPositionFor, clampOrbit } from "./three-stage";

describe("three stage orbit math", () => {
  it("clamps pitch and distance to the limits", () => {
    const s = clampOrbit({ yaw: 0, pitch: 9, distance: 0.1, target: [0, 0, 0] }, { minPitch: -0.2, maxPitch: 1.2, minDistance: 2, maxDistance: 8 });
    expect(s.pitch).toBe(1.2);
    expect(s.distance).toBe(2);
    expect(clampOrbit({ yaw: 1, pitch: -5, distance: 99, target: [0, 0, 0] }).distance).toBe(20);
  });

  it("places the camera on a sphere around the target", () => {
    const [x, y, z] = cameraPositionFor({ yaw: 0, pitch: 0, distance: 5, target: [1, 2, 3] });
    expect([x, y, z]).toEqual([1, 2, 8]);
    const up = cameraPositionFor({ yaw: Math.PI / 2, pitch: Math.PI / 2, distance: 4, target: [0, 0, 0] });
    expect(up[1]).toBeCloseTo(4);
    expect(Math.hypot(up[0], up[2])).toBeCloseTo(0);
  });
});
