// Scans the client bundle (.next/static) for the demo mnemonic, the public Hardhat test mnemonic and every private key
// derived from them. Prints only file names and which kind of secret matched, never the secret.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { mnemonicToAccount } from "viem/accounts";
import { bytesToHex } from "viem";

const root = path.resolve(process.cwd(), ".next/static");
if (!existsSync(root)) { console.error("no .next/static: run next build first"); process.exit(2); }
const envFile = path.resolve(process.cwd(), "../contracts/.env");
let demo = process.env.DEMO_MNEMONIC;
if (!demo && existsSync(envFile)) demo = (readFileSync(envFile, "utf8").match(/^DEMO_MNEMONIC="?([^"\n]+)"?/m) ?? [])[1];
const phrases = [["hardhat test mnemonic", "test test test test test test test test test test test junk"]];
if (demo) phrases.push(["demo mnemonic", demo.trim()]);
const needles = [];
for (const [kind, m] of phrases) {
  needles.push([kind, m]);
  for (let i = 0; i < 9; i++) {
    const pk = bytesToHex(mnemonicToAccount(m, { addressIndex: i }).getHdKey().privateKey).slice(2);
    needles.push([`${kind} key ${i}`, pk]);
  }
}
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(root);
let hits = 0;
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const [kind, n] of needles) if (s.toLowerCase().includes(n.toLowerCase())) { console.log(`FOUND ${kind} in ${path.relative(process.cwd(), f)}`); hits++; }
}
console.log(`scanned ${files.length} client files for ${needles.length} secrets: ${hits} found`);
process.exit(hits ? 1 : 0);
