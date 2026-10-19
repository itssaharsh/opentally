import { describe, it, expect } from "vitest";
import { resum, toCsv } from "../src/lib/resum";

const rec = (connectionId: number, siteId: number) => ({ connectionId, month: 4, siteId, amountTusd: 350, txHash: "0xabc", blockNumber: 10 });

describe("resum", () => {
  it("AC-10: rebuilds the count and amount and matches the chain counters", () => {
    const r = resum([rec(0, 0), rec(1, 0), rec(2, 1)], { paidCount: 3, paidTotalTusd: 1050 });
    expect(r.paidCount).toBe(3);
    expect(r.paidTotalTusd).toBe(1050);
    expect(r.bySite[0].count).toBe(2);
    expect(r.matches).toBe(true);
  });
  it("reports a difference when the counters disagree", () => {
    const r = resum([rec(0, 0)], { paidCount: 2, paidTotalTusd: 700 });
    expect(r.matches).toBe(false);
    expect(r.differences.length).toBe(2);
  });
  it("writes a CSV with a header", () => {
    expect(toCsv([rec(0, 0)]).split("\n")[0]).toBe("connectionId,month,siteId,amountTusd,txHash,blockNumber");
  });
});
