// In-memory limits for the public write endpoints of a demo deployment. One server instance is enough for a demo;
// a product would move this to a shared store.
const buckets = new Map<string, number[]>();
export function allow(key: string, limit: number, windowMs: number, now = Date.now()) {
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { buckets.set(key, arr); return false; }
  arr.push(now); buckets.set(key, arr); return true;
}
export function resetLimiter() { buckets.clear(); }

let runLock: { since: number; instance: string } | null = null;
export function acquireRun(instance: string, now = Date.now(), ttlMs = 180_000) {
  if (runLock && now - runLock.since < ttlMs && runLock.instance === instance) return false;
  runLock = { since: now, instance };
  return true;
}
export function releaseRun() { runLock = null; }
export function runLockedSince() { return runLock?.since ?? null; }
