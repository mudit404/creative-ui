import { describe, expect, it } from "vitest";
import { DEFAULT_NOTES, clampVelocity, createVoicePool, malletEnvelope, validateNotes } from "./voice-pool";

describe("voice pool", () => {
  it("validates notes and the default set", () => {
    expect(validateNotes(DEFAULT_NOTES)).toEqual([]);
    expect(validateNotes([{ id: "x", label: "X", frequency: 20 }, { id: "x", label: "X2", frequency: Number.NaN }])).toEqual(['Note "x" (20 Hz) is outside the supported 80–2000 Hz range.', 'Duplicate note id "x".', 'Note "x" needs a finite positive frequency.']);
    expect(validateNotes([{ id: "lo", label: "lo", frequency: 40 }], [20, 5000])).toEqual([]);
  });

  it("bounds polyphony by evicting the oldest voice (C58-T04)", () => {
    const pool = createVoicePool(3);
    const a = pool.noteOn("c4", 0.5, false, 0).voice;
    pool.noteOn("d4", 0.5, false, 1);
    pool.noteOn("e4", 0.5, false, 2);
    const fourth = pool.noteOn("g4", 0.5, false, 3);
    expect(fourth.evicted.map((v) => v.voiceId)).toEqual([a.voiceId]);
    expect(pool.size()).toBe(3);
    for (let i = 0; i < 40; i++) pool.noteOn("a4", 1, false, 10 + i);
    expect(pool.size()).toBe(3);
    expect(pool.noteOff("nope")).toBeNull();
    const stopped = pool.stopAll();
    expect(stopped).toHaveLength(3);
    expect(pool.size()).toBe(0);
  });

  it("clamps velocity and shapes the envelope", () => {
    expect(clampVelocity(7)).toBe(1);
    expect(clampVelocity(Number.NaN)).toBe(0.8);
    expect(malletEnvelope(1).decay).toBeCloseTo(1);
    expect(malletEnvelope(0).peak).toBeCloseTo(0.15);
  });
});
