import { NextResponse } from "next/server";
import { openTallyAbi } from "@/lib/abi";
import { publicClient, instanceFor, invalidateInstance, UnknownProgramme } from "@/lib/chain";
import { ROLE } from "@/lib/keys";
import { wallet } from "@/lib/wallets";
import { allow } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`hold:${ip}`, 10, 60_000)) return NextResponse.json({ ok: false, error: "Too many hold changes from this address; wait a minute." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { id?: number; action?: "lift" | "keep" | "hold"; reason?: number; programme?: string };
  if (typeof body.id !== "number" || !Number.isInteger(body.id) || body.id < 0 || body.id > 10_000 || !body.action) return NextResponse.json({ ok: false, error: "id and action are required" }, { status: 400 });
  if (!["lift", "keep", "hold"].includes(body.action)) return NextResponse.json({ ok: false, error: "action must be lift, keep or hold" }, { status: 400 });
  let address: `0x${string}`;
  try { ({ address } = await instanceFor(body.programme)); }
  catch (e) { if (e instanceof UnknownProgramme) return NextResponse.json({ ok: false, error: e.message }, { status: 400 }); throw e; }
  if (body.action === "keep") return NextResponse.json({ ok: true, action: "keep", id: body.id, programme: address });
  const verifier = wallet(ROLE.verifier);
  try {
    const hash = body.action === "lift"
      ? await verifier.writeContract({ address, abi: openTallyAbi, functionName: "lift", args: [body.id] })
      : await verifier.writeContract({ address, abi: openTallyAbi, functionName: "hold", args: [body.id, body.reason ?? 3] });
    const receipt = await publicClient().waitForTransactionReceipt({ hash });
    invalidateInstance();
    return NextResponse.json({ ok: true, action: body.action, id: body.id, programme: address, txHash: hash, blockNumber: Number(receipt.blockNumber) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.split("\n")[0] }, { status: 502 });
  }
}
