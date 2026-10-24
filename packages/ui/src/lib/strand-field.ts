/**
 * StrandField — a 2D "symbiote goo" simulation.
 *
 * A body (rounded rectangle) grows stretchy strands toward a pointer as it
 * approaches, holds on while the pointer is near, and snaps/recoils when the
 * pointer pulls away. Idle bursts keep the surface alive. The field has no DOM
 * or framework dependency: feed it a body rect, a pointer, and `dt`, then hand
 * it to a renderer (see `strand-renderer.ts`).
 *
 * Original implementation. Inspired by the interaction of exteestudio's
 * "Venom Button" (MIT), reinterpreted for Canvas 2D and reuse: no WebGL,
 * no cursor replacement, no page-level canvas.
 */

import {
  clamp,
  createRng,
  ease,
  easeInOutSine,
  randBetween,
  stepSpring,
  type SpringState,
} from "@/lib/springs";
import {
  arcDelta,
  closestS,
  perimeter,
  pointAt,
  signedDistance,
  type OutlinePoint,
  type RoundedRect,
} from "@/lib/rounded-outline";

export type StrandKind = "reach" | "probe";
export type StrandState = "launch" | "hold" | "snap" | "recoil" | "probe";

export interface Strand {
  id: number;
  kind: StrandKind;
  state: StrandState;
  /** Points, root (index 0) to tip. Parallel arrays for allocation-free stepping. */
  n: number;
  px: Float64Array;
  py: Float64Array;
  ox: Float64Array;
  oy: Float64Array;
  root: OutlinePoint;
  /** Rest length (px); creeps under slow pull. */
  rest: number;
  /** Rest length at spawn, used for volume-conserving thickness. */
  rest0: number;
  /** Slot around the pointer this strand wraps (angle index). */
  slot: number;
  /** Per-strand random variation. */
  snapMul: number;
  lenMul: number;
  phase: number;
  age: number;
  stateAge: number;
  /** Pinned tip target while launching/holding. */
  tipX: number;
  tipY: number;
  tipPinned: boolean;
  /** Launch spring (x/y). */
  sx: SpringState;
  sy: SpringState;
  /** 0..1 pinch-off progress during `snap`. */
  neck: number;
  /** Probe parameters (idle life). */
  probe: { peak: number; dur: number; glide: number } | null;
}

export interface StrandFieldConfig {
  /** Distance from the edge (px) at which strands launch. */
  reach: number;
  /** Distance (px) at which the surface starts to notice the pointer (fizz + bow). */
  awareness: number;
  /** Maximum simultaneous reaching strands. */
  maxStrands: number;
  /** Stretch ratio (length / rest) that snaps a strand. */
  snapStretch: number;
  /** Absolute length (px) that always snaps. */
  maxLength: number;
  /** Viscous creep of rest length toward actual length (1/s). */
  creep: number;
  /** Base radius multiplier. */
  thickness: number;
  /** Global time multiplier for lunge/recoil. */
  speed: number;
  /** Downward sag (px/s²). */
  gravity: number;
  /** How strongly strand bodies and the slab bow toward the pointer. */
  magnetism: number;
  /** Lateral wave amplitude while reaching. */
  slither: number;
  /** Idle bursts when nobody is near. */
  idle: boolean;
  /** Seconds between idle bursts [min, max]. */
  idleInterval: [number, number];
  /** Radius (px) of the coil strands wrap around the pointer. */
  wrapRadius: number;
}

export const DEFAULT_STRAND_CONFIG: StrandFieldConfig = {
  reach: 120,
  awareness: 220,
  maxStrands: 6,
  snapStretch: 1.6,
  maxLength: 160,
  creep: 0.25,
  thickness: 1,
  speed: 1,
  gravity: 220,
  magnetism: 1,
  slither: 1,
  idle: true,
  idleInterval: [1.8, 2.3],
  wrapRadius: 7,
};

export interface FizzState {
  /** 0..1 how much the facing edge fizzes with micro strings. */
  level: number;
  /** Outline parameter facing the pointer. */
  s: number;
  /** Direction from the edge to the pointer. */
  dx: number;
  dy: number;
}

const POINTS = 13;
const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 6;
const ITERATIONS = 3;
const DAMPING = 0.94;
const SNAP_DURATION = 0.1;
const LAUNCH_DURATION = 0.42;
const ROOT_SINK = 3; // px the root sits inside the body so fillets hide under it

export class StrandField {
  config: StrandFieldConfig;
  body: RoundedRect = { x: 0, y: 0, w: 100, h: 40, r: 20 };
  strands: Strand[] = [];
  pointer: { x: number; y: number } | null = null;
  /** Slab displacement toward the pointer (px). */
  bow = { x: 0, y: 0 };
  fizz: FizzState = { level: 0, s: 0, dx: 0, dy: 0 };
  time = 0;
  /** True while the pointer is inside the body. */
  inside = false;
  /** Distance from the body edge to the pointer (Infinity when absent). */
  distance = Infinity;

  private rng: () => number;
  private nextId = 1;
  private accumulator = 0;
  private lastSpawnAt = -1;
  private spawnGap = 0.04;
  private lastProbeS = 0;
  private wrapSpin = 0;

  constructor(config: Partial<StrandFieldConfig> = {}, seed = 7) {
    this.config = { ...DEFAULT_STRAND_CONFIG, ...config };
    this.rng = createRng(seed);
  }

  setConfig(config: Partial<StrandFieldConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setBody(rect: RoundedRect): void {
    this.body = rect;
  }

  setPointer(p: { x: number; y: number } | null): void {
    this.pointer = p;
  }

  /** Whether anything is moving or about to move. Drives the render loop. */
  isActive(): boolean {
    if (this.strands.length > 0) return true;
    if (this.pointer && !this.inside && this.distance < this.config.awareness) return true;
    if (Math.abs(this.bow.x) > 0.05 || Math.abs(this.bow.y) > 0.05) return true;
    return this.fizz.level > 0.01;
  }

  /** Force every reaching strand to let go (pointer gone, pointer landed on the body). */
  release(): void {
    for (const s of this.strands) {
      if (s.kind === "reach" && (s.state === "launch" || s.state === "hold")) {
        this.beginSnap(s);
      }
    }
  }

  reset(): void {
    this.strands = [];
    this.bow = { x: 0, y: 0 };
    this.fizz = { level: 0, s: 0, dx: 0, dy: 0 };
    this.inside = false;
    this.distance = Infinity;
  }

  /**
   * Spawn a burst of idle strands around the outline. `count` strands rise
   * out of the edge and sink back in about a second. Used for idle life and
   * as press feedback on touch/keyboard, where there is no pointer to reach.
   */
  burst(count = 3, opts: { spread?: "cluster" | "ring"; peak?: number } = {}): void {
    const total = perimeter(this.body);
    const spread = opts.spread ?? "cluster";
    let base: number;
    if (spread === "ring") {
      base = randBetween(this.rng, 0, total);
    } else {
      // at least a quarter turn away from the last burst
      base = this.lastProbeS + total * randBetween(this.rng, 0.25, 0.75);
    }
    this.lastProbeS = base;
    for (let i = 0; i < count; i++) {
      const s =
        spread === "ring"
          ? base + (i / count) * total
          : base + (i - (count - 1) / 2) * randBetween(this.rng, 11, 15);
      const root = pointAt(this.body, s);
      const peak = (opts.peak ?? randBetween(this.rng, 11, 20)) * this.config.thickness;
      const strand = this.createStrand("probe", root, 0);
      strand.state = "probe";
      strand.probe = { peak, dur: randBetween(this.rng, 0.85, 1.15), glide: randBetween(this.rng, -8, 8) };
      strand.rest = 6;
      strand.rest0 = peak;
      strand.tipPinned = true;
      strand.tipX = root.x;
      strand.tipY = root.y;
      this.strands.push(strand);
    }
  }

  update(dtIn: number): void {
    const dt = clamp(dtIn, 0, 1 / 30);
    const cfg = this.config;
    this.time += dt;
    this.wrapSpin += dt * 0.6;

    const p = this.pointer;
    const sd = p ? signedDistance(this.body, p.x, p.y) : Infinity;
    this.inside = p !== null && sd <= 0;
    this.distance = p ? Math.max(0, sd) : Infinity;

    // ── bow: the slab leans toward a nearby pointer
    let bowTX = 0;
    let bowTY = 0;
    if (p && !this.inside) {
      const cx = this.body.x + this.body.w / 2;
      const cy = this.body.y + this.body.h / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const amt = ease(cfg.awareness, 14, this.distance) * cfg.magnetism * 2.6;
      bowTX = (dx / len) * amt;
      bowTY = (dy / len) * amt;
    }
    const k = Math.min(1, dt * 9);
    this.bow.x += (bowTX - this.bow.x) * k;
    this.bow.y += (bowTY - this.bow.y) * k;

    // ── fizz: micro strings along the facing edge before strands launch
    if (p && !this.inside) {
      const s = closestS(this.body, p.x, p.y);
      const edge = pointAt(this.body, s);
      const dx = p.x - edge.x;
      const dy = p.y - edge.y;
      const len = Math.hypot(dx, dy) || 1;
      const target = ease(cfg.awareness, cfg.reach * 0.35, this.distance);
      this.fizz.level += (target - this.fizz.level) * Math.min(1, dt * 12);
      this.fizz.s = s;
      this.fizz.dx = dx / len;
      this.fizz.dy = dy / len;
    } else {
      this.fizz.level += (0 - this.fizz.level) * Math.min(1, dt * 8);
    }

    // ── spawn / release reaching strands
    const live = this.strands.filter(
      (s) => s.kind === "reach" && (s.state === "launch" || s.state === "hold"),
    );
    if (p && !this.inside && this.distance < cfg.reach && cfg.maxStrands > 0) {
      const minCount = Math.min(2, cfg.maxStrands);
      const want = Math.min(
        cfg.maxStrands,
        Math.round(minCount + (cfg.maxStrands - minCount) * ease(cfg.reach, cfg.reach * 0.4, this.distance)),
      );
      if (live.length < want && this.time - this.lastSpawnAt > this.spawnGap) {
        this.spawnReach(p, live);
        this.lastSpawnAt = this.time;
        this.spawnGap = randBetween(this.rng, 0.03, 0.06) / cfg.speed;
      }
    }
    if (!p || this.inside || this.distance > cfg.awareness) {
      this.release();
    }

    // ── physics
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= SUBSTEP && steps < MAX_SUBSTEPS) {
      this.step(SUBSTEP);
      this.accumulator -= SUBSTEP;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0;

    // ── state machines
    for (const s of this.strands) {
      s.age += dt;
      s.stateAge += dt;
      this.advance(s, dt);
    }
    this.strands = this.strands.filter((s) => !(s.state === "recoil" && s.stateAge > this.recoilDuration()));
  }

  recoilDuration(): number {
    return 0.42 / this.config.speed;
  }

  /** Visible fraction of a recoiling strand (1 → 0, fast then easing). */
  recoilFraction(s: Strand): number {
    if (s.state !== "recoil") return 1;
    const t = s.stateAge / this.recoilDuration();
    return Math.max(0, Math.exp(-t * 4.2) - t * 0.015);
  }

  /** Current length of a strand's polyline. */
  length(s: Strand): number {
    let len = 0;
    for (let i = 1; i < s.n; i++) {
      len += Math.hypot(s.px[i] - s.px[i - 1], s.py[i] - s.py[i - 1]);
    }
    return len;
  }

  stretch(s: Strand): number {
    return s.rest > 0 ? this.length(s) / s.rest : 1;
  }

  // ───────────────────────────── internals ─────────────────────────────

  private createStrand(kind: StrandKind, root: OutlinePoint, slot: number): Strand {
    const n = POINTS;
    const px = new Float64Array(n);
    const py = new Float64Array(n);
    const ox = new Float64Array(n);
    const oy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      px[i] = root.x - root.nx * ROOT_SINK + root.nx * t * 6;
      py[i] = root.y - root.ny * ROOT_SINK + root.ny * t * 6;
      ox[i] = px[i];
      oy[i] = py[i];
    }
    return {
      id: this.nextId++,
      kind,
      state: "launch",
      n,
      px,
      py,
      ox,
      oy,
      root,
      rest: 6,
      rest0: 6,
      slot,
      snapMul: randBetween(this.rng, 0.85, 1.15),
      lenMul: randBetween(this.rng, 0.88, 1.12),
      phase: randBetween(this.rng, 0, Math.PI * 2),
      age: 0,
      stateAge: 0,
      tipX: root.x,
      tipY: root.y,
      tipPinned: true,
      sx: { value: 0, velocity: 0 },
      sy: { value: 0, velocity: 0 },
      neck: 0,
      probe: null,
    };
  }

  private spawnReach(p: { x: number; y: number }, live: Strand[]): void {
    const s0 = closestS(this.body, p.x, p.y);
    // choose a free wrap slot
    const used = new Set(live.map((s) => s.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    // spread roots along the facing edge, alternating sides
    const order = live.length;
    const side = order % 2 === 0 ? 1 : -1;
    const offset = side * Math.ceil(order / 2) * randBetween(this.rng, 20, 30) + randBetween(this.rng, -5, 5);
    const root = pointAt(this.body, s0 + offset);
    const strand = this.createStrand("reach", root, slot);
    const dist = Math.hypot(p.x - root.x, p.y - root.y);
    // a little slack so the strand curves and slithers instead of pulling taut
    strand.rest = Math.max(6, dist * 1.14);
    strand.rest0 = strand.rest;
    // launch spring starts with a little wind-up (negative velocity)
    strand.sx.value = 0;
    strand.sx.velocity = -0.8;
    strand.sy.value = 0;
    strand.sy.velocity = -0.8;
    this.strands.push(strand);
  }

  private wrapTarget(s: Strand, p: { x: number; y: number }): { x: number; y: number } {
    const a = s.slot * ((Math.PI * 2) / Math.max(3, this.config.maxStrands)) + this.wrapSpin;
    return {
      x: p.x + Math.cos(a) * this.config.wrapRadius,
      y: p.y + Math.sin(a) * this.config.wrapRadius,
    };
  }

  private advance(s: Strand, dt: number): void {
    const cfg = this.config;
    const p = this.pointer;
    switch (s.state) {
      case "launch": {
        if (!p) {
          this.beginSnap(s);
          return;
        }
        const target = this.wrapTarget(s, p);
        const omega = Math.PI * 2 * 4.4 * cfg.speed * (0.8 + 0.2 * cfg.magnetism);
        stepSpring(s.sx, 1, omega, 0.58, dt);
        stepSpring(s.sy, 1, omega, 0.58, dt);
        const tx = clamp(s.sx.value, -0.08, 1.12);
        const ty = clamp(s.sy.value, -0.08, 1.12);
        s.tipX = s.root.x + (target.x - s.root.x) * tx;
        s.tipY = s.root.y + (target.y - s.root.y) * ty;
        s.tipPinned = true;
        if (s.stateAge > LAUNCH_DURATION / cfg.speed) {
          s.state = "hold";
          s.stateAge = 0;
        }
        break;
      }
      case "hold": {
        if (!p) {
          this.beginSnap(s);
          return;
        }
        const target = this.wrapTarget(s, p);
        s.tipX = target.x;
        s.tipY = target.y;
        s.tipPinned = true;
        const len = this.length(s);
        // viscous creep: slow pulls lengthen the strand instead of snapping it
        s.rest += (len - s.rest) * cfg.creep * dt;
        const stretch = len / s.rest;
        if (stretch > cfg.snapStretch * s.snapMul || len > cfg.maxLength * s.lenMul) {
          this.beginSnap(s);
        }
        break;
      }
      case "snap": {
        s.neck = clamp(s.stateAge / (SNAP_DURATION / cfg.speed), 0, 1);
        if (p && s.kind === "reach") {
          const target = this.wrapTarget(s, p);
          s.tipX = target.x;
          s.tipY = target.y;
        }
        if (s.neck >= 1) {
          s.state = "recoil";
          s.stateAge = 0;
          s.tipPinned = false;
        }
        break;
      }
      case "recoil":
        break;
      case "probe": {
        const pr = s.probe!;
        const t = clamp(s.stateAge / pr.dur, 0, 1);
        const h = pr.peak * Math.pow(Math.sin(Math.PI * t), 0.8);
        const glide = pr.glide * easeInOutSine(t);
        s.tipX = s.root.x + s.root.nx * h + s.root.tx * glide;
        s.tipY = s.root.y + s.root.ny * h + s.root.ty * glide;
        s.rest = Math.max(4, h * 1.05);
        s.tipPinned = true;
        if (t >= 1) {
          s.state = "recoil";
          s.stateAge = this.recoilDuration(); // remove immediately
        }
        break;
      }
    }
  }

  private beginSnap(s: Strand): void {
    if (s.state === "snap" || s.state === "recoil") return;
    s.state = "snap";
    s.stateAge = 0;
    s.neck = 0;
  }

  private step(h: number): void {
    const cfg = this.config;
    const p = this.pointer;
    const g = cfg.gravity;
    for (const s of this.strands) {
      const live = s.kind === "reach" && (s.state === "launch" || s.state === "hold");
      const seg = s.rest / (s.n - 1);
      const dirX = s.tipX - s.root.x;
      const dirY = s.tipY - s.root.y;
      const dl = Math.hypot(dirX, dirY) || 1;
      const perpX = -dirY / dl;
      const perpY = dirX / dl;
      const slither = live ? Math.sin(this.time * 4.5 + s.phase) * 520 * cfg.slither : 0;
      const magnet = live && p ? cfg.magnetism * 700 : 0;

      // integrate
      const last = s.tipPinned ? s.n - 1 : s.n;
      for (let i = 1; i < last; i++) {
        const vx = (s.px[i] - s.ox[i]) * DAMPING;
        const vy = (s.py[i] - s.oy[i]) * DAMPING;
        s.ox[i] = s.px[i];
        s.oy[i] = s.py[i];
        const w = Math.sin((i / (s.n - 1)) * Math.PI); // belly moves most
        let ax = perpX * slither * w;
        let ay = g + perpY * slither * w;
        if (magnet && p) {
          const mx = p.x - s.px[i];
          const my = p.y - s.py[i];
          const ml = Math.hypot(mx, my) || 1;
          ax += (mx / ml) * magnet * w;
          ay += (my / ml) * magnet * w;
        }
        s.px[i] += vx + ax * h * h;
        s.py[i] += vy + ay * h * h;
      }

      // constraints
      const rootX = s.root.x - s.root.nx * ROOT_SINK;
      const rootY = s.root.y - s.root.ny * ROOT_SINK;
      for (let it = 0; it < ITERATIONS; it++) {
        s.px[0] = rootX;
        s.py[0] = rootY;
        if (s.tipPinned) {
          s.px[s.n - 1] = s.tipX;
          s.py[s.n - 1] = s.tipY;
        }
        for (let i = 0; i < s.n - 1; i++) {
          this.distanceConstraint(s, i, i + 1, seg, 1);
        }
        for (let i = 0; i < s.n - 2; i++) {
          this.distanceConstraint(s, i, i + 2, seg * 1.75, 0.35, true);
        }
      }
      s.px[0] = rootX;
      s.py[0] = rootY;
      if (s.tipPinned) {
        s.px[s.n - 1] = s.tipX;
        s.py[s.n - 1] = s.tipY;
      }
    }
  }

  private distanceConstraint(
    s: Strand,
    a: number,
    b: number,
    rest: number,
    stiffness: number,
    minOnly = false,
  ): void {
    const dx = s.px[b] - s.px[a];
    const dy = s.py[b] - s.py[a];
    const d = Math.hypot(dx, dy) || 1e-6;
    if (minOnly && d >= rest) return;
    const diff = ((d - rest) / d) * stiffness;
    const aPinned = a === 0;
    const bPinned = b === s.n - 1 && s.tipPinned;
    const wa = aPinned ? 0 : bPinned ? 1 : 0.5;
    const wb = bPinned ? 0 : aPinned ? 1 : 0.5;
    s.px[a] += dx * diff * wa;
    s.py[a] += dy * diff * wa;
    s.px[b] -= dx * diff * wb;
    s.py[b] -= dy * diff * wb;
  }
}

/** Convenience: sort reaching strands by outline position (for webbing between neighbours). */
export function sortedByRoot(field: StrandField, strands: Strand[]): Strand[] {
  const ref = strands[0]?.root.s ?? 0;
  return [...strands].sort(
    (a, b) => arcDelta(field.body, ref, a.root.s) - arcDelta(field.body, ref, b.root.s),
  );
}
