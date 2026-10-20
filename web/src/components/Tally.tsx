"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ConnectionView } from "@/lib/state";
import type { PageState as TallyState } from "@/lib/chain";
import type { StepEvent } from "@/lib/pipeline-types";
import rule from "@/data/rule.json";
import { Resum } from "./Resum";
import { noteBlock } from "@/lib/seen";

import type { Preview } from "@/lib/preview";

type Props = { initial: TallyState | null; error?: string | null; demoMonth: number; judgeCard: boolean; record?: boolean; preview?: Preview | null };

const STEP_NAMES = ["Verifying 50 site-signed summaries", "Screening traces against each site", "Applying the rule", "Checking the sampling window", "Sending the release"];

function fmt(n: number, digits = 0) { return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
function short(h: string) { return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h; }

const explorerName = (url: string) => url.includes("basescan") ? "Basescan" : url.includes("etherscan") ? "Etherscan" : "the explorer";

export function Tally({ initial, error, demoMonth, judgeCard, record = false, preview = null }: Props) {
  const [state, setState] = useState<TallyState | null>(preview?.state ?? initial);
  const [stale, setStale] = useState<string | null>(preview?.stale ?? error ?? null);
  const [running, setRunning] = useState(preview?.running ?? false);
  const [events, setEvents] = useState<StepEvent[]>(preview?.events ?? []);
  const [litCount, setLitCount] = useState<number | null>(null); // progressive lighting after release
  const [runError, setRunError] = useState<string | null>(preview?.runError ?? null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runEndedAt, setRunEndedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [preparing, setPreparing] = useState<string | null>(null);
  const programme = state?.instance ?? null;

  const refresh = useCallback(async () => {
    try {
      const q = new URLSearchParams({ month: String(demoMonth) });
      if (programme) q.set("programme", programme);
      const r = await fetch(`/api/state?${q}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setState(j.state); setStale(null); } else { setStale(j.error ?? "chain unreachable"); if (j.lastKnown) setState(j.lastKnown); }
    } catch (e) { setStale((e as Error).message); }
  }, [demoMonth, programme]);

  function pinUrl(address: string) {
    const q = new URLSearchParams(window.location.search);
    q.set("programme", address);
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  const [relNote, setRelNote] = useState<string | null>(null);
  async function releaseLifted() {
    if (!programme) return;
    setRelNote("Releasing the connections that became eligible after a lifted hold.");
    try {
      const r = await fetch(`/api/release?programme=${programme}`, { method: "POST" });
      const j = await r.json();
      if (!j.ok) { setRelNote(j.error ?? "The release didn't go through."); return; }
      noteBlock(j.blockNumber);
      setRelNote(`Released ${j.count} more in one transaction.`);
      await refresh();
    } catch (e) { setRelNote((e as Error).message); }
  }

  async function prepareFresh() {
    setPreparing("Preparing a fresh programme: registering 3 sites, 50 connections and three months of summaries on the chain.");
    try {
      const r = await fetch("/api/reset", { method: "POST" });
      const j = await r.json();
      if (!j.ok) { setPreparing(j.error ?? "Couldn't prepare a fresh programme."); return; }
      const q = new URLSearchParams(window.location.search); q.set("programme", j.programme);
      window.location.search = q.toString();
    } catch (e) { setPreparing((e as Error).message); }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.altKey && e.shiftKey && e.code === "KeyR") { e.preventDefault(); prepareFresh(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const released = !!state && state.paidCount > 0;
  const current = (n: number) => events.filter((e) => e.step === n).at(-1);
  const lastStep = events.filter((e) => e.step > 0).at(-1);

  async function run() {
    if (preview) return;
    setRunError(null); setEvents([]); setRunning(true); setLitCount(null); setRunStartedAt(Date.now()); setRunEndedAt(null);
    const ac = new AbortController(); abortRef.current = ac;
    if (programme) pinUrl(programme);
    try {
      const q = new URLSearchParams({ month: String(demoMonth) });
      if (programme) q.set("programme", programme);
      const res = await fetch(`/api/run?${q}`, { method: "POST", signal: ac.signal });
      if (!res.ok || !res.body) { setRunError(await res.text()); setRunning(false); return; }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data: ")); if (!line) continue;
          const ev = JSON.parse(line.slice(6)) as StepEvent;
          if (ev.name === "end") { if (ev.status === "failed") setRunError(ev.detail ?? "run failed"); continue; }
          if (ev.name === "programme") continue;
          noteBlock(ev.blockNumber);
          setEvents((xs) => [...xs, ev]);
          if (ev.step === 5 && ev.status === "done") {
            await refresh();
            // light the paid cells progressively in site order
            const n = ev.count ?? 0; setLitCount(0);
            for (let i = 1; i <= n; i++) { await new Promise((r) => setTimeout(r, 20)); setLitCount(i); }
          }
          if (ev.step === 5 && ev.status === "failed") setRunError(ev.detail ?? "release failed");
          if (ev.step === 2 && ev.status === "done") await refresh();
        }
      }
    } catch (e) { setRunError((e as Error).message); }
    finally { setRunning(false); abortRef.current = null; setRunEndedAt(Date.now()); }
  }

  useEffect(() => { if (!initial && !preview) refresh(); }, [initial, preview, refresh]);
  useEffect(() => {
    if (!stale || preview) return;
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [stale, preview, refresh]);

  // which cells are shown as paid: all paid ones once lighting is complete or not animating
  const paidOrder = useMemo(() => state ? state.sites.flatMap((s) => s.connections.filter((c) => c.state === "paid").map((c) => c.id)) : [], [state]);
  const litSet = useMemo(() => litCount === null ? null : new Set(paidOrder.slice(0, litCount)), [litCount, paidOrder]);
  const shownState = (c: ConnectionView) => (c.state === "paid" && litSet && !litSet.has(c.id)) ? "eligible" : c.state;

  const balance = state ? state.escrowTusd : 0;
  const shownBalance = state && litSet && litCount !== null && litCount < paidOrder.length ? state.escrowTusd + (paidOrder.length - litCount) * 350 : balance;
  const shownPaid = state && litSet && litCount !== null ? Math.min(litCount, state.paidCount) : (state?.paidCount ?? 0);
  const latest = state?.releases.at(-1);
  const buttonLabel = !state ? "Waiting for the chain" : running
    ? `Releasing, step ${lastStep?.step ?? 1} of 5`
    : runError ? "Retry release"
    : released ? `Released ${state!.paidCount}, held ${state!.sites.reduce((a, s) => a + s.held, 0)}`
    : `Run month ${demoMonth} release`;
  const inProgress = !!state && !state.fresh && !released;
  const eligibleLeft = state ? state.sites.reduce((a, s) => a + s.eligible, 0) : 0;
  const buttonDisabled = !state || running || (released && !runError) || (inProgress && !running);

  return (
    <main className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-28 sm:pb-10 flex flex-col gap-7">
      <h1 className="sr-only">The programme tally: escrow, connections paid and held, and the release rule</h1>
      {preview && <p className="text-sm font-semibold bg-[var(--warning)] text-white rounded-lg px-4 py-2 m-0" data-testid="preview-banner">Preview of the {preview.name} state, built from this programme&apos;s data. Nothing here ran.</p>}
      {stale && <p className="text-sm text-ink-muted bg-surface-sunken rounded-lg px-4 py-2 m-0" role="status" data-testid="stale">{state ? `Chain unreachable since ${new Date(state.syncedAt).toUTCString().slice(17, 22)} UTC, showing the last synced state.` : "Chain unreachable, and nothing has been synced yet. Retrying when the page is focused."}</p>}
      <div className="grid grid-cols-12 gap-6 items-start">
        <section className="col-span-12 md:col-span-4 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-muted">In escrow</span>
            <div className="flex items-baseline gap-2.5">
              {state ? <span className="font-display font-semibold text-[44px] leading-[1.05] tabular tracking-tight" data-testid="escrow">{fmt(shownBalance)}</span>
                : <span className="sk inline-block w-40 h-11 rounded-md" aria-label="Escrow balance not loaded" />}
              <span className="text-sm text-ink-muted">tUSD</span>
            </div>
            {state ? <span className="text-xl font-semibold tabular" data-testid="paid-count">{shownPaid} of {state.total} paid</span>
              : <span className="sk inline-block w-32 h-6 rounded" aria-label="Paid count not loaded" />}
            <span className="text-sm text-ink-muted">{!state ? "Waiting for the chain." : released ? `Month ${latest?.month ?? demoMonth} released, ${state.sites.reduce((a, s) => a + s.held, 0)} held.` : state.summaryMonth === 0 ? "No claims yet for this window. The first summaries arrive at month 1." : `Month ${demoMonth - 1} complete. The sampling window closes 30 s after the next submission on this demo.`}</span>
            {state && <span className="text-[13px] text-ink-muted" data-testid="programme" data-address={state.instance}>Programme contract {state.explorer
              ? <a className="font-mono text-ink" href={`${state.explorer}/address/${state.instance}`} target="_blank" rel="noreferrer">{short(state.instance)}</a>
              : <span className="font-mono text-ink">{short(state.instance)}</span>}</span>}
          </div>
          <div className="hidden sm:block">
            <button type="button" onClick={run} aria-disabled={buttonDisabled} disabled={buttonDisabled && !runError}
              className="h-11 w-full rounded-md bg-accent-strong text-accent-ink font-semibold text-base flex items-center justify-center gap-2.5 disabled:opacity-70 hover:bg-[var(--accent-hover)] active:scale-[.97] transition-transform">
              {running && <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />}
              {released && !running && !runError && <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
              <span>{buttonLabel}</span>
            </button>
            {released && !running && !runError && (
              <p className="mt-2 text-[13px] text-ink-muted">This programme's demo window ends at month {demoMonth}. {state!.spares > 0
                ? <a href="/" className="font-semibold text-ink">Open a fresh programme</a>
                : <button type="button" onClick={prepareFresh} className="font-semibold text-ink underline">Prepare a fresh programme</button>} to run it again.</p>
            )}
            {released && !running && !preview && eligibleLeft > 0 && (
              <button type="button" onClick={releaseLifted} disabled={!!relNote && relNote.startsWith("Releasing")} className="mt-3 h-10 w-full rounded-md bg-surface-2 text-ink font-semibold text-sm" data-testid="release-lifted">
                Release {eligibleLeft} eligible connection{eligibleLeft === 1 ? "" : "s"}
              </button>
            )}
            {relNote && <p className="mt-2 text-[13px] text-ink-muted" role="status">{relNote}</p>}
            {inProgress && !running && <p className="mt-2 text-[13px] text-ink-muted">Month {demoMonth}'s summaries are already in on this programme: someone else is running it. <a href="/" className="font-semibold text-ink">Open a fresh programme</a>.</p>}
            {runError && <p className="mt-2 text-sm text-danger">{runError}</p>}
            {preparing && <p className="mt-2 text-[13px] text-ink-muted" role="status">{preparing}</p>}
            {!record && !preview && state?.fresh && state.lastReleased && !running && <p className="mt-2 text-[13px] text-ink-muted">A previous visitor ran this demo on another programme. <a href={`/?programme=${state.lastReleased}`} className="font-semibold text-ink">See that release</a>.</p>}
          </div>
          {judgeCard && (
            <section aria-label="How to judge this in 90 seconds" className="bg-surface-1 border border-line rounded-lg px-4 py-4 text-sm flex flex-col gap-2">
              <span className="font-semibold">How to judge this in 90 seconds</span>
              <ol className="list-decimal pl-5 flex flex-col gap-1">
                <li>Press Run month {demoMonth} release.</li>
                <li>Watch 47 release and 3 hold.</li>
                <li>Open the receipt on the explorer.</li>
                <li>Press Re-sum.</li>
                <li>Open a held connection and lift the hold.</li>
              </ol>
              <span className="text-[13px] text-ink-muted">Nothing here needs an account.</span>
            </section>
          )}
        </section>

        <section className="col-span-12 md:col-span-8 flex flex-col gap-4" aria-label="Connection ledger">
          {!state && <div className="sk h-40 rounded-lg" />}
          {state?.sites.map((s) => (
            <div key={s.index} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-[13px] font-semibold">{s.name}, {s.count} connections</span>
                <span className="text-[13px] text-ink-muted tabular">{s.paid ? `${s.paid} paid` : state.summaryMonth < state.month ? `${s.eligible} met the rule in month ${state.summaryMonth}` : `${s.eligible} eligible`}{s.held ? `, ${s.held} held` : ""}</span>
              </div>
              <div className={`flex flex-wrap gap-1.5 max-w-[334px] ${running && (current(1)?.status === "running" || current(2)?.status === "running") ? "sk rounded" : ""}`}>
                {s.connections.map((c) => {
                  const st = shownState(c);
                  return (
                    <Link key={c.id} prefetch={false} href={`/connection/${c.id}?programme=${state.instance}`} className="cell" data-state={st} data-testid={`cell-${c.code}`}
                      title={st === "paid" ? `${c.code}, paid in month ${c.paidMonth}` : st === "held" ? `${c.code}, held` : st === "eligible" ? `${c.code}, eligible: rule met` : `${c.code}, pending`}>
                      {st === "paid" && <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                      {st === "held" && <span aria-hidden="true">H</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[13px] text-ink-muted">50 synthetic connections across 3 fictional sites, in a demo window modelled on the NEP and DARES rules. Green with a check is paid; hatched H is held by the screen for the verifier; grey met the rule {state && state.summaryMonth < state.month ? `in month ${state.summaryMonth}; month ${state.month}'s summaries arrive when the release runs` : "this month and waits for the release"}.</p>
        </section>
      </div>

      <section aria-label="The rule" className="bg-surface-1 rounded-lg px-5 py-3.5 flex items-center gap-4 flex-wrap shadow-[var(--shadow-raised)]">
        <p className="font-display text-lg leading-relaxed flex-[1_1_560px] min-w-0 m-0">
          {rule.sentence.before}{" "}
          <Param p={rule.parameters[0]} />{" "}{rule.sentence.between1}{" "}
          <Param p={rule.parameters[1]} />{" "}
          <span className="font-sans text-xs text-ink-muted">(chosen: the terms name this threshold without a value)</span>, {rule.sentence.between2}{" "}
          <Param p={rule.parameters[2]} />{" "}{rule.sentence.after}{" "}
          <span className="font-sans text-[13px] text-ink-muted">From the DARES verification terms.</span>
        </p>
        <Link href="/rule" className="text-sm font-semibold px-3 py-2 rounded-md bg-surface-2 no-underline text-ink">Rule and keys</Link>
      </section>

      <section aria-label="Releases" className="flex flex-col gap-2.5" data-testid="releases">
        {state?.releases.map((r) => (
          <div key={r.txHash} className="receipt flex items-center gap-5 flex-wrap bg-surface-1 rounded-lg px-5 py-3.5 shadow-[var(--shadow-raised)]" data-testid="receipt">
            <span className="flex items-center gap-2.5 font-semibold"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--accent-strong)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>Release, month {r.month}</span>
            <span className="tabular">{r.count} connections</span>
            <span className="tabular">{fmt(r.totalTusd)} tUSD</span>
            {r.gasUsed !== undefined && <span className="tabular text-ink-muted">gas {fmt(r.gasUsed)} units</span>}
            <span className="flex-1" />
            <span className="font-mono text-sm">{short(r.txHash)}</span>
            <button type="button" className="h-8 px-2.5 rounded-md text-ink-muted text-sm hover:bg-surface-2" onClick={() => navigator.clipboard?.writeText(r.txHash)}>Copy hash</button>
            {!preview && <Resum programme={state.instance} fromBlock={state.fromBlock} rpc={state.publicRpc} chainId={state.chainId} network={state.network} logSpan={state.logSpan} />}
            {state.explorer ? <a className="text-sm font-semibold no-underline flex items-center gap-1.5" href={`${state.explorer}/tx/${r.txHash}`} target="_blank" rel="noreferrer">View on {explorerName(state.explorer)} <span aria-hidden="true">↗</span></a> : <span className="text-sm text-ink-muted">local chain</span>}
          </div>
        ))}
        {(running || events.length > 0) && (
          <details open className="text-sm group">
          <summary className="cursor-pointer text-ink-muted list-none flex items-center gap-2 mb-1.5"><span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>{running ? "Run steps" : `${STEP_NAMES.length} steps${runStartedAt && runEndedAt ? `, ${Math.round((runEndedAt - runStartedAt) / 1000)} s` : ""}`}</summary>
          <ol className="flex flex-col gap-1.5 text-sm" aria-label="Run steps" data-testid="steps">
            {STEP_NAMES.map((name, i) => {
              const ev = current(i + 1);
              const status = ev?.status ?? "pending";
              return (
                <li key={name} className="flex items-start gap-2.5">
                  <span className={`mt-1 inline-block w-4 h-4 rounded-full border ${status === "done" ? "bg-accent border-accent" : status === "failed" ? "bg-danger border-danger" : status === "running" || status === "waiting" ? "border-ink sk" : "border-line-input"}`} aria-hidden="true" />
                  <span className={status === "pending" ? "text-ink-muted" : status === "failed" ? "text-danger" : ""}>
                    <span className="font-medium">{name}</span>
                    {ev?.detail && <span className="text-ink-muted">: {ev.detail}</span>}
                    {ev?.txHash && <span className="font-mono text-[13px] text-ink-muted"> {short(ev.txHash)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          </details>
        )}
        {!state?.releases.length && !running && events.length === 0 && (
          <p className="text-sm text-ink-muted px-5 py-3.5 bg-surface-sunken rounded-lg m-0">No release yet in this window. Month {demoMonth} is the first month in which the rule and the sampling window can both be met.</p>
        )}
      </section>

      <div className="sm:hidden fixed bottom-0 inset-x-0 p-4 pb-[max(16px,env(safe-area-inset-bottom))] bg-canvas border-t border-line">
        <button type="button" onClick={run} disabled={buttonDisabled && !runError} className="h-[52px] w-full rounded-md bg-accent-strong text-accent-ink font-semibold text-base disabled:opacity-70">{buttonLabel}</button>
      </div>
    </main>
  );
}

function Param({ p }: { p: { label: string; chosen: boolean; demoValue?: string } }) {
  return (
    <span className={`inline-block bg-surface-2 rounded-full px-2.5 py-px font-sans text-sm tabular align-[2px] ${p.chosen ? "underline decoration-dashed decoration-accent-strong underline-offset-4" : ""}`}>
      {p.label}{p.demoValue ? ` (${p.demoValue} on this demo)` : ""}
    </span>
  );
}
