import { test, expect } from "@playwright/test";

test("AC-7 and AC-8: the first screen, then the month 4 release lights 47 cells and shows the receipt", async ({ page, request }) => {
  const reset = await request.post("/api/reset");
  expect(reset.ok(), await reset.text()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByTestId("paid-count")).toHaveText(/0 of 50 paid/);
  await expect(page.getByTestId("escrow")).toHaveText("17,500");
  const run = page.getByRole("button", { name: "Run month 4 release" }).first();
  await expect(run).toBeVisible();
  await run.click();
  await expect(page.getByTestId("steps")).toContainText("Verifying 50 site-signed summaries");
  await expect(page.getByTestId("steps")).toContainText("rejected by the contract", { timeout: 90_000 });
  await expect(page.getByTestId("steps")).toContainText("3 held", { timeout: 90_000 });
  await expect(page.getByTestId("steps")).toContainText("47 eligible", { timeout: 90_000 });
  await expect(page.getByTestId("paid-count")).toHaveText(/47 of 50 paid/, { timeout: 150_000 });
  await expect(page.getByTestId("escrow")).toHaveText("1,050", { timeout: 10_000 });
  await expect(page.getByTestId("receipt").first()).toContainText("47 connections");
  await expect(page.getByTestId("receipt").first()).toContainText("16,450 tUSD");
  await expect(page.getByTestId("cell-C-B14")).toHaveAttribute("data-state", "held");
  await expect(page.getByTestId("cell-C-C03")).toHaveAttribute("data-state", "held");
  await expect(page.getByTestId("cell-C-A01")).toHaveAttribute("data-state", "paid");
  await expect(page.getByRole("button", { name: /Released 47, held 3/ }).first()).toBeVisible();
  await page.screenshot({ path: "qa/s1-released-1440.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "qa/s1-released-390.png", fullPage: true });
});

test("first screen before any run, at both sizes", async ({ page, request }) => {
  const reset = await request.post("/api/reset");
  expect(reset.ok(), await reset.text()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByTestId("paid-count")).toHaveText(/0 of 50 paid/);
  await page.screenshot({ path: "qa/s1-first-1440.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("paid-count")).toHaveText(/0 of 50 paid/);
  await page.screenshot({ path: "qa/s1-first-390.png" });
});
