import { expect, test } from "@playwright/test";

test.describe("Intake chat validation", () => {
  test("clarifying question on period step does not advance to next question", async ({ page }) => {
    await page.goto("/intake/woo");

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
