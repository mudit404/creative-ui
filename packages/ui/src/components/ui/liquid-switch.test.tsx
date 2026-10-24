import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { LiquidSwitch } from "./liquid-switch";

describe("LiquidSwitch", () => {
  it("is a switch with aria-checked and toggles on click", async () => {
    const onChange = vi.fn();
    render(<LiquidSwitch aria-label="Notifications" onCheckedChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Notifications" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveAttribute("data-state", "unchecked");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveAttribute("data-state", "checked");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles from the keyboard with Space and Enter", async () => {
    render(<LiquidSwitch aria-label="Dark mode" />);
    const sw = screen.getByRole("switch");
    sw.focus();
    await userEvent.keyboard(" ");
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Enter}");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("respects defaultChecked when uncontrolled", () => {
    render(<LiquidSwitch aria-label="x" defaultChecked />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("is controlled when checked is provided", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<LiquidSwitch aria-label="x" checked={false} onCheckedChange={onChange} />);
    const sw = screen.getByRole("switch");
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(sw).toHaveAttribute("aria-checked", "false"); // parent decides
    rerender(<LiquidSwitch aria-label="x" checked onCheckedChange={onChange} />);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("works with a controlling parent", async () => {
    function Parent() {
      const [on, setOn] = useState(false);
      return (
        <>
          <LiquidSwitch aria-label="x" checked={on} onCheckedChange={setOn} />
          <span data-testid="state">{on ? "on" : "off"}</span>
        </>
      );
    }
    render(<Parent />);
    await userEvent.click(screen.getByRole("switch"));
    expect(screen.getByTestId("state")).toHaveTextContent("on");
  });

  it("does nothing when disabled", async () => {
    const onChange = vi.fn();
    render(<LiquidSwitch aria-label="x" disabled onCheckedChange={onChange} />);
    const sw = screen.getByRole("switch");
    expect(sw).toBeDisabled();
    await userEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("participates in forms through a hidden checkbox", async () => {
    const { container } = render(
      <form>
        <LiquidSwitch aria-label="x" name="marketing" value="yes" defaultChecked />
      </form>,
    );
    const form = container.querySelector("form")!;
    expect(new FormData(form).get("marketing")).toBe("yes");
    await userEvent.click(screen.getByRole("switch"));
    expect(new FormData(form).get("marketing")).toBeNull();
  });

  it("can be labelled by an external label", () => {
    render(
      <>
        <label htmlFor="wifi">Wi-Fi</label>
        <LiquidSwitch id="wifi" />
      </>,
    );
    expect(screen.getByRole("switch", { name: "Wi-Fi" })).toBeInTheDocument();
  });

  it("drops the goo filter under reduced motion and off", () => {
    const { container, rerender } = render(<LiquidSwitch aria-label="x" />);
    expect(container.querySelector("filter")).toBeInTheDocument();
    rerender(<LiquidSwitch aria-label="x" motion="reduced" />);
    expect(container.querySelector("filter")).not.toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("data-motion", "reduced");
    rerender(<LiquidSwitch aria-label="x" motion="off" />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-motion", "off");
  });

  it("applies colour overrides as CSS variables", () => {
    render(<LiquidSwitch aria-label="x" colors={{ trackOn: "#1d2a6b", thumb: "#fff" }} />);
    const sw = screen.getByRole("switch");
    expect(sw.style.getPropertyValue("--ls-track-on")).toBe("#1d2a6b");
    expect(sw.style.getPropertyValue("--ls-thumb")).toBe("#fff");
  });

  it("forwards refs and native attributes", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<LiquidSwitch ref={ref} aria-label="x" data-testid="sw" title="t" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(screen.getByTestId("sw")).toHaveAttribute("title", "t");
  });
});
