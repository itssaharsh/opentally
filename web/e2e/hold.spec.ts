import { test, expect } from "@playwright/test";

async function runRelease(request: import("@playwright/test").APIRequestContext) {
  const reset = await request.post("/api/reset");
  expect(reset.ok(), await reset.text()).toBeTruthy();
  const { programme } = await reset.json();
  const res = await request.post(`/api/run?programme=${programme}`, { timeout: 200_000 });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.text();
  expect(body).toContain("47 connections released");
  return programme as string;
}

test("AC-11 and AC-12: a held clone shows both traces and its reason; lifting it lets one more release", async ({ page, request }) => {
  test.setTimeout(300_000);
  const programme = await runRelease(request);
  await page.goto(`/connection/33?programme=${programme}`); // C-B14
  await expect(page.getByRole("heading", { name: "Connection C-B14" })).toBeVisible();
  await expect(page.getByTestId("hold-reason")).toContainText("identical to C-B07's, point for point");
  await expect(page.getByRole("img", { name: /C-B14 and C-B07 have identical daily consumption/ })).toBeVisible();
  await expect(page.getByText("matches this trace")).toBeVisible();
  await page.screenshot({ path: "qa/s2-held-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Lift hold" }).click();
  await expect(page.getByTestId("hold-note")).toContainText("Hold lifted on the chain", { timeout: 60_000 });
  await expect(page.getByTestId("connection-state")).toContainText("Eligible", { timeout: 30_000 });
  await page.goto(`/?programme=${programme}`);
  await expect(page.getByTestId("paid-count")).toHaveText(/47 of 50 paid/);
  await page.getByTestId("release-lifted").click();
  await expect(page.getByTestId("paid-count")).toHaveText(/48 of 50 paid/, { timeout: 60_000 });
});

test("the rule page and the about page render, and an unknown connection gets the designed 404", async ({ page }) => {
  await page.goto("/rule");
  await expect(page.getByRole("heading", { name: "The rule the contract runs" })).toBeVisible();
  await expect(page.getByText("chosen by this team")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who holds which key" })).toBeVisible();
  await page.screenshot({ path: "qa/s3-rule-1440.png", fullPage: true });
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Mini-grid grants released by one public rule." })).toBeVisible();
  await page.screenshot({ path: "qa/s4-about-1440.png", fullPage: true });
  const r = await page.goto("/connection/999");
  expect(r?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
});
