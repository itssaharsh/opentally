---
id: ADR-0001
type: decision
title: One programme contract plus a factory, no database
status: active
scope: project
components: contracts, web
triggers: 
evidence: contracts/contracts/OpenTallyFactory.sol#L1-45, web/src/lib/chain.ts
verified_at: 2026-10-19@981cfb4
relates: 
supersedes: 
helpful: 0
harmful: 0
cite_hash: b22358803ca6439e
created: 2026-10-19
source: unknown
---

Context: the ledger is the record judges score, and the demo needs a reset.
Decision: OpenTally holds all programme state; OpenTallyFactory creates instances; the app follows the factory's latest Created event; a reset is a fresh instance.
Alternatives rejected: a database beside the chain (two sources of truth); redeploying per reset (new addresses in env each time).
Consequences: reads cost RPC calls; totals come from events.
Revisit when: more than one programme must be shown at once.