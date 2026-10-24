/**
 * Small, dependency-free motion math shared by creative-ui primitives.
 * Everything here is pure and safe to run on the server or in a worker.
 */

export interface SpringState {
  value: number;
  velocity: number;
}

/**
 * Advance a damped harmonic oscillator by `dt` seconds.
 * `omega` is the natural frequency (rad/s), `zeta` the damping ratio
 * (1 = critically damped, < 1 overshoots, > 1 sluggish).
 */
export function stepSpring(
  s: SpringState,
  target: number,
  omega: number,
  zeta: number,
  dt: number,
): void {
  const accel = -2 * zeta * omega * s.velocity - omega * omega * (s.value - target);
  s.velocity += accel * dt;
  s.value += s.velocity * dt;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothstep between edges; returns 0 at `from`, 1 at `to`, clamped. */
export function ease(from: number, to: number, x: number): number {
  const t = clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;

/** Deterministic PRNG (mulberry32) so simulations can be replayed in tests. */
export function createRng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randBetween = (rng: () => number, min: number, max: number) => min + (max - min) * rng();
