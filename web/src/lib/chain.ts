import "server-only";
import { createPublicClient, http, type Address, type Hex, type PublicClient } from "viem";
import { openTallyAbi, openTallyFactoryAbi } from "./abi";
import deploymentJson from "../data/deployment.json";
import { shapeState, type TallyState, type ReleaseView } from "./state";
import { pickInstance, type InstanceInfo, type Picked } from "./instances";
import { chainInfo } from "./chains";
import { busyInstances } from "./limiter";
import { store } from "./store";
import { eventsChunked } from "./logs";
import { readAfter } from "./lag";
import { SEEN_COOKIE } from "./seen";

export type Deployment = typeof deploymentJson;
export const deployment: Deployment = deploymentJson;
export const chainCfg = chainInfo(deployment.chainId);
export const DEMO_MONTH = 4;

export function rpcUrl() { return process.env.RPC_URL ?? chainCfg.defaultRpc; }
export const lagging = chainCfg.minGasEth > 0;
/** The block to read at: the node's head, or our own latest write if the node answering is behind it. */
export async function readBlock(client: PublicClient): Promise<bigint> {
  const head = await client.getBlockNumber({ cacheTime: 0 });
  let want = store.lastWrite && store.lastWrite > head ? store.lastWrite : head;
  // the visitor's own latest write (see lib/seen.ts); capped a minute ahead so a forged cookie cannot stall a read
  try {
    const { cookies } = await import("next/headers");
    const v = (await cookies()).get(SEEN_COOKIE)?.value;
    if (v && /^\d{1,12}$/.test(v)) { const b = BigInt(v); if (b > want && b <= head + 30n) want = b; }
  } catch { /* outside a request: scripts and tests */ }
  return want;
}
export function logSpan() { return Number(process.env.LOG_SPAN ?? chainCfg.logSpan); }

let _client: PublicClient | null = null;
export function publicClient(): PublicClient {
  if (_client) return _client;
  const c = createPublicClient({ chain: chainCfg.chain, transport: http(rpcUrl(), { batch: true, timeout: 20_000 }) });
  // remember the newest block one of our own transactions landed in, so later reads can ask for at least that block
  const wait = c.waitForTransactionReceipt.bind(c);
  c.waitForTransactionReceipt = (async (args: Parameters<typeof wait>[0]) => {
    // never wait forever: a transaction the sequencer dropped surfaces as a failed step with Retry
    const r = await wait({ timeout: chainCfg.minGasEth > 0 ? 90_000 : undefined, ...args });
    if (!store.lastWrite || r.blockNumber > store.lastWrite) store.lastWrite = r.blockNumber;
    return r;
  }) as typeof wait;
  _client = c as PublicClient;
  return _client;
}

// ---- instances created by the factory, newest last; cached briefly so a page load reads them once
export function invalidateInstance() { store.instanceList = null; }

export async function listInstances(maxRecent = 12): Promise<InstanceInfo[]> {
  const cached = store.instanceList as { at: number; list: InstanceInfo[] } | null;
  if (cached && Date.now() - cached.at < 3_000) return cached.list;
  const client = publicClient();
  // the factory's Created events, scanned incrementally: a warm server only reads the blocks since its last scan
  const scan = (store.createdScan ??= { to: BigInt(Math.max(0, deployment.deployBlock - 1)) - 1n, logs: [] });
  const head = await client.getBlockNumber();
  if (head > scan.to) {
    const fresh = await eventsChunked(client, (fromBlock, toBlock) => client.getContractEvents({ address: deployment.factory as Address, abi: openTallyFactoryAbi, eventName: "Created", fromBlock, toBlock, strict: true }), scan.to + 1n, logSpan());
    scan.logs.push(...fresh); scan.to = head;
  }
  const logs = scan.logs as Awaited<ReturnType<typeof client.getContractEvents<typeof openTallyFactoryAbi, "Created">>>;
  const recent = logs.slice(-maxRecent);
  const at = await readBlock(client);
  const list = await Promise.all(recent.map(async (l) => {
    const address = l.args.instance as Address;
    const [paidCount, batch, prior] = await readAfter(() => Promise.all([
      client.readContract({ address, abi: openTallyAbi, functionName: "paidCount", blockNumber: at }),
      client.readContract({ address, abi: openTallyAbi, functionName: "batchSubmittedAt", args: [DEMO_MONTH], blockNumber: at }),
      client.readContract({ address, abi: openTallyAbi, functionName: "batchSubmittedAt", args: [DEMO_MONTH - 1], blockNumber: at }),
    ]), lagging);
    return { address, index: Number(l.args.index), fromBlock: l.blockNumber as bigint, paidCount: Number(paidCount),
      demoMonthSubmitted: (batch as bigint) !== 0n, ready: (prior as bigint) !== 0n };
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

export class UnknownProgramme extends Error {}

/** The instance address for a write or a re-sum. A programme named in the request must be one the factory created. */
export async function instanceFor(requested?: string | null): Promise<{ address: Address; fromBlock: bigint; fresh: boolean }> {
  if (requested && !/^0x[0-9a-fA-F]{40}$/.test(requested)) throw new UnknownProgramme("programme must be a contract address");
  const p = await resolveInstance(requested);
  if (requested && !p.pinned) throw new UnknownProgramme("that programme was not created by this site's factory");
  return { address: p.shown.address as Address, fromBlock: p.shown.fromBlock, fresh: p.fresh };
}

export async function readReleases(client: PublicClient, address: Address, fromBlock: bigint): Promise<ReleaseView[]> {
  const logs = await eventsChunked(client, (f, t) => client.getContractEvents({ address, abi: openTallyAbi, eventName: "ReleaseBatch", fromBlock: f, toBlock: t, strict: true }), fromBlock, logSpan());
  const out: ReleaseView[] = [];
  for (const l of logs) {
    const receipt = await client.getTransactionReceipt({ hash: l.transactionHash as Hex }).catch(() => null);
    out.push({ month: Number(l.args.month), count: Number(l.args.count), totalTusd: Number(l.args.total) / 1e6, txHash: l.transactionHash as string, blockNumber: Number(l.blockNumber), gasUsed: receipt ? Number(receipt.gasUsed) : undefined });
  }
  return out.filter((r) => r.count > 0);
}

export type PageState = TallyState & { fresh: boolean; pinned: boolean; spares: number; lastReleased: string | null; network: string; networkShort: string; fromBlock: number; publicRpc: string; logSpan: number };

export async function readState(month = DEMO_MONTH, requested?: string | null): Promise<PageState> {
  const client = publicClient();
  const picked = await resolveInstance(requested);
  const address = picked.shown.address as Address;
  const fromBlock = picked.shown.fromBlock;
  const at = await readBlock(client);
  const c = { address, abi: openTallyAbi, blockNumber: at } as const;
  const [programmeName, escrow, paidCount, paidTotal, rule, siteCount, connectionCount, batchAt, block] = await readAfter(() => Promise.all([
    client.readContract({ ...c, functionName: "programmeName" }),
    client.readContract({ ...c, functionName: "escrowBalance" }),
    client.readContract({ ...c, functionName: "paidCount" }),
    client.readContract({ ...c, functionName: "paidTotal" }),
    client.readContract({ ...c, functionName: "rule" }),
    client.readContract({ ...c, functionName: "siteCount" }),
    client.readContract({ ...c, functionName: "connectionCount" }),
    client.readContract({ ...c, functionName: "batchSubmittedAt", args: [month] }),
    client.getBlock({ blockNumber: at }),
  ]), lagging);
  const n = Number(connectionCount);
  const summaryMonth = (batchAt as bigint) === 0n && month > 1 ? month - 1 : month;
  const sites = await readAfter(() => Promise.all(Array.from({ length: Number(siteCount) }, (_, i) => client.readContract({ ...c, functionName: "getSite", args: [i] }))), lagging);
  const connections = await readAfter(() => Promise.all(Array.from({ length: n }, (_, i) => client.readContract({ ...c, functionName: "getConnection", args: [i] }))), lagging);
  const summaries = await readAfter(() => Promise.all(Array.from({ length: n }, (_, i) => client.readContract({ ...c, functionName: "getSummary", args: [summaryMonth, i] }))), lagging);
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
  return { ...shaped, fresh: picked.fresh, pinned: picked.pinned, spares: picked.spares, lastReleased, network: chainCfg.label, networkShort: chainCfg.short, fromBlock: Number(fromBlock), publicRpc: process.env.NEXT_PUBLIC_RPC_URL ?? chainCfg.defaultRpc, logSpan: Number(process.env.NEXT_PUBLIC_LOG_SPAN ?? chainCfg.logSpan) };
}
