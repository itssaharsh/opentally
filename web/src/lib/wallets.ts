import "server-only";
import { createWalletClient, http, parseEther, formatEther, type Address } from "viem";
import { chainCfg, rpcUrl, publicClient } from "./chain";
import { roleAccount, ROLE } from "./keys";

export function wallet(index: number) {
  return createWalletClient({ account: roleAccount(index), chain: chainCfg.chain, transport: http(rpcUrl(), { timeout: 60_000 }) });
}

export type Funds = { ok: boolean; deployerEth: number; ownerEth: number; verifierEth: number; reason?: string };

/** Can the demo wallet pay for a run and a spare? On a local chain the answer is always yes. */
export async function funds(): Promise<Funds> {
  if (chainCfg.minGasEth === 0) return { ok: true, deployerEth: Infinity, ownerEth: Infinity, verifierEth: Infinity };
  const pc = publicClient();
  const [d, o, v] = await Promise.all([0, ROLE.owner, ROLE.verifier].map((i) => pc.getBalance({ address: roleAccount(i).address })));
  const eth = (x: bigint) => Number(formatEther(x));
  const total = eth(d) + eth(o) + eth(v);
  const ok = total >= chainCfg.minGasEth;
  return { ok, deployerEth: eth(d), ownerEth: eth(o), verifierEth: eth(v), reason: ok ? undefined : "Fresh runs are paused: the demo wallet is low on test ETH. The last release is shown." };
}

/** Top up the owner and verifier keys from the deployer when they run low. */
export async function topUp() {
  if (chainCfg.minGasEth === 0) return;
  const pc = publicClient();
  const deployer = wallet(0);
  for (const i of [ROLE.owner, ROLE.verifier]) {
    const addr = roleAccount(i).address as Address;
    const bal = await pc.getBalance({ address: addr });
    const floor = parseEther(String(chainCfg.minGasEth / 2));
    if (bal < floor) {
      const h = await deployer.sendTransaction({ to: addr, value: floor * 2n });
      await pc.waitForTransactionReceipt({ hash: h });
    }
  }
}
