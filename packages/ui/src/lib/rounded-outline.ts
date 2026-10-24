/**
 * Geometry helpers for a rounded rectangle outline ("pill" when r = h / 2).
 * The outline is parameterised by arc length `s` running clockwise from the
 * start of the top edge. Used to root strands on a control's edge.
 */

export interface RoundedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface OutlinePoint {
  x: number;
  y: number;
  /** Outward unit normal. */
  nx: number;
  ny: number;
  /** Clockwise unit tangent. */
  tx: number;
  ty: number;
  s: number;
}

const HALF_PI = Math.PI / 2;

export function normalizeRect(rect: RoundedRect): RoundedRect {
  const r = Math.max(0, Math.min(rect.r, rect.w / 2, rect.h / 2));
  return { ...rect, r };
}

export function perimeter(rect: RoundedRect): number {
  const { w, h, r } = normalizeRect(rect);
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

function wrapS(s: number, total: number): number {
  const m = s % total;
  return m < 0 ? m + total : m;
}

/** Point, normal and tangent at arc-length parameter `s`. */
export function pointAt(rect: RoundedRect, sIn: number): OutlinePoint {
  const { x, y, w, h, r } = normalizeRect(rect);
  const ew = w - 2 * r;
  const eh = h - 2 * r;
  const arc = HALF_PI * r;
  const total = 2 * ew + 2 * eh + 4 * arc;
  const s = wrapS(sIn, total);
  let acc = 0;

  // top edge, left -> right
  if (s < acc + ew) {
    return { x: x + r + (s - acc), y, nx: 0, ny: -1, tx: 1, ty: 0, s };
  }
  acc += ew;
  // top-right arc
  if (s < acc + arc) {
    const a = -HALF_PI + ((s - acc) / arc) * HALF_PI;
    const cx = x + w - r;
    const cy = y + r;
    return arcPoint(cx, cy, r, a, s);
  }
  acc += arc;
  // right edge, top -> bottom
  if (s < acc + eh) {
    return { x: x + w, y: y + r + (s - acc), nx: 1, ny: 0, tx: 0, ty: 1, s };
  }
  acc += eh;
  // bottom-right arc
  if (s < acc + arc) {
    const a = ((s - acc) / arc) * HALF_PI;
    return arcPoint(x + w - r, y + h - r, r, a, s);
  }
  acc += arc;
  // bottom edge, right -> left
  if (s < acc + ew) {
    return { x: x + w - r - (s - acc), y: y + h, nx: 0, ny: 1, tx: -1, ty: 0, s };
  }
  acc += ew;
  // bottom-left arc
  if (s < acc + arc) {
    const a = HALF_PI + ((s - acc) / arc) * HALF_PI;
    return arcPoint(x + r, y + h - r, r, a, s);
  }
  acc += arc;
  // left edge, bottom -> top
  if (s < acc + eh) {
    return { x, y: y + h - r - (s - acc), nx: -1, ny: 0, tx: 0, ty: -1, s };
  }
  acc += eh;
  // top-left arc
  const a = Math.PI + ((s - acc) / arc) * HALF_PI;
  return arcPoint(x + r, y + r, r, a, s);
}

function arcPoint(cx: number, cy: number, r: number, a: number, s: number): OutlinePoint {
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  return { x: cx + nx * r, y: cy + ny * r, nx, ny, tx: -ny, ty: nx, s };
}

/**
 * Signed distance from a point to the rounded rect. Positive outside,
 * negative inside (approximate inside the corner regions, exact elsewhere).
 */
export function signedDistance(rect: RoundedRect, px: number, py: number): number {
  const { x, y, w, h, r } = normalizeRect(rect);
  const cx = clampNum(px, x + r, x + w - r);
  const cy = clampNum(py, y + r, y + h - r);
  const dx = px - cx;
  const dy = py - cy;
  if (dx !== 0 || dy !== 0) {
    return Math.hypot(dx, dy) - r;
  }
  // inside the inner box: negative distance to the nearest edge
  return -Math.min(px - x, x + w - px, py - y, y + h - py);
}

export function isInside(rect: RoundedRect, px: number, py: number): boolean {
  return signedDistance(rect, px, py) <= 0;
}

/** Arc-length parameter of the outline point closest to (px, py). */
export function closestS(rect: RoundedRect, px: number, py: number): number {
  const { x, y, w, h, r } = normalizeRect(rect);
  const ew = w - 2 * r;
  const eh = h - 2 * r;
  const arc = HALF_PI * r;
  const cx = clampNum(px, x + r, x + w - r);
  const cy = clampNum(py, y + r, y + h - r);
  const dx = px - cx;
  const dy = py - cy;

  if (dx === 0 && dy === 0) {
    // inside the inner box: nearest edge wins
    const dl = px - x;
    const dr = x + w - px;
    const dt = py - y;
    const db = y + h - py;
    const m = Math.min(dl, dr, dt, db);
    if (m === dt) return clampNum(px - (x + r), 0, ew);
    if (m === dr) return ew + arc + clampNum(py - (y + r), 0, eh);
    if (m === db) return ew + arc + eh + arc + clampNum(x + w - r - px, 0, ew);
    return 2 * ew + 2 * arc + eh + arc + clampNum(y + h - r - py, 0, eh);
  }

  const onVerticalSpan = cy > y + r && cy < y + h - r; // left/right edge
  const onHorizontalSpan = cx > x + r && cx < x + w - r; // top/bottom edge
  if (onHorizontalSpan && dx === 0) {
    return dy < 0 ? cx - (x + r) : ew + arc + eh + arc + (x + w - r - cx);
  }
  if (onVerticalSpan && dy === 0) {
    return dx > 0 ? ew + arc + (cy - (y + r)) : 2 * ew + 2 * arc + eh + arc + (y + h - r - cy);
  }
  // corner arcs. Which corner: the clamped point tells us when the inner box
  // has extent; when it degenerates (pills, circles) the direction decides.
  const right = ew > 0 ? cx > x + r : dx >= 0;
  const bottom = eh > 0 ? cy > y + r : dy > 0;
  const a = Math.atan2(dy, dx); // -PI..PI
  if (!bottom && right) {
    // top-right: -PI/2 .. 0
    return ew + ((a + HALF_PI) / HALF_PI) * arc;
  }
  if (bottom && right) {
    // bottom-right: 0 .. PI/2
    return ew + arc + eh + (a / HALF_PI) * arc;
  }
  if (bottom && !right) {
    // bottom-left: PI/2 .. PI
    return 2 * ew + 2 * arc + eh + ((a - HALF_PI) / HALF_PI) * arc;
  }
  // top-left: PI .. 3PI/2 (atan2 gives -PI..-PI/2)
  const aa = a < 0 ? a + 2 * Math.PI : a;
  return 2 * ew + 3 * arc + 2 * eh + ((aa - Math.PI) / HALF_PI) * arc;
}

export function arcDelta(rect: RoundedRect, a: number, b: number): number {
  const total = perimeter(rect);
  let d = wrapS(b - a, total);
  if (d > total / 2) d -= total;
  return d;
}

function clampNum(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function roundedRectPath(ctx: CanvasRenderingContext2D, rect: RoundedRect): void {
  const { x, y, w, h, r } = normalizeRect(rect);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -HALF_PI, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, HALF_PI);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, HALF_PI, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}
