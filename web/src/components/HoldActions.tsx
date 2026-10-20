"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { noteBlock } from "@/lib/seen";

export function HoldActions({ id, programme, held }: { id: number; programme: string; held: boolean }) {
  const [busy, setBusy] = useState<null | "lift" | "keep">(null);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();
  async function act(action: "lift" | "keep") {
    setBusy(action); setNote(null);
    try {
      const r = await fetch("/api/hold", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action, programme }) });
      const j = await r.json();
      if (!j.ok) { setNote(j.error ?? "That didn't go through."); return; }
      noteBlock(j.blockNumber);
      setNote(action === "lift" ? "Hold lifted on the chain. The programme pays this connection at its next release." : "Hold kept. Nothing changed on the chain.");
      router.refresh();
    } catch (e) { setNote((e as Error).message); }
    finally { setBusy(null); }
  }
  if (!held) return null;
  return (
    <section className="flex flex-col gap-2">
      <button type="button" onClick={() => act("lift")} disabled={!!busy} className="h-11 rounded-md bg-surface-2 text-ink font-semibold disabled:opacity-60">{busy === "lift" ? "Lifting…" : "Lift hold"}</button>
      <button type="button" onClick={() => act("keep")} disabled={!!busy} className="h-10 rounded-md text-ink-muted font-medium hover:bg-surface-2 disabled:opacity-60">Keep hold</button>
      <span className="text-[13px] text-ink-muted">Both are signed with the verifier key; a lift is recorded on the ledger.</span>
      {note && <p className="text-sm m-0" role="status" data-testid="hold-note">{note}</p>}
    </section>
  );
}
