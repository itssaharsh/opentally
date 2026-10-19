import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["e2e/**/*.e2e.ts"], environment: "node", testTimeout: 240_000, hookTimeout: 240_000 },
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "test/server-only-stub.ts") } },
});
