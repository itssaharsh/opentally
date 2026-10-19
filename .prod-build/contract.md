# Implementation contract - opentally
mode: hackathon | channel: direct | created: 2026-10-19
Upstream read: hackathon-idea/ieee-climatechain-2026/ideas.json (idea OpenTally) and idea-package.md; hackathon-idea/ieee-climatechain-2026/ui/UI-SPEC.md (Sprint scope) with brand/ and a Claude Design mockup (three artboards). The package folder stays beside this repository and is git-ignored.

## 1. Intent
- User and moment of use: the grants administrator or programme manager at a results-based financing facility for mini-grids, on the day a developer's monthly claim of new connections arrives; second user, the developer's finance lead checking when money moves.
- What they can do: see every connection's state against the programme's own rule, run the month's release, see the verifier's holds with their reasons, open the on-chain receipt, and re-add the paid count and amount from the records.
- What changes after they use it (before -> after): before, a verifier, a grants administrator and a finance unit reconcile four private tallies by hand and the verifier's recommendation is not binding; after, the grant for each connection releases once a stated rule is met and the sampling window has closed without a hold, in one transaction on a public ledger, and anyone can re-sum the total from the same records.

## 2. Scope
MUST (core product, main workflow, judged/required):
- An escrow and connection registry contract on Sepolia with: funder deposit of a test token; site registration with a gateway key and a payout address; connection registration; monthly summaries signed by the site gateway (EIP-712) and verified on-chain; a release rule (active days, consumption threshold, sampling window) evaluated on-chain; a verifier hold and lift; a release that pays each eligible, unheld connection's grant to its site in one transaction; events for every state change.
- A statistical screen that ranks each connection's monthly trace against its site cohort and flags clones, flat traces and outliers; it can only hold, through the verifier key.
- The tally screen S1: two figures (escrow balance, paid count), the 50-cell ledger by site, the rule strip with the chosen parameter marked, one button that runs the month's release with five named streamed steps, the receipt row with the Sepolia hash, the how-to-judge card, the synthetic-data caption.
- S2 connection view with the trace against the cohort, the hold reason, Lift hold and Keep hold.
- S3 rule and keys page; S4 about page with the copy block; the re-sum drawer with JSON and CSV downloads.
- A seed script that deploys a fresh programme instance (3 fictional sites, 50 synthetic connections, 3 planted faults, months 1 to 3 submitted) and a reset path.
- The ten deliverables: live prototype on Sepolia, repository with README, ARCHITECTURE.md with a diagram and a technical specification, a 3-minute video, security and data integrity assessment, 2-page problem statement, climate impact assessment with projections, adoption strategy, scalability roadmap, user testing results.
SHOULD (materially improves the main workflow):
- The wrong-key summary rejection shown inside the run (step 1 reports one summary rejected and re-signed).
- `?state=` harness for first-run, running, released, partial and error; `?record=1` and `?judge=0` flags; Alt+Shift+R reset.
- Contract source verified on the explorer (Sourcify or Etherscan).
COULD (later; not in this build):
- Slash (claw back a paid grant) by the verifier; the cross-programme connection uniqueness registry; replay of a recorded run (Alt+Shift+P) once a run is recorded; a table view behind the ledger for hundreds of connections.
WON'T now (hypothetical-future infrastructure, explicitly deferred):
- Real meter integration, live Odyssey data, fiat payout, wallet connect for judges, a verifier mobile app, paper receipt OCR, multi-programme tenancy.

## 3. Core journeys (smallest set that constitutes the product)
J1 Release: the administrator opens S1 (month 3 complete, 0 of 50 paid) -> presses "Run month 4 release" -> five steps stream (summaries verified, screen holds 3, rule finds 47 eligible, window closes, release sent) -> the release confirms on Sepolia -> 47 cells light, the balance counts down, the receipt row shows the hash and link.
J2 Hold: the verifier opens a held cell -> S2 shows the trace against the cohort and the hold reason -> presses Lift hold or Keep hold -> the ledger records it and S1 shows the new state.
J3 Re-sum: anyone presses Re-sum -> the drawer rebuilds the paid count and the amount from the release records -> "Matches the chain" or the differing rows -> Download JSON or CSV.

## 4. Surfaces (only the necessary ones)
- S1 `/` tally (first screen); S2 `/connection/[id]`; S3 `/rule`; S4 `/about`; D1 re-sum drawer on S1.
- API: `GET /api/state` (chain read: figures, sites, connections, holds, releases); `POST /api/run` (the pipeline as a server-sent event stream); `POST /api/hold` (lift or keep through the verifier key; demo only); `GET /api/resum` (records and totals); `POST /api/reset` (deploy and seed a fresh instance through the factory; demo only).
- Contracts: `OpenTally` (one programme instance), `OpenTallyFactory` (creates instances; the app reads `latest()`), `TestUSD` (6-decimal test token).

## 5. States per journey
| Journey | initial | loading | success | error | empty | partial | retry | disabled | permission-denied | offline/degraded |
|---|---|---|---|---|---|---|---|---|---|---|
| J1 Release | month 3 complete, all cells eligible, button active | button locked, "Releasing, step n of 5", step list streams, site groups shimmer | 47 cells lit, balance 1,050, receipt row with hash, button "Released 47, held 3" then disabled with "Demo window ends at month 4" | tx reverted: cells stay eligible, step row in danger with the reason, button "Retry release" | month 0: "No claims yet for this window" (via ?state=first-run) | chain unreachable: last synced state dimmed with the timestamp line | "Retry release" re-runs from the failed step | window open: click shows "The sampling window closes in n days" | n/a: no accounts; the programme key is the server's | partial state as above; the explorer link degrades alone |
| J2 Hold | S2 with trace and reason | chart skeleton | hold lifted: S1 cell eligible; or kept: unchanged with a note | "Couldn't reach the chain; the last known state is shown" | not held: "In band; released in month n", no actions | n/a | the action button re-enables with the reason | n/a | n/a (demo verifier key on the server) | as error |
| J3 Re-sum | drawer with three computing rows | rows count up from the records | "Matches the chain" with a check | "Couldn't read the release records" with Retry | no releases yet: "Nothing released yet in this window" | mismatch: the differing rows in a table | Retry | n/a | n/a | computed from the last fetched records with the timestamp |

## 6. Data
| Entity | Key fields | Relationships | Owner | Persistence | Source of truth | PII/retention |
|---|---|---|---|---|---|---|
| Programme (OpenTally instance) | address, token, grantPerConnection, rule params (activeDaysMin, kwhMilliMin, windowSeconds), verifier, programme signer | has Sites, Connections, Months | funder deploys via the factory | chain | chain | none |
| Site | id, name, payout address, gateway key | has Connections | programme owner | chain | chain | none (fictional names) |
| Connection | id, siteId, meterHash, customerHash, gpsCell, commissionedAt, paid, held, holdReason | belongs to Site | programme owner | chain | chain | hashes only; no personal data |
| Summary | connectionId, month, activeDays, kwhMilli, traceHash, signature | per Connection per Month | site gateway signs; anyone submits | chain (fields) | chain | none |
| Trace | 30 daily kWh values per connection per month | feeds Summary.traceHash and the screen | seed | `seed/programme.json` in the repo | the seed file (synthetic, labelled) | none |
| Release record | month, connectionId, amount, tx hash, block | per Connection | contract events | chain | chain events | none |
| Rule text | the quoted sentence, parameters, source, the chosen flag | shown on S1 and S3 | repo | `web/src/data/rule.json` | the DARES terms, cited | none |

## 7. Interfaces
| Interface | Purpose | Contract file | Failure mode | Fallback |
|---|---|---|---|---|
| Sepolia JSON-RPC (public endpoint, env-configurable) | reads and the server-side writes | `web/src/lib/chain.ts` | rate limit, timeout, outage | reads: last synced state with the timestamp (partial); writes: the step fails with the RPC message and Retry |
| `OpenTally` contract ABI | all programme state and actions | `contracts/artifacts` -> `web/src/lib/abi.ts` (generated, committed) | revert with a named error | the step row shows the error name in plain words |
| Server-side signer (programme key, verifier key, site gateway keys) | runs the release, sets holds, signs demo summaries | env vars on Vercel, never in the client bundle | missing key | `/api/run` returns 503 with "Demo signer not configured" |
| Explorer links (Sepolia Etherscan) | receipt and contract links | plain links | explorer down | the hash is still shown with Copy |
| Fonts (Google Fonts via next/font) | Source Serif 4, Public Sans, Sometype Mono | `web/src/app/layout.tsx` | fetch fails at build | system fallbacks named in the font stacks |
| AI calls | none in the product path (the screen is statistical, no LLM) | `web/src/lib/screen.ts` | n/a | n/a |

## 8. Constraints
Security / privacy: no personal data; hashes only. Keys live in Vercel env (programme signer, verifier, three site gateways) for the demo and are stated as a demo arrangement in /about and the security document. Abuse limits on the public write endpoints: `/api/run` one run per programme instance per 2 minutes and a server-side lock; `/api/hold` 10 per minute per IP; `/api/reset` 1 per 10 minutes, and each costs Sepolia test ETH only. No secret in client code; `pb.py` evidence never prints keys.
Budget: Sepolia test ETH from a faucet for the deployer (about 0.2 ETH covers deploy, seed and twenty runs: assumption, checked at first deploy); Vercel hobby; no paid model route.
Latency: the run streams; the release tx confirms in 12 to 30 s on Sepolia; the demo window is 30 s (the terms' 14 days, shown as such on the strip).
Platform / deploy target: Next.js 16 App Router on Vercel (Node runtime, Fluid Compute; the run route may take up to 120 s, under the 300 s default); contracts with Hardhat 3 and Solidity 0.8.28; viem 2 for reads and writes.
Deadline: window closes 2026-10-25T14:00:00Z (provisional; organiser page says 23:59 UTC); freeze from 2026-10-24T14:00:00Z.
Judging criteria (organiser page, read 2026-10-19, verbatim): "Climate Impact & Environmental Benefit (30%)", "Technical Innovation & Blockchain Implementation (30%)", "Feasibility & Implementation Quality (10%)", "Data Security & Transparency (10%)", "User Experience & Design (10%)", "Scalability & Sustainability (10%)". The same page shows a second table: "70% Technical Innovation & Blockchain Implementation", "20% Climate Impact & Environmental Benefit", "10% Scalability & Real-World Implementation Potential". No sponsor rules; no sponsors.
Deliverables (same page): "Working prototype or proof-of-concept (deployed on test net acceptable)"; "Source code repository (GitHub/GitLab) with clear documentation"; "Architecture diagram and technical specification"; "3-minute video demonstration"; "Security and data integrity assessment document"; "Problem statement and solution overview (max 2 pages)"; "Climate impact assessment and carbon reduction projections"; "Implementation and adoption strategy"; "Scalability and sustainability roadmap"; "User testing results (if applicable)".
Performance budgets: S1 LCP under 2.5 s on Vercel; the release payoff stays under 1.5 s of motion; first screen passes foldcheck at 1440x900 and 390x844.

## 9. Acceptance criteria
AC-1: WHEN a batch of summaries is submitted with one signature from a key that is not that connection's site gateway THE SYSTEM SHALL revert the whole batch with `BadSignature(connectionId)`. Verify: contracts test `summary.wrong-key` (RED first). Priority: must
AC-2: WHEN `release(month)` is called before `batchSubmittedAt[month] + windowSeconds` THE SYSTEM SHALL revert with `WindowOpen(secondsLeft)`. Verify: contracts test `release.window` (RED first). Priority: must
AC-3: WHEN `release(month)` runs after the window with 50 summaries, 3 holds and 47 meeting the rule THE SYSTEM SHALL transfer 47 grants to the sites' payout addresses in one transaction, mark them paid, emit 47 `Released` events and one `ReleaseBatch`, and leave the held ones unpaid. Verify: contracts test `release.batch`. Priority: must
AC-4: WHEN `release(month)` is called a second time for the same month THE SYSTEM SHALL pay nothing and emit `ReleaseBatch(month, 0, 0)`. Verify: contracts test `release.idempotent`. Priority: must
AC-5: WHEN a connection's trace is identical to another connection's trace in the same site and month THE SYSTEM SHALL have the screen flag both as `clone` naming the pair. Verify: `web` unit test `screen.clone` (RED first). Priority: must
AC-6: WHEN a connection reports zero consumption on 27 or more of 30 days THE SYSTEM SHALL have the screen flag it as `flat`. Verify: `web` unit test `screen.flat`. Priority: must
AC-7: WHEN the page opens with no input THE SYSTEM SHALL show, inside the first screen at 1440x900 and 390x844, the escrow balance, the paid count ("0 of 50 paid"), the button "Run month 4 release" and at least the first two site groups of the ledger. Verify: foldcheck with `--action "text=Run month 4 release" --result "text=of 50 paid" --promise tally`. Priority: must
AC-8: WHEN "Run month 4 release" is pressed THE SYSTEM SHALL stream five named steps from the real pipeline, and on confirmation light 47 cells in site order, count the balance down and show the receipt row with the transaction hash linked to the explorer. Verify: Playwright e2e `run.spec` on the local chain; observe: the same on the deployed URL. Priority: must
AC-9: IF the release transaction reverts THEN THE SYSTEM SHALL keep every cell in its prior state, show the revert reason in the failed step row and offer "Retry release". Verify: Playwright e2e with `?state=error`, and unit test on the step reducer. Priority: must
AC-10: WHEN Re-sum is pressed after a release THE SYSTEM SHALL rebuild the paid count and the amount from the `Released` events and show "Matches the chain" when they equal the contract's counters. Verify: `web` unit test `resum.matches` and e2e. Priority: must
AC-11: WHEN a held connection is opened THE SYSTEM SHALL show the hold reason in plain words and, for a clone, the other connection's trace drawn over this one. Verify: e2e `hold.spec`. Priority: should
AC-12: WHEN Lift hold is pressed THE SYSTEM SHALL submit the lift through the verifier key and S1 SHALL show the cell eligible within 30 s of confirmation. Verify: e2e on the local chain. Priority: should
AC-13: WHEN the chain is unreachable THE SYSTEM SHALL show the last synced state dimmed with "Chain unreachable since {time}, showing the last synced state". Verify: e2e with the RPC env pointed at a dead port. Priority: should
AC-14: WHEN `/api/run` is called twice within two minutes for the same instance THE SYSTEM SHALL answer 429 to the second call. Verify: unit test on the limiter. Priority: must
AC-15: WHEN the repository is checked THE SYSTEM SHALL contain the ten deliverables at the paths in the rules ledger, with the climate projection stated as a number range with its method. Verify: `pb.py rules check` and `pb.py submit check`. Priority: must
AC-16: WHEN the first screen is read without the header THE SYSTEM SHALL back the word "tally" (the paid count and the ledger caption) outside the header. Verify: foldcheck `--promise tally` ok. Priority: should

## 10. Assumptions
A-1 [safe]: the demo sampling window is 30 s while the terms describe 14 days; the strip says both - validate by reading the strip in the backup take.
A-2 [reversible]: the screen is statistical (robust z-scores against the site cohort plus deterministic clone and flat checks), not a trained model; the README says so - validate by the critic's note that the model step is small being carried into /about.
A-3 [reversible]: the programme signer, verifier and site gateway keys are held server-side for the demo - validate by the security document naming the production arrangement (funder custody, hardware or multisig).
A-4 [blocking, fenced]: the deployer wallet has Sepolia test ETH - the user funds the printed address from a faucet; until then everything runs on a local Hardhat node and the Sepolia deploy task waits.
A-5 [safe]: judges may not run the build; the video and the description carry the entry - validate by `submit check` and the backup take.
A-6 [reversible]: the consumption threshold value (2.0 kWh per month) is the team's parameter; the terms name the threshold without a value - validate by the strip's "chosen" label and the README.
A-7 [safe]: eligibility is disputed (students only per two relays); the user asks on the public channel - not a build assumption.
A-8 [reversible]: the grant per connection is 350 tUSD (the 2020 NEP figure) - validate by the receipt row and /about stating the source and that UEF's figure is 592.

## 11. Demo script (hackathon)
0:00 S1 populated; voice: "A mini-grid developer in Nigeria builds the site, then waits months while a verifier, a grants administrator and a finance unit reconcile four private tallies before the per-connection grant moves." 0:12 the first screen itself: two figures, one button, the ledger, the synthetic caption read aloud. 0:20 press the button; five steps stream and are named. 0:35 the release confirms: cells light site by site, the balance counts down, the receipt rises; open the hash on Sepolia (0:40 to 0:55). 1:05 the verified source on the explorer; the rule strip read aloud with the chosen parameter. 1:30 the wrong-key summary rejected in step 1, the key table beside it. 1:45 the held connection: two identical traces; the verifier leaves the hold; the other 47 stand. 2:00 the screen's three planted faults and what it caught, labelled an illustration. 2:20 Re-sum rebuilds 47 and 16,450; download the JSON. 2:35 gas per release on the receipt; what is synthetic, what is live; what comes next. 2:50 close on the receipt and the lit ledger. Recording mode `?record=1&judge=0`.

## 12. Event and judged path
(This file is committed with the repository, so a judge may read it. Quote the event's own public pages, with
the date each was read. Nothing about individual judges and no guesses about what they like.)
- Window: start 2026-10-05T00:00:00Z (Mon 05 Oct 05:30 +05:30; the start hour is not published, taken as midnight UTC), freeze 2026-10-24T14:00:00Z (Sat 24 Oct 19:30 +05:30), end 2026-10-25T14:00:00Z (Sun 25 Oct 19:30 +05:30, provisional). Organiser page (read 2026-10-19): "Hackathon duration: October 5-25, 2026" and "Submission deadline: October 25, 2026, 11:59 PM UTC"; the Devpost listing API: "Oct 05 - 25, 2026"; two participant relays of the Devpost page put the cutoff at 17:00 +03 = 14:00 UTC, so the earlier instant is used until the Devpost page is re-read. Rule on earlier work: none stated on the organiser page; the Devpost rules page could not be read by our tools; treated as strict: the first commit is after the start and no earlier code is copied in.
- How an entry is judged: Devpost: a queue card (name, a tagline of at most 140 characters, a thumbnail), then the project page with the description, the embedded video, the "Try it out" link and the repository (Devpost help centre, read 2026-10-19). Minutes per project: not published. Whether anyone runs the build: not published (Devpost's usual terms let judges decide on text, images and video). Judging 26 Oct to 6 Nov 2026, winners 10 to 21 Nov 2026 (organiser page).
- Criteria: organiser page, read 2026-10-19: "Climate Impact & Environmental Benefit (30%)", "Technical Innovation & Blockchain Implementation (30%)", "Feasibility & Implementation Quality (10%)", "Data Security & Transparency (10%)", "User Experience & Design (10%)", "Scalability & Sustainability (10%)"; the page also shows "70% Technical Innovation & Blockchain Implementation / 20% Climate Impact & Environmental Benefit / 10% Scalability & Real-World Implementation Potential". No judge-facing form is public.
- Criteria coverage: Climate Impact: partial: the tally page shows connections released sooner and pre-financing months avoided as a range, with the per-household factor as a labelled illustration; the climate half is argued in docs/climate-impact.md. Technical & Blockchain: met: the release transaction on the explorer at 0:35 with verified source. Feasibility: met: the live link, the "Run month 4 release" button, the replay command. Data Security: met: the wrong-key summary rejected at 1:30 with the key table; docs/security-and-data-integrity.md. User Experience: met: the first screen at 0:12, one action, no login. Scalability: partial: gas per release on screen; the rest is docs/scalability-roadmap.md.
- Capability coverage: no sponsor prizes name capabilities; the three cash prizes are ranked on the criteria above.
- Main result: a number: the paid-connection count rising from 0 to 47 and the escrow balance falling as the contract releases, with 3 held; on the DARES verification terms' sampling table and the NEP and UEF grant rules (real), with 50 synthetic connections, traces and three planted faults (said so on screen). The staged failure: a connection whose trace is identical to a neighbour's meter is held with both traces shown; the other 47 release.
- Promise coverage: "Open": the public tally, the re-sum drawer and the explorer links lead the first screen with no login. "Tally": the paid count and the escrow balance are the two figures at the top left, and the ledger caption uses the word. AC-7 and AC-16.
- Before the clock: the window opened on 5 October; this team started on 19 October with the idea package, the UI spec and this contract; nothing was built before. README sentence: "Planning started on 19 October 2026 from a research package kept outside this repository; the first commit is dated after that."
