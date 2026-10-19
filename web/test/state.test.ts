import { describe, it, expect } from "vitest";
import { shapeState } from "../src/lib/state";

const sites = [
  { name: "Site A, Kano", payout: "0xa", gateway: "0xga", connectionCount: 2 },
  { name: "Site B, Kaduna", payout: "0xb", gateway: "0xgb", connectionCount: 2 },
];
const rule = { activeDaysMin: 30, kwhMilliMin: 2000, windowSeconds: 30 };
const conn = (siteId: number, over: Partial<{ paid: boolean; held: boolean; holdReason: number; paidMonth: number }> = {}) =>
  ({ siteId, paid: false, held: false, holdReason: 0, paidMonth: 0, commissionedAt: 1n, ...over });
const sum = (activeDays = 30, kwhMilli = 60000) => ({ exists: true, activeDays, kwhMilli, traceHash: "0x00" });

describe("shapeState", () => {
  it("names connections per site and derives states from the rule, holds and payments", () => {
    const s = shapeState({
      instance: "0x1", programmeName: "Demo", chainId: 31337, explorer: null, escrow: 17_500_000_000n, paidCount: 1, paidTotal: 350_000_000n,
      month: 4, batchSubmittedAt: 1_000n, windowSeconds: 30, nowTs: 1_100, rule, sites,
      connections: [conn(0, { paid: true, paidMonth: 4 }), conn(0), conn(1, { held: true, holdReason: 1 }), conn(1)],
      summaries: [sum(), sum(), sum(), sum(10, 500)], releases: [],
    });
    expect(s.escrowTusd).toBe(17500);
    expect(s.paidTotalTusd).toBe(350);
    expect(s.total).toBe(4);
    expect(s.windowClosesAt).toBe(1030);
    expect(s.sites[0].connections.map((c) => c.code)).toEqual(["C-A01", "C-A02"]);
    expect(s.sites[1].connections.map((c) => c.code)).toEqual(["C-B01", "C-B02"]);
    expect(s.sites[0].connections.map((c) => c.state)).toEqual(["paid", "eligible"]);
    expect(s.sites[1].connections.map((c) => c.state)).toEqual(["held", "pending"]);
    expect(s.sites[1].connections[0].holdReason).toBe(1);
    expect(s.rule.kwhMin).toBe(2);
  });
  it("treats a missing summary as pending", () => {
    const s = shapeState({ instance: "0x1", programmeName: "Demo", chainId: 31337, explorer: null, escrow: 0n, paidCount: 0, paidTotal: 0n,
      month: 4, batchSubmittedAt: 0n, windowSeconds: 30, nowTs: 0, rule, sites: [sites[0]], connections: [conn(0)], summaries: [{ exists: false, activeDays: 0, kwhMilli: 0, traceHash: "0x" }], releases: [] });
    expect(s.sites[0].connections[0].state).toBe("pending");
    expect(s.windowClosesAt).toBe(0);
  });
});

describe("shapeState before the month's batch", () => {
  it("reports which month the states reflect", () => {
    const s = shapeState({ instance: "0x1", programmeName: "Demo", chainId: 31337, explorer: null, escrow: 0n, paidCount: 0, paidTotal: 0n,
      month: 4, batchSubmittedAt: 0n, windowSeconds: 30, nowTs: 0, summaryMonth: 3,
      rule: { activeDaysMin: 30, kwhMilliMin: 2000, windowSeconds: 30 },
      sites: [{ name: "Site A, Kano", payout: "0xa", gateway: "0xga", connectionCount: 1 }],
      connections: [{ siteId: 0, paid: false, held: false, holdReason: 0, paidMonth: 0, commissionedAt: 1n }],
      summaries: [{ exists: true, activeDays: 30, kwhMilli: 60000, traceHash: "0x00" }], releases: [] });
    expect(s.summaryMonth).toBe(3);
    expect(s.sites[0].connections[0].state).toBe("eligible");
  });
});
