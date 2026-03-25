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
            generationMode: "static_fallback",
            guardReasons: [],
          },
        },
      }
    );

    await page.goto("/result/woo");

    await expect(page.getByRole("heading", { name: "Je brief" })).toBeVisible();
    await expect(page.getByText("Hierbij verzoek ik u om openbaarmaking van documenten.")).toBeVisible();
    await expect(page.getByText("Geen brief gegenereerd.")).toHaveCount(0);
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

  test("bij generatie-fout kan gebruiker terug zonder productkeuze te verliezen", async ({ page }) => {
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
