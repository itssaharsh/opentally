---
id: L-0001
type: lesson
title: Run browser tests against next build plus next start, not next dev, on a shared 8 GB machine
status: active
scope: project
components: web, qa
triggers: exit 137 during playwright with next dev
evidence: web/playwright.config.ts#L1-7
verified_at: 2026-10-19@981cfb4
relates: 
supersedes: 
helpful: 0
harmful: 0
cite_hash: 7a40050f156715dc
created: 2026-10-19
source: unknown
---

The first browser run was killed with exit 137 while next dev, Chromium and a Hardhat node ran together beside other editor sessions (about 2.3 GB free); the machine had restarted. Running the test against a production build (npm run build then next start) passed twice (E0018, E0021). When the machine is shared and memory is tight, test the production build: it uses less memory and it is what gets deployed.