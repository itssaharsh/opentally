// The screen: a statistical pass over one month's traces, per site. It ranks each connection against its site
// cohort and flags clones (identical traces), flat traces and outliers. It never pays or refuses anything: a flag is
// a hold the verifier can lift. No model provider is involved; this is robust statistics plus two deterministic checks.
export type Trace = { id: number; code: string; siteIndex: number; days: number[] };
export type Flag = { id: number; code: string; reason: 1 | 2 | 3; detail: string; score: number; pairedWith?: string };

export function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function mad(xs: number[], med = median(xs)) {
  return median(xs.map((x) => Math.abs(x - med))) || 1e-9;
}
export function robustZ(x: number, xs: number[]) {
  const med = median(xs);
  return (0.6745 * (x - med)) / mad(xs, med);
}
export function traceKey(days: number[]) {
  return days.map((v) => Math.round(v * 1000)).join(",");
}

export function screenMonth(traces: Trace[], opts = { flatZeroDays: 27, zLimit: 3.5 }): Flag[] {
  const flags: Flag[] = [];
  const bySite = new Map<number, Trace[]>();
  for (const t of traces) bySite.set(t.siteIndex, [...(bySite.get(t.siteIndex) ?? []), t]);
  for (const [, cohort] of bySite) {
    // clones: identical day-by-day traces within a site
    const seen = new Map<string, Trace>();
    for (const t of cohort) {
      const k = traceKey(t.days);
      const other = seen.get(k);
      if (other) {
        flags.push({ id: t.id, code: t.code, reason: 1, score: 1, pairedWith: other.code, detail: `This month's trace is identical to ${other.code}'s, point for point.` });
        if (!flags.some((f) => f.id === other.id && f.reason === 1)) {
          flags.push({ id: other.id, code: other.code, reason: 1, score: 1, pairedWith: t.code, detail: `This month's trace is identical to ${t.code}'s, point for point.` });
        }
      } else seen.set(k, t);
    }
    // flat: almost no usage
    for (const t of cohort) {
      const zeros = t.days.filter((v) => v <= 0).length;
      if (zeros >= opts.flatZeroDays && !flags.some((f) => f.id === t.id)) {
        flags.push({ id: t.id, code: t.code, reason: 2, score: zeros / t.days.length, detail: `No usage on ${zeros} of ${t.days.length} days.` });
      }
    }
    // outliers: total consumption far from the site's band (robust z on totals)
    const totals = cohort.map((t) => t.days.reduce((a, b) => a + b, 0));
    cohort.forEach((t, i) => {
      if (flags.some((f) => f.id === t.id)) return;
      const z = robustZ(totals[i], totals);
      if (Math.abs(z) > opts.zLimit) {
        flags.push({ id: t.id, code: t.code, reason: 3, score: Math.abs(z), detail: `Consumption ${totals[i].toFixed(1)} kWh sits ${Math.abs(z).toFixed(1)} robust deviations from this site's band.` });
      }
    });
  }
  return flags.sort((a, b) => a.id - b.id);
}
