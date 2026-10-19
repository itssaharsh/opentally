import { NextResponse } from "next/server";
import { resetInstance } from "@/lib/reset";
import { allow, acquireRun, releaseRun } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!allow("reset", 1, 10 * 60_000)) return NextResponse.json({ ok: false, error: "The demo was reset less than ten minutes ago; wait before resetting again." }, { status: 429 });
  if (!acquireRun("reset")) return NextResponse.json({ ok: false, error: "A run is in progress." }, { status: 429 });
  const steps: string[] = [];
  try {
    const r = await resetInstance((s) => steps.push(s));
    return NextResponse.json({ ok: true, instance: r.instance, txs: r.txs.length, steps });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.split("\n")[0], steps }, { status: 502 });
  } finally { releaseRun(); }
}
