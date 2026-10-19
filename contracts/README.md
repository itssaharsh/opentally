# OpenTally contracts

Hardhat 3 with viem and node:test.

- `contracts/OpenTally.sol`: one programme's escrow, connection registry, EIP-712 summary check, holds and release.
- `contracts/OpenTallyFactory.sol`: creates a fresh programme instance per demo visitor.
- `contracts/TestUSD.sol`: a 6-decimal test token with no value.

```
npm test                      # unit tests
npm run deploy:local          # local node, seeded
npm run deploy:base-sepolia   # Base Sepolia, needs DEMO_MNEMONIC and BASE_SEPOLIA_RPC_URL in .env
```

Sepolia is configured but not used: its current code-deposit pricing puts the factory above the per-transaction gas cap.
