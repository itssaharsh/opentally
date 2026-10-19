import "server-only";
import { createPublicClient, http, type Address, type Hex, type PublicClient } from "viem";
import { sepolia, hardhat } from "viem/chains";
import { openTallyAbi } from "./abi";
import deploymentJson from "../data/deployment.json";
import { shapeState, type TallyState, type ReleaseView } from "./state";

export type Deployment = typeof deploymentJson;
export const deployment: Deployment = deploymentJson;

export function rpcUrl() {
  return process.env.RPC_URL ?? (deployment.chainId === 11155111 ? "https://ethereum-sepolia-rpc.publicnode.com" : "http://127.0.0.1:8545");
}

let _client: PublicClient | null = null;
export function publicClient(): PublicClient {
  if (_client) return _client;
  const chain = deployment.chainId === 11155111 ? sepolia : { ...hardhat, id: deployment.chainId };
  _client = createPublicClient({ chain, transport: http(rpcUrl(), { batch: true, timeout: 20_000 }) });
  return _client;
}

export function instanceAddress(): Address {
  return (process.env.INSTANCE_ADDRESS ?? deployment.instance) as Address;
}

export const DEMO_MONTH = 4;

export async function readReleases(client: PublicClient, address: Address): Promise<ReleaseView[]> {
  const logs = await client.getContractEvents({ address, abi: openTallyAbi, eventName: "ReleaseBatch", fromBlock: BigInt(deployment.deployBlock), strict: true });
  const out: ReleaseView[] = [];
  for (const l of logs) {
    const receipt = await client.getTransactionReceipt({ hash: l.transactionHash as Hex }).catch(() => null);
    out.push({ month: Number(l.args.month), count: Number(l.args.count), totalTusd: Number(l.args.total) / 1e6, txHash: l.transactionHash as string, blockNumber: Number(l.blockNumber), gasUsed: receipt ? Number(receipt.gasUsed) : undefined });
  }
  return out;
}

export async function readState(month = DEMO_MONTH): Promise<TallyState> {
  const client = publicClient();
  const address = instanceAddress();
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
  const sites = await Promise.all(Array.from({ length: Number(siteCount) }, (_, i) => client.readContract({ ...c, functionName: "getSite", args: [i] })));
  const connections = await Promise.all(Array.from({ length: n }, (_, i) => client.readContract({ ...c, functionName: "getConnection", args: [i] })));
  const summaries = await Promise.all(Array.from({ length: n }, (_, i) => client.readContract({ ...c, functionName: "getSummary", args: [month, i] })));
  const releases = await readReleases(client, address);
  const [activeDaysMin, kwhMilliMin, windowSeconds] = rule as unknown as [number, number, number];
  return shapeState({
    instance: address, programmeName: programmeName as string, chainId: deployment.chainId, explorer: deployment.explorer,
    escrow: escrow as bigint, paidCount: Number(paidCount), paidTotal: paidTotal as bigint, month, batchSubmittedAt: batchAt as bigint,
    windowSeconds: Number(windowSeconds), nowTs: Number(block.timestamp),
    rule: { activeDaysMin: Number(activeDaysMin), kwhMilliMin: Number(kwhMilliMin), windowSeconds: Number(windowSeconds) },
    sites: sites.map((s) => ({ name: s.name, payout: s.payout, gateway: s.gateway, connectionCount: Number(s.connectionCount) })),
    connections: connections.map((x) => ({ siteId: Number(x.siteId), paid: x.paid, held: x.held, holdReason: Number(x.holdReason), paidMonth: Number(x.paidMonth), commissionedAt: x.commissionedAt })),
    summaries: summaries.map((s) => ({ exists: s.exists, activeDays: Number(s.activeDays), kwhMilli: Number(s.kwhMilli), traceHash: s.traceHash })),
    releases,
  });
}
