import { expect, test } from "@playwright/test";

test.describe("Test login", () => {
  test("successful login redirects to start-brief with a GET request", async ({ page }) => {
    await page.goto("/login?next=/start-brief");

    await page.getByLabel("Inlognaam").fill("briefkompas");
    await page.getByLabel("Wachtwoord").fill("briefkompas");
    await page.getByRole("button", { name: "Verder naar de site" }).click();

    await expect(page).toHaveURL(/\/start-brief$/);
    await expect(page.getByRole("heading", { name: "Start je brief" })).toBeVisible();
  });

  test("successful login redirects to the requested start page with a GET request", async ({ page }) => {
    await page.goto("/login?next=/start-bezwaar");

    await page.getByLabel("Inlognaam").fill("briefkompas");
    await page.getByLabel("Wachtwoord").fill("briefkompas");
    await page.getByRole("button", { name: "Verder naar de site" }).click();

    await expect(page).toHaveURL(/\/start-bezwaar$/);
    await expect(page.getByRole("heading", { name: "Bezwaarschrift Opstellen" })).toBeVisible();
  });
});
