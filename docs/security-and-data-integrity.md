# Security and data integrity assessment

OpenTally releases per-connection mini-grid grants by a public rule. This document says what the system protects, who can do what, what the chain proves and what it cannot, how the web app keeps its keys, and what a real programme would change before handling real money. It describes the code in this repository as of the submission; every claim names the file or the test that shows it.

## 1. What is being protected

| Asset | Why it matters | Where it lives |
|---|---|---|
| The grant pool (escrow) | It is the money; it must reach only connections that meet the rule | `OpenTally` contract balance of the token |
| The monthly summaries | They decide who is paid | `submitSummaries` storage, one per connection per month |
| The record of who was paid | The public tally and any audit rest on it | `Released` and `ReleaseBatch` events, `paidCount`, `paidTotal` |
| Holds | A held connection must not be paid until the verifier lifts it | `Connection.held` |
| The demo keys | They sign as operator, verifier and gateways on the demo | Server environment variables only |

## 2. Parties and keys

| Key | Holder in a real programme | Can | Cannot |
|---|---|---|---|
| Funder | the funder's treasury | deposit into the escrow | release, hold, change the rule |
| Site gateway, one per site | the site's metering gateway | sign that site's summaries | sign for another site, change the rule, move money |
| Verifier | the independent verification agent | hold and lift a connection | release money, withdraw the escrow |
| Programme operator | the programme manager | register sites and connections, submit signed summaries | forge a gateway signature, pay a held connection, pay twice, release before the window closes |
| Anyone | no key | trigger the release after the window; re-add every total | choose who is paid |

The rule, the grant per connection, the verifier and the funder are set in the constructor and are immutable (`contracts/contracts/OpenTally.sol`, `immutable` fields and `rule`). Nobody can change the rule of a running programme; a new rule is a new programme instance through the factory.

## 3. Data integrity on the chain

- **Signatures bound to one programme and one chain.** Summaries are EIP-712 typed data with the domain `OpenTally / 1 / chainId / verifyingContract`. A summary signed for one programme cannot be replayed on another instance or another network. Recovery uses OpenZeppelin `ECDSA.tryRecover`, which rejects malleable signatures. Test: `AC-1 a summary signed by another site's gateway reverts the batch with BadSignature` (`contracts/test/OpenTally.ts`).
- **All or nothing.** One bad signature reverts the whole monthly batch, so a month is never half-recorded. The run shows this live: step 1 reports one summary refused for the wrong site key and resubmitted with the right one.
- **One summary per connection per month.** A second submission reverts with `AlreadySubmitted`. Test: `a second summary for the same connection and month reverts with AlreadySubmitted`.
- **The window is enforced, not trusted.** `release` reverts with `WindowOpen` until `batchSubmittedAt + windowSeconds`. Test: `AC-2`.
- **Paid once.** `release` skips paid connections and marks each paid before any transfer (checks, effects, then interactions); a second call pays nothing and emits `ReleaseBatch(month, 0, 0)`. Test: `AC-3 and AC-4`.
- **Holds win.** A held connection is skipped by `release` and listed by nobody as eligible. Tests: `AC-3`, `lift makes a held connection eligible again`, `holdMany`.
- **The escrow cannot overpay.** `release` reverts with `InsufficientEscrow` before any transfer if the pool is short.
- **Release needs no trusted caller.** Anyone can call `release` after the window; the rule decides who is paid. Test: `anyone can trigger the release once the window closes, and it pays only by the rule`.
- **The trace is committed.** Each summary carries `traceHash`, the keccak hash of the 30 daily readings in milli-kWh. The connection page recomputes the hash of the trace it shows and says whether it matches what the gateway signed (`web/src/lib/connection.ts`).
- **Totals are reproducible by anyone.** The re-sum drawer reads the `Released` events and the contract's counters straight from a public RPC endpoint in the visitor's browser and adds them up there (`web/src/components/Resum.tsx`). Test: `AC-10` (`web/e2e/resum.spec.ts`).

## 4. What the chain proves, and what it cannot

It proves that every summary was signed by its site's gateway key, that every payment followed the rule after the window and skipped every hold, that nobody was paid twice, and what the totals are.

It cannot prove that a meter reported the truth. A gateway key that signs false readings produces valid summaries. That is what the screen and the verifier are for: the screen flags traces that look wrong against their site (identical traces, flat traces, outliers), and the verifier holds them. On the demo it catches the three planted faults; that is an illustration on synthetic data, not an evaluation (`web/test/screen.test.ts`).

## 5. Threats and how the design answers them

| Threat | Effect | Answer in this build | Residual risk |
|---|---|---|---|
| A stolen gateway key | false summaries for one site | signatures are per site, so the damage is one site; the screen flags anomalous traces; the verifier holds | a careful forger who mimics normal load passes the screen; a real programme rotates gateway keys and samples sites |
| A dishonest operator registers a fake site with its own gateway | grants paid to a fake site | not prevented in this demo: the operator registers sites | a real programme makes site registration a funder-approved or multisig action |
| A dishonest operator submits a summary without the gateway | none | refused: `BadSignature` | none |
| A verifier holds everything | grants delayed | holds are public events, so the delay is visible | governance: a time limit on holds or a second verifier |
| A verifier is bribed to lift a fake connection | a fake grant paid | lifts are public events with the verifier's address | the same as today's paper process, but on the record |
| Someone calls `release` early or twice | none | `WindowOpen`; idempotent | none |
| Replay of a signed summary on another programme or chain | none | EIP-712 domain includes chain and contract | none |
| Gas exhaustion with very large programmes | `release` runs out of gas | a release of 47 connections used 0.94 to 0.99 million gas on the local chain | a real programme pages the release (`release(month, from, to)`), see the roadmap |
| An unusual token (fee on transfer) | short payments | the demo uses its own plain ERC-20 | a real programme uses a vetted stablecoin |

## 6. The web app

- **Keys stay on the server.** Every module that reads the mnemonic imports `server-only`, and no client component imports the key, wallet, pipeline or chain modules; a test enforces both (`web/test/security.test.ts`). After `next build`, `npm run secret-scan` derives the demo keys and the public Hardhat test keys and searches the client bundle for each of them and for both mnemonics; result at submission: 31 client files scanned, 0 found.
- **On a public network the demo refuses to start without its own mnemonic.** The public Hardhat test mnemonic is used only when the deployment is a local chain (`web/src/lib/keys.ts`).
- **Inputs.** A programme named in a request must be a contract the factory created, or the write routes answer 400 (`instanceFor` in `web/src/lib/chain.ts`). Hold requests validate the connection id and the action (`web/src/app/api/hold/route.ts`).
- **Abuse limits** (`web/src/lib/limiter.ts`, tested in `web/test/limiter.test.ts`): runs, 3 per address per 10 minutes and one at a time per programme; hold changes, 10 per address per minute; releases of lifted connections, 5 per address per 10 minutes; preparing a fresh programme, 2 per 10 minutes for the whole site. A run is refused with a plain message when the demo wallet is low on test ETH. The limits are in memory per server instance; on-chain checks (`AlreadySubmitted`, idempotent release) keep two instances from double-paying.
- **Headers** (`web/next.config.ts`): `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` and `frame-ancestors 'none'`, `Permissions-Policy` with camera, microphone, geolocation and payment off.
- **Dependencies.** `npm audit --omit=dev` reports 0 vulnerabilities in both `web/` and `contracts/` at submission.

## 7. Privacy

No personal data is stored. Connections are recorded as hashes of the meter serial, a customer reference and a location cell. Hashing a short identifier is not anonymisation: a meter serial can be guessed and hashed again. A real programme salts these hashes with a secret the programme holds, or keeps them off-chain and records only a commitment. The demo's sites, connections and readings are synthetic and fictional.

## 8. Demo arrangements and what replaces them

| On this demo | In a real programme |
|---|---|
| One server holds the operator, verifier, funder and gateway keys | each holder signs with its own key: treasury custody, gateway hardware, the verifier's signer |
| A 30-second sampling window | the programme's own window (the DARES terms describe sampling over weeks) |
| A test token with no value on a test network | a stablecoin on a production network chosen for fees and finality |
| Synthetic traces from a seeded generator | the meter platform's signed monthly export |
| The consumption threshold chosen by this team (2.0 kWh a month) | the programme's own value |

## 9. Evidence

Contract tests: 10 passing (`cd contracts && npx hardhat test`). Web unit tests: 22 passing (`cd web && npm test`). Browser tests on a production build: the release (`web/e2e/run.spec.ts`), two visitors with separate programmes (`web/e2e/visitors.spec.ts`), every state including a chain outage (`web/e2e/states.spec.ts`), a held clone lifted and paid (`web/e2e/hold.spec.ts`), and the re-sum (`web/e2e/resum.spec.ts`).
