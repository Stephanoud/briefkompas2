import { expect, test } from "@playwright/test";
import { getStepsByFlow, interpretWooPeriodAnswer, interpretWooSubjectAnswer } from "@/lib/intake-flow";
import { determineProcedureAdvice } from "@/lib/procedure-route";
import { assessDecisionProcedure } from "@/lib/decision-procedure";
import {
  createInitialIntakeInterpretation,
  findNextUnansweredStepIndex,
  getContextualQuestion,
  interpretIntakeTurn,
} from "@/lib/intake/interpretation";

const bezwaarSteps = getStepsByFlow("bezwaar");
const wooSteps = getStepsByFlow("woo");

test.describe("Contextual intake interpretation", () => {
  test("1. geweigerde vergunning laten herzien leidt naar bezwaarroute", () => {
    const turn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "Ik wil een geweigerde vergunning laten herzien.",
      currentStep: bezwaarSteps[0],
      intakeData: { flow: "bezwaar" },
      previousState: createInitialIntakeInterpretation("bezwaar"),
    });

    expect(turn.state.mainIntent).toBe("besluit_aanvechten");
    expect(turn.state.procedureObject).toBe("vergunning");
    expect(turn.state.processPhase).toBe("bezwaar");
    expect(turn.patch.categorie).toBe("vergunning");
    expect(turn.patch.doel).toBe("herzien");
    expect(
      getContextualQuestion({
        flow: "bezwaar",
        step: bezwaarSteps[0],
        interpretation: turn.state,
        intakeData: { flow: "bezwaar", ...turn.patch },
      })
    ).toBe("Welk bestuursorgaan heeft de vergunning geweigerd of afgewezen?");
  });

  test("2. bezwaar tegen afwijzing vraagt niet om een nieuwe aanvraag", () => {
    const turn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "Ik wil bezwaar maken tegen de afwijzing.",
      currentStep: bezwaarSteps[1],
      intakeData: { flow: "bezwaar", bestuursorgaan: "Gemeente Amsterdam" },
      previousState: createInitialIntakeInterpretation("bezwaar"),
    });

    expect(turn.state.mainIntent).toBe("besluit_aanvechten");
    expect(turn.state.excludedPaths).toContain("nieuwe_aanvraag");
    expect(turn.patch.categorie).toBeUndefined();
    expect(
      getContextualQuestion({
        flow: "bezwaar",
        step: bezwaarSteps[1],
        interpretation: turn.state,
        intakeData: { flow: "bezwaar", bestuursorgaan: "Gemeente Amsterdam" },
      })
    ).toBe("Om wat voor besluit gaat het precies: een vergunning, uitkering, boete, belastingzaak of iets anders?");
  });

  test("3. persoonlijke situatie wordt als grond vastgelegd", () => {
    const previousState = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "Ik wil een geweigerde vergunning laten herzien.",
      currentStep: bezwaarSteps[0],
      intakeData: { flow: "bezwaar" },
      previousState: createInitialIntakeInterpretation("bezwaar"),
    }).state;

    const turn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "De gemeente heeft mijn persoonlijke situatie niet meegewogen.",
      currentStep: bezwaarSteps[3],
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herzien",
      },
      previousState,
    });

    expect(turn.patch.gronden).toBe("De gemeente heeft mijn persoonlijke situatie niet meegewogen.");
    expect(turn.state.knownFacts.grounds).toContain("persoonlijke situatie");
  });

  test("4. niet opnieuw aanvragen sluit dat pad uit", () => {
    const turn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "Ik wil niet opnieuw aanvragen, ik wil de weigering aanvechten.",
      currentStep: bezwaarSteps[1],
      intakeData: { flow: "bezwaar", bestuursorgaan: "Gemeente Amsterdam" },
      previousState: createInitialIntakeInterpretation("bezwaar"),
    });

    expect(turn.state.excludedPaths).toContain("nieuwe_aanvraag");
    const question = getContextualQuestion({
      flow: "bezwaar",
      step: bezwaarSteps[1],
      interpretation: turn.state,
      intakeData: { flow: "bezwaar", bestuursorgaan: "Gemeente Amsterdam" },
    });
    expect(question.toLowerCase()).not.toContain("aanvraag");
    expect(question.toLowerCase()).toContain("besluit");
  });

  test("5. nieuwe info herijkt de route direct", () => {
    const aanvraagTurn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "Ik wil een vergunning aanvragen.",
      currentStep: bezwaarSteps[0],
      intakeData: { flow: "bezwaar" },
      previousState: createInitialIntakeInterpretation("bezwaar"),
    });

    const repairTurn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "Ik wil toch bezwaar maken tegen de weigering.",
      currentStep: bezwaarSteps[1],
      intakeData: { flow: "bezwaar" },
      previousState: aanvraagTurn.state,
    });

    expect(aanvraagTurn.state.mainIntent).toBe("nieuwe_aanvraag");
    expect(repairTurn.routeChanged).toBeTruthy();
    expect(repairTurn.state.mainIntent).toBe("besluit_aanvechten");
    expect(repairTurn.state.processPhase).toBe("bezwaar");
  });

  test("6. bekende vergunningzaak levert contextuele doelvraag op", () => {
    const previousState = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "Ik wil een geweigerde vergunning laten herzien.",
      currentStep: bezwaarSteps[0],
      intakeData: { flow: "bezwaar" },
      previousState: createInitialIntakeInterpretation("bezwaar"),
    }).state;

    expect(
      getContextualQuestion({
        flow: "bezwaar",
        step: bezwaarSteps[2],
        interpretation: previousState,
        intakeData: { flow: "bezwaar", bestuursorgaan: "Gemeente Amsterdam", categorie: "vergunning" },
      })
    ).toBe("Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?");
  });

  test("7. bezwaar tegen een WOO-afwijzing krijgt besluitcontext", () => {
    const turn = interpretIntakeTurn({
      flow: "woo",
      latestUserMessage: "Ik wil bezwaar maken tegen een WOO-afwijzing.",
      currentStep: wooSteps[0],
      intakeData: { flow: "woo" },
      previousState: createInitialIntakeInterpretation("woo"),
    });

    expect(turn.state.mainIntent).toBe("besluit_aanvechten");
    expect(turn.state.processPhase).toBe("bezwaar");
    expect(
      getContextualQuestion({
        flow: "woo",
        step: wooSteps[0],
        interpretation: turn.state,
        intakeData: { flow: "woo" },
      })
    ).toBe("Welk bestuursorgaan nam het WOO-besluit waartegen je wilt opkomen?");
  });

  test("8. een antwoord met meerdere feiten slaat meerdere velden op", () => {
    const turn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage:
        "De gemeente Amsterdam heeft mijn vergunning geweigerd en ik wil dat besluit laten herzien.",
      currentStep: bezwaarSteps[0],
      intakeData: { flow: "bezwaar" },
      previousState: createInitialIntakeInterpretation("bezwaar"),
    });

    const mergedData = {
      flow: "bezwaar" as const,
      ...turn.patch,
      bestuursorgaan: turn.patch.bestuursorgaan,
    };

    expect(turn.patch.bestuursorgaan).toBe("Gemeente Amsterdam");
    expect(turn.patch.categorie).toBe("vergunning");
    expect(turn.patch.doel).toBe("herzien");
    expect(findNextUnansweredStepIndex(bezwaarSteps, mergedData, 1)).toBe(3);
  });

  test("8b. zelfstandige bestuursorganen zoals de NZa worden ook als bestuursorgaan herkend", () => {
    const turn = interpretIntakeTurn({
      flow: "beroep_na_bezwaar",
      latestUserMessage: "Ik wil beroep instellen tegen de beslissing van de NZa.",
      currentStep: getStepsByFlow("beroep_na_bezwaar")[0],
      intakeData: { flow: "beroep_na_bezwaar" },
      previousState: createInitialIntakeInterpretation("beroep_na_bezwaar"),
    });

    expect(turn.patch.bestuursorgaan).toBe("Nederlandse Zorgautoriteit (NZa)");
  });

  test("9. als verplichte bezwaarfeiten bekend zijn, blijven geen kernvragen open", () => {
    const turn = interpretIntakeTurn({
      flow: "bezwaar",
      latestUserMessage: "De gevolgen van dit besluit zijn voor mij onevenredig zwaar.",
      currentStep: bezwaarSteps[3],
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herzien",
      },
      previousState: interpretIntakeTurn({
        flow: "bezwaar",
        latestUserMessage: "Ik wil een geweigerde vergunning laten herzien.",
        currentStep: bezwaarSteps[0],
        intakeData: { flow: "bezwaar" },
        previousState: createInitialIntakeInterpretation("bezwaar"),
      }).state,
    });

    expect(turn.patch.gronden).toContain("onevenredig zwaar");
    expect(
      turn.state.missingFacts.filter((fact) => ["bestuursorgaan", "procedure_object", "doel", "gronden"].includes(fact))
    ).toEqual([]);
  });

  test("10. een zuivere verduidelijkingsvraag zonder feiten geeft geen semantische voortgang", () => {
    const turn = interpretIntakeTurn({
      flow: "woo",
      latestUserMessage: "wat voldoet wel aan de voorwaarden?",
      currentStep: wooSteps[2],
      intakeData: {
        flow: "woo",
        bestuursorgaan: "Gemeente Amsterdam",
        wooOnderwerp: "Subsidies en communicatie over wijkprojecten in Amsterdam-Zuid.",
      },
      previousState: createInitialIntakeInterpretation("woo"),
    });

    expect(turn.hasMeaningfulAdvance).toBeFalsy();
    expect(turn.patch.wooPeriode).toBeUndefined();
    expect(turn.state.missingFacts).toContain("woo_periode");
  });

  test("11. laatste twee jaar telt als geldige woo-periode", () => {
    const interpretation = interpretWooPeriodAnswer("laatste twee jaar");

    expect(interpretation.status).toBe("valid");
    expect(interpretation.normalizedValue).toBe("laatste twee jaar");

    const turn = interpretIntakeTurn({
      flow: "woo",
      latestUserMessage: "laatste twee jaar",
      currentStep: wooSteps[2],
      intakeData: {
        flow: "woo",
        bestuursorgaan: "Gemeente Amsterdam",
        wooOnderwerp: "Subsidies en communicatie over wijkprojecten in Amsterdam-Zuid.",
      },
      previousState: createInitialIntakeInterpretation("woo"),
    });

    expect(turn.patch.wooPeriode).toBe("laatste twee jaar");
    expect(turn.state.missingFacts).not.toContain("woo_periode");
  });

  test("12. sinds corona wordt geïnterpreteerd als circa 2020 tot heden met bevestiging", () => {
    const interpretation = interpretWooPeriodAnswer("ongeveer sinds corona");

    expect(interpretation.status).toBe("valid");
    expect(interpretation.normalizedValue).toBe("ongeveer sinds 2020 tot heden");
    expect(interpretation.confirmationPrompt).toContain("2020 tot heden");
  });

  test("13. recent blijft ambigu en vraagt om concretisering", () => {
    const interpretation = interpretWooPeriodAnswer("recent");

    expect(interpretation.status).toBe("ambiguous");
    expect(interpretation.clarificationPrompt).toContain("concretiseren");
  });

  test("14. summier woo-onderwerp vraagt eerst om inhoudelijke concretisering", () => {
    const interpretation = interpretWooSubjectAnswer("subsidies");

    expect(interpretation.status).toBe("needs_clarification");
    expect(interpretation.clarificationPrompt).toContain("wat je precies zoekt");
    expect(interpretation.clarificationOptions).toHaveLength(4);
  });

  test("15. keuze-optie maakt een summier woo-onderwerp voldoende scherp", () => {
    const interpretation = interpretWooSubjectAnswer("interne e-mails en afstemming", "subsidies");

    expect(interpretation.status).toBe("valid");
    expect(interpretation.normalizedValue).toContain("subsidies");
    expect(interpretation.normalizedValue).toContain("interne e-mails en afstemming");
  });

  test("16. procedurecheck routeert beslissing op bezwaar naar beroep na bezwaar", () => {
    const result = determineProcedureAdvice({
      flow: "bezwaar",
      heeftOfficieelBesluit: true,
      heeftBeslissingOpBezwaar: true,
      heeftBezwaarGemaakt: true,
      bestuursorgaan: "Gemeente Amsterdam",
      doel: "vernietiging",
      files: {},
    });

    expect(result.advice).toBe("beroep_na_bezwaar");
  });

  test("17. procedurecheck routeert ontwerpbesluit met zienswijzemogelijkheid naar beroep zonder bezwaar", () => {
    const result = determineProcedureAdvice({
      flow: "bezwaar",
      heeftOfficieelBesluit: true,
      hadOntwerpbesluit: true,
      konZienswijzeIndienen: true,
      heeftZienswijzeIngediend: true,
      bestuursorgaan: "Gemeente Amsterdam",
      doel: "vernietiging",
      files: {},
    });

    expect(result.advice).toBe("beroep_zonder_bezwaar");
  });

  test("18. procedurecheck routeert alleen een besluit naar bezwaar", () => {
    const result = determineProcedureAdvice({
      flow: "bezwaar",
      heeftOfficieelBesluit: true,
      hadOntwerpbesluit: false,
      konZienswijzeIndienen: false,
      heeftBezwaarGemaakt: false,
      bestuursorgaan: "Gemeente Amsterdam",
      doel: "herziening",
      files: {},
    });

    expect(result.advice).toBe("bezwaar");
  });

  test("19. procedurecheck routeert reactie op ontwerp naar zienswijze", () => {
    const result = determineProcedureAdvice({
      flow: "bezwaar",
      heeftOfficieelBesluit: false,
      hadOntwerpbesluit: true,
      konZienswijzeIndienen: true,
      bestuursorgaan: "Gemeente Amsterdam",
      doel: "aanpassing",
      files: {},
    });

    expect(result.advice).toBe("zienswijze");
  });

  test("20. documentcontrole stuurt beroep terug naar bezwaar als bezwaar openstaat", () => {
    const assessment = assessDecisionProcedure({
      selectedFlow: "beroep_zonder_bezwaar",
      extraction: {
        extracted: true,
        extractedText:
          "Tegen dit besluit kunt u binnen zes weken na dagtekening een bezwaarschrift indienen bij het college van burgemeester en wethouders.",
      },
    });

    expect(assessment.suggestedFlow).toBe("bezwaar");
    expect(assessment.shouldAutoSwitch).toBeTruthy();
  });

  test("21. documentcontrole stuurt bezwaar door naar beroep na beslissing op bezwaar", () => {
    const assessment = assessDecisionProcedure({
      selectedFlow: "bezwaar",
      extraction: {
        extracted: true,
        extractedText:
          "Beslissing op bezwaar. Uw bezwaar is ongegrond. Tegen deze beslissing op bezwaar kunt u beroep instellen bij de rechtbank.",
      },
    });

    expect(assessment.suggestedFlow).toBe("beroep_na_bezwaar");
    expect(assessment.confidence).toBe("high");
  });

  test("22. documentcontrole herkent ontwerpbesluit als zienswijzeroute", () => {
    const assessment = assessDecisionProcedure({
      selectedFlow: "bezwaar",
      extraction: {
        extracted: true,
        documentType: "ontwerpbesluit",
        extractedText:
          "Ontwerpbesluit. Een ieder kan gedurende zes weken een zienswijze naar voren brengen tegen dit ontwerpbesluit.",
      },
    });

    expect(assessment.suggestedFlow).toBe("zienswijze");
    expect(assessment.confidence).toBe("high");
  });
});
