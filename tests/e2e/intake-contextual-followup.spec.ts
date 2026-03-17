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

test.describe("Contextual intake follow-up", () => {
  test("bezwaar intake herijkt de bestuursorgaanvraag bij een geweigerde vergunning", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/bezwaar");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Ik wil een geweigerde vergunning laten herzien");
    await nextButton.click();

    await expect(page.getByText("Welk bestuursorgaan heeft de vergunning geweigerd of afgewezen?")).toBeVisible();
    await expect(
      page.getByText("Wat is de soort besluit? (Kies een: boete, uitkering, belasting, vergunning, overig)")
    ).toHaveCount(0);
  });

  test("bezwaar intake slaat bekende context over en gaat door naar de gronden", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/bezwaar");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Ik wil een geweigerde vergunning laten herzien");
    await nextButton.click();

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await expect(page.getByText("Waarom ben je het niet eens met de weigering of afwijzing van de vergunning?")).toBeVisible();
    await expect(page.getByText("Wat wil je bereiken met dit bezwaar?")).toHaveCount(0);
  });
});
