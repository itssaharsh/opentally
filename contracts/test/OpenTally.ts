import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import { parseUnits, keccak256, toHex, type Address, type Hex } from "viem";

const GRANT = parseUnits("350", 6);
const RULE = { activeDaysMin: 30, kwhMilliMin: 2000, windowSeconds: 60 };

describe("OpenTally", async function () {
  const { viem, networkHelpers } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner, verifier, gatewayA, gatewayB, payoutA, payoutB] = await viem.getWalletClients();

  async function deploy() {
    const token = await viem.deployContract("TestUSD");
    const tally = await viem.deployContract("OpenTally", [
      token.address, owner.account.address, verifier.account.address, owner.account.address,
      GRANT, RULE, "Demo programme",
    ]);
    await tally.write.registerSite(["Site A", payoutA.account.address, gatewayA.account.address]);
    await tally.write.registerSite(["Site B", payoutB.account.address, gatewayB.account.address]);
    const h = (s: string) => keccak256(toHex(s));
    await tally.write.registerConnections([[
      { siteId: 0, meterHash: h("m0"), customerHash: h("c0"), gpsCell: h("g0"), commissionedAt: 1_700_000_000n },
      { siteId: 0, meterHash: h("m1"), customerHash: h("c1"), gpsCell: h("g1"), commissionedAt: 1_700_000_000n },
      { siteId: 1, meterHash: h("m2"), customerHash: h("c2"), gpsCell: h("g2"), commissionedAt: 1_700_000_000n },
      { siteId: 1, meterHash: h("m3"), customerHash: h("c3"), gpsCell: h("g3"), commissionedAt: 1_700_000_000n },
    ]]);
    await token.write.approve([tally.address, GRANT * 4n]);
    await tally.write.deposit([GRANT * 4n]);
    return { token, tally };
  }

  async function sign(signer: typeof gatewayA, tally: Address, s: { connectionId: number; month: number; activeDays: number; kwhMilli: number; traceHash: Hex }) {
    const chainId = await publicClient.getChainId();
    return signer.signTypedData({
      domain: { name: "OpenTally", version: "1", chainId, verifyingContract: tally },
      types: { Summary: [
        { name: "connectionId", type: "uint32" }, { name: "month", type: "uint32" },
        { name: "activeDays", type: "uint16" }, { name: "kwhMilli", type: "uint32" }, { name: "traceHash", type: "bytes32" },
      ] },
      primaryType: "Summary",
      message: s,
    });
  }

  const trace = (seed: string) => keccak256(toHex(seed));
  const good = (id: number, month = 1) => ({ connectionId: id, month, activeDays: 30, kwhMilli: 68400, traceHash: trace(`t${id}-${month}`) });

  it("AC-1: a summary signed by another site's gateway reverts the batch with BadSignature", async function () {
    const { tally } = await deploy();
    const s0 = good(0), s1 = good(1);
    const sigs = [await sign(gatewayB, tally.address, s0), await sign(gatewayA, tally.address, s1)];
    await viem.assertions.revertWithCustomErrorWithArgs(
      tally.write.submitSummaries([1, [s0, s1], sigs]), tally, "BadSignature", [0]);
  });

  it("AC-2: release before the window closes reverts with WindowOpen", async function () {
    const { tally } = await deploy();
    const ss = [good(0), good(1), good(2), good(3)];
    const sigs = [await sign(gatewayA, tally.address, ss[0]), await sign(gatewayA, tally.address, ss[1]),
                  await sign(gatewayB, tally.address, ss[2]), await sign(gatewayB, tally.address, ss[3])];
    await tally.write.submitSummaries([1, ss, sigs]);
    await viem.assertions.revertWithCustomError(tally.write.release([1]), tally, "WindowOpen");
  });

  it("AC-3 and AC-4: after the window, eligible unheld connections are paid once, in one transaction", async function () {
    const { tally, token } = await deploy();
    const ss = [good(0), { ...good(1), activeDays: 10 }, good(2), good(3)];
    const sigs = [await sign(gatewayA, tally.address, ss[0]), await sign(gatewayA, tally.address, ss[1]),
                  await sign(gatewayB, tally.address, ss[2]), await sign(gatewayB, tally.address, ss[3])];
    await tally.write.submitSummaries([1, ss, sigs]);
    const verifierTally = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: verifier } });
    await verifierTally.write.hold([3, 1]);
    const eligible = await tally.read.eligible([1]);
    assert.deepEqual([...eligible].map(Number), [0, 2]);
    await networkHelpers.time.increase(RULE.windowSeconds + 1);
    await viem.assertions.emitWithArgs(tally.write.release([1]), tally, "ReleaseBatch", [1, 2, GRANT * 2n]);
    assert.equal(await tally.read.paidCount(), 2);
    assert.equal(await token.read.balanceOf([payoutA.account.address]), GRANT);
    assert.equal(await token.read.balanceOf([payoutB.account.address]), GRANT);
    const held = await tally.read.getConnection([3]);
    assert.equal(held.paid, false);
    assert.equal(held.held, true);
    await viem.assertions.emitWithArgs(tally.write.release([1]), tally, "ReleaseBatch", [1, 0, 0n]);
    assert.equal(await tally.read.paidCount(), 2);
  });

  it("a second summary for the same connection and month reverts with AlreadySubmitted", async function () {
    const { tally } = await deploy();
    const s0 = good(0);
    const sig = await sign(gatewayA, tally.address, s0);
    await tally.write.submitSummaries([1, [s0], [sig]]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      tally.write.submitSummaries([1, [s0], [sig]]), tally, "AlreadySubmitted", [0, 1]);
  });

  it("lift makes a held connection eligible again", async function () {
    const { tally } = await deploy();
    const s0 = good(0);
    await tally.write.submitSummaries([1, [s0], [await sign(gatewayA, tally.address, s0)]]);
    const verifierTally = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: verifier } });
    await verifierTally.write.hold([0, 2]);
    assert.deepEqual([...(await tally.read.eligible([1]))], []);
    await verifierTally.write.lift([0]);
    assert.deepEqual([...(await tally.read.eligible([1]))].map(Number), [0]);
  });

  it("holdMany holds several connections in one transaction", async function () {
    const { tally } = await deploy();
    const verifierTally = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: verifier } });
    await verifierTally.write.holdMany([[1, 2], [1, 2]]);
    assert.equal((await tally.read.getConnection([1])).held, true);
    assert.equal((await tally.read.getConnection([2])).holdReason, 2);
  });

  it("anyone can trigger the release once the window closes, and it pays only by the rule", async function () {
    const { tally, token } = await deploy();
    const ss = [good(0), good(1), good(2), good(3)];
    const sigs = [await sign(gatewayA, tally.address, ss[0]), await sign(gatewayA, tally.address, ss[1]),
                  await sign(gatewayB, tally.address, ss[2]), await sign(gatewayB, tally.address, ss[3])];
    await tally.write.submitSummaries([1, ss, sigs]);
    await networkHelpers.time.increase(RULE.windowSeconds + 1);
    const stranger = await viem.getContractAt("OpenTally", tally.address, { client: { wallet: payoutB } });
    await viem.assertions.emitWithArgs(stranger.write.release([1]), tally, "ReleaseBatch", [1, 4, GRANT * 4n]);
    assert.equal(await token.read.balanceOf([payoutA.account.address]), GRANT * 2n);
  });

  it("only the verifier can hold", async function () {
    const { tally } = await deploy();
    await viem.assertions.revertWithCustomError(tally.write.hold([0, 1]), tally, "NotVerifier");
  });

  it("the factory records the latest instance", async function () {
    const token = await viem.deployContract("TestUSD");
    const factory = await viem.deployContract("OpenTallyFactory", [owner.account.address]);
    await factory.write.create([token.address, verifier.account.address, owner.account.address, GRANT, RULE, "Demo programme"]);
    const latest = await factory.read.latest();
    assert.notEqual(latest, "0x0000000000000000000000000000000000000000");
    assert.equal(await factory.read.instanceCount(), 1n);
    const inst = await viem.getContractAt("OpenTally", latest);
    assert.equal((await inst.read.owner()).toLowerCase(), owner.account.address.toLowerCase());
  });
});
