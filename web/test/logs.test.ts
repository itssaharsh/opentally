import { it, expect } from "vitest";
import { eventsChunked } from "../src/lib/logs";

it("splits a long block range into spans the RPC accepts and keeps every event", async () => {
  const calls: [bigint, bigint][] = [];
  const client = { getBlockNumber: async () => 125n };
  const out = await eventsChunked(client, async (f, t) => { calls.push([f, t]); return [Number(f)]; }, 0n, 50, 2);
  expect(calls).toEqual([[0n, 49n], [50n, 99n], [100n, 125n]]);
  expect(out).toEqual([0, 50, 100]);
});
it("reads once when the endpoint has no range limit, and nothing when the start is past the head", async () => {
  const client = { getBlockNumber: async () => 10n };
  let n = 0;
  await eventsChunked(client, async () => { n++; return []; }, 3n, 0);
  await eventsChunked(client, async () => { n++; return []; }, 11n, 50);
  expect(n).toBe(1);
});
it("retries a range that landed on a node behind the head it was planned against", async () => {
  const client = { getBlockNumber: async () => 10n };
  let n = 0;
  const out = await eventsChunked(client, async () => { if (++n === 1) throw new Error("block range extends beyond current head block: requested 10, head 9"); return ["ok"]; }, 0n, 50);
  expect(out).toEqual(["ok"]); expect(n).toBe(2);
});
