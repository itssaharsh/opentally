import { test, expect } from "@playwright/test";

test("two visitors each get their own programme; a pinned URL keeps the first visitor's result", async ({ browser, request }) => {
  for (let i = 0; i < 2; i++) { const r = await request.post("/api/reset"); expect(r.ok(), await r.text()).toBeTruthy(); }

  const a = await browser.newPage();
  await a.goto("/");
  await expect(a.getByTestId("paid-count")).toHaveText(/0 of 50 paid/);
  const programmeA = await a.getByTestId("programme").getAttribute("data-address");
  expect(programmeA).toMatch(/^0x/);
  await a.getByRole("button", { name: "Run month 4 release" }).first().click();
  await expect(a).toHaveURL(new RegExp(`programme=${programmeA}`, "i"));
  // the server has taken the run once the first step reports back
  await expect(a.getByTestId("steps")).toContainText("rejected by the contract", { timeout: 60_000 });

  const b = await browser.newPage();
  await b.goto("/");
  await expect(b.getByTestId("paid-count")).toHaveText(/0 of 50 paid/);
  const programmeB = await b.getByTestId("programme").getAttribute("data-address");
  expect(programmeB?.toLowerCase()).not.toBe(programmeA?.toLowerCase());

  await expect(a.getByTestId("paid-count")).toHaveText(/47 of 50 paid/, { timeout: 180_000 });
  await a.reload();
  await expect(a.getByTestId("paid-count")).toHaveText(/47 of 50 paid/);

  const again = await request.post(`/api/run?programme=${programmeA}`);
  expect(again.status()).toBe(409);
});
