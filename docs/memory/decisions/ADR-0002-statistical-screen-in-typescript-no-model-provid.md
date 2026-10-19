---
id: ADR-0002
type: decision
title: Statistical screen in TypeScript, no model provider
status: active
scope: project
components: web
triggers: 
evidence: web/src/lib/screen.ts, web/test/screen.test.ts
verified_at: 2026-10-19@981cfb4
relates: 
supersedes: 
helpful: 0
harmful: 0
cite_hash: d4ebab5a1946f78f
created: 2026-10-19
source: unknown
---

Context: the card's AI role is a screen that can only hold; no paid model route is needed on the release path.
Decision: robust z-scores per site plus deterministic clone and flat checks.
Alternatives rejected: an LLM call per trace (no gain on numeric traces, a paid route, nondeterminism).
Consequences: the README says the model step is small and statistical.
Revisit when: real meter data shows fault shapes these checks miss.