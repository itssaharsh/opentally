// Deterministic demo world: 3 fictional Nigerian mini-grid sites, 50 synthetic connections, four months of
// daily consumption, three planted faults. Everything here is synthetic and the app says so on screen.
import { keccak256, encodePacked, toHex, type Hex } from "viem";

export type SiteSeed = { code: string; name: string; town: string; count: number };
export type ConnectionSeed = {
  id: number; code: string; siteIndex: number; meterSerial: string; gpsCell: string; commissionedAt: number;
  traces: Record<number, number[]>; // month -> 30 daily kWh values
};
export type Planted = { code: string; kind: "clone" | "flat"; of?: string };

export const SITES: SiteSeed[] = [
  { code: "A", name: "Site A", town: "Kano", count: 20 },
  { code: "B", name: "Site B", town: "Kaduna", count: 18 },
  { code: "C", name: "Site C", town: "Jigawa", count: 12 },
];
export const MONTHS = [1, 2, 3, 4];
export const DEMO_MONTH = 4;
export const PLANTED: Planted[] = [
  { code: "C-B14", kind: "clone", of: "C-B07" },
  { code: "C-C03", kind: "flat" },
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export function buildSeed(seed = 20261019): ConnectionSeed[] {
  const rnd = mulberry32(seed);
  const out: ConnectionSeed[] = [];
  let id = 0;
  SITES.forEach((site, siteIndex) => {
    for (let i = 1; i <= site.count; i++) {
      const code = `C-${site.code}${pad2(i)}`;
      const mean = 1.4 + rnd() * 2.2; // kWh per day, household scale
      const traces: Record<number, number[]> = {};
      for (const m of MONTHS) {
        const days: number[] = [];
        for (let d = 0; d < 30; d++) {
          const weekend = d % 7 >= 5 ? 1.15 : 1;
          const v = Math.max(0, mean * weekend + (rnd() - 0.5) * 1.2);
          days.push(Math.round(v * 100) / 100);
        }
        traces[m] = days;
      }
      const serialPrefix = site.town.slice(0, 2).toUpperCase();
      out.push({
        id, code, siteIndex,
        meterSerial: `${serialPrefix}-${String(1000 + Math.floor(rnd() * 9000)).padStart(4, "0")}-${String(1000 + Math.floor(rnd() * 9000)).padStart(4, "0")}`,
        gpsCell: `cell-${site.code}-${Math.floor(rnd() * 40)}`,
        commissionedAt: Date.UTC(2026, 5, 1) / 1000 + Math.floor(rnd() * 20) * 86400,
        traces,
      });
      id++;
    }
  });
  // planted faults, month 4 only
  const byCode = new Map(out.map((c) => [c.code, c]));
  for (const p of PLANTED) {
    const c = byCode.get(p.code)!;
    if (p.kind === "clone") c.traces[DEMO_MONTH] = [...byCode.get(p.of!)!.traces[DEMO_MONTH]];
    if (p.kind === "flat") c.traces[DEMO_MONTH] = c.traces[DEMO_MONTH].map((_, i) => (i === 3 || i === 17 || i === 25 ? 0.4 : 0));
  }
  return out;
}

export function summaryOf(trace: number[]) {
  const activeDays = trace.filter((v) => v > 0).length;
  const kwhMilli = Math.round(trace.reduce((a, b) => a + b, 0) * 1000);
  return { activeDays, kwhMilli, traceHash: traceHash(trace) };
}

export function traceHash(trace: number[]): Hex {
  const milli = trace.map((v) => Math.round(v * 1000));
  return keccak256(encodePacked(milli.map(() => "uint32"), milli));
}

export function hashString(s: string): Hex { return keccak256(toHex(s)); }

export const SUMMARY_TYPES = {
  Summary: [
    { name: "connectionId", type: "uint32" }, { name: "month", type: "uint32" },
    { name: "activeDays", type: "uint16" }, { name: "kwhMilli", type: "uint32" }, { name: "traceHash", type: "bytes32" },
  ],
} as const;

export const GRANT_TUSD = 350n * 10n ** 6n;
export const DEPOSIT_TUSD = 17_500n * 10n ** 6n;
export const RULE = { activeDaysMin: 30, kwhMilliMin: 2000, windowSeconds: 30 };
export const PROGRAMME_NAME = "Demo window NG-RBF-01 (synthetic)";
