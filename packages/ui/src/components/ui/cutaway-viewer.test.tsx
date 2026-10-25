import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { CutawayViewer, type AssetWarning, type ModelSource, type SliceState } from "./cutaway-viewer";

function layeredBox(opts: { open?: boolean; glass?: boolean } = {}) {
  const root = new Group();
  const outer = new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial({ color: "#888" }));
  outer.name = "Outer";
  outer.userData.closed = !opts.open;
  const inner = new Mesh(new BoxGeometry(0.6, 0.6, 0.6), new MeshStandardMaterial({ color: "#f00", transparent: !!opts.glass }));
  inner.name = "Inner";
  inner.userData.closed = true;
  inner.position.set(0, 0.5, 0);
  root.add(outer, inner);
  root.scale.setScalar(2);
  root.rotation.y = Math.PI / 2;
  return { root, outer, inner };
}
const Viewer = (props: Partial<React.ComponentProps<typeof CutawayViewer>> & { model: ModelSource }) => <CutawayViewer poster="/p.png" description="A layered box" motion="off" renderer="none" {...props} />;
const root = () => document.querySelector('[data-slot="cutaway-viewer"]')!;
const ready = () => waitFor(() => expect(root()).toHaveAttribute("data-state", "fallback"));

describe("CutawayViewer", () => {
  it("shows the poster and disabled controls while validating, then computes bounds (C52-T09)", async () => {
    render(<Viewer model={{ kind: "scene", build: () => layeredBox().root }} />);
    expect(screen.getByRole("img", { name: "A layered box" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Depth" })).toBeDisabled();
    expect(screen.getByText("Bounds pending")).toBeInTheDocument();
    await ready();
    expect(screen.getByRole("slider", { name: "Depth" })).toBeEnabled();
    expect(screen.getByText("Y cut at 0.000 (model units)")).toBeInTheDocument(); // bounds y ∈ [−1, 1]: offset 0 is the midpoint
  });

  it("maps offset −1/0/1 to the model-local bounds and derives a consistent world plane (C52-T01, C52-T02)", async () => {
    const slices: SliceState[] = [];
    const { root: model } = layeredBox();
    render(<Viewer model={{ kind: "scene", build: () => model }} onSliceChange={(s) => slices.push(s)} />);
    await ready();
    fireEvent.change(screen.getByRole("slider", { name: "Depth" }), { target: { value: "1" } });
    expect(slices.at(-1)).toMatchObject({ axis: "y", offset: 1, enabled: true, localCut: 1 });
    expect(slices.at(-1)!.plane!.normal[1]).toBeCloseTo(-1); // retains the lower half
    fireEvent.change(screen.getByRole("slider", { name: "Depth" }), { target: { value: "-1" } });
    expect(slices.at(-1)!.localCut).toBe(-1);
    await userEvent.click(screen.getByRole("checkbox", { name: "Keep other half" }));
    expect(slices.at(-1)!.plane!.normal[1]).toBeCloseTo(1); // inverted plane, model untouched
    expect(model.scale.x).toBe(2);
    expect(model.rotation.y).toBeCloseTo(Math.PI / 2);
    await userEvent.click(screen.getByRole("button", { name: "X" }));
    expect(slices.at(-1)!.axis).toBe("x");
    // world plane through the model transform: rotation about Y maps local x to world -z
    expect(Math.abs(slices.at(-1)!.plane!.normal[2])).toBeCloseTo(1);
    expect(root()).toHaveAttribute("data-axis", "x");
    // the Outer material is clipped by one plane
    const outer = model.children[0] as Mesh;
    expect((outer.material as MeshStandardMaterial).clippingPlanes).toHaveLength(1);
  });

  it("caps only declared-closed opaque meshes; open or transparent meshes warn (C52-T03, C52-T04, C52-T08)", async () => {
    const onWarn = vi.fn();
    render(<Viewer model={{ kind: "scene", build: () => layeredBox().root }} onAssetWarning={onWarn} />);
    await ready();
    expect(onWarn).not.toHaveBeenCalled();
    expect(root()).toHaveAttribute("data-capped", "true");
    const { unmount } = render(<Viewer label="open" model={{ kind: "scene", build: () => layeredBox({ open: true }).root }} onAssetWarning={onWarn} />);
    await waitFor(() => expect(onWarn).toHaveBeenCalled());
    const w = onWarn.mock.calls[0]![0] as AssetWarning[];
    expect(w[0]).toMatchObject({ code: "uncapped" });
    expect(w[0]!.nodes![0]).toMatch(/"Outer" is not declared closed/);
    expect(screen.getByRole("note")).toHaveTextContent("clipped without a cut surface");
    unmount();
    render(<Viewer label="required" model={{ kind: "scene", build: () => layeredBox({ glass: true }).root }} capMode="required" />);
    await waitFor(() => expect(screen.getByRole("note")).toHaveTextContent('capMode is "required"'));
    expect(screen.getAllByRole("slider", { name: "Depth" }).at(-1)).toBeDisabled();
  });

  it("changing axis reuses the single plane and helper materials (C52-T05)", async () => {
    const { root: model } = layeredBox();
    render(<Viewer model={{ kind: "scene", build: () => model }} defaultEnabled />);
    await ready();
    const outer = model.children[0] as Mesh;
    const helpersBefore = outer.children.length;
    const matBefore = (outer.material as MeshStandardMaterial).uuid;
    const planeBefore = (outer.material as MeshStandardMaterial).clippingPlanes![0];
    for (const a of ["X", "Z", "Y", "X"]) await userEvent.click(screen.getByRole("button", { name: a }));
    expect(outer.children.length).toBe(helpersBefore);
    expect((outer.material as MeshStandardMaterial).uuid).toBe(matBefore);
    expect((outer.material as MeshStandardMaterial).clippingPlanes![0]).toBe(planeBefore); // same Plane object, updated in place
  });

  it("presets reproduce plane and description; numeric entry and buttons work without drag (C52-T06, C52-T07)", async () => {
    const slices: SliceState[] = [];
    render(
      <Viewer
        model={{ kind: "scene", build: () => layeredBox().root }}
        presets={[{ id: "half", label: "Half", axis: "z", offset: 0, description: "Through the middle, front to back." }, { id: "top", label: "Top quarter", axis: "y", offset: 0.5, invert: true, description: "Keeps the upper quarter." }]}
        onSliceChange={(s) => slices.push(s)}
      />,
    );
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Top quarter" }));
    const a = slices.at(-1)!;
    expect(a).toMatchObject({ axis: "y", offset: 0.5, invert: true, enabled: true });
    expect(document.querySelector("[data-preset-description]")).toHaveTextContent("Keeps the upper quarter.");
    await userEvent.click(screen.getByRole("button", { name: "Half" }));
    await userEvent.click(screen.getByRole("button", { name: "Top quarter" }));
    expect(slices.at(-1)!.plane).toEqual(a.plane);
    const input = screen.getByRole("textbox", { name: "Depth value" });
    await userEvent.clear(input);
    await userEvent.type(input, "-0,25{Enter}");
    expect(slices.at(-1)).toMatchObject({ offset: -0.25 });
    await userEvent.click(screen.getByRole("button", { name: "Increase depth" }));
    expect(slices.at(-1)!.offset).toBeCloseTo(-0.15);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(slices.at(-1)).toMatchObject({ axis: "y", offset: 0, invert: false, enabled: false, plane: null });
  });

  it("a failed model keeps the static content; reduced motion is reported (C52-T10)", async () => {
    const onWarn = vi.fn();
    render(<Viewer model={{ kind: "scene", build: () => { throw new Error("bad asset"); } }} onAssetWarning={onWarn} motion="reduced" sectionPoster="/section.png" />);
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "error"));
    expect(onWarn).toHaveBeenCalledWith([{ code: "load", message: "bad asset" }]);
    expect(screen.getByRole("status")).toHaveTextContent("bad asset");
    expect(screen.getByRole("img", { name: "A layered box" })).toBeVisible();
    expect(screen.getByText("Interior detail comes from the supplied model.")).toBeInTheDocument();
    expect(root()).toHaveAttribute("data-motion", "reduced");
  });
});
