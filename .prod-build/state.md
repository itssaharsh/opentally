# Build state - opentally
Updated: 2026-10-19 16:30Z | mode: hackathon | channel: direct | phase: M2 (M1 done)

## Now
- Phase / current task: M2. Next: T07a (fresh programme per visitor), then T08 (S1 to spec), T09, T10, T11. T07 (Sepolia + Vercel) blocked on test ETH and the user's go-ahead.
- Last good commit: 64f711a (T06)            Last good deploy: none (local chain only)

## What worked (with evidence IDs)
- Contracts: 9 tests incl. wrong key reverts, window gate, batch release, idempotent, holdMany (E0019, E0022).
- Pipeline end to end on the local chain: 50 verified, 3 held, 47 released (E0015).
- S1 golden path in the browser on a production build: 47 of 50 paid, 1,050 tUSD, receipt (E0018, E0021).
- Backup take: ../hackathon-idea/ieee-climatechain-2026/takes/backup-local-20261019-1620-cut.webm (E0024).

## What failed (memory IDs) - do not retry without a new root cause
- F-0001: Next 16.4 scaffold's cacheComponents rejects route runtime/dynamic exports; removed it.
- L-0001: browser tests on next dev + Chromium + Hardhat were killed (exit 137) on this shared 8 GB machine; test the production build.

## Not tried yet / open questions
- Sepolia vs Base Sepolia: cost per visitor run (~12 txs to seed + 4 to run). Decide when the faucet is known.
- Every ledger cell links to /connection/[id], which 404s until T09.
- Deployer address (account 0 of contracts/.env DEMO_MNEMONIC): 0xC11b85FDDcbB2436Ca2b09b0bfd1d3Bf0105B181, balance 0 on Sepolia.

## Changes that need care (migrations applied, deploys, destructive ops)
- contracts/.env holds the demo mnemonic (git-ignored, mode 600). Never print it. Vercel needs it as DEMO_MNEMONIC.
- Local Hardhat node must be running for e2e: `cd contracts && ./node_modules/.bin/hardhat node`, then `npm run deploy:local`.

## Exact next step
- Add T07a to the plan; implement instance selection (?programme=, default to the newest unreleased instance), spare seeding after a release, and a low-balance pause.
