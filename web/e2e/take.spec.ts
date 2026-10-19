import { test, expect } from "@playwright/test";
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

// A screen recording of the demo path. Runs only when TAKE_OUT names the output file (kept outside the repository).
const out = process.env.TAKE_OUT;
test.skip(!out, "set TAKE_OUT=<file.webm> to record a take");
test.use({ viewport: { width: 1440, height: 900 }, video: { mode: "on", size: { width: 1440, height: 900 } } });

test("take: first screen, release, receipt, held connection", async ({ page, request }, info) => {
  test.setTimeout(300_000);
  const reset = await request.post("/api/reset");
  expect(reset.ok(), await reset.text()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByTestId("paid-count")).toHaveText(/0 of 50 paid/);
  await page.waitForTimeout(6000); // hold the first screen
  await page.getByRole("button", { name: "Run month 4 release" }).first().click();
  await expect(page.getByTestId("paid-count")).toHaveText(/47 of 50 paid/, { timeout: 180_000 });
  await page.waitForTimeout(2500);
  await page.getByTestId("receipt").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(6000); // hold the receipt and the step list
  await page.getByTestId("cell-C-B14").click();
  await page.waitForTimeout(4000);
  await page.close();
  const video = page.video();
  if (video && out) {
    const src = await video.path();
    mkdirSync(path.dirname(out), { recursive: true });
    copyFileSync(src, out);
    info.annotations.push({ type: "take", description: out });
  }
});
