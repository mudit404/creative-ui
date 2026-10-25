import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from "three";
import { FinishConfigurator, type FinishConfiguratorHandle, type ModelSource, type OptionGroup, type TextureLoaderFn } from "./finish-configurator";
import { DEFAULTS, GROUPS } from "@/lib/finish-options.test";

function chair() {
  const root = new Group();
  const nodes: Record<string, Mesh> = {};
  for (const name of ["Shell", "Trim", "Seat"]) {
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#ffffff" }));
    m.name = name;
    root.add(m);
    nodes[name] = m;
  }
  return { root, nodes };
}
const hex = (m: Mesh) => "#" + (m.material as MeshStandardMaterial).color.getHexString();
const Config = (props: Partial<React.ComponentProps<typeof FinishConfigurator>> & { model: ModelSource }) => <FinishConfigurator poster="/p.png" description="A chair" groups={GROUPS} defaultSelection={DEFAULTS} motion="off" renderer="none" {...props} />;
const ready = () => waitFor(() => expect(document.querySelector('[data-slot="finish-configurator"]')).toHaveAttribute("data-state", "fallback"));
const radio = (name: string) => screen.getByRole("radio", { name });

describe("FinishConfigurator", () => {
  it("renders option groups before the stage and paints the default selection on its targets only (C53-T01)", async () => {
    const { root, nodes } = chair();
    render(<Config model={{ kind: "scene", build: () => root }} />);
    expect(screen.getByRole("radiogroup", { name: "Shell" })).toBeInTheDocument();
    expect(radio("Oak")).toHaveAttribute("aria-checked", "true");
    await ready();
    expect(hex(nodes.Shell!)).toBe("#b78d5a");
    expect(hex(nodes.Trim!)).toBe("#c8a000");
    expect(hex(nodes.Seat!)).toBe("#e9e5dc");
    await userEvent.click(radio("Walnut"));
    expect(hex(nodes.Shell!)).toBe("#5a3d2b");
    expect(hex(nodes.Trim!)).toBe("#c8a000"); // untouched
    expect(hex(nodes.Seat!)).toBe("#e9e5dc");
    expect(within(screen.getByRole("group", { name: "Finish configurator" })).getByText("Selected: Shell: Walnut · Trim: Brass · Fabric: Linen")).toBeInTheDocument();
  });

  it("explains invalid combinations and never applies them (C53-T02)", async () => {
    const { root, nodes } = chair();
    const onChange = vi.fn();
    render(<Config model={{ kind: "scene", build: () => root }} onSelectionChange={onChange} />);
    await ready();
    expect(radio("Steel")).toHaveAttribute("data-blocked", "true");
    expect(radio("Steel")).toHaveAccessibleDescription("Steel requires Shell: Walnut or Matte black.");
    await userEvent.click(radio("Steel"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Steel requires Shell: Walnut or Matte black.");
    expect(radio("Steel")).toHaveAttribute("aria-checked", "false");
    expect(hex(nodes.Trim!)).toBe("#c8a000");
    await userEvent.click(radio("Walnut"));
    await userEvent.click(radio("Steel"));
    expect(onChange).toHaveBeenLastCalledWith({ shell: "walnut", trim: "steel", fabric: "linen" }, expect.objectContaining({ groupId: "trim", optionId: "steel", reason: "select" }));
    expect(hex(nodes.Trim!)).toBe("#b8b8b8");
    // host rule
    const { unmount } = render(<Config label="hosted" model={{ kind: "scene", build: () => chair().root }} validateSelection={(s) => (s.fabric === "velvet" ? { allowed: false, reason: "Velvet is trade-only." } : true)} />);
    await waitFor(() => expect(document.querySelectorAll('[data-state="fallback"]')).toHaveLength(2));
    const hosted = within(screen.getByRole("group", { name: "hosted" }));
    await userEvent.click(hosted.getByRole("radio", { name: "Steel" }));
    unmount();
  });

  it("a late texture for finish A cannot overwrite the newer finish B; failures keep the last visual (C53-T03, C53-T08)", async () => {
    const pending = new Map<string, { resolve: (t: Texture) => void; reject: (e: Error) => void }>();
    const loader: TextureLoaderFn = (url) => new Promise((resolve, reject) => pending.set(url, { resolve, reject }));
    const groups: OptionGroup[] = [{ id: "shell", label: "Shell", options: [{ id: "a", name: "Leather A", targets: ["Shell"], material: { color: "#111111", map: "https://x/a.png" } }, { id: "b", name: "Leather B", targets: ["Shell"], material: { color: "#222222", map: "https://x/b.png" } }, { id: "plain", name: "Plain", targets: ["Shell"], material: { color: "#333333" } }] }];
    const { root, nodes } = chair();
    render(<Config model={{ kind: "scene", build: () => root }} groups={groups} defaultSelection={{ shell: "plain" }} textureLoader={loader} />);
    await ready();
    const shell = nodes.Shell!.material as MeshStandardMaterial;
    expect(shell.map).toBeNull();
    await userEvent.click(radio("Leather A"));
    expect(document.querySelector("[data-preparing]")).toHaveTextContent("Loading Leather A…");
    expect(shell.color.getHexString()).toBe("333333"); // previous surface retained while preparing
    await userEvent.click(radio("Leather B"));
    const texA = new Texture();
    const texB = new Texture();
    const disposeA = vi.spyOn(texA, "dispose");
    await act(async () => pending.get("https://x/b.png")!.resolve(texB));
    expect(shell.map).toBe(texB);
    expect(shell.color.getHexString()).toBe("222222");
    await act(async () => pending.get("https://x/a.png")!.resolve(texA)); // late A
    expect(shell.map).toBe(texB);
    expect(disposeA).toHaveBeenCalled();
    expect(document.querySelector("[data-preparing]")).toBeNull();
    // failure
    await userEvent.click(radio("Leather A"));
    await act(async () => pending.get("https://x/a.png")!.reject(new Error("404")));
    expect(shell.map).toBe(texB);
    expect(screen.getByRole("status")).toHaveTextContent("Leather A: 404. The previous finish is still shown.");
  });

  it("two instances show different materials without contamination (C53-T04)", async () => {
    const a = chair();
    const b = chair();
    render(
      <>
        <Config label="A" model={{ kind: "scene", build: () => a.root }} defaultSelection={{ ...DEFAULTS, shell: "walnut" }} />
        <Config label="B" model={{ kind: "scene", build: () => b.root }} />
      </>,
    );
    await waitFor(() => expect(document.querySelectorAll('[data-state="fallback"]')).toHaveLength(2));
    expect(hex(a.nodes.Shell!)).toBe("#5a3d2b");
    expect(hex(b.nodes.Shell!)).toBe("#b78d5a");
    expect(a.nodes.Shell!.material).not.toBe(b.nodes.Shell!.material);
  });

  it("an option that becomes unavailable stays selected and flagged (C53-T05)", async () => {
    const { rerender } = render(<Config model={{ kind: "scene", build: () => chair().root }} selection={{ shell: "walnut", trim: "brass", fabric: "linen" }} onSelectionChange={() => {}} />);
    await ready();
    const gone = GROUPS.map((g) => (g.id === "shell" ? { ...g, options: g.options.map((o) => (o.id === "walnut" ? { ...o, available: false, unavailableReason: "Walnut sold out." } : o)) } : g));
    rerender(<Config model={{ kind: "scene", build: () => chair().root }} groups={gone} selection={{ shell: "walnut", trim: "brass", fabric: "linen" }} onSelectionChange={() => {}} />);
    expect(radio("Walnut")).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector('[data-group="shell"] [data-flag]')).toHaveTextContent("Walnut sold out. Please choose another option.");
    expect(screen.getByText(/Selected: Shell: Walnut/)).toBeInTheDocument();
  });

  it("Reset reproduces the declared default exactly; keyboard and tap select every available option (C53-T06, C53-T07)", async () => {
    const onChange = vi.fn();
    const { nodes, root } = chair();
    render(<Config model={{ kind: "scene", build: () => root }} onSelectionChange={onChange} />);
    await ready();
    await userEvent.click(radio("Walnut"));
    await act(async () => radio("Steel").focus());
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ shell: "walnut", trim: "steel", fabric: "linen" }, expect.anything());
    await act(async () => radio("Velvet").focus());
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith({ shell: "walnut", trim: "steel", fabric: "velvet" }, expect.anything());
    expect(hex(nodes.Seat!)).toBe("#7a1f3d");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onChange).toHaveBeenLastCalledWith(DEFAULTS, expect.objectContaining({ reason: "reset" }));
    expect(radio("Oak")).toHaveAttribute("aria-checked", "true");
    expect(hex(nodes.Shell!)).toBe("#b78d5a");
    expect(hex(nodes.Seat!)).toBe("#e9e5dc");
    expect(radio("Matte black")).toHaveAttribute("data-blocked", "true"); // unavailable stays unselectable
  });

  it("fallback reports the accepted option ids and never fabricates price or stock (C53-T09, C53-T10)", async () => {
    const withImage = GROUPS.map((g) => (g.id === "shell" ? { ...g, options: g.options.map((o) => (o.id === "oak" ? { ...o, image: "/oak-chair.jpg" } : o)) } : g));
    const ref = { current: null as FinishConfiguratorHandle | null };
    render(<Config ref={ref} model={{ kind: "scene", build: () => chair().root }} groups={withImage} configurationKey="CHAIR-OAK-BRASS-LINEN" />);
    await ready();
    expect(screen.getByRole("img", { name: "A chair" })).toHaveAttribute("src", "/oak-chair.jpg");
    expect(document.querySelector("[data-summary]")).toHaveTextContent("Selected: Shell: Oak · Trim: Brass · Fabric: Linen · CHAIR-OAK-BRASS-LINEN");
    expect(document.body.textContent).not.toMatch(/\$|price|in stock|order/i);
    act(() => ref.current!.focusOption("trim", "brass"));
    expect(radio("Brass")).toHaveFocus();
  });
});
