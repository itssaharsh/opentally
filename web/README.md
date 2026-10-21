# OpenTally web app

Next.js 16 (App Router), React 19, Tailwind 4 and viem. It shows the tally, runs a month's release as a streamed five-step pipeline, lets the verifier lift or keep a hold, and re-sums the totals from the chain in the visitor's browser.

```bash
npm install
npm run build && npm start        # reads web/src/data/deployment.json for the chain and addresses
npm test                          # unit tests (screen, limiter, re-sum, instance picking, log ranges, retries)
npx playwright test               # browser tests; needs a local Hardhat node seeded with `npm run deploy:local` in ../contracts
```

Server environment: `DEMO_MNEMONIC` (the demo keys; never sent to the browser), and optionally `RPC_URL`, `NEXT_PUBLIC_RPC_URL`, `SEND_RPC_URL`, `LOG_SPAN`. `npm run secret-scan` checks the built client bundle for any key.
