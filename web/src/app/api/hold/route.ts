import { NextResponse } from "next/server";
import { createWalletClient, http } from "viem";
import { sepolia, hardhat } from "viem/chains";
import { openTallyAbi } from "@/lib/abi";
import { publicClient, instanceAddress, rpcUrl, deployment } from "@/lib/chain";
import { roleAccount, ROLE } from "@/lib/keys";
import { allow } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`hold:${ip}`, 10, 60_000)) return NextResponse.json({ ok: false, error: "Too many hold changes from this address; wait a minute." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { id?: number; action?: "lift" | "keep" | "hold"; reason?: number };
  if (typeof body.id !== "number" || !body.action) return NextResponse.json({ ok: false, error: "id and action are required" }, { status: 400 });
  if (body.action === "keep") return NextResponse.json({ ok: true, action: "keep", id: body.id });
  const chain = deployment.chainId === 11155111 ? sepolia : { ...hardhat, id: deployment.chainId };
  const verifier = createWalletClient({ account: roleAccount(ROLE.verifier), chain, transport: http(rpcUrl(), { timeout: 60_000 }) });
  const address = instanceAddress();
  try {
    const hash = body.action === "lift"
      ? await verifier.writeContract({ address, abi: openTallyAbi, functionName: "lift", args: [body.id] })
      : await verifier.writeContract({ address, abi: openTallyAbi, functionName: "hold", args: [body.id, body.reason ?? 3] });
    const receipt = await publicClient().waitForTransactionReceipt({ hash });
    return NextResponse.json({ ok: true, action: body.action, id: body.id, txHash: hash, blockNumber: Number(receipt.blockNumber) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.split("\n")[0] }, { status: 502 });
  }
}
