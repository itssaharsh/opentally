import { NextResponse } from "next/server";
import { openTallyAbi } from "@/lib/abi";
import { publicClient, currentInstance } from "@/lib/chain";
import { resum, toCsv, type ReleasedRecord } from "@/lib/resum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const pc = publicClient();
  const { address, fromBlock } = await currentInstance();
  try {
    const logs = await pc.getContractEvents({ address, abi: openTallyAbi, eventName: "Released", fromBlock, strict: true });
    const records: ReleasedRecord[] = logs.map((l) => ({
      connectionId: Number(l.args.connectionId), month: Number(l.args.month), siteId: Number(l.args.siteId),
      amountTusd: Number(l.args.amount) / 1e6, txHash: l.transactionHash as string, blockNumber: Number(l.blockNumber),
    }));
    const [paidCount, paidTotal] = await Promise.all([
      pc.readContract({ address, abi: openTallyAbi, functionName: "paidCount" }),
      pc.readContract({ address, abi: openTallyAbi, functionName: "paidTotal" }),
    ]);
    const result = resum(records, { paidCount: Number(paidCount), paidTotalTusd: Number(paidTotal) / 1e6 });
    if (format === "csv") return new Response(toCsv(records), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="opentally-releases-${address.slice(0, 8)}.csv"` } });
    return NextResponse.json({ ok: true, instance: address, records, result, computedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.split("\n")[0] }, { status: 503 });
  }
}
