import "server-only";
import { mnemonicToAccount, type HDAccount } from "viem/accounts";
import { nonceManager } from "viem";
import deployment from "../data/deployment.json";
import { chainInfo } from "./chains";

// The public Hardhat test mnemonic: only ever used against a local chain.
const HARDHAT_TEST_MNEMONIC = "test test test test test test test test test test test junk";

// Account order (shared with contracts/scripts/deploy-and-seed.ts): 0 deployer and funder, 1 programme owner,
// 2 verifier, 3 to 5 site gateways, 6 to 8 site payouts. Demo arrangement: the server holds these keys; see /rule.
export function demoMnemonic() {
  const local = chainInfo(deployment.chainId).minGasEth === 0;
  const m = process.env.DEMO_MNEMONIC?.trim().replace(/^"|"$/g, "");
  if (m) return m;
  if (local) return HARDHAT_TEST_MNEMONIC;
  throw new Error("Demo signer not configured: set DEMO_MNEMONIC");
}
export function roleAccount(index: number): HDAccount {
  return mnemonicToAccount(demoMnemonic(), { addressIndex: index });
}
/** The same account for sending: nonces handed out in order within this server process, never reused. */
const signers = new Map<number, HDAccount>();
export function signerAccount(index: number): HDAccount {
  let a = signers.get(index);
  if (!a) { a = mnemonicToAccount(demoMnemonic(), { addressIndex: index, nonceManager }); signers.set(index, a); }
  return a;
}
export const ROLE = { owner: 1, verifier: 2, gatewayA: 3, gatewayB: 4, gatewayC: 5 } as const;
export function gatewayFor(siteIndex: number) { return roleAccount(ROLE.gatewayA + siteIndex); }
