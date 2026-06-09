import { getFlowLabel, isFlow } from "@/lib/flow";
import {
  DecisionExtractionResult,
  DecisionProcedureDetection,
  DecisionProcedureKind,
  Flow,
} from "@/types";

type DecisionProcedureFlow = Exclude<Flow, "woo">;

const LOW_CONFIDENCE_THRESHOLD = 70;
const AUTO_SWITCH_THRESHOLD = 85;

const PROCEDURE_LABELS: Record<DecisionProcedureKind, string> = {
  bezwaar: "Bezwaar",
  administratief_beroep: "Administratief beroep",
  rechtstreeks_beroep: "Rechtstreeks beroep",
  beroep_rechtbank: "Beroep rechtbank",
  zienswijze: "Zienswijze",
  woo: "WOO-gerelateerde procedure",
  onbekend: "Onbekend",
};

export interface DecisionProcedureAssessment {
  detectedProcedure: DecisionProcedureDetection;
  suggestedFlow: DecisionProcedureFlow | null;
  confidence: number;
  matchedSelectedFlow: boolean;
  shouldAutoSwitch: boolean;
  shouldConfirmSwitch: boolean;
  alertType: "info" | "warning" | "success";
  title: string;
  explanation: string;
  evidence: string[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimLength(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && normalizeWhitespace(value).length > 0;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function joinDecisionText(extraction: Partial<DecisionExtractionResult>): string {
  return [
    extraction.documentType,
    extraction.samenvatting,
    extraction.decisionAnalysis?.bestuursorgaan,
    extraction.decisionAnalysis?.onderwerp,
    extraction.decisionAnalysis?.rechtsgrond,
    extraction.decisionAnalysis?.besluitInhoud,
    extraction.decisionAnalysis?.termijnen,
    extraction.decisionAnalysis?.rechtsmiddelenclausule,
    ...(extraction.decisionAnalysis?.procedureleAanwijzingen ?? []),
    ...(extraction.decisionAnalysis?.wettelijkeGrondslagen ?? []),
    ...(extraction.decisionAnalysis?.aandachtspunten ?? []),
    extraction.extractedText,
  ]
    .filter(hasText)
    .join("\n")
    .toLowerCase();
}

function getLeadingDecisionText(extraction: Partial<DecisionExtractionResult>): string {
  return [
    extraction.documentType,
    extraction.samenvatting,
    extraction.extractedText?.slice(0, 1800),
  ]
    .filter(hasText)
    .join("\n")
    .toLowerCase();
}

function isAppealFlow(flow: Flow): flow is "beroep_zonder_bezwaar" | "beroep_na_bezwaar" {
  return flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar";
}

function getSelectedFlowGroup(flow: Flow): DecisionProcedureFlow {
  if (isAppealFlow(flow)) {
    return flow;
  }

  return flow === "woo" ? "bezwaar" : flow;
}

function getDecisionOnObjectionSignal(text: string): boolean {
  return (
    /\b(beslissing|besluit) op bezwaar\b/.test(text) ||
    /\buw bezwaar\b.{0,100}\b(ongegrond|gegrond|niet-ontvankelijk|deels gegrond)\b/.test(text) ||
    /\bnaar aanleiding van uw bezwaar\b/.test(text)
  );
}

function getObjectionClauseSignal(text: string): boolean {
  return (
    /\b(bezwaar maken|bezwaar indienen|bezwaarschrift|bezwaartermijn)\b/.test(text) ||
    /\bbinnen\s+\d+\s*(dagen|weken|maanden)\b.{0,100}\bbezwaar\b/.test(text) ||
    /\btegen dit besluit\b.{0,120}\bbezwaar\b/.test(text)
  );
}

function getAppealClauseSignal(text: string): boolean {
  return (
    /\b(beroep instellen|in beroep gaan|beroepschrift|rechtstreeks beroep|beroep openstaat)\b/.test(text) ||
    /\bbinnen\s+\d+\s*(dagen|weken|maanden)\b.{0,100}\bberoep\b/.test(text) ||
    /\btegen (dit|deze) (besluit|beschikking|beslissing)\b.{0,140}\bberoep\b/.test(text)
  );
}

function getCourtAppealSignal(text: string): boolean {
  return (
    /\bberoep\b.{0,100}\b(rechtbank|sector bestuursrecht|team bestuursrecht)\b/.test(text) ||
    /\b(rechtbank|sector bestuursrecht|team bestuursrecht)\b.{0,100}\b(beroep|beroepschrift)\b/.test(text)
  );
}

function getDirectAppealSignal(text: string): boolean {
  return (
    /\b(rechtstreeks beroep|direct beroep|beroep zonder bezwaar|bezwaar overslaan)\b/.test(text) ||
    /\binstemmen met rechtstreeks beroep\b/.test(text) ||
    /\bartikel\s+7:1a\b/.test(text) ||
    /\b(afdeling\s+3\.4|uniforme openbare voorbereidingsprocedure|uitgebreide voorbereidingsprocedure)\b/.test(text) ||
    /\bgeen bezwaar\b.{0,120}\bberoep\b/.test(text)
  );
}

function getAdministrativeAppealSignal(text: string): boolean {
  if (/\badministratief beroep\b/.test(text)) {
    return true;
  }

  const administrativeBodyAppeal =
    /\bberoep\b.{0,100}\b(gedeputeerde staten|de minister|ministerie|dagelijks bestuur|algemeen bestuur|bestuursorgaan)\b/.test(
      text
    );
  const courtAppeal =
    /\b(rechtbank|afdeling bestuursrechtspraak|centrale raad van beroep|college van beroep voor het bedrijfsleven)\b/.test(
      text
    );

  return administrativeBodyAppeal && !courtAppeal;
}

function getDraftDecisionSignal(leadingText: string, extraction: Partial<DecisionExtractionResult>): boolean {
  return (
    /\bontwerpbesluit\b/.test(leadingText) ||
    /\bontwerpbeschikking\b/.test(leadingText) ||
    extraction.documentType?.toLowerCase().includes("ontwerp") === true
  );
}

function getWooSignal(text: string): boolean {
  return /\b(woo|wob|wet open overheid|openbaarmaking|gedeeltelijke openbaarmaking|inventarislijst|documenttabel|zoekslag|weigeringsgrond|persoonlijke beleidsopvattingen)\b/.test(
    text
  );
}

function getDomainEvidence(text: string): string[] {
  const evidence: string[] = [];

  if (/\b(omgevingswet|omgevingsvergunning|omgevingsplan|bouwvergunning|wabo|exploitatievergunning)\b/.test(text)) {
    evidence.push("omgevings- of vergunningcontext herkend");
  }

  if (/\b(participatiewet|bijstand|terugvordering|uitkering|kostendelersnorm)\b/.test(text)) {
    evidence.push("Participatiewet- of uitkeringscontext herkend");
  }

  if (/\b(wmo|wet maatschappelijke ondersteuning|maatschappelijke ondersteuning|pgb|huishoudelijke hulp|maatwerkvoorziening)\b/.test(text)) {
    evidence.push("Wmo-context herkend");
  }

  if (/\b(uwv|wia|ww|wajong|wao|ziektewet|arbeidsongeschiktheid|werkloosheidswet)\b/.test(text)) {
    evidence.push("UWV/WIA/WW-context herkend");
  }

  if (/\b(gemeente|college van burgemeester en wethouders|burgemeester)\b.{0,160}\b(vergunning|omgevingsvergunning|bouwvergunning)\b/.test(text)) {
    evidence.push("gemeentelijke vergunningcontext herkend");
  }

  if (getWooSignal(text)) {
    evidence.push("WOO- of openbaarmakingscontext herkend");
  }

  return evidence;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function sanitizeConfidence(value: unknown): number {
  if (typeof value === "number") {
    return clampConfidence(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(parsed) ? clampConfidence(parsed) : 50;
  }

  return 50;
}

export function normalizeDecisionProcedureKind(value: unknown): DecisionProcedureKind | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase().replace(/[-\s]+/g, "_");

  if (normalized === "bezwaar" || normalized === "bezwaarschrift") {
    return "bezwaar";
  }

  if (normalized === "administratief_beroep") {
    return "administratief_beroep";
  }

  if (
    normalized === "rechtstreeks_beroep" ||
    normalized === "direct_beroep" ||
    normalized === "beroep_zonder_bezwaar"
  ) {
    return "rechtstreeks_beroep";
  }

  if (
    normalized === "beroep_rechtbank" ||
    normalized === "rechtbankberoep" ||
    normalized === "beroep_bij_de_rechtbank" ||
    normalized === "beroep"
  ) {
    return "beroep_rechtbank";
  }

  if (normalized === "zienswijze" || normalized === "zienswijzen") {
    return "zienswijze";
  }

  if (
    normalized === "woo" ||
    normalized === "wob" ||
    normalized === "woo_gerelateerde_procedure" ||
    normalized === "woo_procedure" ||
    normalized === "wet_open_overheid"
  ) {
    return "woo";
  }

  if (normalized === "onbekend" || normalized === "unknown" || normalized === "niet_vast_te_stellen") {
    return "onbekend";
  }

  return null;
}

function sanitizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized ? trimLength(normalized, maxLength) : null;
}

function sanitizeEvidence(value: unknown): string[] {
  const rawItems = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return uniqueStrings(
    rawItems
      .map((item) => sanitizeOptionalString(item, 180))
      .filter((item): item is string => Boolean(item))
  ).slice(0, 6);
}

function sanitizeSuggestedFlow(value: unknown): DecisionProcedureFlow | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  if (isFlow(normalized) && normalized !== "woo") {
    return normalized;
  }

  if (/\bzienswijze\b/.test(normalized)) {
    return "zienswijze";
  }

  if (/\bbezwaar\b/.test(normalized) && !/\b(zonder bezwaar|na bezwaar)\b/.test(normalized)) {
    return "bezwaar";
  }

  if (/\b(beroep_na_bezwaar|na bezwaar|beslissing op bezwaar)\b/.test(normalized)) {
    return "beroep_na_bezwaar";
  }

  if (/\b(beroep_zonder_bezwaar|rechtstreeks|direct|zonder bezwaar|rechtbank|beroep)\b/.test(normalized)) {
    return "beroep_zonder_bezwaar";
  }

  return null;
}

function mapProcedureToFlow(
  procedure: DecisionProcedureKind,
  extraction?: Partial<DecisionExtractionResult>
): DecisionProcedureFlow | null {
  switch (procedure) {
    case "bezwaar":
      return "bezwaar";
    case "rechtstreeks_beroep":
      return "beroep_zonder_bezwaar";
    case "beroep_rechtbank":
      return extraction && getDecisionOnObjectionSignal(joinDecisionText(extraction))
        ? "beroep_na_bezwaar"
        : "beroep_zonder_bezwaar";
    case "zienswijze":
      return "zienswijze";
    case "administratief_beroep":
    case "woo":
    case "onbekend":
      return null;
    default:
      return null;
  }
}

function defaultExplanation(procedure: DecisionProcedureKind): string {
  switch (procedure) {
    case "bezwaar":
      return "Het document lijkt een bezwaarclausule of primaire besluitroute te bevatten.";
    case "administratief_beroep":
      return "Het document lijkt te verwijzen naar administratief beroep in plaats van bezwaar of beroep bij de rechtbank.";
    case "rechtstreeks_beroep":
      return "Het document lijkt te vermelden dat rechtstreeks beroep openstaat.";
    case "beroep_rechtbank":
      return "Het document lijkt te verwijzen naar beroep bij de rechtbank.";
    case "zienswijze":
      return "Het document lijkt een ontwerpbesluit of zienswijzeroute te betreffen.";
    case "woo":
      return "Het document lijkt een WOO- of openbaarmakingsprocedure te betreffen.";
    case "onbekend":
      return "De procedure kan niet betrouwbaar uit het document worden afgeleid.";
    default:
      return "De procedure kan niet betrouwbaar uit het document worden afgeleid.";
  }
}

function defaultEvidence(procedure: DecisionProcedureKind): string[] {
  switch (procedure) {
    case "bezwaar":
      return ["bezwaarclausule of bezwaartermijn genoemd"];
    case "administratief_beroep":
      return ["administratief beroep genoemd"];
    case "rechtstreeks_beroep":
      return ["rechtstreeks beroep of beroep zonder bezwaar genoemd"];
    case "beroep_rechtbank":
      return ["beroep bij de rechtbank genoemd"];
    case "zienswijze":
      return ["ontwerpbesluit of zienswijze genoemd"];
    case "woo":
      return ["WOO, Wob of openbaarmaking genoemd"];
    case "onbekend":
      return ["geen duidelijke rechtsmiddelenclausule gevonden"];
    default:
      return [];
  }
}

export function sanitizeDecisionProcedureDetection(
  value: unknown,
  extraction?: Partial<DecisionExtractionResult>
): DecisionProcedureDetection | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const procedure = normalizeDecisionProcedureKind(
    record.procedure ?? record.kind ?? record.type ?? record.procedureType
  );

  if (!procedure) {
    return null;
  }

  const text = extraction ? joinDecisionText(extraction) : "";
  const confidence = sanitizeConfidence(record.confidence ?? record.confidenceScore ?? record.score);
  const explanation =
    sanitizeOptionalString(record.explanation ?? record.uitleg ?? record.reason ?? record.reden, 360) ??
    defaultExplanation(procedure);
  const evidence = uniqueStrings([
    ...sanitizeEvidence(record.evidence ?? record.signalen ?? record.signals ?? record.bewijs),
    ...getDomainEvidence(text),
  ]).slice(0, 6);
  const suggestedFlow =
    sanitizeSuggestedFlow(record.suggestedFlow ?? record.flow ?? record.route) ??
    mapProcedureToFlow(procedure, extraction);

  return {
    procedure,
    confidence,
    explanation,
    evidence: evidence.length > 0 ? evidence : defaultEvidence(procedure),
    suggestedFlow,
  };
}

function buildDetection(params: {
  extraction: Partial<DecisionExtractionResult>;
  procedure: DecisionProcedureKind;
  confidence: number;
  explanation: string;
  evidence: string[];
  suggestedFlow?: DecisionProcedureFlow | null;
}): DecisionProcedureDetection {
  const text = joinDecisionText(params.extraction);

  return {
    procedure: params.procedure,
    confidence: clampConfidence(params.confidence),
    explanation: trimLength(params.explanation, 360),
    evidence: uniqueStrings([...params.evidence, ...getDomainEvidence(text)]).slice(0, 6),
    suggestedFlow: params.suggestedFlow ?? mapProcedureToFlow(params.procedure, params.extraction),
  };
}

export function inferDecisionProcedureDetection(
  extraction: Partial<DecisionExtractionResult>
): DecisionProcedureDetection {
  const fullText = joinDecisionText(extraction);
  const leadingText = getLeadingDecisionText(extraction);

  const hasDecisionOnObjection = getDecisionOnObjectionSignal(fullText);
  const hasObjectionClause = getObjectionClauseSignal(fullText);
  const hasAppealClause = getAppealClauseSignal(fullText);
  const hasCourtAppeal = getCourtAppealSignal(fullText);
  const hasDirectAppeal = getDirectAppealSignal(fullText);
  const hasAdministrativeAppeal = getAdministrativeAppealSignal(fullText);
  const hasDraftDecision = getDraftDecisionSignal(leadingText, extraction);
  const mentionsZienswijze = /\bzienswijze(n)?\b/.test(fullText);
  const mentionsWoo = getWooSignal(fullText);

  if (hasDraftDecision && mentionsZienswijze) {
    return buildDetection({
      extraction,
      procedure: "zienswijze",
      confidence: 93,
      explanation:
        "Het document lijkt een ontwerpbesluit te zijn waarbij een zienswijze naar voren kan worden gebracht.",
      evidence: ["ontwerpbesluit genoemd", "zienswijze genoemd"],
      suggestedFlow: "zienswijze",
    });
  }

  if (hasDecisionOnObjection) {
    return buildDetection({
      extraction,
      procedure: "beroep_rechtbank",
      confidence: 94,
      explanation:
        "Het document lijkt een beslissing op bezwaar. De volgende stap is waarschijnlijk beroep bij de rechtbank.",
      evidence: ["beslissing op bezwaar herkend", hasAppealClause ? "beroepsclausule aanwezig" : ""],
      suggestedFlow: "beroep_na_bezwaar",
    });
  }

  if (hasAdministrativeAppeal) {
    return buildDetection({
      extraction,
      procedure: "administratief_beroep",
      confidence: 88,
      explanation:
        "Het document lijkt administratief beroep te noemen. Dat is iets anders dan bezwaar of beroep bij de rechtbank.",
      evidence: ["administratief beroep of beroep bij een bestuursorgaan genoemd"],
      suggestedFlow: null,
    });
  }

  if (hasDirectAppeal) {
    return buildDetection({
      extraction,
      procedure: "rechtstreeks_beroep",
      confidence: 90,
      explanation:
        "Het document lijkt aan te geven dat rechtstreeks beroep openstaat, zonder eerst bezwaar te maken.",
      evidence: [
        "rechtstreeks beroep of beroep zonder bezwaar genoemd",
        hasAppealClause ? "beroepsclausule aanwezig" : "",
      ],
      suggestedFlow: "beroep_zonder_bezwaar",
    });
  }

  if (hasAppealClause && hasCourtAppeal) {
    return buildDetection({
      extraction,
      procedure: "beroep_rechtbank",
      confidence: 84,
      explanation:
        "Het document verwijst naar beroep bij de rechtbank. Controleer of dit rechtstreeks beroep is of beroep na bezwaar.",
      evidence: ["beroepsclausule aanwezig", "rechtbank genoemd"],
      suggestedFlow: "beroep_zonder_bezwaar",
    });
  }

  if (hasObjectionClause && !hasAppealClause) {
    return buildDetection({
      extraction,
      procedure: "bezwaar",
      confidence: 92,
      explanation:
        "Het document lijkt een bezwaarclausule te bevatten. Waarschijnlijk staat eerst bezwaar open.",
      evidence: [
        "bezwaarclausule aanwezig",
        /\bzes weken\b|\b6 weken\b/.test(fullText) ? "termijn van 6 weken genoemd" : "",
        /\bbestuursorgaan\b|\bcollege van burgemeester en wethouders\b|\buwv\b|\bgemeente\b|\bminister\b/.test(fullText)
          ? "besluit van bestuursorgaan"
          : "",
      ],
      suggestedFlow: "bezwaar",
    });
  }

  if (hasAppealClause) {
    return buildDetection({
      extraction,
      procedure: "beroep_rechtbank",
      confidence: 76,
      explanation:
        "Het document lijkt naar beroep te verwijzen, maar de precieze beroepsroute is niet helemaal zeker.",
      evidence: ["beroepsclausule aanwezig"],
      suggestedFlow: "beroep_zonder_bezwaar",
    });
  }

  if (hasDraftDecision || mentionsZienswijze) {
    return buildDetection({
      extraction,
      procedure: "zienswijze",
      confidence: hasDraftDecision ? 82 : 74,
      explanation:
        "Het document bevat signalen voor een ontwerpbesluit of zienswijze. Controleer of nog geen definitief besluit is genomen.",
      evidence: [
        hasDraftDecision ? "ontwerpbesluit genoemd" : "",
        mentionsZienswijze ? "zienswijze genoemd" : "",
      ],
      suggestedFlow: "zienswijze",
    });
  }

  if (mentionsWoo) {
    return buildDetection({
      extraction,
      procedure: "woo",
      confidence: 72,
      explanation:
        "Het document lijkt een WOO- of openbaarmakingsprocedure te betreffen, maar de volgende rechtsmiddelstap is niet duidelijk genoeg.",
      evidence: ["WOO, Wob of openbaarmaking genoemd"],
      suggestedFlow: null,
    });
  }

  return buildDetection({
    extraction,
    procedure: "onbekend",
    confidence: 35,
    explanation:
      "De tool heeft het document gelezen, maar kan niet betrouwbaar vaststellen welke procedure openstaat.",
    evidence: ["geen duidelijke bezwaar-, beroep- of zienswijzeclausule gevonden"],
    suggestedFlow: null,
  });
}

function getDetectionForAssessment(extraction: DecisionExtractionResult): DecisionProcedureDetection {
  return (
    sanitizeDecisionProcedureDetection(extraction.procedureDetection, extraction) ??
    inferDecisionProcedureDetection(extraction)
  );
}

function asDecisionProcedureFlow(flow?: Flow | null): DecisionProcedureFlow | null {
  if (!flow || flow === "woo") {
    return null;
  }

  return flow;
}

function buildAssessment(params: {
  selectedFlow: Flow;
  detection: DecisionProcedureDetection;
}): DecisionProcedureAssessment {
  const { selectedFlow, detection } = params;
  const suggestedFlow = asDecisionProcedureFlow(detection.suggestedFlow);
  const selectedFlowGroup = getSelectedFlowGroup(selectedFlow);
  const matchedSelectedFlow = Boolean(suggestedFlow && suggestedFlow === selectedFlowGroup);
  const confidence = clampConfidence(detection.confidence);
  const shouldAutoSwitch = Boolean(
    suggestedFlow && !matchedSelectedFlow && confidence >= AUTO_SWITCH_THRESHOLD
  );
  const shouldConfirmSwitch = Boolean(
    suggestedFlow &&
      !matchedSelectedFlow &&
      confidence >= LOW_CONFIDENCE_THRESHOLD &&
      confidence < AUTO_SWITCH_THRESHOLD
  );
  const alertType =
    confidence < LOW_CONFIDENCE_THRESHOLD || detection.procedure === "onbekend"
      ? "warning"
      : matchedSelectedFlow
        ? "success"
        : suggestedFlow
          ? "warning"
          : "info";

  return {
    detectedProcedure: {
      ...detection,
      confidence,
      suggestedFlow,
    },
    suggestedFlow,
    confidence,
    matchedSelectedFlow,
    shouldAutoSwitch,
    shouldConfirmSwitch,
    alertType,
    title: "Waarschijnlijk juiste procedure",
    explanation: detection.explanation,
    evidence: detection.evidence.length > 0 ? detection.evidence : defaultEvidence(detection.procedure),
  };
}

export function assessDecisionProcedure(params: {
  selectedFlow: Flow;
  extraction: DecisionExtractionResult;
}): DecisionProcedureAssessment {
  return buildAssessment({
    selectedFlow: params.selectedFlow,
    detection: getDetectionForAssessment(params.extraction),
  });
}

export function getDecisionProcedureKindLabel(procedure: DecisionProcedureKind): string {
  return PROCEDURE_LABELS[procedure];
}

export function getDecisionProcedureDetectionLabel(detection: DecisionProcedureDetection): string {
  return getDecisionProcedureKindLabel(detection.procedure);
}

export function isLowConfidenceProcedureAssessment(assessment: DecisionProcedureAssessment): boolean {
  return assessment.confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function buildDecisionProcedureSwitchPrompt(assessment: DecisionProcedureAssessment): string {
  if (!assessment.suggestedFlow) {
    return assessment.explanation;
  }

  return `${assessment.explanation} Wilt u overschakelen naar ${getFlowLabel(
    assessment.suggestedFlow
  )}? Antwoord met 'ja' of 'nee'.`;
}
