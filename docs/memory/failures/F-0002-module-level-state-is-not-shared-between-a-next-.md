---
id: F-0002
type: failure
title: Module-level state is not shared between a Next.js page and a route handler
status: active
scope: global-candidate
components: web
triggers: second visitor saw the same instance; lock set in /api/run not seen by the page
evidence: web/src/lib/store.ts#L1-12
verified_at: 2026-10-21@cec7980
relates: 
supersedes: 
helpful: 0
harmful: 0
cite_hash: 0a7191737805462d
created: 2026-10-19
source: unknown
---

Attempted: a run lock and an instance-list cache as module-level variables in lib/limiter.ts and lib/chain.ts, set by /api/run and read by the page.
Error signature: the page kept showing the programme a run had just taken (e2e visitors.spec failed three times).
Root cause: Next.js 16 bundles each route and page separately, so a module imported by both can exist twice in one process; the page never saw the route's lock or cache invalidation.
Fix: one process-wide store on globalThis (lib/store.ts) holding locks, rate buckets, the instance cache and the seeding flag. Evidence: E0033.
Lesson: When state must be shared between Next.js routes and pages in one process, keep it on globalThis, because module scope is per bundle.
Cheapest early check: an e2e test where one route writes and a page reads.