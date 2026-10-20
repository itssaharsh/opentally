// Which programme instance a visitor sees. Pure, so it is unit-tested; chain.ts feeds it the factory's instances.
export type InstanceInfo = { address: string; index: number; fromBlock: bigint; paidCount: number; demoMonthSubmitted: boolean; ready?: boolean };
export type Picked = { shown: InstanceInfo; fresh: boolean; pinned: boolean; spares: number; lastReleased: InstanceInfo | null };

// ready: the months before the demo month are on-chain, so a spare still being seeded is never handed out
export const isFresh = (i: InstanceInfo) => i.ready !== false && i.paidCount === 0 && !i.demoMonthSubmitted;

export function pickInstance(list: InstanceInfo[], requested?: string | null, busy: Set<string> = new Set()): Picked {
  if (!list.length) throw new Error("no programme instance has been created by the factory yet");
  const byNewest = [...list].sort((a, b) => b.index - a.index);
  const available = (i: InstanceInfo) => isFresh(i) && !busy.has(i.address.toLowerCase());
  const fresh = byNewest.filter(available);
  const lastReleased = byNewest.find((i) => i.paidCount > 0) ?? null;
  const req = requested?.toLowerCase();
  const pinnedTo = req ? list.find((i) => i.address.toLowerCase() === req) : undefined;
  const shown = pinnedTo ?? fresh[0] ?? byNewest[0];
  return { shown, fresh: available(shown), pinned: !!pinnedTo, spares: fresh.length, lastReleased };
}
