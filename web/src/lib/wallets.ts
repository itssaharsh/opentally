import "server-only";
import { createWalletClient, http, parseEther, formatEther, type Abi, type Address } from "viem";
import { chainCfg, rpcUrl, publicClient, readBlock } from "./chain";
import { roleAccount, signerAccount, ROLE } from "./keys";
import { retryLag, readAfter } from "./lag";

// Every write goes through one place: a retry for lagging nodes, sends to the sequencer, and fees in fixed steps.
// Two server instances that pick the same nonce then send the same fee, so the second is refused as underpriced and
// retried with the next nonce, instead of replacing the first transaction in the mempool.
const STEP_FLOOR = 1n << 26n; // about 0.067 gwei
async function feeStep(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | {}> {
  if (chainCfg.minGasEth === 0) return {};
  const block = await publicClient().getBlock();
  const want = (block.baseFeePerGas ?? 0n) * 3n;
  let fee = STEP_FLOOR;
  while (fee < want) fee <<= 1n;
  return { maxFeePerGas: fee, maxPriorityFeePerGas: 1_000_000n };
}

// The gas limit is estimated against the state at our own latest write, not whatever block the answering node is on:
// a node that has not yet seen a contract created a moment ago estimates a call to it as a plain transfer, and the
// transaction is then mined and reverts out of gas.
async function gasAt(args: object, account: Address): Promise<{ gas: bigint } | {}> {
  if (chainCfg.minGasEth === 0 || "gas" in args) return {};
  const pc = publicClient();
  const at = await readBlock(pc);
  const a = args as { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint };
  const est = await readAfter(() => pc.estimateContractGas({ address: a.address, abi: a.abi, functionName: a.functionName, args: a.args, value: a.value, account, blockNumber: at }), true);
  return { gas: (est * 13n) / 10n + 20_000n };
}

function transport() {
  const read = http(rpcUrl(), { timeout: 60_000 });
  const sendUrl = process.env.SEND_RPC_URL ?? chainCfg.sendRpc;
  if (!sendUrl) return read;
  const send = http(sendUrl, { timeout: 30_000, retryCount: 0 });
  return ((opts: Parameters<typeof read>[0]) => {
    const r = read(opts); const s = send(opts);
    return { ...r, request: (async (args: { method: string }) => args.method === "eth_sendRawTransaction" ? s.request(args as never) : r.request(args as never)) as typeof r.request };
  }) as typeof read;
}

export function wallet(index: number) {
  const w = createWalletClient({ account: signerAccount(index), chain: chainCfg.chain, transport: transport() });
  const lagging = chainCfg.minGasEth > 0;
  const writeContract = w.writeContract.bind(w); const sendTransaction = w.sendTransaction.bind(w);
  return Object.assign(w, {
    writeContract: ((args: Parameters<typeof writeContract>[0]) => retryLag(async () => writeContract({ ...(await feeStep()), ...(await gasAt(args, w.account.address)), ...args } as typeof args), lagging)) as typeof writeContract,
    sendTransaction: ((args: Parameters<typeof sendTransaction>[0]) => retryLag(async () => sendTransaction({ ...(await feeStep()), ...args } as typeof args), lagging)) as typeof sendTransaction,
  });
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
