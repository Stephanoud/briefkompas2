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
});
