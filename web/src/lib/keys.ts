import "server-only";
import { mnemonicToAccount, type HDAccount } from "viem/accounts";

const HARDHAT_TEST_MNEMONIC = "test test test test test test test test test test test junk";

// Account order (shared with contracts/scripts/deploy-and-seed.ts): 0 deployer and funder, 1 programme owner,
// 2 verifier, 3 to 5 site gateways. Demo arrangement: the server holds these keys; see /about and the security document.
export function demoMnemonic() {
  const m = process.env.DEMO_MNEMONIC;
  if (m && m.trim()) return m.trim().replace(/^"|"$/g, "");
  const rpc = process.env.RPC_URL ?? "";
  if (!rpc || rpc.includes("127.0.0.1") || rpc.includes("localhost")) return HARDHAT_TEST_MNEMONIC;
  throw new Error("Demo signer not configured: set DEMO_MNEMONIC");
}
export function roleAccount(index: number): HDAccount {
  return mnemonicToAccount(demoMnemonic(), { addressIndex: index });
}
export const ROLE = { owner: 1, verifier: 2, gatewayA: 3, gatewayB: 4, gatewayC: 5 } as const;
export function gatewayFor(siteIndex: number) { return roleAccount(ROLE.gatewayA + siteIndex); }
