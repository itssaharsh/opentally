import { test, expect } from "@playwright/test";

test("AC-10: Re-sum rebuilds 47 and 16,450 tUSD from the release records and matches the chain", async ({ page, request }) => {
  test.setTimeout(300_000);
  const reset = await request.post("/api/reset");
  expect(reset.ok(), await reset.text()).toBeTruthy();
  const { programme } = await reset.json();
  const run = await request.post(`/api/run?programme=${programme}`, { timeout: 200_000 });
  expect(await run.text()).toContain("47 connections released");
  await page.goto(`/?programme=${programme}`);
  await page.getByTestId("resum-open").click();
  await expect(page.getByTestId("resum-verdict")).toContainText("Matches the chain", { timeout: 30_000 });
  await expect(page.getByTestId("resum-rows")).toContainText("47");
  await expect(page.getByTestId("resum-rows")).toContainText("16,450 tUSD");
  await expect(page.getByText(/read directly from Local chain/)).toBeVisible();
  await page.screenshot({ path: "qa/resum-1440.png" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("resum-verdict")).toBeHidden();
  const csv = await request.get(`/api/resum?programme=${programme}&format=csv`);
  expect(csv.status()).toBe(200);
  expect((await csv.text()).split("\n").length).toBe(49); // header, 47 rows, trailing newline
});
