import { test, expect } from "@playwright/test";

test("start screen shows both modes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CollabView" })).toBeVisible();
  await expect(page.getByRole("button", { name: "配信者として開始" })).toBeVisible();
  await expect(page.getByRole("button", { name: "参加者として開始" })).toBeVisible();
});
