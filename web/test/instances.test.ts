import { describe, it, expect } from "vitest";
import { pickInstance, type InstanceInfo } from "../src/lib/instances";

const inst = (n: number, over: Partial<InstanceInfo> = {}): InstanceInfo =>
  ({ address: `0x${String(n).padStart(40, "0")}`, index: n, fromBlock: BigInt(n * 10), paidCount: 0, demoMonthSubmitted: false, ...over });

describe("pickInstance", () => {
  it("opens the newest unreleased instance by default", () => {
    const list = [inst(0, { paidCount: 47, demoMonthSubmitted: true }), inst(1), inst(2)];
    const r = pickInstance(list);
    expect(r.shown.index).toBe(2);
    expect(r.fresh).toBe(true);
    expect(r.lastReleased?.index).toBe(0);
    expect(r.spares).toBe(2);
  });
  it("skips an instance whose demo month is already submitted (a run in progress)", () => {
    const list = [inst(0), inst(1, { demoMonthSubmitted: true })];
    const r = pickInstance(list);
    expect(r.shown.index).toBe(0);
    expect(r.spares).toBe(1);
  });
  it("falls back to the newest instance when none is fresh", () => {
    const list = [inst(0, { paidCount: 47, demoMonthSubmitted: true }), inst(1, { paidCount: 47, demoMonthSubmitted: true })];
    const r = pickInstance(list);
    expect(r.shown.index).toBe(1);
    expect(r.fresh).toBe(false);
    expect(r.spares).toBe(0);
  });
  it("honours a requested instance that the factory created, in any letter case", () => {
    const list = [inst(0, { paidCount: 47, demoMonthSubmitted: true }), inst(1)];
    const r = pickInstance(list, list[0].address.toUpperCase().replace("0X", "0x"));
    expect(r.shown.index).toBe(0);
    expect(r.pinned).toBe(true);
  });
  it("ignores a requested address the factory did not create", () => {
    const list = [inst(0), inst(1)];
    const r = pickInstance(list, "0x000000000000000000000000000000000000dEaD");
    expect(r.shown.index).toBe(1);
    expect(r.pinned).toBe(false);
  });
  it("treats an instance with a run in progress on this server as not fresh", () => {
    const list = [inst(0), inst(1)];
    const r = pickInstance(list, null, new Set([list[1].address.toLowerCase()]));
    expect(r.shown.index).toBe(0);
    expect(r.spares).toBe(1);
  });
  it("throws when the factory has no instance", () => {
    expect(() => pickInstance([])).toThrow(/no programme instance/);
  });
});
