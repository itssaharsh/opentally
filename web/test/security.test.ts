import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

describe("server-only secrets stay on the server", () => {
  it("every module that reads a key or the mnemonic imports server-only", () => {
    const src = walk(path.resolve(__dirname, "../src")).filter((f) => /\.(ts|tsx)$/.test(f));
    const offenders = src.filter((f) => {
      const s = readFileSync(f, "utf8");
      return /DEMO_MNEMONIC|mnemonicToAccount|privateKeyToAccount/.test(s) && !s.includes('import "server-only"');
    });
    expect(offenders).toEqual([]);
  });
  it("no client component imports the keys, wallets or pipeline modules", () => {
    const src = walk(path.resolve(__dirname, "../src")).filter((f) => /\.(ts|tsx)$/.test(f));
    const clients = src.filter((f) => readFileSync(f, "utf8").startsWith('"use client"'));
    const bad = clients.filter((f) => /from "@\/lib\/(keys|wallets|pipeline|reset|chain)"/.test(readFileSync(f, "utf8").replace(/import type[^\n]*\n/g, "")));
    expect(bad).toEqual([]);
  });
});
