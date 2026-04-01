import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Flow, IntakeFormData, Product } from "@/types";
import { getReferences } from "@/src/data/references";
import { ReferenceItem } from "@/src/types/references";
import { generateLetter } from "@/lib/ai/generateLetter";
import { buildLetterPrompt } from "@/lib/ai/buildLetterPrompt";
import { findLetterGuardViolations } from "@/lib/ai/output-guards";
import { classifyCase } from "@/lib/intake/classifyCase";
import { detectBestuursorgaanScope } from "@/lib/intake/bestuursorganen";
import { getRelevantProceduralAttachments } from "@/lib/intake/procedural-attachments";
import { determineRoute } from "@/lib/intake/determineRoute";
import { getMissingRequiredFields } from "@/lib/intake/requiredFields";
import { buildCaseFileAnalysis } from "@/lib/legal/case-file-analysis";
import { evaluateLateDecisionGate } from "@/lib/legal/late-decision";
import { CaseType, GenerationGuardResult, PromptPayload } from "@/lib/legal/types";
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
  const detectedScope = detectBestuursorgaanScope(value);
  return detectedScope === "onbekend" ? undefined : detectedScope;
}

function buildReferenceKeywords(data: IntakeFormData, flow: Flow): string[] {
  const relevantProceduralAttachments = getRelevantProceduralAttachments({
    flow,
    intakeData: data,
    maxItems: 3,
  });
  const decisionSignals = [
    data.besluitDocumentType,
    data.besluitSamenvatting,
    data.besluitAnalyse?.onderwerp,
    data.besluitAnalyse?.rechtsgrond,
    data.besluitAnalyse?.besluitInhoud,
    ...(data.besluitAnalyse?.aandachtspunten ?? []),
    ...relevantProceduralAttachments.flatMap((attachment) => [attachment.fileName, attachment.excerpt ?? ""]),
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

interface AuthorityResponsePair {
  counterargument: string;
  rebuttal: string;
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

function buildAuthorityResponsePairs(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  caseType?: CaseType;
}): AuthorityResponsePair[] {
  const { flow, intakeData, caseType } = params;
  const decisionAnalysis = intakeData.besluitAnalyse;

  if (caseType === "woo" || flow === "woo") {
    return [
      {
        counterargument: "Het bestuursorgaan kan aanvoeren dat de zoekslag voldoende is geweest en dat niet meer documenten zijn aangetroffen.",
        rebuttal: "Wijs concreet aan welke afdelingen, mailboxen, bestandsnamen of dossiernummers nog buiten beeld lijken te zijn gebleven.",
      },
      {
        counterargument: "Het bestuursorgaan kan stellen dat de weigeringsgrond per document voldoende is gemotiveerd.",
        rebuttal: "Vraag per document of passage om een concretere motivering en benoem waar alleen algemene standaardtekst is gebruikt.",
      },
      {
        counterargument: "Het bestuursorgaan kan betogen dat gedeeltelijke openbaarmaking al voldoende is beoordeeld.",
        rebuttal: "Reageer per gelakte passage of documentcategorie waarom meer gerichte openbaarmaking nog wel mogelijk lijkt.",
      },
    ];
  }

  if (caseType === "bestuurlijke_boete") {
    return [
      {
        counterargument: "Het bestuursorgaan kan aanvoeren dat de overtreding op basis van de beschikbare stukken voldoende vaststaat.",
        rebuttal: "Benoem precies welk feit, welk bewijsstuk of welke koppeling met u volgens u ontbreekt of niet klopt.",
      },
      {
        counterargument: "Het bestuursorgaan kan stellen dat de boetehoogte aansluit op beleid en dat geen reden voor matiging bestaat.",
        rebuttal: "Werk concreet uit welke persoonlijke omstandigheden, draagkrachtfactoren of procedurele vertraging alsnog om matiging vragen.",
      },
      {
        counterargument: "Het bestuursorgaan kan stellen dat u persoonlijk verwijtbaar heeft gehandeld.",
        rebuttal: "Reageer met feiten die verwijtbaarheid nuanceren, zoals onduidelijke instructies, beperkte rol of afwezigheid van opzet.",
      },
    ];
  }

  if (caseType === "wmo_pgb") {
    return [
      {
        counterargument: "De gemeente kan aanvoeren dat voldoende onderzoek is gedaan en dat zorg in natura passend is.",
        rebuttal: "Leg concreet uit waarom zorg in natura in uw situatie niet werkbaar of niet passend is.",
      },
      {
        counterargument: "De gemeente kan stellen dat het pgb of tarief aansluit op beleid.",
        rebuttal: "Laat zien waarom het budget feitelijk ontoereikend is met offertes, ureninschattingen of praktische uitvoerbaarheid.",
      },
      {
        counterargument: "De gemeente kan betogen dat hulp uit het sociale netwerk beschikbaar is.",
        rebuttal: "Maak concreet welke grenzen er zijn aan belasting, beschikbaarheid of kwaliteit van hulp uit het sociale netwerk.",
      },
    ];
  }

  if (caseType === "handhaving") {
    return [
      {
        counterargument: "Het bestuursorgaan kan stellen dat een overtreding is vastgesteld en handhaving daarom in de rede ligt.",
        rebuttal: "Reageer met de concrete feiten waarom geen overtreding bestaat of waarom de norm onjuist is toegepast.",
      },
      {
        counterargument: "Het bestuursorgaan kan aanvoeren dat geen concreet zicht op legalisatie bestaat.",
        rebuttal: "Benoem een lopende aanvraag, aanpassingsmogelijkheid of ander concreet aanknopingspunt voor legalisatie.",
      },
      {
        counterargument: "Het bestuursorgaan kan stellen dat de last en termijn voldoende duidelijk en redelijk zijn.",
        rebuttal: "Werk uit wat onduidelijk is aan de last of waarom de termijn praktisch niet haalbaar is.",
      },
    ];
  }

  if (caseType === "belastingaanslag") {
    return [
      {
        counterargument: "De inspecteur kan aanvoeren dat de correctie feitelijk en cijfermatig voldoende is onderbouwd.",
        rebuttal: "Wijs per gecorrigeerde post aan welke administratie of berekening volgens u niet klopt of onvolledig is gelezen.",
      },
      {
        counterargument: "De inspecteur kan stellen dat stukken ontbreken of dat u de bewijslast niet heeft gehaald.",
        rebuttal: "Maak concreet welke stukken wel beschikbaar zijn of waarom de gestelde bewijslast in uw geval te ver gaat.",
      },
      {
        counterargument: "Bij een boete kan de inspecteur aanvoeren dat sprake is van opzet of grove schuld.",
        rebuttal: "Leg uit waarom eerder sprake is van een verdedigbaar standpunt, misverstand of verschoonbare fout.",
      },
    ];
  }

  if (caseType === "toeslag") {
    return [
      {
        counterargument: "Toeslagen kan aanvoeren dat de feitenbasis over partner, inkomen, opvang of vermogen juist is vastgesteld.",
        rebuttal: "Reageer met de concrete gegevens die volgens u onjuist zijn en welke stukken dat ondersteunen.",
      },
      {
        counterargument: "Toeslagen kan stellen dat de berekening volgt uit de wet en beschikbare gegevens.",
        rebuttal: "Vraag om de ontbrekende tussenstappen en wijs aan waar de berekening voor u niet navolgbaar is.",
      },
      {
        counterargument: "Toeslagen kan betogen dat bijzondere omstandigheden al voldoende zijn meegewogen.",
        rebuttal: "Leg uit welke omstandigheden nog niet individueel zijn besproken en waarom die juist in uw situatie relevant zijn.",
      },
    ];
  }

  if (caseType === "niet_tijdig_beslissen") {
    return [
      {
        counterargument: "Het bestuursorgaan kan aanvoeren dat de beslistermijn nog niet is verstreken of rechtsgeldig is opgeschort.",
        rebuttal: "Houd een overzicht bij van aanvraagdatum, verdaging of opschorting en leg uit waarom die termijn volgens u toch is verlopen.",
      },
      {
        counterargument: "Het bestuursorgaan kan stellen dat de ingebrekestelling te vroeg was of niet aantoonbaar is ontvangen.",
        rebuttal: "Zorg dat u verzend- en ontvangstbewijs overzichtelijk paraat heeft en wijs op de volgorde van de relevante data.",
      },
    ];
  }

  if (caseType === "niet_ontvankelijkheid") {
    return [
      {
        counterargument: "Het bestuursorgaan kan aanvoeren dat het bezwaar of beroep te laat is ingediend.",
        rebuttal: "Maak de termijnstart en ontvangstdatum concreet en leg uit waarom de overschrijding volgens u verschoonbaar of niet aanwezig is.",
      },
      {
        counterargument: "Het bestuursorgaan kan stellen dat geen besluit voorligt of dat u geen belanghebbende bent.",
        rebuttal: "Werk kort uit welk rechtsgevolg het stuk heeft en waarom het u rechtstreeks raakt.",
      },
      {
        counterargument: "Het bestuursorgaan kan aanvoeren dat een verzuim niet tijdig is hersteld.",
        rebuttal: "Wijs op de herstelmogelijkheid die wel of niet is geboden en wat u binnen die termijn heeft gedaan.",
      },
    ];
  }

  if (flow === "zienswijze") {
    return [
      {
        counterargument: "Het bestuursorgaan kan aanvoeren dat het ontwerpbesluit voldoende is onderbouwd op basis van de nu bekende feiten.",
        rebuttal: "Wijs op de onderdelen waar feiten nog ontbreken of een andere uitleg van de situatie mogelijk is.",
      },
      {
        counterargument: "Het bestuursorgaan kan stellen dat beleid of regelgeving weinig ruimte laat voor afwijking.",
        rebuttal: "Maak concreet waarom uw situatie afwijkt of waarom een individuele afweging toch nodig blijft.",
      },
    ];
  }

  const firstConsideration = decisionAnalysis?.dragendeOverwegingen?.[0];
  const secondConsideration = decisionAnalysis?.dragendeOverwegingen?.[1];
  const policySignal = decisionAnalysis?.beleidsReferenties?.length || /beleid/i.test(intakeData.gronden ?? "");

  const pairs: AuthorityResponsePair[] = [];

  if (firstConsideration?.duiding) {
    pairs.push({
      counterargument: `Het bestuursorgaan kan aanvoeren dat het besluit zorgvuldig tot stand is gekomen en dat ${firstConsideration.duiding.toLowerCase()} het besluit draagt.`,
      rebuttal: "Reageer op die kernreden met één concreet feit, document of omstandigheid die volgens u nog niet goed is onderzocht of gewogen.",
    });
  }

  if (policySignal) {
    pairs.push({
      counterargument: "Het bestuursorgaan kan stellen dat het geldende beleid in uw geval geen ruimte laat voor een andere uitkomst.",
      rebuttal: "Maak concreet waarom uw situatie afwijkt van het standaardgeval of waarom een individuele belangenafweging toch nodig is.",
    });
  }

  if (secondConsideration?.duiding) {
    pairs.push({
      counterargument: `Het bestuursorgaan kan betogen dat ook ${secondConsideration.duiding.toLowerCase()} al voldoende is gemotiveerd.`,
      rebuttal: "Wijs precies aan welke passage volgens u te algemeen blijft en welke stap in de redenering nog ontbreekt.",
    });
  }

  if (pairs.length < 2) {
    pairs.push({
      counterargument: "Het bestuursorgaan kan aanvoeren dat de relevante feiten al voldoende in beeld zijn gebracht.",
      rebuttal: "Benoem concreet welk stuk, gevolg of feit volgens u nog ontbreekt of onjuist is gelezen.",
    });
  }

  if (pairs.length < 3) {
    pairs.push({
      counterargument: "Het bestuursorgaan kan stellen dat de uitkomst binnen uw eigen verantwoordelijkheid of risicosfeer valt.",
      rebuttal: "Leg uit waarom het besluit toch een individuele afweging vergt en waarom uw situatie niet met een algemene verwijzing kan worden afgedaan.",
    });
  }

  return pairs.slice(0, 3);
}

function buildProcedureExplanation(params: {
  flow: Flow;
  caseType?: CaseType;
}): string {
  const { flow, caseType } = params;

  if (caseType === "niet_tijdig_beslissen") {
    return "In het algemeen geldt dat na indiening eerst wordt beoordeeld of de termijn echt is verstreken en of de eerdere ingebrekestelling en ontvangst voldoende vaststaan.";
  }

  if (flow === "zienswijze") {
    return "In het algemeen geldt dat het bestuursorgaan uw zienswijze meeneemt bij het definitieve besluit en pas daarna duidelijk wordt welke vervolgstap openstaat.";
  }

  if (flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar") {
    return "In het algemeen geldt dat de rechtbank eerst beoordeelt of uw beroepschrift ontvankelijk is en daarna het dossier en de reactie van het bestuursorgaan betrekt.";
  }

  if (flow === "woo") {
    return "In het algemeen geldt dat het bestuursorgaan uw verzoek of bezwaar in behandeling neemt, een schriftelijke reactie geeft en daarbij het dossier en de motivering verder moet concretiseren.";
  }

  return "In het algemeen geldt dat het bestuursorgaan eerst de ontvangst bevestigt, het dossier beoordeelt en daarna schriftelijk op uw bezwaar reageert.";
}

function buildAttentionItems(params: {
  flow: Flow;
  intakeData: IntakeFormData;
}): string[] {
  const { flow, intakeData } = params;
  const items = [
    hasText(intakeData.besluitAnalyse?.rechtsmiddelenclausule)
      ? `Controleer of de verdere termijnen aansluiten op de rechtsmiddelenclausule in het besluit: ${intakeData.besluitAnalyse?.rechtsmiddelenclausule}.`
      : "Controleer steeds de termijn en de datum van bekendmaking in het besluit of de rechtsmiddelenclausule.",
    flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar"
      ? "Let op de schriftelijke reactie van de rechtbank en van het bestuursorgaan, en houd de gevraagde stukken compleet bij de hand."
      : "Let op de schriftelijke reactie van het bestuursorgaan en op de vraag of om aanvullende stukken of een toelichting wordt gevraagd.",
    flow === "zienswijze"
      ? "Houd er rekening mee dat u mogelijk nog een definitief besluit ontvangt voordat een volgende processtap openstaat."
      : "In het algemeen kunt u worden uitgenodigd om uw standpunt mondeling toe te lichten; bereid dan kort uw kernpunten en stukken voor.",
  ];

  return items.filter(Boolean);
}

function buildRejectedNextStep(params: {
  flow: Flow;
  caseType?: CaseType;
}): string {
  const { flow, caseType } = params;

  if (flow === "zienswijze") {
    return "U kunt overwegen het definitieve besluit af te wachten en daarna te beoordelen of bezwaar of beroep openstaat.";
  }

  if (flow === "bezwaar" || flow === "woo") {
    if (caseType === "niet_tijdig_beslissen") {
      return "U kunt overwegen om de vervolgstap bij de rechtbank te zetten als nog steeds niet is beslist en de procesdrempels zijn gehaald.";
    }

    return "U kunt overwegen om beroep bij de rechtbank in te stellen als de reactie op uw bezwaar of Woo-besluit ongunstig blijft.";
  }

  return "U kunt overwegen om te bekijken of hoger beroep of een andere vervolgstap openstaat binnen deze procedure.";
}

function buildPracticalTips(params: {
  intakeData: IntakeFormData;
}): string[] {
  const tips = [
    "Bewaar de verzendbevestiging, het besluit en alle bijlagen in één overzichtelijke map.",
    "Maak een korte tijdlijn met de belangrijkste data, zodat u snel kunt reageren als om een toelichting of extra stukken wordt gevraagd.",
  ];

  if (hasText(params.intakeData.kenmerk)) {
    tips[1] = `Noteer het kenmerk ${params.intakeData.kenmerk} zichtbaar bij uw stukken, zodat latere reacties makkelijk zijn terug te koppelen.`;
  }

  return tips.slice(0, 2);
}

function buildAfterLetterSupportSection(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  caseType?: CaseType;
}): string {
  const { flow, intakeData, caseType } = params;
  const pairs = buildAuthorityResponsePairs({ flow, intakeData, caseType }).slice(0, 3);
  const procedureItems = buildAttentionItems({ flow, intakeData });
  const practicalTips = buildPracticalTips({ intakeData });

  return [
    "",
    "Wat de overheid mogelijk zal aanvoeren:",
    ...pairs.map((pair) => `- ${pair.counterargument}`),
    "",
    "Hoe u daarop kunt reageren:",
    ...pairs.map((pair) => `- ${pair.rebuttal}`),
    "",
    "Wat gebeurt hierna?",
    `- ${buildProcedureExplanation({ flow, caseType })}`,
    "",
    "Waar moet u op letten?",
    ...procedureItems.map((item) => `- ${item}`),
    "",
    "Als uw bezwaar/beroep wordt afgewezen:",
    `- ${buildRejectedNextStep({ flow, caseType })}`,
    "",
    "Praktische tip:",
    ...practicalTips.map((tip) => `- ${tip}`),
  ].join("\n");
}

function appendAfterLetterSupport(params: {
  letterText: string;
  flow: Flow;
  intakeData: IntakeFormData;
  caseType?: CaseType;
  appendixText?: string;
}): string {
  const { letterText, flow, intakeData, caseType, appendixText } = params;

  return [
    letterText,
    buildAfterLetterSupportSection({
      flow,
      intakeData,
      caseType,
    }),
    appendixText ? `\n${appendixText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
  const relevantProceduralAttachments = getRelevantProceduralAttachments({
    flow,
    intakeData: data,
    maxItems: 3,
  });

  if (data.files?.besluit?.name) {
    caseFacts.push(`Besluitbestand: ${data.files.besluit.name}`);
  }

  if ((data.files?.bijlagen ?? []).length > 0) {
    caseFacts.push(`Extra bijlagen: ${(data.files?.bijlagen ?? []).map((file) => file.name).join("; ")}`);
  }

  if (relevantProceduralAttachments.length > 0) {
    caseFacts.push(
      `Relevante onderliggende processtukken: ${relevantProceduralAttachments
        .map((attachment) => `${attachment.fileName} (${attachment.attachmentKind})`)
        .join("; ")}`
    );
    relevantProceduralAttachments.forEach((attachment, index) => {
      caseFacts.push(
        `Onderliggend processtuk ${index + 1}: ${attachment.fileName}. Type: ${attachment.attachmentKind}. Relevantie: ${attachment.relevance}${
          attachment.excerpt ? ` Kernfragment: ${attachment.excerpt}` : ""
        }`
      );
    });
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

function usesLateDecisionModule(intakeData: IntakeFormData, caseType?: CaseType): boolean {
  return (
    caseType === "niet_tijdig_beslissen" ||
    Boolean(intakeData.nietTijdigBeslissen) ||
    intakeData.procedureAdvies === "niet_tijdig_beslissen"
  );
}

function buildLateDecisionFallbackLetter(params: {
  intakeData: IntakeFormData;
  guardReasons: string[];
  caseType?: CaseType;
}): string {
  const { intakeData, guardReasons, caseType } = params;
  const isWoo = intakeData.flow === "woo";
  const procedureLabel = isWoo
    ? "Woo-verzoek"
    : intakeData.heeftBezwaarGemaakt || intakeData.eerdereBezwaargronden
      ? "bezwaar"
      : "aanvraag";

  if (guardReasons.includes("late_decision_already_decided")) {
    return [
      "Op basis van de huidige dossierinformatie kan nog geen veilig concept wegens niet tijdig beslissen worden opgesteld.",
      "",
      "Er zijn aanwijzingen dat het bestuursorgaan inmiddels al een inhoudelijk besluit heeft genomen.",
      "Upload dat latere besluit, zodat de zaak kan worden omgezet naar een inhoudelijk bezwaar of beroep.",
    ].join("\n");
  }

  const needsIngebrekestellingDraft = guardReasons.some((reason) =>
    [
      "late_decision_missing_ingebrekestelling",
      "late_decision_receipt_unverified",
      "late_decision_two_week_wait_unverified",
      "late_decision_deadline_unverified",
    ].includes(reason)
  );

  if (needsIngebrekestellingDraft) {
    return appendAfterLetterSupport({
      letterText: [
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
      "Betreft: Ingebrekestelling wegens niet tijdig beslissen",
      "Datum: [vandaag invullen]",
      "",
      "Geacht bestuursorgaan,",
      "",
      `Hierbij stel ik u in gebreke wegens het uitblijven van een besluit op mijn ${procedureLabel}.`,
      "",
      `Volgens mijn gegevens dateert het onderliggende ${procedureLabel} van ${intakeData.datumBesluit ?? "[datum invullen]"}.`,
      "Voor zover de geldende beslistermijn is verstreken, verzoek ik u alsnog zo spoedig mogelijk een besluit te nemen en de ontvangst van deze ingebrekestelling te bevestigen.",
      "",
      "Ik voeg waar mogelijk bewijs van verzending en ontvangst van deze ingebrekestelling toe.",
      "",
      "Hoogachtend,",
      "",
      "[Jouw naam]",
    ].join("\n"),
      flow: intakeData.flow,
      intakeData,
      caseType,
    });
  }

  return appendAfterLetterSupport({
    letterText: [
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
    "Betreft: Beroep wegens niet tijdig beslissen",
    "Datum: [vandaag invullen]",
    "",
    "Geachte rechtbank,",
    "",
    `Hierbij stel ik beroep in wegens het niet tijdig beslissen door ${sanitize(intakeData.bestuursorgaan)} op mijn ${procedureLabel}.`,
    "",
    `Volgens mijn gegevens is het onderliggende ${procedureLabel} ingediend op ${intakeData.datumBesluit ?? "[datum invullen]"}.`,
    "Ook is een ingebrekestelling verzonden en ontvangen, maar een inhoudelijk besluit is uitgebleven.",
    "",
    "Ik verzoek de rechtbank vast te stellen dat niet tijdig is beslist en het bestuursorgaan op te dragen alsnog een besluit te nemen binnen een door de rechtbank te bepalen termijn.",
    "",
    "Hoogachtend,",
    "",
    "[Jouw naam]",
  ].join("\n"),
    flow: intakeData.flow,
    intakeData,
    caseType,
  });
}

export function buildSafeFallbackLetter(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  caseType?: CaseType;
  guardReasons?: string[];
}): string {
  const { flow, intakeData, caseType, guardReasons = [] } = params;
  const relevantProceduralAttachments = getRelevantProceduralAttachments({
    flow,
    intakeData,
    maxItems: 2,
  });

  if (usesLateDecisionModule(intakeData, caseType)) {
    return buildLateDecisionFallbackLetter({
      intakeData,
      guardReasons,
      caseType,
    });
  }

  if (flow === "woo") {
    return appendAfterLetterSupport({
      letterText: [
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
    ].join("\n"),
      flow,
      intakeData,
      caseType,
    });
  }

  if (flow === "zienswijze") {
    return appendAfterLetterSupport({
      letterText: [
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
    ].join("\n"),
      flow,
      intakeData,
      caseType,
    });
  }

  if (flow === "beroep_zonder_bezwaar") {
    return appendAfterLetterSupport({
      letterText: [
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
      ...(relevantProceduralAttachments.length > 0
        ? [
            "",
            `Ik verwijs daarnaast naar eerder ingediende stukken uit de voorprocedure, waaronder ${relevantProceduralAttachments
              .map((attachment) => attachment.fileName)
              .join(", ")}.`,
          ]
        : []),
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
    ].join("\n"),
      flow,
      intakeData,
      caseType,
    });
  }

  if (flow === "beroep_na_bezwaar") {
    return appendAfterLetterSupport({
      letterText: [
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
      ...(relevantProceduralAttachments.length > 0
        ? [
            `Ter onderbouwing verwijs ik ook naar eerder overgelegde stukken, waaronder ${relevantProceduralAttachments
              .map((attachment) => attachment.fileName)
              .join(", ")}.`,
          ]
        : []),
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
    ].join("\n"),
      flow,
      intakeData,
      caseType,
    });
  }

  const subject = intakeData.besluitDocumentType
    ? `Bezwaarschrift tegen ${intakeData.besluitDocumentType}`
    : "Bezwaarschrift";

  return appendAfterLetterSupport({
    letterText: [
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
    "Hoogachtend,",
    "",
    "[Jouw naam]",
  ].join("\n"),
    flow,
    intakeData,
    caseType,
    appendixText: buildBezwaarAppendix(intakeData),
  });
}

async function buildGuardResult(params: {
  intakeData: IntakeFormData;
  flow: Flow;
  references: ReferenceItem[];
}): Promise<GenerationGuardResult> {
  const { intakeData, flow, references } = params;
  const classification = classifyCase({ flow, intakeData });
  const routing = determineRoute({ flow, caseType: classification.caseType, intakeData });
  const sourceSet = loadSourceSet(classification.caseType, routing.route);
  const sourceSetValidation = validateSourceSet(sourceSet);
  const baseMissingFields = getMissingRequiredFields(flow, intakeData);
  const missingFields =
    classification.caseType === "niet_tijdig_beslissen"
      ? baseMissingFields.filter((field) => field === "bestuursorgaan")
      : baseMissingFields;

  const authorityValidation = sourceSet
    ? await validateAuthorities({ references, sourceSet, intakeData })
    : {
        selectedAuthorities: [],
        allowedAuthorities: [],
        rejectedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: ["No source set available for authority validation."],
      };

  const softSignals: string[] = [];
  const hardBlockers: string[] = [];

  if (classification.caseType === "onzeker_handmatige_triage" || classification.confidence < 0.7) {
    softSignals.push("case_type_uncertain");
  }

  if (classification.reasons.some((reason) => reason.toLowerCase().includes("documentsignalen wijzen op"))) {
    hardBlockers.push("document_case_type_conflict");
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

  const lateDecisionGate =
    classification.caseType === "niet_tijdig_beslissen"
      ? evaluateLateDecisionGate(intakeData)
      : { hardBlockers: [], softSignals: [], auditTrail: [] };

  hardBlockers.push(...lateDecisionGate.hardBlockers);
  softSignals.push(...lateDecisionGate.softSignals);

  const auditTrail = [
    `Classified caseType=${classification.caseType} confidence=${classification.confidence.toFixed(2)}`,
    `Determined route=${routing.route} confidence=${routing.confidence.toFixed(2)}`,
    sourceSet ? `Loaded source set: ${sourceSet.caseType}/${sourceSet.route}` : "No source set loaded",
    `Authority selection: verified=${authorityValidation.allowedAuthorities.length} selected_for_letter=${authorityValidation.selectedAuthorities.length}`,
    ...lateDecisionGate.auditTrail,
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
    validatedAuthorities: authorityValidation.selectedAuthorities,
    reviewedAuthorities: authorityValidation.reviewedAuthorities,
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

    const guard = await buildGuardResult({ intakeData, flow, references });
    const caseAnalysis = buildCaseFileAnalysis({
      flow,
      intakeData,
      guard,
      reviewedAuthorities: guard.reviewedAuthorities,
    });

    if (guard.generationMode === "static_fallback" || !guard.selectedSourceSet) {
      const fallbackLetter = cleanLetterTextForDelivery(buildSafeFallbackLetter({
        flow,
        intakeData,
        caseType: guard.caseType,
        guardReasons: guard.reasons,
      }));

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: guard.validatedAuthorities,
          generationMode: "static_fallback" as const,
          guardReasons: guard.reasons,
          caseAnalysis,
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
      caseAnalysis,
      decisionAnalysisStatus: intakeData.besluitAnalyseStatus ?? "failed",
      decisionReadability: intakeData.besluitLeeskwaliteit ?? null,
      selectedSources: guard.selectedSourceSet.primarySources,
      validatedAuthorities: guard.validatedAuthorities,
      disallowedBehaviors: [
        "Geen nieuwe bronnen buiten selectedSources/validatedAuthorities.",
        "Geen ECLI's zonder validatie.",
        "Geen wetsartikelen of sectorspecifieke rechtsgronden op basis van aannames.",
        "Geen stellige juridische conclusie zonder feitelijke basis in intake of besluitanalyse.",
        "Geen citaten uit het besluit zonder expliciete bronpassage in de dossierinput.",
        "Geen termijnen, hoorzittingen, correspondentie of procescontacten zonder expliciete basis in dossierinput.",
        "Geen rol of status van de gebruiker aannemen zonder basis in het dossier.",
        "Geen beroep op vaste jurisprudentie zonder geverifieerde uitspraken.",
        "Gebruik jurisprudentie alleen als kwaliteitsversterker met echte meerwaarde voor deze zaak.",
        "Gebruik in gewone burgerbrieven meestal maximaal 1 tot 2 uitspraken en zet die compact in per concrete grond.",
        "Geen module-aannames als documentsignalen of caseAnalysis op iets anders wijzen.",
        "Geen generieke zorgvuldigheidsgrond zonder concreet onderzoeksgebrek.",
        "Geen generieke motiveringsgrond zonder aanwijsbare besluitpassage of motiveringsstap.",
        "Geen generieke 3:4 Awb-grond zonder concreet nadeel en belangenafweging.",
        "Geen generieke heroverwegingsgrond zonder te benoemen wat niet is heroverwogen.",
        ...(caseAnalysis.workflowProfile?.hallucination_guards ?? []),
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
    const outputViolations = findLetterGuardViolations({
      letterText: cleanedLetterText,
      intakeData,
      validatedAuthorities: guard.validatedAuthorities,
    });

    if (!cleanedLetterText.trim() || outputViolations.length > 0) {
      const violationReasons =
        outputViolations.length > 0 ? outputViolations : ["empty_generation_output"];
      const fallbackLetter = cleanLetterTextForDelivery(buildSafeFallbackLetter({
        flow,
        intakeData,
        caseType: guard.caseType,
        guardReasons: [...guard.reasons, ...violationReasons],
      }));

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: guard.validatedAuthorities,
          generationMode: "static_fallback" as const,
          guardReasons: [...guard.reasons, ...violationReasons],
          caseAnalysis,
        },
        guard: {
          ...guard,
          ok: false,
          fallbackMode: "safe_generic",
          generationMode: "static_fallback" as const,
          reasons: [...guard.reasons, ...violationReasons],
          hardBlockers: [...guard.hardBlockers, ...violationReasons],
        },
      });
    }

    return NextResponse.json({
      letter: {
        letterText: cleanedLetterText,
        references: guard.validatedAuthorities,
        generationMode: guard.generationMode,
        guardReasons: guard.reasons,
        caseAnalysis,
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
