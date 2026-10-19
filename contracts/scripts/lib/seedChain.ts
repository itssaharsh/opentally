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

export async function seedInstance(opts: {
  viem: any; publicClient: PublicClient; tally: any; token: any; roles: Roles; months: number[];
}) {
  const { viem, publicClient, tally, token, roles, months } = opts;
  const chainId = await publicClient.getChainId();
  const seed = buildSeed();
  const ownerTally = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: roles.owner } });
  for (let i = 0; i < SITES.length; i++) {
    const s = SITES[i];
    const h = await ownerTally.write.registerSite([`${s.name}, ${s.town}`, roles.payouts[i], roles.gateways[i].account!.address]);
    await publicClient.waitForTransactionReceipt({ hash: h });
  }
  const inputs = seed.map((c) => ({
    siteId: c.siteIndex, meterHash: hashString(c.meterSerial), customerHash: hashString(`customer:${c.code}`),
    gpsCell: hashString(c.gpsCell), commissionedAt: BigInt(c.commissionedAt),
  }));
  for (let i = 0; i < inputs.length; i += 25) {
    const h = await ownerTally.write.registerConnections([inputs.slice(i, i + 25)]);
    await publicClient.waitForTransactionReceipt({ hash: h });
  }
  const funderToken = await viem.getContractAt("TestUSD", token.address, { client: { wallet: roles.funder } });
  let h = await funderToken.write.approve([tally.address, DEPOSIT_TUSD]);
  await publicClient.waitForTransactionReceipt({ hash: h });
  const funderTally = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: roles.funder } });
  h = await funderTally.write.deposit([DEPOSIT_TUSD]);
  await publicClient.waitForTransactionReceipt({ hash: h });
  for (const month of months) {
    const items = [] as any[]; const sigs = [] as Hex[];
    for (const c of seed) {
      const sm = summaryOf(c.traces[month]);
      const item = { connectionId: c.id, month, activeDays: sm.activeDays, kwhMilli: sm.kwhMilli, traceHash: sm.traceHash };
      items.push(item);
      sigs.push(await signSummary(roles.gateways[c.siteIndex], tally.address, chainId, item));
    }
    h = await ownerTally.write.submitSummaries([month, items, sigs]);
    await publicClient.waitForTransactionReceipt({ hash: h });
  }
  return { seed, grant: GRANT_TUSD, deposit: DEPOSIT_TUSD, rule: RULE, programmeName: PROGRAMME_NAME };
}
