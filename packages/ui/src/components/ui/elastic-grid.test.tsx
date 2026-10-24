import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ElasticGrid, ElasticGridItem } from "./elastic-grid";

function Grid({ items = ["A", "B", "C", "D", "E", "F"], ...props }: Partial<React.ComponentProps<typeof ElasticGrid>> & { items?: string[] }) {
  return (
    <ElasticGrid columns={3} motion="off" aria-label="Catalog" {...props}>
      {items.map((t) => (
        <ElasticGridItem key={t} aspect="4 / 3">
          <a href={`#${t}`}>{t}</a>
        </ElasticGridItem>
      ))}
    </ElasticGrid>
  );
}

function fire(type: string, init: MouseEventInit & { pointerType?: string }) {
  const ev = new MouseEvent(type, { bubbles: true, ...init }) as MouseEvent & { pointerType: string };
  Object.defineProperty(ev, "pointerType", { value: init.pointerType ?? "mouse" });
  window.dispatchEvent(ev);
}

describe("ElasticGrid", () => {
  it("renders a list of cells with their column index", () => {
    render(<Grid />);
    const list = screen.getByRole("list", { name: "Catalog" });
    expect(list).toHaveAttribute("data-columns", "3");
    const cells = screen.getAllByRole("listitem");
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveAttribute("data-column", "0");
    expect(cells[4]).toHaveAttribute("data-column", "1");
    expect(cells[0]).toHaveStyle({ aspectRatio: "4 / 3" });
  });

  it("uses equal fixed tracks when motion is off and derives columns from a prop", () => {
    render(<Grid columns={4} />);
    expect(screen.getByRole("list")).toHaveStyle({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" });
  });

  it("removes filtered cells immediately with motion off", () => {
    const { rerender } = render(<Grid />);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    rerender(<Grid items={["A", "C", "E"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("C").closest("li")).toHaveAttribute("data-column", "1");
  });

  it("stretches the column under the pointer and settles when it leaves", async () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(performance.now());
      return 1;
    });
    try {
      render(<Grid motion="auto" stretch={0.5} />);
      const list = screen.getByRole("list");
      list.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
      await act(async () => fire("pointermove", { clientX: 250, clientY: 100 }));
      expect(list).toHaveAttribute("data-active-column", "2");
      await waitFor(() => {
        const cols = list.style.gridTemplateColumns.split(" ").map(parseFloat);
        expect(cols).toHaveLength(3);
        expect(cols[2]!).toBeGreaterThan(cols[0]!);
      });
      await act(async () => fire("pointermove", { clientX: 900, clientY: 900 }));
      expect(list).not.toHaveAttribute("data-active-column");
      await waitFor(() => {
        const cols = list.style.gridTemplateColumns.split(" ").map(parseFloat);
        expect(Math.abs(cols[2]! - cols[0]!)).toBeLessThan(0.01);
      });
    } finally {
      rafSpy.mockRestore();
    }
  });

  it("stretches the column holding keyboard focus", async () => {
    render(<Grid motion="auto" />);
    const list = screen.getByRole("list");
    act(() => screen.getByText("B").focus());
    expect(list).toHaveAttribute("data-active-column", "1");
    expect(screen.getByText("B").closest("li")).toHaveAttribute("data-hovered", "true");
    act(() => screen.getByText("B").blur());
    expect(list).not.toHaveAttribute("data-active-column");
  });

  it("disables stretch under reduced motion", async () => {
    render(<Grid motion="reduced" />);
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("data-motion", "reduced");
    act(() => screen.getByText("B").focus());
    expect(list).not.toHaveAttribute("data-active-column");
    expect(list).toHaveStyle({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" });
  });

  it("forwards refs and unmounts cleanly", () => {
    const ref = { current: null as HTMLUListElement | null };
    const { unmount } = render(<Grid ref={ref} motion="auto" />);
    expect(ref.current?.tagName).toBe("UL");
    expect(() => unmount()).not.toThrow();
  });
});
