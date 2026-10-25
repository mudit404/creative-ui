"use client";

import * as React from "react";
import { AnimatePresence, motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { defaultExtractor, hexOf, isHexColor, luminance, parseColor, toCssVariables, type DecodedPixels, type ExtractedColor, type Extractor } from "@/lib/palette-extract";

export type { DecodedPixels, ExtractedColor, Extractor } from "@/lib/palette-extract";

export type PaletteComposerVariant = "harvest" | "editor" | "brand";
export type PaletteComposerMotion = "auto" | "reduced" | "off";
export type ExtractionState = "empty" | "decoding" | "extracting" | "ready" | "error";
export type ExtractionErrorReason = "type" | "size" | "decode" | "cors" | "network" | "algorithm" | "aborted";

export interface ExtractionError {
  reason: ExtractionErrorReason;
  message: string;
}

export type PaletteSource =
  | { kind: "file"; file: File; revision: string | number; alt?: string }
  | { kind: "url"; url: string; revision: string | number; alt?: string };

export interface Swatch {
  /** Stable slot id (`slot-1` … `slot-n`). */
  id: string;
  /** Lower-case `#rrggbb`, or null for an unused slot. */
  color: string | null;
  locked: boolean;
  label?: string;
  origin: "extracted" | "edited" | "empty";
}

export interface DecodeLimits {
  sampleMaxSide: number;
  maxFileBytes: number;
  maxPixels: number;
}

export interface DecodeInput {
  url: string;
  file?: File;
  kind: "file" | "url";
}

/** Decodes a source into bounded RGBA pixels. Throw an `ExtractionError`-shaped object for typed failures. */
export type Decoder = (input: DecodeInput, limits: DecodeLimits, signal: AbortSignal) => Promise<DecodedPixels>;

export interface PaletteChangeMeta {
  reason: "extract" | "edit" | "lock" | "unlock" | "clear";
  requestId?: number;
}

export interface PaletteComposerHandle {
  root: HTMLDivElement | null;
  focusSourceInput: () => void;
}

export interface PaletteComposerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  source?: PaletteSource | null;
  defaultSource?: PaletteSource | null;
  onSourceChange?: (source: PaletteSource | null) => void;
  palette?: readonly Swatch[];
  defaultPalette?: readonly Swatch[];
  onPaletteChange?: (palette: Swatch[], meta: PaletteChangeMeta) => void;
  /** Extraction adapter. Defaults to the built-in bucket quantiser. */
  extractor?: Extractor;
  /** Decode adapter. Defaults to browser image decoding + canvas sampling. Inject pixel fixtures in tests. */
  decoder?: Decoder;
  count?: number;
  sampleMaxSide?: number;
  maxFileBytes?: number;
  maxPixels?: number;
  /** 0..1; pixels below this alpha are ignored. */
  alphaThreshold?: number;
  onExtractionError?: (error: ExtractionError) => void;
  onExtractionStateChange?: (state: ExtractionState) => void;
  /** CSS variable prefix; sanitised to [a-z0-9-]. */
  exportPrefix?: string;
  /** Slot names for the `brand` variant (and CSS suffixes). */
  slotLabels?: readonly string[];
  variant?: PaletteComposerVariant;
  /** Allow a remote URL source (loads with crossOrigin="anonymous"; never proxied). */
  allowUrl?: boolean;
  label?: string;
  motion?: PaletteComposerMotion;
}

/* ───────────── default browser decoder ───────────── */

function err(reason: ExtractionErrorReason, message: string): ExtractionError {
  return { reason, message };
}

export const browserDecoder: Decoder = async (input, limits, signal) => {
  if (input.file) {
    if (!input.file.type.startsWith("image/")) throw err("type", `"${input.file.name}" is not an image.`);
    if (input.file.size > limits.maxFileBytes) throw err("size", `The file is ${(input.file.size / 1048576).toFixed(1)} MiB; the limit is ${Math.round(limits.maxFileBytes / 1048576)} MiB.`);
  }
  const img = new Image();
  if (input.kind === "url") img.crossOrigin = "anonymous";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(err(input.kind === "url" ? "network" : "decode", input.kind === "url" ? "The image could not be loaded. The server may not allow cross-origin reads; choose a local file instead." : "The image could not be decoded."));
  });
  img.src = input.url;
  await loaded;
  if (signal.aborted) throw err("aborted", "Superseded.");
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw err("decode", "The image has no pixels.");
  if (w * h > limits.maxPixels) throw err("size", `The image is ${w}×${h} (${(w * h / 1e6).toFixed(1)} MP); the limit is ${(limits.maxPixels / 1e6).toFixed(0)} MP.`);
  const scale = Math.min(1, limits.sampleMaxSide / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw err("decode", "Canvas 2D is unavailable.");
  ctx.drawImage(img, 0, 0, sw, sh);
  try {
    const data = ctx.getImageData(0, 0, sw, sh);
    return { data: data.data, width: sw, height: sh };
  } catch {
    throw err("cors", "The image is cross-origin and cannot be read. Choose a local file instead.");
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

/* ───────────── extraction controller (outside React state) ───────────── */

interface Snapshot {
  state: ExtractionState;
  error: ExtractionError | null;
  requestId: number;
}

interface Result {
  requestId: number;
  colors: ExtractedColor[];
  width: number;
  height: number;
}

function createExtractionController(latest: React.RefObject<{ onResult: (r: Result) => void; onError: (e: ExtractionError, requestId: number) => void }>) {
  let snap: Snapshot = { state: "empty", error: null, requestId: 0 };
  let abort: AbortController | null = null;
  const subs = new Set<() => void>();
  const set = (next: Partial<Snapshot>) => {
    snap = { ...snap, ...next };
    subs.forEach((s) => s());
  };
  return {
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    get: () => snap,
    cancel() {
      abort?.abort();
      abort = null;
    },
    clear() {
      this.cancel();
      set({ state: "empty", error: null });
    },
    async start(input: DecodeInput, limits: DecodeLimits, decoder: Decoder, extractor: Extractor, count: number, alphaThreshold: number) {
      this.cancel();
      const ac = new AbortController();
      abort = ac;
      const requestId = snap.requestId + 1;
      set({ state: "decoding", error: null, requestId });
      try {
        const pixels = await decoder(input, limits, ac.signal);
        if (ac.signal.aborted) return;
        set({ state: "extracting" });
        const colors = await extractor({ ...pixels, count, alphaThreshold }, ac.signal);
        if (ac.signal.aborted) return;
        set({ state: "ready" });
        latest.current.onResult({ requestId, colors, width: pixels.width, height: pixels.height });
      } catch (e) {
        if (ac.signal.aborted) return;
        const error: ExtractionError = e && typeof e === "object" && "reason" in e ? (e as ExtractionError) : err("algorithm", e instanceof Error ? e.message : "Extraction failed.");
        set({ state: "error", error });
        latest.current.onError(error, requestId);
      } finally {
        if (abort === ac) abort = null;
      }
    },
  };
}

const SERVER_SNAP: Snapshot = { state: "empty", error: null, requestId: 0 };

function makeSlots(count: number, existing: readonly Swatch[] = [], labels?: readonly string[]): Swatch[] {
  return Array.from({ length: count }, (_, i) => {
    const prev = existing[i];
    const base: Swatch = prev ?? { id: `slot-${i + 1}`, color: null, locked: false, origin: "empty" };
    return labels?.[i] ? { ...base, label: labels[i] } : base;
  });
}

/**
 * PaletteComposer — extract an editable palette from a local image.
 *
 * Everything stays local: a decode adapter samples the image into a bounded
 * bitmap, an extractor returns representative colours, and only the newest
 * request may fill the unlocked slots. Edits commit once and are validated;
 * locks survive re-extraction; export is explicit and reports clipboard
 * failure with a selectable fallback.
 */
export const PaletteComposer = React.forwardRef<PaletteComposerHandle, PaletteComposerProps>(function PaletteComposer(
  {
    source: sourceProp,
    defaultSource = null,
    onSourceChange,
    palette: paletteProp,
    defaultPalette,
    onPaletteChange,
    extractor = defaultExtractor,
    decoder = browserDecoder,
    count = 6,
    sampleMaxSide = 256,
    maxFileBytes = 20 * 1048576,
    maxPixels = 24_000_000,
    alphaThreshold = 0.5,
    onExtractionError,
    onExtractionStateChange,
    exportPrefix = "palette",
    slotLabels,
    variant = "harvest",
    allowUrl = true,
    label = "Palette composer",
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  /* source */
  const [internalSource, setInternalSource] = React.useState<PaletteSource | null>(defaultSource);
  const source = sourceProp !== undefined ? sourceProp : internalSource;
  const setSource = (next: PaletteSource | null) => {
    if (sourceProp === undefined) setInternalSource(next);
    onSourceChange?.(next);
  };
  const file = source?.kind === "file" ? source.file : null;
  const canObjectUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  // Owned object URL for file sources; revoked when the file changes or on unmount.
  const objectUrl = React.useMemo(() => (file && canObjectUrl ? URL.createObjectURL(file) : null), [file, canObjectUrl]);
  React.useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);
  const previewUrl = source ? (source.kind === "url" ? source.url : objectUrl) : null;

  /* palette */
  const [internalPalette, setInternalPalette] = React.useState<Swatch[]>(() => makeSlots(count, defaultPalette, slotLabels));
  const palette = React.useMemo(() => makeSlots(count, paletteProp ?? internalPalette, slotLabels), [count, paletteProp, internalPalette, slotLabels]);
  const paletteRef = React.useRef(palette);
  React.useEffect(() => {
    paletteRef.current = palette;
  });
  const commitPalette = (next: Swatch[], meta: PaletteChangeMeta) => {
    if (paletteProp === undefined) setInternalPalette(next);
    onPaletteChange?.(next, meta);
  };

  /* flights (decorative) */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const tileRefs = React.useRef(new Map<string, HTMLElement>());
  const [flights, setFlights] = React.useState<{ key: string; color: string; from: { x: number; y: number }; to: { x: number; y: number }; delay: number }[]>([]);
  const [announcement, setAnnouncement] = React.useState("");

  /* extraction controller */
  const latest = React.useRef({
    onResult: (_r: Result) => {},
    onError: (_e: ExtractionError, _id: number) => {},
  });
  const [ctl] = React.useState(() => createExtractionController(latest));
  const snap = React.useSyncExternalStore(ctl.subscribe, ctl.get, () => SERVER_SNAP);
  const modeRef = React.useRef(mode);
  React.useEffect(() => {
    modeRef.current = mode;
    latest.current.onResult = (r) => {
      const cur = paletteRef.current;
      let k = 0;
      const next = cur.map((s) => {
        if (s.locked) return s;
        const c = r.colors[k++];
        return c ? { ...s, color: c.hex, origin: "extracted" as const } : { ...s, color: null, origin: "empty" as const };
      });
      commitPaletteRef.current(next, { reason: "extract", requestId: r.requestId });
      setAnnouncement(`Palette ready: ${Math.min(r.colors.length, cur.filter((s) => !s.locked).length)} colours extracted${r.colors.length < cur.filter((s) => !s.locked).length ? ", remaining slots unused" : ""}.`);
      if (modeRef.current !== "full") return;
      const root = rootRef.current?.getBoundingClientRect();
      const img = imgRef.current?.getBoundingClientRect();
      const rail = railRef.current?.getBoundingClientRect();
      if (!root || !rail || !rail.width) return;
      let j = 0;
      const fl: typeof flights = [];
      next.forEach((s) => {
        if (s.locked || !s.color) return;
        const c = r.colors[j++];
        const tile = tileRefs.current.get(s.id)?.getBoundingClientRect();
        if (!c || !tile || !tile.width) return;
        const from =
          img && img.width
            ? { x: img.left - root.left + (c.sample.x / r.width) * img.width, y: img.top - root.top + (c.sample.y / r.height) * img.height }
            : { x: rail.left - root.left + rail.width * ((j - 0.5) / Math.max(1, r.colors.length)), y: rail.top - root.top + rail.height / 2 };
        fl.push({ key: `${r.requestId}-${s.id}`, color: c.hex, from, to: { x: tile.left - root.left + tile.width / 2, y: tile.top - root.top + tile.height / 2 }, delay: (j - 1) * 0.03 });
      });
      setFlights(fl);
    };
    latest.current.onError = (e) => {
      setAnnouncement(e.message);
      onExtractionErrorRef.current?.(e);
    };
  });
  const commitPaletteRef = React.useRef(commitPalette);
  const onExtractionErrorRef = React.useRef(onExtractionError);
  React.useEffect(() => {
    commitPaletteRef.current = commitPalette;
    onExtractionErrorRef.current = onExtractionError;
  });

  const sourceKey = source ? `${source.kind}:${source.revision}` : "";
  const decodeUrl = source?.kind === "url" ? source.url : objectUrl;
  React.useEffect(() => {
    if (!source || !decodeUrl) {
      ctl.clear();
      return;
    }
    void ctl.start({ url: decodeUrl, file: source.kind === "file" ? source.file : undefined, kind: source.kind }, { sampleMaxSide, maxFileBytes, maxPixels }, decoder, extractor, count, alphaThreshold);
    return () => ctl.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on a new source revision only
  }, [sourceKey, decodeUrl, ctl]);
  const stateRef = React.useRef(snap.state);
  React.useEffect(() => {
    if (stateRef.current !== snap.state) {
      stateRef.current = snap.state;
      onExtractionStateChange?.(snap.state);
    }
  }, [snap.state, onExtractionStateChange]);
  React.useEffect(() => () => ctl.cancel(), [ctl]);

  /* inputs */
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [urlText, setUrlText] = React.useState("");
  const [urlInvalid, setUrlInvalid] = React.useState(false);
  const revision = React.useRef(0);
  const nextRevision = () => `r${++revision.current}-${Date.now()}`;
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusSourceInput: () => fileInputRef.current?.focus() }), []);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFlights([]);
    setSource({ kind: "file", file: f, revision: nextRevision(), alt: f.name });
  };
  const loadUrl = () => {
    const t = urlText.trim();
    if (!/^https?:\/\/\S+$/i.test(t)) {
      setUrlInvalid(true);
      return;
    }
    setUrlInvalid(false);
    setFlights([]);
    setSource({ kind: "url", url: t, revision: nextRevision() });
  };
  const removeSource = () => {
    ctl.clear();
    setFlights([]);
    setSource(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAnnouncement("Source removed.");
  };

  /* editing */
  const setSlot = (id: string, patch: Partial<Swatch>, reason: PaletteChangeMeta["reason"]) => commitPalette(palette.map((s) => (s.id === id ? { ...s, ...patch } : s)), { reason });

  /* export */
  const css = React.useMemo(() => toCssVariables(palette, exportPrefix), [palette, exportPrefix]);
  const hexList = palette.filter((s) => s.color).map((s) => s.color).join(", ");
  const [exportOpen, setExportOpen] = React.useState(variant === "editor");
  const [copyStatus, setCopyStatus] = React.useState<{ ok: boolean; text: string } | null>(null);
  const copy = async (text: string, what: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setCopyStatus({ ok: true, text: `${what} copied.` });
    } catch {
      setCopyStatus({ ok: false, text: `Could not copy ${what.toLowerCase()}: clipboard access was denied. Select the text below instead.` });
      setExportOpen(true);
    }
  };

  const uid = React.useId();
  const busy = snap.state === "decoding" || snap.state === "extracting";
  const statusText =
    snap.state === "decoding" ? "Decoding image…" : snap.state === "extracting" ? "Extracting colours…" : snap.state === "error" ? (snap.error?.message ?? "Extraction failed.") : announcement;

  return (
    <div
      ref={rootRef}
      data-slot="palette-composer"
      data-variant={variant}
      data-motion={mode}
      data-state={snap.state}
      role="group"
      aria-label={label}
      className={cn("relative flex w-full flex-col gap-[var(--cui-palette-gap,16px)] text-[var(--cui-palette-text,light-dark(#141311,#ecebe6))]", variant === "editor" && "md:grid md:grid-cols-[220px_1fr] md:items-start", className)}
      {...rest}
    >
      {/* source */}
      <div className="flex flex-col gap-3">
        <div ref={previewRef} className={cn("relative overflow-hidden rounded-2xl bg-[var(--cui-palette-surface,light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06)))]", variant === "editor" ? "aspect-square" : "aspect-[4/3]")} aria-busy={busy || undefined}>
          {previewUrl ? (
            <img ref={imgRef} src={previewUrl} alt={source?.alt ?? "Source image"} className="size-full object-contain" />
          ) : (
            <div className="grid size-full place-items-center p-6 text-center text-[13px] text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]">No image. Choose a local file{allowUrl ? " or load a URL" : ""}.</div>
          )}
          {busy && (
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-[light-dark(rgba(20,19,17,0.1),rgba(236,235,230,0.1))]">
              <m.div className="h-full w-1/3 bg-[var(--cui-palette-accent,light-dark(#141311,#ecebe6))]" animate={mode === "full" ? { x: ["-100%", "300%"] } : { x: "100%" }} transition={mode === "full" ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} />
            </div>
          )}
        </div>
        {/* extraction rail: disc origin when no true sample location exists */}
        <div ref={railRef} aria-hidden className="h-1.5 rounded-full bg-[var(--cui-palette-surface,light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06)))]" />
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--cui-palette-border,light-dark(rgba(20,19,17,0.2),rgba(236,235,230,0.2)))] px-3 py-1.5 focus-within:ring-2 focus-within:ring-[var(--cui-palette-focus,light-dark(#141311,#ecebe6))]">
            <span>Choose image</span>
            <input ref={fileInputRef} type="file" accept="image/*" aria-label="Choose image" onChange={onFile} className="sr-only" />
          </label>
          {allowUrl && (
            <form
              className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                loadUrl();
              }}
            >
              <input
                type="url"
                aria-label="Image URL"
                aria-invalid={urlInvalid || undefined}
                placeholder="https://…/image.png"
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                className={cn("h-8 min-w-0 flex-1 rounded-md border bg-[var(--cui-palette-input,light-dark(#faf9f6,#1f1f1c))] px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-palette-focus,light-dark(#141311,#ecebe6))]", urlInvalid ? "border-[var(--cui-palette-error,light-dark(#b8310c,#ff8a65))]" : "border-[var(--cui-palette-input-border,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))]")}
              />
              <button type="submit" className={BTN}>
                Load URL
              </button>
            </form>
          )}
          {source && (
            <button type="button" onClick={removeSource} className={BTN}>
              Remove source
            </button>
          )}
        </div>
        <div role="status" aria-live="polite" className={cn("min-h-[1.5rem] text-[12px]", snap.state === "error" ? "text-[var(--cui-palette-error,light-dark(#b8310c,#ff8a65))]" : "opacity-80")}>
          {statusText}
          {snap.state === "error" && snap.error?.reason === "cors" && (
            <>
              {" "}
              <button type="button" className="underline" onClick={() => fileInputRef.current?.click()}>
                Choose a local file
              </button>
            </>
          )}
        </div>
      </div>

      {/* swatches */}
      <div className="flex flex-col gap-3">
        <ul className={cn("grid gap-[var(--cui-palette-gap,16px)]", variant === "editor" ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3")} aria-label="Palette slots">
          {palette.map((s, i) => (
            <SwatchTile
              key={s.id}
              ref={(el) => {
                if (el) tileRefs.current.set(s.id, el);
                else tileRefs.current.delete(s.id);
              }}
              index={i}
              swatch={s}
              variant={variant}
              uid={uid}
              onLock={(locked) => setSlot(s.id, { locked }, locked ? "lock" : "unlock")}
              onColor={(color) => setSlot(s.id, { color, origin: "edited" }, "edit")}
              onClear={() => setSlot(s.id, { color: null, origin: "empty" }, "clear")}
            />
          ))}
        </ul>

        {/* export */}
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <button type="button" className={BTN} onClick={() => void copy(css, "CSS variables")} disabled={!palette.some((s) => s.color)}>
            Copy CSS
          </button>
          <button type="button" className={BTN} onClick={() => void copy(hexList, "Hex list")} disabled={!palette.some((s) => s.color)}>
            Copy hex list
          </button>
          <button type="button" className={BTN} aria-expanded={exportOpen} aria-controls={`${uid}-export`} onClick={() => setExportOpen((o) => !o)}>
            {exportOpen ? "Hide CSS" : "Show CSS"}
          </button>
          {copyStatus && (
            <span role="status" className={cn(copyStatus.ok ? "opacity-80" : "text-[var(--cui-palette-error,light-dark(#b8310c,#ff8a65))]")}>
              {copyStatus.text}
            </span>
          )}
        </div>
        <textarea id={`${uid}-export`} readOnly aria-label="CSS export" hidden={!exportOpen} value={css} rows={count + 2} className="w-full rounded-lg border border-[var(--cui-palette-input-border,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))] bg-[var(--cui-palette-input,light-dark(#faf9f6,#1f1f1c))] p-2 font-mono text-[12px]" onFocus={(e) => e.currentTarget.select()} />
      </div>

      {/* decorative discs */}
      <AnimatePresence>
        {flights.map((f) => (
          <m.span
            key={f.key}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 size-5 rounded-full shadow-md"
            style={{ background: f.color }}
            initial={{ x: f.from.x - 10, y: f.from.y - 10, scale: 0.6, opacity: 0 }}
            animate={{ x: f.to.x - 10, y: f.to.y - 10, scale: 1.4, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.38, delay: f.delay, ease: [0.3, 0.9, 0.3, 1] }}
            onAnimationComplete={() => setFlights((all) => all.filter((x) => x.key !== f.key))}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});
PaletteComposer.displayName = "PaletteComposer";

const BTN =
  "inline-flex h-8 items-center rounded-full border border-[var(--cui-palette-border,light-dark(rgba(20,19,17,0.2),rgba(236,235,230,0.2)))] px-3 text-[13px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06))] focus-visible:ring-2 focus-visible:ring-[var(--cui-palette-focus,light-dark(#141311,#ecebe6))] disabled:cursor-not-allowed disabled:opacity-40";

const SwatchTile = React.forwardRef<HTMLLIElement, { index: number; swatch: Swatch; variant: PaletteComposerVariant; uid: string; onLock: (locked: boolean) => void; onColor: (hex: string) => void; onClear: () => void }>(function SwatchTile({ index, swatch, variant, uid, onLock, onColor, onClear }, ref) {
  const name = swatch.label ?? `Slot ${index + 1}`;
  const [text, setText] = React.useState(swatch.color ?? "");
  const [invalid, setInvalid] = React.useState(false);
  const [synced, setSynced] = React.useState(swatch.color);
  if (synced !== swatch.color) {
    setSynced(swatch.color);
    setText(swatch.color ?? "");
    setInvalid(false);
  }
  const commit = () => {
    const t = text.trim();
    if (!t) {
      if (swatch.color) onClear();
      setInvalid(false);
      return;
    }
    const rgb = parseColor(t);
    if (!rgb) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const hex = hexOf(rgb);
    if (hex !== swatch.color) onColor(hex);
    else setText(hex);
  };
  const rgb = swatch.color ? parseColor(swatch.color) : null;
  const dark = rgb ? luminance(rgb) < 0.4 : false;
  return (
    <li ref={ref} data-slot-id={swatch.id} data-locked={swatch.locked || undefined} data-origin={swatch.origin} className={cn("flex flex-col overflow-hidden rounded-2xl border bg-[var(--cui-palette-input,light-dark(#faf9f6,#1f1f1c))]", swatch.locked ? "border-[var(--cui-palette-accent,light-dark(#141311,#ecebe6))]" : "border-[var(--cui-palette-border,light-dark(rgba(20,19,17,0.2),rgba(236,235,230,0.2)))]")}>
      <div aria-hidden className={cn("relative", variant === "editor" ? "h-12" : "h-20")} style={{ background: swatch.color ?? "repeating-linear-gradient(45deg, light-dark(rgba(20,19,17,0.06), rgba(236,235,230,0.06)) 0 8px, transparent 8px 16px)" }}>
        {swatch.locked && (
          <span className={cn("absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", dark ? "bg-white/85 text-[#141311]" : "bg-[#141311]/85 text-white")}>Locked</span>
        )}
        {!swatch.color && <span className="absolute inset-0 grid place-items-center text-[11px] uppercase tracking-wide text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]">Unused</span>}
      </div>
      {/* label surface: never on the swatch colour */}
      <div className="flex items-center gap-1 p-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium opacity-70">{name}</div>
          <input
            id={`${uid}-${swatch.id}`}
            type="text"
            aria-label={`${name} colour`}
            aria-invalid={invalid || undefined}
            placeholder="#rrggbb"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            className={cn("h-7 w-full rounded-md border bg-transparent px-1.5 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-palette-focus,light-dark(#141311,#ecebe6))]", invalid ? "border-[var(--cui-palette-error,light-dark(#b8310c,#ff8a65))]" : "border-[var(--cui-palette-input-border,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))]")}
          />
        </div>
        <button
          type="button"
          aria-pressed={swatch.locked}
          aria-label={`Lock ${name}`}
          onClick={() => onLock(!swatch.locked)}
          className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[13px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.08),rgba(236,235,230,0.08))] focus-visible:ring-2 focus-visible:ring-[var(--cui-palette-focus,light-dark(#141311,#ecebe6))]", swatch.locked && "bg-[var(--cui-palette-accent,light-dark(#141311,#ecebe6))] text-[light-dark(#faf9f6,#141311)]")}
        >
          {swatch.locked ? "🔒" : "🔓"}
        </button>
      </div>
    </li>
  );
});

/** Exposed for hosts that want to validate a user colour the same way. */
export const isValidSwatchColor = isHexColor;
