import { expect, test, type Page } from "@playwright/test";

const testAuthCookie = {
  name: "briefkompas_test_auth",
  value: "briefkompas_test_mode",
};

async function openAuthenticatedPage(page: Page, path: string) {
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
  await page.goto(path);
}

test.describe("WOO happy path", () => {
  test("afronden van de intake gaat zonder foutmelding naar overzicht en productkeuze", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/woo");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await answerInput.fill("Subsidies en communicatie over wijkprojecten in Amsterdam-Zuid.");
    await nextButton.click();

    await answerInput.fill("januari 2023 tot januari 2024");
    await nextButton.click();

    await answerInput.fill("emails, notulen, memo's en rapporten");
    await nextButton.click();

    await answerInput.fill("ja");
    await nextButton.click();

    await answerInput.fill("nee");
    await nextButton.click();

    await expect(page.getByText("Intake voltooid")).toBeVisible();
    await expect(page.getByRole("button", { name: "Naar Overzicht" })).toBeEnabled();
    await expect(page.getByText("Fout")).toHaveCount(0);

    await page.getByRole("button", { name: "Naar Overzicht" }).click();

    await expect(page).toHaveURL(/\/review\/woo$/);
    await expect(page.getByText("WOO-verzoek details")).toBeVisible();
    await expect(page.getByText("Fout")).toHaveCount(0);

    await page.getByRole("button", { name: "Ga naar productkeuze ->" }).click();

    await expect(page).toHaveURL(/\/pricing\/woo$/);
    await expect(page.getByText("Kies je pakket")).toBeVisible();
    await expect(page.getByText("Fout")).toHaveCount(0);
  });
});
