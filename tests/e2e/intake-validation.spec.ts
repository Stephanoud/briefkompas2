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

test.describe("Intake chat validation", () => {
  test("bezwaar categorie accepts natural language refusal descriptions", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/bezwaar");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await expect(page.getByText("Stap 1 van 5")).toBeVisible();

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await expect(page.getByText("Stap 2 van 5")).toBeVisible();
    await expect(page.getByText("Wat is de soort besluit?")).toBeVisible();

    await answerInput.fill("vergunning weigering");
    await nextButton.click();

    await expect(page.getByText("Stap 3 van 5")).toBeVisible();
    await expect(
      page.getByText("Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?")
    ).toBeVisible();
    await expect(page.getByText("Kies een categorie: boete, uitkering, belasting, vergunning of overig.")).toHaveCount(0);
  });

  test("clarifying question on period step does not advance to next question", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/woo");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await expect(page.getByText("Stap 1 van 6")).toBeVisible();

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await expect(page.getByText("Stap 2 van 6")).toBeVisible();
    await expect(page.getByText("Over welk onderwerp wil je documenten opvragen?")).toBeVisible();

    await answerInput.fill("Subsidies en communicatie over wijkprojecten in Amsterdam-Zuid.");
    await nextButton.click();

    await expect(page.getByText("Stap 3 van 6")).toBeVisible();
    await expect(page.getByText("Over welke periode wil je documenten?")).toBeVisible();

    await answerInput.fill("wat voldoet wel aan de voorwaarden?");
    await nextButton.click();

    await expect(
      page.getByText("Dit lijkt een vraag. Geef eerst een concreet antwoord op de huidige intakevraag.")
    ).toBeVisible();
    await expect(page.getByText("Stap 3 van 6")).toBeVisible();
    await expect(page.getByText("Welke soort documenten vermoed je dat bestaan?")).toHaveCount(0);

    await answerInput.fill("januari 2023 tot januari 2024");
    await nextButton.click();

    await expect(page.getByText("Stap 4 van 6")).toBeVisible();
    await expect(page.getByText("Welke soort documenten vermoed je dat bestaan?")).toBeVisible();
  });
});
