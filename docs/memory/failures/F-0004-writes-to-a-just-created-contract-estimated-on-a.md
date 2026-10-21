---
id: F-0004
type: failure
title: Writes to a just-created contract, estimated on a lagging public RPC node, revert out of gas
status: active
scope: global-candidate
components: web, contracts, chain
triggers: UnknownSite reverted registerConnections
evidence: web/src/lib/wallets.ts
verified_at: 2026-10-21@cec7980
relates: 
supersedes: 
helpful: 0
harmful: 0
cite_hash: 5e85944478e5099d
created: 2026-10-21
source: unknown
---

Spare programmes on Base Sepolia came out half-seeded (two sites, 25 connections) and the next step failed with UnknownSite. The first registerSite after the factory's create was mined and reverted out of gas (24,719 used): its gas limit had been estimated on a load-balanced RPC node that had not yet seen the new contract, so the call looked like a plain transfer. Retrying on "reverted" did not help because nothing reverted at estimate time. Fix: estimate gas at the block of our own latest write (readBlock, readAfter) with 30% margin, and fixed generous limits in the Hardhat seeding script. Related hardening in the same change: sends go to Base's sequencer (a lagging read node would accept a stale nonce and the sequencer would drop it silently), viem's nonceManager on server accounts, fees in fixed steps so a cross-instance nonce collision is refused instead of replacing, a 90 s receipt timeout.