// Re-sum: rebuild the paid count and the amount from the per-connection release records, then compare with the
// chain's own counters. Pure, so it is unit-tested; the route feeds it events and counters.
export type ReleasedRecord = { connectionId: number; month: number; siteId: number; amountTusd: number; txHash: string; blockNumber: number };
export type ResumResult = {
  paidCount: number; paidTotalTusd: number; bySite: Record<number, { count: number; totalTusd: number }>; byMonth: Record<number, { count: number; totalTusd: number }>;
  matches: boolean; chain: { paidCount: number; paidTotalTusd: number }; differences: string[];
};
export function resum(records: ReleasedRecord[], chain: { paidCount: number; paidTotalTusd: number }): ResumResult {
  const bySite: ResumResult["bySite"] = {}; const byMonth: ResumResult["byMonth"] = {};
  const seen = new Set<number>(); const differences: string[] = [];
  let count = 0, total = 0;
  for (const r of records) {
    if (seen.has(r.connectionId)) { differences.push(`connection ${r.connectionId} released twice`); continue; }
    seen.add(r.connectionId); count++; total += r.amountTusd;
    bySite[r.siteId] = { count: (bySite[r.siteId]?.count ?? 0) + 1, totalTusd: (bySite[r.siteId]?.totalTusd ?? 0) + r.amountTusd };
    byMonth[r.month] = { count: (byMonth[r.month]?.count ?? 0) + 1, totalTusd: (byMonth[r.month]?.totalTusd ?? 0) + r.amountTusd };
  }
  total = Math.round(total * 1e6) / 1e6;
  if (count !== chain.paidCount) differences.push(`records count ${count}, chain counter ${chain.paidCount}`);
  if (Math.abs(total - chain.paidTotalTusd) > 1e-6) differences.push(`records total ${total}, chain counter ${chain.paidTotalTusd}`);
  return { paidCount: count, paidTotalTusd: total, bySite, byMonth, matches: differences.length === 0, chain, differences };
}
export function toCsv(records: ReleasedRecord[]) {
  const head = "connectionId,month,siteId,amountTusd,txHash,blockNumber";
  return [head, ...records.map((r) => [r.connectionId, r.month, r.siteId, r.amountTusd, r.txHash, r.blockNumber].join(","))].join("\n") + "\n";
}
