import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";

test.describe("previews of every S1 state are labelled and render as designed", () => {
  test.beforeAll(async ({ request }) => { const r = await request.post("/api/reset"); expect(r.ok(), await r.text()).toBeTruthy(); });

  test("first-run", async ({ page }) => {
    await page.goto("/?state=first-run");
    await expect(page.getByTestId("preview-banner")).toContainText("Preview of the first-run state");
    await expect(page.getByText("No claims yet for this window")).toBeVisible();
    await expect(page.getByTestId("cell-C-A01")).toHaveAttribute("data-state", "pending");
    await page.screenshot({ path: "qa/state-first-run-1440.png" });
  });
  test("running", async ({ page }) => {
    await page.goto("/?state=running");
    await expect(page.getByRole("button", { name: "Releasing, step 4 of 5" }).first()).toBeVisible();
    await expect(page.getByTestId("steps")).toContainText("closes in 18 s");
    await page.screenshot({ path: "qa/state-running-1440.png" });
  });
  test("released", async ({ page }) => {
    await page.goto("/?state=released");
    await expect(page.getByTestId("paid-count")).toHaveText(/47 of 50 paid/);
    await expect(page.getByTestId("cell-C-B14")).toHaveAttribute("data-state", "held");
    await page.screenshot({ path: "qa/state-released-1440.png" });
  });
  test("AC-9 error: the failed step names the revert, cells keep their prior state, Retry release is offered", async ({ page }) => {
    await page.goto("/?state=error");
    await expect(page.getByTestId("steps")).toContainText("the release reverted: InsufficientEscrow; nothing moved");
    await expect(page.getByRole("button", { name: "Retry release" }).first()).toBeVisible();
    await expect(page.getByTestId("cell-C-A01")).toHaveAttribute("data-state", "eligible");
    await expect(page.getByTestId("paid-count")).toHaveText(/0 of 50 paid/);
    await page.screenshot({ path: "qa/state-error-1440.png" });
  });
  test("partial", async ({ page }) => {
    await page.goto("/?state=partial");
    await expect(page.getByTestId("stale")).toContainText("showing the last synced state");
    await page.screenshot({ path: "qa/state-partial-1440.png" });
  });
});

test("AC-13: with the chain unreachable the page says so and the state API answers 503", async ({ page, request }) => {
  const port = 3472;
  const child: ChildProcess = spawn("node_modules/.bin/next", ["start", "--port", String(port)], { env: { ...process.env, RPC_URL: "http://127.0.0.1:9" }, stdio: "ignore", detached: true });
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { try { const r = await request.get(`http://127.0.0.1:${port}/`); up = r.status() < 600; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
    expect(up).toBeTruthy();
    const api = await request.get(`http://127.0.0.1:${port}/api/state`);
    expect(api.status()).toBe(503);
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(page.getByTestId("stale")).toContainText("Chain unreachable");
    await expect(page.getByRole("button", { name: "Waiting for the chain" }).first()).toBeDisabled();
    await page.screenshot({ path: "qa/state-chain-down-1440.png" });
  } finally { try { process.kill(-(child.pid as number), "SIGTERM"); } catch { child.kill("SIGTERM"); } }
});
