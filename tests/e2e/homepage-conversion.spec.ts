import { expect, test } from "@playwright/test";

const testAuthCookie = {
  name: "briefkompas_test_auth",
  value: "briefkompas_test_mode",
};

test.describe("Homepage trust and conversion structure", () => {
  test("toont hero, processtappen, voorbeeld en veilige trustpunten", async ({ page }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    await page.context().addCookies([
      {
        ...testAuthCookie,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Maak binnen enkele minuten een professioneel bezwaar- of beroepschrift",
      })
    ).toBeVisible();

    const cta = page.getByRole("link", { name: "Start met uw besluit" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/start-brief");

    await expect(page.getByRole("heading", { name: "Zo werkt het" })).toBeVisible();
    await expect(page.getByText("Upload uw besluit", { exact: true })).toBeVisible();
    await expect(page.getByText("Beantwoord enkele vragen", { exact: true })).toBeVisible();
    await expect(page.getByText("Controleer de analyse", { exact: true })).toBeVisible();
    await expect(page.getByText("Download uw conceptbrief", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Voorbeeld" })).toBeVisible();
    await expect(page.getByLabel("Geanonimiseerde voorbeeldbrief")).toBeVisible();

    await expect(page.getByText("Geen juridisch advies")).toBeVisible();
    await expect(page.getByText("U houdt volledige controle")).toBeVisible();
    await expect(page.getByText("Conceptbrief direct downloadbaar")).toBeVisible();
    await expect(page.getByText("Geschikt voor bezwaar en beroep")).toBeVisible();

    const pageText = (await page.locator("body").innerText()).toLowerCase();
    expect(pageText).not.toContain("slagingskans");
    expect(pageText).not.toContain("kans van slagen");
  });
});
