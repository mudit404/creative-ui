import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlassKeybed, type AudioLike, type GlassKeybedHandle, type NotePayload } from "./glass-keybed";

/** A fake Web Audio graph that records node lifecycle. */
function fakeAudio(opts: { blocked?: boolean } = {}) {
  const log: string[] = [];
  const param = () => ({ value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, cancelScheduledValues: () => {} });
  const node = (kind: string) => {
    const n = {
      kind,
      gain: param(),
      frequency: param(),
      type: "sine",
      onended: null as null | (() => void),
      connect(target: unknown) {
        log.push(`${kind}.connect`);
        return target;
      },
      disconnect() {
        log.push(`${kind}.disconnect`);
      },
      start() {
        log.push(`${kind}.start`);
      },
      stop() {
        log.push(`${kind}.stop`);
        setTimeout(() => n.onended?.(), 0);
      },
    };
    return n;
  };
  const ctx = {
    state: (opts.blocked ? "suspended" : "running") as AudioContextState,
    currentTime: 0,
    destination: { kind: "destination" } as unknown as AudioNode,
    closed: false,
    async resume() {
      if (!opts.blocked) ctx.state = "running";
    },
    createGain: () => node("gain") as unknown as GainNode,
    createOscillator: () => node("osc") as unknown as OscillatorNode,
    async close() {
      ctx.closed = true;
    },
    log,
  };
  return ctx;
}
const key = (label: string) => screen.getByRole("button", { name: `${label} note` });
const root = () => document.querySelector('[data-slot="glass-keybed"]')!;

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("GlassKeybed", () => {
  it("mounts silent, with no audio context and no microphone request (C58-T01)", () => {
    const create = vi.fn(() => fakeAudio() as unknown as AudioLike);
    const media = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: media }, configurable: true });
    render(<GlassKeybed createAudioContext={create} motion="off" />);
    expect(create).not.toHaveBeenCalled();
    expect(media).not.toHaveBeenCalled();
    expect(root()).toHaveAttribute("data-audio", "silent");
    expect(screen.getByRole("status")).toHaveTextContent("Silent until you enable sound.");
    expect(screen.getByRole("button", { name: "Enable sound" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /note$/ })).toHaveLength(8);
  });

  it("explicit activation succeeds, or exposes a usable visual-only state when blocked (C58-T02, C58-T10)", async () => {
    const onEnabled = vi.fn();
    const ok = fakeAudio();
    const { unmount } = render(<GlassKeybed createAudioContext={() => ok as unknown as AudioLike} onSoundEnabledChange={onEnabled} motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-audio", "ready"));
    expect(onEnabled).toHaveBeenCalledWith(true, "user");
    expect(screen.getByRole("button", { name: "Disable sound" })).toBeInTheDocument();
    unmount();
    const blocked = fakeAudio({ blocked: true });
    const onNote = vi.fn();
    render(<GlassKeybed createAudioContext={() => blocked as unknown as AudioLike} onSoundEnabledChange={onEnabled} onNoteOn={onNote} motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-audio", "blocked"));
    expect(onEnabled).toHaveBeenLastCalledWith(false, "blocked");
    expect(screen.getByRole("status")).toHaveTextContent("Visual-only mode is active.");
    fireEvent.pointerDown(key("C4"), { button: 0, pointerId: 1 });
    expect(onNote).toHaveBeenCalledWith(expect.objectContaining({ noteId: "c4", origin: "pointer" }));
    expect(key("C4")).toHaveAttribute("data-active", "true");
  });

  it("one activation produces exactly one noteOn, by pointer or keyboard (C58-T03, C58-T07)", async () => {
    const onNote = vi.fn();
    const audio = fakeAudio();
    render(<GlassKeybed createAudioContext={() => audio as unknown as AudioLike} onNoteOn={onNote} motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-audio", "ready"));
    await userEvent.click(key("E4")); // pointerdown + pointerup + click
    expect(onNote).toHaveBeenCalledTimes(1);
    expect(onNote.mock.calls[0]![0]).toMatchObject({ noteId: "e4", origin: "pointer", velocity: 0.8 });
    expect(audio.log.filter((l) => l === "osc.start")).toHaveLength(2); // one voice = fundamental + partial
    await act(async () => key("G4").focus());
    await userEvent.keyboard("{Enter}");
    expect(onNote).toHaveBeenCalledTimes(2);
    expect(onNote.mock.calls[1]![0]).toMatchObject({ noteId: "g4", origin: "keyboard" });
    await userEvent.keyboard(" ");
    expect(onNote).toHaveBeenCalledTimes(3);
    const ids = new Set(onNote.mock.calls.map((c) => (c[0] as NotePayload).voiceId));
    expect(ids.size).toBe(3);
  });

  it("bounds polyphony: 40 rapid notes evict the oldest and never grow the graph (C58-T04)", async () => {
    const onOff = vi.fn();
    const audio = fakeAudio();
    render(<GlassKeybed createAudioContext={() => audio as unknown as AudioLike} polyphony={8} triggerMode="sustained" onNoteOff={onOff} motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-audio", "ready"));
    const labels = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
    for (let i = 0; i < 40; i++) fireEvent.pointerDown(key(labels[i % 8]!), { button: 0, pointerId: 1 });
    expect(onOff.mock.calls.filter((c) => c[0].reason === "evicted")).toHaveLength(32);
    expect(audio.log.filter((l) => l === "osc.start")).toHaveLength(80);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(audio.log.filter((l) => l === "osc.stop").length).toBeGreaterThanOrEqual(64); // evicted voices were released
  });

  it("Stop all and document hiding leave no sustained note; a borrowed context stays open (C58-T05, C58-T06)", async () => {
    const borrowed = fakeAudio();
    const onOff = vi.fn();
    const { unmount } = render(<GlassKeybed audioContext={borrowed as unknown as AudioLike} triggerMode="sustained" onNoteOff={onOff} motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-audio", "ready"));
    fireEvent.pointerDown(key("C4"), { button: 0, pointerId: 1 });
    fireEvent.pointerDown(key("E4"), { button: 0, pointerId: 2 });
    expect(document.querySelectorAll("[data-active]")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Stop all" }));
    expect(onOff.mock.calls.filter((c) => c[0].reason === "stopAll")).toHaveLength(2);
    expect(document.querySelectorAll("[data-active]")).toHaveLength(0);
    fireEvent.pointerDown(key("A4"), { button: 0, pointerId: 3 });
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(onOff.mock.calls.at(-1)![0]).toMatchObject({ noteId: "a4", reason: "hidden" });
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    unmount();
    expect(borrowed.closed).toBe(false);
  });

  it("an owned context is closed on unmount and mute/volume touch only the master gain (C58-T08)", async () => {
    const owned = fakeAudio();
    const { rerender, unmount } = render(<GlassKeybed createAudioContext={() => owned as unknown as AudioLike} volume={0.5} motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    await waitFor(() => expect(root()).toHaveAttribute("data-audio", "ready"));
    expect(owned.log.filter((l) => l === "gain.connect")).toHaveLength(1); // master → destination
    rerender(<GlassKeybed createAudioContext={() => owned as unknown as AudioLike} volume={0.5} muted motion="off" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sound on (muted).");
    unmount();
    expect(owned.closed).toBe(true);
  });

  it("reduced motion keeps labels and note feedback without the swing; shortcuts stay off by default (C58-T09)", async () => {
    const onNote = vi.fn();
    render(<GlassKeybed onNoteOn={onNote} motion="reduced" />);
    expect(root()).toHaveAttribute("data-motion", "reduced");
    await userEvent.keyboard("1");
    expect(onNote).not.toHaveBeenCalled();
    fireEvent.pointerDown(key("D4"), { button: 0, pointerId: 1 });
    expect(key("D4")).toHaveAttribute("data-active", "true");
    expect(key("D4").className).not.toContain("cui-key-swing");
    expect(key("D4")).toHaveTextContent("D4");
  });

  it("shortcuts, when enabled, play notes but ignore text inputs and modifiers", async () => {
    const onNote = vi.fn();
    render(
      <>
        <input aria-label="Search" />
        <GlassKeybed onNoteOn={onNote} keyboardMode="shortcuts" motion="off" />
      </>,
    );
    await userEvent.keyboard("2");
    expect(onNote).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: "d4", origin: "shortcut" }));
    await userEvent.keyboard("{Control>}3{/Control}");
    expect(onNote).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("textbox", { name: "Search" }));
    await userEvent.keyboard("4");
    expect(onNote).toHaveBeenCalledTimes(1);
  });

  it("reports invalid notes, is visual-only when asked, and exposes the handle", async () => {
    const ref = { current: null as GlassKeybedHandle | null };
    render(<GlassKeybed ref={ref} variant="visual-only" notes={[{ id: "x", label: "X", frequency: 20 }, { id: "y", label: "Y", frequency: 440 }]} motion="off" />);
    expect(screen.getByRole("note")).toHaveTextContent("outside the supported 80–2000 Hz range");
    expect(screen.queryByRole("button", { name: "Enable sound" })).toBeNull();
    expect(root()).toHaveAttribute("data-audio", "visual-only");
    act(() => ref.current!.focusKey("y"));
    expect(key("Y")).toHaveFocus();
    act(() => ref.current!.stopAll());
  });
});
