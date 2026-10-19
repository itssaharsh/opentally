import { describe, it, expect, beforeEach } from "vitest";
import { allow, resetLimiter, acquireRun, releaseRun } from "../src/lib/limiter";

describe("limiter", () => {
  beforeEach(() => { resetLimiter(); releaseRun(); });
  it("AC-14: a second run on the same instance within the window is refused", () => {
    expect(acquireRun("0x1", 1000)).toBe(true);
    expect(acquireRun("0x1", 1000 + 60_000)).toBe(false);
    expect(acquireRun("0x1", 1000 + 200_000)).toBe(true);
  });
  it("allows n calls per window per key and then refuses", () => {
    for (let i = 0; i < 10; i++) expect(allow("ip:1", 10, 60_000, 0)).toBe(true);
    expect(allow("ip:1", 10, 60_000, 1)).toBe(false);
    expect(allow("ip:1", 10, 60_000, 60_002)).toBe(true);
  });
});
