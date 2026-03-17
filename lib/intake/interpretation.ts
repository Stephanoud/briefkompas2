import { ChatStep, Flow, IntakeFormData } from "@/types";
import { bestuursorgaanSuggestions } from "@/lib/intake/bestuursorganen";
import { isLikelyClarifyingQuestion } from "@/lib/intake-flow";

export type IntakeMainIntent =
  | "besluit_aanvechten"
  | "nieuwe_aanvraag"
  | "orientatie"
  | "woo_verzoek"
  | "uitvoering_handhaving";

export type IntakeProcedureObject =
  | "besluit"
  | "aanvraag"
  | "vergunning"
  | "boete"
  | "uitkering"
  | "handhavingsbesluit"
  | "woo_verzoek"
  | "ander_bestuursrechtelijk_object";

export type IntakeProcessPhase =
  | "orientatie"
  | "aanvraag"
  | "primair_besluit_ontvangen"
  | "bezwaar"
  | "beroep"
  | "uitvoering_handhaving";

export type MissingFactKey =
  | "bestuursorgaan"
  | "procedure_object"
  | "procesfase"
  | "doel"
  | "gronden"
  | "woo_onderwerp"
  | "woo_periode"
  | "woo_documenten";

export interface IntakeKnownFacts {
  bestuursorgaan?: string;
  category?: string;
  grounds?: string;
  desiredOutcome?: string;
}

export interface IntakeInterpretationState {
  mainIntent: IntakeMainIntent;
  procedureObject: IntakeProcedureObject;
  processPhase: IntakeProcessPhase;
  desiredOutcome: string | null;
  knownFacts: IntakeKnownFacts;
  missingFacts: MissingFactKey[];
  excludedPaths: string[];
  lastUserMessage: string;
  reasoning: string[];
}

export interface IntakeTurnInterpretation {
  state: IntakeInterpretationState;
  patch: Partial<IntakeFormData>;
  changedKeys: string[];
  routeChanged: boolean;
  hasMeaningfulAdvance: boolean;
}

export const intakeInterpretationStateSchema = {
  mainIntent: "besluit_aanvechten | nieuwe_aanvraag | orientatie | woo_verzoek | uitvoering_handhaving",
  procedureObject:
    "besluit | aanvraag | vergunning | boete | uitkering | handhavingsbesluit | woo_verzoek | ander_bestuursrechtelijk_object",
  processPhase:
    "orientatie | aanvraag | primair_besluit_ontvangen | bezwaar | beroep | uitvoering_handhaving",
  desiredOutcome: "string | null",
  knownFacts: {
    bestuursorgaan: "string | undefined",
    category: "string | undefined",
    grounds: "string | undefined",
    desiredOutcome: "string | undefined",
  },
  missingFacts:
    "bestuursorgaan | procedure_object | procesfase | doel | gronden | woo_onderwerp | woo_periode | woo_documenten",
  excludedPaths: "string[]",
  lastUserMessage: "string",
  reasoning: "string[]",
} as const;

const bezwaarCategoryOrder = ["boete", "uitkering", "belasting", "vergunning", "overig"] as const;

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function titleCase(value: string): string {
  return value.replace(/\b\p{L}+/gu, (part) => part.charAt(0).toUpperCase() + part.slice(1));
}

function extractBestuursorgaan(text: string): string | undefined {
  const normalized = normalizeText(text);
  const suggestionMatch = bestuursorgaanSuggestions.find((entry) => normalized.includes(entry.toLowerCase()));
  if (suggestionMatch) {
    return suggestionMatch;
  }

  const genericMatch = text.match(
    /\b(gemeente|provincie|waterschap|ministerie)\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu
  );
  if (genericMatch) {
    const phrase = `${genericMatch[1]} ${genericMatch[2]}`.trim().replace(/\s+/g, " ");
    return titleCase(phrase);
  }

  if (/\buwv\b/i.test(text)) return "Uitvoeringsinstituut Werknemersverzekeringen (UWV)";
  if (/\bcjib\b/i.test(text)) return "Centraal Justitieel Incassobureau (CJIB)";
  if (/\bbelastingdienst\b/i.test(text)) return "Belastingdienst";

  return undefined;
}

function inferProcedureObject(flow: Flow, text: string): IntakeProcedureObject {
  if (flow === "woo") {
    return "woo_verzoek";
  }

  if (hasAny(text, [/\b(handhaving|last onder dwangsom|bestuursdwang|dwangsom)\b/i])) {
    return "handhavingsbesluit";
  }
  if (hasAny(text, [/\b(vergunning|omgevingsvergunning|bouwvergunning|exploitatievergunning)\b/i])) {
    return "vergunning";
  }
  if (hasAny(text, [/\b(boete|verkeersboete|mulder|cjib)\b/i])) {
    return "boete";
  }
  if (hasAny(text, [/\b(uitkering|uwv|ww\b|wia|wajong|wao|ziektewet)\b/i])) {
    return "uitkering";
  }
  if (hasAny(text, [/\b(aanvraag|aanvragen|ingediend)\b/i])) {
    return "aanvraag";
  }
  if (hasAny(text, [/\b(afwijzing|weigering|afgewezen|geweigerd|besluit|beschikking)\b/i])) {
    return "besluit";
  }

  return "ander_bestuursrechtelijk_object";
}

function inferProcessPhase(flow: Flow, text: string): IntakeProcessPhase {
  if (hasAny(text, [/\b(beroep|rechter|rechtbank|kantonrechter)\b/i])) {
    return "beroep";
  }

  if (
    hasAny(text, [
      /\b(bezwaar|aanvechten|aanvecht|herzien|heroverwegen|laten herzien)\b/i,
      /\b(weigering aanvechten|afwijzing aanvechten)\b/i,
    ])
  ) {
    return "bezwaar";
  }

  if (flow === "woo" && hasAny(text, [/\b(besluit op woo|woo-besluit|woo besluit)\b/i])) {
    return "primair_besluit_ontvangen";
  }

  if (hasAny(text, [/\b(afwijzing|weigering|afgewezen|geweigerd|geweigerde|besluit ontvangen|beschikking ontvangen)\b/i])) {
    return "primair_besluit_ontvangen";
  }

  if (hasAny(text, [/\b(handhaving|dwangsom|bestuursdwang)\b/i])) {
    return "uitvoering_handhaving";
  }

  if (hasAny(text, [/\b(aanvraag|aanvragen|indienen|opnieuw aanvragen)\b/i])) {
    return "aanvraag";
  }

  return "orientatie";
}

function inferMainIntent(flow: Flow, text: string, phase: IntakeProcessPhase): IntakeMainIntent {
  if (flow === "woo" && phase !== "bezwaar" && phase !== "beroep" && !/\b(afwijzing|weigering|besluit)\b/i.test(text)) {
    return "woo_verzoek";
  }

  if (phase === "bezwaar" || phase === "beroep") {
    return "besluit_aanvechten";
  }

  if (phase === "uitvoering_handhaving") {
    return "uitvoering_handhaving";
  }

  if (phase === "aanvraag") {
    return "nieuwe_aanvraag";
  }

  if (hasAny(text, [/\b(weigering|afwijzing|afgewezen|geweigerde|besluit)\b/i])) {
    return "besluit_aanvechten";
  }

  return "orientatie";
}

function extractDesiredOutcome(text: string): string | undefined {
  const normalized = normalizeText(text);

  if (/\balsnog\b.*\b(verlenen|toekennen)\b/i.test(normalized)) return "alsnog verlenen";
  if (/\bnieuw besluit\b/i.test(normalized)) return "nieuw besluit";
  if (/\bherzien|laten herzien|heroverwegen\b/i.test(normalized)) return "herzien";
  if (/\bintrekken|intrekking\b/i.test(normalized)) return "intrekken";
  if (/\bvernietigen|vernietiging\b/i.test(normalized)) return "vernietigen";
  if (/\baanpassen|wijzigen|aanpassing|wijziging\b/i.test(normalized)) return "aanpassen";
  if (/\bmatigen|verlaging|verlagen\b/i.test(normalized)) return "matigen";
  if (/\bkwijtschelden|kwijtschelding\b/i.test(normalized)) return "kwijtschelden";
  if (/\bopschorten|opschorting\b/i.test(normalized)) return "opschorten";
  if (/\btoekennen|toekenning\b/i.test(normalized)) return "toekennen";

  return undefined;
}

function inferBezwaarCategoryFromContext(text: string, procedureObject: IntakeProcedureObject): string | undefined {
  if (procedureObject === "vergunning") return "vergunning";
  if (procedureObject === "boete") return "boete";
  if (procedureObject === "uitkering") return "uitkering";
  if (/\b(belasting|aanslag|naheffing|fiscaal|woz)\b/i.test(text)) return "belasting";
  if (/\b(overig|anders|andere zaak)\b/i.test(text)) return "overig";
  return undefined;
}

function hasProceduralSignals(text: string): boolean {
  return hasAny(text, [
    /\b(bezwaar|beroep|aanvechten|afwijzing|weigering|geweigerd|afgewezen|vergunning|uitkering|boete|belasting|woo)\b/i,
    /\b(bestuursorgaan|gemeente|provincie|waterschap|ministerie|uwv|belastingdienst|cjib)\b/i,
    /\b(herzien|intrekken|aanpassen|nieuw besluit|persoonlijke situatie|niet meegewogen|onevenredig)\b/i,
  ]);
}

function isPureClarifyingQuestion(text: string): boolean {
  return isLikelyClarifyingQuestion(text) && !hasProceduralSignals(text);
}

function shouldCaptureGrounds(stepId: string | undefined, text: string): boolean {
  if (stepId === "gronden") return normalizeText(text).length >= 3 && !isPureClarifyingQuestion(text);

  return hasAny(text, [
    /\b(niet meegewogen|persoonlijke situatie|niet gehoord|onevenredig|onjuist|kloppen niet)\b/i,
    /\b(ik ben het niet eens|volgens mij is dit onjuist|er is geen rekening gehouden)\b/i,
  ]);
}

function buildExcludedPaths(text: string, current: string[]): string[] {
  const excluded = new Set(current);

  if (/\b(niet opnieuw aanvragen|geen nieuwe aanvraag|niet opnieuw indienen)\b/i.test(text)) {
    excluded.add("nieuwe_aanvraag");
  }

  if (/\b(bezwaar maken|afwijzing aanvechten|weigering aanvechten|besluit laten herzien)\b/i.test(text)) {
    excluded.add("nieuwe_aanvraag");
  }

  return [...excluded];
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  return Boolean(value);
}

function buildMissingFacts(flow: Flow, intakeData: Partial<IntakeFormData>, state: Omit<IntakeInterpretationState, "missingFacts">): MissingFactKey[] {
  if (flow === "woo") {
    const missing: MissingFactKey[] = [];
    if (!hasValue(intakeData.bestuursorgaan)) missing.push("bestuursorgaan");
    if (!hasValue(intakeData.wooOnderwerp)) missing.push("woo_onderwerp");
    if (!hasValue(intakeData.wooPeriode)) missing.push("woo_periode");
    if (!hasValue(intakeData.wooDocumenten)) missing.push("woo_documenten");
    return missing;
  }

  const missing: MissingFactKey[] = [];
  if (!hasValue(intakeData.bestuursorgaan)) missing.push("bestuursorgaan");
  if (!hasValue(intakeData.categorie) && state.procedureObject === "besluit") missing.push("procedure_object");
  if (state.processPhase === "orientatie" && state.mainIntent === "orientatie") missing.push("procesfase");
  if (!hasValue(intakeData.doel)) missing.push("doel");
  if (!hasValue(intakeData.gronden)) missing.push("gronden");
  return missing;
}

function buildReasoning(params: {
  flow: Flow;
  text: string;
  mainIntent: IntakeMainIntent;
  procedureObject: IntakeProcedureObject;
  processPhase: IntakeProcessPhase;
  desiredOutcome?: string;
}): string[] {
  const reasons = [
    `Hoofdintentie=${params.mainIntent}`,
    `Object=${params.procedureObject}`,
    `Procesfase=${params.processPhase}`,
  ];

  if (params.desiredOutcome) {
    reasons.push(`Gewenste uitkomst=${params.desiredOutcome}`);
  }

  if (params.flow === "woo" && /\b(afwijzing|weigering|besluit)\b/i.test(params.text)) {
    reasons.push("Woo-context wijst op bezwaar tegen een besluit in plaats van een nieuw verzoek.");
  }

  return reasons;
}

function changedPatchKeys(previous: Partial<IntakeFormData>, patch: Partial<IntakeFormData>): string[] {
  return Object.entries(patch)
    .filter(([key, value]) => {
      const previousValue = previous[key as keyof IntakeFormData];
      return JSON.stringify(previousValue) !== JSON.stringify(value);
    })
    .map(([key]) => key);
}

export function createInitialIntakeInterpretation(flow: Flow): IntakeInterpretationState {
  return {
    mainIntent: flow === "woo" ? "woo_verzoek" : "orientatie",
    procedureObject: flow === "woo" ? "woo_verzoek" : "ander_bestuursrechtelijk_object",
    processPhase: "orientatie",
    desiredOutcome: null,
    knownFacts: {},
    missingFacts:
      flow === "woo"
        ? ["bestuursorgaan", "woo_onderwerp", "woo_periode", "woo_documenten"]
        : ["bestuursorgaan", "procedure_object", "doel", "gronden"],
    excludedPaths: [],
    lastUserMessage: "",
    reasoning: [],
  };
}

export function interpretIntakeTurn(params: {
  flow: Flow;
  latestUserMessage: string;
  currentStep?: ChatStep;
  intakeData: Partial<IntakeFormData>;
  previousState?: IntakeInterpretationState;
}): IntakeTurnInterpretation {
  const { flow, latestUserMessage, currentStep, intakeData, previousState } = params;
  const previous = previousState ?? createInitialIntakeInterpretation(flow);
  const text = latestUserMessage.trim();
  const normalized = normalizeText(text);
  const pureClarifyingQuestion = isPureClarifyingQuestion(text);
  const inferredProcedureObject = inferProcedureObject(flow, normalized);
  const procedureObject =
    inferredProcedureObject === "ander_bestuursrechtelijk_object" &&
    previous.procedureObject !== "ander_bestuursrechtelijk_object"
      ? previous.procedureObject
      : inferredProcedureObject;
  const inferredProcessPhase = inferProcessPhase(flow, normalized);
  const processPhase =
    inferredProcessPhase === "orientatie" && previous.processPhase !== "orientatie"
      ? previous.processPhase
      : inferredProcessPhase;
  const inferredMainIntent = inferMainIntent(flow, normalized, processPhase);
  const mainIntent =
    inferredMainIntent === "orientatie" && previous.mainIntent !== "orientatie"
      ? previous.mainIntent
      : inferredMainIntent;
  const desiredOutcome = extractDesiredOutcome(normalized) ?? previous.desiredOutcome ?? undefined;

  const patch: Partial<IntakeFormData> = {};
  const extractedBestuursorgaan = extractBestuursorgaan(text);
  const inferredCategory = flow === "bezwaar" ? inferBezwaarCategoryFromContext(normalized, procedureObject) : undefined;

  if (extractedBestuursorgaan && !hasValue(intakeData.bestuursorgaan)) {
    patch.bestuursorgaan = extractedBestuursorgaan;
  }

  if (flow === "bezwaar" && inferredCategory && !hasValue(intakeData.categorie)) {
    patch.categorie = inferredCategory;
  }

  if (desiredOutcome && (!hasValue(intakeData.doel) || currentStep?.id === "doel")) {
    patch.doel = desiredOutcome;
  }

  if (shouldCaptureGrounds(currentStep?.id, text) && (!hasValue(intakeData.gronden) || currentStep?.id === "gronden")) {
    patch.gronden = text;
  }

  if (flow === "woo") {
    if (!pureClarifyingQuestion && currentStep?.id === "onderwerp" && !hasValue(intakeData.wooOnderwerp) && normalized.length > 8) {
      patch.wooOnderwerp = text;
    }
    if (!pureClarifyingQuestion && currentStep?.id === "periode" && !hasValue(intakeData.wooPeriode) && normalized.length > 5) {
      patch.wooPeriode = text;
    }
    if (!pureClarifyingQuestion && currentStep?.id === "documenten" && !hasValue(intakeData.wooDocumenten) && normalized.length > 5) {
      patch.wooDocumenten = text;
    }
  }

  if (currentStep?.id === "bestuursorgaan" && !patch.bestuursorgaan && normalized.length > 5) {
    if (/\b(gemeente|provincie|waterschap|ministerie|uwv|belastingdienst|cjib)\b/i.test(text)) {
      patch.bestuursorgaan = extractedBestuursorgaan ?? titleCase(text);
    }
  }

  const mergedData = { ...intakeData, ...patch };
  const excludedPaths = buildExcludedPaths(normalized, previous.excludedPaths);
  const stateBase = {
    mainIntent,
    procedureObject,
    processPhase,
    desiredOutcome: desiredOutcome ?? null,
    knownFacts: {
      bestuursorgaan: (mergedData.bestuursorgaan as string | undefined) ?? previous.knownFacts.bestuursorgaan,
      category: (mergedData.categorie as string | undefined) ?? previous.knownFacts.category,
      grounds: (mergedData.gronden as string | undefined) ?? previous.knownFacts.grounds,
      desiredOutcome: (mergedData.doel as string | undefined) ?? previous.knownFacts.desiredOutcome,
    },
    excludedPaths,
    lastUserMessage: text,
    reasoning: buildReasoning({
      flow,
      text: normalized,
      mainIntent,
      procedureObject,
      processPhase,
      desiredOutcome,
    }),
  };

  const state: IntakeInterpretationState = {
    ...stateBase,
    missingFacts: buildMissingFacts(flow, mergedData, stateBase),
  };

  const changedKeys = changedPatchKeys(intakeData, patch);
  const routeChanged =
    previous.mainIntent !== state.mainIntent ||
    previous.procedureObject !== state.procedureObject ||
    previous.processPhase !== state.processPhase;
  const hasMeaningfulAdvance =
    changedKeys.length > 0 ||
    routeChanged ||
    state.excludedPaths.join("|") !== previous.excludedPaths.join("|") ||
    (state.desiredOutcome ?? "") !== (previous.desiredOutcome ?? "");

  return {
    state,
    patch,
    changedKeys,
    routeChanged,
    hasMeaningfulAdvance,
  };
}

function shouldAskForProcedureObject(state: IntakeInterpretationState, intakeData: Partial<IntakeFormData>): boolean {
  return !hasValue(intakeData.categorie) && state.procedureObject === "besluit";
}

export function getContextualQuestion(params: {
  flow: Flow;
  step: ChatStep;
  interpretation: IntakeInterpretationState;
  intakeData: Partial<IntakeFormData>;
}): string {
  const { flow, step, interpretation, intakeData } = params;

  if (flow === "woo") {
    if (step.id === "bestuursorgaan") {
      if (interpretation.mainIntent === "besluit_aanvechten") {
        return "Welk bestuursorgaan nam het WOO-besluit waartegen je wilt opkomen?";
      }
      return step.question;
    }

    return step.question;
  }

  switch (step.id) {
    case "bestuursorgaan":
      if (interpretation.procedureObject === "vergunning" && interpretation.mainIntent === "besluit_aanvechten") {
        return "Welk bestuursorgaan heeft de vergunning geweigerd of afgewezen?";
      }
      if (interpretation.procedureObject === "uitkering") {
        return "Welke instantie heeft dit besluit over je uitkering genomen?";
      }
      if (interpretation.procedureObject === "boete") {
        return "Welke instantie heeft de boete of beschikking opgelegd?";
      }
      if (interpretation.procedureObject === "handhavingsbesluit") {
        return "Welk bestuursorgaan heeft het handhavingsbesluit genomen?";
      }
      if (interpretation.mainIntent === "nieuwe_aanvraag" && !interpretation.excludedPaths.includes("nieuwe_aanvraag")) {
        return "Bij welk bestuursorgaan loopt of speelde deze aanvraag?";
      }
      return step.question;

    case "categorie":
      if (shouldAskForProcedureObject(interpretation, intakeData)) {
        return "Om wat voor besluit gaat het precies: een vergunning, uitkering, boete, belastingzaak of iets anders?";
      }
      return step.question;

    case "doel":
      if (interpretation.procedureObject === "vergunning" && interpretation.mainIntent === "besluit_aanvechten") {
        return "Wat wil je met je bezwaar bereiken: alsnog verlening van de vergunning of een nieuw besluit?";
      }
      if (interpretation.procedureObject === "uitkering") {
        return "Wat wil je met dit bezwaar bereiken: toekenning, herziening of aanpassing van het besluit?";
      }
      if (interpretation.procedureObject === "boete") {
        return "Wat wil je met dit bezwaar bereiken: intrekking, verlaging of een nieuw besluit?";
      }
      return step.question;

    case "gronden":
      if (interpretation.knownFacts.grounds?.toLowerCase().includes("persoonlijke situatie")) {
        return "Je gaf al aan dat je persoonlijke situatie niet is meegewogen. Wat is er volgens jou precies over het hoofd gezien?";
      }
      if (interpretation.procedureObject === "vergunning" && interpretation.mainIntent === "besluit_aanvechten") {
        return "Waarom ben je het niet eens met de weigering of afwijzing van de vergunning?";
      }
      if (interpretation.procedureObject === "uitkering") {
        return "Waarom klopt dit besluit over je uitkering volgens jou niet?";
      }
      return step.question;

    default:
      return step.question;
  }
}

export function getContextualValidationMessage(params: {
  flow: Flow;
  step: ChatStep;
  interpretation: IntakeInterpretationState;
}): string {
  const { flow, step, interpretation } = params;

  if (flow === "bezwaar" && step.id === "bestuursorgaan" && interpretation.procedureObject === "vergunning") {
    return "Noem welk bestuursorgaan de vergunning heeft geweigerd, bijvoorbeeld 'gemeente Utrecht'.";
  }

  if (flow === "bezwaar" && step.id === "categorie" && interpretation.mainIntent === "besluit_aanvechten") {
    return "Geef aan om wat voor besluit het gaat, bijvoorbeeld vergunning, uitkering, boete, belasting of overig.";
  }

  return "";
}

export function findNextUnansweredStepIndex(steps: ChatStep[], intakeData: Partial<IntakeFormData>, startIndex: number): number {
  for (let index = startIndex; index < steps.length; index += 1) {
    const step = steps[index];
    if (!hasValue(intakeData[step.field as keyof IntakeFormData])) {
      return index;
    }
  }

  return steps.length;
}

export function getResolvedStepCount(steps: ChatStep[], intakeData: Partial<IntakeFormData>): number {
  return steps.reduce((count, step) => {
    return count + (hasValue(intakeData[step.field as keyof IntakeFormData]) ? 1 : 0);
  }, 0);
}

export function getSuggestedStepId(step: ChatStep, interpretation: IntakeInterpretationState): string {
  if (step.id === "categorie" && shouldAskForProcedureObject(interpretation, {})) {
    return "categorie";
  }

  return step.id;
}

export function summarizeInterpretationForAudit(state: IntakeInterpretationState): string {
  return [
    `intentie=${state.mainIntent}`,
    `object=${state.procedureObject}`,
    `fase=${state.processPhase}`,
    `uitkomst=${state.desiredOutcome ?? "onbekend"}`,
    `uitgesloten=${state.excludedPaths.join(",") || "geen"}`,
  ].join(" | ");
}

export function getCanonicalBezwaarCategoryOrder(): readonly string[] {
  return bezwaarCategoryOrder;
}
