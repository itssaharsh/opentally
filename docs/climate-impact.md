# Climate impact assessment

OpenTally does not generate electricity or cut emissions by itself. It changes when grant money reaches the developers who build mini-grids, and what a funder, a journalist or anyone else can check about where it went. This assessment says how that reaches the climate, puts a number on it with every assumption written down, and says where the number is weak.

## How a payment rule reaches the climate

A results-based financing programme pays a developer a fixed grant for each household connected to a solar mini-grid, after verification. Two programmes this build follows:

- Nigeria's Electrification Project paid "a grant subsidy of US$350 per connection ... after 90 days of providing service to a household" (Rockefeller Foundation case study, 2020).
- The SEforALL Universal Energy Facility pays a "results-based incentive of USD 592 per electricity connection" once the programme manager has verified it and independent verification agents have visited (seforall.org/UEF-mini-grids, read 19 October 2026). Its first wave is "expected to deliver almost 14,000 electricity connections".

Until the grant arrives, the developer has paid for panels, batteries, poles and meters out of its own working capital. The sector's own study of thirteen programmes found that only 14% of US$9.1 billion committed to African mini-grids had been disbursed by early 2025 and asked for "predictable, on-time disbursement" (Beyond the Grid Fund for Africa and Nefco, December 2025). The DARES verification terms set out four separate tallies that are reconciled by hand before money moves, with a verifier whose recommendations "are not binding" (Rural Electrification Agency of Nigeria).

OpenTally releases each connection's grant in one transaction once the programme's rule is met and the sampling window has closed without a hold. The climate effect comes through two channels:

1. **Earlier connections.** A developer that is paid sooner can put the same money into the next site sooner. Each household connected earlier stops burning kerosene or running a diesel generator earlier.
2. **Grants that reach real connections.** The screen and the verifier's hold keep money from phantom or cloned meters, so each grant dollar backs a household that is actually using power.

The first channel is quantified below. The second is not: no public source gives the share of claims that are phantom, so any number would be invented.

## Assumptions

| Input | Value used | Source and status |
|---|---|---|
| Emissions avoided per connected household | 0.26 tCO2 a year | UNFCCC SDM Programme workshop, Marrakech, April 2015: rural electrification case study, "Component 3 (Grid/mini-grid): 0.26 tCO2" per household per year, citing IRENA (2015), under CDM methodology AMS-III.BB. A single programme's case figure, used as an illustration, not as a default factor |
| Connections in one programme window | 14,000 | UEF Wave 1, as stated by SEforALL |
| Time from connection to grant today | 3 to 6 months | NEP's 90 days of service before the grant; DARES verification terms requiring verified supply and sampling before payment; the six-month figure is relayed by an analyst (BusinessDay, June 2026), so the upper end is weaker |
| Time from connection to grant with OpenTally | 1 month | one month of signed summaries plus the 14-day sampling window the terms describe; the demo shortens the window to 30 seconds |
| Months brought forward per connection | 2 (low), 3 (central), 5 (high) | the difference between the two rows above |
| Share of the programme where working capital, not the grant envelope, limits building | 0% (low), 50% (central), 100% (high) | the DARES status report (21 September 2026) says "market response consistently outpaced the available financing envelope", which means the envelope, not speed, binds in Nigeria; the low case takes that at face value |

## Carbon reduction projections

The quantity is avoided emissions brought forward: emissions that would have been avoided anyway, avoided earlier because connections come online sooner. It is a timing gain over the programme's life, not a permanent reduction beyond what the programme was already going to deliver.

For one programme window of 14,000 connections:

| Case | Months earlier | Share where speed matters | Avoided emissions brought forward |
|---|---|---|---|
| Low | 2 | 0% | 0 tCO2 |
| Central | 3 | 50% | 455 tCO2 |
| High | 5 | 100% | 1,517 tCO2 |

Working: 14,000 connections × 0.26 tCO2 a year × (months ÷ 12) × share. Central: 14,000 × 0.26 × 0.25 × 0.5 = 455 tCO2. High: 14,000 × 0.26 × (5 ÷ 12) × 1 = 1,517 tCO2.

The low case is zero on purpose. Where the money envelope is the limit, paying faster changes cash flow and the record, not the number of connections.

## Sensitivity

- **The per-household factor is the weakest input.** 0.26 tCO2 a year is one 2015 case study with a kerosene and diesel baseline. A household on a mini-grid that replaces a petrol or diesel generator for a small business would avoid more; one that replaces nothing (new demand) avoids nothing directly. SEforALL's methodology note argues baselines should use the energy customers actually consume and their prior fuel; a real deployment would apply AMS-III.BB to each site's metered consumption, which this system already records each month.
- **The months brought forward scale the result linearly.** Halving the gain halves the number.
- **Programme size scales it linearly too.** The DARES status report counts 580 mini-grid grant agreements signed; at the same per-connection figures, a programme ten times the UEF wave gives ten times the tonnes.

## What would make this stronger

1. Run one real programme window side by side: the existing process and OpenTally on the same meter exports, and measure the days from connection to grant for each.
2. Replace the case-study factor with AMS-III.BB applied to each connection's own monthly kWh, which the signed summaries already carry.
3. Publish the share of claims the screen and the verifier hold, which turns the second channel into a number.

## Sources

- Rockefeller Foundation, results-based financing case study (2020): https://www.rockefellerfoundation.org/wp-content/uploads/2020/10/EE-Download-Solutions-CaseStudies-ResultsBasedFinance.pdf
- SEforALL Universal Energy Facility, mini-grids: https://www.seforall.org/UEF-mini-grids
- Beyond the Grid Fund for Africa and Nefco, mini-grid study (December 2025): https://beyondthegrid.africa/wp-content/uploads/BGFA_Mini-grid_Spreads.pdf
- Rural Electrification Agency of Nigeria, DARES independent verification agent terms of reference: https://nep.rea.gov.ng/assets/documents/resource-hub/ToR_for_IVA_North.pdf
- World Bank, DARES implementation status report, 21 September 2026: http://documents1.worldbank.org/curated/en/099092126102525246/txt/P179687-de38219d-5a05-444d-aab6-4f339dcb4e99.txt
- UNFCCC SDM Programme, rural electrification case study (April 2015): https://cdm.unfccc.int/sunsetcms/storage/contents/stored-file-20150421114344861/BO-1.1-4-ACF_rural%20electrification_%20v2.pdf
- BusinessDay, "The World Bank said Mission 300 has electrified 50 million Africans, so we checked" (June 2026): https://businessday.ng/opinion/article/the-world-bank-said-mission-300-has-electrified-50-million-africans-so-we-checked/
