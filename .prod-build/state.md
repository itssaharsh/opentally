# Build state - opentally
Updated: 2026-10-21 20:35Z | mode: hackathon | channel: direct | phase: M3 (submission)

## Now
- Phase / current task: T14 final take: recorded from the live URL on Base Sepolia; render and QA in progress. Then T15 submit.
- Live: https://opentally.vercel.app (Vercel team lack-toes). Repo: https://github.com/itssaharsh/opentally (public).
- Chain: Base Sepolia. Token 0x0c491dbab75025e2b6f318e6daf3ce98b5a538c2, factory 0x57a62103b0de09a65d84ecf90984ff597085fa75 (Sourcify verified); instances are verified on Blockscout by bytecode match.

## What worked (with evidence IDs)
- Live judge flow three times in a row, fresh programme between runs, 47 of 50 each, 0 console errors (E0092).
- Fold check at 1440x900 and 390x844 on the live URL (E0094). Unseen input and chain-off path (E0093).
- Contracts 10 tests, web 29 unit tests, 12 browser tests on the local chain (E0082, E0095, E0096).

## What failed (memory IDs) - do not retry without a new root cause
- F-0003: Sepolia's code pricing puts the factory over the per-transaction gas cap; Base Sepolia instead.
- F-0004: writes to a just-created contract estimated on a lagging public RPC node revert out of gas; gas is estimated at our latest write's block; sends go to the Base sequencer.
- Recording: run.py's scroll action hangs under paused page time once a run starts (use eval scrolls); Blockscout does not load under the recorder's clock (captured separately in real time as footage); WSL mirrored networking flapped eth0 and broke Chromium (switched to NAT, see the user's memory).

## Not tried yet / open questions
- The video must be uploaded by Saharsh (YouTube or Vimeo, public or unlisted); then links.json video, README video line, submit check --video-url.
- Devpost submission form is filled by Saharsh; the text is docs/devpost-description.md.

## Changes that need care (migrations applied, deploys, destructive ops)
- contracts/.env holds the demo mnemonic (git-ignored, mode 600). Never print it. Vercel has it as a sensitive DEMO_MNEMONIC.
- Demo wallets on Base Sepolia hold about 0.009 ETH in total (about 50 more visitors at ~0.00015 each). Top up the deployer 0xC11b85FDDcbB2436Ca2b09b0bfd1d3Bf0105B181 if fresh runs pause.

## Exact next step
- When the render finishes: qa.py --asr, read the contact sheets, fix any issue, hand Saharsh build/final.mp4 to upload.
