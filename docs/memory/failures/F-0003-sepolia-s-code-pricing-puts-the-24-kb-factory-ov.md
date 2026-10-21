---
id: F-0003
type: failure
title: Sepolia's code pricing puts the 24 KB factory over the per-transaction gas cap
status: active
scope: global-candidate
components: contracts, deploy
triggers: out of gas: gas required exceeds
evidence: contracts/scripts/deploy-and-seed.ts
verified_at: 2026-10-21@cec7980
relates: 
supersedes: 
helpful: 0
harmful: 0
cite_hash: 158247d5f02d1bb7
created: 2026-10-21
source: unknown
---

Deploying OpenTallyFactory (24.1 KB runtime) to Ethereum Sepolia fails at estimation with "out of gas: gas required exceeds <balance/1 gwei>". Direct eth_estimateGas returns 37.8M gas, above the 16.78M per-transaction cap, because Sepolia's current pricing charges far more per byte of deployed code. The same bytecode estimates at 5.3M on Base Sepolia. Fix: deploy to Base Sepolia. Check a large deploy with eth_estimateGas on the target network before funding it.