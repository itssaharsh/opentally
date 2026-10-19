// Pure shaping of chain reads into the tally the UI shows. No I/O here, so it is unit-tested with fixtures.
export type ConnectionState = "pending" | "eligible" | "held" | "paid";
export type HoldReason = 0 | 1 | 2 | 3; // 0 none, 1 clone, 2 flat, 3 outlier

export type RawConnection = {
  siteId: number; paid: boolean; held: boolean; holdReason: number; paidMonth: number; commissionedAt: bigint | number;
};
export type RawSummary = { exists: boolean; activeDays: number; kwhMilli: number; traceHash: string };
export type RawSite = { name: string; payout: string; gateway: string; connectionCount: number };

export type ConnectionView = {
  id: number; code: string; siteIndex: number; state: ConnectionState; holdReason: HoldReason; paidMonth: number;
  summary: { activeDays: number; kwh: number } | null;
};
export type SiteView = { index: number; name: string; payout: string; gateway: string; count: number; paid: number; held: number; eligible: number; pending: number; connections: ConnectionView[] };

export type TallyState = {
  instance: string; programmeName: string; chainId: number; explorer: string | null;
  escrowTusd: number; paidCount: number; paidTotalTusd: number; total: number;
  month: number; batchSubmittedAt: number; windowClosesAt: number; windowSeconds: number; nowTs: number;
  rule: { activeDaysMin: number; kwhMin: number; windowSeconds: number };
  sites: SiteView[]; releases: ReleaseView[]; syncedAt: string;
};
export type ReleaseView = { month: number; count: number; totalTusd: number; txHash: string; blockNumber: number; gasUsed?: number };

export const HOLD_REASON_TEXT: Record<number, string> = {
  1: "This month's trace is identical to another connection's, point for point.",
  2: "No usage on 27 or more of 30 days.",
  3: "Consumption far outside this site's band this month.",
};

export function codeFor(siteIndex: number, ordinal: number, siteCodes = ["A", "B", "C"]) {
  const n = ordinal + 1;
  return `C-${siteCodes[siteIndex] ?? "X"}${n < 10 ? "0" + n : n}`;
}

export function shapeState(input: {
  instance: string; programmeName: string; chainId: number; explorer: string | null;
  escrow: bigint; paidCount: number; paidTotal: bigint; month: number; batchSubmittedAt: bigint; windowSeconds: number; nowTs: number;
  rule: { activeDaysMin: number; kwhMilliMin: number; windowSeconds: number };
  sites: RawSite[]; connections: RawConnection[]; summaries: (RawSummary | null)[]; releases: ReleaseView[];
}): TallyState {
  const perSiteOrdinal: number[] = input.sites.map(() => 0);
  const views: ConnectionView[] = input.connections.map((c, id) => {
    const ordinal = perSiteOrdinal[c.siteId]++;
    const s = input.summaries[id];
    const meets = !!s && s.exists && s.activeDays >= input.rule.activeDaysMin && s.kwhMilli >= input.rule.kwhMilliMin;
    const state: ConnectionState = c.paid ? "paid" : c.held ? "held" : meets ? "eligible" : "pending";
    return {
      id, code: codeFor(c.siteId, ordinal), siteIndex: c.siteId, state, holdReason: (c.holdReason as HoldReason) ?? 0, paidMonth: c.paidMonth,
      summary: s && s.exists ? { activeDays: s.activeDays, kwh: Math.round(s.kwhMilli) / 1000 } : null,
    };
  });
  const sites: SiteView[] = input.sites.map((s, index) => {
    const cs = views.filter((v) => v.siteIndex === index);
    return {
      index, name: s.name, payout: s.payout, gateway: s.gateway, count: cs.length,
      paid: cs.filter((v) => v.state === "paid").length, held: cs.filter((v) => v.state === "held").length,
      eligible: cs.filter((v) => v.state === "eligible").length, pending: cs.filter((v) => v.state === "pending").length,
      connections: cs,
    };
  });
  const batchAt = Number(input.batchSubmittedAt);
  return {
    instance: input.instance, programmeName: input.programmeName, chainId: input.chainId, explorer: input.explorer,
    escrowTusd: Number(input.escrow) / 1e6, paidCount: input.paidCount, paidTotalTusd: Number(input.paidTotal) / 1e6, total: views.length,
    month: input.month, batchSubmittedAt: batchAt, windowClosesAt: batchAt ? batchAt + input.windowSeconds : 0, windowSeconds: input.windowSeconds, nowTs: input.nowTs,
    rule: { activeDaysMin: input.rule.activeDaysMin, kwhMin: input.rule.kwhMilliMin / 1000, windowSeconds: input.rule.windowSeconds },
    sites, releases: input.releases, syncedAt: new Date(input.nowTs * 1000).toISOString(),
  };
}
