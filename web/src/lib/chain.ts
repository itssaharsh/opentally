import "server-only";
import { createPublicClient, http, type Address, type Hex, type PublicClient } from "viem";
import { openTallyAbi, openTallyFactoryAbi } from "./abi";
import deploymentJson from "../data/deployment.json";
import { shapeState, type TallyState, type ReleaseView } from "./state";
import { pickInstance, type InstanceInfo, type Picked } from "./instances";
import { chainInfo } from "./chains";
import { busyInstances } from "./limiter";
import { store } from "./store";

export type Deployment = typeof deploymentJson;
export const deployment: Deployment = deploymentJson;
export const chainCfg = chainInfo(deployment.chainId);
export const DEMO_MONTH = 4;

export function rpcUrl() { return process.env.RPC_URL ?? chainCfg.defaultRpc; }

let _client: PublicClient | null = null;
export function publicClient(): PublicClient {
  if (_client) return _client;
  _client = createPublicClient({ chain: chainCfg.chain, transport: http(rpcUrl(), { batch: true, timeout: 20_000 }) });
  return _client;
}

// ---- instances created by the factory, newest last; cached briefly so a page load reads them once
export function invalidateInstance() { store.instanceList = null; }

export async function listInstances(maxRecent = 12): Promise<InstanceInfo[]> {
  const cached = store.instanceList as { at: number; list: InstanceInfo[] } | null;
  if (cached && Date.now() - cached.at < 3_000) return cached.list;
  const client = publicClient();
  const logs = await client.getContractEvents({ address: deployment.factory as Address, abi: openTallyFactoryAbi, eventName: "Created", fromBlock: BigInt(Math.max(0, deployment.deployBlock - 1)), strict: true });
  const recent = logs.slice(-maxRecent);
  const list = await Promise.all(recent.map(async (l) => {
    const address = l.args.instance as Address;
    const [paidCount, batch] = await Promise.all([
      client.readContract({ address, abi: openTallyAbi, functionName: "paidCount" }),
      client.readContract({ address, abi: openTallyAbi, functionName: "batchSubmittedAt", args: [DEMO_MONTH] }),
    ]);
    return { address, index: Number(l.args.index), fromBlock: l.blockNumber as bigint, paidCount: Number(paidCount), demoMonthSubmitted: (batch as bigint) !== 0n };
  }));
  store.instanceList = { at: Date.now(), list };
  return list;
}

export async function resolveInstance(requested?: string | null): Promise<Picked> {
  if (process.env.INSTANCE_ADDRESS) {
    const a = process.env.INSTANCE_ADDRESS;
    const one: InstanceInfo = { address: a, index: 0, fromBlock: BigInt(deployment.deployBlock), paidCount: 0, demoMonthSubmitted: false };
    return { shown: one, fresh: true, pinned: true, spares: 1, lastReleased: null };
  }
  return pickInstance(await listInstances(), requested, busyInstances());
}

/** The instance address for a request, accepted only if the factory created it. */
export async function instanceFor(requested?: string | null): Promise<{ address: Address; fromBlock: bigint; fresh: boolean }> {
  const p = await resolveInstance(requested);
  return { address: p.shown.address as Address, fromBlock: p.shown.fromBlock, fresh: p.fresh };
}

export async function readReleases(client: PublicClient, address: Address, fromBlock: bigint): Promise<ReleaseView[]> {
  const logs = await client.getContractEvents({ address, abi: openTallyAbi, eventName: "ReleaseBatch", fromBlock, strict: true });
  const out: ReleaseView[] = [];
  for (const l of logs) {
    const receipt = await client.getTransactionReceipt({ hash: l.transactionHash as Hex }).catch(() => null);
    out.push({ month: Number(l.args.month), count: Number(l.args.count), totalTusd: Number(l.args.total) / 1e6, txHash: l.transactionHash as string, blockNumber: Number(l.blockNumber), gasUsed: receipt ? Number(receipt.gasUsed) : undefined });
  }
  return out.filter((r) => r.count > 0);
}

export type PageState = TallyState & { fresh: boolean; pinned: boolean; spares: number; lastReleased: string | null; network: string; networkShort: string };

export async function readState(month = DEMO_MONTH, requested?: string | null): Promise<PageState> {
  const client = publicClient();
  const picked = await resolveInstance(requested);
  const address = picked.shown.address as Address;
  const fromBlock = picked.shown.fromBlock;
  const c = { address, abi: openTallyAbi } as const;
  const [programmeName, escrow, paidCount, paidTotal, rule, siteCount, connectionCount, batchAt, block] = await Promise.all([
    client.readContract({ ...c, functionName: "programmeName" }),
    client.readContract({ ...c, functionName: "escrowBalance" }),
    client.readContract({ ...c, functionName: "paidCount" }),
    client.readContract({ ...c, functionName: "paidTotal" }),
    client.readContract({ ...c, functionName: "rule" }),
    client.readContract({ ...c, functionName: "siteCount" }),
    client.readContract({ ...c, functionName: "connectionCount" }),
    client.readContract({ ...c, functionName: "batchSubmittedAt", args: [month] }),
    client.getBlock(),
  ]);
  const n = Number(connectionCount);
  const summaryMonth = (batchAt as bigint) === 0n && month > 1 ? month - 1 : month;
  const sites = await Promise.all(Array.from({ length: Number(siteCount) }, (_, i) => client.readContract({ ...c, functionName: "getSite", args: [i] })));
  const connections = await Promise.all(Array.from({ length: n }, (_, i) => client.readContract({ ...c, functionName: "getConnection", args: [i] })));
  const summaries = await Promise.all(Array.from({ length: n }, (_, i) => client.readContract({ ...c, functionName: "getSummary", args: [summaryMonth, i] })));
  const releases = await readReleases(client, address, fromBlock);
  const [activeDaysMin, kwhMilliMin, windowSeconds] = rule as unknown as [number, number, number];
  const shaped = shapeState({
    instance: address, programmeName: programmeName as string, chainId: deployment.chainId, explorer: chainCfg.explorer,
    escrow: escrow as bigint, paidCount: Number(paidCount), paidTotal: paidTotal as bigint, month, batchSubmittedAt: batchAt as bigint,
    windowSeconds: Number(windowSeconds), nowTs: Number(block.timestamp), summaryMonth,
    rule: { activeDaysMin: Number(activeDaysMin), kwhMilliMin: Number(kwhMilliMin), windowSeconds: Number(windowSeconds) },
    sites: sites.map((s) => ({ name: s.name, payout: s.payout, gateway: s.gateway, connectionCount: Number(s.connectionCount) })),
    connections: connections.map((x) => ({ siteId: Number(x.siteId), paid: x.paid, held: x.held, holdReason: Number(x.holdReason), paidMonth: Number(x.paidMonth), commissionedAt: x.commissionedAt })),
    summaries: summaries.map((s) => ({ exists: s.exists, activeDays: Number(s.activeDays), kwhMilli: Number(s.kwhMilli), traceHash: s.traceHash })),
    releases,
  });
  const lastReleased = picked.lastReleased && picked.lastReleased.address.toLowerCase() !== address.toLowerCase() ? picked.lastReleased.address : null;
  return { ...shaped, fresh: picked.fresh, pinned: picked.pinned, spares: picked.spares, lastReleased, network: chainCfg.label, networkShort: chainCfg.short };
}
