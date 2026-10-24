/**
 * Canvas 2D renderer for a StrandField. Draws tapered goo ribbons with root
 * fillets, webbing between neighbours, mozzarella fibres on stretched strands,
 * a rim-light highlight, soft shadows and a coil around the pointer.
 *
 * Pure function of the field state: no retained state, no DOM beyond `ctx`.
 */

import { pointAt } from "@/lib/rounded-outline";
import { clamp } from "@/lib/springs";
import { sortedByRoot, type Strand, type StrandField } from "@/lib/strand-field";

export interface StrandRenderOptions {
  /** Fill colour of the goo (CSS colour). */
  goo: string;
  /** Rim-light colour, usually a translucent white. */
  highlight: string;
  /** Shadow colour, usually a translucent black. */
  shadow: string;
  /** Base strand radius in px (before thickness/volume effects). */
  baseRadius: number;
  /** Light direction for the rim highlight (unit vector, screen space). */
  light?: { x: number; y: number };
}

interface Ribbon {
  x: number[];
  y: number[];
  r: number[];
  count: number;
}

const LIGHT = { x: -0.6, y: -0.8 };

export function renderStrandField(
  ctx: CanvasRenderingContext2D,
  field: StrandField,
  opts: StrandRenderOptions,
): void {
  const light = opts.light ?? LIGHT;
  const ribbons: { strand: Strand; ribbon: Ribbon }[] = [];
  for (const s of field.strands) {
    const ribbon = ribbonFor(field, s, opts.baseRadius);
    if (ribbon.count >= 2) ribbons.push({ strand: s, ribbon });
  }

  // 1. shadows
  if (ribbons.length) {
    ctx.save();
    ctx.translate(3, 5);
    ctx.fillStyle = opts.shadow;
    for (const { strand, ribbon } of ribbons) {
      ctx.beginPath();
      ribbonPath(ctx, ribbon);
      ctx.fill();
      filletPath(ctx, strand, ribbon, opts.baseRadius);
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. webs between neighbouring reaching strands
  const live = ribbons.filter(
    ({ strand }) => strand.kind === "reach" && strand.state !== "recoil",
  );
  if (live.length > 1) {
    const sorted = sortedByRoot(
      field,
      live.map((l) => l.strand),
    );
    ctx.save();
    ctx.strokeStyle = opts.goo;
    ctx.lineCap = "round";
    for (let k = 0; k < sorted.length - 1; k++) {
      const a = live.find((l) => l.strand === sorted[k])!.ribbon;
      const b = live.find((l) => l.strand === sorted[k + 1])!.ribbon;
      const n = Math.min(a.count, b.count);
      for (let i = 2; i < n - 2; i += 2) {
        const dx = b.x[i] - a.x[i];
        const dy = b.y[i] - a.y[i];
        const d = Math.hypot(dx, dy);
        if (d < 18 && d > 2) {
          const t = 1 - d / 18;
          ctx.globalAlpha = t * 0.7;
          ctx.lineWidth = 0.35 + t * 0.5 * (a.r[i] + b.r[i]) * 0.3;
          ctx.beginPath();
          ctx.moveTo(a.x[i], a.y[i]);
          // sag the web slightly toward the body
          ctx.quadraticCurveTo((a.x[i] + b.x[i]) / 2, (a.y[i] + b.y[i]) / 2 + 1.5, b.x[i], b.y[i]);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // 3. goo bodies + fillets
  ctx.save();
  ctx.fillStyle = opts.goo;
  for (const { strand, ribbon } of ribbons) {
    ctx.beginPath();
    ribbonPath(ctx, ribbon);
    ctx.fill();
    filletPath(ctx, strand, ribbon, opts.baseRadius);
    ctx.fill();
  }
  ctx.restore();

  // 4. fibres on stretched strands
  ctx.save();
  ctx.strokeStyle = opts.goo;
  ctx.lineCap = "round";
  for (const { strand, ribbon } of ribbons) {
    if (strand.kind !== "reach" || strand.state === "recoil") continue;
    const stretch = field.stretch(strand);
    if (stretch < 1.18) continue;
    const spread = clamp((stretch - 1.18) * 7, 0, 7) * opts.baseRadius;
    const alpha = clamp((stretch - 1.18) * 3, 0, 0.9);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.35 * opts.baseRadius + 0.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 1; i < ribbon.count - 1; i++) {
        const { nx, ny } = normalAt(ribbon, i);
        const w = Math.sin((i / (ribbon.count - 1)) * Math.PI);
        const x = ribbon.x[i] + nx * side * spread * w;
        const y = ribbon.y[i] + ny * side * spread * w;
        if (i === 1) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  // 5. rim highlight
  ctx.save();
  ctx.strokeStyle = opts.highlight;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const { ribbon } of ribbons) {
    ctx.beginPath();
    let started = false;
    for (let i = 1; i < ribbon.count - 1; i++) {
      const { nx, ny } = normalAt(ribbon, i);
      const sign = nx * light.x + ny * light.y > 0 ? 1 : -1;
      const inset = ribbon.r[i] * 0.55;
      const x = ribbon.x[i] + nx * sign * inset;
      const y = ribbon.y[i] + ny * sign * inset;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.lineWidth = Math.max(0.6, opts.baseRadius * 0.45);
    ctx.stroke();
  }
  ctx.restore();

  // 6. coil around the pointer
  const holding = field.strands.filter(
    (s) => s.kind === "reach" && (s.state === "hold" || s.state === "snap"),
  );
  if (holding.length && field.pointer) {
    const p = field.pointer;
    const R = field.config.wrapRadius;
    ctx.save();
    ctx.lineCap = "round";
    for (const s of holding) {
      const a0 = Math.atan2(s.tipY - p.y, s.tipX - p.x);
      const span = (Math.PI * 2) / Math.max(3, field.config.maxStrands) * 0.9 * (1 - s.neck);
      ctx.strokeStyle = opts.goo;
      ctx.lineWidth = opts.baseRadius * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, a0, a0 + span);
      ctx.stroke();
      ctx.strokeStyle = opts.highlight;
      ctx.lineWidth = opts.baseRadius * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R - opts.baseRadius * 0.3, a0 + span * 0.1, a0 + span * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 7. fizz: micro strings along the facing edge
  if (field.fizz.level > 0.02) {
    renderFizz(ctx, field, opts);
  }
}

function renderFizz(ctx: CanvasRenderingContext2D, field: StrandField, opts: StrandRenderOptions) {
  const f = field.fizz;
  const t = field.time;
  ctx.save();
  ctx.fillStyle = opts.goo;
  for (let j = -4; j <= 4; j++) {
    const s = f.s + j * 9 + Math.sin(t * 1.3 + j * 2.1) * 2;
    const e = pointAt(field.body, s);
    const falloff = 1 - Math.abs(j) / 5.5;
    const wobble = 0.72 + 0.28 * Math.sin(t * 7 + j * 1.3);
    const len = (1.5 + 6.5 * f.level) * falloff * wobble * field.config.thickness;
    if (len < 0.8) continue;
    // lean toward the pointer
    const dx = e.nx * 0.55 + f.dx * 0.45;
    const dy = e.ny * 0.55 + f.dy * 0.45;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl;
    const uy = dy / dl;
    const w = (0.6 + 0.5 * f.level) * opts.baseRadius * falloff;
    const bx = e.x - e.nx * 2;
    const by = e.y - e.ny * 2;
    ctx.beginPath();
    ctx.moveTo(bx + e.tx * w, by + e.ty * w);
    ctx.quadraticCurveTo(bx + ux * len * 0.5 + e.tx * w * 0.25, by + uy * len * 0.5 + e.ty * w * 0.25, bx + ux * len, by + uy * len);
    ctx.quadraticCurveTo(bx + ux * len * 0.5 - e.tx * w * 0.25, by + uy * len * 0.5 - e.ty * w * 0.25, bx - e.tx * w, by - e.ty * w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Build the centre line with per-point radii, trimmed for recoil. */
function ribbonFor(field: StrandField, s: Strand, baseRadius: number): Ribbon {
  const frac = field.recoilFraction(s);
  const total = field.length(s);
  const visible = total * frac;
  const stretch = s.kind === "reach" ? field.stretch(s) : 1;
  // volume conservation: longer means thinner
  const volume = clamp(Math.sqrt(s.rest0 / Math.max(1, total)), 0.42, 1.25);
  const R = baseRadius * field.config.thickness * volume * (s.kind === "probe" ? 0.8 : 1);
  const x: number[] = [];
  const y: number[] = [];
  const r: number[] = [];
  let acc = 0;
  for (let i = 0; i < s.n; i++) {
    if (i > 0) {
      const d = Math.hypot(s.px[i] - s.px[i - 1], s.py[i] - s.py[i - 1]);
      if (acc + d > visible) {
        // partial last segment
        const t = d > 0 ? (visible - acc) / d : 0;
        x.push(s.px[i - 1] + (s.px[i] - s.px[i - 1]) * t);
        y.push(s.py[i - 1] + (s.py[i] - s.py[i - 1]) * t);
        r.push(radiusAt(s, i - 1 + t, R, stretch, acc + d * t, total));
        break;
      }
      acc += d;
    }
    x.push(s.px[i]);
    y.push(s.py[i]);
    r.push(radiusAt(s, i, R, stretch, acc, total));
  }
  // recoil: thin the free end so it reads as retracting into itself
  if (s.state === "recoil") {
    const n = x.length;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      r[i] *= 0.55 + 0.45 * (1 - t) * frac;
    }
  }
  return { x, y, r, count: x.length };
}

function radiusAt(s: Strand, i: number, R: number, stretch: number, arc: number, total: number): number {
  const t = i / (s.n - 1);
  // taper: fat root fillet, thin toward the wrap
  let taper: number;
  if (i < 1) taper = 1.9 - 0.6 * i;
  else if (i < 2) taper = 1.3 - 0.15 * (i - 1);
  else taper = 1.15 - 0.5 * ((i - 2) / (s.n - 3));
  let r = R * taper;
  // Rayleigh–Plateau beads past 1.5× stretch
  if (stretch > 1.5) {
    const amt = clamp((stretch - 1.5) / 0.5, 0, 1) * 0.35;
    r *= 1 + amt * Math.sin(arc / (9 * Math.max(0.5, R)) + s.phase);
  }
  // pinch-off neck near the tip during snap
  if (s.state === "snap" && total > 0) {
    const neckPos = 0.74;
    const w = Math.exp(-Math.pow((t - neckPos) / 0.09, 2));
    r *= 1 - s.neck * w;
  }
  return Math.max(0.05, r);
}

function normalAt(rb: Ribbon, i: number): { nx: number; ny: number } {
  const i0 = Math.max(0, i - 1);
  const i1 = Math.min(rb.count - 1, i + 1);
  const tx = rb.x[i1] - rb.x[i0];
  const ty = rb.y[i1] - rb.y[i0];
  const l = Math.hypot(tx, ty) || 1;
  return { nx: -ty / l, ny: tx / l };
}

function ribbonPath(ctx: CanvasRenderingContext2D, rb: Ribbon): void {
  const n = rb.count;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const { nx, ny } = normalAt(rb, i);
    left.push([rb.x[i] + nx * rb.r[i], rb.y[i] + ny * rb.r[i]]);
    right.push([rb.x[i] - nx * rb.r[i], rb.y[i] - ny * rb.r[i]]);
  }
  smoothSide(ctx, left, true);
  // round tip
  const tip = n - 1;
  const { nx, ny } = normalAt(rb, tip);
  const ang = Math.atan2(ny, nx);
  ctx.arc(rb.x[tip], rb.y[tip], rb.r[tip], ang, ang + Math.PI, true);
  smoothSide(ctx, right.reverse(), false);
  ctx.closePath();
}

function smoothSide(ctx: CanvasRenderingContext2D, pts: [number, number][], move: boolean): void {
  if (pts.length === 0) return;
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

/**
 * Concave "tent" where the strand leaves the body, mimicking a smooth-min
 * fillet. Half of it lies under the control and is hidden by it.
 */
function filletPath(ctx: CanvasRenderingContext2D, s: Strand, rb: Ribbon, baseRadius: number): void {
  if (rb.count < 3) return;
  const k = Math.min(2, rb.count - 1);
  const root = s.root;
  const rootX = root.x - root.nx * 1;
  const rootY = root.y - root.ny * 1;
  const W = Math.max(3.5, rb.r[0] * 2.2 + baseRadius * 1.2);
  const { nx, ny } = normalAt(rb, k);
  const Lx = rb.x[k] + nx * rb.r[k];
  const Ly = rb.y[k] + ny * rb.r[k];
  const Rx = rb.x[k] - nx * rb.r[k];
  const Ry = rb.y[k] - ny * rb.r[k];
  // which strand edge is on the +tangent side of the root?
  const lPlus = (Lx - rootX) * root.tx + (Ly - rootY) * root.ty;
  const rPlus = (Rx - rootX) * root.tx + (Ry - rootY) * root.ty;
  const [px, py, mx, my] = lPlus > rPlus ? [Lx, Ly, Rx, Ry] : [Rx, Ry, Lx, Ly];
  const ax = rootX + root.tx * W;
  const ay = rootY + root.ty * W;
  const bx = rootX - root.tx * W;
  const by = rootY - root.ty * W;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(rootX + root.tx * W * 0.35 + root.nx * 0.8, rootY + root.ty * W * 0.35 + root.ny * 0.8, px, py);
  ctx.lineTo(mx, my);
  ctx.quadraticCurveTo(rootX - root.tx * W * 0.35 + root.nx * 0.8, rootY - root.ty * W * 0.35 + root.ny * 0.8, bx, by);
  // close through the inside of the body (hidden under the control)
  ctx.lineTo(bx - root.nx * 6, by - root.ny * 6);
  ctx.lineTo(ax - root.nx * 6, ay - root.ny * 6);
  ctx.closePath();
}
