import {
  AdditionalLegalArgument,
  CaseFileAnalysisSummary,
  Flow,
  GroundSupportEntry,
  IntakeFormData,
  LabeledLegalStatement,
  LegalStatementLabel,
} from "@/types";
import { buildLegalWorkflowProfile } from "@/lib/legal/workflow-profile";
import { CaseType, GenerationGuardResult, ValidatedCitation } from "@/lib/legal/types";

const REFERENCED_DOSSIER_DOCUMENTS = [
  {
    pattern: /\brapport\b/i,
    uploadPattern: /\brapport\b/i,
    question: "Het besluit verwijst naar een rapport. Kunt u dat rapport uploaden of de relevante passage samenvatten?",
  },
  {
    pattern: /\bzienswijzenota\b/i,
    uploadPattern: /\bzienswijzenota\b/i,
    question: "Het besluit verwijst naar een zienswijzenota. Kunt u die uploaden of aangeven op welke punten daarin wel of niet is gereageerd?",
  },
  {
    pattern: /\bcontroleverslag\b/i,
    uploadPattern: /\bcontroleverslag\b/i,
    question: "Het besluit verwijst naar een controleverslag. Kunt u dat stuk uploaden of de voor u relevante bevindingen benoemen?",
  },
  {
    pattern: /\bonderzoeksverslag\b/i,
    uploadPattern: /\bonderzoeksverslag\b/i,
    question: "Het besluit verwijst naar een onderzoeksverslag. Kunt u dat verslag uploaden of samenvatten wat daar volgens u in ontbreekt?",
  },
  {
    pattern: /\binventarislijst\b|\bdocumenttabel\b/i,
    uploadPattern: /\binventarislijst\b|\bdocumenttabel\b/i,
    question: "Het besluit verwijst naar een inventarislijst of documenttabel. Kunt u die uploaden of aangeven welke documenten daarop ontbreken of onjuist zijn behandeld?",
  },
  {
    pattern: /\bbudgetplan\b/i,
    uploadPattern: /\bbudgetplan\b/i,
    question: "Het besluit verwijst naar een budgetplan. Kunt u dat budgetplan uploaden of aangeven welk onderdeel volgens de gemeente ontbreekt of onjuist is gelezen?",
  },
  {
    pattern: /\bcontrolerapport\b/i,
    uploadPattern: /\bcontrolerapport\b/i,
    question: "Het besluit verwijst naar een controlerapport. Kunt u dat rapport uploaden of aangeven welke correctie of bevinding u bestrijdt?",
  },
  {
    pattern: /\bhandhavingsverzoek\b/i,
    uploadPattern: /\bhandhavingsverzoek\b/i,
    question: "Het besluit verwijst naar het handhavingsverzoek zelf. Kunt u dat verzoek uploaden of kort beschrijven hoe concreet het oorspronkelijke verzoek was?",
  },
] as const;

const ALERT_SIGNAL_RULES = [
  {
    pattern: /\bgeen besluit\b/i,
    note: "Alertsignaal 'geen besluit': besluitbegrip en ontvankelijkheid moeten expliciet worden getoetst.",
  },
  {
    pattern: /\bniet[- ]ontvankelijk\b/i,
    note: "Alertsignaal 'niet-ontvankelijk': termijn, herstelkans, besluitbegrip en belanghebbendheid vragen extra controle.",
  },
  {
    pattern: /\bingebrekestelling\b/i,
    note: "Alertsignaal 'ingebrekestelling': controleer beslistermijn, ontvangst en of beroep wegens niet tijdig beslissen openstaat.",
  },
  {
    pattern: /\bconcreet zicht op legalisatie\b/i,
    note: "Alertsignaal 'concreet zicht op legalisatie': toets of legalisatiekansen en evenredigheid zichtbaar zijn beoordeeld.",
  },
  {
    pattern: /\bsociaal netwerk\b/i,
    note: "Alertsignaal 'sociaal netwerk': controleer of de inzet van het sociale netwerk individueel en niet te schematisch is beoordeeld.",
  },
  {
    pattern: /\bdefinitieve berekening\b/i,
    note: "Alertsignaal 'definitieve berekening': controleer of feitenbasis, rekenstappen en procedurefase juist zijn gelezen.",
  },
  {
    pattern: /\bzoekslag\b/i,
    note: "Alertsignaal 'zoekslag': toets of duidelijk is waar, door wie en met welke zoektermen is gezocht.",
  },
  {
    pattern: /\bgedeeltelijke openbaarmaking\b|\bdeels openbaar\b|\bdeels gelakt\b/i,
    note: "Alertsignaal 'gedeeltelijke openbaarmaking': controleer of per document of passage is gemotiveerd waarom niet meer openbaar wordt gemaakt.",
  },
  {
    pattern: /\bopzet\b|\bgrove schuld\b/i,
    note: "Alertsignaal 'opzet/grove schuld': controleer of de verwijtbaarheid individueel en met concrete feiten is onderbouwd.",
  },
] as const;

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function ensureSentence(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function shorten(value: string, maxLength = 220): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function splitIntoPoints(value?: string | null, maxItems = 4): string[] {
  if (!hasText(value)) {
    return [];
  }

  return [...new Set(
    value
      .replace(/\r\n/g, "\n")
      .split(/\n+|;|(?:\.\s+)/)
      .map((part) => normalizeWhitespace(part))
      .filter((part) => part.length >= 8)
  )].slice(0, maxItems);
}

function buildDecisionAnalysisText(analysis?: IntakeFormData["besluitAnalyse"] | null): string {
  if (!analysis) {
    return "";
  }

  return [
    analysis.onderwerp,
    analysis.rechtsgrond,
    analysis.besluitInhoud,
    analysis.termijnen,
    analysis.rechtsmiddelenclausule,
    ...(analysis.dragendeOverwegingen ?? []).flatMap((item) => [item.passage, item.duiding]),
    ...(analysis.wettelijkeGrondslagen ?? []),
    ...(analysis.procedureleAanwijzingen ?? []),
    ...(analysis.beleidsReferenties ?? []),
    ...(analysis.jurisprudentieReferenties ?? []),
    ...(analysis.bijlageReferenties ?? []),
    ...(analysis.bijlagenLijst ?? []),
    ...(analysis.inventarislijstOfDocumenttabel ?? []),
    ...(analysis.correspondentieVerwijzingen ?? []),
    ...(analysis.aandachtspunten ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildUploadedDocumentsText(intakeData: IntakeFormData): string {
  return [
    intakeData.files?.besluit?.name,
    intakeData.files?.besluit?.extractedText,
    ...(intakeData.files?.bijlagen ?? []).flatMap((file) => [file.name, file.extractedText ?? ""]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueStatements(items: LabeledLegalStatement[]): LabeledLegalStatement[] {
  return items.filter((item, index, array) => {
    const key = `${item.label}::${item.statement}`;
    return array.findIndex((candidate) => `${candidate.label}::${candidate.statement}` === key) === index;
  });
}

function createStatement(params: {
  statement: string;
  label: LegalStatementLabel;
  source?: string;
  note?: string;
}): LabeledLegalStatement {
  return {
    statement: ensureSentence(params.statement),
    label: params.label,
    source: params.source,
    note: params.note,
  };
}

function createAdditionalArgument(params: {
  principle: AdditionalLegalArgument["principle"];
  relevance: string;
  support?: string;
  integrationMode: AdditionalLegalArgument["integrationMode"];
  suggestedPhrasing: string;
}): AdditionalLegalArgument {
  return {
    principle: params.principle,
    relevance: ensureSentence(params.relevance),
    support: hasText(params.support) ? ensureSentence(params.support) : undefined,
    integrationMode: params.integrationMode,
    suggestedPhrasing: ensureSentence(params.suggestedPhrasing),
  };
}

function stripTrailingPunctuation(value: string): string {
  return normalizeWhitespace(value).replace(/[.!?]+$/, "");
}

function buildAnalysisSegments(intakeData: IntakeFormData): string[] {
  const decisionAnalysis = intakeData.besluitAnalyse;

  return [
    intakeData.besluitSamenvatting,
    intakeData.besluitTekst,
    intakeData.gronden,
    intakeData.doel,
    intakeData.persoonlijkeOmstandigheden,
    intakeData.eerdereBezwaargronden,
    decisionAnalysis?.onderwerp,
    decisionAnalysis?.besluitInhoud,
    decisionAnalysis?.rechtsgrond,
    decisionAnalysis?.termijnen,
    decisionAnalysis?.rechtsmiddelenclausule,
    ...(decisionAnalysis?.dragendeOverwegingen ?? []).flatMap((item) => [item.duiding, item.passage]),
    ...(decisionAnalysis?.wettelijkeGrondslagen ?? []),
    ...(decisionAnalysis?.procedureleAanwijzingen ?? []),
    ...(decisionAnalysis?.beleidsReferenties ?? []),
    ...(decisionAnalysis?.jurisprudentieReferenties ?? []),
    ...(decisionAnalysis?.bijlageReferenties ?? []),
    ...(decisionAnalysis?.bijlagenLijst ?? []),
    ...(decisionAnalysis?.inventarislijstOfDocumenttabel ?? []),
    ...(decisionAnalysis?.correspondentieVerwijzingen ?? []),
    ...(decisionAnalysis?.aandachtspunten ?? []),
  ]
    .filter((value): value is string => hasText(value))
    .map((value) => normalizeWhitespace(value));
}

function findMatchingText(items: string[], pattern: RegExp): string | undefined {
  return items.find((item) => pattern.test(item));
}

function buildRelevantAdditionalArguments(params: {
  intakeData: IntakeFormData;
  caseType: CaseType;
}): AdditionalLegalArgument[] {
  const { intakeData, caseType } = params;
  const decisionAnalysis = intakeData.besluitAnalyse;
  const decisionSegments = [
    decisionAnalysis?.onderwerp,
    decisionAnalysis?.besluitInhoud,
    ...(decisionAnalysis?.dragendeOverwegingen ?? []).flatMap((item) => [item.duiding, item.passage]),
    ...(decisionAnalysis?.wettelijkeGrondslagen ?? []),
    ...(decisionAnalysis?.procedureleAanwijzingen ?? []),
    ...(decisionAnalysis?.bijlageReferenties ?? []),
    ...(decisionAnalysis?.bijlagenLijst ?? []),
    ...(decisionAnalysis?.inventarislijstOfDocumenttabel ?? []),
    ...(decisionAnalysis?.correspondentieVerwijzingen ?? []),
  ]
    .filter((value): value is string => hasText(value))
    .map((value) => normalizeWhitespace(value));
  const userArgumentText = normalizeWhitespace(
    [intakeData.gronden, intakeData.eerdereBezwaargronden].filter(Boolean).join(" ")
  );
  const decisionText = normalizeWhitespace(decisionSegments.join(" "));
  const allText = normalizeWhitespace(
    [...buildAnalysisSegments(intakeData), intakeData.waaromBelanghebbende]
      .filter(Boolean)
      .join(" ")
  );
  const userPoints = [
    ...splitIntoPoints(intakeData.gronden, 4),
    ...splitIntoPoints(intakeData.eerdereBezwaargronden, 3),
  ];
  const personalPoints = splitIntoPoints(intakeData.persoonlijkeOmstandigheden, 3);
  const evidencePoints = [...userPoints, ...personalPoints];
  const financialPattern =
    /\b(draagkracht|inkomen|financi[eë]le?\b|budget|tarief|kosten|schuld|schulden|betalingsregeling|terugvordering|invordering|boete(?:bedrag)?|bedrag|vermogen)\b/i;
  const personalPattern =
    /\b(persoonlijke omstandigheden|bijzondere omstandigheden|medisch|gezondheid|ziekte|beperkingen|gezin|kinderen|mantelzorg|sociaal netwerk|ondersteuningsbehoefte)\b/i;
  const equalityPattern =
    /\b(gelijke gevallen|vergelijkbare gevallen|gelijkheidsbeginsel|anderen wel|andere gevallen|andere bewoners|andere ondernemers|buurman|collega|soortgelijke gevallen|zelfde situatie)\b/i;
  const researchPattern =
    /\b(onderzoek|onderzoeksverslag|keukentafel|zoekslag|zoektermen|rapport|controleverslag|controlerapport|dossier|inspectie|medische stukken|bewijsstukken|meegewogen|niet onderzocht|onvoldoende onderzocht)\b/i;
  const formulaicMotivationPattern =
    /\b(passend|voldoende|ongegrond|geen aanleiding|niet aannemelijk|niet gebleken|toereikend|redelijk|concreet zicht op legalisatie|geen bijzondere omstandigheden)\b/i;
  const impactPattern =
    /\b(onevenredig|belangenafweging|hardheid|matiging|begunstigingstermijn|terugvordering|boete|last onder dwangsom|invordering|maatwerk|passende bijdrage|afstemming)\b/i;
  const modulesWithPersonalWeight = new Set<CaseType>([
    "algemeen_bestuursrecht",
    "bestuurlijke_boete",
    "handhaving",
    "niet_ontvankelijkheid",
    "omgevingswet_vergunning",
    "toeslag",
    "wmo_pgb",
    "belastingaanslag",
  ]);
  const modulesWithBalancingWeight = new Set<CaseType>([
    "algemeen_bestuursrecht",
    "bestuurlijke_boete",
    "handhaving",
    "omgevingswet_vergunning",
    "toeslag",
    "wmo_pgb",
    "belastingaanslag",
  ]);
  const alreadyRaised = {
    zorgvuldigheidsbeginsel:
      /\b(zorgvuldigheidsbeginsel|onzorgvuldig|onvoldoende onderzoek|geen onderzoek|niet onderzocht|zoekslag ontbreekt|dossier niet meegewogen)\b/i.test(
        userArgumentText
      ),
    motiveringsbeginsel:
      /\b(motiveringsbeginsel|ondeugdelijk gemotiveerd|motivering ontbreekt|niet gemotiveerd|niet uitgelegd|onvoldoende uitgelegd|algemene standaardtekst)\b/i.test(
        userArgumentText
      ),
    evenredigheidsbeginsel:
      /\b(evenredigheidsbeginsel|onevenredig|niet evenredig|artikel 3:4|3:4 awb|belangenafweging|hardheid|matiging)\b/i.test(
        userArgumentText
      ),
    gelijkheidsbeginsel:
      /\b(gelijkheidsbeginsel|gelijke gevallen|vergelijkbare gevallen|anderen wel)\b/i.test(
        userArgumentText
      ),
    persoonlijkeOmstandigheden:
      /\b(persoonlijke omstandigheden|bijzondere omstandigheden|medische situatie|gezondheid|ziekte|beperkingen|gezinssituatie|mantelzorg|sociaal netwerk)\b/i.test(
        userArgumentText
      ),
    financieleImpact:
      /\b(financi[eë]le?\b impact|financi[eë]le?\b gevolgen|draagkracht|betalingsregeling|terugvordering|invordering|budget te laag|tarief te laag)\b/i.test(
        userArgumentText
      ),
  };
  const formulaicConsideration = (decisionAnalysis?.dragendeOverwegingen ?? []).find((item) =>
    formulaicMotivationPattern.test(`${item.duiding} ${item.passage}`)
  );
  const researchAnchor =
    findMatchingText(decisionSegments, researchPattern) ??
    findMatchingText(evidencePoints, researchPattern);
  const motivationAnchor =
    formulaicConsideration?.passage ??
    findMatchingText(decisionSegments, /\b(passend|voldoende|geen aanleiding|niet aannemelijk|niet gebleken|toereikend)\b/i);
  const comparisonAnchor =
    findMatchingText(decisionSegments, equalityPattern) ??
    findMatchingText(evidencePoints, equalityPattern);
  const financialSupport =
    findMatchingText(personalPoints, financialPattern) ??
    findMatchingText(userPoints, financialPattern) ??
    findMatchingText(decisionSegments, financialPattern);
  const personalSupport =
    personalPoints[0] ??
    findMatchingText(decisionSegments, personalPattern);
  const impactSupport =
    personalSupport ??
    financialSupport ??
    findMatchingText(userPoints, impactPattern);
  const decisionMentionsPersonal = personalPattern.test(decisionText);
  const decisionDismissesPersonal =
    /\b(geen bijzondere omstandigheden|geen aanleiding om af te wijken|niet gebleken van bijzondere omstandigheden|persoonlijke omstandigheden geven geen aanleiding)\b/i.test(
      decisionText
    );
  const decisionMentionsBalancing = /\b(evenred|onevenred|belangenafweging|hardheid|matiging|afweging)\b/i.test(
    decisionText
  );
  const candidates: Array<AdditionalLegalArgument & { priority: number }> = [];

  const pushCandidate = (candidate: AdditionalLegalArgument & { priority: number }) => {
    if (candidates.some((item) => item.principle === candidate.principle)) {
      return;
    }

    candidates.push(candidate);
  };

  if (!alreadyRaised.zorgvuldigheidsbeginsel && researchAnchor) {
    const direct =
      /\b(niet onderzocht|onvoldoende onderzocht|niet meegewogen|ontbreekt|zoekslag|controleverslag|onderzoeksverslag)\b/i.test(
        allText
      ) || caseType === "woo";
    const anchor = shorten(stripTrailingPunctuation(researchAnchor), 120);

    pushCandidate({
      ...createAdditionalArgument({
        principle: "zorgvuldigheidsbeginsel",
        relevance: `De dossierbasis draait om ${anchor}, terwijl niet goed zichtbaar is welk onderzoek of welke stukken daarbij kenbaar zijn meegewogen`,
        support: direct
          ? `Concrete onderzoekshaak: ${anchor}`
          : undefined,
        integrationMode: direct ? "direct" : "cautious",
        suggestedPhrasing: direct
          ? `Het bestuursorgaan heeft niet kenbaar gemaakt welk onderzoek is verricht rond ${anchor} en welke stukken daarbij zijn betrokken.`
          : `Daarnaast is van belang dat uit het besluit niet goed blijkt welk onderzoek is verricht rond ${anchor} en welke stukken daarbij zijn meegewogen.`,
      }),
      priority: direct ? 95 : 83,
    });
  }

  if (!alreadyRaised.motiveringsbeginsel && motivationAnchor) {
    const anchor = shorten(stripTrailingPunctuation(motivationAnchor), 120);

    pushCandidate({
      ...createAdditionalArgument({
        principle: "motiveringsbeginsel",
        relevance: `De dragende motivering blijft op dit punt vooral conclusief, omdat wel wordt gezegd dat ${anchor} maar niet waarom dat in deze zaak opgaat`,
        support: `Dragende passage: ${anchor}`,
        integrationMode: "direct",
        suggestedPhrasing: `De motivering blijft te abstract, omdat in het besluit wel staat dat ${anchor} maar niet wordt uitgelegd waarom dat in mijn situatie zo zou zijn.`,
      }),
      priority: 100,
    });
  }

  if (!alreadyRaised.evenredigheidsbeginsel && impactSupport && (modulesWithBalancingWeight.has(caseType) || decisionMentionsBalancing || impactPattern.test(allText))) {
    const support = shorten(stripTrailingPunctuation(impactSupport), 120);
    const direct = personalPoints.length > 0 || Boolean(financialSupport);

    pushCandidate({
      ...createAdditionalArgument({
        principle: "evenredigheidsbeginsel",
        relevance: `Het dossier laat concrete gevolgen zien voor de gebruiker, maar het besluit maakt niet kenbaar hoe die gevolgen zijn afgewogen tegen het doel van het besluit`,
        support: `Gevolgen in het dossier: ${support}`,
        integrationMode: direct ? "direct" : "cautious",
        suggestedPhrasing: direct
          ? `Het besluit laat niet zien hoe de nadelige gevolgen voor mij, waaronder ${support}, zijn afgewogen tegen het doel van deze beslissing.`
          : `Daarnaast is van belang dat uit het besluit niet goed blijkt of de nadelige gevolgen, zoals ${support}, in verhouding zijn gebracht tot het doel ervan.`,
      }),
      priority: direct ? 92 : 79,
    });
  }

  if (!alreadyRaised.gelijkheidsbeginsel && comparisonAnchor) {
    const anchor = shorten(stripTrailingPunctuation(comparisonAnchor), 120);
    const direct = equalityPattern.test(decisionText);

    pushCandidate({
      ...createAdditionalArgument({
        principle: "gelijkheidsbeginsel",
        relevance: `Er ligt een concrete vergelijking met andere gevallen of personen in het dossier, maar het besluit legt niet uit waarom hier anders wordt geoordeeld`,
        support: `Vergelijkingspunt: ${anchor}`,
        integrationMode: direct ? "direct" : "cautious",
        suggestedPhrasing: direct
          ? `Het besluit maakt niet inzichtelijk waarom in mijn situatie anders wordt geoordeeld dan in de vergelijkbare gevallen die in het dossier naar voren komen, namelijk ${anchor}.`
          : `Daarnaast is van belang dat het besluit niet inzichtelijk maakt waarom in deze situatie anders wordt geoordeeld dan in het vergelijkingsmateriaal dat naar voren komt, namelijk ${anchor}.`,
      }),
      priority: direct ? 72 : 61,
    });
  }

  if (
    !alreadyRaised.persoonlijkeOmstandigheden &&
    personalSupport &&
    (modulesWithPersonalWeight.has(caseType) || decisionDismissesPersonal || personalPattern.test(allText)) &&
    (!decisionMentionsPersonal || decisionDismissesPersonal)
  ) {
    const support = shorten(stripTrailingPunctuation(personalSupport), 120);
    const direct = personalPoints.length > 0;

    pushCandidate({
      ...createAdditionalArgument({
        principle: "persoonlijke omstandigheden",
        relevance: `Er zijn persoonlijke omstandigheden genoemd die voor een individuele beoordeling relevant kunnen zijn, maar het besluit gaat daar niet zichtbaar of niet concreet genoeg op in`,
        support: `Persoonlijke context: ${support}`,
        integrationMode: direct ? "direct" : "cautious",
        suggestedPhrasing: direct
          ? `Het besluit gaat niet kenbaar in op mijn persoonlijke omstandigheden, waaronder ${support}, terwijl die voor een individuele beoordeling relevant zijn.`
          : `Daarnaast is van belang dat persoonlijke omstandigheden als ${support} in deze beoordeling kenbaar hadden moeten worden betrokken.`,
      }),
      priority: direct ? 88 : 74,
    });
  }

  if (!alreadyRaised.financieleImpact && financialSupport) {
    const support = shorten(stripTrailingPunctuation(financialSupport), 120);
    const direct =
      /\b(draagkracht|inkomen|schuld|budget|tarief|kosten|betalingsregeling|terugvordering|invordering)\b/i.test(
        support
      );

    pushCandidate({
      ...createAdditionalArgument({
        principle: "financiële impact",
        relevance: `Het dossier bevat aanwijzingen voor concrete financiële gevolgen, maar het besluit laat niet zien of die gevolgen kenbaar zijn meegewogen`,
        support: `Financieel aanknopingspunt: ${support}`,
        integrationMode: direct ? "direct" : "cautious",
        suggestedPhrasing: direct
          ? `Ook de financiële impact had kenbaar moeten worden meegewogen, omdat ${support} directe gevolgen heeft voor de uitkomst van deze zaak.`
          : `In dit kader had het bestuursorgaan moeten uitleggen welke financiële gevolgen, zoals ${support}, het besluit voor mij heeft en hoe die zijn meegewogen.`,
      }),
      priority: direct ? 84 : 70,
    });
  }

  return candidates
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 4)
    .map((candidate) => ({
      principle: candidate.principle,
      relevance: candidate.relevance,
      support: candidate.support,
      integrationMode: candidate.integrationMode,
      suggestedPhrasing: candidate.suggestedPhrasing,
    }));
}

function getCaseTypeLabel(caseType: CaseType): string {
  switch (caseType) {
    case "woo":
      return "Woo";
    case "algemeen_bestuursrecht":
      return "Algemeen bestuursrecht";
    case "bestuurlijke_boete":
      return "Boete";
    case "handhaving":
      return "Handhaving";
    case "niet_tijdig_beslissen":
      return "Niet tijdig beslissen";
    case "niet_ontvankelijkheid":
      return "Niet-ontvankelijkheid";
    case "wmo_pgb":
      return "Wmo / PGB";
    case "omgevingswet_vergunning":
      return "Omgevingswet / vergunning";
    case "verkeersboete":
      return "Verkeersboete";
    case "taakstraf":
      return "Strafbeschikking / taakstraf";
    case "belastingaanslag":
      return "Belasting";
    case "uwv_uitkering":
      return "UWV-uitkering";
    case "toeslag":
      return "Toeslagen";
    default:
      return "Handmatige triage";
  }
}

function getWorkflowModuleKey(caseType: CaseType): string {
  switch (caseType) {
    case "woo":
      return "woo";
    case "belastingaanslag":
      return "belasting";
    case "bestuurlijke_boete":
      return "boete";
    case "handhaving":
      return "handhaving";
    case "niet_tijdig_beslissen":
      return "niet_tijdig_beslissen";
    case "niet_ontvankelijkheid":
      return "niet_ontvankelijkheid";
    case "toeslag":
      return "toeslagen";
    case "wmo_pgb":
      return "wmo_pgb";
    default:
      return "default";
  }
}

function getModuleLabel(params: { flow: Flow; caseType: CaseType }): string {
  const { flow, caseType } = params;
  const caseTypeLabel = getCaseTypeLabel(caseType);

  switch (flow) {
    case "woo":
      return `${caseTypeLabel} - verzoek of bezwaar tegen Woo-besluit`;
    case "zienswijze":
      return `${caseTypeLabel} - zienswijze`;
    case "beroep_zonder_bezwaar":
      return `${caseTypeLabel} - rechtstreeks beroep`;
    case "beroep_na_bezwaar":
      return `${caseTypeLabel} - beroep na bezwaar`;
    default:
      return `${caseTypeLabel} - bezwaar`;
  }
}

function getProcedurePhaseLabel(flow: Flow): string {
  switch (flow) {
    case "woo":
      return "verzoek- of bezwaarfase Woo";
    case "zienswijze":
      return "voorprocedure / zienswijzefase";
    case "beroep_zonder_bezwaar":
      return "beroepsfase zonder voorafgaand bezwaar";
    case "beroep_na_bezwaar":
      return "beroepsfase na beslissing op bezwaar";
    default:
      return "bezwaarfase";
  }
}

function humanizeField(field: string): string {
  switch (field) {
    case "bestuursorgaan":
      return "het bevoegde bestuursorgaan";
    case "categorie":
      return "het soort besluit";
    case "doel":
      return "de gewenste uitkomst";
    case "gronden":
      return "de inhoudelijke bezwaren";
    case "eerdereBezwaargronden":
      return "de eerder aangevoerde bezwaargronden";
    case "wooOnderwerp":
      return "het Woo-onderwerp";
    case "wooPeriode":
      return "de relevante periode";
    case "wooDocumenten":
      return "de gevraagde documenten";
    case "besluitSamenvatting":
      return "de kern van het besluit";
    case "persoonlijkeOmstandigheden":
      return "de relevante persoonlijke gevolgen";
    default:
      return field;
  }
}

function buildKernConflict(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  caseType: CaseType;
}): string {
  const { flow, intakeData, caseType } = params;
  const decisionAnalysis = intakeData.besluitAnalyse;
  const firstConsideration = decisionAnalysis?.dragendeOverwegingen?.[0];

  if (flow === "woo") {
    const onderwerp = intakeData.wooOnderwerp ?? decisionAnalysis?.onderwerp ?? "het gevraagde dossier";
    const documenten = intakeData.wooDocumenten ?? "de gevraagde documenten";
    return ensureSentence(
      `Het geschil draait om de vraag of ${shorten(onderwerp, 140)} openbaar moet worden gemaakt en hoe het bestuursorgaan ${shorten(documenten, 120)} heeft afgebakend`
    );
  }

  if (firstConsideration?.duiding && hasText(intakeData.gronden)) {
    return ensureSentence(
      `Het besluit lijkt vooral te steunen op ${shorten(firstConsideration.duiding, 160)}, terwijl indiener betwist dat omdat ${shorten(intakeData.gronden, 160)}`
    );
  }

  if (hasText(intakeData.besluitSamenvatting) && hasText(intakeData.gronden)) {
    return ensureSentence(
      `Het geschil gaat over ${shorten(intakeData.besluitSamenvatting, 180)} en de vraag of dat standhoudt in het licht van ${shorten(intakeData.gronden, 150)}`
    );
  }

  if (hasText(intakeData.gronden)) {
    return ensureSentence(
      `De zaak in de module ${getCaseTypeLabel(caseType)} draait om de vraag of het besluit juridisch en feitelijk kan standhouden, gelet op ${shorten(intakeData.gronden, 170)}`
    );
  }

  return ensureSentence("Het kernconflict kan nog niet scherp worden vastgesteld omdat de dragende motivering of tegenargumenten nog onvolledig zijn uitgewerkt");
}

function buildDerivedProblemText(input: string): string {
  const normalized = input.toLowerCase();

  if (/(woo|wet open overheid|zoekslag|inventarislijst|lakking|deels openbaar|weigeringsgrond|meer documenten)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de zoekslag, inventarisatie, documentgerichte motivering en beoordeling van gedeeltelijke openbaarmaking voldoende inzichtelijk zijn.";
  }

  if (/(niet tijdig|ingebrekestelling|beslistermijn|opschorting|verdaging|te laat beslissen)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de beslistermijn is verstreken, de ingebrekestelling geldig is en geen rechtsgeldige opschorting of verdaging aan beroep in de weg staat.";
  }

  if (/(niet[- ]ontvankelijk|termijnoverschrijding|verschoonbaar|herstelverzuim|6[:.]6 awb|geen besluit|belanghebbende|machtiging)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de ontvankelijkheidsgrond juist is, of herstel had moeten worden geboden en of termijnstart, besluitbegrip of belanghebbendheid correct zijn beoordeeld.";
  }

  if (/(toeslag|toeslagen|definitieve berekening|terugvordering|voorschot|hardheidsclausule|bijzondere omstandigheden)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing van de feitenbasis, de berekening en de individuele beoordeling van hardheid of evenredigheid in de toeslagenzaak.";
  }

  if (/(partner|kinderen|inkomen|vermogen|opvanguren|brp|kinderopvang)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de feitelijke basis over partner, kinderen, inkomen, vermogen of opvang juist is vastgesteld.";
  }

  if (/(inspecteur|vergrijpboete|verzuimboete|pleitbaar standpunt|omkering bewijslast|omkering van de bewijslast)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing van bewijslast, verwijtbaarheid en de vraag of een pleitbaar standpunt of verschoonbare fout aan de boete of correctie in de weg staat.";
  }

  if (/(aanslag|navorderingsaanslag|naheffingsaanslag|correctie|gecorrigeerde post|rekenstap|administratie|aangifte)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de fiscale correctie feitelijk, cijfermatig en logisch voldoende is onderbouwd.";
  }

  if (/(verwijtbaar|verwijtbaarheid|opzet|grove schuld|afwezigheid van alle schuld|avas)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing van de individuele verwijtbaarheid en eventuele afwezigheid van alle schuld.";
  }

  if (/(wmo|maatwerkvoorziening|keukentafel|onderzoeksverslag|ondersteuningsbehoefte|beperkingen)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of een voldoende individueel en kenbaar Wmo-onderzoek is verricht.";
  }

  if (/(handhaving|handhavingsverzoek|last onder dwangsom|bestuursdwang|invordering|begunstigingstermijn)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of het handhavingsbesluit of de reactie op het handhavingsverzoek juridisch juist en voldoende bepaald is.";
  }

  if (/(legalisatie|vergunningaanvraag|concreet zicht op legalisatie)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of concreet zicht op legalisatie kenbaar en volledig is beoordeeld.";
  }

  if (/(overtreding|overtredingsnorm|normschending|inspectierapport|situatie ter plaatse)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de gestelde overtreding en de toepasselijke norm voldoende concreet zijn vastgesteld.";
  }

  if (/(pgb|persoonsgebonden budget|eigen regie|zorg in natura|\bzin\b)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de afwijzing van een pgb of de keuze voor zorg in natura individueel en draagkrachtig is gemotiveerd.";
  }

  if (/(tarief|budget|offerte|sociaal netwerk|professionele hulp)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of het tarief, budget of oordeel over het sociale netwerk concreet en herleidbaar is onderbouwd.";
  }

  if (/(boetehoogte|boetebedrag|matiging|draagkracht|redelijke termijn)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de boetehoogte individueel is afgestemd en of matiging kenbaar is beoordeeld.";
  }

  if (/(overtreding|constatering|bewijs|controlerapport|waarneming|foto|loggegeven)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing of de gestelde overtreding voldoende met concrete stukken of waarnemingen is bewezen.";
  }

  if (/(motiver|onderbou|uitleg)/.test(normalized)) {
    return "Deze overweging moet worden getoetst op draagkrachtige en kenbare motivering.";
  }

  if (/(zorgvuldig|onderzoek|feit|dossier)/.test(normalized)) {
    return "Deze overweging roept een zorgvuldigheids- en dossieronderzoeksvraag op.";
  }

  if (/(evenred|gevolg|belang)/.test(normalized)) {
    return "Deze overweging vraagt om toetsing aan belangenafweging en evenredigheid.";
  }

  if (/(horen|hoorzitting|procedure|termijn|bezwaar|beroep)/.test(normalized)) {
    return "Deze overweging raakt aan procedurele waarborgen of procesdrempels.";
  }

  return "Deze passage vraagt om inhoudelijke toetsing op juistheid, motivering en dossierbasis.";
}

function buildEvidenceHook(item: string): string {
  return ensureSentence(`Koppel deze grond waar mogelijk aan bewijs of dossierfeit: ${shorten(item, 180)}`);
}

function buildAuthorityStatement(authority: ValidatedCitation): LabeledLegalStatement | null {
  if (authority.sourceType === "wet") {
    const citation = authority.citation ?? authority.title;
    if (!citation) {
      return null;
    }

    return createStatement({
      statement: citation,
      label: "letterlijk uit wet",
      source: authority.sourceUrl,
      note: authority.topic,
    });
  }

  if (authority.sourceType === "jurisprudentie" && authority.verificationStatus === "verified") {
    const statement = authority.verifiedHolding;
    if (!statement) {
      return null;
    }

    return createStatement({
      statement,
      label: "volgt uit geverifieerde jurisprudentie",
      source: authority.ecli ?? authority.officialTitle ?? authority.sourceUrl,
      note: authority.topic,
    });
  }

  return null;
}

function authorityMatchesText(authority: ValidatedCitation, value: string): boolean {
  const haystack = value.toLowerCase();
  const candidateText = [
    authority.title,
    authority.topic,
    authority.principle,
    authority.verifiedHolding ?? "",
    ...(authority.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return candidateText
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 5)
    .some((part) => haystack.includes(part));
}

function selectSupportingAuthorities(params: {
  text: string;
  reviewedAuthorities: ValidatedCitation[];
}): LabeledLegalStatement[] {
  const { text, reviewedAuthorities } = params;
  const matches = reviewedAuthorities
    .filter((authority) => authority.verificationStatus === "verified")
    .filter((authority) => authority.sourceType !== "jurisprudentie" || authority.useInLetter === true)
    .filter((authority) => authorityMatchesText(authority, text))
    .map((authority) => buildAuthorityStatement(authority))
    .filter((statement): statement is LabeledLegalStatement => Boolean(statement));

  if (matches.length > 0) {
    return matches.slice(0, 2);
  }

  return reviewedAuthorities
    .filter((authority) => authority.sourceType === "wet" && authority.verificationStatus === "verified")
    .map((authority) => buildAuthorityStatement(authority))
    .filter((statement): statement is LabeledLegalStatement => Boolean(statement))
    .slice(0, 1);
}

function buildLabeledStatements(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  reviewedAuthorities: ValidatedCitation[];
  kernconflict: string;
  primaryRisks: string[];
  uncertainties: string[];
}): LabeledLegalStatement[] {
  const { flow, intakeData, reviewedAuthorities, kernconflict, primaryRisks, uncertainties } = params;
  const decisionAnalysis = intakeData.besluitAnalyse;
  const statements: LabeledLegalStatement[] = [];

  (decisionAnalysis?.dragendeOverwegingen ?? []).forEach((item, index) => {
    statements.push(
      createStatement({
        statement: item.passage,
        label: "letterlijk uit besluit",
        source: `dragende overweging ${index + 1}`,
        note: item.duiding,
      })
    );
  });

  (decisionAnalysis?.wettelijkeGrondslagen ?? []).forEach((item, index) => {
    statements.push(
      createStatement({
        statement: `In het besluit wordt verwezen naar ${item}`,
        label: "letterlijk uit besluit",
        source: `wettelijke grondslag ${index + 1}`,
      })
    );
  });

  if (hasText(intakeData.gronden)) {
    splitIntoPoints(intakeData.gronden, 3).forEach((point, index) => {
      statements.push(
        createStatement({
          statement: point,
          label: "gebruikersstelling / nog niet geverifieerd",
          source: `gronden gebruiker ${index + 1}`,
        })
      );
    });
  }

  if (hasText(intakeData.persoonlijkeOmstandigheden)) {
    statements.push(
      createStatement({
        statement: intakeData.persoonlijkeOmstandigheden,
        label: "gebruikersstelling / nog niet geverifieerd",
        source: "persoonlijke omstandigheden",
      })
    );
  }

  if (hasText(intakeData.doel)) {
    statements.push(
      createStatement({
        statement: `Gebruiker wil bereiken: ${intakeData.doel}`,
        label: "gebruikersstelling / nog niet geverifieerd",
        source: "doel gebruiker",
      })
    );
  }

  if (flow === "beroep_na_bezwaar" && hasText(intakeData.eerdereBezwaargronden)) {
    statements.push(
      createStatement({
        statement: intakeData.eerdereBezwaargronden,
        label: "gebruikersstelling / nog niet geverifieerd",
        source: "eerdere bezwaargronden",
      })
    );
  }

  statements.push(
    createStatement({
      statement: kernconflict,
      label: "afgeleide interpretatie",
      source: "zaakanalyse",
    })
  );

  primaryRisks.slice(0, 2).forEach((risk, index) => {
    statements.push(
      createStatement({
        statement: risk,
        label: "afgeleide interpretatie",
        source: `procesrisico ${index + 1}`,
      })
    );
  });

  uncertainties.slice(0, 2).forEach((item, index) => {
    statements.push(
      createStatement({
        statement: item,
        label: "afgeleide interpretatie",
        source: `onzekerheid ${index + 1}`,
      })
    );
  });

  reviewedAuthorities.forEach((authority) => {
    const authorityStatement = buildAuthorityStatement(authority);
    if (authorityStatement) {
      statements.push(authorityStatement);
    }
  });

  return uniqueStatements(statements).slice(0, 16);
}

function buildGroundsMatrix(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  reviewedAuthorities: ValidatedCitation[];
}): GroundSupportEntry[] {
  const { flow, intakeData, reviewedAuthorities } = params;
  const decisionAnalysis = intakeData.besluitAnalyse;
  const userFacts = [
    ...splitIntoPoints(intakeData.gronden, 3),
    ...splitIntoPoints(intakeData.persoonlijkeOmstandigheden, 2),
    ...(hasText(intakeData.eerdereBezwaargronden) ? splitIntoPoints(intakeData.eerdereBezwaargronden, 2) : []),
  ];
  const grounds: GroundSupportEntry[] = [];

  (decisionAnalysis?.dragendeOverwegingen ?? []).slice(0, 4).forEach((item, index) => {
    const fact = userFacts[index] ?? userFacts[0];
    const support = selectSupportingAuthorities({
      text: `${item.duiding} ${fact ?? ""}`,
      reviewedAuthorities,
    });

    grounds.push({
      title: `Grond ${index + 1}: reactie op dragende overweging`,
      decisionPassage: createStatement({
        statement: item.passage,
        label: "letterlijk uit besluit",
        source: `dragende overweging ${index + 1}`,
        note: item.duiding,
      }),
      juridischProbleem: createStatement({
        statement: buildDerivedProblemText(`${item.duiding} ${item.passage}`),
        label: "afgeleide interpretatie",
        source: "grondmatrix",
      }),
      relevantFeitOfBewijs: fact
        ? createStatement({
            statement: buildEvidenceHook(fact),
            label: "gebruikersstelling / nog niet geverifieerd",
            source: "intake of bijlage",
          })
        : undefined,
      jurisprudentieOfWet: support.length > 0 ? support : undefined,
    });
  });

  if (grounds.length === 0 && hasText(intakeData.gronden)) {
    splitIntoPoints(intakeData.gronden, flow === "woo" ? 2 : 3).forEach((point, index) => {
      grounds.push({
        title: `Grond ${index + 1}: nog te koppelen aan concrete besluitpassage`,
        juridischProbleem: createStatement({
          statement: buildDerivedProblemText(point),
          label: "afgeleide interpretatie",
          source: "grondmatrix",
        }),
        relevantFeitOfBewijs: createStatement({
          statement: point,
          label: "gebruikersstelling / nog niet geverifieerd",
          source: "gronden gebruiker",
        }),
        jurisprudentieOfWet: selectSupportingAuthorities({
          text: point,
          reviewedAuthorities,
        }),
      });
    });
  }

  return grounds.slice(0, 4);
}

function buildPrimaryProcessRisks(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  guard: GenerationGuardResult;
  reviewedAuthorities: ValidatedCitation[];
}): string[] {
  const { flow, intakeData, guard, reviewedAuthorities } = params;
  const risks: string[] = [];
  const decisionAnalysis = intakeData.besluitAnalyse;
  const knownText = normalizeWhitespace(
    [
      intakeData.bestuursorgaan,
      intakeData.besluitSamenvatting,
      intakeData.besluitTekst,
      intakeData.gronden,
      intakeData.procedureReden,
      buildDecisionAnalysisText(decisionAnalysis),
    ]
      .filter(Boolean)
      .join(" ")
  ).toLowerCase();
  const hasVerifiedCaseLaw = reviewedAuthorities.some(
    (item) => item.sourceType === "jurisprudentie" && item.verificationStatus === "verified"
  );

  if (guard.routeConfidence < 0.75 || guard.reasons.includes("route_uncertain")) {
    risks.push("De juiste procedurefase of route is nog niet volledig zeker; controle van de rechtsmiddelenclausule blijft nodig.");
  }

  if (!hasText(intakeData.datumBesluit) && !hasText(decisionAnalysis?.termijnen)) {
    risks.push("De beroep- of bezwaartermijn is niet scherp uit het dossier af te leiden.");
  }

  if (!/(bekendgemaakt|bekendmaking|ontvangen op|ontvangstdatum|toezending|verzonden op)/.test(knownText)) {
    risks.push("De bekendmaking of ontvangstdatum is nog niet scherp vastgelegd, waardoor de termijnstart onzeker kan zijn.");
  }

  if (!hasText(intakeData.bestuursorgaan)) {
    risks.push("Het bevoegde bestuursorgaan is nog niet betrouwbaar vastgesteld.");
  }

  if (guard.caseTypeConfidence < 0.8 || guard.reasons.includes("document_case_type_conflict")) {
    risks.push("Er blijft een reeel risico dat de module of route nog niet juist staat ten opzichte van het document.");
  }

  if (!hasClearProcessPosition(intakeData, knownText)) {
    risks.push("De procespositie van de gebruiker is nog niet scherp: onduidelijk is of deze optreedt als aanvrager, bezwaarmaker, verzoeker, belanghebbende of aangeschrevene.");
  }

  if (intakeData.besluitAnalyseStatus !== "read") {
    risks.push("De dragende motivering is niet volledig uit het besluit uitgelezen, waardoor de reactie mogelijk terugvalt op veiligere algemene grondslagen.");
  }

  if ((flow === "beroep_na_bezwaar" || flow === "beroep_zonder_bezwaar") && !intakeData.files?.bijlagen?.length) {
    risks.push("Onderliggende processtukken ontbreken, waardoor eerder ingenomen standpunten mogelijk niet precies kunnen worden gespiegeld.");
  }

  if (decisionAnalysis?.dragendeOverwegingen?.length === 0) {
    risks.push("Er zijn geen duidelijke dragende overwegingen uit het besluit vastgelegd; daardoor is gerichte grondenbouw lastiger.");
  }

  if (!hasVerifiedCaseLaw && reviewedAuthorities.some((item) => item.sourceType === "jurisprudentie")) {
    risks.push("Er is wel jurisprudentie aangetroffen, maar niets daarvan is voldoende geverifieerd om veilig in de brief op te nemen.");
  }

  if (guard.missingFields.length > 0) {
    risks.push("Een of meer kerngegevens ontbreken nog voor een volledig toegespitste procespositie.");
  }

  buildAlertDrivenNotes({ intakeData }).forEach((note) => {
    risks.push(note);
  });

  return [...new Set(risks)].slice(0, 5);
}

function pushQuestion(target: string[], question: string) {
  const normalized = normalizeWhitespace(question);
  if (!normalized || target.includes(normalized) || target.length >= 5) {
    return;
  }

  target.push(normalized);
}

function buildAlertDrivenNotes(params: {
  intakeData: IntakeFormData;
}): string[] {
  const text = normalizeWhitespace(
    [
      params.intakeData.besluitSamenvatting,
      params.intakeData.besluitTekst,
      params.intakeData.gronden,
      params.intakeData.procedureReden,
      buildDecisionAnalysisText(params.intakeData.besluitAnalyse),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!text) {
    return [];
  }

  return ALERT_SIGNAL_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.note)
    .filter((note, index, notes) => notes.indexOf(note) === index)
    .slice(0, 4);
}

function hasClearProcessPosition(intakeData: IntakeFormData, knownText: string): boolean {
  if (hasText(intakeData.waaromBelanghebbende)) {
    return true;
  }

  return /(aanvrager|verzoeker|bezwaarmaker|appellant|belanghebbende|aangeschrevene|last opgelegd)/.test(knownText);
}

function buildTargetedQuestions(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  guard: GenerationGuardResult;
}): string[] {
  const { flow, intakeData, guard } = params;
  const questions: string[] = [];
  const decisionAnalysis = intakeData.besluitAnalyse;
  const uploadedDocumentsText = buildUploadedDocumentsText(intakeData);
  const knownText = [
    intakeData.besluitDocumentType,
    intakeData.besluitSamenvatting,
    intakeData.besluitTekst?.slice(0, 2500),
    intakeData.gronden,
    intakeData.doel,
    intakeData.persoonlijkeOmstandigheden,
    intakeData.eerdereBezwaargronden,
    decisionAnalysis?.onderwerp,
    decisionAnalysis?.rechtsgrond,
    decisionAnalysis?.besluitInhoud,
    decisionAnalysis?.termijnen,
    decisionAnalysis?.rechtsmiddelenclausule,
    ...(decisionAnalysis?.dragendeOverwegingen ?? []).flatMap((item) => [item.passage, item.duiding]),
    ...(decisionAnalysis?.wettelijkeGrondslagen ?? []),
    ...(decisionAnalysis?.procedureleAanwijzingen ?? []),
    ...(decisionAnalysis?.beleidsReferenties ?? []),
    ...(decisionAnalysis?.jurisprudentieReferenties ?? []),
    ...(decisionAnalysis?.bijlageReferenties ?? []),
    ...(decisionAnalysis?.bijlagenLijst ?? []),
    ...(decisionAnalysis?.inventarislijstOfDocumenttabel ?? []),
    ...(decisionAnalysis?.correspondentieVerwijzingen ?? []),
    ...(decisionAnalysis?.aandachtspunten ?? []),
    intakeData.waaromBelanghebbende,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (guard.caseType === "woo") {
    if (!/(onderwerp|periode|afdeling|organisatieonderdeel|documentsoort|concreet verzoek)/.test(knownText)) {
      pushQuestion(
        questions,
        "Was uw verzoek voldoende concreet qua onderwerp, periode, afdeling of documentsoort?"
      );
    }

    if (!/(zoekslag|zoektermen|door wie gezocht|waar gezocht|organisatieonderdeel)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft het bestuursorgaan uitgelegd waar, door wie en met welke zoektermen is gezocht?"
      );
    }

    if (!/(volledig geweigerd|deels gelakt|gedeeltelijk openbaar|lakking|weigering per document)/.test(knownText)) {
      pushQuestion(
        questions,
        "Zijn documenten volledig geweigerd, of alleen deels gelakt?"
      );
    }

    if (!/(woo-uitzondering|weigeringsgrond|per document|per passage|artikel 5\.)/.test(knownText)) {
      pushQuestion(
        questions,
        "Per document: is duidelijk op welke Woo-uitzondering het bestuursorgaan zich beroept?"
      );
    }

    if (!/(meer documenten|aanwijzingen|notulenverwijzing|dossiernummer|bestandsnaam|extra documenten)/.test(knownText)) {
      pushQuestion(
        questions,
        "Zijn er sterke aanwijzingen dat er meer documenten moeten bestaan dan nu zijn gevonden?"
      );
    }
  }

  if (guard.caseType === "bestuurlijke_boete") {
    if (!/(feit|gedraging|overtreding|niet gebeurd|verantwoordelijk|verantwoordelijkheid)/.test(knownText)) {
      pushQuestion(
        questions,
        "Welke concrete gedraging betwist u: dat het feit is gebeurd, dat u daarvoor verantwoordelijk bent, of beide?"
      );
    }

    if (!/(verwijtbaar|verwijtbaarheid|opzet|grove schuld|persoonlijk verwijt|afwezigheid van alle schuld|avas)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft het bestuursorgaan uitgelegd waarom u persoonlijk verwijtbaar handelde?"
      );
    }

    if (!/(matiging|draagkracht|eerste overtreding|geringe ernst|lange procedure|redelijke termijn|boetehoogte|boetebedrag)/.test(knownText)) {
      pushQuestion(
        questions,
        "Zijn er omstandigheden zoals eerste overtreding, geringe ernst, beperkte draagkracht of lange procedureduur die matiging ondersteunen?"
      );
    }

    if (!/(zienswijze|gehoord|horen|hoorzitting)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft u vooraf een zienswijze kunnen geven en is daarop zichtbaar gereageerd?"
      );
    }

    if (!/(berekening|rekenwijze|boetebedrag|boetehoogte)/.test(knownText)) {
      pushQuestion(
        questions,
        "Klopt de berekening van het boetebedrag volgens u feitelijk en juridisch?"
      );
    }
  }

  if (guard.caseType === "wmo_pgb") {
    if (!/(hulp zelf geweigerd|voorziening geweigerd|alleen de vorm|alleen pgb|pgb geweigerd|zorg in natura)/.test(knownText)) {
      pushQuestion(questions, "Is de hulp zelf geweigerd, of alleen de vorm als pgb?");
    }

    if (!/(zorg in natura|\bzin\b|niet passend|passend alternatief|onvoldoende passend)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft de gemeente concreet onderzocht waarom zorg in natura voor u niet passend is?"
      );
    }

    if (!/(budgetplan|zorgplan|plan ingediend|ontbreken in het plan|onderzoeksverslag)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft u een budgetplan of zorgplan ingediend, en wat zou daarin volgens de gemeente ontbreken?"
      );
    }

    if (!/(sociaal netwerk|mantelzorg|professionele hulp|professioneel)/.test(knownText)) {
      pushQuestion(
        questions,
        "Gaat het om hulp uit uw sociale netwerk of om professionele hulp?"
      );
    }

    if (!/(tarief|budget|offerte|uurtarief|genoeg om|toereikend)/.test(knownText)) {
      pushQuestion(
        questions,
        "Is het toegekende budget volgens u feitelijk genoeg om de noodzakelijke hulp in te kopen?"
      );
    }
  }

  if (guard.caseType === "handhaving") {
    if (!/(verzoeker|om handhaving gevraagd|last opgelegd|aangeschrevene|onder dwangsom)/.test(knownText)) {
      pushQuestion(
        questions,
        "Bent u degene die om handhaving heeft gevraagd, of bent u degene aan wie de last is opgelegd?"
      );
    }

    if (!/(overtreding|overtredingsnorm|strijd met|zonder vergunning|illegaal gebruik|illegale bouw)/.test(knownText)) {
      pushQuestion(
        questions,
        "Op welke concrete overtreding doelt het besluit precies?"
      );
    }

    if (!/(legalisatie|vergunningaanvraag|aanvraag loopt|concreet zicht op legalisatie)/.test(knownText)) {
      pushQuestion(
        questions,
        "Is legalisatie mogelijk of al aangevraagd?"
      );
    }

    if (!/(last duidelijk|lastformulering|wat precies moet gebeuren|begunstigingstermijn|voor wanneer)/.test(knownText)) {
      pushQuestion(
        questions,
        "Is de last volgens u duidelijk genoeg over wat precies moet gebeuren en voor wanneer?"
      );
    }

    if (!/(onevenredig|onevenredigheid|evenredig|belangenafweging)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft het bestuursorgaan uitgelegd waarom handhaving wel of niet onevenredig is?"
      );
    }
  }

  if (guard.caseType === "belastingaanslag") {
    if (!/(aanslag|boete|vergrijpboete|verzuimboete|allebei)/.test(knownText)) {
      pushQuestion(
        questions,
        "Gaat uw bezwaar of beroep over de aanslag, de boete, of allebei?"
      );
    }

    if (!/(correctie|gecorrigeerde post|factuur|omzet|aftrek|kostenpost|bijtelling)/.test(knownText)) {
      pushQuestion(
        questions,
        "Welke correctie vindt u feitelijk onjuist?"
      );
    }

    if (!/(opzet|grove schuld|schuldgradatie|verwijtbaar)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft de Belastingdienst gesteld dat sprake is van opzet of grove schuld?"
      );
    }

    if (!/(stukken ontbreken|ontbrekende stukken|administratie|facturen|bewijsstukken|aangeleverd)/.test(knownText)) {
      pushQuestion(
        questions,
        "Zijn er stukken die u wel had, maar die volgens de Belastingdienst zouden ontbreken?"
      );
    }

    if (!/(pleitbaar standpunt|verdedigbaar|onduidelijke regelgeving|complexe regelgeving)/.test(knownText)) {
      pushQuestion(
        questions,
        "Is uw standpunt volgens u verdedigbaar op basis van onduidelijke of complexe regelgeving?"
      );
    }
  }

  if (guard.caseType === "niet_tijdig_beslissen") {
    if (!/(aanvraag van|bezwaar van|oorspronkelijke aanvraag|oorspronkelijke bezwaar|datum aanvraag|datum bezwaar)/.test(knownText)) {
      pushQuestion(
        questions,
        "Wat is de datum van uw oorspronkelijke aanvraag of bezwaar?"
      );
    }

    if (!/(beslistermijn|wettelijke termijn|meegedeelde termijn|verdaging|opschorting)/.test(knownText)) {
      pushQuestion(
        questions,
        "Weet u welke wettelijke of meegedeelde beslistermijn gold?"
      );
    }

    if (!/(ingebrekestelling|ontvangstbevestiging|track and trace|aangetekend|e-mailheader)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft u een ingebrekestelling gestuurd, en kunt u ontvangst bewijzen?"
      );
    }

    if (!/(twee weken verstreken|14 dagen verstreken|veertien dagen verstreken|na twee weken|minstens twee weken)/.test(knownText)) {
      pushQuestion(
        questions,
        "Zijn daarna minstens twee weken verstreken zonder besluit?"
      );
    }

    if (!/(verdaging|verdaagd|opschorting|opgeschort|rechtsgeldig opgeschort)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft het bestuursorgaan de termijn rechtsgeldig verdaagd of opgeschort?"
      );
    }
  }

  if (guard.caseType === "niet_ontvankelijkheid") {
    if (!/(niet[- ]ontvankelijk|termijnoverschrijding|geen besluit|geen belanghebbende|machtiging|gronden ontbreken)/.test(knownText)) {
      pushQuestion(
        questions,
        "Waarom is uw bezwaar of beroep volgens het bestuursorgaan niet-ontvankelijk verklaard?"
      );
    }

    if (!/(ontvangen op|bekendgemaakt op|datum bekendmaking|datum ontvangst|termijnstart)/.test(knownText)) {
      pushQuestion(
        questions,
        "Op welke datum heeft u het besluit ontvangen of is het bekendgemaakt?"
      );
    }

    if (!/(herstelverzuim|verzuim herstellen|machtiging aanvullen|gronden aanvullen|kans gekregen)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft u de kans gekregen een verzuim te herstellen, zoals het aanvullen van gronden of een machtiging?"
      );
    }

    if (!/(verschoonbaar|ziekte|overmacht|detentie|spoedopname)/.test(knownText)) {
      pushQuestion(
        questions,
        "Zijn er omstandigheden waardoor een termijnoverschrijding verschoonbaar kan zijn?"
      );
    }

    if (!/(geen besluit|1:3 awb|belanghebbende)/.test(knownText)) {
      pushQuestion(
        questions,
        "Twist u vooral dat er geen besluit is, of vooral dat u geen belanghebbende zou zijn?"
      );
    }
  }

  if (guard.caseType === "toeslag") {
    if (!/(voorschot|definitieve berekening|definitieve vaststelling|terugvordering)/.test(knownText)) {
      pushQuestion(
        questions,
        "Gaat het om een voorschot, een definitieve berekening of een terugvordering?"
      );
    }

    if (!/(inkomen|partner|vermogen|opvanguren|kinderen|brp|feitenbasis)/.test(knownText)) {
      pushQuestion(
        questions,
        "Welke feitelijke basis klopt volgens u niet: inkomen, partner, vermogen, opvanguren of iets anders?"
      );
    }

    if (!/(bijzondere omstandigheden|hardheid|evenredigheid|persoonlijke omstandigheden)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft u bijzondere omstandigheden aangevoerd, en is daarop concreet gereageerd?"
      );
    }

    if (!/(berekening|tussenstappen|rekenbasis|specificatie|bedrag)/.test(knownText)) {
      pushQuestion(
        questions,
        "Kunt u de berekening van het bedrag volgen of ontbreken tussenstappen?"
      );
    }

    if (!/(bewijsstukken|aangeleverd|tijdig ingediend|stukken ingediend|contracten|urenstaten)/.test(knownText)) {
      pushQuestion(
        questions,
        "Heeft u de relevante stukken tijdig aangeleverd?"
      );
    }
  }

  const referencedDocumentText = normalizeWhitespace(
    [
      ...(decisionAnalysis?.bijlageReferenties ?? []),
      ...(decisionAnalysis?.bijlagenLijst ?? []),
      ...(decisionAnalysis?.inventarislijstOfDocumenttabel ?? []),
      ...(decisionAnalysis?.correspondentieVerwijzingen ?? []),
      ...(decisionAnalysis?.aandachtspunten ?? []),
      ...(decisionAnalysis?.dragendeOverwegingen ?? []).flatMap((item) => [item.passage, item.duiding]),
      decisionAnalysis?.besluitInhoud,
    ]
      .filter(Boolean)
      .join(" ")
  ).toLowerCase();

  REFERENCED_DOSSIER_DOCUMENTS.forEach((item) => {
    if (
      item.pattern.test(referencedDocumentText) &&
      !item.uploadPattern.test(uploadedDocumentsText)
    ) {
      pushQuestion(questions, item.question);
    }
  });

  if (!hasText(intakeData.datumBesluit) && !hasText(decisionAnalysis?.termijnen)) {
    pushQuestion(questions, "Wat is de dagtekening of ontvangstdatum van het besluit, zodat de termijn veilig kan worden gecontroleerd?");
  }

  if (!/(bekendgemaakt|bekendmaking|ontvangen op|ontvangstdatum|toezending|verzonden op)/.test(knownText)) {
    pushQuestion(questions, "Wanneer en hoe is het besluit precies bekendgemaakt of ontvangen?");
  }

  if (!hasText(intakeData.bestuursorgaan)) {
    pushQuestion(questions, "Welk bestuursorgaan heeft het besluit precies genomen of ondertekend?");
  }

  if (guard.caseTypeConfidence < 0.8 || guard.reasons.includes("document_case_type_conflict")) {
    pushQuestion(
      questions,
      "Wat voor besluit is dit precies volgens de stukken: bijvoorbeeld een beslissing op bezwaar, boetebesluit, handhavingsbesluit, definitieve berekening of iets anders?"
    );
  }

  if (!hasClearProcessPosition(intakeData, knownText)) {
    pushQuestion(
      questions,
      "Wat is uw procespositie in deze zaak: aanvrager, bezwaarmaker, verzoeker om handhaving, belanghebbende of degene aan wie het besluit is gericht?"
    );
  }

  if (guard.reasons.includes("route_uncertain")) {
    pushQuestion(questions, "Wat staat er precies in de rechtsmiddelenclausule: bezwaar, beroep of zienswijze?");
  }

  if (!decisionAnalysis?.dragendeOverwegingen?.length && !hasText(intakeData.besluitSamenvatting)) {
    pushQuestion(questions, "Wat is volgens het besluit de hoofdreden voor afwijzing, oplegging of handhaving?");
  }

  if (flow === "beroep_na_bezwaar" && !hasText(intakeData.eerdereBezwaargronden)) {
    pushQuestion(questions, "Welke bezwaren zijn al in de bezwaarfase aangevoerd en niet of onvoldoende weerlegd?");
  }

  if ((flow === "beroep_na_bezwaar" || flow === "beroep_zonder_bezwaar") && !intakeData.files?.bijlagen?.length) {
    pushQuestion(questions, "Is de eerdere bezwaarbrief, zienswijze of een aanvulling daarop beschikbaar als bijlage?");
  }

  if (!hasText(intakeData.gronden)) {
    pushQuestion(questions, "Welke concrete overweging of feitelijke aanname uit het besluit klopt volgens jou niet?");
  }

  if (!hasText(intakeData.doel)) {
    pushQuestion(questions, "Wat is de juridisch gewenste uitkomst: herroepen, aanpassen, matigen of een nieuw besluit?");
  }

  if (flow === "woo" && !hasText(intakeData.wooDocumenten)) {
    pushQuestion(questions, "Welke documentsoorten moeten expliciet in het Woo-verzoek of bezwaar worden genoemd?");
  }

  return questions.slice(0, 5);
}

function buildUncertainties(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  guard: GenerationGuardResult;
  reviewedAuthorities: ValidatedCitation[];
}): string[] {
  const { flow, intakeData, guard, reviewedAuthorities } = params;
  const items: string[] = [];
  const decisionAnalysis = intakeData.besluitAnalyse;
  const knownText = normalizeWhitespace(
    [
      intakeData.bestuursorgaan,
      intakeData.besluitSamenvatting,
      intakeData.besluitTekst,
      intakeData.gronden,
      intakeData.procedureReden,
      buildDecisionAnalysisText(decisionAnalysis),
      intakeData.waaromBelanghebbende,
    ]
      .filter(Boolean)
      .join(" ")
  ).toLowerCase();
  const mixedAuthorities = reviewedAuthorities.filter((item) => item.verificationStatus === "mixed");
  const unusableAuthorities = reviewedAuthorities.filter((item) => item.verificationStatus === "not_usable");

  if (intakeData.besluitAnalyseStatus === "failed") {
    items.push("Het besluit is niet betrouwbaar uitgelezen; de conceptbrief steunt daarom zwaarder op intake-antwoorden.");
  } else if (intakeData.besluitAnalyseStatus === "partial") {
    items.push("De besluitanalyse is deels gelukt; specifieke passages en termijnen moeten nog handmatig worden nagelopen.");
  }

  if (!decisionAnalysis?.dragendeOverwegingen?.length) {
    items.push("De dragende motivering is nog niet scherp als aparte overwegingen vastgelegd.");
  }

  if (!hasText(intakeData.datumBesluit) && !hasText(decisionAnalysis?.termijnen)) {
    items.push("De dossierstukken geven nog geen harde basis voor termijncontrole.");
  }

  if (!/(bekendgemaakt|bekendmaking|ontvangen op|ontvangstdatum|toezending|verzonden op)/.test(knownText)) {
    items.push("De wijze van bekendmaking of ontvangst is nog niet scherp genoeg vastgelegd.");
  }

  if (!hasClearProcessPosition(intakeData, knownText)) {
    items.push("De procespositie van de gebruiker is nog niet voldoende bevestigd.");
  }

  if (!decisionAnalysis?.rechtsmiddelenclausule && guard.reasons.includes("route_uncertain")) {
    items.push("De rechtsmiddelenclausule ontbreekt of is nog niet duidelijk uitgelezen.");
  }

  if (guard.missingFields.length > 0) {
    items.push(`Nog ontbrekend voor volledige positionering: ${guard.missingFields.map(humanizeField).join(", ")}.`);
  }

  if (flow !== "woo" && !intakeData.files?.besluit) {
    items.push("Er is geen besluitbestand gekoppeld, waardoor passagegerichte toetsing beperkt blijft.");
  }

  if (mixedAuthorities.length > 0) {
    items.push("Een deel van de aangetroffen jurisprudentie of bronverwijzingen is slechts deels verifieerbaar en wordt daarom niet als dragende verwijzing gebruikt.");
  }

  if (unusableAuthorities.length > 0) {
    items.push("Niet-verifieerbare uitspraken of bronverwijzingen zijn buiten de brief gehouden.");
  }

  buildAlertDrivenNotes({ intakeData }).forEach((note) => {
    items.push(note);
  });

  return [...new Set(items)].slice(0, 6);
}

export function buildCaseFileAnalysis(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  guard: GenerationGuardResult;
  reviewedAuthorities: ValidatedCitation[];
}): CaseFileAnalysisSummary {
  const { flow, intakeData, guard, reviewedAuthorities } = params;
  const moduleKey = getWorkflowModuleKey(guard.caseType);
  const moduleLabel = getModuleLabel({ flow, caseType: guard.caseType });
  const procedurefase = getProcedurePhaseLabel(flow);
  const kernconflict = buildKernConflict({
    flow,
    intakeData,
    caseType: guard.caseType,
  });
  const primaryRisks = buildPrimaryProcessRisks({
    flow,
    intakeData,
    guard,
    reviewedAuthorities,
  });
  const uncertainties = buildUncertainties({
    flow,
    intakeData,
    guard,
    reviewedAuthorities,
  });
  const groundsMatrix = buildGroundsMatrix({
    flow,
    intakeData,
    reviewedAuthorities,
  });
  const relevanteAanvullendeArgumenten = buildRelevantAdditionalArguments({
    intakeData,
    caseType: guard.caseType,
  });
  const labeledStellingen = buildLabeledStatements({
    flow,
    intakeData,
    reviewedAuthorities,
    kernconflict,
    primaryRisks,
    uncertainties,
  });
  const jurisprudentieControle = reviewedAuthorities.reduce(
    (acc, authority) => {
      if (authority.sourceType !== "jurisprudentie") {
        return acc;
      }

      if (authority.verificationStatus === "verified") {
        acc.verified += 1;
      } else if (authority.verificationStatus === "mixed") {
        acc.mixed += 1;
      } else {
        acc.notUsable += 1;
      }

      return acc;
    },
    { verified: 0, mixed: 0, notUsable: 0 }
  );

  const ontbrekendeInformatie = [
    ...guard.missingFields.map(humanizeField),
    ...(!hasText(intakeData.datumBesluit) && !hasText(intakeData.besluitAnalyse?.termijnen)
      ? ["de precieze termijninformatie"]
      : []),
    ...(!/(bekendgemaakt|bekendmaking|ontvangen op|ontvangstdatum|toezending|verzonden op)/.test(
      normalizeWhitespace(
        [
          intakeData.besluitSamenvatting,
          intakeData.besluitTekst,
          buildDecisionAnalysisText(intakeData.besluitAnalyse),
        ]
          .filter(Boolean)
          .join(" ")
      ).toLowerCase()
    )
      ? ["de wijze van bekendmaking of ontvangst"]
      : []),
    ...(!hasClearProcessPosition(
      intakeData,
      normalizeWhitespace(
        [
          intakeData.gronden,
          intakeData.procedureReden,
          intakeData.waaromBelanghebbende,
          buildDecisionAnalysisText(intakeData.besluitAnalyse),
        ]
          .filter(Boolean)
          .join(" ")
      ).toLowerCase()
    )
      ? ["de juiste procespositie van de gebruiker"]
      : []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const gerichteCheckvragen = buildTargetedQuestions({ flow, intakeData, guard });
  const evidenceHooks = groundsMatrix
    .flatMap((ground) => [
      ground.relevantFeitOfBewijs?.statement ?? "",
      ground.decisionPassage?.statement ?? "",
    ])
    .map((item) => item.replace(/[.!?]+$/, ""))
    .filter(Boolean);
  const misclassificationRisks = guard.reasons
    .filter((reason) => /case_type_uncertain|document_case_type_conflict|route_uncertain/.test(reason))
    .map((reason) => {
      if (reason === "document_case_type_conflict") {
        return "Document en intake wijzen op verschillende modules; sectorspecifieke aannames zijn daarom geblokkeerd.";
      }

      if (reason === "route_uncertain") {
        return "De procesroute is nog niet volledig zeker.";
      }

      return "Het zaaktype is nog niet volledig zeker geclassificeerd.";
    });
  const workflowProfile = buildLegalWorkflowProfile({
    moduleKey,
    moduleLabel,
    guard,
    groundsMatrix,
    reviewedAuthorities,
    missingInfoTriggers: ontbrekendeInformatie,
    misclassificationRisks,
    evidenceHooks,
  });

  const explanationParts = [
    `Module: ${moduleLabel}.`,
    `Procedurefase: ${procedurefase}.`,
    `Kernconflict: ${kernconflict}`,
    primaryRisks.length > 0
      ? `Belangrijkste procesrisico's: ${primaryRisks.map((risk) => shorten(risk, 120)).join(" ")}`
      : "",
    jurisprudentieControle.verified > 0
      ? `Er zijn ${jurisprudentieControle.verified} geverifieerde uitspraken beschikbaar voor eventueel gebruik in de brief.`
      : "Er is geen geverifieerde jurisprudentie beschikbaar om veilig in de brief te verwerken.",
  ].filter(Boolean);

  return {
    module: moduleLabel,
    procedurefase,
    kernconflict,
    primaireProcesrisicos: primaryRisks,
    ontbrekendeInformatie,
    gerichteCheckvragen,
    onzekerheden: uncertainties,
    toelichting: explanationParts.join(" "),
    labeledStellingen,
    groundsMatrix,
    relevanteAanvullendeArgumenten,
    workflowProfile,
    jurisprudentieControle,
  };
}
