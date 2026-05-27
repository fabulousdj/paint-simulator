import { test, expect } from "@playwright/test";

test("app loads and shows ChromaMatch title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ChromaMatch/);
  await expect(page.getByRole("heading", { name: "ChromaMatch" })).toBeVisible();
  await expect(page.getByText("Upload room photo")).toBeVisible();
  await expect(page.getByText("JPG, PNG, or WebP - photos stay in your browser")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current paint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Target paint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dev samples" })).toBeVisible();
  await expect(page.getByText("Local browser processing: enabled. Photos are not uploaded.")).toBeVisible();
  await expect(page.getByText(/Browser QA blocked until Node 20.x LTS/)).toBeVisible();
});
