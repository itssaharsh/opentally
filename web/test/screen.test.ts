import { describe, it, expect } from "vitest";
import { screenMonth } from "../src/lib/screen";
import programme from "../src/data/programme.json";

const traces = (programme as any).connections.map((c: any) => ({ id: c.id, code: c.code, siteIndex: c.siteIndex, days: c.traces["4"] as number[] }));

describe("screen", () => {
  it("AC-5: flags both members of an identical pair as clones, naming each other", () => {
    const flags = screenMonth(traces);
    const clones = flags.filter((f) => f.reason === 1);
    expect(clones.map((f) => f.code).sort()).toEqual(["C-B07", "C-B14"]);
    expect(clones.find((f) => f.code === "C-B14")?.pairedWith).toBe("C-B07");
  });
  it("AC-6: flags a trace with 27 or more zero days as flat", () => {
    const flags = screenMonth(traces);
    const flat = flags.filter((f) => f.reason === 2);
    expect(flat.map((f) => f.code)).toEqual(["C-C03"]);
    expect(flat[0].detail).toMatch(/No usage on 27 of 30 days/);
  });
  it("flags exactly the three planted faults and nothing else on the demo month", () => {
    const flags = screenMonth(traces);
    expect(flags.map((f) => f.code).sort()).toEqual(["C-B07", "C-B14", "C-C03"]);
  });
  it("flags nothing on month 3, which has no planted fault", () => {
    const m3 = (programme as any).connections.map((c: any) => ({ id: c.id, code: c.code, siteIndex: c.siteIndex, days: c.traces["3"] as number[] }));
    expect(screenMonth(m3)).toEqual([]);
  });
});
