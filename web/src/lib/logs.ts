// Event reads split into block ranges. Public RPC endpoints cap eth_getLogs ranges (sepolia.base.org at 200 blocks,
// publicnode at 50,000), and a programme can sit for days before a visitor runs it, so a single "from creation to
// latest" query is not safe. Used by the server and by the browser re-sum.
import type { PublicClient } from "viem";

export async function eventsChunked<T>(
  client: Pick<PublicClient, "getBlockNumber">,
  read: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  fromBlock: bigint, span: number, parallel = 5,
): Promise<T[]> {
  const head = await client.getBlockNumber();
  if (fromBlock > head) return [];
  if (!span) return read(fromBlock, head);
  const step = BigInt(span);
  const ranges: [bigint, bigint][] = [];
  for (let a = fromBlock; a <= head; a += step) ranges.push([a, a + step - 1n > head ? head : a + step - 1n]);
  const out: T[] = [];
  for (let i = 0; i < ranges.length; i += parallel) {
    const part = await Promise.all(ranges.slice(i, i + parallel).map(([f, t]) => read(f, t)));
    for (const p of part) out.push(...p);
  }
  return out;
}
