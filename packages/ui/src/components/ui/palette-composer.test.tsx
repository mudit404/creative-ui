import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaletteComposer, type Decoder, type PaletteSource, type Swatch } from "./palette-composer";
import { SIX, stripes } from "@/lib/palette-extract.test";

const file = (name = "six.png", type = "image/png", size = 1000) => {
  const f = new File([new Uint8Array(size)], name, { type });
  return f;
};

/** Decoder that returns a fixture per file name, optionally after a delay. */
function fixtureDecoder(map: Record<string, ReturnType<typeof stripes>>, delays: Record<string, number> = {}): Decoder & { aborted: string[] } {
  const d = (async (input, _limits, signal) => {
    const name = input.file?.name ?? input.url;
    const px = map[name];
    if (!px) throw { reason: "decode", message: `no fixture for ${name}` };
    const ms = delays[name] ?? 0;
    if (ms) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          d.aborted.push(name);
          resolve();
        });
      });
    }
    return px;
  }) as Decoder & { aborted: string[] };
  d.aborted = [];
  return d;
}

const slotInput = (n: number) => screen.getByRole("textbox", { name: `Slot ${n} colour` });
const lockBtn = (n: number) => screen.getByRole("button", { name: `Lock Slot ${n}` });

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn((f: File) => `blob:${f.name}`), configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true });
});
afterEach(() => vi.useRealTimers());

async function choose(f: File) {
  const input = screen.getByLabelText("Choose image") as HTMLInputElement;
  // fireEvent rather than userEvent.upload: the latter silently drops files the accept filter rejects
  await act(async () => fireEvent.change(input, { target: { files: [f] } }));
}

describe("PaletteComposer", () => {
  it("fills six editable slots from a six-colour fixture via the configured adapter (C48-T01)", async () => {
    const onChange = vi.fn();
    const states: string[] = [];
    render(<PaletteComposer decoder={fixtureDecoder({ "six.png": SIX })} onPaletteChange={onChange} onExtractionStateChange={(s) => states.push(s)} motion="off" />);
    await choose(file());
    await waitFor(() => expect(slotInput(1)).toHaveValue("#dc281e"));
    expect(slotInput(6)).toHaveValue("#141414");
    expect(onChange).toHaveBeenCalledTimes(1);
    const [pal, meta] = onChange.mock.calls[0]! as [Swatch[], { reason: string }];
    expect(meta.reason).toBe("extract");
    expect(pal.map((s) => s.id)).toEqual(["slot-1", "slot-2", "slot-3", "slot-4", "slot-5", "slot-6"]);
    expect(pal.every((s) => s.origin === "extracted")).toBe(true);
    expect(states).toEqual(["decoding", "extracting", "ready"]);
    expect(screen.getByRole("status")).toHaveTextContent("Palette ready: 6 colours extracted");
    expect(screen.getByRole("img", { name: "six.png" })).toHaveAttribute("src", "blob:six.png");
  });

  it("leaves unused slots labelled when the image has fewer colours", async () => {
    render(<PaletteComposer decoder={fixtureDecoder({ "mono.png": stripes([[90, 90, 90, 255, 50]]) })} motion="off" />);
    await choose(file("mono.png"));
    await waitFor(() => expect(slotInput(1)).toHaveValue("#5a5a5a"));
    expect(slotInput(2)).toHaveValue("");
    expect(screen.getAllByText("Unused")).toHaveLength(5);
    expect(screen.getByRole("status")).toHaveTextContent("remaining slots unused");
  });

  it("a late result from image A cannot overwrite image B (C48-T02)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onChange = vi.fn();
    const dec = fixtureDecoder({ "a.png": SIX, "b.png": stripes([[0, 0, 255, 255, 30]]) }, { "a.png": 500 });
    render(<PaletteComposer decoder={dec} onPaletteChange={onChange} motion="off" />);
    const input = screen.getByLabelText("Choose image") as HTMLInputElement;
    await act(async () => fireEvent.change(input, { target: { files: [file("a.png")] } }));
    await act(async () => fireEvent.change(input, { target: { files: [file("b.png")] } }));
    await waitFor(() => expect(slotInput(1)).toHaveValue("#0000ff"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(slotInput(1)).toHaveValue("#0000ff");
    expect(slotInput(2)).toHaveValue("");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(dec.aborted).toEqual(["a.png"]);
  });

  it("locked slots keep their id and colour across a new extraction (C48-T03)", async () => {
    render(<PaletteComposer decoder={fixtureDecoder({ "six.png": SIX, "blue.png": stripes([[0, 0, 255, 255, 30]]) })} motion="off" />);
    await choose(file());
    await waitFor(() => expect(slotInput(1)).toHaveValue("#dc281e"));
    await userEvent.click(lockBtn(2));
    expect(lockBtn(2)).toHaveAttribute("aria-pressed", "true");
    await choose(file("blue.png"));
    await waitFor(() => expect(slotInput(1)).toHaveValue("#0000ff"));
    expect(slotInput(2)).toHaveValue("#1e5ac8");
    expect(slotInput(3)).toHaveValue("");
    expect(document.querySelector('[data-slot-id="slot-2"]')).toHaveAttribute("data-locked", "true");
  });

  it("transparent pixels do not dominate the palette (C48-T04)", async () => {
    const img = stripes([
      [255, 0, 0, 40, 900],
      [0, 0, 255, 255, 100],
    ]);
    render(<PaletteComposer decoder={fixtureDecoder({ "t.png": img })} motion="off" />);
    await choose(file("t.png"));
    await waitFor(() => expect(slotInput(1)).toHaveValue("#0000ff"));
    expect(slotInput(2)).toHaveValue("");
  });

  it("invalid types and oversized images error without freezing; the last palette stays (C48-T05)", async () => {
    const onError = vi.fn();
    const decoder: Decoder = async (input, limits) => {
      if (!input.file!.type.startsWith("image/")) throw { reason: "type", message: "not an image" };
      if (input.file!.size > limits.maxFileBytes) throw { reason: "size", message: "too large" };
      return SIX;
    };
    render(<PaletteComposer decoder={decoder} maxFileBytes={2000} onExtractionError={onError} motion="off" />);
    await choose(file());
    await waitFor(() => expect(slotInput(1)).toHaveValue("#dc281e"));
    await choose(file("doc.pdf", "application/pdf"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("not an image"));
    expect(onError).toHaveBeenLastCalledWith({ reason: "type", message: "not an image" });
    expect(slotInput(1)).toHaveValue("#dc281e"); // previous palette kept
    await choose(file("huge.png", "image/png", 5000));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("too large"));
    expect(document.querySelector('[data-slot="palette-composer"]')).toHaveAttribute("data-state", "error");
    // still usable
    await userEvent.click(lockBtn(1));
    expect(lockBtn(1)).toHaveAttribute("aria-pressed", "true");
  });

  it("a cross-origin read failure offers the local-file route (C48-T06)", async () => {
    const decoder: Decoder = async () => {
      throw { reason: "cors", message: "The image is cross-origin and cannot be read. Choose a local file instead." };
    };
    render(<PaletteComposer decoder={decoder} motion="off" />);
    await userEvent.type(screen.getByRole("textbox", { name: "Image URL" }), "https://example.com/x.png{Enter}");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/cross-origin/));
    expect(screen.getByRole("button", { name: "Choose a local file" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose image")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/x.png");
  });

  it("clipboard rejection reports failure and reveals selectable output (C48-T07)", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    render(<PaletteComposer defaultPalette={[{ id: "slot-1", color: "#aabbcc", locked: false, origin: "edited" }]} motion="off" />);
    expect(screen.getByLabelText("CSS export")).not.toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Copy CSS" }));
    await waitFor(() => expect(screen.getAllByRole("status").some((s) => /denied/.test(s.textContent ?? ""))).toBe(true));
    const ta = screen.getByLabelText("CSS export") as HTMLTextAreaElement;
    expect(ta).toBeVisible();
    expect(ta.value).toContain("--palette-1: #aabbcc;");
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    await userEvent.click(screen.getByRole("button", { name: "Copy hex list" }));
    await waitFor(() => expect(screen.getAllByRole("status").some((s) => /Hex list copied/.test(s.textContent ?? ""))).toBe(true));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("#aabbcc");
  });

  it("exports sanitised names and only validated colours (C48-T08)", async () => {
    render(
      <PaletteComposer
        exportPrefix="Acme Brand!"
        variant="brand"
        slotLabels={["Accent", "Back ground"]}
        count={3}
        defaultPalette={[
          { id: "slot-1", color: "#112233", locked: false, origin: "edited" },
          { id: "slot-2", color: "javascript:alert(1)", locked: false, origin: "edited" },
          { id: "slot-3", color: null, locked: false, origin: "empty" },
        ]}
        motion="off"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show CSS" }));
    const ta = screen.getByLabelText("CSS export") as HTMLTextAreaElement;
    expect(ta.value).toBe(":root {\n  --acme-brand-accent: #112233;\n}");
    expect(screen.getByRole("textbox", { name: "Accent colour" })).toBeInTheDocument();
  });

  it("every swatch can be edited and locked with the keyboard, edits commit once (C48-T09)", async () => {
    const onChange = vi.fn();
    render(<PaletteComposer count={2} onPaletteChange={onChange} motion="off" />);
    const input = slotInput(1);
    await act(async () => input.focus());
    await userEvent.keyboard("rgb(255, 0, 128){Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0][0]).toMatchObject({ id: "slot-1", color: "#ff0080", origin: "edited" });
    expect(input).toHaveValue("#ff0080");
    await userEvent.clear(input);
    await userEvent.keyboard("nope{Enter}");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onChange).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    expect(lockBtn(1)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), { reason: "lock" });
    expect(lockBtn(1)).toHaveAttribute("aria-pressed", "true");
  });

  it("removing a local source revokes the object URL and aborts extraction (C48-T10)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const dec = fixtureDecoder({ "six.png": SIX }, { "six.png": 1000 });
    render(<PaletteComposer decoder={dec} motion="off" />);
    const input = screen.getByLabelText("Choose image") as HTMLInputElement;
    await act(async () => fireEvent.change(input, { target: { files: [file()] } }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-slot="palette-composer"]')).toHaveAttribute("data-state", "decoding");
    await userEvent.click(screen.getByRole("button", { name: "Remove source" }));
    expect(dec.aborted).toEqual(["six.png"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:six.png");
    expect(document.querySelector('[data-slot="palette-composer"]')).toHaveAttribute("data-state", "empty");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("is controlled for source and palette", async () => {
    const onSource = vi.fn();
    const onPalette = vi.fn();
    const src: PaletteSource = { kind: "url", url: "https://example.com/a.png", revision: 1, alt: "A" };
    const { rerender } = render(<PaletteComposer source={null} onSourceChange={onSource} palette={[]} onPaletteChange={onPalette} decoder={fixtureDecoder({ "https://example.com/a.png": SIX })} motion="off" />);
    await userEvent.type(screen.getByRole("textbox", { name: "Image URL" }), "https://example.com/a.png{Enter}");
    expect(onSource).toHaveBeenCalledWith(expect.objectContaining({ kind: "url", url: "https://example.com/a.png" }));
    expect(screen.queryByRole("img")).toBeNull(); // parent did not accept yet
    rerender(<PaletteComposer source={src} onSourceChange={onSource} palette={[]} onPaletteChange={onPalette} decoder={fixtureDecoder({ "https://example.com/a.png": SIX })} motion="off" />);
    await waitFor(() => expect(onPalette).toHaveBeenCalled());
    expect(slotInput(1)).toHaveValue(""); // parent holds the palette
    const list = within(screen.getByRole("list", { name: "Palette slots" }));
    expect(list.getAllByRole("listitem")).toHaveLength(6);
  });
});
