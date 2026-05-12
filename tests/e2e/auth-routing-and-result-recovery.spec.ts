import { expect, test } from "@playwright/test";

test.describe("Auth routing and result recovery", () => {
  test("alleen de homepagina vereist login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?next=%2F/);

    await page.goto("/intake/woo");
    await expect(page).toHaveURL(/\/intake\/woo$/);
    await expect(page.getByText("Stap 1 van 6")).toBeVisible();
  });

  test("resultaatpagina herstelt de brief uit sessionStorage", async ({ page }) => {
    await page.addInitScript(
      ({ intake, storedLetter }) => {
        window.sessionStorage.setItem("briefkompas_intake", JSON.stringify(intake));
        window.sessionStorage.setItem("briefkompas_generated_letter", JSON.stringify(storedLetter));
      },
      {
        intake: {
          flow: "woo",
          bestuursorgaan: "Gemeente Amsterdam",
          wooOnderwerp: "Subsidies en wijkprojecten",
          wooPeriode: "januari 2023 tot januari 2024",
          wooDocumenten: "emails en notulen",
          files: {},
        },
        storedLetter: {
          flow: "woo",
          letter: {
            letterText: "Geacht bestuursorgaan,\n\nHierbij verzoek ik u om openbaarmaking van documenten.",
            references: [],
            generationMode: "validated",
            guardReasons: [],
          },
        },
      }
    );

    await page.goto("/result/woo");

    await expect(page.getByRole("heading", { name: "Je WOO-verzoek" })).toBeVisible();
    await expect(page.getByText("Hierbij verzoek ik u om openbaarmaking van documenten.")).toBeVisible();
    await expect(page.getByText("Geen brief gegenereerd.")).toHaveCount(0);
  });

  test("tijdelijke herstel-link bewaart en herstelt de gegenereerde brief", async ({ page }) => {
    const letterText =
      "Geacht college,\n\nDit is een testbrief voor tijdelijke opslag en herstel.\n\nHoogachtend,";

    await page.addInitScript(
      ({ intake, storedLetter }) => {
        window.sessionStorage.setItem("briefkompas_product", "basis");
        window.sessionStorage.setItem("briefkompas_intake", JSON.stringify(intake));
        window.sessionStorage.setItem("briefkompas_generated_letter", JSON.stringify(storedLetter));
      },
      {
        intake: {
          flow: "woo",
          bestuursorgaan: "Gemeente Amsterdam",
          wooOnderwerp: "Subsidies en wijkprojecten",
          wooPeriode: "januari 2023 tot januari 2024",
          wooDocumenten: "emails en notulen",
          files: {},
        },
        storedLetter: {
          flow: "woo",
          letter: {
            letterText,
            references: [],
            generationMode: "validated",
            guardReasons: [],
          },
        },
      }
    );

    await page.goto("/result/woo");
    await page.getByRole("button", { name: "Bewaar mijn brief", exact: true }).click();

    await expect(page.getByText("Je brief is tijdelijk opgeslagen.")).toBeVisible();
    const restoreUrl = await page
      .locator("p")
      .filter({ hasText: "/recover/" })
      .last()
      .textContent();

    expect(restoreUrl).toBeTruthy();

    await page.goto(restoreUrl!.trim());
    await expect(page.getByText("Je brief is teruggevonden.")).toBeVisible();
    await expect(page.getByText("Dit is een testbrief voor tijdelijke opslag en herstel.")).toBeVisible();

    await page.getByRole("button", { name: "Verder met deze brief" }).click();

    await expect(page).toHaveURL(/\/result\/woo$/);
    await expect(page.getByText("Dit is een testbrief voor tijdelijke opslag en herstel.")).toBeVisible();
  });

  test("productkeuze blijft behouden na reload van productpagina", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("briefkompas_product", "uitgebreid");
      window.sessionStorage.setItem(
        "briefkompas_intake",
        JSON.stringify({
          flow: "woo",
          bestuursorgaan: "Gemeente Amsterdam",
          wooOnderwerp: "Subsidies en wijkprojecten",
          wooPeriode: "januari 2023 tot januari 2024",
          wooDocumenten: "emails en notulen",
          files: {},
        })
      );
    });

    await page.goto("/pricing/woo");

    await expect(page.getByRole("button", { name: "Geselecteerd" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Uitgebreid" })).toBeVisible();
  });

  test("betaling of testversie vereist een e-mailadres voor toezending", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("briefkompas_product", "basis");
      window.sessionStorage.setItem(
        "briefkompas_intake",
        JSON.stringify({
          flow: "woo",
          bestuursorgaan: "Gemeente Amsterdam",
          wooOnderwerp: "Subsidies en wijkprojecten",
          wooPeriode: "januari 2023 tot januari 2024",
          wooDocumenten: "emails en notulen",
          files: {},
        })
      );
    });

    await page.goto("/pricing/woo");

    await expect(page.getByLabel("E-mailadres")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ga naar betaling" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Verder naar test versie" })).toBeDisabled();

    await page.getByLabel("E-mailadres").fill("geen-mailadres");
    await expect(page.getByRole("button", { name: "Ga naar betaling" })).toBeEnabled();
    await page.getByRole("button", { name: "Ga naar betaling" }).click();

    await expect(page.getByText("Vul een geldig e-mailadres in.")).toBeVisible();

    await page.getByLabel("E-mailadres").fill("gebruiker@example.nl");
    await expect(page.getByRole("button", { name: "Verder naar test versie" })).toBeEnabled();
  });

  test("productkeuze blokkeert betaling als basisinformatie ontbreekt", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("briefkompas_product", "basis");
      window.sessionStorage.setItem("briefkompas_delivery_email", "gebruiker@example.nl");
      window.sessionStorage.setItem(
        "briefkompas_intake",
        JSON.stringify({
          flow: "woo",
          bestuursorgaan: "Gemeente Amsterdam",
          wooOnderwerp: "Subsidies en wijkprojecten",
          wooPeriode: "januari 2023 tot januari 2024",
          files: {},
        })
      );
    });

    await page.goto("/pricing/woo");

    await expect(page.getByText(/Productkeuze geblokkeerd/)).toBeVisible();
    await expect(page.getByText(/Gevraagde Woo-documenten/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Ga naar betaling" })).toHaveCount(0);
  });

  test("bij generatie-fout kan gebruiker terug zonder productkeuze te verliezen", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("briefkompas_product", "basis");
      window.sessionStorage.setItem("briefkompas_delivery_email", "test@example.nl");
      window.sessionStorage.setItem(
        "briefkompas_intake",
        JSON.stringify({
          flow: "woo",
          bestuursorgaan: "Gemeente Amsterdam",
          wooOnderwerp: "Subsidies en wijkprojecten",
          wooPeriode: "januari 2023 tot januari 2024",
          wooDocumenten: "emails en notulen",
          files: {},
        })
      );
    });

    await page.route("**/api/generate-letter", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Testfout bij genereren" }),
      });
    });

    await page.goto("/generate/woo");

    await expect(page.getByText("Testfout bij genereren")).toBeVisible();
    await expect(page.getByText("Je intake en pakketkeuze blijven bewaard in deze sessie.")).toBeVisible();

    await page.getByRole("button", { name: "Terug naar productkeuze" }).click();

    await expect(page).toHaveURL(/\/pricing\/woo$/);
    await expect(page.getByRole("button", { name: "Geselecteerd" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Basis", exact: true })).toBeVisible();
  });
});
