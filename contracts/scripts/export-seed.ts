import { writeFileSync, mkdirSync } from "node:fs";
import { buildSeed, SITES, PLANTED, RULE, PROGRAMME_NAME, summaryOf } from "./lib/seedData.js";
const seed = buildSeed();
const out = {
  note: "Synthetic demo world: 3 fictional sites, 50 connections, four months of daily kWh. Not real households.",
  programmeName: PROGRAMME_NAME, rule: RULE, grantTusd: 350, depositTusd: 17500, sites: SITES, planted: PLANTED,
  connections: seed.map((c) => ({ ...c, summaries: Object.fromEntries(Object.entries(c.traces).map(([m, t]) => [m, summaryOf(t)])) })),
};
mkdirSync("seed", { recursive: true });
writeFileSync("seed/programme.json", JSON.stringify(out));
mkdirSync("../web/src/data", { recursive: true });
writeFileSync("../web/src/data/programme.json", JSON.stringify(out));
console.log("seed written:", seed.length, "connections");
