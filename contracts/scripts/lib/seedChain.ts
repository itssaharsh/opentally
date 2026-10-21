// Registers the demo world on a programme instance and submits months 1 to 3.
import type { Address, Hex, WalletClient, PublicClient } from "viem";
import { buildSeed, summaryOf, hashString, SUMMARY_TYPES, SITES, GRANT_TUSD, DEPOSIT_TUSD, RULE, PROGRAMME_NAME } from "./seedData.js";

export type Roles = {
  owner: WalletClient; verifier: WalletClient; funder: WalletClient;
  gateways: WalletClient[]; payouts: Address[];
};

export async function signSummary(gateway: WalletClient, tally: Address, chainId: number,
  s: { connectionId: number; month: number; activeDays: number; kwhMilli: number; traceHash: Hex }) {
  return gateway.signTypedData({
    account: gateway.account!,
    domain: { name: "OpenTally", version: "1", chainId, verifyingContract: tally },
    types: SUMMARY_TYPES, primaryType: "Summary", message: s,
  });
}

// Public RPCs are load-balanced; a write right after a receipt can be estimated on a node a block behind and fail.
// Nothing is sent then, so retry after a short wait (see web/src/lib/lag.ts). Local chains do not lag.
const LAG = /reverted|nonce too low|nonce has already been used|replacement transaction underpriced|NonceTooLow/i;
export async function retryLag<T>(fn: () => Promise<T>, lagging: boolean, tries = 6, waitMs = 2_000): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      const msg = e instanceof Error ? `${e.message} ${(e as { details?: string }).details ?? ""}` : String(e);
      if (!lagging || i >= tries || !LAG.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

export async function seedInstance(opts: {
  viem: any; publicClient: PublicClient; tally: any; token: any; roles: Roles; months: number[];
}) {
  const { viem, publicClient, tally, token, roles, months } = opts;
  const chainId = await publicClient.getChainId();
  const lagging = chainId !== 31337;
  // fixed gas limits on a public network: a node that has not yet seen the new instance would estimate a call to it
  // as a plain transfer, and the transaction would be mined and revert out of gas (web/src/lib/wallets.ts gasAt)
  const GAS = (g: bigint) => (lagging ? { gas: g } : {});
  const tx = async (f: () => Promise<Hex>) => { const h = await retryLag(f, lagging); await publicClient.waitForTransactionReceipt({ hash: h }); return h; };
  const seed = buildSeed();
  const ownerTally = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: roles.owner } });
  for (let i = 0; i < SITES.length; i++) {
    const s = SITES[i];
    await tx(() => ownerTally.write.registerSite([`${s.name}, ${s.town}`, roles.payouts[i], roles.gateways[i].account!.address], GAS(300_000n)));
  }
  const inputs = seed.map((c) => ({
    siteId: c.siteIndex, meterHash: hashString(c.meterSerial), customerHash: hashString(`customer:${c.code}`),
    gpsCell: hashString(c.gpsCell), commissionedAt: BigInt(c.commissionedAt),
  }));
  for (let i = 0; i < inputs.length; i += 25) {
    await tx(() => ownerTally.write.registerConnections([inputs.slice(i, i + 25)], GAS(4_000_000n)));
  }
  const funderToken = await viem.getContractAt("TestUSD", token.address, { client: { wallet: roles.funder } });
  await tx(() => funderToken.write.approve([tally.address, DEPOSIT_TUSD], GAS(120_000n)));
  const funderTally = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: roles.funder } });
  await tx(() => funderTally.write.deposit([DEPOSIT_TUSD], GAS(200_000n)));
  for (const month of months) {
    const items = [] as any[]; const sigs = [] as Hex[];
    for (const c of seed) {
      const sm = summaryOf(c.traces[month]);
      const item = { connectionId: c.id, month, activeDays: sm.activeDays, kwhMilli: sm.kwhMilli, traceHash: sm.traceHash };
      items.push(item);
      sigs.push(await signSummary(roles.gateways[c.siteIndex], tally.address, chainId, item));
    }
    await tx(() => ownerTally.write.submitSummaries([month, items, sigs], GAS(7_000_000n)));
  }
  return { seed, grant: GRANT_TUSD, deposit: DEPOSIT_TUSD, rule: RULE, programmeName: PROGRAMME_NAME };
}
