import { NextResponse } from "next/server";
import { resetInstance } from "@/lib/reset";
import { allow } from "@/lib/limiter";
import { funds } from "@/lib/wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Prepare a fresh programme instance (the demo's reset). Costs test ETH only. */
export async function POST() {
  if (!allow("reset", 2, 10 * 60_000)) return NextResponse.json({ ok: false, error: "A fresh programme was prepared in the last few minutes; open the first screen to use it." }, { status: 429 });
  const f = await funds();
  if (!f.ok) return NextResponse.json({ ok: false, error: f.reason }, { status: 503 });
  const steps: string[] = [];
  try {
    const r = await resetInstance((s) => steps.push(s));
    return NextResponse.json({ ok: true, programme: r.instance, txs: r.txs.length, steps });
  } catch (e) {
    console.error("reset failed:", (e as Error).message.split("\n").slice(0, 6).join(" | "));
    return NextResponse.json({ ok: false, error: (e as Error).message.split("\n")[0], steps }, { status: 502 });
  }
}
