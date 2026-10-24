import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom has no layout, canvas or animation frame scheduling. The component
// treats all three as optional, but tests still need deterministic stubs.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.cb(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });
Object.defineProperty(globalThis, "IntersectionObserver", {
  value: IntersectionObserverStub,
  writable: true,
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Canvas 2D: provide a minimal no-op context so render code can run without node-canvas.
const noop = () => {};
const ctxStub = new Proxy(
  {},
  {
    get(_t, key) {
      if (key === "canvas") return undefined;
      if (key === "measureText") return () => ({ width: 0 });
      if (key === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (key === "createLinearGradient" || key === "createRadialGradient")
        return () => ({ addColorStop: noop });
      return noop;
    },
    set() {
      return true;
    },
  },
);
HTMLCanvasElement.prototype.getContext = (() => ctxStub) as unknown as typeof HTMLCanvasElement.prototype.getContext;

afterEach(() => cleanup());
