import { sepolia, baseSepolia, hardhat } from "viem/chains";
import type { Chain } from "viem";

export type ChainInfo = { chain: Chain; label: string; short: string; explorer: string | null; defaultRpc: string; minGasEth: number };

export function chainInfo(chainId: number): ChainInfo {
  if (chainId === 11155111) return { chain: sepolia, label: "Sepolia testnet", short: "Sepolia", explorer: "https://sepolia.etherscan.io", defaultRpc: "https://ethereum-sepolia-rpc.publicnode.com", minGasEth: 0.005 };
  if (chainId === 84532) return { chain: baseSepolia, label: "Base Sepolia testnet", short: "Base Sepolia", explorer: "https://sepolia.basescan.org", defaultRpc: "https://sepolia.base.org", minGasEth: 0.001 };
  return { chain: { ...hardhat, id: chainId }, label: "Local chain", short: "Local", explorer: null, defaultRpc: "http://127.0.0.1:8545", minGasEth: 0 };
}
