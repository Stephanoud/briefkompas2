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

async function mockDecisionExtraction(page: Page, bestuursorgaan?: string) {
  await page.route("**/api/extract-decision-meta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        extracted: true,
        datumBesluit: "1 april 2026",
        kenmerk: "BK-2026-002",
        samenvatting: "Afwijzing van een omgevingsvergunning.",
        extractedText: "Uw aanvraag voor een omgevingsvergunning is afgewezen.",
        analysisSource: "image",
        documentType: "beschikking",
        decisionAnalysis: {
          bestuursorgaan,
          onderwerp: "Omgevingsvergunning",
          besluitInhoud: "De gevraagde omgevingsvergunning is geweigerd.",
        },
        analysisStatus: "read",
        readability: "high",
      }),
    });
  });
}

async function mockWftDecisionExtraction(page: Page) {
  await page.route("**/api/extract-decision-meta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        extracted: true,
        datumBesluit: "10 maart 2026",
        kenmerk: "BK-2026-WFT",
        samenvatting:
          "Beslissing op bezwaar tegen een aanwijzing ex artikel 1:75 Wft aan Aegon Bank N.V.",
        extractedText:
          "Beslissing op bezwaar tegen aanwijzing ex artikel 1:75 Wft aan Aegon Bank N.V. De Nederlandsche Bank heeft het bezwaar ongegrond verklaard.",
        analysisSource: "image",
        documentType: "beslissing op bezwaar",
        decisionAnalysis: {
          bestuursorgaan: "De Nederlandsche Bank (DNB)",
          onderwerp: "Beslissing op bezwaar tegen aanwijzing ex artikel 1:75 Wft",
          besluitInhoud:
            "De Nederlandsche Bank heeft het bezwaar tegen een aanwijzing ex artikel 1:75 Wft ongegrond verklaard.",
          termijnen: "Zes weken termijn voor aanvulling motivering beroepschrift.",
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
  await expect(page.getByPlaceholder("Typ je antwoord...")).toBeVisible();
}

test.describe("Contextual intake follow-up", () => {
  test("bezwaar intake gebruikt documentcontext en slaat bekende bestuursorgaanvraag over", async ({ page }) => {
    await mockDecisionExtraction(page, "Gemeente Amsterdam");
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    await expect(page.getByText(/(Wat is de soort besluit|Om wat voor besluit gaat het precies)/)).toBeVisible();
    await expect(page.getByText(/Tegen welk bestuursorgaan richt je het bezwaar/)).toHaveCount(0);
  });

  test("bezwaar intake gebruikt vergunningcontext voor doel- en grondenvraag", async ({ page }) => {
    await mockDecisionExtraction(page);
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await answerInput.fill("vergunning weigering");
    await nextButton.click();

    await expect(
      page.getByText("Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?")
    ).toBeVisible();

    await answerInput.fill("Ik wil een geweigerde vergunning laten herzien");
    await nextButton.click();

    await expect(page.getByText("Waarom ben je het niet eens met de weigering of afwijzing van de vergunning?")).toBeVisible();
    await expect(page.getByText("Wat wil je bereiken met dit bezwaar?")).toHaveCount(0);
  });

  test("documentverwijzing vult de categorievraag uit de brief in", async ({ page }) => {
    await mockDecisionExtraction(page, "Gemeente Amsterdam");
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await expect(page.getByText(/(Wat is de soort besluit|Om wat voor besluit gaat het precies)/)).toBeVisible();

    await answerInput.fill("haal dat uit de brief");
    await nextButton.click();

    await expect(
      page.getByText("Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?")
    ).toBeVisible();
    await expect(page.getByText("Je kunt ook korte doelen gebruiken, zoals: intrekken, herzien of aanpassen.")).toBeVisible();
  });

  test("documentverwijzing vult Wft-categorie als overig in bij beroep na bezwaar", async ({ page }) => {
    await mockWftDecisionExtraction(page);
    await openAuthenticatedPage(page, "/intake/beroep_na_bezwaar");
    await uploadMockDecision(page);

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await expect(page.getByText(/Om wat voor soort zaak gaat het/)).toBeVisible();

    await answerInput.fill("zoek dat in het document");
    await nextButton.click();

    await expect(page.getByText("Welke hoofdpunten had je al in bezwaar aangevoerd?")).toBeVisible();
    await expect(page.getByText("Stap 4 van 7")).toBeVisible();
  });
});
