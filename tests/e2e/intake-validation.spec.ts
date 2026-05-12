import { expect, test, type Page } from "@playwright/test";

const testAuthCookie = {
  name: "briefkompas_test_auth",
  value: "briefkompas_test_mode",
};
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nXx8AAAAASUVORK5CYII=",
  "base64"
);

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

async function mockDecisionExtraction(page: Page) {
  await page.route("**/api/extract-decision-meta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        extracted: true,
        datumBesluit: "1 april 2026",
        kenmerk: "BK-2026-001",
        samenvatting: "Afwijzing van een aanvraag.",
        extractedText: "Uw aanvraag is afgewezen.",
        analysisSource: "image",
        documentType: "beschikking",
        decisionAnalysis: {
          onderwerp: "Aanvraag",
          besluitInhoud: "De gevraagde aanvraag is geweigerd.",
        },
        analysisStatus: "read",
        readability: "high",
      }),
    });
  });
}

async function uploadMockDecision(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "besluit.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  await expect(page.getByText(/Bestand ontvangen/)).toBeVisible();
  await expect(page.getByText("Controleer gegevens uit het besluit")).toBeVisible();

  const confirmButtons = page.getByRole("button", { name: "Juist" });
  for (let index = 0; index < 20; index += 1) {
    if ((await confirmButtons.count()) === 0) {
      break;
    }

    await confirmButtons.first().click();
  }

  await expect(confirmButtons).toHaveCount(0);
  await expect(page.getByPlaceholder("Typ je antwoord...")).toBeVisible();
}

test.describe("Intake chat validation", () => {
  test("bezwaar categorie accepts natural language refusal descriptions", async ({ page }) => {
    await mockDecisionExtraction(page);
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await expect(page.getByText(/Tegen welk bestuursorgaan richt je het bezwaar/)).toBeVisible();

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await expect(page.getByText(/(Wat is de soort besluit|Om wat voor besluit gaat het precies)/)).toBeVisible();

    await answerInput.fill("vergunning weigering");
    await nextButton.click();

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

    await expect(page.getByText(/Ik help je daar graag kort bij\./)).toBeVisible();
    await expect(page.getByText("Stap 3 van 6")).toBeVisible();
    await expect(page.getByText("Welke soort documenten vermoed je dat bestaan?")).toHaveCount(0);

    await answerInput.fill("januari 2023 tot januari 2024");
    await nextButton.click();

    await expect(page.getByText("Stap 4 van 6")).toBeVisible();
    await expect(page.getByText("Welke soort documenten vermoed je dat bestaan?")).toBeVisible();
  });

  test("summier woo-onderwerp vraagt eerst om inhoudelijke concretisering", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/woo");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await expect(page.getByText("Stap 2 van 6")).toBeVisible();

    await answerInput.fill("subsidies");
    await nextButton.click();

    await expect(page.getByText("Stap 2 van 6")).toBeVisible();
    await expect(page.getByText("Ik wil eerst scherper krijgen wat je precies zoekt over subsidies.")).toBeVisible();
    await expect(page.getByText("Over welke periode wil je documenten?")).toHaveCount(0);

    await page.getByRole("button", { name: "interne e-mails en afstemming" }).click();
    await nextButton.click();

    await expect(page.getByText("Stap 3 van 6")).toBeVisible();
    await expect(page.getByText("Over welke periode wil je documenten?")).toBeVisible();
  });

  test("natural language period answer advances without repeating the same question", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/woo");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await answerInput.fill("Subsidies en communicatie over wijkprojecten in Amsterdam-Zuid.");
    await nextButton.click();

    await expect(page.getByText("Stap 3 van 6")).toBeVisible();
    await answerInput.fill("laatste twee jaar");
    await nextButton.click();

    await expect(page.getByText("Stap 4 van 6")).toBeVisible();
    await expect(page.getByText("Welke soort documenten vermoed je dat bestaan?")).toBeVisible();
    await expect(page.getByText("Over welke periode wil je documenten?")).toHaveCount(1);
  });

  test("period answer about corona is normalized via confirmation before advancing", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/woo");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await answerInput.fill("Subsidies en communicatie over wijkprojecten in Amsterdam-Zuid.");
    await nextButton.click();

    await expect(page.getByText("Stap 3 van 6")).toBeVisible();
    await answerInput.fill("ongeveer sinds corona");
    await nextButton.click();

    await expect(page.getByText("Helder, dan ga ik uit van ongeveer 2020 tot heden. Klopt dat?")).toBeVisible();

    await answerInput.fill("ja");
    await nextButton.click();

    await expect(page.getByText("Stap 4 van 6")).toBeVisible();
    await expect(page.getByText("Welke soort documenten vermoed je dat bestaan?")).toBeVisible();
  });

  test("after two failed attempts on the same period info, intake moves to the next dimension", async ({ page }) => {
    await openAuthenticatedPage(page, "/intake/woo");

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await answerInput.fill("Subsidies en communicatie over wijkprojecten in Amsterdam-Zuid.");
    await nextButton.click();

    await expect(page.getByText("Stap 3 van 6")).toBeVisible();

    await answerInput.fill("recent");
    await nextButton.click();

    await expect(page.getByText(/Ik probeer je antwoord beter te plaatsen in de intake\./)).toBeVisible();
    await expect(page.getByText("Stap 3 van 6")).toBeVisible();

    await answerInput.fill("recent");
    await nextButton.click();

    await expect(page.getByText("Ik laat dit punt heel even open en pak eerst het volgende onderdeel.")).toBeVisible();
    await expect(page.getByText("Stap 4 van 6")).toBeVisible();
    await expect(page.getByText("Welke soort documenten vermoed je dat bestaan?")).toBeVisible();
  });
});
