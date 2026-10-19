import { NextResponse } from "next/server";
import { BaseError, ContractFunctionRevertedError, decodeEventLog } from "viem";
import { openTallyAbi } from "@/lib/abi";
import { publicClient, instanceFor, invalidateInstance, DEMO_MONTH, UnknownProgramme } from "@/lib/chain";
import { ROLE } from "@/lib/keys";
import { wallet } from "@/lib/wallets";
import { allow } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Release connections that became eligible after the month's release (a lifted hold). Same contract call as step 5. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`release:${ip}`, 5, 10 * 60_000)) return NextResponse.json({ ok: false, error: "Too many releases from this address; wait a few minutes." }, { status: 429 });
  const url = new URL(req.url);
  let address: `0x${string}`;
  try { ({ address } = await instanceFor(url.searchParams.get("programme"))); }
  catch (e) { if (e instanceof UnknownProgramme) return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); throw e; }
  const pc = publicClient();
  try {
    const hash = await wallet(ROLE.owner).writeContract({ address, abi: openTallyAbi, functionName: "release", args: [DEMO_MONTH] });
    const receipt = await pc.waitForTransactionReceipt({ hash });
    let count = 0;
    for (const log of receipt.logs) {
      try { const ev = decodeEventLog({ abi: openTallyAbi, data: log.data, topics: log.topics }); if (ev.eventName === "ReleaseBatch") count = Number((ev.args as { count: number }).count); } catch { /* other logs */ }
    }
    invalidateInstance();
    return NextResponse.json({ ok: true, count, txHash: hash, blockNumber: Number(receipt.blockNumber) });
  } catch (e) {
    const r = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    const name = r instanceof ContractFunctionRevertedError ? r.data?.errorName ?? r.reason : null;
    return NextResponse.json({ ok: false, error: name ? `The release reverted: ${name}. Nothing moved.` : (e as Error).message.split("\n")[0] }, { status: 502 });
  }
}
