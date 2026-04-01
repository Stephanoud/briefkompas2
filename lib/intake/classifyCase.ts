import { Flow, IntakeFormData } from "@/types";
import { CaseClassificationResult, CaseType } from "@/lib/legal/types";
import { detectLateDecisionSignals } from "@/lib/legal/late-decision";

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

function combineDocumentSignals(data: IntakeFormData): string {
  return [
    data.besluitDocumentType,
    data.besluitSamenvatting,
    data.besluitTekst?.slice(0, 4000),
    data.besluitAnalyse?.onderwerp,
    data.besluitAnalyse?.rechtsgrond,
    data.besluitAnalyse?.besluitInhoud,
    data.besluitAnalyse?.termijnen,
    ...(data.besluitAnalyse?.dragendeOverwegingen ?? []).flatMap((item) => [item.passage, item.duiding]),
    ...(data.besluitAnalyse?.wettelijkeGrondslagen ?? []),
    ...(data.besluitAnalyse?.procedureleAanwijzingen ?? []),
    ...(data.besluitAnalyse?.beleidsReferenties ?? []),
    ...(data.besluitAnalyse?.jurisprudentieReferenties ?? []),
    ...(data.besluitAnalyse?.bijlageReferenties ?? []),
    ...(data.besluitAnalyse?.aandachtspunten ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasCrossRegimeCareSignals(value: string): boolean {
  return /(jeugdwet|jeugdhulp|jeugdige|wlz|wet langdurige zorg|zorgkantoor|zvw|zorgverzekeringswet|wijkverpleging)/.test(
    value
  );
}

function hasCoreEnforcementSignals(value: string): boolean {
  return /(handhavingsverzoek|handhaving|last onder dwangsom|bestuursdwang|invordering|begunstigingstermijn|sanctiebesluit)/.test(
    value
  );
}

function hasPermitDecisionSignals(value: string): boolean {
  return /(vergunningaanvraag|aanvraag om vergunning|verlening van vergunning|weigering van vergunning|omgevingsvergunning|vergunning verleend|vergunning geweigerd)/.test(
    value
  );
}

function hasTaxSignals(value: string): boolean {
  return /(inspecteur|aanslag|navorderingsaanslag|naheffingsaanslag|vergrijpboete|verzuimboete|omkering van de bewijslast|omkering bewijslast|bewijslast|pleitbaar standpunt|aangifte|inkomstenbelasting|vennootschapsbelasting|omzetbelasting|btw|loonheffing|ib\/pvv|fisc)/.test(
    value
  );
}

function hasToeslagenSignals(value: string): boolean {
  return /(toeslag|toeslagen|kinderopvangtoeslag|zorgtoeslag|huurtoeslag|kindgebonden budget|dienst toeslagen|definitieve berekening|terugvordering|voorschot)/.test(
    value
  );
}

function scoreCaseType(haystack: string, categorie: string): Array<{ caseType: CaseType; score: number; reason: string }> {
  const scores: Array<{ caseType: CaseType; score: number; reason: string }> = [];

  const pushIfMatch = (caseType: CaseType, score: number, reason: string, regex: RegExp) => {
    if (regex.test(haystack)) {
      scores.push({ caseType, score, reason });
    }
  };

  pushIfMatch(
    "niet_ontvankelijkheid",
    0.95,
    "Trefwoorden voor niet-ontvankelijkheid gedetecteerd.",
    /(niet[- ]ontvankelijk|niet[- ]ontvankelijkheid|termijnoverschrijding.*niet[- ]ontvankelijk|geen belanghebbende.*niet[- ]ontvankelijk|geen besluit.*niet[- ]ontvankelijk|herstelverzuim|6[:.]6\s*awb|machtiging ontbreekt|gronden ontbreken)/
  );

  pushIfMatch(
    "bestuurlijke_boete",
    0.88,
    "Trefwoorden voor bestuurlijke boete gedetecteerd.",
    /(bestuurlijke boete|boetebesluit|boetebedrag|boetehoogte|artikel\s*5[:.]46|5[:.]46\s*awb|afwezigheid van alle schuld)/
  );

  pushIfMatch(
    "wmo_pgb",
    0.9,
    "Trefwoorden voor Wmo/PGB gedetecteerd.",
    /(wmo|wet maatschappelijke ondersteuning|maatwerkvoorziening|persoonsgebonden budget|pgb|keukentafelgesprek|onderzoeksverslag|zorg in natura|sociaal netwerk|ondersteuningsbehoefte|huishoudelijke hulp)/
  );

  pushIfMatch(
    "handhaving",
    0.9,
    "Trefwoorden voor handhaving gedetecteerd.",
    /(handhavingsverzoek|handhaving|last onder dwangsom|bestuursdwang|invordering|begunstigingstermijn|overtredingsnorm|concreet zicht op legalisatie|sanctiebesluit)/
  );

  pushIfMatch(
    "omgevingswet_vergunning",
    0.9,
    "Trefwoorden voor vergunning/omgevingswet gedetecteerd.",
    /(omgevingswet|omgevingsvergunning|omgevingsplan|bopa|dakkapel|bouwvergunning|vergunning)/
  );

  pushIfMatch(
    "verkeersboete",
    0.92,
    "Trefwoorden voor Mulder/verkeersboete gedetecteerd.",
    /(verkeersboete|mulder|cjib|wahv|kenteken|rood licht|snelheidsovertreding|fout parkeren)/
  );

  pushIfMatch(
    "taakstraf",
    0.9,
    "Trefwoorden voor taakstraf/strafbeschikking gedetecteerd.",
    /(taakstraf|omzettingskennisgeving|vervangende hechtenis|strafbeschikking|verzet)/
  );

  pushIfMatch(
    "belastingaanslag",
    0.94,
    "Trefwoorden voor fiscale beschikking gedetecteerd.",
    /(inspecteur|aanslag|navorderingsaanslag|naheffingsaanslag|vergrijpboete|verzuimboete|omkering van de bewijslast|omkering bewijslast|pleitbaar standpunt|aangifte|inkomstenbelasting|vennootschapsbelasting|omzetbelasting|btw|loonheffing|ib\/pvv|fiscaal|naheffing|woz)/
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
      caseType: "bestuurlijke_boete",
      score: 0.72,
      reason: "Categorie 'boete' wijst voorlopig op de module bestuurlijke boete zolang Mulder/CJIB-signalen ontbreken.",
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

function rankCaseTypeScores(
  haystack: string,
  categorie: string
): Array<{ caseType: CaseType; score: number; reason: string }> {
  return scoreCaseType(haystack, categorie).sort((a, b) => b.score - a.score);
}

export function classifyCase(input: {
  flow: Flow;
  intakeData: IntakeFormData;
}): CaseClassificationResult {
  const { flow, intakeData } = input;
  const lateDecisionSignals = detectLateDecisionSignals(intakeData);

  if (lateDecisionSignals.isLateDecision) {
    return {
      caseType: "niet_tijdig_beslissen",
      confidence: 0.97,
      reasons: [
        lateDecisionSignals.isWoo
          ? "Dossier wijst op niet tijdig beslissen in een Woo-context."
          : "Dossier wijst op niet tijdig beslissen als aparte Awb-route.",
      ],
      needsClarification: lateDecisionSignals.procedureType === "onbekend",
    };
  }

  if (flow === "woo") {
    return {
      caseType: "woo",
      confidence: 0.98,
      reasons: ["Flow 'woo' geselecteerd in intake."],
      needsClarification: false,
    };
  }

  const haystack = combineSignals(intakeData);
  const documentHaystack = combineDocumentSignals(intakeData);
  const categorie = normalizeText(intakeData.categorie);
  const scored = rankCaseTypeScores(haystack, categorie);
  const documentScored = rankCaseTypeScores(documentHaystack, categorie);

  const best = scored[0];
  const bestDocument = documentScored[0];
  const careConflictDetected =
    (best?.caseType === "wmo_pgb" || bestDocument?.caseType === "wmo_pgb") &&
    (hasCrossRegimeCareSignals(haystack) || hasCrossRegimeCareSignals(documentHaystack));
  const permitConflictDetected =
    (best?.caseType === "handhaving" || bestDocument?.caseType === "handhaving") &&
    (hasPermitDecisionSignals(haystack) || hasPermitDecisionSignals(documentHaystack)) &&
    !hasCoreEnforcementSignals(`${haystack} ${documentHaystack}`);
  const taxBoeteSignalsDetected =
    (best?.caseType === "bestuurlijke_boete" || bestDocument?.caseType === "bestuurlijke_boete") &&
    (hasTaxSignals(haystack) || hasTaxSignals(documentHaystack));
  const toeslagenDetected =
    (best?.caseType === "toeslag" || bestDocument?.caseType === "toeslag") &&
    (hasToeslagenSignals(haystack) || hasToeslagenSignals(documentHaystack));

  if (careConflictDetected) {
    return {
      caseType: "onzeker_handmatige_triage",
      confidence: Math.max(best?.score ?? 0.3, bestDocument?.score ?? 0.3),
      reasons: [
        "Documentsignalen of intake wijzen deels op Wmo/PGB, maar ook op een andere zorgregeling zoals Jeugdwet, Wlz of Zvw.",
        "Geen Wmo-module afdwingen zolang de onderliggende zorgwet niet zeker is.",
      ],
      needsClarification: true,
    };
  }

  if (permitConflictDetected) {
    return {
      caseType: "onzeker_handmatige_triage",
      confidence: Math.max(best?.score ?? 0.3, bestDocument?.score ?? 0.3),
      reasons: [
        "Documentsignalen of intake wijzen eerder op verlening of weigering van een vergunning dan op een handhavingsbesluit of handhavingsverzoek.",
        "Geen handhavingsmodule afdwingen zolang niet duidelijk is dat het echt om handhaving gaat.",
      ],
      needsClarification: true,
    };
  }

  if (taxBoeteSignalsDetected) {
    return {
      caseType: "belastingaanslag",
      confidence: Math.max(best?.score ?? 0.8, bestDocument?.score ?? 0.8),
      reasons: [
        "De stukken wijzen op een fiscale aanslag of belastingboete; daarom blijft deze zaak in de belastingmodule.",
      ],
      needsClarification: false,
    };
  }

  if (toeslagenDetected && !hasTaxSignals(`${haystack} ${documentHaystack}`)) {
    return {
      caseType: "toeslag",
      confidence: Math.max(best?.score ?? 0.85, bestDocument?.score ?? 0.85),
      reasons: [
        "De stukken wijzen op een toeslagenbesluit; daarom blijft deze zaak in de toeslagenmodule.",
      ],
      needsClarification: false,
    };
  }

  if (
    bestDocument &&
    bestDocument.score >= 0.85 &&
    best &&
    best.score >= 0.7 &&
    best.caseType !== bestDocument.caseType
  ) {
    return {
      caseType: "onzeker_handmatige_triage",
      confidence: Math.max(best.score, bestDocument.score),
      reasons: [
        `Documentsignalen wijzen op ${bestDocument.caseType}, terwijl intake/classificatie op ${best.caseType} wijst.`,
        bestDocument.reason,
        best.reason,
      ],
      needsClarification: true,
    };
  }

  if (bestDocument && bestDocument.score >= 0.85) {
    return {
      caseType: bestDocument.caseType,
      confidence: Math.min(0.99, bestDocument.score),
      reasons: [
        `CaseType overgenomen uit documentsignalen voor flow '${flow}'.`,
        bestDocument.reason,
      ],
      needsClarification: Boolean(best && best.caseType !== bestDocument.caseType),
    };
  }

  if (!best || best.score < 0.7) {
    if (flow === "zienswijze" || flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar") {
      return {
        caseType: "algemeen_bestuursrecht",
        confidence: 0.75,
        reasons: [
          `Flow '${flow}' geselecteerd na procedurecheck.`,
          "Geen overtuigende sectorspecifieke documentsignalen gevonden; daarom voorlopig algemeen bestuursrecht.",
        ],
        needsClarification: true,
      };
    }

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
