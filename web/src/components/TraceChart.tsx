// Daily consumption against the site's middle half, with a paired clone drawn over it. Server-rendered SVG.
export function TraceChart({ trace, low, high, paired, code }: { trace: number[]; low: number[]; high: number[]; paired: { code: string; trace: number[] } | null; code: string }) {
  const W = 760, H = 300, L = 56, R = 20, T = 30, B = 40;
  const max = Math.max(4, ...trace, ...high, ...(paired?.trace ?? [])) * 1.1;
  const x = (i: number) => L + (i / (trace.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (vs: number[]) => vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const band = [...high.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`), ...low.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse()].join(" ");
  const ticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const label = paired ? `Line chart: ${code} and ${paired.code} have identical daily consumption on every one of ${trace.length} days; the site's middle half sits around them` : `Line chart of ${code}'s daily consumption over ${trace.length} days against the site's middle half`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} className="block bg-surface-1 rounded-lg shadow-[var(--shadow-raised)]">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={L - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--ink-muted)" fontFamily="var(--ff-body)">{t.toFixed(1)}</text>
        </g>
      ))}
      <text x={L} y={H - 12} fontSize="12" fill="var(--ink-muted)" fontFamily="var(--ff-body)">day 1</text>
      <text x={W - R} y={H - 12} fontSize="12" textAnchor="end" fill="var(--ink-muted)" fontFamily="var(--ff-body)">day {trace.length}</text>
      <polygon points={band} fill="var(--surface-2)" />
      <polyline points={line(trace)} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      {paired && <polyline points={line(paired.trace)} fill="none" stroke="var(--accent-strong)" strokeWidth="2.5" strokeDasharray="7 6" strokeLinejoin="round" />}
      <g fontSize="13" fontFamily="var(--ff-body)">
        <line x1={L + 8} x2={L + 32} y1={16} y2={16} stroke="var(--ink)" strokeWidth="2.5" />
        <text x={L + 40} y={20} fill="var(--ink)">{code}, this connection</text>
        {paired && <><line x1={L + 260} x2={L + 284} y1={16} y2={16} stroke="var(--accent-strong)" strokeWidth="2.5" strokeDasharray="7 6" /><text x={L + 292} y={20} fill="var(--ink)">{paired.code}, same site, drawn over it</text></>}
      </g>
    </svg>
  );
}
