import "server-only";
import { createWalletClient, http, type Address, type Hex, decodeEventLog, BaseError, ContractFunctionRevertedError } from "viem";
import { sepolia, hardhat } from "viem/chains";
import { openTallyAbi } from "./abi";
import { publicClient, instanceAddress, rpcUrl, deployment, DEMO_MONTH } from "./chain";
import { roleAccount, gatewayFor, ROLE } from "./keys";
import { screenMonth, type Trace } from "./screen";
import programme from "../data/programme.json";

export type StepEvent = {
  step: number; name: string; status: "running" | "done" | "failed" | "waiting";
  detail?: string; count?: number; txHash?: string; gasUsed?: number; secondsLeft?: number; at: number;
};

export const STEP_NAMES = [
  "Verifying 50 site-signed summaries",
  "Screening traces against each site",
  "Applying the rule",
  "Checking the sampling window",
  "Sending the release",
];

const SUMMARY_TYPES = {
  Summary: [
    { name: "connectionId", type: "uint32" }, { name: "month", type: "uint32" },
    { name: "activeDays", type: "uint16" }, { name: "kwhMilli", type: "uint32" }, { name: "traceHash", type: "bytes32" },
  ],
} as const;

function chain() { return deployment.chainId === 11155111 ? sepolia : { ...hardhat, id: deployment.chainId }; }
function wallet(index: number) {
  return createWalletClient({ account: roleAccount(index), chain: chain(), transport: http(rpcUrl(), { timeout: 60_000 }) });
}
function revertName(e: unknown): { name: string; args: readonly unknown[] } | null {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (r instanceof ContractFunctionRevertedError) return { name: r.data?.errorName ?? r.reason ?? "reverted", args: r.data?.args ?? [] };
  }
  return null;
}

type Conn = { id: number; code: string; siteIndex: number; traces: Record<string, number[]>; summaries: Record<string, { activeDays: number; kwhMilli: number; traceHash: Hex }> };
const connections = (programme as unknown as { connections: Conn[] }).connections;

export async function* runMonth(month = DEMO_MONTH, opts: { wrongKeyDemo?: boolean } = { wrongKeyDemo: true }): AsyncGenerator<StepEvent> {
  const pc = publicClient();
  const address = await instanceAddress();
  const chainId = await pc.getChainId();
  const owner = wallet(ROLE.owner);
  const verifier = wallet(ROLE.verifier);
  const now = () => Date.now();
  const c = { address, abi: openTallyAbi } as const;

  // ---- step 1: sign and submit summaries
  yield { step: 1, name: STEP_NAMES[0], status: "running", at: now() };
  const already = (await pc.readContract({ ...c, functionName: "batchSubmittedAt", args: [month] })) as bigint;
  if (already === 0n) {
    const items = connections.map((cn) => ({ connectionId: cn.id, month, activeDays: cn.summaries[String(month)].activeDays, kwhMilli: cn.summaries[String(month)].kwhMilli, traceHash: cn.summaries[String(month)].traceHash }));
    const sign = async (item: (typeof items)[number], siteIndex: number) => gatewayFor(siteIndex).signTypedData({
      domain: { name: "OpenTally", version: "1", chainId, verifyingContract: address }, types: SUMMARY_TYPES, primaryType: "Summary", message: item,
    });
    const sigs: Hex[] = [];
    for (const cn of connections) sigs.push(await sign(items[cn.id], cn.siteIndex));
    let rejectNote = "";
    if (opts.wrongKeyDemo) {
      // The security moment: one summary signed with another site's key. The contract refuses the whole batch.
      const victim = connections.find((x) => x.code === "C-B14")!;
      const badSigs = [...sigs];
      badSigs[victim.id] = await sign(items[victim.id], 2);
      try {
        await pc.simulateContract({ ...c, functionName: "submitSummaries", args: [month, items, badSigs], account: owner.account });
        yield { step: 1, name: STEP_NAMES[0], status: "running", detail: "unexpected: a wrong-key batch was accepted in simulation", at: now() };
      } catch (e) {
        const r = revertName(e);
        rejectNote = `1 summary rejected by the contract first: ${victim.code} was signed with site C's key (${r?.name ?? "reverted"}), then re-signed with site B's key`;
        yield { step: 1, name: STEP_NAMES[0], status: "running", detail: rejectNote, at: now() };
      }
    }
    const hash = await owner.writeContract({ ...c, functionName: "submitSummaries", args: [month, items, sigs] });
    const receipt = await pc.waitForTransactionReceipt({ hash });
    yield { step: 1, name: STEP_NAMES[0], status: "done", count: items.length, txHash: hash, gasUsed: Number(receipt.gasUsed), detail: `${items.length} of ${items.length} verified on-chain${rejectNote ? "; " + rejectNote : ""}`, at: now() };
  } else {
    yield { step: 1, name: STEP_NAMES[0], status: "done", count: connections.length, detail: "already submitted earlier; verified on-chain", at: now() };
  }

  // ---- step 2: screen and hold
  yield { step: 2, name: STEP_NAMES[1], status: "running", at: now() };
  const traces: Trace[] = connections.map((cn) => ({ id: cn.id, code: cn.code, siteIndex: cn.siteIndex, days: cn.traces[String(month)] }));
  const flags = screenMonth(traces);
  const current = await Promise.all(flags.map((f) => pc.readContract({ ...c, functionName: "getConnection", args: [f.id] })));
  const toHold = flags.filter((f, i) => !current[i].held && !current[i].paid);
  let holdTx: Hex | undefined;
  if (toHold.length) {
    holdTx = await verifier.writeContract({ ...c, functionName: "holdMany", args: [toHold.map((f) => f.id), toHold.map((f) => f.reason)] });
    await pc.waitForTransactionReceipt({ hash: holdTx });
  }
  yield { step: 2, name: STEP_NAMES[1], status: "done", count: flags.length, txHash: holdTx, detail: flags.length ? `${flags.length} held: ${flags.map((f) => `${f.code} (${f.reason === 1 ? "identical to " + f.pairedWith : f.reason === 2 ? "flat" : "outlier"})`).join(", ")}` : "nothing held", at: now() };

  // ---- step 3: the rule
  yield { step: 3, name: STEP_NAMES[2], status: "running", at: now() };
  const eligible = (await pc.readContract({ ...c, functionName: "eligible", args: [month] })) as readonly number[];
  yield { step: 3, name: STEP_NAMES[2], status: "done", count: eligible.length, detail: `${eligible.length} eligible: active days and consumption meet the rule, not held, not yet paid`, at: now() };

  // ---- step 4: the window
  yield { step: 4, name: STEP_NAMES[3], status: "running", at: now() };
  for (;;) {
    const closesAt = Number((await pc.readContract({ ...c, functionName: "windowClosesAt", args: [month] })) as bigint);
    const block = await pc.getBlock();
    const left = closesAt - Number(block.timestamp);
    if (left <= 0) break;
    yield { step: 4, name: STEP_NAMES[3], status: "waiting", secondsLeft: left, detail: `the sampling window closes in ${left} s (30 s on this demo instance; 14 days in the terms)`, at: now() };
    await new Promise((r) => setTimeout(r, Math.min(5000, Math.max(1000, left * 1000))));
    if (deployment.chainId !== 11155111) {
      // a local chain only advances when a block is mined; nudge it with an empty transaction from the owner
      try { const h = await owner.sendTransaction({ to: owner.account.address, value: 0n }); await pc.waitForTransactionReceipt({ hash: h }); } catch { /* ignore */ }
    }
  }
  yield { step: 4, name: STEP_NAMES[3], status: "done", detail: "closed; no hold outstanding on the eligible connections", at: now() };

  // ---- step 5: release
  yield { step: 5, name: STEP_NAMES[4], status: "running", at: now() };
  try {
    const hash = await owner.writeContract({ ...c, functionName: "release", args: [month] });
    const receipt = await pc.waitForTransactionReceipt({ hash });
    let count = 0, total = 0n;
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: openTallyAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "ReleaseBatch") { count = Number((ev.args as { count: number }).count); total = (ev.args as { total: bigint }).total; }
      } catch { /* other logs */ }
    }
    yield { step: 5, name: STEP_NAMES[4], status: "done", count, txHash: hash, gasUsed: Number(receipt.gasUsed), detail: `${count} connections released, ${Number(total) / 1e6} tUSD, block ${receipt.blockNumber}`, at: now() };
  } catch (e) {
    const r = revertName(e);
    yield { step: 5, name: STEP_NAMES[4], status: "failed", detail: r ? `the release reverted: ${r.name}; nothing moved` : `the release failed: ${(e as Error).message.split("\n")[0]}; nothing moved`, at: now() };
  }
}
