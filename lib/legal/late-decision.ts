import { IntakeFormData } from "@/types";

export interface LateDecisionDossierSignals {
  isLateDecision: boolean;
  isWoo: boolean;
  procedureType: "aanvraag" | "bezwaar" | "woo" | "onbekend";
  hasDeadlineSignal: boolean;
  hasSuspensionOrExtensionSignal: boolean;
  hasIngebrekestelling: boolean;
  hasReceiptEvidence: boolean;
  hasTwoWeekWaitSignal: boolean;
  laterDecisionDetected: boolean;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildEvidenceHaystack(intakeData: IntakeFormData): string {
  const decisionAnalysis = intakeData.besluitAnalyse;

  return normalizeWhitespace(
    [
      intakeData.bestuursorgaan,
      intakeData.datumBesluit,
      intakeData.kenmerk,
      intakeData.besluitSamenvatting,
      intakeData.besluitTekst,
      intakeData.besluitDocumentType,
      intakeData.procedureReden,
      intakeData.gronden,
      intakeData.doel,
      intakeData.eerdereBezwaargronden,
      decisionAnalysis?.onderwerp,
      decisionAnalysis?.rechtsgrond,
      decisionAnalysis?.besluitInhoud,
      decisionAnalysis?.termijnen,
      ...(decisionAnalysis?.dragendeOverwegingen ?? []).flatMap((item) => [item.passage, item.duiding]),
      ...(decisionAnalysis?.wettelijkeGrondslagen ?? []),
      ...(decisionAnalysis?.procedureleAanwijzingen ?? []),
      ...(decisionAnalysis?.aandachtspunten ?? []),
      ...(intakeData.files?.bijlagen ?? []).flatMap((file) => [file.name, file.extractedText ?? ""]),
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase()
  );
}

export function detectLateDecisionSignals(intakeData: IntakeFormData): LateDecisionDossierSignals {
  const haystack = buildEvidenceHaystack(intakeData);
  const isWoo = intakeData.flow === "woo" || /\bwoo\b|wet open overheid/.test(haystack);
  const isLateDecision =
    Boolean(intakeData.nietTijdigBeslissen) ||
    intakeData.procedureAdvies === "niet_tijdig_beslissen" ||
    /\b(niet tijdig|te laat beslis|ingebrekestelling|beroep wegens niet tijdig|dwangsom bij niet tijdig)\b/.test(
      haystack
    );
  const procedureType = isWoo
    ? "woo"
    : Boolean(intakeData.heeftBezwaarGemaakt) ||
        /\bbezwaarschrift\b|\bbezwaar\b|beslissing op bezwaar/.test(haystack)
      ? "bezwaar"
      : /\baanvraag\b|\bverzoek\b/.test(haystack)
        ? "aanvraag"
        : "onbekend";

  return {
    isLateDecision,
    isWoo,
    procedureType,
    hasDeadlineSignal:
      /\b(beslistermijn|termijn.*verstreken|uiterste beslisdatum|wettelijke termijn|verdaagd|verdaging|opgeschort|opschorting)\b/.test(
        haystack
      ) || Boolean(intakeData.besluitAnalyse?.termijnen),
    hasSuspensionOrExtensionSignal:
      /\b(verdaging|verdaagd|opschorting|opgeschort|aanvullingsverzoek|verzuimherstel)\b/.test(haystack),
    hasIngebrekestelling: /\bingebrekestelling\b/.test(haystack),
    hasReceiptEvidence:
      /\b(ontvangstbevestiging|bewijs van ontvangst|track.?and.?trace|aangetekend|bezorgbevestiging|e-mailheaders?|bevestigd ontvangen|postnl|afgeleverd)\b/.test(
        haystack
      ),
    hasTwoWeekWaitSignal:
      /\b(twee weken verstreken|14 dagen verstreken|veertien dagen verstreken|minstens twee weken|meer dan twee weken|na twee weken)\b/.test(
        haystack
      ),
    laterDecisionDetected:
      /\b(intussen al besloten|besluit inmiddels genomen|inmiddels besloten|later besluit|beslissing inmiddels ontvangen|alsnog beslist|alsnog een besluit genomen)\b/.test(
        haystack
      ),
  };
}

export function evaluateLateDecisionGate(intakeData: IntakeFormData): {
  hardBlockers: string[];
  softSignals: string[];
  auditTrail: string[];
} {
  const signals = detectLateDecisionSignals(intakeData);
  const hardBlockers: string[] = [];
  const softSignals: string[] = [];

  if (!signals.isLateDecision) {
    return {
      hardBlockers,
      softSignals,
      auditTrail: ["Late-decision gate skipped: dossier is niet als niet-tijdig gedetecteerd."],
    };
  }

  if (signals.laterDecisionDetected) {
    hardBlockers.push("late_decision_already_decided");
  }

  if (!signals.hasDeadlineSignal) {
    hardBlockers.push("late_decision_deadline_unverified");
  }

  if (!signals.hasIngebrekestelling) {
    hardBlockers.push("late_decision_missing_ingebrekestelling");
  }

  if (signals.hasIngebrekestelling && !signals.hasReceiptEvidence) {
    hardBlockers.push("late_decision_receipt_unverified");
  }

  if (!signals.hasTwoWeekWaitSignal) {
    hardBlockers.push("late_decision_two_week_wait_unverified");
  }

  if (signals.hasSuspensionOrExtensionSignal) {
    softSignals.push("late_decision_possible_suspension");
  }

  if (signals.procedureType === "onbekend") {
    softSignals.push("late_decision_procedure_type_uncertain");
  }

  return {
    hardBlockers,
    softSignals,
    auditTrail: [
      `Late-decision gate active: procedureType=${signals.procedureType}, woo=${signals.isWoo ? "yes" : "no"}.`,
      `Signals: deadline=${signals.hasDeadlineSignal ? "yes" : "no"}, ingebrekestelling=${signals.hasIngebrekestelling ? "yes" : "no"}, receipt=${signals.hasReceiptEvidence ? "yes" : "no"}, twoWeeks=${signals.hasTwoWeekWaitSignal ? "yes" : "no"}, laterDecision=${signals.laterDecisionDetected ? "yes" : "no"}, suspension=${signals.hasSuspensionOrExtensionSignal ? "yes" : "no"}.`,
    ],
  };
}
