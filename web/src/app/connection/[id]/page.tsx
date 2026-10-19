import Link from "next/link";
import { notFound } from "next/navigation";
import { readConnection } from "@/lib/connection";
import { chainCfg } from "@/lib/chain";
import { TopBar } from "@/components/TopBar";
import { TraceChart } from "@/components/TraceChart";
import { HoldActions } from "@/components/HoldActions";

export const dynamic = "force-dynamic";

const STATE_TEXT = { pending: "Pending: no summary for this month yet", eligible: "Eligible: the rule is met", held: "Held for the verifier", paid: "Paid" } as const;

export default async function ConnectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0) notFound();
  const programme = typeof sp.programme === "string" ? sp.programme : null;
  const d = await readConnection(n, programme).catch(() => null);
  if (!d) notFound();
  const back = `/?programme=${d.programme}`;
  const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
  return (
    <>
      <TopBar network={chainCfg.label} short={chainCfg.short} />
      <main className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 flex flex-col gap-6">
        <nav aria-label="Where you are" className="text-sm text-ink-muted flex gap-2 items-center">
          <Link href={back} className="text-ink-muted no-underline hover:text-ink">Tally</Link><span aria-hidden="true">/</span>
          <span>{d.siteName}</span><span aria-hidden="true">/</span><span className="text-ink font-semibold">{d.code}</span>
        </nav>
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-baseline">
          <h1 className="font-display font-semibold text-[32px] tracking-tight leading-tight">Connection {d.code}</h1>
          <span className="text-sm text-ink-muted">meter <span className="font-mono text-ink">{d.meterSerial}</span></span>
          <span className="text-sm text-ink-muted">commissioned {new Date(d.commissionedAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold bg-surface-2 rounded-full px-3 py-1" data-testid="connection-state">
            <span className="cell" data-state={d.state} style={{ width: 14, height: 14 }} aria-hidden="true" />{STATE_TEXT[d.state]}{d.state === "paid" ? ` in month ${d.paidMonth}` : ""}
          </span>
        </div>
        <div className="grid grid-cols-12 gap-6 items-start">
          <section className="col-span-12 lg:col-span-8 flex flex-col gap-2.5" aria-label={`Daily consumption, month ${d.month}`}>
            <div className="flex justify-between items-baseline flex-wrap gap-2">
              <span className="font-semibold">Daily consumption, month {d.month}</span>
              <span className="text-[13px] text-ink-muted">kWh per day, {d.trace.length} days, synthetic</span>
            </div>
            <TraceChart trace={d.trace} low={d.cohortLow} high={d.cohortHigh} paired={d.paired} code={d.code} />
            <p className="text-[13px] text-ink-muted m-0">The grey band is the middle half of {d.siteName.split(",")[0]}&apos;s connections each day.{d.paired ? ` The two lines overlap at every point, which is why the screen held both.` : ""}</p>
          </section>
          <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
            {d.reasonText && (
              <section className="bg-surface-1 rounded-lg px-5 py-4 flex flex-col gap-2 shadow-[var(--shadow-raised)]" data-testid="hold-reason">
                <span className="font-semibold">Held by the screen</span>
                <p className="m-0">{d.reasonText}</p>
                <p className="m-0 text-[13px] text-ink-muted">The screen can only hold. The rule released the connections that met it; this one waits for the verifier.</p>
              </section>
            )}
            <HoldActions id={d.id} programme={d.programme} held={d.state === "held"} />
            <section className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold">This month&apos;s summary</span>
              {d.summary ? (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular m-0">
                  <dt className="text-ink-muted">Days active</dt><dd className="m-0">{d.summary.activeDays} of {d.trace.length} (rule: {d.rule.activeDaysMin})</dd>
                  <dt className="text-ink-muted">Consumption</dt><dd className="m-0">{d.summary.kwh.toFixed(1)} kWh (rule: {d.rule.kwhMin.toFixed(1)})</dd>
                  <dt className="text-ink-muted">Signed by</dt><dd className="m-0">{d.siteName.split(",")[0]} gateway key, verified on-chain at submission</dd>
                  <dt className="text-ink-muted">Trace hash</dt><dd className="m-0"><span className="font-mono text-[13px]">{short(d.summary.traceHash)}</span> {d.traceMatches ? "matches this trace" : "does not match this trace"}</dd>
                  <dt className="text-ink-muted">Grant if released</dt><dd className="m-0">{d.grantTusd.toLocaleString("en-US")} tUSD</dd>
                </dl>
              ) : <p className="m-0 text-ink-muted">No summary for month {d.month} yet.</p>}
            </section>
            <Link href={back} className="text-sm font-semibold no-underline">Back to the tally</Link>
          </aside>
        </div>
      </main>
    </>
  );
}
