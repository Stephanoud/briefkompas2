import { expect, test } from "@playwright/test";
import {
  buildSelectedLegalArgumentPromptSection,
  normalizeLegalArgumentSelections,
  toLegalArgumentPromptItems,
} from "@/lib/legal-argument-options";
import { buildLetterPrompt } from "@/lib/ai/buildLetterPrompt";
import { LegalArgumentSelection } from "@/types";

test.describe("Possible argument lines", () => {
  test("normaliseert selecties en negeert lege Anders-toelichting", () => {
    const selections: LegalArgumentSelection[] = [
      { id: "onvoldoende_motivering" },
      { id: "onvoldoende_motivering" },
      { id: "anders", customText: "   " },
      { id: "feitelijke_onjuistheden" },
    ];

    expect(normalizeLegalArgumentSelections(selections)).toEqual([
      { id: "onvoldoende_motivering" },
      { id: "feitelijke_onjuistheden" },
    ]);
  });

  test("bouwt een veilige promptsectie zonder juridische conclusie", () => {
    const section = buildSelectedLegalArgumentPromptSection([
      { id: "onevenredige_gevolgen" },
      { id: "anders", customText: "De toezegging uit de e-mail van 3 mei is niet meegenomen." },
    ]);

    expect(section).toContain("Mogelijke argumentlijnen van gebruiker");
    expect(section).toContain("geen juridisch advies");
    expect(section).toContain("geen juridische conclusies");
    expect(section).toContain("Onevenredige gevolgen");
    expect(section).toContain("Eigen toelichting: De toezegging uit de e-mail van 3 mei is niet meegenomen.");
    expect(section).toContain("alleen als intake, besluitanalyse of uploads daar concrete feitelijke steun voor geven");
  });

  test("laat de promptsectie weg als de gebruiker niets kiest", () => {
    expect(buildSelectedLegalArgumentPromptSection([])).toBe("");
    expect(toLegalArgumentPromptItems([])).toEqual([]);
  });

  test("neemt gekozen invalshoeken gestructureerd mee in de briefprompt", () => {
    const prompt = buildLetterPrompt({
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Groningen",
        categorie: "vergunning",
        doel: "aanpassing van het besluit",
        gronden: "Het besluit noemt mijn tekening niet en gaat niet in op de uitrit naast mijn woning.",
        files: {},
        mogelijkeArgumenten: [
          { id: "onvoldoende_motivering" },
          { id: "onvoldoende_belangenafweging" },
        ],
      },
      product: "basis",
      payload: {
        flow: "bezwaar",
        caseType: "algemeen_bestuursrecht",
        route: "bezwaar_bestuursrecht",
        caseFacts: [],
        decisionMeta: [],
        selectedSources: [],
        validatedAuthorities: [],
        disallowedBehaviors: [],
      },
    });

    expect(prompt).toContain("Mogelijke argumentlijnen van gebruiker");
    expect(prompt).toContain("Onvoldoende motivering");
    expect(prompt).toContain("Onvoldoende belangenafweging");
    expect(prompt).toContain("selectedLegalArgumentLines");
    expect(prompt).toContain("alleen als het dossier daar concrete steun voor geeft");
    expect(prompt.toLowerCase()).not.toContain("kans van slagen");
    expect(prompt.toLowerCase()).not.toContain("voorspelling uitspraak");
  });

  test("houdt de bestaande prompt schoon zonder gekozen invalshoeken", () => {
    const prompt = buildLetterPrompt({
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Groningen",
        categorie: "vergunning",
        doel: "aanpassing van het besluit",
        gronden: "Het besluit noemt mijn tekening niet.",
        files: {},
      },
      product: "basis",
      payload: {
        flow: "bezwaar",
        caseType: "algemeen_bestuursrecht",
        route: "bezwaar_bestuursrecht",
        caseFacts: [],
        decisionMeta: [],
        selectedSources: [],
        validatedAuthorities: [],
        disallowedBehaviors: [],
      },
    });

    expect(prompt).not.toContain("Mogelijke argumentlijnen van gebruiker");
    expect(prompt).toContain('"selectedLegalArgumentLines": []');
  });
});
