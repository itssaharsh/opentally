import "server-only";
import { encodePacked, keccak256, type Address } from "viem";
import { openTallyAbi } from "./abi";
import { publicClient, instanceFor, DEMO_MONTH, chainCfg } from "./chain";
import { screenMonth, type Trace } from "./screen";
import { codeFor } from "./state";
import programme from "../data/programme.json";

type Conn = { id: number; code: string; siteIndex: number; meterSerial: string; commissionedAt: number; traces: Record<string, number[]> };
const conns = (programme as unknown as { connections: Conn[] }).connections;

export function traceHashOf(days: number[]) {
  const milli = days.map((v) => Math.round(v * 1000));
  return keccak256(encodePacked(milli.map(() => "uint32"), milli));
}

export type ConnectionDetail = {
  programme: string; explorer: string | null; id: number; code: string; siteName: string; meterSerial: string; commissionedAt: number;
  month: number; state: "pending" | "eligible" | "held" | "paid"; holdReason: number; paidMonth: number;
  summary: { activeDays: number; kwh: number; traceHash: string } | null; traceMatches: boolean;
  trace: number[]; cohortLow: number[]; cohortHigh: number[]; paired: { code: string; trace: number[] } | null;
  grantTusd: number; reasonText: string | null; rule: { activeDaysMin: number; kwhMin: number };
};

function quantile(xs: number[], q: number) { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }

export async function readConnection(id: number, requested?: string | null): Promise<ConnectionDetail | null> {
  const meta = conns[id];
  if (!meta) return null;
  const { address } = await instanceFor(requested);
  const pc = publicClient();
  const c = { address: address as Address, abi: openTallyAbi } as const;
  const [conn, batch4, rule, grant] = await Promise.all([
    pc.readContract({ ...c, functionName: "getConnection", args: [id] }),
    pc.readContract({ ...c, functionName: "batchSubmittedAt", args: [DEMO_MONTH] }),
    pc.readContract({ ...c, functionName: "rule" }),
    pc.readContract({ ...c, functionName: "grantPerConnection" }),
  ]);
  const month = (batch4 as bigint) === 0n ? DEMO_MONTH - 1 : DEMO_MONTH;
  const [summary, site] = await Promise.all([
    pc.readContract({ ...c, functionName: "getSummary", args: [month, id] }),
    pc.readContract({ ...c, functionName: "getSite", args: [conn.siteId] }),
  ]);
  const [activeDaysMin, kwhMilliMin] = rule as unknown as [number, number, number];
  const trace = meta.traces[String(month)];
  const cohort = conns.filter((x) => x.siteIndex === meta.siteIndex);
  const days = trace.length;
  const cohortLow = Array.from({ length: days }, (_, d) => quantile(cohort.map((x) => x.traces[String(month)][d]), 0.25));
  const cohortHigh = Array.from({ length: days }, (_, d) => quantile(cohort.map((x) => x.traces[String(month)][d]), 0.75));
  const flags = screenMonth(conns.map((x): Trace => ({ id: x.id, code: x.code, siteIndex: x.siteIndex, days: x.traces[String(month)] })));
  const flag = flags.find((f) => f.id === id);
  const pairedConn = flag?.pairedWith ? conns.find((x) => x.code === flag.pairedWith) : undefined;
  const meets = summary.exists && Number(summary.activeDays) >= Number(activeDaysMin) && Number(summary.kwhMilli) >= Number(kwhMilliMin);
  const state = conn.paid ? "paid" : conn.held ? "held" : meets ? "eligible" : "pending";
  const ordinal = conns.filter((x) => x.siteIndex === meta.siteIndex && x.id < id).length;
  return {
    programme: address, explorer: chainCfg.explorer, id, code: codeFor(meta.siteIndex, ordinal), siteName: site.name, meterSerial: meta.meterSerial,
    commissionedAt: meta.commissionedAt, month, state, holdReason: Number(conn.holdReason), paidMonth: Number(conn.paidMonth),
    summary: summary.exists ? { activeDays: Number(summary.activeDays), kwh: Number(summary.kwhMilli) / 1000, traceHash: summary.traceHash } : null,
    traceMatches: summary.exists && summary.traceHash.toLowerCase() === traceHashOf(trace).toLowerCase(),
    trace, cohortLow, cohortHigh, paired: pairedConn ? { code: pairedConn.code, trace: pairedConn.traces[String(month)] } : null,
    grantTusd: Number(grant) / 1e6, reasonText: conn.held ? (flag?.detail ?? "Held by the verifier.") : null,
    rule: { activeDaysMin: Number(activeDaysMin), kwhMin: Number(kwhMilliMin) / 1000 },
  };
}
