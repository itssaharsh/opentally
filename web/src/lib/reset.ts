import "server-only";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { sepolia, hardhat } from "viem/chains";
import { openTallyAbi, openTallyFactoryAbi, testUSDAbi } from "./abi";
import { publicClient, rpcUrl, deployment, invalidateInstance } from "./chain";
import { roleAccount, gatewayFor, ROLE } from "./keys";
import programme from "../data/programme.json";

type Conn = { id: number; code: string; siteIndex: number; meterSerial: string; gpsCell: string; commissionedAt: number; summaries: Record<string, { activeDays: number; kwhMilli: number; traceHash: Hex }> };
type Programme = { programmeName: string; sites: { code: string; name: string; town: string; count: number }[]; connections: Conn[] };
const data = programme as unknown as Programme;

const SUMMARY_TYPES = {
  Summary: [
    { name: "connectionId", type: "uint32" }, { name: "month", type: "uint32" },
    { name: "activeDays", type: "uint16" }, { name: "kwhMilli", type: "uint32" }, { name: "traceHash", type: "bytes32" },
  ],
} as const;

function chain() { return deployment.chainId === 11155111 ? sepolia : { ...hardhat, id: deployment.chainId }; }
function wallet(index: number) { return createWalletClient({ account: roleAccount(index), chain: chain(), transport: http(rpcUrl(), { timeout: 60_000 }) }); }
const keccakOf = async (s: string) => (await import("viem")).keccak256((await import("viem")).toHex(s));

/// Creates a fresh programme instance through the factory, registers the demo world, deposits the pool and submits
/// months 1 to 3. Costs test ETH only. Returns the new instance address.
export async function resetInstance(onStep?: (s: string) => void): Promise<{ instance: Address; txs: Hex[] }> {
  const pc = publicClient();
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
  await wait(await owner.writeContract({ address: factory, abi: openTallyFactoryAbi, functionName: "create", args: [token, verifierAddr, funder.account.address, 350_000_000n, rule, data.programmeName] }));
  const instance = (await pc.readContract({ address: factory, abi: openTallyFactoryAbi, functionName: "latest" })) as Address;
  const c = { address: instance, abi: openTallyAbi } as const;

  onStep?.("Registering 3 sites");
  for (let i = 0; i < data.sites.length; i++) {
    const s = data.sites[i];
    await wait(await owner.writeContract({ ...c, functionName: "registerSite", args: [`${s.name}, ${s.town}`, roleAccount(6 + i).address, gatewayFor(i).address] }));
  }
  onStep?.("Registering 50 connections");
  const inputs = [] as { siteId: number; meterHash: Hex; customerHash: Hex; gpsCell: Hex; commissionedAt: bigint }[];
  for (const cn of data.connections) inputs.push({ siteId: cn.siteIndex, meterHash: await keccakOf(cn.meterSerial), customerHash: await keccakOf(`customer:${cn.code}`), gpsCell: await keccakOf(cn.gpsCell), commissionedAt: BigInt(cn.commissionedAt) });
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
