import { NextResponse } from "next/server";
import { readState, type PageState } from "@/lib/chain";
import { topUpSparesLater } from "@/lib/reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // room for a background spare top-up after the response

const lastKnown = new Map<string, PageState>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month") ?? 4);
  const programme = url.searchParams.get("programme");
  try {
    const state = await readState(month, programme);
    lastKnown.set(programme ?? "", state);
    topUpSparesLater(state.spares);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    const message = e instanceof Error ? e.message.split("\n")[0] : "chain read failed";
    return NextResponse.json({ ok: false, error: message, lastKnown: lastKnown.get(programme ?? "") ?? null }, { status: 503 });
  }
}
