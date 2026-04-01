import { expect, test } from "@playwright/test";
import {
  getKnownBestuursorgaan,
  getReferencedDocumentBestuursorgaan,
} from "@/lib/intake/document-context";
import { buildIntakeAssistantFallbackReply } from "@/lib/intake/assistant-guidance";

test.describe("Intake document context", () => {
  test("1. haalt bestuursorgaan uit documentanalyse als intakeveld nog leeg is", () => {
    const bestuursorgaan = getKnownBestuursorgaan({
      flow: "beroep_na_bezwaar",
      besluitAnalyse: {
        bestuursorgaan: "Nederlandse Zorgautoriteit (NZa)",
      },
      files: {},
    });

    expect(bestuursorgaan).toBe("Nederlandse Zorgautoriteit (NZa)");
  });

  test("2. een verwijzing naar het geuploade document levert het bekende bestuursorgaan op", () => {
    const bestuursorgaan = getReferencedDocumentBestuursorgaan(
      "zie het geuploade document voor het relevante bestuursorgaan",
      {
        flow: "beroep_na_bezwaar",
        besluitAnalyse: {
          bestuursorgaan: "Nederlandse Zorgautoriteit (NZa)",
        },
        files: {},
      }
    );

    expect(bestuursorgaan).toBe("Nederlandse Zorgautoriteit (NZa)");
  });

  test("3. fallback-assistent noemt het bestuursorgaan uit het document in plaats van opnieuw te vragen", () => {
    const reply = buildIntakeAssistantFallbackReply({
      flow: "beroep_na_bezwaar",
      reason: "clarifying_question",
      userMessage: "zie het geuploade document voor het relevante bestuursorgaan",
      currentStepId: "bestuursorgaan",
      currentStepQuestion: "Welk bestuursorgaan nam de beslissing op bezwaar waartegen je beroep wilt instellen?",
      intakeData: {
        flow: "beroep_na_bezwaar",
        besluitAnalyse: {
          bestuursorgaan: "Nederlandse Zorgautoriteit (NZa)",
        },
        files: {},
      },
      missingFacts: ["bestuursorgaan", "gronden"],
      routeExplanation:
        "Op basis van het besluit lijkt dit een beslissing op bezwaar. Waarschijnlijk hoort deze zaak daarom in de beroepsfase na bezwaar.",
      documentAnalysisMessage: "De kern van het besluit is meegenomen.",
    });

    expect(reply).toContain("Nederlandse Zorgautoriteit (NZa)");
    expect(reply.toLowerCase()).toContain("ik neem dat mee");
    expect(reply.toLowerCase()).not.toContain("welk bestuursorgaan");
  });
});
