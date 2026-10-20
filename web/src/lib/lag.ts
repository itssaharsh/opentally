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

// A read that must see a write: ask for the state at the write's block. A node that has not reached it yet answers
// with an error, and the read is retried; it never answers from the older state.
const BEHIND = /header not found|unknown block|block not found|could not be found|cannot query unfinalized|after last accepted block|requested block|is not available|missing trie node/i;
export async function readAfter<T>(fn: () => Promise<T>, lagging: boolean, tries = 8, waitMs = 1_500): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      const msg = e instanceof Error ? `${e.message} ${(e as { details?: string }).details ?? ""}` : String(e);
      if (!lagging || i >= tries || !BEHIND.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}
