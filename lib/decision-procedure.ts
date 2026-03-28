import { getFlowActionLabel } from "@/lib/flow";
import { DecisionExtractionResult, Flow } from "@/types";

type DecisionProcedureFlow = Exclude<Flow, "woo">;
type DecisionProcedureConfidence = "high" | "medium" | "low";

export interface DecisionProcedureAssessment {
  suggestedFlow: DecisionProcedureFlow | null;
  confidence: DecisionProcedureConfidence;
  matchedSelectedFlow: boolean;
  shouldAutoSwitch: boolean;
  shouldConfirmSwitch: boolean;
  alertType: "info" | "warning" | "success";
  title: string;
  explanation: string;
  evidence: string[];
}

function joinDecisionText(extraction: DecisionExtractionResult): string {
  return [
    extraction.documentType,
    extraction.samenvatting,
    extraction.decisionAnalysis?.onderwerp,
    extraction.decisionAnalysis?.besluitInhoud,
    extraction.decisionAnalysis?.termijnen,
    extraction.extractedText,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function getLeadingDecisionText(extraction: DecisionExtractionResult): string {
  return [
    extraction.documentType,
    extraction.samenvatting,
    extraction.extractedText?.slice(0, 1800),
  ]
    .filter(Boolean)
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

function buildAssessment(params: {
  selectedFlow: Flow;
  suggestedFlow: DecisionProcedureFlow | null;
  confidence: DecisionProcedureConfidence;
  title: string;
  explanation: string;
  evidence: string[];
}): DecisionProcedureAssessment {
  const { selectedFlow, suggestedFlow, confidence, title, explanation, evidence } = params;
  const selectedFlowGroup = getSelectedFlowGroup(selectedFlow);
  const matchedSelectedFlow = Boolean(suggestedFlow && suggestedFlow === selectedFlowGroup);
  const shouldAutoSwitch = Boolean(suggestedFlow && !matchedSelectedFlow && confidence === "high");
  const shouldConfirmSwitch = Boolean(suggestedFlow && !matchedSelectedFlow && confidence !== "high");

  return {
    suggestedFlow,
    confidence,
    matchedSelectedFlow,
    shouldAutoSwitch,
    shouldConfirmSwitch,
    alertType: matchedSelectedFlow ? "success" : suggestedFlow ? "warning" : "info",
    title,
    explanation,
    evidence,
  };
}

export function assessDecisionProcedure(params: {
  selectedFlow: Flow;
  extraction: DecisionExtractionResult;
}): DecisionProcedureAssessment {
  const { selectedFlow, extraction } = params;
  const fullText = joinDecisionText(extraction);
  const leadingText = getLeadingDecisionText(extraction);

  const hasDecisionOnObjection =
    /\b(beslissing|besluit) op bezwaar\b/.test(fullText) ||
    /\buw bezwaar\b.{0,80}\b(ongegrond|gegrond|niet-ontvankelijk|deels gegrond)\b/.test(fullText) ||
    /\bnaar aanleiding van uw bezwaar\b/.test(fullText);
  const hasObjectionClause =
    /\b(bezwaar maken|bezwaar indienen|bezwaarschrift|bezwaartermijn)\b/.test(fullText) ||
    /\bbinnen\s+\d+\s*(dagen|weken|maanden)\b.{0,80}\bbezwaar\b/.test(fullText);
  const hasAppealClause =
    /\b(beroep instellen|in beroep gaan|beroepschrift|rechtstreeks beroep|beroep openstaat)\b/.test(fullText) ||
    /\bbinnen\s+\d+\s*(dagen|weken|maanden)\b.{0,80}\bberoep\b/.test(fullText);
  const hasDraftDecision =
    /\bontwerpbesluit\b/.test(leadingText) ||
    /\bontwerpbeschikking\b/.test(leadingText) ||
    extraction.documentType?.toLowerCase().includes("ontwerp") === true;
  const mentionsZienswijze = /\bzienswijze(n)?\b/.test(fullText);
  const mentionsDirectAppeal = /\brechtstreeks beroep\b/.test(fullText);

  if (hasDecisionOnObjection) {
    return buildAssessment({
      selectedFlow,
      suggestedFlow: "beroep_na_bezwaar",
      confidence: "high",
      title: "Routecontrole op basis van uw besluit",
      explanation:
        "Op basis van het besluit lijkt dit een beslissing op bezwaar. Waarschijnlijk hoort deze zaak daarom in de beroepsfase na bezwaar.",
      evidence: ["Het document lijkt een beslissing op bezwaar te zijn."],
    });
  }

  if (hasAppealClause && (mentionsDirectAppeal || hasDraftDecision || mentionsZienswijze) && !hasObjectionClause) {
    return buildAssessment({
      selectedFlow,
      suggestedFlow: "beroep_zonder_bezwaar",
      confidence: mentionsDirectAppeal ? "high" : "medium",
      title: "Routecontrole op basis van uw besluit",
      explanation:
        "Op basis van het besluit lijkt direct beroep open te staan. Controleer dit goed; het document verwijst waarschijnlijk naar beroep in plaats van bezwaar.",
      evidence: [
        mentionsDirectAppeal
          ? "Het besluit noemt rechtstreeks beroep."
          : "Het besluit lijkt naar beroep te verwijzen.",
        hasDraftDecision || mentionsZienswijze
          ? "Er zijn signalen van een ontwerpbesluit- of zienswijzetraject."
          : "Er is geen duidelijke bezwaaraanwijzing gevonden.",
      ].filter(Boolean),
    });
  }

  if (hasAppealClause && !hasObjectionClause) {
    return buildAssessment({
      selectedFlow,
      suggestedFlow: "beroep_zonder_bezwaar",
      confidence: "medium",
      title: "Routecontrole op basis van uw besluit",
      explanation:
        "Op basis van het besluit lijkt beroep open te staan. Dat lijkt aannemelijk, maar controleer dit goed in de rechtsmiddelenclausule van het document.",
      evidence: ["Het besluit lijkt naar beroep te verwijzen."],
    });
  }

  if (hasObjectionClause && !hasAppealClause) {
    return buildAssessment({
      selectedFlow,
      suggestedFlow: "bezwaar",
      confidence: "high",
      title: "Routecontrole op basis van uw besluit",
      explanation:
        "Op basis van het besluit lijkt eerst bezwaar open te staan. Controleer dit goed; het document verwijst waarschijnlijk naar bezwaar als volgende stap.",
      evidence: ["Onder het besluit lijkt te staan dat bezwaar openstaat."],
    });
  }

  if (hasDraftDecision && !hasAppealClause && !hasObjectionClause) {
    return buildAssessment({
      selectedFlow,
      suggestedFlow: "zienswijze",
      confidence: "high",
      title: "Routecontrole op basis van uw besluit",
      explanation:
        "Op basis van het document lijkt dit om een ontwerpbesluit te gaan. Waarschijnlijk past een zienswijze beter dan bezwaar of beroep.",
      evidence: ["Het document lijkt een ontwerpbesluit te zijn."],
    });
  }

  if (mentionsZienswijze && !hasAppealClause && !hasObjectionClause) {
    return buildAssessment({
      selectedFlow,
      suggestedFlow: "zienswijze",
      confidence: "medium",
      title: "Routecontrole op basis van uw besluit",
      explanation:
        "Op basis van het document lijkt een zienswijze mogelijk relevant. Dat is niet helemaal zeker, dus controleer goed of het document echt een ontwerpbesluit betreft.",
      evidence: ["Het document verwijst naar een zienswijze."],
    });
  }

  return buildAssessment({
    selectedFlow,
    suggestedFlow: null,
    confidence: "low",
    title: "Routecontrole op basis van uw besluit",
    explanation:
      "De tool heeft het document gelezen, maar kan nog niet betrouwbaar vaststellen of bezwaar, beroep of zienswijze de juiste route is. Controleer de rechtsmiddelenclausule daarom goed zelf.",
    evidence: [],
  });
}

export function buildDecisionProcedureSwitchPrompt(assessment: DecisionProcedureAssessment): string {
  if (!assessment.suggestedFlow) {
    return assessment.explanation;
  }

  return `${assessment.explanation} Wilt u overschakelen naar ${getFlowActionLabel(
    assessment.suggestedFlow
  ).toLowerCase()}? Antwoord met 'ja' of 'nee'.`;
}
