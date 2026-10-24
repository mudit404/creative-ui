import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FieldMagnet } from "./field-magnet";

function fire(type: string, init: PointerEventInit) {
  const ev = new MouseEvent(type, { bubbles: true, ...init }) as MouseEvent & { pointerType: string };
  Object.defineProperty(ev, "pointerType", { value: init.pointerType ?? "mouse" });
  window.dispatchEvent(ev);
}

describe("FieldMagnet", () => {
  it("renders children with their semantics intact", () => {
    render(
      <FieldMagnet>
        <button type="button">Hire us</button>
      </FieldMagnet>,
    );
    expect(screen.getByRole("button", { name: "Hire us" })).toBeInTheDocument();
    expect(screen.getByRole("button").closest('[data-slot="field-magnet"]')).toHaveAttribute("data-motion", "full");
  });

  it("uses the child as the moving element with asChild", () => {
    const { container } = render(
      <FieldMagnet asChild>
        <a href="/x">Link</a>
      </FieldMagnet>,
    );
    const frame = container.querySelector('[data-slot="field-magnet"]')!;
    expect(frame.firstElementChild?.tagName).toBe("A");
  });

  it("disables the pull under reduced motion, off, and disabled", () => {
    const { container, rerender } = render(<FieldMagnet motion="reduced">x</FieldMagnet>);
    expect(container.querySelector('[data-slot="field-magnet"]')).toHaveAttribute("data-motion", "reduced");
    rerender(<FieldMagnet motion="off">x</FieldMagnet>);
    expect(container.querySelector('[data-slot="field-magnet"]')).toHaveAttribute("data-motion", "off");
    rerender(<FieldMagnet disabled>x</FieldMagnet>);
    expect(container.querySelector('[data-slot="field-magnet"]')).toHaveAttribute("data-motion", "full");
  });

  it("marks itself active when the pointer enters the field and idle when it leaves", async () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(performance.now());
      return 1;
    });
    try {
      const { container } = render(
        <FieldMagnet radius={100}>
          <button type="button">Hire us</button>
        </FieldMagnet>,
      );
      const frame = container.querySelector('[data-slot="field-magnet"]') as HTMLElement;
      frame.getBoundingClientRect = () => ({ left: 100, top: 100, width: 120, height: 40, right: 220, bottom: 140, x: 100, y: 100, toJSON: () => ({}) });
      await act(async () => {
        fire("pointermove", { clientX: 160, clientY: 60 });
      });
      expect(frame).toHaveAttribute("data-active", "true");
      await act(async () => {
        fire("pointermove", { clientX: 900, clientY: 900 });
      });
      expect(frame).toHaveAttribute("data-active", "false");
    } finally {
      rafSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("unmounts cleanly", () => {
    const { unmount } = render(<FieldMagnet>x</FieldMagnet>);
    expect(() => unmount()).not.toThrow();
  });
});
