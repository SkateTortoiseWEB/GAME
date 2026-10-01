import { beforeEach, describe, expect, it } from "vitest";
import { takeAiCheck } from "@/lib/budget";
import { allow } from "@/lib/ratelimit";

describe("rate limit", () => {
  it("blocks past the limit and recovers after the window", () => {
    expect(allow("k", 2, 1000, 0)).toBe(true);
    expect(allow("k", 2, 1000, 10)).toBe(true);
    expect(allow("k", 2, 1000, 20)).toBe(false);
    expect(allow("k", 2, 1000, 1500)).toBe(true);
  });
});

describe("AI budget", () => {
  beforeEach(() => { process.env.AI_DEVICE_DAILY_CAP = "3"; process.env.AI_GLOBAL_DAILY_CAP = "5"; });
  it("caps per device and globally", async () => {
    const d = "2099-01-01";
    for (let i = 0; i < 3; i++) expect(await takeAiCheck(d, "a")).toBe(true);
    expect(await takeAiCheck(d, "a")).toBe(false);
    expect(await takeAiCheck(d, "b")).toBe(true); // global 4
    expect(await takeAiCheck(d, "b")).toBe(true); // global 5
    expect(await takeAiCheck(d, "b")).toBe(false); // global cap of 5 reached
  });
});
