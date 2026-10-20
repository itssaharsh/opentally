import { it, expect } from "vitest";
import { retryLag } from "../src/lib/lag";

it("retries a write that failed on a lagging node, then succeeds", async () => {
  let n = 0;
  const r = await retryLag(async () => { if (++n < 3) throw new Error("The contract function \"approve\" reverted."); return "ok"; }, true, 6, 1);
  expect(r).toBe("ok"); expect(n).toBe(3);
});
it("does not retry on a local chain or on an unrelated error", async () => {
  let n = 0;
  await expect(retryLag(async () => { n++; throw new Error("execution reverted"); }, false, 6, 1)).rejects.toThrow();
  await expect(retryLag(async () => { n++; throw new Error("insufficient funds"); }, true, 6, 1)).rejects.toThrow();
  expect(n).toBe(2);
});
