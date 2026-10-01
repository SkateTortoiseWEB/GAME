import { describe, expect, it } from "vitest";
import { comboStep, RECIPES, semitones, type SfxName } from "@/app/audio/sfx";

describe("sound effects", () => {
  it("climbs the scale as the combo grows, then stops at the top", () => {
    const steps = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 40].map(comboStep);
    expect(steps[0]).toBe(0);
    for (let i = 1; i < 11; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(steps[11]).toBe(steps[10]);
    expect(steps[12]).toBe(steps[10]);
    expect(comboStep(-3)).toBe(0);
  });

  it("only uses notes from the major pentatonic scale, so it always sounds in tune", () => {
    const pentatonicClasses = new Set([0, 2, 4, 7, 9]);
    for (let c = 0; c <= 12; c++) expect(pentatonicClasses.has(comboStep(c) % 12)).toBe(true);
    expect(semitones(440, 12)).toBeCloseTo(880);
  });

  it("has a recipe for every effect, each returning a sensible duration", () => {
    const names: SfxName[] = ["tap", "pop", "squeak", "rare1", "rare2", "rare3", "wrong", "surge", "suggest", "tick", "go", "beat", "gameover", "lullaby", "win"];
    expect(Object.keys(RECIPES).sort()).toEqual([...names].sort());
  });
});
