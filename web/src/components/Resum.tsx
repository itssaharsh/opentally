"use client";
import { useRef, useState } from "react";
import { createPublicClient, http, type Address } from "viem";
import { openTallyAbi } from "@/lib/abi";
import { eventsChunked } from "@/lib/logs";
import { resum, toCsv, type ReleasedRecord, type ResumResult } from "@/lib/resum";

type Row = { label: string; value?: string; done: boolean };

// Re-sum in the visitor's own browser: read the Released events and the contract's counters straight from a public
// RPC endpoint, add them up here, and compare. Falls back to this site's server only if the browser cannot reach the RPC.
export function Resum({ programme, fromBlock, rpc, chainId, network, logSpan }: { programme: string; fromBlock: number; rpc: string; chainId: number; network: string; logSpan: number }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [result, setResult] = useState<ResumResult | null>(null);
  const [records, setRecords] = useState<ReleasedRecord[]>([]);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function open() {
    dlg.current?.showModal();
    setRows([]); setResult(null); setError(null);
    try {
      let recs: ReleasedRecord[]; let chain: { paidCount: number; paidTotalTusd: number };
      try {
        setRows([{ label: `Reading the release records from ${network} in your browser`, done: false }]);
        const client = createPublicClient({ transport: http(rpc, { timeout: 15_000 }) });
        const id = await client.getChainId();
        if (id !== chainId) throw new Error(`RPC is on chain ${id}, expected ${chainId}`);
        const logs = await eventsChunked(client, (f, t) => client.getContractEvents({ address: programme as Address, abi: openTallyAbi, eventName: "Released", fromBlock: f, toBlock: t, strict: true }), BigInt(fromBlock), logSpan);
        recs = logs.map((l) => ({ connectionId: Number(l.args.connectionId), month: Number(l.args.month), siteId: Number(l.args.siteId), amountTusd: Number(l.args.amount) / 1e6, txHash: l.transactionHash as string, blockNumber: Number(l.blockNumber) }));
        const [pc, pt] = await Promise.all([
          client.readContract({ address: programme as Address, abi: openTallyAbi, functionName: "paidCount" }),
          client.readContract({ address: programme as Address, abi: openTallyAbi, functionName: "paidTotal" }),
        ]);
        chain = { paidCount: Number(pc), paidTotalTusd: Number(pt) / 1e6 };
        setSource(`read directly from ${network} at ${new URL(rpc).host}`);
      } catch {
        setRows([{ label: "Your browser couldn't reach the chain directly; reading the records through this site", done: false }]);
        const r = await fetch(`/api/resum?programme=${programme}`, { cache: "no-store" });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error ?? "couldn't read the release records");
        recs = j.records; chain = j.result.chain;
        setSource("read through this site's server");
      }
      setRecords(recs);
      const res = resum(recs, chain);
      setRows([
        { label: `Reading ${recs.length} release records`, done: true },
        { label: "Paid connections", value: String(res.paidCount), done: true },
        { label: "Amount released", value: `${res.paidTotalTusd.toLocaleString("en-US")} tUSD`, done: true },
      ]);
      setResult(res);
    } catch (e) { setError((e as Error).message); }
  }

  function download(kind: "json" | "csv") {
    const body = kind === "json" ? JSON.stringify({ programme, records, result }, null, 2) : toCsv(records);
    const url = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `opentally-releases-${programme.slice(0, 10)}.${kind}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <button type="button" onClick={open} className="h-8 px-3 rounded-md bg-surface-2 text-ink text-sm font-semibold" data-testid="resum-open">Re-sum</button>
      <dialog ref={dlg} className="resum m-0 ml-auto h-full max-h-none w-full max-w-[480px] bg-surface-1 text-ink p-0 shadow-[var(--shadow-overlay)]" aria-labelledby="resum-title" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <div className="flex flex-col gap-5 p-6 h-full">
          <div className="flex items-start justify-between gap-4">
            <h2 id="resum-title" className="font-display font-semibold text-2xl">Re-sum the releases</h2>
            <button type="button" onClick={() => dlg.current?.close()} className="h-9 px-3 rounded-md text-ink-muted hover:bg-surface-2" aria-label="Close">Close</button>
          </div>
          <p className="text-sm text-ink-muted m-0">Every paid connection left a release record on the ledger. This adds them up and compares the result with the contract&apos;s own counters.</p>
          <ol className="flex flex-col gap-2 m-0 p-0 list-none" data-testid="resum-rows">
            {rows.map((r) => (
              <li key={r.label} className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                <span className={r.done ? "" : "text-ink-muted"}>{r.label}</span>
                {r.value && <span className="font-semibold tabular">{r.value}</span>}
              </li>
            ))}
          </ol>
          {result && (result.matches
            ? <p className="m-0 font-semibold flex items-center gap-2" data-testid="resum-verdict"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--accent-strong)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>Matches the chain</p>
            : <div data-testid="resum-verdict"><p className="m-0 font-semibold text-danger">Differs from the chain</p><ul className="text-sm m-0 pl-5">{result.differences.map((d) => <li key={d}>{d}</li>)}</ul></div>)}
          {source && <p className="text-[13px] text-ink-muted m-0">Records {source}.</p>}
          {error && <p className="text-sm text-danger m-0" role="alert">Couldn&apos;t read the release records: {error}</p>}
          {result && (
            <div className="flex gap-3 mt-auto">
              <button type="button" onClick={() => download("json")} className="h-10 px-4 rounded-md bg-surface-2 font-semibold text-sm">Download JSON</button>
              <button type="button" onClick={() => download("csv")} className="h-10 px-4 rounded-md bg-surface-2 font-semibold text-sm">Download CSV</button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
