import { NextResponse } from "next/server";
import { readState } from "@/lib/chain";
import type { TallyState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let lastKnown: TallyState | null = null;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month") ?? 4);
  try {
    const state = await readState(month);
    lastKnown = state;
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    const message = e instanceof Error ? e.message.split("\n")[0] : "chain read failed";
    return NextResponse.json({ ok: false, error: message, lastKnown }, { status: 503 });
  }
}
