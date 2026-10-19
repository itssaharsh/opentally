import { describe, it, expect } from "vitest";
import { resetInstance } from "../src/lib/reset";
import { runMonth, type StepEvent } from "../src/lib/pipeline";
import { readState } from "../src/lib/chain";

describe("pipeline on the local chain", () => {
  it("runs month 4 end to end: 50 verified, 3 held, 47 released", async () => {
    const { instance } = await resetInstance();
    const events: StepEvent[] = [];
    for await (const ev of runMonth(4)) events.push(ev);
    const done = (n: number) => events.filter((e) => e.step === n && e.status === "done").at(-1)!;
    expect(done(1).count).toBe(50);
    expect(events.find((e) => e.step === 1 && e.detail?.includes("rejected"))).toBeTruthy();
    expect(done(2).count).toBe(3);
    expect(done(3).count).toBe(47);
    expect(done(5).count).toBe(47);
    expect(done(5).txHash).toMatch(/^0x/);
    const state = await readState(4);
    expect(state.instance.toLowerCase()).toBe(instance.toLowerCase());
    expect(state.paidCount).toBe(47);
    expect(state.escrowTusd).toBe(1050);
    expect(state.sites.reduce((a, s) => a + s.held, 0)).toBe(3);
    expect(state.releases.at(-1)?.count).toBe(47);
  });
});
