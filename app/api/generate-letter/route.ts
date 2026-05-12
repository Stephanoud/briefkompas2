import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Flow, GeneratedLetterSupportSection, IntakeFormData, Product } from "@/types";
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
import { CaseType, GenerationGuardResult, PromptPayload, RouteType, SelectedSourceSet } from "@/lib/legal/types";
import { cleanLetterTextForDelivery } from "@/lib/letter-format";
import { isValidDeliveryEmail, normalizeDeliveryEmail } from "@/lib/delivery-email";
import { sendGeneratedLetterEmail } from "@/lib/email-delivery-server";
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

function humanizeRequiredField(field: string): string {
  switch (field) {
    case "bestuursorgaan":
      return "bestuursorgaan";
    case "categorie":
      return "soort besluit";
    case "doel":
      return "gewenste uitkomst";
    case "gronden":
      return "waarom het besluit volgens de intake niet klopt";
    case "persoonlijkeOmstandigheden":
      return "persoonlijke omstandigheden of belang";
    case "besluitSamenvatting":
      return "korte omschrijving van het besluit";
    case "eerdereBezwaargronden":
      return "eerdere bezwaargronden";
    case "wooOnderwerp":
      return "Woo-onderwerp";
    case "wooPeriode":
      return "Woo-periode";
    case "wooDocumenten":
      return "gevraagde Woo-documenten";
    default:
      return field;
  }
}

function getGenericRouteForFlow(flow: Flow, caseType: CaseType): RouteType {
  if (caseType === "niet_tijdig_beslissen") {
    return flow === "woo" ? "woo_niet_tijdig_beslissen" : "beroep_niet_tijdig_beslissen";
  }

  if (flow === "woo") return "woo_verzoek";
  if (flow === "zienswijze") return "zienswijze_bestuursrecht";
  if (flow === "beroep_zonder_bezwaar") return "beroep_rechtstreeks_bestuursrecht";
  if (flow === "beroep_na_bezwaar") return "beroep_na_bezwaar_bestuursrecht";
  return "bezwaar_bestuursrecht";
}

function getGeneralSourceSet(flow: Flow, caseType: CaseType): SelectedSourceSet | null {
  const generalCaseType: CaseType =
    caseType === "woo" || flow === "woo"
      ? "woo"
      : caseType === "niet_tijdig_beslissen"
        ? "niet_tijdig_beslissen"
        : "algemeen_bestuursrecht";

  return loadSourceSet(generalCaseType, getGenericRouteForFlow(flow, generalCaseType));
}

function buildGuardRetryPrompt(params: {
  basePrompt: string;
  violations: string[];
}): string {
  return [
    params.basePrompt,
    "",
    "HERSTELRONDE VOOR VEILIGE GENERATIE:",
    `De vorige concepttekst werd afgekeurd op deze punten: ${params.violations.join(", ")}.`,
    "Genereer de brief opnieuw als bruikbare conceptbrief.",
    "Gebruik geen ECLI's, jurisprudentieclaims, termijnen, hoorzittingen, correspondentie of rol/status van de gebruiker tenzij die letterlijk in de intake of besluitanalyse staat.",
    "Als een onderdeel onzeker is, formuleer voorzichtig vanuit de beschikbare intake: 'voor zover uit de stukken blijkt' of 'volgens de beschikbare gegevens'.",
    "Laat geen juridisch relevant punt liggen alleen omdat de dossieruitlezing beperkt is; werk met de concrete gronden, het doel en de bekende besluitinformatie.",
  ].join("\n");
}

function getDecisionStatusLabel(data: IntakeFormData): string {
  if (data.besluitAnalyseStatus === "read") {
    return "besluit gelezen";
  }
  if (data.besluitAnalyseStatus === "partial") {
    return "besluit deels gelezen";
  }
  return "besluitinformatie aangevuld";
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const NEEDS_MORE_INFO_MESSAGE =
  "Om een juridisch bruikbare brief te maken ontbreekt nog verplichte informatie. Vul dit eerst aan of upload het besluit.";

type MissingCriticalInfoField = {
  field: keyof IntakeFormData | "decisionDocument" | "procedureType";
  label: string;
  question: string;
  inputType: "text" | "textarea" | "upload";
};

interface AuthorityResponsePair {
  counterargument: string;
  rebuttal: string;
}

function firstText(...values: Array<string | null | undefined>): string | undefined {
  return values.map((value) => (hasText(value) ? normalizeWhitespace(value) : "")).find(Boolean);
}

function getDecisionSubject(data: IntakeFormData): string | undefined {
  return firstText(
    data.besluitOnderwerp,
    data.besluitAnalyse?.onderwerp,
    data.besluitDocumentType,
    data.besluitSamenvatting,
    data.categorie
  );
}

function getDecisionAction(data: IntakeFormData): string | undefined {
  return firstText(
    data.beslissingOfMaatregel,
    data.besluitAnalyse?.besluitInhoud,
    data.besluitSamenvatting,
    data.besluitAnalyse?.onderwerp
  );
}

function getDecisionMotivation(data: IntakeFormData): string | undefined {
  const considerations =
    data.besluitAnalyse?.dragendeOverwegingen?.flatMap((item) => [item.duiding, item.passage]) ?? [];

  return firstText(
    data.belangrijksteMotivering,
    ...considerations,
    data.besluitAnalyse?.rechtsgrond,
    data.besluitAnalyse?.besluitInhoud
  );
}

function getDecisionTerm(data: IntakeFormData): string | undefined {
  return firstText(
    data.relevanteTermijn,
    data.besluitAnalyse?.termijnen,
    data.besluitAnalyse?.rechtsmiddelenclausule
  );
}

function getDesiredOutcome(flow: Flow, data: IntakeFormData): string | undefined {
  if (flow === "woo") {
    return firstText(
      data.doel,
      data.wooDocumenten && data.wooOnderwerp
        ? `openbaarmaking van ${data.wooDocumenten} over ${data.wooOnderwerp}`
        : undefined
    );
  }

  return firstText(data.doel);
}

function resolveIntakeDataForGeneration(data: IntakeFormData, flow: Flow): IntakeFormData {
  if (flow === "woo") {
    return data;
  }

  const bestuursorgaan = firstText(data.bestuursorgaan, data.besluitAnalyse?.bestuursorgaan);
  const decisionSubject = getDecisionSubject(data);
  const decisionAction = getDecisionAction(data);
  const decisionMotivation = getDecisionMotivation(data);
  const decisionTerm = getDecisionTerm(data);

  return {
    ...data,
    bestuursorgaan: bestuursorgaan ?? data.bestuursorgaan,
    categorie: firstText(data.categorie, data.besluitDocumentType, decisionSubject) ?? data.categorie,
    besluitSamenvatting: firstText(data.besluitSamenvatting, decisionAction, decisionSubject),
    besluitOnderwerp: decisionSubject ?? data.besluitOnderwerp,
    beslissingOfMaatregel: decisionAction ?? data.beslissingOfMaatregel,
    belangrijksteMotivering: decisionMotivation ?? data.belangrijksteMotivering,
    relevanteTermijn: decisionTerm ?? data.relevanteTermijn,
  };
}

function requiredFieldPrompt(field: string): MissingCriticalInfoField {
  switch (field) {
    case "bestuursorgaan":
      return {
        field: "bestuursorgaan",
        label: "Bestuursorgaan",
        question: "Geef aan welk bestuursorgaan dit besluit heeft genomen.",
        inputType: "text",
      };
    case "categorie":
      return {
        field: "categorie",
        label: "Soort besluit",
        question: "Vul in om wat voor soort besluit het gaat.",
        inputType: "text",
      };
    case "doel":
      return {
        field: "doel",
        label: "Gewenste uitkomst",
        question: "Vul de gewenste uitkomst in.",
        inputType: "textarea",
      };
    case "gronden":
      return {
        field: "gronden",
        label: "Waarom het besluit niet klopt",
        question: "Vul in waarom je het niet eens bent met het besluit.",
        inputType: "textarea",
      };
    case "persoonlijkeOmstandigheden":
      return {
        field: "persoonlijkeOmstandigheden",
        label: "Geraakte belangen",
        question: "Vul in welke belangen of omstandigheden door het besluit worden geraakt.",
        inputType: "textarea",
      };
    case "besluitSamenvatting":
      return {
        field: "besluitSamenvatting",
        label: "Kern van het besluit",
        question: "Vul kort in wat het besluit of ontwerpbesluit inhoudt.",
        inputType: "textarea",
      };
    case "eerdereBezwaargronden":
      return {
        field: "eerdereBezwaargronden",
        label: "Eerdere bezwaargronden",
        question: "Vul de hoofdpunten in die eerder in bezwaar zijn aangevoerd.",
        inputType: "textarea",
      };
    case "wooOnderwerp":
      return {
        field: "wooOnderwerp",
        label: "Woo-onderwerp",
        question: "Vul het onderwerp van het Woo-verzoek in.",
        inputType: "textarea",
      };
    case "wooPeriode":
      return {
        field: "wooPeriode",
        label: "Woo-periode",
        question: "Vul de periode in waarover de documenten moeten gaan.",
        inputType: "text",
      };
    case "wooDocumenten":
      return {
        field: "wooDocumenten",
        label: "Gevraagde documenten",
        question: "Vul in welke documenten of documentsoorten moeten worden verstrekt.",
        inputType: "textarea",
      };
    default:
      return {
        field: field as keyof IntakeFormData,
        label: humanizeRequiredField(field),
        question: `Vul ${humanizeRequiredField(field)} in.`,
        inputType: "textarea",
      };
  }
}

function addMissingField(fields: MissingCriticalInfoField[], field: MissingCriticalInfoField) {
  if (!fields.some((item) => item.field === field.field)) {
    fields.push(field);
  }
}

function getMissingCriticalInfo(flow: Flow, data: IntakeFormData): MissingCriticalInfoField[] {
  const missingFields: MissingCriticalInfoField[] = [];

  if (flow !== "woo" && !data.files?.besluit) {
    addMissingField(missingFields, {
      field: "decisionDocument",
      label: "Besluit uploaden",
      question:
        flow === "zienswijze"
          ? "Upload het ontwerpbesluit waarin de motivering staat."
          : "Upload het besluit waarin de motivering staat.",
      inputType: "upload",
    });
    return missingFields;
  }

  getMissingRequiredFields(flow, data).forEach((field) => {
    addMissingField(missingFields, requiredFieldPrompt(field));
  });

  if (flow === "woo") {
    return missingFields;
  }

  if (!hasText(data.datumBesluit)) {
    addMissingField(missingFields, {
      field: "datumBesluit",
      label: "Datum besluit",
      question: "Vul de datum van het besluit in.",
      inputType: "text",
    });
  }

  if (!hasText(data.bestuursorgaan)) {
    addMissingField(missingFields, requiredFieldPrompt("bestuursorgaan"));
  }

  if (!hasText(getDecisionSubject(data))) {
    addMissingField(missingFields, {
      field: "besluitOnderwerp",
      label: "Onderwerp besluit",
      question: "Vul het onderwerp van het besluit in.",
      inputType: "textarea",
    });
  }

  if (!hasText(getDecisionAction(data))) {
    addMissingField(missingFields, {
      field: "beslissingOfMaatregel",
      label: "Beslissing of maatregel",
      question: "Vul in welke beslissing of maatregel in het besluit staat.",
      inputType: "textarea",
    });
  }

  if (!hasText(getDecisionMotivation(data))) {
    addMissingField(missingFields, {
      field: "belangrijksteMotivering",
      label: "Belangrijkste reden of motivering",
      question: "Vul de belangrijkste reden of motivering van het bestuursorgaan in.",
      inputType: "textarea",
    });
  }

  if (!hasText(getDecisionTerm(data))) {
    addMissingField(missingFields, {
      field: "relevanteTermijn",
      label: "Relevante termijn",
      question: "Vul de relevante bezwaar-, beroep- of reactietermijn in.",
      inputType: "text",
    });
  }

  if (!hasText(getDesiredOutcome(flow, data))) {
    addMissingField(missingFields, requiredFieldPrompt("doel"));
  }

  return missingFields;
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

function buildAfterLetterSupportSections(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  caseType?: CaseType;
}): GeneratedLetterSupportSection[] {
  const { flow, intakeData, caseType } = params;
  const pairs = buildAuthorityResponsePairs({ flow, intakeData, caseType }).slice(0, 3);

  return [
    {
      title: "Wat de overheid mogelijk zal aanvoeren",
      items: pairs.map((pair) => pair.counterargument),
    },
    {
      title: "Hoe u daarop kunt reageren",
      items: pairs.map((pair) => pair.rebuttal),
    },
    {
      title: "Wat gebeurt hierna?",
      items: [buildProcedureExplanation({ flow, caseType })],
    },
    {
      title: "Waar moet u op letten?",
      items: buildAttentionItems({ flow, intakeData }),
    },
    {
      title: "Als uw bezwaar/beroep wordt afgewezen",
      items: [buildRejectedNextStep({ flow, caseType })],
    },
    {
      title: "Praktische tip",
      items: buildPracticalTips({ intakeData }),
    },
  ].filter((section) => section.items.length > 0);
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
    `Onderwerp besluit: ${getDecisionSubject(data) ?? "onbekend"}`,
    `Beslissing of maatregel: ${getDecisionAction(data) ?? "onbekend"}`,
    `Belangrijkste reden of motivering: ${getDecisionMotivation(data) ?? "onbekend"}`,
    `Relevante termijn: ${getDecisionTerm(data) ?? "onbekend"}`,
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

async function buildGuardResult(params: {
  intakeData: IntakeFormData;
  flow: Flow;
  references: ReferenceItem[];
}): Promise<GenerationGuardResult> {
  const { intakeData, flow, references } = params;
  const classification = classifyCase({ flow, intakeData });
  const routing = determineRoute({ flow, caseType: classification.caseType, intakeData });
  let sourceSet = loadSourceSet(classification.caseType, routing.route);
  let sourceSetValidation = validateSourceSet(sourceSet);
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
    softSignals.push("document_case_type_conflict");
  }

  if (routing.route === "handmatige_triage" || routing.confidence < 0.6) {
    softSignals.push("route_uncertain");
  }

  if (!sourceSetValidation.ok || !sourceSet) {
    softSignals.push(...sourceSetValidation.reasons);
    if (!sourceSet) {
      softSignals.push("missing_source_set");
    }

    const generalSourceSet = getGeneralSourceSet(flow, classification.caseType);
    const generalValidation = validateSourceSet(generalSourceSet);
    if (generalSourceSet && generalValidation.ok) {
      sourceSet = generalSourceSet;
      sourceSetValidation = generalValidation;
      softSignals.push("general_source_set_used");
    } else {
      hardBlockers.push("missing_usable_source_set");
    }
  }

  if (missingFields.length > 0) {
    hardBlockers.push("missing_required_intake_fields");
  }

  const lateDecisionGate =
    classification.caseType === "niet_tijdig_beslissen"
      ? evaluateLateDecisionGate(intakeData)
      : { hardBlockers: [], softSignals: [], auditTrail: [] };

  softSignals.push(...lateDecisionGate.hardBlockers);
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
    hardBlockers.length > 0 || softSignals.length > 0 ? "dynamic_ai" : "validated";

  return {
    ok: hardBlockers.length === 0,
    fallbackMode: "none",
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
    const { intakeData: submittedIntakeData, product, flow, deliveryEmail: rawDeliveryEmail } = (await req.json()) as {
      intakeData: IntakeFormData;
      product: Product;
      flow: Flow;
      deliveryEmail?: string;
    };

    if (!submittedIntakeData || !product || !flow) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const intakeData = resolveIntakeDataForGeneration(submittedIntakeData, flow);

    const deliveryEmail =
      typeof rawDeliveryEmail === "string" ? normalizeDeliveryEmail(rawDeliveryEmail) : "";
    if (!isValidDeliveryEmail(deliveryEmail)) {
      return NextResponse.json(
        { error: "Vul een geldig e-mailadres in voor toezending van de brief." },
        { status: 400 }
      );
    }

    const missingCriticalInfo = getMissingCriticalInfo(flow, intakeData);
    if (missingCriticalInfo.length > 0) {
      return NextResponse.json(
        {
          status: "needs_more_info",
          blocking: true,
          missingFields: missingCriticalInfo,
          message: NEEDS_MORE_INFO_MESSAGE,
          error: NEEDS_MORE_INFO_MESSAGE,
        },
        { status: 422 }
      );
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY ontbreekt op de server." },
        { status: 500 }
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

    if (!guard.selectedSourceSet) {
      return NextResponse.json(
        { error: "De bronconfiguratie voor deze zaak kon niet veilig worden geladen. Probeer opnieuw of neem contact op." },
        { status: 500 }
      );
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

    if (guard.generationMode === "dynamic_ai") {
      payload.disallowedBehaviors.push(
        "Dossiergerichte voorzichtigheid actief: werk dynamisch met de beschikbare intake, besluitanalyse en juridische context, zonder ontbrekende details te raden."
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
      const retryText = await generateLetter(openai, buildGuardRetryPrompt({
        basePrompt: prompt,
        violations: violationReasons,
      }));
      const cleanedRetryText = cleanLetterTextForDelivery(retryText);
      const retryViolations = findLetterGuardViolations({
        letterText: cleanedRetryText,
        intakeData,
        validatedAuthorities: guard.validatedAuthorities,
      });

      if (!cleanedRetryText.trim() || retryViolations.length > 0) {
        return NextResponse.json(
          {
            error:
              "De brief kon niet veilig genoeg worden gegenereerd met de beschikbare gegevens. Vul de intake aan met concretere gronden, datum/termijn of besluitpassages en probeer opnieuw.",
            guard: {
              ...guard,
              ok: false,
              fallbackMode: "none",
              generationMode: "dynamic_ai" as const,
              reasons: [...guard.reasons, ...violationReasons, ...retryViolations],
              softSignals: [...guard.softSignals, ...violationReasons, ...retryViolations],
            },
          },
          { status: 422 }
        );
      }

      const supportSections = buildAfterLetterSupportSections({
        flow,
        intakeData,
        caseType: guard.caseType,
      });
      const generatedLetter = {
        letterText: cleanedRetryText,
        references: guard.validatedAuthorities,
        generationMode: "dynamic_ai" as const,
        guardReasons: [...guard.reasons, ...violationReasons],
        caseAnalysis,
        supportSections,
      };
      const emailDelivery = await sendGeneratedLetterEmail({
        to: deliveryEmail,
        flow,
        product,
        intakeData,
        generatedLetter,
      });

      return NextResponse.json({
        letter: {
          ...generatedLetter,
          emailDelivery,
        },
        guard: {
          ...guard,
          ok: false,
          fallbackMode: "none",
          generationMode: "dynamic_ai" as const,
          reasons: [...guard.reasons, ...violationReasons],
          softSignals: [...guard.softSignals, ...violationReasons],
        },
      });
    }

    const generatedLetter = {
      letterText: cleanedLetterText,
      references: guard.validatedAuthorities,
      generationMode: guard.generationMode,
      guardReasons: guard.reasons,
      caseAnalysis,
      supportSections: buildAfterLetterSupportSections({
        flow,
        intakeData,
        caseType: guard.caseType,
      }),
    };
    const emailDelivery = await sendGeneratedLetterEmail({
      to: deliveryEmail,
      flow,
      product,
      intakeData,
      generatedLetter,
    });

    return NextResponse.json({
      letter: {
        ...generatedLetter,
        emailDelivery,
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
