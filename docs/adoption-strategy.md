# Implementation and adoption strategy

## Who adopts first, and why them

The first adopter is one results-based financing window run by a programme that already verifies claims from smart-meter data: a DARES or Universal Energy Facility window, or a smaller funder's pilot with a few developers. Such a programme has the three ingredients OpenTally needs today: a written verification rule, metering platforms that export monthly consumption per connection, and an independent verification agent who already samples sites.

The developer's finance lead is the person who feels the change first (the grant arrives about a month after the connection instead of three to six), but the programme manager decides. The pitch to the programme manager is not speed alone: it is a release that follows the programme's own rule, a verifier who can still stop any payment, and a total that anyone can rebuild.

## What a programme would have to change

| Today | With OpenTally | Who has to agree |
|---|---|---|
| The developer uploads a claim; the platform checks it against meter data | the site's gateway signs a monthly summary per connection, and the contract checks the signature | the metering platform (an export with a signing key) and the developer |
| The verifier recommends; the grants administrator and the finance unit decide | the verifier holds or lifts on the ledger; the rule decides the rest | the funder, who gives up per-claim discretion in exchange for a written rule and a hold key |
| Payment from the programme's bank account | release from an escrow funded per tranche | the funder's treasury |
| The headline total is compiled by the programme | the total is the sum of the release records | nobody: it follows |

The hard part is the second row. The opened terms keep human discretion on purpose, and a funder that has run a blockchain disbursement ledger for years has kept every payment behind human approval (KfW's TruBudget). OpenTally answers that with three limits a funder can set: the verifier's hold, which stops any connection; the sampling window, which gives the verifier time; and tranche-sized deposits, which cap what any one release can pay.

## Pilot plan (three months)

1. **Month 0, shadow mode.** Take one developer's meter export for a past month, sign it with a test gateway key, and run OpenTally beside the existing process without moving money. Compare: which connections each process pays, and how long each takes.
2. **Month 1 to 2, one live tranche.** The funder deposits one month's expected grants for that developer into the escrow on a production network with a stablecoin. The verifier gets the hold key. The existing process runs in parallel as the fallback.
3. **Month 3, review.** Days from connection to grant, holds raised and how many were right, disagreements between the two processes, and the gas paid.

Success: grants paid within a month of connection with no payment the existing process would have refused. Stop: any payment the verifier would have held but could not.

## Integration

- **Meter platforms.** The gateway signature can be produced by the metering platform's export job; OpenTally needs only the per-connection monthly summary and the hash of the daily readings. Open meter software such as EnAccess's OpenSmartMeter already exposes the data.
- **The existing platform.** OpenTally does not replace the claim platform a programme uses; it replaces the step where four offices reconcile tallies before paying.
- **Payout.** Grants go to the site's payout address. Off-ramping to a bank account is the developer's choice and is outside this build.

## Risks to adoption

| Risk | Answer |
|---|---|
| Funders will not give up discretion | the hold key, the window and tranche caps keep a human stop on every payment |
| Key custody at gateways | start with the platform's export job holding the key; move to hardware keys per site later |
| Regulation of stablecoin payouts in the programme's country | pay in the programme's existing payout rail, using the ledger only as the rule and the record, if a token payout is not allowed |
| Gas costs on a public network | measured at 0.94 to 0.99 million gas per release of 47 connections and 4.14 million per monthly batch of 50 summaries on the local chain; on a rollup these cost cents |

## Sources

- Rural Electrification Agency of Nigeria, DARES verification agent terms of reference: https://nep.rea.gov.ng/assets/documents/resource-hub/ToR_for_IVA_North.pdf
- SEforALL Universal Energy Facility: https://www.seforall.org/UEF-mini-grids
- BMZ, TruBudget: https://bmz.de/en/issues/digital-transformation/digital-public-goods-and-infrastructure/trubudget-215872
- EnAccess open-source energy access tools: https://github.com/enaccess
