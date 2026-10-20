// Public RPC endpoints are load-balanced: right after a receipt, the next call can land on a node a block behind,
// so a dependent write fails its gas estimate (an unregistered site, an unapproved token) or reuses a stale nonce.
// Nothing was sent when that happens, so the write is retried after a short wait. Local chains do not lag.
const LAG = /reverted|nonce too low|nonce has already been used|replacement transaction underpriced|NonceTooLow/i;

export async function retryLag<T>(fn: () => Promise<T>, lagging: boolean, tries = 6, waitMs = 2_000): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      const msg = e instanceof Error ? `${e.message} ${(e as { details?: string }).details ?? ""}` : String(e);
      if (!lagging || i >= tries || !LAG.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}
