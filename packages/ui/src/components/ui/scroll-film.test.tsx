import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { ScrollFilm, type Chapter, type TimeState } from "./scroll-film";

const CHAPTERS: Chapter[] = [
  { id: "c1", label: "Unboxing", startTime: 0, endTime: 4 },
  { id: "c2", label: "Assembly", startTime: 4, endTime: 8 },
  { id: "c3", label: "Finish", startTime: 8 },
];

/** jsdom video: define a finite duration and fire the metadata event. */
function metadata(video: HTMLVideoElement, duration = 12) {
  Object.defineProperty(video, "duration", { value: duration, configurable: true });
  fireEvent(video, new Event("loadedmetadata"));
}
const video = () => document.querySelector("video") as HTMLVideoElement;
let raf: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 1;
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function Film(props: Partial<React.ComponentProps<typeof ScrollFilm>>) {
  return <ScrollFilm src="/film.mp4" poster="/poster.jpg" description="Assembling the lamp" chapters={CHAPTERS} transcript={<p>Narration text.</p>} scrollStart={1000} scrollEnd={2000} motion="off" {...props} />;
}
const scroll = (y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  fireEvent.scroll(window);
};

describe("ScrollFilm", () => {
  it("server-renders poster, description, native video, transcript and chapter links before metadata", () => {
    render(<Film />);
    const v = video();
    expect(v).toHaveAttribute("poster", "/poster.jpg");
    expect(v).toHaveAttribute("aria-label", "Assembling the lamp");
    expect(v.muted).toBe(true);
    expect(v).not.toHaveAttribute("controls");
    expect(screen.getByText("Narration text.")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Chapters" })).getAllByRole("button")).toHaveLength(3);
    expect(document.querySelector('[data-slot="scroll-film"]')).toHaveAttribute("data-state", "poster");
  });

  it("clamps requested time to the video range at progress 0 and 1 (C50-T01)", () => {
    const states: TimeState[] = [];
    render(<Film videoRange={[2, 10]} onTimeState={(s) => states.push(s)} />);
    metadata(video());
    scroll(0);
    expect(video().currentTime).toBe(2);
    scroll(5000);
    fireEvent(video(), new Event("seeked")); // finish the first seek so the pending target is issued
    expect(video().currentTime).toBe(10);
    scroll(1500);
    fireEvent(video(), new Event("seeked"));
    expect(video().currentTime).toBe(6);
    expect(states.at(-1)).toMatchObject({ requested: 6, mode: "story" });
  });

  it("keeps one seek in flight and reports requested vs presented (C50-T02, C50-T06)", () => {
    const states: TimeState[] = [];
    render(<Film onTimeState={(s) => states.push(s)} />);
    const v = video();
    const set = vi.spyOn(v, "currentTime", "set");
    metadata(v); // story mode starts and issues one seek for the current scroll position
    scroll(1000);
    scroll(1100);
    scroll(1200);
    scroll(1300);
    expect(set).toHaveBeenCalledTimes(1); // 0 is already presented; 1.2 issued; 2.4/3.6 coalesced
    expect(states.at(-1)).toMatchObject({ requested: 3.6, presented: 0, seeking: true });
    expect(screen.getByRole("status")).toHaveTextContent("Requested 3.60 s · presented 0.00 s");
    Object.defineProperty(v, "currentTime", { value: 1.2, configurable: true, writable: true });
    fireEvent(v, new Event("seeked"));
    expect(states.at(-1)).toMatchObject({ requested: 3.6, presented: 1.2, seeking: true });
    expect(document.querySelector("[data-buffering]")).toHaveTextContent("Seeking…");
    v.currentTime = 3.6;
    fireEvent(v, new Event("seeked"));
    expect(states.at(-1)).toMatchObject({ requested: 3.6, presented: 3.6, seeking: false });
    expect(document.querySelector("[data-buffering]")).toBeNull();
    expect(screen.getByRole("button", { name: /Unboxing/ })).toHaveAttribute("aria-current", "true");
  });

  it("a source change invalidates callbacks from the previous video (C50-T03)", () => {
    const states: TimeState[] = [];
    const { rerender } = render(<Film onTimeState={(s) => states.push(s)} />);
    metadata(video());
    scroll(1500);
    const old = video();
    const before = states.at(-1)!.generation;
    rerender(<Film src="/other.mp4" onTimeState={(s) => states.push(s)} />);
    expect(document.querySelector('[data-slot="scroll-film"]')).toHaveAttribute("data-state", "poster");
    fireEvent(old, new Event("seeked")); // stale element, stale generation
    expect(states.at(-1)).toMatchObject({ requested: null, presented: null, seeking: false });
    expect(states.at(-1)!.generation).toBe(before + 1);
  });

  it("native mode is not interrupted by scrolling and can be re-entered only by the user (C50-T04)", async () => {
    const onMode = vi.fn();
    render(<Film onModeChange={onMode} />);
    metadata(video());
    await userEvent.click(screen.getByRole("button", { name: "Play normally" }));
    expect(onMode).toHaveBeenCalledWith("native", "user");
    const v = video();
    expect(v).toHaveAttribute("controls");
    expect(v.muted).toBe(false);
    const set = vi.spyOn(v, "currentTime", "set");
    scroll(1200);
    scroll(1800);
    expect(set).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Native playback");
    // chapter buttons seek the native player instead of scrolling
    await userEvent.click(screen.getByRole("button", { name: /Assembly/ }));
    expect(set).toHaveBeenCalledWith(4);
    await userEvent.click(screen.getByRole("button", { name: "Back to story mode" }));
    expect(onMode).toHaveBeenLastCalledWith("story", "user");
    expect(video()).not.toHaveAttribute("controls");
  });

  it("reduced motion exposes ordinary playback with the same transcript and chapters (C50-T05)", () => {
    const onMode = vi.fn();
    render(<Film motion="reduced" onModeChange={onMode} />);
    expect(onMode).toHaveBeenCalledWith("native", "preference");
    expect(video()).toHaveAttribute("controls");
    expect(screen.queryByRole("button", { name: "Play normally" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back to story mode" })).toBeNull();
    expect(screen.getByText("Narration text.")).toBeVisible();
    expect(within(screen.getByRole("navigation", { name: "Chapters" })).getAllByRole("button")).toHaveLength(3);
  });

  it("a nonfinite duration falls back instead of dividing by infinity (C50-T07)", () => {
    const onMode = vi.fn();
    render(<Film onModeChange={onMode} />);
    metadata(video(), Number.POSITIVE_INFINITY);
    expect(document.querySelector('[data-slot="scroll-film"]')).toHaveAttribute("data-state", "fallback");
    expect(screen.getByRole("status")).toHaveTextContent("no finite duration");
    expect(video()).toHaveAttribute("controls");
    const set = vi.spyOn(video(), "currentTime", "set");
    scroll(1500);
    expect(set).not.toHaveBeenCalled();
  });

  it("chapter navigation works by keyboard and click, scrolling to the documented position (C50-T08)", async () => {
    render(<Film />);
    metadata(video());
    const assembly = screen.getByRole("button", { name: /Assembly/ });
    await act(async () => assembly.focus());
    await userEvent.keyboard("{Enter}");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1000 + (4 / 12) * 1000, behavior: "auto" });
    await userEvent.click(screen.getByRole("button", { name: /Finish/ }));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 1000 + (8 / 12) * 1000, behavior: "auto" });
  });

  it("a failed video shows the poster, an error and the transcript (C50-T09)", () => {
    render(<Film />);
    fireEvent(video(), new Event("error"));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    expect(document.querySelector('[data-slot="scroll-film"]')).toHaveAttribute("data-state", "fallback");
    expect(video()).toHaveAttribute("poster", "/poster.jpg");
    expect(screen.getByText("Narration text.")).toBeVisible();
    const set = vi.spyOn(video(), "currentTime", "set");
    scroll(1500);
    expect(set).not.toHaveBeenCalled();
  });

  it("never plays audio until the user chooses normal playback (C50-T10)", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    render(<Film />);
    metadata(video());
    scroll(1500);
    expect(play).not.toHaveBeenCalled();
    expect(video().muted).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Play normally" }));
    expect(play).not.toHaveBeenCalled(); // the user presses play on the native controls
    expect(video().muted).toBe(false);
  });

  it("drives from a custom scroll root and reports invalid chapters", () => {
    function Host() {
      const root = useRef<HTMLDivElement>(null);
      return (
        <div ref={root} data-root style={{ overflow: "auto" }}>
          <ScrollFilm src="/f.mp4" poster="/p.jpg" description="d" chapters={[{ id: "a", label: "A", startTime: 0, endTime: 5 }, { id: "b", label: "B", startTime: 3 }]} transcript="t" scrollRoot={root} scrollStart={0} scrollEnd={100} motion="off" />
        </div>
      );
    }
    render(<Host />);
    metadata(video());
    expect(screen.getByRole("note")).toHaveTextContent('Chapter "b" overlaps');
    const set = vi.spyOn(video(), "currentTime", "set");
    const root = document.querySelector("[data-root]") as HTMLElement;
    root.scrollTop = 50;
    fireEvent.scroll(root);
    expect(set).not.toHaveBeenCalled(); // invalid chapters keep story mode off
    expect(raf).toBeDefined();
  });
});
