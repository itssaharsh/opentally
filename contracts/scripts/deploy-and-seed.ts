// Deploys the token (unless TOKEN_ADDRESS is set) and the factory (unless FACTORY_ADDRESS is set), creates a fresh
// programme instance, seeds the demo world and submits months 1 to 3, then writes web/src/data/deployment.json.
// Account order on every network: 0 deployer and funder, 1 programme owner, 2 verifier, 3-5 site gateways, 6-8 payouts.
import { writeFileSync } from "node:fs";
import { network } from "hardhat";
import { parseEther, formatEther, type Address } from "viem";
import { seedInstance } from "./lib/seedChain.js";
import { GRANT_TUSD, RULE, PROGRAMME_NAME } from "./lib/seedData.js";

const netName = process.env.HH_NETWORK ?? "localhost";
const { viem } = await network.create({ network: netName });
const publicClient = await viem.getPublicClient();
const wallets = await viem.getWalletClients();
if (wallets.length < 9) throw new Error(`need 9 accounts on ${netName}, got ${wallets.length}`);
const [deployer, owner, verifier, gA, gB, gC, pA, pB, pC] = wallets;
const chainId = await publicClient.getChainId();
console.log(`network ${netName} chain ${chainId} deployer ${deployer.account.address}`);

// gas for the operator keys on a public network
if (netName !== "localhost") {
  for (const w of [owner, verifier]) {
    const bal = await publicClient.getBalance({ address: w.account.address });
    if (bal < parseEther("0.01")) {
      const h = await deployer.sendTransaction({ to: w.account.address, value: parseEther("0.03") });
      await publicClient.waitForTransactionReceipt({ hash: h });
      console.log(`funded ${w.account.address} with 0.03 ETH`);
    }
  }
}

const token = process.env.TOKEN_ADDRESS
  ? await viem.getContractAt("TestUSD", process.env.TOKEN_ADDRESS as Address)
  : await viem.deployContract("TestUSD", [], { client: { wallet: deployer } });
console.log("token", token.address);

const factory = process.env.FACTORY_ADDRESS
  ? await viem.getContractAt("OpenTallyFactory", process.env.FACTORY_ADDRESS as Address)
  : await viem.deployContract("OpenTallyFactory", [owner.account.address], { client: { wallet: deployer } });
console.log("factory", factory.address);

const ownerFactory = await viem.getContractAt("OpenTallyFactory", factory.address, { client: { wallet: owner } });
const windowSeconds = Number(process.env.WINDOW_SECONDS ?? RULE.windowSeconds);
const rule = { ...RULE, windowSeconds };
const createHash = await ownerFactory.write.create([token.address, verifier.account.address, deployer.account.address, GRANT_TUSD, rule, PROGRAMME_NAME]);
const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
const instance = (await factory.read.latest()) as Address;
console.log("instance", instance, "block", createReceipt.blockNumber);

const tally = await viem.getContractAt("OpenTally", instance);
await seedInstance({ viem, publicClient, tally, token, months: [1, 2, 3],
  roles: { owner, verifier, funder: deployer, gateways: [gA, gB, gC], payouts: [pA.account.address, pB.account.address, pC.account.address] } });

const deployment = {
  network: netName, chainId, token: token.address, factory: factory.address, instance,
  deployBlock: Number(createReceipt.blockNumber), deployedAt: new Date().toISOString(),
  accounts: { deployerFunder: deployer.account.address, owner: owner.account.address, verifier: verifier.account.address,
    gateways: [gA.account.address, gB.account.address, gC.account.address], payouts: [pA.account.address, pB.account.address, pC.account.address] },
  rule, grantTusd: 350, depositTusd: 17500,
  explorer: chainId === 11155111 ? "https://sepolia.etherscan.io" : null,
};
const outPath = process.env.DEPLOYMENT_OUT ?? "../web/src/data/deployment.json";
writeFileSync(outPath, JSON.stringify(deployment, null, 2));
console.log("wrote", outPath);
const bal = await publicClient.getBalance({ address: deployer.account.address });
console.log("deployer balance", formatEther(bal), "ETH");
