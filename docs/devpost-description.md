Mini-grid grants in Nigeria wait on four private tallies. OpenTally releases each connection's grant on one public rule anyone can re-sum.

Live demo: https://opentally.vercel.app · Code: https://github.com/itssaharsh/opentally

## Inspiration

Results-based financing pays mini-grid developers a fixed grant for each household they connect, after verification: US$350 under Nigeria's Electrification Project, US$592 under the SEforALL Universal Energy Facility. The DARES verification terms tell the independent verifier to build its own dashboard and check it against three other tallies, and say its recommendations are not binding. A study of thirteen such programmes found that only 14% of US$9.1 billion committed to African mini-grids had been disbursed by early 2025 and asked for predictable, on-time disbursement. Developers build first and wait months to be paid; outsiders cannot rebuild the totals.

## What it does

OpenTally puts one programme on a public ledger. The funder deposits the grant pool into an escrow contract. Each site's metering gateway signs a monthly summary per connection, and the contract checks every signature. A screen holds connections whose readings look wrong against their site, and the verifier lifts or keeps the hold. When the rule is met and the sampling window closes without a hold, anyone can trigger the release, and the contract pays every eligible connection in one transaction. Anyone can re-add the totals from the release records in their own browser.

On the demo, one button runs month 4: 50 summaries verified (one refused first for a wrong site key), 3 held (two identical meters and one flat one), 47 released, 16,450 of 17,500 test dollars paid. Lift a hold and that connection is paid by the same rule.

## How we built it

Solidity contracts (escrow, EIP-712 summaries, rule, holds, release, a factory for a fresh programme per visitor) with Hardhat 3, OpenZeppelin and viem; a Next.js 16 app on Vercel that runs the five steps as a stream, reads state from the chain, and re-sums the totals in the browser. The screen is plain statistics: identical traces, flat traces, and robust z-scores against the site. Written with Claude Code as the coding agent.

## Challenges we ran into

Making the release need no trusted caller while the verifier can still stop any payment. Giving each judge a fresh programme when the first judge's run would otherwise leave everyone else looking at a finished one. Keeping state shared between Next.js routes and pages, which do not share module state. Moving from Sepolia to Base Sepolia when Sepolia's code pricing put the factory over the per-transaction gas cap, then hardening every read against load-balanced public RPC nodes that answer a block behind and cap log queries.

## What is real and what is not

The contract, the signatures, the rule, the holds, the release and the records are real, on the Base Sepolia test network. The 50 connections, their readings and the three planted faults are synthetic and labelled on screen. The consumption threshold is chosen by us because the terms name it without a value. The demo server holds every key so nobody needs a wallet; a real programme gives each key to its holder.

## What's next

A shadow-mode pilot on one developer's real meter export beside the existing process; paged releases and per-site Merkle roots for large programmes; emissions per connection computed from each month's signed kWh.
