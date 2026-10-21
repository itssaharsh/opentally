import { sepolia, baseSepolia, hardhat } from "viem/chains";
import type { Chain } from "viem";

export type ChainInfo = { chain: Chain; label: string; short: string; explorer: string | null; defaultRpc: string; minGasEth: number; logSpan: number; sendRpc?: string };

// sendRpc: where signed transactions go. Base's sequencer answers nonce errors itself, where a load-balanced read node
// a block behind would accept a stale nonce and the sequencer would then drop the transaction without a word.

// logSpan: the widest eth_getLogs range the default endpoint accepts (0 = no limit). Override with LOG_SPAN.

export function chainInfo(chainId: number): ChainInfo {
  if (chainId === 11155111) return { chain: sepolia, label: "Sepolia testnet", short: "Sepolia", explorer: "https://sepolia.etherscan.io", defaultRpc: "https://ethereum-sepolia-rpc.publicnode.com", minGasEth: 0.005, logSpan: 50_000 };
  if (chainId === 84532) return { chain: baseSepolia, label: "Base Sepolia testnet", short: "Base Sepolia", explorer: "https://sepolia.basescan.org", defaultRpc: "https://base-sepolia-rpc.publicnode.com", minGasEth: 0.001, logSpan: 50_000, sendRpc: "https://sepolia-sequencer.base.org" };
  return { chain: { ...hardhat, id: chainId }, label: "Local chain", short: "Local", explorer: null, defaultRpc: "http://127.0.0.1:8545", minGasEth: 0, logSpan: 0 };
}
