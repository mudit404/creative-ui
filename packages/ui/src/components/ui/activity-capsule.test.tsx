import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityCapsule, type TaskSnapshot } from "./activity-capsule";

const snap = (over: Partial<TaskSnapshot>): TaskSnapshot => ({
  id: "upload",
  attemptId: "a1",
  attempt: 1,
  revision: 1,
  label: "Upload photos",
  status: "running",
  ...over,
});

describe("ActivityCapsule", () => {
  it("renders a summary button with aria-expanded/controls and separate actions (C60-T07)", async () => {
    const cancel = vi.fn();
    render(<ActivityCapsule tasks={[snap({ progress: { completed: 3, total: 10, unit: "files" } })]} onCancelRequest={cancel} motion="off" />);
    const summary = screen.getByRole("button", { name: /Activity: Upload photos, Running, 30%/ });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(summary.getAttribute("aria-controls")!)!;
    expect(panel).toHaveAttribute("hidden");
    const cancelBtn = screen.getByRole("button", { name: "Cancel Upload photos" });
    expect(summary.contains(cancelBtn)).toBe(false); // never nested
    expect(summary.querySelectorAll("button, a, input").length).toBe(0);
    await userEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("hidden");
    expect(within(panel).getByText("3/10 files (30%)")).toBeInTheDocument();
    // keyboard operable
    await act(async () => summary.focus());
    await userEvent.keyboard("{Enter}");
    expect(summary).toHaveAttribute("aria-expanded", "false");
  });

  it("never shows a percentage for indeterminate tasks (C60-T01)", async () => {
    render(<ActivityCapsule tasks={[snap({ label: "Generating", progress: { indeterminate: true } })]} defaultExpanded motion="off" />);
    expect(screen.getByRole("button", { name: /Generating, Running$/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d+%/);
    expect(screen.getByText(/in progress/)).toBeInTheDocument();
  });

  it("shows 'Cancel requested' after the request, and 'Cancelled' only after the host confirms (C60-T02)", async () => {
    const cancel = vi.fn();
    const base = snap({ progress: { completed: 1, total: 4 } });
    const { rerender } = render(<ActivityCapsule tasks={[base]} onCancelRequest={cancel} defaultExpanded motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel Upload photos" }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith("upload", "a1");
    const list = () => within(screen.getByRole("list"));
    expect(list().getByText("Cancel requested")).toBeInTheDocument();
    expect(screen.queryByText("Cancelled")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel Upload photos" })).toBeDisabled(); // one request only
    rerender(<ActivityCapsule tasks={[snap({ status: "cancelled", revision: 2 })]} onCancelRequest={cancel} defaultExpanded motion="off" />);
    expect(list().getByText("Cancelled")).toBeInTheDocument();
  });

  it("renders a success that raced a cancel request as succeeded (C60-T03)", async () => {
    const { rerender } = render(<ActivityCapsule tasks={[snap({})]} onCancelRequest={() => {}} defaultExpanded motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel Upload photos" }));
    rerender(<ActivityCapsule tasks={[snap({ status: "cancel-requested", revision: 2 }), snap({ status: "succeeded", revision: 3 })]} onCancelRequest={() => {}} defaultExpanded motion="off" />);
    expect(within(screen.getByRole("list")).getByText("Succeeded")).toBeInTheDocument();
    expect(screen.queryByText(/Cancel/)).toBeNull();
  });

  it("ignores late events from an older attempt after a retry (C60-T04)", async () => {
    const retry = vi.fn();
    const { rerender } = render(<ActivityCapsule tasks={[snap({ status: "failed", revision: 4 })]} onRetryRequest={retry} defaultExpanded motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Retry Upload photos" }));
    expect(retry).toHaveBeenCalledWith("upload", "a1");
    rerender(<ActivityCapsule tasks={[snap({ attemptId: "a2", attempt: 2, revision: 1, status: "running" })]} onRetryRequest={retry} defaultExpanded motion="off" />);
    const list = () => within(screen.getByRole("list"));
    expect(list().getByText("Running")).toBeInTheDocument();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rerender(<ActivityCapsule tasks={[snap({ attemptId: "a1", attempt: 1, revision: 9, status: "succeeded" })]} onRetryRequest={retry} defaultExpanded motion="off" />);
    expect(list().getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("Succeeded")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not treat completed === total as success (C60-T05)", () => {
    render(<ActivityCapsule tasks={[snap({ progress: { completed: 10, total: 10 } })]} defaultExpanded motion="off" />);
    expect(within(screen.getByRole("list")).getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("10/10 (100%)")).toBeInTheDocument();
    expect(screen.queryByText("Succeeded")).toBeNull();
  });

  it("opening, closing and Escape never call task callbacks (C60-T06)", async () => {
    const cancel = vi.fn();
    const retry = vi.fn();
    const dismiss = vi.fn();
    const onExpanded = vi.fn();
    render(<ActivityCapsule tasks={[snap({}), snap({ id: "x", label: "Export", status: "failed" })]} onCancelRequest={cancel} onRetryRequest={retry} onDismiss={dismiss} onExpandedChange={onExpanded} motion="off" />);
    const summary = screen.getByRole("button", { name: /Activity:/ });
    await userEvent.click(summary);
    expect(onExpanded).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard("{Escape}");
    expect(onExpanded).toHaveBeenLastCalledWith(false);
    expect(summary).toHaveFocus();
    await userEvent.click(summary);
    await userEvent.click(summary);
    expect(cancel).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("dismiss is a request that does not cancel; terminal tasks persist until dismissed (C60-T08)", async () => {
    const dismiss = vi.fn();
    const cancel = vi.fn();
    render(<ActivityCapsule tasks={[snap({ status: "succeeded" })]} onDismiss={dismiss} onCancelRequest={cancel} motion="off" />);
    expect(screen.getByText("Upload photos")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Dismiss Upload photos" });
    await act(async () => btn.focus());
    await userEvent.keyboard("{Enter}");
    expect(dismiss).toHaveBeenCalledWith("upload", "a1");
    expect(cancel).not.toHaveBeenCalled();
    // still rendered: the host decides when it disappears
    expect(screen.getByText("Upload photos")).toBeInTheDocument();
  });

  it("announces lifecycle changes and 25% milestones, not every update (C60-T09)", () => {
    const { rerender } = render(<ActivityCapsule tasks={[snap({ progress: { completed: 0, total: 100 } })]} motion="off" />);
    const live = screen.getByRole("status");
    expect(live.textContent).toBe("");
    for (const c of [5, 10, 20, 24]) rerender(<ActivityCapsule tasks={[snap({ revision: c, progress: { completed: c, total: 100 } })]} motion="off" />);
    expect(live.textContent).toBe("");
    rerender(<ActivityCapsule tasks={[snap({ revision: 30, progress: { completed: 26, total: 100 } })]} motion="off" />);
    expect(live.textContent).toBe("Upload photos: Running, 26%");
    rerender(<ActivityCapsule tasks={[snap({ revision: 31, progress: { completed: 27, total: 100 } })]} motion="off" />);
    expect(live.textContent).toBe("Upload photos: Running, 26%");
    rerender(<ActivityCapsule tasks={[snap({ revision: 40, status: "succeeded" })]} motion="off" />);
    expect(live.textContent).toBe("Upload photos: Succeeded");
    rerender(<ActivityCapsule tasks={[snap({ revision: 40, status: "succeeded" })]} announce="off" motion="off" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reduced motion keeps every action and accurate status (C60-T10)", async () => {
    const cancel = vi.fn();
    const retry = vi.fn();
    render(
      <ActivityCapsule
        tasks={[snap({ progress: { completed: 2, total: 8 } }), snap({ id: "b", label: "Build", status: "failed", detail: "Exit code 1" })]}
        onCancelRequest={cancel}
        onRetryRequest={retry}
        onDismiss={() => {}}
        defaultExpanded
        motion="reduced"
      />,
    );
    expect(document.querySelector('[data-slot="activity-capsule"]')).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByText("2/8 (25%)")).toBeInTheDocument();
    expect(screen.getByText("Exit code 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel Upload photos" }));
    await userEvent.click(screen.getByRole("button", { name: "Retry Build" }));
    expect(cancel).toHaveBeenCalledWith("upload", "a1");
    expect(retry).toHaveBeenCalledWith("b", "a1");
    expect(screen.getByRole("button", { name: "Dismiss Build" })).toBeInTheDocument();
  });

  it("selects the primary by priority then order and counts the rest", () => {
    const tasks = [snap({ id: "a", label: "A", status: "queued" }), snap({ id: "b", label: "B", priority: 2 }), snap({ id: "c", label: "C", priority: 2 })];
    const { rerender } = render(<ActivityCapsule tasks={tasks} motion="off" />);
    expect(screen.getByRole("button", { name: /Activity: B, Running, 3 active/ })).toBeInTheDocument();
    rerender(<ActivityCapsule tasks={tasks} primaryTaskId="c" motion="off" />);
    expect(screen.getByRole("button", { name: /Activity: C, Running/ })).toBeInTheDocument();
  });

  it("is controlled for expansion", async () => {
    const onExpanded = vi.fn();
    render(<ActivityCapsule tasks={[snap({})]} expanded={false} onExpandedChange={onExpanded} motion="off" />);
    const summary = screen.getByRole("button", { name: /Activity:/ });
    await userEvent.click(summary);
    expect(onExpanded).toHaveBeenCalledWith(true);
    expect(summary).toHaveAttribute("aria-expanded", "false");
  });

  it("renders the empty label without tasks", () => {
    render(<ActivityCapsule tasks={[]} motion="off" />);
    expect(screen.getByRole("button", { name: "Activity: No activity" })).toBeInTheDocument();
  });
});
