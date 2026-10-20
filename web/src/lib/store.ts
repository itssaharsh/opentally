// Process-wide state shared by every route and page bundle. Next.js may give each route its own copy of a module,
// so module-level variables are not shared between a route handler and a page; globalThis is.
type Store = {
  buckets: Map<string, number[]>;
  runLocks: Map<string, number>;
  instanceList: { at: number; list: unknown[] } | null;
  seeding: Promise<unknown> | null;
  createdScan?: { to: bigint; logs: unknown[] };
  lastWrite?: bigint; // the newest block this server has seen one of its own transactions land in
};
const g = globalThis as unknown as { __opentally?: Store };
export const store: Store = g.__opentally ?? (g.__opentally = { buckets: new Map(), runLocks: new Map(), instanceList: null, seeding: null });
