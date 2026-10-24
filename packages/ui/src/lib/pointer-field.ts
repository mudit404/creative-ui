/**
 * A single shared pointer tracker. Components subscribe instead of attaching
 * their own window listeners, so a page with fifty animated controls still
 * registers one `pointermove` handler. Listeners are attached lazily on the
 * first subscriber and removed with the last.
 */

export interface PointerSnapshot {
  x: number;
  y: number;
  /** Whether a pointer is currently over the document (touch: while pressed). */
  present: boolean;
  /** Coarse pointer (touch) vs fine (mouse, pen). */
  coarse: boolean;
  down: boolean;
}

type Listener = (p: PointerSnapshot) => void;

const state: PointerSnapshot = { x: -1e4, y: -1e4, present: false, coarse: false, down: false };
const listeners = new Set<Listener>();
let attached = false;

function emit() {
  for (const l of listeners) l(state);
}

function onMove(e: PointerEvent) {
  state.x = e.clientX;
  state.y = e.clientY;
  state.coarse = e.pointerType === "touch";
  state.present = e.pointerType === "touch" ? state.down : true;
  emit();
}
function onDown(e: PointerEvent) {
  state.down = true;
  state.x = e.clientX;
  state.y = e.clientY;
  state.coarse = e.pointerType === "touch";
  state.present = true;
  emit();
}
function onUp(e: PointerEvent) {
  state.down = false;
  if (e.pointerType === "touch") state.present = false;
  emit();
}
function onLeave() {
  state.present = false;
  emit();
}
function onVisibility() {
  if (document.visibilityState === "hidden") onLeave();
}

function attach() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  const opts: AddEventListenerOptions = { passive: true };
  window.addEventListener("pointermove", onMove, opts);
  window.addEventListener("pointerdown", onDown, opts);
  window.addEventListener("pointerup", onUp, opts);
  window.addEventListener("pointercancel", onUp, opts);
  document.documentElement.addEventListener("pointerleave", onLeave, opts);
  window.addEventListener("blur", onLeave);
  document.addEventListener("visibilitychange", onVisibility);
}
function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerdown", onDown);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onUp);
  document.documentElement.removeEventListener("pointerleave", onLeave);
  window.removeEventListener("blur", onLeave);
  document.removeEventListener("visibilitychange", onVisibility);
}

/** Subscribe to pointer updates. Returns an unsubscribe function. */
export function subscribePointer(listener: Listener): () => void {
  listeners.add(listener);
  attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

export function getPointer(): PointerSnapshot {
  return state;
}
