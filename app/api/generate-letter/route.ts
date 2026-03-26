import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Flow, IntakeFormData, Product } from "@/types";
import { getReferences } from "@/src/data/references";
import { ReferenceItem } from "@/src/types/references";
import { generateLetter } from "@/lib/ai/generateLetter";
import { buildLetterPrompt } from "@/lib/ai/buildLetterPrompt";
import { classifyCase } from "@/lib/intake/classifyCase";
import { determineRoute } from "@/lib/intake/determineRoute";
import { getMissingRequiredFields } from "@/lib/intake/requiredFields";
import { GenerationGuardResult, PromptPayload } from "@/lib/legal/types";
import { cleanLetterTextForDelivery } from "@/lib/letter-format";
import { loadSourceSet } from "@/lib/sources/loadSourceSet";
import { validateAuthorities } from "@/lib/sources/validateAuthorities";
import { validateSourceSet } from "@/lib/sources/validateSourceSet";

export const runtime = "nodejs";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function sanitize(value?: string): string {
  return (value ?? "onbekend").trim() || "onbekend";
}

function detectOrgType(value?: string): ReferenceItem["orgType"] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("gemeente")) return "gemeente";
  if (normalized.includes("provincie")) return "provincie";
  if (normalized.includes("waterschap")) return "waterschap";
  if (normalized.includes("ministerie") || normalized.includes("rijk") || normalized.includes("belastingdienst")) {
    return "rijk";
  }
  return "overig";
}

function buildReferenceKeywords(data: IntakeFormData, flow: Flow): string[] {
  const decisionSignals = [
    data.besluitDocumentType,
    data.besluitSamenvatting,
    data.besluitAnalyse?.onderwerp,
    data.besluitAnalyse?.rechtsgrond,
    data.besluitAnalyse?.besluitInhoud,
    ...(data.besluitAnalyse?.aandachtspunten ?? []),
  ];

  const rawText =
    flow === "woo"
      ? [data.bestuursorgaan, data.wooOnderwerp, data.wooDocumenten, data.wooPeriode].join(" ")
      : [
          data.bestuursorgaan,
          data.categorie,
          data.doel,
          data.gronden,
          data.procedureReden,
          data.eerdereBezwaargronden,
          ...decisionSignals,
        ].join(" ");

  return rawText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 3);
}

function getDecisionStatusLabel(data: IntakeFormData): string {
  if (data.besluitAnalyseStatus === "read") {
    return "besluit gelezen";
  }
  if (data.besluitAnalyseStatus === "partial") {
    return "besluit deels gelezen";
  }
  return "alleen intake gebruikt";
}

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

function splitIntoPoints(value?: string | null, maxItems = 5): string[] {
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

function buildBestredenBesluitLabel(data: IntakeFormData): string {
  const rawType = hasText(data.besluitDocumentType)
    ? data.besluitDocumentType
    : hasText(data.categorie)
      ? `${data.categorie} besluit`
      : "bestreden besluit";
  const datePart = hasText(data.datumBesluit) ? ` van ${data.datumBesluit}` : "";

  return `${normalizeWhitespace(rawType)}${datePart}`;
}

function buildDesiredOutcome(data: IntakeFormData): string {
  if (hasText(data.doel)) {
    return ensureSentence(shorten(data.doel, 180));
  }

  return "[gewenste uitkomst invullen].";
}

function buildDisputeCore(data: IntakeFormData): string {
  const lines: string[] = [];

  if (hasText(data.besluitSamenvatting)) {
    lines.push(ensureSentence(shorten(data.besluitSamenvatting, 200)));
  } else {
    lines.push(`Het bezwaar richt zich tegen ${buildBestredenBesluitLabel(data)}.`);
  }

  if (hasText(data.gronden)) {
    lines.push(
      `Volgens de intake is het besluit onjuist of onvolledig omdat ${shorten(data.gronden, 180).replace(/[.!?]+$/, "")}.`
    );
  } else {
    lines.push("Indiener vraagt om een volledige heroverweging van het besluit.");
  }

  return lines.join(" ");
}

interface EvidenceEntry {
  label: string;
  relevance: string;
}

function buildEvidenceOverview(data: IntakeFormData): {
  sent: EvidenceEntry[];
  mentionedNotSent: EvidenceEntry[];
} {
  const sent: EvidenceEntry[] = [];
  const mentionedNotSent: EvidenceEntry[] = [];

  if (data.files?.besluit?.name) {
    sent.push({
      label: `Kopie van het bestreden besluit (${data.files.besluit.name})`,
      relevance: "Toont welk besluit wordt bestreden en welke datum en kenmerken daarbij horen.",
    });
  } else {
    mentionedNotSent.push({
      label: hasText(data.datumBesluit) || hasText(data.kenmerk) || hasText(data.besluitDocumentType)
        ? `Bestreden besluit (${buildBestredenBesluitLabel(data)})`
        : "Bestreden besluit",
      relevance: "Vormt het object van dit bezwaar en is in de hoofdbrief en samenvatting beschreven.",
    });
  }

  (data.files?.bijlagen ?? []).forEach((file) => {
    sent.push({
      label: file.name,
      relevance: "Door indiener meegestuurd ter onderbouwing van de feiten, gevolgen of context van het bezwaar.",
    });
  });

  if (sent.length === 0 && mentionedNotSent.length === 0) {
    mentionedNotSent.push({
      label: "Bestreden besluit",
      relevance: "Vormt het object van dit bezwaar.",
    });
  }

  return { sent, mentionedNotSent };
}

function buildLegalGrounds(data: IntakeFormData): Array<{ title: string; paragraphs: string[] }> {
  const grounds: Array<{ title: string; paragraphs: string[] }> = [
    {
      title: "1. MOTIVERINGSGEBREK",
      paragraphs: [
        hasText(data.gronden)
          ? `Voor zover nu kenbaar maakt het besluit niet voldoende inzichtelijk waarom het bestuursorgaan tot deze uitkomst is gekomen, mede in het licht van het bezwaar dat ${shorten(data.gronden, 180).replace(/[.!?]+$/, "")}.`
          : "Voor zover nu kenbaar maakt het bestreden besluit niet dragend duidelijk waarom deze uitkomst gerechtvaardigd is.",
        "Een besluit moet berusten op een kenbare en deugdelijke motivering, zodat controleerbaar is hoe de feiten en belangen zijn gewogen.",
      ],
    },
    {
      title: "2. ZORGVULDIGHEIDSBEGINSEL",
      paragraphs: [
        hasText(data.persoonlijkeOmstandigheden)
          ? `De intake noemt als relevante feitelijke situatie: ${ensureSentence(shorten(data.persoonlijkeOmstandigheden, 170))}`
          : "In bezwaar moet het bestuursorgaan nagaan of alle relevante feiten, omstandigheden en stukken volledig in beeld zijn gebracht.",
        "Als die gegevens niet of onvoldoende in de voorbereiding zijn betrokken, is de besluitvorming niet zorgvuldig geweest.",
      ],
    },
  ];

  if (hasText(data.persoonlijkeOmstandigheden) || hasText(data.doel)) {
    grounds.push({
      title: "3. EVENREDIGHEIDSBEGINSEL EN VOLLEDIGE HEROVERWEGING",
      paragraphs: [
        hasText(data.persoonlijkeOmstandigheden)
          ? `De gevolgen van het besluit raken de indiener volgens de intake als volgt: ${ensureSentence(shorten(data.persoonlijkeOmstandigheden, 170))}`
          : "In bezwaar moet worden beoordeeld of de nadelige gevolgen van het besluit in verhouding staan tot het doel ervan.",
        `Dat vergt een concrete heroverweging van het verzoek om ${buildDesiredOutcome(data).replace(/[.!?]+$/, "")} en van eventuele minder bezwarende alternatieven.`,
      ],
    });
  }

  return grounds;
}

function buildBezwaarAppendix(data: IntakeFormData): string {
  const summaryLines = [
    `- Bestreden besluit: ${buildBestredenBesluitLabel(data)}.`,
    `- Bestuursorgaan: ${sanitize(data.bestuursorgaan)}.`,
    `- Kern van het geschil: ${buildDisputeCore(data)}`,
    `- Gewenste uitkomst: ${buildDesiredOutcome(data)}`,
  ];

  const groundPoints = splitIntoPoints(data.gronden, 3);
  if (groundPoints.length > 0) {
    groundPoints.forEach((ground, index) => {
      summaryLines.push(`- Belangrijkste bezwaar ${index + 1}: ${ensureSentence(shorten(ground, 170))}`);
    });
  } else {
    summaryLines.push("- Belangrijkste bezwaren: de motivering, zorgvuldigheid en heroverweging van het besluit worden betwist.");
  }

  if (hasText(data.persoonlijkeOmstandigheden)) {
    summaryLines.push(`- Impact: ${ensureSentence(shorten(data.persoonlijkeOmstandigheden, 180))}`);
  }

  const facts: string[] = [];
  let factIndex = 1;
  facts.push(`${factIndex++}. Bestuursorgaan: ${sanitize(data.bestuursorgaan)}.`);
  facts.push(`${factIndex++}. Bestreden besluit: ${buildBestredenBesluitLabel(data)}.`);

  if (hasText(data.kenmerk)) {
    facts.push(`${factIndex++}. Kenmerk of dossiernummer: ${data.kenmerk}.`);
  }

  if (hasText(data.besluitSamenvatting)) {
    facts.push(`${factIndex++}. Volgens de intake houdt het besluit in: ${ensureSentence(shorten(data.besluitSamenvatting, 220))}`);
  } else if (hasText(data.besluitAnalyse?.besluitInhoud)) {
    facts.push(`${factIndex++}. Uit de besluituitlezing volgt als kern van het besluit: ${ensureSentence(shorten(data.besluitAnalyse.besluitInhoud, 220))}`);
  }

  if (hasText(data.persoonlijkeOmstandigheden)) {
    facts.push(`${factIndex++}. Feitelijke situatie van indiener: ${ensureSentence(shorten(data.persoonlijkeOmstandigheden, 220))}`);
  }

  if (hasText(data.besluitAnalyse?.termijnen)) {
    facts.push(`${factIndex++}. Relevante procedure-informatie uit het besluit: ${ensureSentence(shorten(data.besluitAnalyse.termijnen, 180))}`);
  }

  if (data.files?.besluit?.name) {
    facts.push(`${factIndex++}. Een kopie van het bestreden besluit is als bestand beschikbaar gesteld: ${data.files.besluit.name}.`);
  }

  if ((data.files?.bijlagen ?? []).length > 0) {
    facts.push(`${factIndex++}. Aanvullende meegestuurde stukken: ${(data.files?.bijlagen ?? []).map((file) => file.name).join(", ")}.`);
  }

  const evidence = buildEvidenceOverview(data);
  const evidenceLines: string[] = [];

  if (evidence.sent.length > 0) {
    evidenceLines.push("MEEGEZONDEN STUKKEN", "");
    evidence.sent.forEach((item, index) => {
      evidenceLines.push(`${index + 1}. ${item.label}. Relevantie: ${item.relevance}`);
    });
  }

  if (evidence.mentionedNotSent.length > 0) {
    if (evidenceLines.length > 0) {
      evidenceLines.push("", "WEL GENOEMD, NIET MEEGEZONDEN", "");
    } else {
      evidenceLines.push("WEL GENOEMD, NIET MEEGEZONDEN", "");
    }

    evidence.mentionedNotSent.forEach((item, index) => {
      evidenceLines.push(`${index + 1}. ${item.label}. Relevantie: ${item.relevance}`);
    });
  }

  const sections = [
    "",
    "BIJLAGE A - SAMENVATTING VAN HET GESCHIL",
    "",
    ...summaryLines,
    "",
    "BIJLAGE B - FEITEN EN CONTEXT",
    "",
    ...facts,
    "",
    "BIJLAGE C - JURIDISCHE BEZWAREN",
    "",
  ];

  buildLegalGrounds(data).forEach((ground, index) => {
    if (index > 0) {
      sections.push("");
    }
    sections.push(ground.title, "");
    ground.paragraphs.forEach((paragraph) => {
      sections.push(paragraph, "");
    });
    sections.pop();
  });

  if (evidenceLines.length > 0) {
    sections.push("", "BIJLAGE D - OVERZICHT BEWIJSSTUKKEN", "", ...evidenceLines);
  }

  if (hasText(data.doel)) {
    sections.push(
      "",
      "BIJLAGE E - GEWENSTE OPLOSSING",
      "",
      `1. Primair verzoekt indiener om ${buildDesiredOutcome(data).replace(/[.!?]+$/, "")}.`,
      "2. Subsidiair wordt verzocht om een nieuw besluit na volledige heroverweging, met een draagkrachtige motivering en een kenbare belangenafweging."
    );
  }

  return sections.join("\n");
}

function buildCaseFacts(data: IntakeFormData, flow: Flow): string[] {
  if (flow === "woo") {
    return [
      `Bestuursorgaan: ${data.bestuursorgaan}`,
      `Onderwerp: ${data.wooOnderwerp ?? "onbekend"}`,
      `Periode: ${data.wooPeriode ?? "onbekend"}`,
      `Documentsoorten: ${data.wooDocumenten ?? "onbekend"}`,
      `Digitale verstrekking gevraagd: ${data.digitaleVerstrekking ? "ja" : "nee"}`,
      `Spoed: ${data.spoed ? "ja" : "nee"}`,
    ];
  }

  const caseFacts = [
    `Bestuursorgaan: ${data.bestuursorgaan}`,
    `Procedureadvies: ${data.procedureAdvies ?? flow}`,
    `Proceduretoelichting: ${data.procedureReden ?? "onbekend"}`,
    `Datum besluit: ${data.datumBesluit ?? "onbekend"}`,
    `Kenmerk: ${data.kenmerk ?? "onbekend"}`,
    `Categorie: ${data.categorie ?? "onbekend"}`,
    `Doel: ${data.doel ?? "onbekend"}`,
    `Gronden uit intake: ${data.gronden ?? "onbekend"}`,
    `Persoonlijke omstandigheden: ${data.persoonlijkeOmstandigheden ?? "geen"}`,
    `Eerdere bezwaargronden: ${data.eerdereBezwaargronden ?? "geen"}`,
    `Status besluituitlezing: ${getDecisionStatusLabel(data)}`,
    `Leeskwaliteit besluitbestand: ${data.besluitLeeskwaliteit ?? "onbekend"}`,
  ];

  if (data.files?.besluit?.name) {
    caseFacts.push(`Besluitbestand: ${data.files.besluit.name}`);
  }

  if ((data.files?.bijlagen ?? []).length > 0) {
    caseFacts.push(`Extra bijlagen: ${(data.files?.bijlagen ?? []).map((file) => file.name).join("; ")}`);
  }

  if (data.besluitDocumentType) {
    caseFacts.push(`Documenttype besluit: ${data.besluitDocumentType}`);
  }

  if (data.besluitSamenvatting) {
    caseFacts.push(`Samenvatting van besluit: ${data.besluitSamenvatting}`);
  }

  if (data.besluitAnalyse?.bestuursorgaan) {
    caseFacts.push(`Bestuursorgaan uit besluit: ${data.besluitAnalyse.bestuursorgaan}`);
  }

  if (data.besluitAnalyse?.onderwerp) {
    caseFacts.push(`Onderwerp uit besluit: ${data.besluitAnalyse.onderwerp}`);
  }

  if (data.besluitAnalyse?.rechtsgrond) {
    caseFacts.push(`Rechtsgrond uit besluit: ${data.besluitAnalyse.rechtsgrond}`);
  }

  if (data.besluitAnalyse?.besluitInhoud) {
    caseFacts.push(`Kern van het besluit: ${data.besluitAnalyse.besluitInhoud}`);
  }

  if (data.besluitAnalyse?.termijnen) {
    caseFacts.push(`Zichtbare termijn: ${data.besluitAnalyse.termijnen}`);
  }

  if (data.besluitAnalyse?.aandachtspunten?.length) {
    caseFacts.push(`Aandachtspunten uit besluit: ${data.besluitAnalyse.aandachtspunten.join("; ")}`);
  }

  if (data.besluitTekst) {
    caseFacts.push(`Tekstfragment uit besluit: ${data.besluitTekst.slice(0, 2500)}`);
  }

  return caseFacts;
}

function buildSafeFallbackLetter(params: {
  flow: Flow;
  intakeData: IntakeFormData;
}): string {
  const { flow, intakeData } = params;

  if (flow === "woo") {
    return [
      "[Jouw naam]",
      "[Jouw adres]",
      "[Postcode en woonplaats]",
      "[E-mailadres]",
      "[Telefoonnummer]",
      "",
      "Aan:",
      `${intakeData.bestuursorgaan}`,
      "[Adres bestuursorgaan]",
      "[Postcode en plaats]",
      "",
      "Betreft: Woo-verzoek",
      "Datum: [vandaag invullen]",
      "",
      "Geacht bestuursorgaan,",
      "",
      "Hierbij verzoek ik op grond van de Wet open overheid om openbaarmaking van documenten over het volgende onderwerp.",
      "",
      `${intakeData.wooOnderwerp ?? "[onderwerp invullen]"}`,
      "",
      `Periode: ${intakeData.wooPeriode ?? "[periode invullen]"}`,
      `Gevraagde documenten: ${intakeData.wooDocumenten ?? "[documentsoorten invullen]"}`,
      "",
      "Ik verzoek u de documenten, waar mogelijk, digitaal te verstrekken en de ontvangst van dit verzoek te bevestigen.",
      "",
      "Hoogachtend,",
      "",
      "[Jouw naam]",
    ].join("\n");
  }

  if (flow === "zienswijze") {
    return [
      "[Jouw naam]",
      "[Jouw adres]",
      "[Postcode en woonplaats]",
      "[E-mailadres]",
      "[Telefoonnummer]",
      "",
      "Aan:",
      `${intakeData.bestuursorgaan}`,
      "[Adres bestuursorgaan]",
      "[Postcode en plaats]",
      "",
      `Betreft: Zienswijze over ${intakeData.categorie ?? "het ontwerpbesluit"}`,
      "Datum: [vandaag invullen]",
      "",
      "Geacht bestuursorgaan,",
      "",
      "Hierbij dien ik een zienswijze in over het ontwerpbesluit dat op mijn situatie betrekking heeft.",
      "",
      `Volgens mijn gegevens gaat het om ${sanitize(intakeData.categorie)}.`,
      intakeData.besluitSamenvatting
        ? intakeData.besluitSamenvatting
        : "De precieze inhoud van het ontwerpbesluit moet nog worden gecontroleerd aan de hand van de stukken.",
      "",
      `Mijn belang bij dit ontwerpbesluit is als volgt: ${sanitize(intakeData.persoonlijkeOmstandigheden)}.`,
      "",
      `Ik kan mij hiermee niet verenigen omdat ${sanitize(intakeData.gronden)}.`,
      "",
      `Ik verzoek u het ontwerpbesluit aan te passen in die zin dat ${sanitize(intakeData.doel)}.`,
      "",
      "Hoogachtend,",
      "",
      "[Jouw naam]",
    ].join("\n");
  }

  if (flow === "beroep_zonder_bezwaar") {
    return [
      "[Jouw naam]",
      "[Jouw adres]",
      "[Postcode en woonplaats]",
      "[E-mailadres]",
      "[Telefoonnummer]",
      "",
      "Aan:",
      "[Bevoegde rechtbank]",
      "[Adres rechtbank]",
      "[Postcode en plaats]",
      "",
      "Betreft: Beroepschrift",
      `Kenmerk: ${intakeData.kenmerk ?? "[kenmerk invullen]"}`,
      `Datum besluit: ${intakeData.datumBesluit ?? "[datum invullen]"}`,
      "Datum: [vandaag invullen]",
      "",
      "Geachte rechtbank,",
      "",
      `Hierbij stel ik beroep in tegen het besluit van ${sanitize(intakeData.bestuursorgaan)}.`,
      "",
      "Waarom direct beroep mogelijk is",
      ensureSentence(
        intakeData.procedureReden ??
          "Op basis van de beschikbare gegevens lijkt direct beroep open te staan zonder voorafgaande bezwaarprocedure."
      ),
      "",
      "Feiten en besluit",
      `Volgens mijn gegevens betreft het een ${sanitize(intakeData.categorie)}.`,
      intakeData.besluitSamenvatting
        ? intakeData.besluitSamenvatting
        : "De kern van het primaire besluit moet nog nader worden getoetst aan de hand van het besluit zelf.",
      "",
      "Beroepsgronden",
      `Ik ben het niet eens met het besluit omdat ${sanitize(intakeData.gronden)}.`,
      "",
      "Verzoek",
      `Ik verzoek de rechtbank het besluit te vernietigen en te bepalen dat ${sanitize(intakeData.doel)}.`,
      "",
      "Hoogachtend,",
      "",
      "[Jouw naam]",
    ].join("\n");
  }

  if (flow === "beroep_na_bezwaar") {
    return [
      "[Jouw naam]",
      "[Jouw adres]",
      "[Postcode en woonplaats]",
      "[E-mailadres]",
      "[Telefoonnummer]",
      "",
      "Aan:",
      "[Bevoegde rechtbank]",
      "[Adres rechtbank]",
      "[Postcode en plaats]",
      "",
      "Betreft: Beroepschrift tegen beslissing op bezwaar",
      `Kenmerk: ${intakeData.kenmerk ?? "[kenmerk invullen]"}`,
      `Datum beslissing op bezwaar: ${intakeData.datumBesluit ?? "[datum invullen]"}`,
      "Datum: [vandaag invullen]",
      "",
      "Geachte rechtbank,",
      "",
      `Hierbij stel ik beroep in tegen de beslissing op bezwaar van ${sanitize(intakeData.bestuursorgaan)}.`,
      "",
      "Voorgeschiedenis",
      intakeData.eerdereBezwaargronden
        ? `In bezwaar heb ik onder meer aangevoerd dat ${intakeData.eerdereBezwaargronden}.`
        : "In bezwaar zijn eerder inhoudelijke gronden aangevoerd tegen het primaire besluit.",
      "",
      "Waarom de beslissing op bezwaar onjuist is",
      `De beslissing op bezwaar blijft volgens mij onjuist omdat ${sanitize(intakeData.gronden)}.`,
      "",
      "Verzoek",
      `Ik verzoek de rechtbank de beslissing op bezwaar te vernietigen en te bepalen dat ${sanitize(intakeData.doel)}.`,
      "",
      "Hoogachtend,",
      "",
      "[Jouw naam]",
    ].join("\n");
  }

  const subject = intakeData.besluitDocumentType
    ? `Bezwaarschrift tegen ${intakeData.besluitDocumentType}`
    : "Bezwaarschrift";

  return [
    "[Jouw naam]",
    "[Jouw adres]",
    "[Postcode en woonplaats]",
    "[E-mailadres]",
    "[Telefoonnummer]",
    "",
    "Aan:",
    `${intakeData.bestuursorgaan}`,
    "[Adres bestuursorgaan]",
    "[Postcode en plaats]",
    "",
    `Betreft: ${subject}`,
    `Kenmerk: ${intakeData.kenmerk ?? "[kenmerk invullen]"}`,
    `Datum besluit: ${intakeData.datumBesluit ?? "[datum invullen]"}`,
    "Datum: [vandaag invullen]",
    "",
    "Geacht bestuursorgaan,",
    "",
    "Hierbij maak ik bezwaar tegen het hierboven genoemde besluit.",
    "",
    "Feiten en besluit",
    `Volgens mijn gegevens betreft het een ${intakeData.categorie ?? "bestuursrechtelijk"} besluit van ${intakeData.bestuursorgaan}.`,
    intakeData.besluitSamenvatting
      ? intakeData.besluitSamenvatting
      : "De precieze inhoud van het bestreden besluit moet nog nader worden gecontroleerd aan de hand van het besluit zelf.",
    "",
    "Gronden van bezwaar",
    `Ik ben het niet eens met het besluit omdat ${sanitize(intakeData.gronden)}.`,
    "Ik verzoek u het besluit opnieuw en volledig te beoordelen en daarbij ook mijn persoonlijke belangen mee te wegen.",
    "",
    "Verzoek",
    `Ik verzoek u het besluit te ${sanitize(intakeData.doel)} of daarvoor een nieuw besluit in de plaats te stellen.`,
    "",
    "Ik verzoek u mij in de gelegenheid te stellen mijn bezwaar zo nodig nader toe te lichten tijdens een hoorzitting.",
    "",
    "Hoogachtend,",
    "",
    "[Jouw naam]",
    buildBezwaarAppendix(intakeData),
  ].join("\n");
}

function buildGuardResult(params: {
  intakeData: IntakeFormData;
  flow: Flow;
  references: ReferenceItem[];
}): GenerationGuardResult {
  const { intakeData, flow, references } = params;
  const classification = classifyCase({ flow, intakeData });
  const routing = determineRoute({ flow, caseType: classification.caseType, intakeData });
  const sourceSet = loadSourceSet(classification.caseType, routing.route);
  const sourceSetValidation = validateSourceSet(sourceSet);
  const missingFields = getMissingRequiredFields(flow, intakeData);

  const authorityValidation = sourceSet
    ? validateAuthorities({ references, sourceSet })
    : { allowedAuthorities: [], rejectedAuthorities: [], auditTrail: ["No source set available for authority validation."] };

  const softSignals: string[] = [];
  const hardBlockers: string[] = [];

  if (classification.caseType === "onzeker_handmatige_triage" || classification.confidence < 0.7) {
    softSignals.push("case_type_uncertain");
  }

  if (routing.route === "handmatige_triage" || routing.confidence < 0.6) {
    softSignals.push("route_uncertain");
  }

  if (!sourceSetValidation.ok) {
    hardBlockers.push(...sourceSetValidation.reasons);
  }

  if (!sourceSet) {
    hardBlockers.push("missing_source_set");
  }

  if (missingFields.length > 0) {
    hardBlockers.push("missing_required_intake_fields");
  }

  const auditTrail = [
    `Classified caseType=${classification.caseType} confidence=${classification.confidence.toFixed(2)}`,
    `Determined route=${routing.route} confidence=${routing.confidence.toFixed(2)}`,
    sourceSet ? `Loaded source set: ${sourceSet.caseType}/${sourceSet.route}` : "No source set loaded",
    ...authorityValidation.auditTrail,
  ];

  const generationMode =
    hardBlockers.length > 0
      ? "static_fallback"
      : softSignals.length > 0
        ? "safe_generic_ai"
        : "validated";

  return {
    ok: generationMode === "validated",
    fallbackMode: generationMode === "static_fallback" ? "safe_generic" : "none",
    generationMode,
    reasons: [...softSignals, ...hardBlockers],
    hardBlockers,
    softSignals,
    missingFields,
    caseType: classification.caseType,
    route: routing.route,
    caseTypeConfidence: classification.confidence,
    routeConfidence: routing.confidence,
    selectedSourceSet: sourceSet ?? undefined,
    rejectedSources: [
      ...sourceSetValidation.rejectedSources,
      ...authorityValidation.rejectedAuthorities.map((authority) => authority.id),
    ],
    validatedAuthorities: authorityValidation.allowedAuthorities,
    auditTrail,
  };
}

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY ontbreekt op de server." },
        { status: 500 }
      );
    }

    const { intakeData, product, flow } = (await req.json()) as {
      intakeData: IntakeFormData;
      product: Product;
      flow: Flow;
    };

    if (!intakeData || !product || !flow) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const references = getReferences({
      flow,
      orgType: detectOrgType(intakeData.bestuursorgaan),
      decisionType: flow === "woo" ? undefined : intakeData.categorie,
      keywords: buildReferenceKeywords(intakeData, flow),
      limit: 6,
    });

    const guard = buildGuardResult({ intakeData, flow, references });

    if (guard.generationMode === "static_fallback" || !guard.selectedSourceSet) {
      const fallbackLetter = cleanLetterTextForDelivery(buildSafeFallbackLetter({
        flow,
        intakeData,
      }));

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: [] as ReferenceItem[],
          generationMode: "static_fallback" as const,
          guardReasons: guard.reasons,
        },
        guard,
      });
    }

    const payload: PromptPayload = {
      flow,
      caseType: guard.caseType,
      route: guard.route,
      caseFacts: buildCaseFacts(intakeData, flow),
      decisionMeta: [
        `CaseType: ${guard.caseType}`,
        `Route: ${guard.route}`,
        `CaseType confidence: ${guard.caseTypeConfidence.toFixed(2)}`,
        `Route confidence: ${guard.routeConfidence.toFixed(2)}`,
        `Generation mode: ${guard.generationMode}`,
        `Decision extraction status: ${intakeData.besluitAnalyseStatus ?? "failed"}`,
        `Decision readability: ${intakeData.besluitLeeskwaliteit ?? "unknown"}`,
        `Guard reasons: ${guard.reasons.length > 0 ? guard.reasons.join(", ") : "none"}`,
      ],
      decisionAnalysis: intakeData.besluitAnalyse ?? null,
      decisionAnalysisStatus: intakeData.besluitAnalyseStatus ?? "failed",
      decisionReadability: intakeData.besluitLeeskwaliteit ?? null,
      selectedSources: guard.selectedSourceSet.primarySources,
      validatedAuthorities: guard.validatedAuthorities,
      disallowedBehaviors: [
        "Geen nieuwe bronnen buiten selectedSources/validatedAuthorities.",
        "Geen ECLI's zonder validatie.",
        "Geen wetsartikelen of sectorspecifieke rechtsgronden op basis van aannames.",
        "Geen stellige juridische conclusie zonder feitelijke basis in intake of besluitanalyse.",
      ],
    };

    if (guard.generationMode === "safe_generic_ai") {
      payload.disallowedBehaviors.push(
        "Veilige modus actief: baseer je op algemene Awb-grondslagen en expliciet uit het besluit blijkende gegevens, zonder sectorspecifieke details te raden."
      );
    }

    const prompt = buildLetterPrompt({
      intakeData,
      product,
      payload,
    });

    const letterText = await generateLetter(openai, prompt);
    const cleanedLetterText = cleanLetterTextForDelivery(letterText);

    if (!cleanedLetterText.trim()) {
      const fallbackLetter = cleanLetterTextForDelivery(buildSafeFallbackLetter({
        flow,
        intakeData,
      }));

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: guard.validatedAuthorities,
          generationMode: "static_fallback" as const,
          guardReasons: [...guard.reasons, "empty_generation_output"],
        },
        guard: {
          ...guard,
          ok: false,
          fallbackMode: "safe_generic",
          generationMode: "static_fallback" as const,
          reasons: [...guard.reasons, "empty_generation_output"],
          hardBlockers: [...guard.hardBlockers, "empty_generation_output"],
        },
      });
    }

    return NextResponse.json({
      letter: {
        letterText: cleanedLetterText,
        references: guard.validatedAuthorities,
        generationMode: guard.generationMode,
        guardReasons: guard.reasons,
      },
      guard,
    });
  } catch (error) {
    console.error("Error generating letter:", error);
    return NextResponse.json(
      { error: "Failed to generate letter" },
      { status: 500 }
    );
  }
}
