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
          "Beslissing op bezwaar tegen aanwijzing ex artikel 1:75 Wft aan Aegon Bank N.V. In bezwaar heeft AEB aangevoerd dat het primaire besluit moet worden herroepen omdat openbaarmaking van de aanwijzing onjuist en onevenredig is. De Nederlandsche Bank heeft het bezwaar ongegrond verklaard.",
        analysisSource: "image",
        documentType: "beslissing op bezwaar",
        decisionAnalysis: {
          bestuursorgaan: "De Nederlandsche Bank (DNB)",
          onderwerp: "Beslissing op bezwaar tegen aanwijzing ex artikel 1:75 Wft",
          besluitInhoud:
            "In bezwaar heeft AEB aangevoerd dat het primaire besluit moet worden herroepen omdat openbaarmaking van de aanwijzing onjuist en onevenredig is. De Nederlandsche Bank heeft het bezwaar ongegrond verklaard.",
          termijnen: "Zes weken termijn voor aanvulling motivering beroepschrift.",
        },
        analysisStatus: "read",
        readability: "high",
      }),
    });
  });
}

async function mockTraceDecisionExtraction(page: Page) {
  await page.route("**/api/extract-decision-meta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        extracted: true,
        datumBesluit: "februari 2017",
        kenmerk: "BK-TRACE-2017",
        samenvatting:
          "Het Trac\u00e9besluit A12/A15 Ressen-Oudbroeken regelt wijziging en nieuwe aanleg van Rijkswegen.",
        extractedText:
          "Trac\u00e9besluit. Wijziging en nieuwe aanleg Rijkswegen A12 en A15 tussen knooppunten Valburg en Oudbroeken.",
        analysisSource: "pdf",
        documentType: "trac\u00e9besluit",
        decisionAnalysis: {
          bestuursorgaan: "Minister van Infrastructuur en Milieu",
          onderwerp:
            "Wijziging en nieuwe aanleg Rijkswegen A12 en A15 tussen knooppunten Valburg en Oudbroeken",
          besluitInhoud:
            "Het Trac\u00e9besluit A12/A15 Ressen-Oudbroeken regelt wijziging en nieuwe aanleg van Rijkswegen.",
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
  await expect(page.getByRole("button", { name: "[✓ Juist]" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "[✗ Onjuist]" }).first()).toBeVisible();

  const confirmButtons = page.getByRole("button", { name: "[✓ Juist]" });
  for (let index = 0; index < 20; index += 1) {
    if ((await confirmButtons.count()) === 0) {
      break;
    }

    await confirmButtons.first().click();
  }

  await expect(confirmButtons).toHaveCount(0);
  await expect(page.getByPlaceholder("Typ je antwoord...")).toBeVisible();
}

test.describe("Contextual intake follow-up", () => {
  test("bezwaar intake gebruikt documentcontext en slaat bekende bestuursorgaanvraag over", async ({ page }) => {
    await mockDecisionExtraction(page, "Gemeente Amsterdam");
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    await expect(
      page.getByText("Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?")
    ).toBeVisible();
    await expect(page.getByText(/Tegen welk bestuursorgaan richt je het bezwaar/)).toHaveCount(0);
    await expect(page.getByText(/(Wat is de soort besluit|Om wat voor besluit gaat het precies)/)).toHaveCount(0);
  });

  test("bezwaar intake gebruikt vergunningcontext voor doel- en grondenvraag", async ({ page }) => {
    await mockDecisionExtraction(page);
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await answerInput.fill("Gemeente Amsterdam");
    await nextButton.click();

    await expect(
      page.getByText("Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?")
    ).toBeVisible();

    await answerInput.fill("Ik wil een geweigerde vergunning laten herzien");
    await nextButton.click();

    await expect(page.getByText("Waarom ben je het niet eens met de weigering of afwijzing van de vergunning?")).toBeVisible();
    await expect(page.getByText("Wat wil je bereiken met dit bezwaar?")).toHaveCount(0);
  });

  test("bevestigde metadata voorkomt een categorievraag over informatie uit het besluit", async ({ page }) => {
    await mockDecisionExtraction(page, "Gemeente Amsterdam");
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    await expect(
      page.getByText("Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?")
    ).toBeVisible();
    await expect(page.getByText("Je kunt ook korte doelen gebruiken, zoals: intrekken, herzien of aanpassen.")).toBeVisible();
    await expect(page.getByText(/(Wat is de soort besluit|Om wat voor besluit gaat het precies)/)).toHaveCount(0);
  });

  test("bevestigde tracebesluit-metadata voorkomt de soort-besluitvraag uit de screenshot", async ({ page }) => {
    await mockTraceDecisionExtraction(page);
    await openAuthenticatedPage(page, "/intake/bezwaar");
    await uploadMockDecision(page);

    await expect(page.getByText("Vul in om wat voor besluit het gaat")).toHaveCount(0);
    await expect(page.getByText(/Om wat voor besluit gaat het precies/)).toHaveCount(0);
    await expect(page.getByText("Wat wil je bereiken met dit bezwaar?")).toBeVisible();
  });

  test("bevestigde Wft-metadata voorkomt categorie- en eerdere-bezwaargrondvragen", async ({ page }) => {
    await mockWftDecisionExtraction(page);
    await openAuthenticatedPage(page, "/intake/beroep_na_bezwaar");
    await uploadMockDecision(page);

    await expect(page.getByText(/Om wat voor soort zaak gaat het/)).toHaveCount(0);
    await expect(page.getByText("Welke hoofdpunten had je al in bezwaar aangevoerd?")).toHaveCount(0);
    await expect(
      page.getByText("Wat heeft het bestuursorgaan in de beslissing op bezwaar volgens jou nog steeds niet goed uitgelegd of meegewogen?")
    ).toBeVisible();
  });

  test("eerdere bezwaargronden uit de beslissing op bezwaar worden niet opnieuw gevraagd", async ({ page }) => {
    await mockWftDecisionExtraction(page);
    await openAuthenticatedPage(page, "/intake/beroep_na_bezwaar");
    await uploadMockDecision(page);

    const answerInput = page.getByPlaceholder("Typ je antwoord...");
    const nextButton = page.getByRole("button", { name: "Volgende" });

    await expect(
      page.getByText("Wat heeft het bestuursorgaan in de beslissing op bezwaar volgens jou nog steeds niet goed uitgelegd of meegewogen?")
    ).toBeVisible();
    await expect(page.getByText("Welke hoofdpunten had je al in bezwaar aangevoerd?")).toHaveCount(0);

    await answerInput.fill(
      "DNB heeft nog steeds onvoldoende uitgelegd waarom publicatie evenredig is, waarom openbaarmaking noodzakelijk zou zijn en waarom minder ingrijpende maatregelen niet volstaan."
    );
    await nextButton.click();

    await expect(page.getByText("Wat wil je dat de rechtbank doet met de beslissing op bezwaar?")).toBeVisible();
  });
});
