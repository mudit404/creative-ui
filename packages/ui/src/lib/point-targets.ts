/**
 * Point targets for ParticleMorph. Deterministic sampling of an alpha mask
 * or a precomputed cloud into a fixed-length Float32Array, normalised to a
 * common box, ordered along a Morton (Z-order) curve so two targets pair by
 * spatial position, and an analytic interpolation with seeded curved paths
 * that can be evaluated at any time without state. Pure; no WebGL.
 */

export interface PreparedTarget {
  id: string;
  /** xyz triples, length = count × 3, in a −1…1 box. */
  positions: Float32Array;
  /** rgb triples, length = count × 3, 0…1. */
  colors: Float32Array;
  count: number;
}

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Interleave 10-bit x/y (and z) into a Morton code. */
function morton(x: number, y: number, z = 0): number {
  const part = (v: number) => {
    let n = Math.max(0, Math.min(1023, Math.floor(v * 1023))) >>> 0;
    n = (n | (n << 16)) & 0x030000ff;
    n = (n | (n << 8)) & 0x0300f00f;
    n = (n | (n << 4)) & 0x030c30c3;
    n = (n | (n << 2)) & 0x09249249;
    return n;
  };
  return part(x) | (part(y) << 1) | (part(z) << 2);
}

/** Sort point indices along the Z-order curve of their normalised positions (stable spatial pairing, C54-T02). */
export function mortonOrder(positions: Float32Array, count: number): Uint32Array {
  const keys = new Array<number>(count);
  for (let i = 0; i < count; i++) keys[i] = morton((positions[i * 3]! + 1) / 2, (positions[i * 3 + 1]! + 1) / 2, (positions[i * 3 + 2]! + 1) / 2);
  const idx = Uint32Array.from({ length: count }, (_, i) => i);
  idx.sort((a, b) => keys[a]! - keys[b]! || a - b);
  return idx;
}

function reorder(positions: Float32Array, colors: Float32Array, order: Uint32Array): { positions: Float32Array; colors: Float32Array } {
  const p = new Float32Array(positions.length);
  const c = new Float32Array(colors.length);
  order.forEach((src, dst) => {
    p[dst * 3] = positions[src * 3]!;
    p[dst * 3 + 1] = positions[src * 3 + 1]!;
    p[dst * 3 + 2] = positions[src * 3 + 2]!;
    c[dst * 3] = colors[src * 3]!;
    c[dst * 3 + 1] = colors[src * 3 + 1]!;
    c[dst * 3 + 2] = colors[src * 3 + 2]!;
  });
  return { positions: p, colors: c };
}

/**
 * Sample `count` points from the non-transparent pixels of an RGBA mask,
 * deterministically by seed, normalised to a −1…1 box that preserves the
 * mask's aspect ratio. Returns null when the mask is empty (C54-T05).
 */
export function sampleMask(mask: { data: Uint8ClampedArray; width: number; height: number }, count: number, seed = 1, alphaThreshold = 0.5): PreparedTarget | null {
  const { data, width, height } = mask;
  const alphaMin = Math.round(alphaThreshold * 255);
  const candidates: number[] = [];
  for (let i = 0; i < width * height; i++) if (data[i * 4 + 3]! >= alphaMin) candidates.push(i);
  if (!candidates.length) return null;
  const rand = rng(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scale = 2 / Math.max(width, height);
  const ox = (width * scale) / 2;
  const oy = (height * scale) / 2;
  for (let k = 0; k < count; k++) {
    const pix = candidates[Math.floor(rand() * candidates.length)]!;
    const x = pix % width;
    const y = Math.floor(pix / width);
    positions[k * 3] = (x + rand()) * scale - ox;
    positions[k * 3 + 1] = oy - (y + rand()) * scale;
    positions[k * 3 + 2] = (rand() - 0.5) * 0.08; // slight depth
    colors[k * 3] = data[pix * 4]! / 255;
    colors[k * 3 + 1] = data[pix * 4 + 1]! / 255;
    colors[k * 3 + 2] = data[pix * 4 + 2]! / 255;
  }
  const ordered = reorder(positions, colors, mortonOrder(positions, count));
  return { id: "", ...ordered, count };
}

/** Resample a prepared cloud (xyz triples) to `count` points, normalised into the box. */
export function resamplePoints(points: ArrayLike<number>, count: number, seed = 1, colors?: ArrayLike<number>): PreparedTarget | null {
  const n = Math.floor(points.length / 3);
  if (!n) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, points[i * 3]!); maxX = Math.max(maxX, points[i * 3]!);
    minY = Math.min(minY, points[i * 3 + 1]!); maxY = Math.max(maxY, points[i * 3 + 1]!);
    minZ = Math.min(minZ, points[i * 3 + 2]!); maxZ = Math.max(maxZ, points[i * 3 + 2]!);
  }
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const rand = rng(seed);
  const positions = new Float32Array(count * 3);
  const cols = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    const i = k < n ? k : Math.floor(rand() * n);
    positions[k * 3] = ((points[i * 3]! - cx) / span) * 2;
    positions[k * 3 + 1] = ((points[i * 3 + 1]! - cy) / span) * 2;
    positions[k * 3 + 2] = ((points[i * 3 + 2]! - cz) / span) * 2;
    cols[k * 3] = colors ? colors[i * 3]! : 1;
    cols[k * 3 + 1] = colors ? colors[i * 3 + 1]! : 1;
    cols[k * 3 + 2] = colors ? colors[i * 3 + 2]! : 1;
  }
  const ordered = reorder(positions, cols, mortonOrder(positions, count));
  return { id: "", ...ordered, count };
}

/** Seeded per-point curve offsets, built once per morph (no per-frame allocation, C54-T10). */
export function curveOffsets(count: number, spread: number, seed: number): Float32Array {
  const rand = rng(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) out[i] = (rand() * 2 - 1) * spread;
  return out;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Evaluate the morph at `t` (0…1) into `out`: a quadratic path that bows by
 * the seeded offset at mid-flight (volume expands by at most `spread`), no
 * allocation. Safe to call for any t, so a new morph can snapshot the current
 * positions as its start (C54-T03).
 */
export function evaluateMorph(start: Float32Array, end: Float32Array, offsets: Float32Array, t: number, out: Float32Array): void {
  const e = easeInOut(Math.max(0, Math.min(1, t)));
  const bow = 4 * e * (1 - e); // 0 at the ends, 1 at mid-flight
  for (let i = 0; i < out.length; i++) out[i] = start[i]! + (end[i]! - start[i]!) * e + offsets[i]! * bow;
}

/** Mean distance between two clouds (recognisability check for tests, C54-T01). */
export function meanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = Math.floor(Math.min(a.length, b.length) / 3);
  for (let i = 0; i < n; i++) sum += Math.hypot(a[i * 3]! - b[i * 3]!, a[i * 3 + 1]! - b[i * 3 + 1]!, a[i * 3 + 2]! - b[i * 3 + 2]!);
  return n ? sum / n : 0;
}
