// In-memory limits for the public write endpoints of a demo deployment. One server instance is enough for a demo;
// a product would move this to a shared store.
import { store } from "./store";
const buckets = store.buckets;
export function allow(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (process.env.DEMO_LIMITS === "off") return true;
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { buckets.set(key, arr); return false; }
  arr.push(now); buckets.set(key, arr); return true;
}
export function resetLimiter() { buckets.clear(); runLocks.clear(); }

// One run at a time per programme instance (several programmes may run at once). In-process only; the chain
// itself refuses a second batch for the same month, so a run on another server instance cannot double-pay.
const runLocks = store.runLocks;
export function acquireRun(instance: string, now = Date.now(), ttlMs = 180_000) {
  const key = instance.toLowerCase();
  const since = runLocks.get(key);
  if (since !== undefined && now - since < ttlMs) return false;
  runLocks.set(key, now);
  return true;
}
export function releaseRun(instance?: string) {
  if (instance) runLocks.delete(instance.toLowerCase()); else runLocks.clear();
}
export function busyInstances(now = Date.now(), ttlMs = 180_000): Set<string> {
  return new Set([...runLocks.entries()].filter(([, t]) => now - t < ttlMs).map(([k]) => k));
}
