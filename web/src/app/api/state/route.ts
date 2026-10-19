import { NextResponse } from "next/server";
import { readState, type PageState } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const lastKnown = new Map<string, PageState>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month") ?? 4);
  const programme = url.searchParams.get("programme");
  try {
    const state = await readState(month, programme);
    lastKnown.set(programme ?? "", state);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    const message = e instanceof Error ? e.message.split("\n")[0] : "chain read failed";
    return NextResponse.json({ ok: false, error: message, lastKnown: lastKnown.get(programme ?? "") ?? null }, { status: 503 });
  }
}
