Mini-grid grants in Nigeria wait on four private tallies. OpenTally releases each connection's grant on one public rule anyone can re-sum.

Live demo: https://opentally.vercel.app · Code: https://github.com/itssaharsh/opentally

## Track

**Renewable Energy & Energy Trading.** The track asks for decentralised, efficient energy systems, including microgrid coordination and tokenised incentives for clean energy. OpenTally is the payment rail for the incentive that already pays for most African mini-grid connections, the per-connection results-based grant, settled on a public ledger by one rule.

## Who it is for

The mini-grid developer's finance lead, who pre-finances each site while a claim moves through four offices; the programme manager, who has to defend a total outsiders cannot check; and the funder or verifier, who today reconciles spreadsheets by hand.

## Inspiration

Results-based financing pays mini-grid developers a fixed grant for each household they connect, after verification: US$350 under Nigeria's Electrification Project, US$592 under the SEforALL Universal Energy Facility. The DARES verification terms tell the independent verifier to build its own dashboard and check it against three other tallies, and say its recommendations are not binding. A study of thirteen such programmes found that only 14% of US$9.1 billion committed to African mini-grids had been disbursed by early 2025 and asked for predictable, on-time disbursement. Developers build first and wait months to be paid; outsiders cannot rebuild the totals.

## What it does

OpenTally puts one programme on a public ledger. The funder deposits the grant pool into an escrow contract. Each site's metering gateway signs a monthly summary per connection, and the contract checks every signature. A screen holds connections whose readings look wrong against their site, and the verifier lifts or keeps the hold. When the rule is met and the sampling window closes without a hold, anyone can trigger the release, and the contract pays every eligible connection in one transaction. Anyone can re-add the totals from the release records in their own browser.

On the demo, one button runs month 4: 50 summaries verified (one refused first for a wrong site key), 3 held (two identical meters and one flat one), 47 released, 16,450 of 17,500 test dollars paid. Lift a hold and that connection is paid by the same rule.

## How we built it

Solidity contracts (escrow, EIP-712 summaries, rule, holds, release, a factory for a fresh programme per visitor) with Hardhat 3, OpenZeppelin and viem; a Next.js 16 app on Vercel that runs the five steps as a stream, reads state from the chain, and re-sums the totals in the browser. The screen is plain statistics: identical traces, flat traces, and robust z-scores against the site. Written with Claude Code as the coding agent.

## Challenges we ran into

Making the release need no trusted caller while the verifier can still stop any payment. Giving each judge a fresh programme when the first judge's run would otherwise leave everyone else looking at a finished one. Keeping state shared between Next.js routes and pages, which do not share module state. Moving from Sepolia to Base Sepolia when Sepolia's code pricing put the factory over the per-transaction gas cap, then hardening every read against load-balanced public RPC nodes that answer a block behind and cap log queries.

## Climate impact

A developer paid in about a month, instead of three to six, puts the same money into the next site sooner, and each household connected sooner stops burning kerosene or running a diesel generator sooner. For one programme window of 14,000 connections, the central case brings forward about 455 tCO2 of avoided emissions (low 0, high 1,517), at 0.26 tCO2 per household a year. The low case is zero on purpose: where the size of the fund is the limit, paying faster changes cash flow and the record, not the number of connections. The working is in docs/climate-impact.md.

## Scale and adoption

A programme adopts OpenTally by running its own instance through the factory: developers' metering gateways sign their summaries, and the verifier keeps its role, now with a hold that stops a payment instead of a recommendation that is not binding. A release costs about 20,000 gas per connection and a summary about 83,000; the roadmap pages the release and rolls each site's month into one Merkle root, so a programme of tens of thousands of connections fits in ordinary blocks. Details in docs/adoption-strategy.md and docs/scalability-roadmap.md.

## What is real and what is not

The contract, the signatures, the rule, the holds, the release and the records are real, on the Base Sepolia test network. The 50 connections, their readings and the three planted faults are synthetic and labelled on screen. The consumption threshold is chosen by us because the terms name it without a value. The demo server holds every key so nobody needs a wallet; a real programme gives each key to its holder.

## What's next

A shadow-mode pilot on one developer's real meter export beside the existing process; paged releases and per-site Merkle roots for large programmes; emissions per connection computed from each month's signed kWh.
