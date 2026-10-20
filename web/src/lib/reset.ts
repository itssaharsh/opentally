import "server-only";
import { keccak256, toHex, parseEventLogs, type Address, type Hex } from "viem";
import { openTallyAbi, openTallyFactoryAbi, testUSDAbi } from "./abi";
import { publicClient, deployment, invalidateInstance, listInstances } from "./chain";
import { roleAccount, gatewayFor, ROLE } from "./keys";
import { wallet, topUp, funds } from "./wallets";
import { isFresh } from "./instances";
import programme from "../data/programme.json";
import { store } from "./store";

type Conn = { id: number; code: string; siteIndex: number; meterSerial: string; gpsCell: string; commissionedAt: number; summaries: Record<string, { activeDays: number; kwhMilli: number; traceHash: Hex }> };
type Programme = { programmeName: string; sites: { code: string; name: string; town: string; count: number }[]; connections: Conn[] };
const data = programme as unknown as Programme;

const SUMMARY_TYPES = {
  Summary: [
    { name: "connectionId", type: "uint32" }, { name: "month", type: "uint32" },
    { name: "activeDays", type: "uint16" }, { name: "kwhMilli", type: "uint32" }, { name: "traceHash", type: "bytes32" },
  ],
} as const;

const keccakOf = (s: string) => keccak256(toHex(s));

/// Creates a fresh programme instance through the factory, registers the demo world, deposits the pool and submits
/// months 1 to 3. Costs test ETH only. Returns the new instance address.
export async function resetInstance(onStep?: (s: string) => void): Promise<{ instance: Address; txs: Hex[] }> {
  const pc = publicClient();
  await topUp();
  const chainId = await pc.getChainId();
  const owner = wallet(ROLE.owner);
  const funder = wallet(0);
  const verifierAddr = roleAccount(ROLE.verifier).address;
  const txs: Hex[] = [];
  const wait = async (h: Hex) => { txs.push(h); await pc.waitForTransactionReceipt({ hash: h }); };
  const factory = deployment.factory as Address;
  const token = deployment.token as Address;
  const rule = { activeDaysMin: deployment.rule.activeDaysMin, kwhMilliMin: deployment.rule.kwhMilliMin, windowSeconds: deployment.rule.windowSeconds };

  onStep?.("Creating a fresh programme instance");
  const createHash = await owner.writeContract({ address: factory, abi: openTallyFactoryAbi, functionName: "create", args: [token, verifierAddr, funder.account.address, 350_000_000n, rule, data.programmeName] });
  txs.push(createHash);
  // the new address comes from the receipt; a "latest" read can land on a node a block behind and return the previous one
  const createReceipt = await pc.waitForTransactionReceipt({ hash: createHash });
  const [created] = parseEventLogs({ abi: openTallyFactoryAbi, logs: createReceipt.logs, eventName: "Created" });
  const instance = created.args.instance as Address;
  const c = { address: instance, abi: openTallyAbi } as const;

  onStep?.("Registering 3 sites");
  for (let i = 0; i < data.sites.length; i++) {
    const s = data.sites[i];
    await wait(await owner.writeContract({ ...c, functionName: "registerSite", args: [`${s.name}, ${s.town}`, roleAccount(6 + i).address, gatewayFor(i).address] }));
  }
  onStep?.("Registering 50 connections");
  const inputs = [] as { siteId: number; meterHash: Hex; customerHash: Hex; gpsCell: Hex; commissionedAt: bigint }[];
  for (const cn of data.connections) inputs.push({ siteId: cn.siteIndex, meterHash: keccakOf(cn.meterSerial), customerHash: keccakOf(`customer:${cn.code}`), gpsCell: keccakOf(cn.gpsCell), commissionedAt: BigInt(cn.commissionedAt) });
  for (let i = 0; i < inputs.length; i += 25) await wait(await owner.writeContract({ ...c, functionName: "registerConnections", args: [inputs.slice(i, i + 25)] }));

  onStep?.("Depositing 17,500 tUSD");
  await wait(await funder.writeContract({ address: token, abi: testUSDAbi, functionName: "approve", args: [instance, 17_500_000_000n] }));
  await wait(await funder.writeContract({ ...c, functionName: "deposit", args: [17_500_000_000n] }));

  for (const month of [1, 2, 3]) {
    onStep?.(`Submitting month ${month}`);
    const items = data.connections.map((cn) => ({ connectionId: cn.id, month, activeDays: cn.summaries[String(month)].activeDays, kwhMilli: cn.summaries[String(month)].kwhMilli, traceHash: cn.summaries[String(month)].traceHash }));
    const sigs: Hex[] = [];
    for (const cn of data.connections) sigs.push(await gatewayFor(cn.siteIndex).signTypedData({ domain: { name: "OpenTally", version: "1", chainId, verifyingContract: instance }, types: SUMMARY_TYPES, primaryType: "Summary", message: items[cn.id] }));
    await wait(await owner.writeContract({ ...c, functionName: "submitSummaries", args: [month, items, sigs] }));
  }
  invalidateInstance();
  return { instance, txs };
}

/** Seed spare instances until `want` fresh ones exist. One seeding at a time per server instance; duplicates on-chain are harmless. */
export async function ensureSpares(want = 2): Promise<number> {
  if (store.seeding) { await store.seeding.catch(() => null); }
  const run = (async () => {
    invalidateInstance();
    let fresh = (await listInstances()).filter(isFresh).length;
    while (fresh < want) {
      const f = await funds();
      if (!f.ok) break;
      await resetInstance();
      fresh++;
    }
    return fresh;
  })();
  store.seeding = run;
  try { return (await run) as number; } finally { store.seeding = null; }
}
