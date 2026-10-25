import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D } from "three";
import { ExplodedProduct, type ExplodedProductHandle, type ModelSource, type PartDefinition } from "./exploded-product";

function build(): { root: Group; nodes: Record<string, Mesh> } {
  const root = new Group();
  const body = new Group();
  body.name = "Body";
  body.scale.setScalar(2);
  const nodes: Record<string, Mesh> = {};
  const mk = (name: string, parent: Object3D, y: number) => {
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#888" }));
    m.name = name;
    m.position.set(0, y, 0);
    parent.add(m);
    nodes[name] = m;
    return m;
  };
  mk("Shell", body, 0);
  mk("Cap", body, 1);
  mk("Base", root, -1);
  root.add(body);
  return { root, nodes };
}
const PARTS: PartDefinition[] = [
  { id: "shell", nodePath: "Body/Shell", label: "Shell", description: "Outer casing.", offset: [0, 0, 1] },
  { id: "cap", nodePath: "Body/Cap", label: "Cap", description: "Top cap.", offset: [0, 1, 0] },
  { id: "base", nodePath: "Base", label: "Base", offset: [0, -1, 0] },
];

const Product = (props: Partial<React.ComponentProps<typeof ExplodedProduct>> & { model: ModelSource }) => <ExplodedProduct poster="/poster.png" alt="A lamp" parts={PARTS} motion="off" renderer="none" {...props} />;
const ready = () => waitFor(() => expect(document.querySelector('[data-slot="exploded-product"]')).toHaveAttribute("data-state", "fallback"));

describe("ExplodedProduct", () => {
  it("renders poster and parts list first, then maps parts and falls back without WebGL", async () => {
    const onReady = vi.fn();
    const { nodes } = build();
    render(<Product model={{ kind: "scene", build: () => build().root }} onReady={onReady} />);
    expect(screen.getByRole("img", { name: "A lamp" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: /Parts/ })).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Assemble" })).toBeDisabled();
    await ready();
    expect(onReady).toHaveBeenCalledWith(["shell", "cap", "base"]);
    expect(screen.getByRole("status")).toHaveTextContent("3D rendering is unavailable");
    expect(screen.getByRole("button", { name: "Explode" })).toBeEnabled();
    expect(nodes.Cap!.position.y).toBe(1);
  });

  it("derives positions from rest + offset × progress and restores exactly (C51-T01, C51-T02)", async () => {
    const built = build();
    const onProgress = vi.fn();
    render(<Product model={{ kind: "scene", build: () => built.root }} onProgressChange={onProgress} />);
    await ready();
    const explode = screen.getByRole("button", { name: "Explode" });
    const assemble = screen.getByRole("button", { name: "Assemble" });
    await userEvent.click(explode);
    expect(onProgress).toHaveBeenLastCalledWith(1, "button");
    expect(built.nodes.Cap!.position.y).toBe(2); // parent-local +1 (parent scaled ×2 does not double it)
    expect(built.nodes.Shell!.position.z).toBe(1);
    for (let i = 0; i < 100; i++) {
      await userEvent.click(assemble);
      await userEvent.click(explode);
    }
    await userEvent.click(assemble);
    expect(built.nodes.Cap!.position.toArray()).toEqual([0, 1, 0]);
    expect(built.nodes.Shell!.position.toArray()).toEqual([0, 0, 0]);
    fireEvent.change(screen.getByRole("slider", { name: "Assembly" }), { target: { value: "0.5" } });
    expect(onProgress).toHaveBeenLastCalledWith(0.5, "slider");
    expect(built.nodes.Cap!.position.y).toBe(1.5);
    expect(document.querySelector('[data-slot="exploded-product"]')).toHaveAttribute("data-progress", "0.50");
  });

  it("reports a missing part path and keeps the list readable (C51-T03)", async () => {
    const onErr = vi.fn();
    render(<Product model={{ kind: "scene", build: () => build().root }} parts={[...PARTS, { id: "ghost", nodePath: "Body/Ghost", label: "Ghost", offset: [1, 0, 0] }]} onAssetError={onErr} />);
    await ready();
    expect(screen.getByRole("note")).toHaveTextContent('Part "ghost": path "Body/Ghost" did not resolve');
    expect(onErr).toHaveBeenCalledWith(expect.objectContaining({ reason: "parts" }));
    const ghost = screen.getByRole("button", { name: /Ghost/ });
    expect(ghost).toHaveAccessibleDescription(/did not resolve/);
    expect(within(screen.getByRole("list", { name: /Parts/ })).getAllByRole("button")).toHaveLength(4);
  });

  it("list selection highlights the part and shows its description (C51-T04)", async () => {
    const built = build();
    const onSel = vi.fn();
    render(<Product model={{ kind: "scene", build: () => built.root }} onSelectedIdChange={onSel} />);
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Cap" }));
    expect(onSel).toHaveBeenCalledWith("cap", "list");
    expect(screen.getByRole("button", { name: "Cap" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("[data-details]")).toHaveTextContent("Top cap.");
    const mat = built.nodes.Cap!.material as MeshStandardMaterial;
    expect(mat.emissiveIntensity).toBeGreaterThan(0);
    expect((built.nodes.Shell!.material as MeshStandardMaterial).emissiveIntensity).toBe(0);
  });

  it("two instances own separate transforms and materials (C51-T06)", async () => {
    const a = build();
    const b = build();
    render(
      <>
        <Product model={{ kind: "scene", build: () => a.root }} label="A" defaultProgress={1} />
        <Product model={{ kind: "scene", build: () => b.root }} label="B" />
      </>,
    );
    await waitFor(() => expect(document.querySelectorAll('[data-state="fallback"]')).toHaveLength(2));
    expect(a.nodes.Cap!.position.y).toBe(2);
    expect(b.nodes.Cap!.position.y).toBe(1);
    expect(a.nodes.Cap!.material).not.toBe(b.nodes.Cap!.material);
  });

  it("model replacement clears the selection only when its id no longer exists (C51-T08)", async () => {
    const onSel = vi.fn();
    const first = build();
    const { rerender } = render(<Product model={{ kind: "scene", build: () => first.root }} defaultSelectedId="cap" onSelectedIdChange={onSel} />);
    await ready();
    const second = build();
    rerender(<Product model={{ kind: "scene", build: () => second.root }} defaultSelectedId="cap" onSelectedIdChange={onSel} />);
    await waitFor(() => expect(second.nodes.Cap!.material).not.toBe(first.nodes.Cap!.material));
    expect(onSel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cap" })).toHaveAttribute("aria-pressed", "true");
    const third = build();
    rerender(<Product model={{ kind: "scene", build: () => third.root }} parts={PARTS.filter((p) => p.id !== "cap")} defaultSelectedId="cap" onSelectedIdChange={onSel} />);
    await waitFor(() => expect(onSel).toHaveBeenCalledWith(null, "clear"));
    expect(document.querySelector("[data-details]")).toHaveTextContent("Select a part");
  });

  it("buttons and the slider cover assembly without dragging; reduced motion jumps (C51-T07, C51-T09)", async () => {
    const built = build();
    render(<Product model={{ kind: "scene", build: () => built.root }} motion="reduced" views={[{ id: "front", label: "Front", yaw: 0, pitch: 0.2 }]} />);
    await ready();
    expect(document.querySelector('[data-slot="exploded-product"]')).toHaveAttribute("data-motion", "reduced");
    await userEvent.click(screen.getByRole("button", { name: "Explode" }));
    expect(built.nodes.Base!.position.y).toBe(-2); // immediately, no tween
    expect(screen.getByRole("button", { name: "Front" })).toBeDisabled(); // no renderer: views need the stage
    expect(screen.getByRole("button", { name: "Reset view" })).toBeDisabled();
  });

  it("a failed load reports an error and keeps the poster and list; the ref is exposed (C51-T10)", async () => {
    const onErr = vi.fn();
    const ref = { current: null as ExplodedProductHandle | null };
    render(<Product ref={ref} model={{ kind: "scene", build: () => { throw new Error("corrupt file"); } }} onAssetError={onErr} />);
    await waitFor(() => expect(document.querySelector('[data-slot="exploded-product"]')).toHaveAttribute("data-state", "error"));
    expect(onErr).toHaveBeenCalledWith({ reason: "load", message: "corrupt file" });
    expect(screen.getByRole("status")).toHaveTextContent("corrupt file");
    expect(screen.getByRole("img", { name: "A lamp" })).toBeVisible();
    expect(within(screen.getByRole("list", { name: /Parts/ })).getAllByRole("button")).toHaveLength(3);
    expect(ref.current?.root).not.toBeNull();
    act(() => ref.current!.resetView());
  });
});
