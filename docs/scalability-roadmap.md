# Scalability and sustainability roadmap

## Measured today

| Quantity | Value | How it was measured |
|---|---|---|
| Gas for one monthly batch of 50 signed summaries | 4.14 million (about 83,000 per summary) | local chain, `submitSummaries` receipts of three runs in the browser suite |
| Gas for one release of 47 connections | 0.94 to 0.99 million | release receipts of two runs (local chain) |
| Gas per released connection | about 20,000 to 21,000 | the release gas divided by 47 |
| Gas for releasing one connection after a lifted hold | 216,148 | one receipt in the hold test |
| Time from pressing the button to the release on the local chain | about 40 seconds, 30 of them the demo's sampling window | the browser test |

On an Ethereum mainnet-like network that release would be expensive; on a rollup it costs cents. The contract is network-neutral; the app already runs against a local chain, Sepolia or Base Sepolia from one setting.

## What breaks first as programmes grow

1. **Release gas grows with connections.** One `release` loops over every connection. At about 20,000 gas each, a block holds a few thousand. Fix: page the release (`release(month, from, to)`), so each call pays a slice.
2. **Summary gas grows with connections, and it is the larger cost.** Each summary is stored on-chain and its signature checked: about 83,000 gas each, four times the release. Fix: each site gateway signs a Merkle root of its month's summaries; the contract stores one root per site and a connection is released by presenting its leaf and proof. Storage drops from one slot set per connection to one per site.
3. **Many programmes at once.** The factory already creates independent programme instances. Next: a registry across programmes so one connection cannot be paid twice by two programmes (the migration of legacy sites between Nigerian programmes is a documented case).
4. **The web reads every connection per page load.** Fine for 50; for thousands, index the events into a small read model and page the ledger view.

## Roadmap

| Step | What | Why |
|---|---|---|
| 1 | Paged release and per-site Merkle roots | programmes of tens of thousands of connections |
| 2 | Keys with their holders: funder custody, gateway keys at the metering platform, the verifier's own signer | remove the demo's single server key |
| 3 | A production network chosen for fees and finality, and a stablecoin escrow | real money |
| 4 | AMS-III.BB emissions per connection from each month's signed kWh | turn the climate estimate into a measured figure |
| 5 | Cross-programme connection registry | stop double payment across programmes |
| 6 | Read model and API for programme dashboards and journalists | outside checking at scale |

## Who keeps it running

The code is open source under the MIT licence. A programme that adopts it runs its own instance through the factory and pays its own gas; there is no service to subscribe to. The parts a programme operates are the contracts, which do not change once deployed, and a small web app, which any team can host. After the event the repository stays public with its tests, so a programme or another team can fork it without asking.

## Environmental footprint of the system itself

A rollup transaction uses a negligible amount of energy compared with the diesel and kerosene a connection displaces. The web app is a few server functions that run only when someone opens it.
