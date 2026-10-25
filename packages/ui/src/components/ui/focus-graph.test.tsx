import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FocusGraph, type FocusGraphHandle, type GraphEdge, type GraphNode } from "./focus-graph";
import { forceLayout, validateGraph } from "@/lib/graph-model";

const NODES: GraphNode[] = [
  { id: "app", label: "App", category: "service", description: "The web app" },
  { id: "api", label: "API", category: "service" },
  { id: "db", label: "Database", category: "store" },
  { id: "cache", label: "Cache", category: "store" },
  { id: "docs", label: "Docs", category: "site" },
];
const EDGES: GraphEdge[] = [
  { id: "e1", source: "app", target: "api" },
  { id: "e2", source: "api", target: "db" },
  { id: "e3", source: "api", target: "cache" },
  { id: "e4", source: "db", target: "api" }, // cycle
  { id: "bad", source: "api", target: "ghost" },
];
const POS = { app: { x: 100, y: 100 }, api: { x: 300, y: 100 }, db: { x: 500, y: 100 }, cache: { x: 300, y: 300 }, docs: { x: 100, y: 300 } };

const Graph = (props: Partial<React.ComponentProps<typeof FocusGraph>>) => <FocusGraph nodes={NODES} edges={EDGES} motion="off" {...props} />;
const details = () => within(document.querySelector("[data-details]") as HTMLElement);
const nodeEl = (id: string) => document.querySelector(`[data-node="${id}"]`) as SVGGElement;

describe("FocusGraph", () => {
  it("validates edges with an explicit diagnostic and keeps the rest (C56-T01)", () => {
    render(<Graph />);
    expect(screen.getByRole("note")).toHaveTextContent('Edge "bad" references a missing node (ghost).');
    expect(document.querySelectorAll("[data-edge]")).toHaveLength(4);
    expect(screen.getByText(/5 of 5 nodes · 4 edges · 1 invalid/)).toBeInTheDocument();
  });

  it("list and canvas selection expose the same neighbours and details (C56-T02)", async () => {
    const onSel = vi.fn();
    render(<Graph onSelectedIdChange={onSel} />);
    await userEvent.click(within(screen.getByRole("list", { name: "Nodes" })).getByRole("button", { name: "API" }));
    expect(onSel).toHaveBeenLastCalledWith("api", "list");
    expect(details().getByText("Connected to (3)")).toBeInTheDocument();
    const fromList = within(details().getByRole("list", { name: "Connected to" })).getAllByRole("button").map((b) => b.textContent);
    expect(fromList).toEqual(["App", "Database", "Cache"]);
    expect(nodeEl("api")).toHaveAttribute("data-selected", "true");
    expect(nodeEl("docs")).toHaveAttribute("data-muted", "true");
    await userEvent.click(within(screen.getByRole("list", { name: "Nodes" })).getByRole("button", { name: "API" })); // clear
    expect(onSel).toHaveBeenLastCalledWith(null, "clear");
    fireEvent.click(nodeEl("api"));
    expect(onSel).toHaveBeenLastCalledWith("api", "canvas");
    expect(within(details().getByRole("list", { name: "Connected to" })).getAllByRole("button").map((b) => b.textContent)).toEqual(fromList);
    // neighbour buttons select too
    await userEvent.click(within(details().getByRole("list", { name: "Connected to" })).getByRole("button", { name: "Cache" }));
    expect(onSel).toHaveBeenLastCalledWith("cache", "neighbor");
  });

  it("directed graphs distinguish inbound and outbound (C56-T03)", async () => {
    render(<Graph directed />);
    await userEvent.click(within(screen.getByRole("list", { name: "Nodes" })).getByRole("button", { name: "API" }));
    expect(within(details().getByRole("list", { name: "Depends on" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["Database", "Cache"]);
    expect(within(details().getByRole("list", { name: "Used by" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["App", "Database"]);
    expect(document.querySelector("marker")).not.toBeNull();
  });

  it("the layout is bounded by the settle budget and deterministic (C56-T04)", () => {
    const g = validateGraph(NODES, EDGES);
    const a = forceLayout(g.nodes, g.edges, { seed: 1, width: 720, height: 480, maxIterations: 300 });
    expect(a.iterations).toBeLessThanOrEqual(300);
    render(<Graph settleBudget={300} />);
    const root = document.querySelector('[data-slot="focus-graph"]')!;
    expect(root).toHaveAttribute("data-layout", "seeded-force");
    expect(nodeEl("app").style.transform).toContain(`translateX(${a.positions.app!.x}px)`);
    const { unmount } = render(<Graph settleBudget={3} />);
    expect(document.querySelectorAll('[data-slot="focus-graph"]')[1]).not.toHaveAttribute("data-settled");
    unmount();
  });

  it("deleting the selected node clears details and announces it (C56-T05)", async () => {
    const onSel = vi.fn();
    const { rerender } = render(<Graph defaultSelectedId="cache" onSelectedIdChange={onSel} />);
    expect(details().getByText("Cache")).toBeInTheDocument();
    rerender(<Graph nodes={NODES.filter((n) => n.id !== "cache")} onSelectedIdChange={onSel} />);
    expect(details().getByText(/"cache" was removed/)).toBeInTheDocument();
    expect(details().getByText("Select a node to see its neighbours.")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent('Edge "e3" references a missing node (cache).');
    expect(document.querySelector('[data-node="cache"]')).toBeNull();
    expect(document.querySelectorAll("[data-node]")).toHaveLength(4);
    expect(onSel).toHaveBeenCalledWith(null, "removed");
  });

  it("zoom, pan, fit and focus only change the viewBox; relationships are untouched (C56-T06)", async () => {
    const edges = EDGES.map((e) => ({ ...e }));
    render(<Graph edges={edges} />);
    const svg = document.querySelector("[data-canvas]")!;
    const before = svg.getAttribute("viewBox");
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(svg.getAttribute("viewBox")).not.toBe(before);
    await userEvent.click(screen.getByRole("button", { name: "Pan left" }));
    await userEvent.click(screen.getByRole("button", { name: "Fit" }));
    await userEvent.click(within(screen.getByRole("list", { name: "Nodes" })).getByRole("button", { name: "Docs" }));
    const vbBeforeFocus = svg.getAttribute("viewBox");
    await userEvent.click(details().getByRole("button", { name: "Focus" }));
    expect(svg.getAttribute("viewBox")).not.toBe(vbBeforeFocus);
    expect(edges).toEqual(EDGES);
    expect(document.querySelectorAll("[data-edge]")).toHaveLength(4);
  });

  it("search filters the list without hiding data; a narrow layout is list-first (C56-T07)", async () => {
    render(<Graph />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search nodes" }), "ca");
    const list = within(screen.getByRole("list", { name: "Nodes" }));
    expect(list.getAllByRole("button").map((b) => b.textContent)).toEqual(["Cache"]);
    expect(screen.getByText(/1 of 5 nodes match/)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-node]")).toHaveLength(5); // graph data untouched
    await userEvent.click(list.getByRole("button", { name: "Cache" }));
    expect(within(details().getByRole("list", { name: "Connected to" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["API"]);
  });

  it("authored positions are used verbatim (C56-T08) and reduced motion skips the settle animation (C56-T09)", () => {
    render(<Graph layout="authored" positions={POS} motion="reduced" />);
    const root = document.querySelector('[data-slot="focus-graph"]')!;
    expect(root).toHaveAttribute("data-layout", "authored");
    expect(root).toHaveAttribute("data-motion", "reduced");
    expect(nodeEl("db").style.transform).toContain("translateX(500px)");
    expect(nodeEl("db").style.transform).toContain("translateY(100px)");
    expect(screen.queryByRole("button", { name: "Reset layout" })).toBeNull();
  });

  it("dragging a node pins it locally and Reset layout discards pins", async () => {
    render(<Graph />);
    const g = nodeEl("app");
    g.setPointerCapture = () => {};
    g.releasePointerCapture = () => {};
    const before = g.style.transform;
    fireEvent.pointerDown(g, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerMove(g, { clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(g, { clientX: 50, clientY: 60, pointerId: 1 });
    expect(nodeEl("app").style.transform).not.toBe(before);
    const reset = screen.getByRole("button", { name: "Reset layout" });
    expect(reset).toBeEnabled();
    await userEvent.click(reset);
    expect(nodeEl("app").style.transform).toBe(before);
  });

  it("exposes focusNode and fitViewport and renders a legend", () => {
    const ref = { current: null as FocusGraphHandle | null };
    render(<Graph ref={ref} />);
    expect(within(screen.getByRole("list", { name: "Legend" })).getAllByRole("listitem").map((l) => l.textContent)).toEqual(["service", "store", "site"]);
    act(() => ref.current!.focusNode("db"));
    expect(within(screen.getByRole("list", { name: "Nodes" })).getByRole("button", { name: "Database" })).toHaveFocus();
    expect(details().getByText("Database")).toBeInTheDocument();
    act(() => ref.current!.fitViewport());
  });
});
