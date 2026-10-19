import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { seedInstance } from "../scripts/lib/seedChain.js";
import { GRANT_TUSD, DEPOSIT_TUSD, RULE, PROGRAMME_NAME } from "../scripts/lib/seedData.js";

describe("Seed", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner, verifier, gA, gB, gC, pA, pB, pC] = await viem.getWalletClients();

  it("registers 3 sites and 50 connections, deposits 17,500 tUSD and submits months 1 to 3", async function () {
    const token = await viem.deployContract("TestUSD");
    const tally = await viem.deployContract("OpenTally", [token.address, owner.account.address, verifier.account.address, owner.account.address, GRANT_TUSD, RULE, PROGRAMME_NAME]);
    const r = await seedInstance({ viem, publicClient, tally, token, months: [1, 2, 3],
      roles: { owner, verifier, funder: owner, gateways: [gA, gB, gC], payouts: [pA.account.address, pB.account.address, pC.account.address] } });
    assert.equal(r.seed.length, 50);
    assert.equal(await tally.read.siteCount(), 3n);
    assert.equal(await tally.read.connectionCount(), 50n);
    assert.equal(await tally.read.escrowBalance(), DEPOSIT_TUSD);
    assert.notEqual(await tally.read.batchSubmittedAt([3]), 0n);
    assert.equal(await tally.read.batchSubmittedAt([4]), 0n);
    const elig = await tally.read.eligible([3]);
    assert.equal(elig.length, 50);
  });
});
