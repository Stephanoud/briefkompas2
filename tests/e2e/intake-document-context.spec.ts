import { expect, test } from "@playwright/test";
import {
  getKnownBestuursorgaan,
  getReferencedDocumentFieldValue,
  getReferencedDocumentBestuursorgaan,
  isDocumentLookupRequest,
  refersToUploadedDocument,
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

  test("3. een verwijzing naar de brief wordt ook als documentverwijzing herkend", () => {
    expect(refersToUploadedDocument("haal dat uit de brief")).toBeTruthy();
    expect(isDocumentLookupRequest("staat ook in de brief")).toBeTruthy();
  });

  test("4. documentverwijzing kan de categorie uit het besluit halen", () => {
    const categorie = getReferencedDocumentFieldValue("haal dat uit de brief", "categorie", {
      flow: "bezwaar",
      besluitAnalyseStatus: "read",
      besluitAnalyse: {
        onderwerp: "Omgevingsvergunning",
        besluitInhoud: "Uw aanvraag voor een omgevingsvergunning is afgewezen.",
      },
      files: {},
    });

    expect(categorie).toBe("vergunning");
  });

  test("5. documentverwijzing herkent Wft-toezicht als overige bestuursrechtelijke zaak", () => {
    const categorie = getReferencedDocumentFieldValue("zoek dat in het document", "categorie", {
      flow: "beroep_na_bezwaar",
      besluitDocumentType: "beslissing op bezwaar",
      besluitAnalyseStatus: "read",
      besluitAnalyse: {
        onderwerp: "Beslissing op bezwaar tegen aanwijzing ex artikel 1:75 Wft",
        besluitInhoud:
          "De Nederlandsche Bank heeft het bezwaar tegen een aanwijzing ex artikel 1:75 Wft ongegrond verklaard.",
      },
      files: {},
    });

    expect(categorie).toBe("overig");
  });

  test("6. documentverwijzing haalt eerdere bezwaargronden uit bezwaarbijlagen", () => {
    const eerdereBezwaargronden = getReferencedDocumentFieldValue("zoek dat in het document", "eerdere_bezwaargronden", {
      flow: "beroep_na_bezwaar",
      files: {
        bijlagen: [
          {
            name: "bezwaarschrift.pdf",
            size: 1234,
            type: "application/pdf",
            path: "stored:bezwaarschrift.pdf",
            extractedText:
              "Bezwaargronden: het primaire besluit moet worden herroepen omdat de aanwijzing onvoldoende is gemotiveerd. Daarnaast is publicatie onevenredig.",
          },
        ],
      },
    });

    expect(eerdereBezwaargronden).toContain("het primaire besluit moet worden herroepen");
    expect(eerdereBezwaargronden).toContain("publicatie onevenredig");
  });

  test("7. documentverwijzing gebruikt inhoud na maar als de gebruiker die alsnog noemt", () => {
    const eerdereBezwaargronden = getReferencedDocumentFieldValue(
      "staat ook in de brief maar: het primaire besluit moet worden herroepen omdat de aanwijzing onjuist is",
      "eerdere_bezwaargronden",
      {
        flow: "beroep_na_bezwaar",
        files: {},
      }
    );

    expect(eerdereBezwaargronden).toBe("het primaire besluit moet worden herroepen omdat de aanwijzing onjuist is");
  });

  test("8. fallback-assistent noemt het bestuursorgaan uit het document in plaats van opnieuw te vragen", () => {
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
    expect(reply.toLowerCase()).toContain("ik gebruik dit als bestuursorgaan");
    expect(reply.toLowerCase()).not.toContain("welk bestuursorgaan");
  });

  test("9. fallback-assistent zegt eerlijk wanneer het geuploade document dit punt niet oplost", () => {
    const reply = buildIntakeAssistantFallbackReply({
      flow: "bezwaar",
      reason: "stuck_answer",
      userMessage: "haal dat uit de brief",
      currentStepId: "doel",
      currentStepQuestion: "Wat wil je bereiken met dit bezwaar?",
      intakeData: {
        flow: "bezwaar",
        besluitAnalyse: {
          onderwerp: "Omgevingsvergunning",
        },
        files: {},
      },
      missingFacts: ["doel"],
      documentAnalysisMessage: "De kern van het besluit is meegenomen.",
    });

    expect(reply.toLowerCase()).toContain("opnieuw in het geuploade document gekeken");
    expect(reply.toLowerCase()).toContain("nog niet betrouwbaar");
  });
});
