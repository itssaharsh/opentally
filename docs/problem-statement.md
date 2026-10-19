# Problem statement and solution overview

## The problem

Across Africa, governments and donors pay private developers to connect households to solar mini-grids through results-based financing: a fixed grant for each connection, paid after the connection has been verified. Nigeria's Electrification Project paid US$350 per connection after 90 days of service; the SEforALL Universal Energy Facility pays US$592 once its programme manager has verified the connection and independent verification agents have visited.

The money moves slowly and the record cannot be checked from outside.

- **Four tallies, reconciled by hand.** The terms of reference for the DARES programme's independent verification agent tell it to "develop an independent dashboard for verification" to be "check[ed] against the reporting on the odyssey platform and the monitoring tool of the grant's administrator, which will also be crosschecked with the numbers from the Financial Management Unit". Its recommendations "are not binding to the GA and PMU" (Rural Electrification Agency of Nigeria).
- **Slow, unpredictable disbursement.** A study of thirteen results-based financing programmes found that only 14% of US$9.1 billion committed to African mini-grids had been disbursed by early 2025, and asked for "predictable, on-time disbursement" (Beyond the Grid Fund for Africa and Nefco, December 2025).
- **Headlines nobody can rebuild.** In June 2026 an analyst tried to reproduce a development bank's headline count of people electrified from the data it had published and got 1.31 million against a 5.2 million headline (BusinessDay). That was a portfolio count rather than a connection ledger, but it shows the gap: the published records do not add up to the published totals.

Who it hurts: the developer's finance lead, who builds the site first and then pre-finances it for months while the claim moves through four offices; and the programme manager, who has to defend a total that outsiders cannot check.

What it is not: the only constraint. The DARES status report of 21 September 2026 says "market response consistently outpaced the available financing envelope", so in Nigeria the size of the fund limits connections more than the speed of payment does. OpenTally addresses speed, predictability and the record, not the size of the fund.

## The solution

OpenTally puts one results-based financing programme on a public ledger.

1. The funder deposits the grant pool into an escrow contract.
2. Each site's metering gateway signs a monthly summary for every connection: days active, kWh consumed, and a hash of the daily readings. The contract checks every signature against that site's key; one bad signature rejects the whole batch.
3. A screen compares each connection's month with the rest of its site and holds the ones that look wrong (identical traces, flat traces, outliers). It can only hold. The verifier can lift a hold or keep it.
4. When the programme's rule is met (meters active for the month, consumption above a threshold) and the sampling window has closed without a hold, anyone can trigger the release. The contract pays every eligible connection's grant to its site in one transaction and records each payment.
5. Anyone can re-add the totals from those records. The re-sum runs in the visitor's own browser, reading straight from the chain.

## Why a ledger, and not a database

The four parties who keep separate tallies today do not need to trust each other's spreadsheet. The contract holds the money and pays only by the rule; the gateway signatures, the holds and the payments are a record none of them controls; and the release needs no office in between, so nobody can slow it down or speed it up for one developer. A database run by one of them would bring back the tally the other three check by hand.

## What the demo shows

A programme of 50 synthetic connections across three fictional sites in Kano, Kaduna and Jigawa, with months 1 to 3 already submitted. One button runs month 4: 50 summaries verified on-chain (one refused first for a wrong site key), 3 held by the screen (two identical meters and one flat one), 47 released in one transaction, 16,450 of 17,500 test dollars paid out. A held connection can be opened, its trace compared with the site's, and the hold lifted; the lifted connection is then paid by the same rule. The re-sum drawer rebuilds 47 connections and 16,450 tUSD from the release records.

Real: the contract, the signatures, the rule, the holds, the release and the records, on a public test network. Synthetic: the 50 connections, their readings and the three planted faults. Chosen by this team: the consumption threshold, because the terms name it without a value.

## Sources

- Rural Electrification Agency of Nigeria, DARES verification agent terms of reference: https://nep.rea.gov.ng/assets/documents/resource-hub/ToR_for_IVA_North.pdf
- Beyond the Grid Fund for Africa and Nefco, mini-grid study (December 2025): https://beyondthegrid.africa/wp-content/uploads/BGFA_Mini-grid_Spreads.pdf
- SEforALL Universal Energy Facility: https://www.seforall.org/UEF-mini-grids
- Rockefeller Foundation, results-based financing case study (2020): https://www.rockefellerfoundation.org/wp-content/uploads/2020/10/EE-Download-Solutions-CaseStudies-ResultsBasedFinance.pdf
- World Bank, DARES implementation status report (21 September 2026): http://documents1.worldbank.org/curated/en/099092126102525246/txt/P179687-de38219d-5a05-444d-aab6-4f339dcb4e99.txt
- BusinessDay (June 2026): https://businessday.ng/opinion/article/the-world-bank-said-mission-300-has-electrified-50-million-africans-so-we-checked/
