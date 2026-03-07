import { Flow, IntakeFormData } from "@/types";
import { CaseClassificationResult, CaseType } from "@/lib/legal/types";

function normalizeText(value?: string): string {
  return (value ?? "").toLowerCase();
}

function combineSignals(data: IntakeFormData): string {
  return [
    data.bestuursorgaan,
    data.categorie,
    data.doel,
    data.gronden,
    data.wooOnderwerp,
    data.wooPeriode,
    data.wooDocumenten,
    data.kenmerk,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreCaseType(haystack: string, categorie: string): Array<{ caseType: CaseType; score: number; reason: string }> {
  const scores: Array<{ caseType: CaseType; score: number; reason: string }> = [];

  const pushIfMatch = (caseType: CaseType, score: number, reason: string, regex: RegExp) => {
    if (regex.test(haystack)) {
      scores.push({ caseType, score, reason });
    }
  };

  pushIfMatch(
    "omgevingswet_vergunning",
    0.9,
    "Trefwoorden voor vergunning/omgevingswet gedetecteerd.",
    /(omgevingswet|omgevingsvergunning|omgevingsplan|bopa|dakkapel|bouwvergunning|vergunning)/
  );

  pushIfMatch(
    "verkeersboete",
    0.9,
    "Trefwoorden voor Mulder/verkeersboete gedetecteerd.",
    /(verkeersboete|mulder|cjib|kenteken|rood licht|snelheidsovertreding|fout parkeren)/
  );

  pushIfMatch(
    "taakstraf",
    0.9,
    "Trefwoorden voor taakstraf/strafbeschikking gedetecteerd.",
    /(taakstraf|omzettingskennisgeving|vervangende hechtenis|strafbeschikking|verzet)/
  );

  pushIfMatch(
    "belastingaanslag",
    0.9,
    "Trefwoorden voor fiscale beschikking gedetecteerd.",
    /(belasting|aanslag|fiscaal|naheffing|inkomstenbelasting|woz)/
  );

  pushIfMatch(
    "uwv_uitkering",
    0.9,
    "Trefwoorden voor UWV-uitkering gedetecteerd.",
    /(uwv|uitkering|ww\b|wia|wajong|wao|ziektewet)/
  );

  pushIfMatch(
    "toeslag",
    0.9,
    "Trefwoorden voor toeslagbesluit gedetecteerd.",
    /(toeslag|kinderopvangtoeslag|zorgtoeslag|huurtoeslag|kindgebonden budget|uht|herstel)/
  );

  if (categorie === "vergunning") {
    scores.push({
      caseType: "omgevingswet_vergunning",
      score: 0.75,
      reason: "Categorie 'vergunning' wijst op omgevingsvergunningroute.",
    });
  }

  if (categorie === "boete") {
    scores.push({
      caseType: "verkeersboete",
      score: 0.65,
      reason: "Categorie 'boete' gebruikt als verkeersboete-signaal.",
    });
  }

  if (categorie === "belasting") {
    scores.push({
      caseType: "belastingaanslag",
      score: 0.8,
      reason: "Categorie 'belasting' wijst op fiscale route.",
    });
  }

  if (categorie === "uitkering") {
    scores.push({
      caseType: "uwv_uitkering",
      score: 0.8,
      reason: "Categorie 'uitkering' wijst op UWV-route.",
    });
  }

  return scores;
}

export function classifyCase(input: {
  flow: Flow;
  intakeData: IntakeFormData;
}): CaseClassificationResult {
  const { flow, intakeData } = input;

  if (flow === "woo") {
    return {
      caseType: "woo",
      confidence: 0.98,
      reasons: ["Flow 'woo' geselecteerd in intake."],
      needsClarification: false,
    };
  }

  const haystack = combineSignals(intakeData);
  const categorie = normalizeText(intakeData.categorie);
  const scored = scoreCaseType(haystack, categorie).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.7) {
    return {
      caseType: "onzeker_handmatige_triage",
      confidence: best?.score ?? 0.3,
      reasons: [
        "Zaaktype onvoldoende zeker geclassificeerd op basis van intake.",
        ...(best ? [best.reason] : []),
      ],
      needsClarification: true,
    };
  }

  return {
    caseType: best.caseType,
    confidence: Math.min(0.99, best.score),
    reasons: [best.reason],
    needsClarification: best.score < 0.8,
  };
}
