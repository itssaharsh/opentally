---
id: F-0001
type: failure
title: create-next-app 16.4 enables cacheComponents, which rejects route runtime and dynamic exports
status: active
scope: global-candidate
components: web, build
triggers: Route segment config "runtime" is not compatible with nextConfig.cacheComponents
evidence: web/next.config.ts#L1-17
verified_at: 2026-10-19@981cfb4
relates: 
supersedes: 
helpful: 0
harmful: 0
cite_hash: 3d84252cdd605d4b
created: 2026-10-19
source: unknown
---

Attempted: next build with route handlers exporting runtime = "nodejs" and dynamic = "force-dynamic".
Error signature: Route segment config "runtime" is not compatible with nextConfig.cacheComponents. Please remove it.
Root cause: the Next.js 16.4 scaffold writes cacheComponents: true (and partialPrefetching) into next.config.ts; under it, route segment config exports are refused at build. next dev did not surface it, only next build.
Fix: removed cacheComponents and partialPrefetching from next.config.ts (every route here reads live chain state per request). Evidence: E0021 build and browser test passed.
Lesson: When a Next.js 16.4 scaffold is used for live-data routes, check next.config.ts for cacheComponents before writing route segment config, because the build rejects them and dev does not.
Cheapest early check: run next build once right after the scaffold and the first route.