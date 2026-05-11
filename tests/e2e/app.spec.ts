import { test, expect } from "@playwright/test";

test("app loads and shows ChromaMatch title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ChromaMatch/);
});
