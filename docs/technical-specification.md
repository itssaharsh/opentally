# Technical specification

## Components

| Component | Path | Tech |
|---|---|---|
| Programme contract | `contracts/contracts/OpenTally.sol` | Solidity 0.8.28, OpenZeppelin 5.6 (SafeERC20, EIP712, ECDSA) |
| Factory | `contracts/contracts/OpenTallyFactory.sol` | Solidity |
| Test token | `contracts/contracts/TestUSD.sol` | OpenZeppelin ERC-20, 6 decimals, no value |
| Seed world and deploy | `contracts/scripts/` | Hardhat 3, viem |
| Web app | `web/` | Next.js 16 App Router, React 19, Tailwind 4, viem 2 |
| Tests | `contracts/test/`, `web/test/`, `web/e2e/` | node:test, Vitest 3, Playwright 1.64 |

## Contract interface

**Constructor:** `token, owner, verifier, funder, grantPerConnection, rule {activeDaysMin, kwhMilliMin, windowSeconds}, programmeName`. All are immutable.

| Function | Who | Effect |
|---|---|---|
| `registerSite(name, payout, gateway)` | owner | adds a site with its payout address and its gateway's signing key |
| `registerConnections(ConnectionInput[])` | owner | adds connections: site, meter hash, customer hash, location cell hash, commissioning time |
| `deposit(amount)` | funder or owner | moves tokens into the escrow |
| `submitSummaries(month, Summary[], signatures[])` | owner | stores one month's summaries; each must be signed by its connection's site gateway (EIP-712); one bad signature reverts the batch; starts the sampling window |
| `hold(id, reason)`, `holdMany(ids, reasons)`, `lift(id)` | verifier | holds or releases a hold on a connection |
| `release(month)` | anyone | after the window: pays the grant for every connection that meets the rule, is not held and is not yet paid; one transfer per site |
| `eligible(month)`, `meetsRule(month, id)`, `windowClosesAt(month)` | view | what a release would pay now |
| `getSite`, `getConnection`, `getSummary`, `escrowBalance`, `paidCount`, `paidTotal`, `releasedCount(month)` | view | state for the app and for anyone |

**EIP-712 type:** `Summary(uint32 connectionId, uint32 month, uint16 activeDays, uint32 kwhMilli, bytes32 traceHash)`, domain `name "OpenTally", version "1", chainId, verifyingContract`.

**Rule:** a connection is eligible for month m when its month-m summary exists, `activeDays >= activeDaysMin` and `kwhMilli >= kwhMilliMin`, it is not held and not paid. On the demo: 30 days, 2,000 milli-kWh (2.0 kWh), a 30-second window; the grant is 350 tUSD.

**Events:** `SiteRegistered`, `ConnectionRegistered`, `Deposited`, `SummariesSubmitted(month, count, submittedAt, windowClosesAt)`, `Held(id, reason, by)`, `Lifted(id, by)`, `Released(id, month, siteId, amount)`, `ReleaseBatch(month, count, total)`.

**Errors:** `NotOwner`, `NotVerifier`, `NotFunder`, `UnknownSite`, `UnknownConnection`, `LengthMismatch`, `BadSignature(id)`, `AlreadySubmitted(id, month)`, `NothingSubmitted(month)`, `WindowOpen(secondsLeft)`, `InsufficientEscrow(needed, available)`.

**Factory:** `create(...)` (operator only) deploys a programme and records it; `latest()`, `instanceCount()`, `instanceAt(i)`, event `Created(instance, index, programmeName)`.

## The run (month 4)

`POST /api/run?programme=<address>` streams server-sent events, one per step:

1. **Verifying 50 site-signed summaries.** Signs month 4's summaries with each site's gateway key. First simulates a batch with one summary signed by the wrong site's key, which the contract refuses with `BadSignature`, and reports it; then submits the correct batch.
2. **Screening traces against each site.** Runs the screen on month 4's traces and holds every flag in one `holdMany` from the verifier key.
3. **Applying the rule.** Reads `eligible(4)`.
4. **Checking the sampling window.** Waits until `windowClosesAt(4)` has passed.
5. **Sending the release.** Calls `release(4)` and reports the count, the amount, the block and the gas.

## The screen

`web/src/lib/screen.ts`. Per site and month: identical day-by-day traces are flagged as clones in pairs; traces with zero use on 27 or more of 30 days are flagged flat; the remaining traces are flagged as outliers when their monthly total sits more than 3.5 robust z-scores (median and MAD) from the site's. It flags exactly the three planted faults in the demo's month 4 and nothing in month 3 (`web/test/screen.test.ts`). No model provider is involved.

## Web routes

| Route | Purpose |
|---|---|
| `/` | the tally: figures, the connection ledger, the rule, the run, the receipt, the re-sum |
| `/connection/[id]?programme=` | one connection: its trace against the site, its summary, the hold reason, lift and keep |
| `/rule` | the rule, its parameters and sources, who holds which key, the contract addresses |
| `/about` | what it is, what can be checked, the limits |
| `GET /api/state` | the tally's state, read from the chain |
| `POST /api/run` | the five-step run, streamed |
| `POST /api/hold` | lift, keep or hold with the verifier key |
| `POST /api/release` | release connections made eligible by a lifted hold |
| `GET /api/resum` | release records and counters (the browser reads the chain directly first) |
| `POST /api/reset` | prepare a fresh programme instance |

Each visitor opens the newest programme instance that has not been run; a run keeps its programme in the address (`?programme=`); after a release, a spare is prepared in the background. `?state=first-run|running|released|partial|error` shows a labelled preview of each state; `?record=1` hides the judge card; `Alt+Shift+R` prepares a fresh programme.

## Deployment

`contracts/scripts/deploy-and-seed.ts` deploys the token and the factory, creates `SPARES` programme instances (default 2), seeds each with 3 sites, 50 connections, a 17,500 tUSD deposit and months 1 to 3, and writes `web/src/data/deployment.json`. Account order from one mnemonic: 0 deployer and funder, 1 programme owner, 2 verifier, 3 to 5 site gateways, 6 to 8 site payouts. The web app needs `DEMO_MNEMONIC` and, optionally, `RPC_URL` and `NEXT_PUBLIC_RPC_URL`.

## Tests

| Suite | Command | Covers |
|---|---|---|
| Contracts | `cd contracts && npx hardhat test` | wrong key, window, batch release, idempotence, duplicates, holds, open release, factory, seed |
| Web unit | `cd web && npm test` | state shaping, the screen, limits, re-sum, instance choice, secret placement |
| Browser | `cd web && npx playwright test` (needs a local Hardhat node and `npm run deploy:local`) | the release, two visitors, every state, a lifted hold paid, the re-sum |
