import { expect, test, type Page } from "@playwright/test";
import { buildDossierQualityCheck, DOSSIER_CHECK_DISCLAIMER } from "@/lib/dossier-quality-check";
import { IntakeFormData } from "@/types";

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

const baseIntake: IntakeFormData = {
  flow: "bezwaar",
  bestuursorgaan: "Gemeente Groningen",
  datumBesluit: "12 mei 2026",
  categorie: "vergunning",
  doel: "aanpassing van het besluit",
  gronden:
    "Op 20 mei 2026 heb ik foto's gemaakt van de situatie. In bijlage 1 staat een rapport waaruit blijkt dat de uitrit anders kan worden aangelegd. Het besluit noemt mijn aanvraag en het perceel, maar gaat niet in op de ingediende tekening.",
  persoonlijkeOmstandigheden:
    "Ik ben eigenaar en bewoner van de woning naast het perceel en word direct geraakt door de nieuwe uitrit.",
  files: {
    besluit: {
      name: "besluit.pdf",
      size: 1000,
      type: "application/pdf",
      path: "blob:besluit",
    },
    bijlagen: [
      {
        name: "rapport.pdf",
        size: 1200,
        type: "application/pdf",
        path: "blob:rapport",
      },
      {
        name: "foto.pdf",
        size: 900,
        type: "application/pdf",
        path: "blob:foto",
      },
    ],
  },
};

test.describe("Dossier quality check", () => {
  test("scoort een concreet dossier overwegend groen zonder juridische conclusies", () => {
    const check = buildDossierQualityCheck(baseIntake, new Date(2026, 4, 25));

    expect(check.items.find((item) => item.category === "termijn")?.label).toBe("Waarschijnlijk op tijd");
    expect(check.items.find((item) => item.category === "belanghebbendheid")?.label).toBe("Lijkt aanwezig");
    expect(check.items.find((item) => item.category === "bewijsstukken")?.level).toBe("green");
    expect(check.disclaimer).toBe(DOSSIER_CHECK_DISCLAIMER);
  });

  test("maakt beperkte onderbouwing en weinig bewijs zichtbaar", () => {
    const check = buildDossierQualityCheck(
      {
        ...baseIntake,
        datumBesluit: "12 maart 2026",
        gronden: "Ik ben het er niet mee eens.",
        persoonlijkeOmstandigheden: "",
        files: {},
      },
      new Date(2026, 5, 9)
    );

    expect(check.items.find((item) => item.category === "termijn")?.level).toBe("red");
    expect(check.items.find((item) => item.category === "belanghebbendheid")?.level).toBe("red");
    expect(check.items.find((item) => item.category === "onderbouwing")?.label).toBe("Weinig concreet");
    expect(check.items.find((item) => item.category === "bewijsstukken")?.label).toBe("Weinig ondersteuning");
  });

  test("vermijdt verboden juridische voorspellingstaal", () => {
    const check = buildDossierQualityCheck(baseIntake, new Date(2026, 4, 25));
    const output = JSON.stringify(check).toLowerCase();

    expect(output).not.toContain("kans van slagen");
    expect(output).not.toContain("juridisch oordeel");
    expect(output).not.toContain("uitspraak");
  });

  test("checkout leidt naar Dossiercheck voor generatie", async ({ page }) => {
    await page.addInitScript((intake) => {
      window.sessionStorage.setItem("briefkompas_product", "basis");
      window.sessionStorage.setItem("briefkompas_intake", JSON.stringify(intake));
    }, baseIntake);

    await openAuthenticatedPage(page, "/checkout/success?flow=bezwaar&bypass_payment=1");
    const emailInput = page.getByLabel("E-mailadres voor toezending");
    const continueButton = page.getByRole("button", { name: /Naar Dossiercheck/ });

    await expect(emailInput).toBeVisible();
    await page.waitForLoadState("networkidle");
    await emailInput.fill("test@example.nl");
    await expect(emailInput).toHaveValue("test@example.nl");
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(page).toHaveURL(/\/dossiercheck\/bezwaar$/);
    await expect(page.getByRole("heading", { name: "Dossiercheck" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Termijn" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bewijsstukken" })).toBeVisible();
    const argumentButton = page.getByRole("button", { name: /Verder naar mogelijke argumenten/ });
    await expect(argumentButton).toBeVisible();
    await argumentButton.click();

    await expect(page).toHaveURL(/\/argumenten\/bezwaar$/);
    await expect(page.getByRole("heading", { name: "Mogelijke argumenten" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Onvoldoende motivering/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Overslaan" })).toBeVisible();
  });
});
