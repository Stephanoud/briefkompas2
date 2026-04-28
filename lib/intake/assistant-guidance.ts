import { Flow, IntakeFormData } from "@/types";
import {
  getKnownBestuursorgaan,
  getReferencedDocumentFieldValue,
  refersToUploadedDocument,
} from "@/lib/intake/document-context";

export type IntakeAssistantReason = "clarifying_question" | "stuck_answer";

export interface IntakeAssistantRequest {
  flow: Flow;
  reason: IntakeAssistantReason;
  userMessage: string;
  currentStepId?: string;
  currentStepQuestion?: string;
  intakeData: Partial<IntakeFormData>;
  missingFacts?: string[];
  routeExplanation?: string;
  documentAnalysisMessage?: string;
}

export interface IntakeAssistantResponse {
  reply: string;
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function humanizeMissingFact(value: string): string {
  switch (value) {
    case "bestuursorgaan":
      return "het bestuursorgaan";
    case "procedure_object":
      return "het soort besluit";
    case "procesfase":
      return "de procesfase";
    case "doel":
      return "wat je precies wilt bereiken";
    case "gronden":
      return "waarom het besluit volgens jou niet klopt";
    case "woo_onderwerp":
      return "welke informatie je precies zoekt";
    case "woo_periode":
      return "over welke periode je stukken wilt";
    case "woo_documenten":
      return "welke documenten je verwacht";
    default:
      return value;
  }
}

function humanizeCurrentStep(stepId: string): string {
  switch (stepId) {
    case "bestuursorgaan":
      return "het bestuursorgaan";
    case "categorie":
      return "het soort zaak";
    case "ontwerpbesluit":
      return "de inhoud van het ontwerpbesluit";
    case "doel":
      return "wat je precies wilt bereiken";
    case "gronden":
      return "waarom het besluit volgens jou niet klopt";
    case "eerdere_bezwaargronden":
      return "welke hoofdpunten eerder in bezwaar zijn aangevoerd";
    default:
      return "dit punt";
  }
}

function getCategoryLabel(value: string): string {
  switch (value) {
    case "vergunning":
      return "een vergunningzaak";
    case "uitkering":
      return "een uitkeringszaak";
    case "belasting":
      return "een belastingzaak";
    case "boete":
      return "een boetezaak";
    default:
      return "een overige bestuursrechtelijke zaak";
  }
}

function shorten(value: string, maxLength = 180): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function joinHumanList(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} en ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} en ${values[values.length - 1]}`;
}

function summarizeDocumentExtraction(data: Partial<IntakeFormData>): string[] {
  const details: string[] = [];
  const knownBestuursorgaan = getKnownBestuursorgaan(data);
  if (hasText(knownBestuursorgaan)) details.push(`het bestuursorgaan ${knownBestuursorgaan}`);
  if (hasText(data.datumBesluit)) details.push(`de datum ${data.datumBesluit}`);
  if (hasText(data.kenmerk)) details.push(`het kenmerk ${data.kenmerk}`);
  if (hasText(data.besluitDocumentType)) details.push(`het documenttype ${data.besluitDocumentType}`);
  if (hasText(data.besluitAnalyse?.onderwerp)) details.push(`het onderwerp ${data.besluitAnalyse.onderwerp}`);
  if (hasText(data.besluitAnalyse?.termijnen)) details.push(`een termijnverwijzing (${data.besluitAnalyse.termijnen})`);
  return details;
}

export function buildIntakeAssistantFallbackReply(input: IntakeAssistantRequest): string {
  const normalizedMessage = input.userMessage.toLowerCase();
  const extractedDocumentDetails = summarizeDocumentExtraction(input.intakeData);
  const currentStepDocumentValue = input.currentStepId
    ? getReferencedDocumentFieldValue(input.userMessage, input.currentStepId, input.intakeData)
    : null;
  const missingFacts = (input.missingFacts ?? []).slice(0, 2).map(humanizeMissingFact);
  const missingFactsLine =
    missingFacts.length > 0
      ? ` Ik probeer tegelijk nog ${joinHumanList(missingFacts)} scherp te krijgen voor je brief.`
      : "";

  if (
    /\b(wat|welke|kon|kun)\b.*\b(uitlezen|uitgelezen|gelezen|gevonden)\b/i.test(normalizedMessage) ||
    /\bwat kon je wel\b/i.test(normalizedMessage)
  ) {
    if (extractedDocumentDetails.length > 0) {
      return `Ik kon tot nu toe ${joinHumanList(extractedDocumentDetails)} betrouwbaar uit het bestand halen.${missingFactsLine}`;
    }

    return `Ik heb uit dit bestand nog geen datum, kenmerk of andere besluitdetails betrouwbaar kunnen overnemen. ${input.documentAnalysisMessage ?? "Dat ligt niet automatisch aan jouw zaak; dan steunt de intake tijdelijk vooral op jouw antwoorden."}${missingFactsLine}`;
  }

  if (input.currentStepId && currentStepDocumentValue) {
    if (input.currentStepId === "bestuursorgaan") {
      return `Gevonden in het geuploade document: ${currentStepDocumentValue}. Ik gebruik dit als bestuursorgaan voor je brief.${missingFactsLine}`;
    }

    if (input.currentStepId === "categorie") {
      const basis = [input.intakeData.besluitDocumentType, input.intakeData.besluitAnalyse?.onderwerp]
        .filter(hasText)
        .map((value) => shorten(value, 90))
        .join("; ");
      return basis
        ? `Ik heb het document gecheckt en zet het soort zaak op ${getCategoryLabel(currentStepDocumentValue)}. Basis: ${basis}.${missingFactsLine}`
        : `Ik heb het document gecheckt en zet het soort zaak op ${getCategoryLabel(currentStepDocumentValue)}.${missingFactsLine}`;
    }

    if (input.currentStepId === "ontwerpbesluit") {
      return `Ik heb de kern uit het geuploade document overgenomen: ${shorten(currentStepDocumentValue)}.${missingFactsLine}`;
    }

    if (input.currentStepId === "eerdere_bezwaargronden") {
      return `Ik heb eerdere bezwaargronden herkend in de bezwaarstukken of beslissing op bezwaar: ${shorten(currentStepDocumentValue)}. Ik neem dit mee in het beroepschrift.${missingFactsLine}`;
    }
  }

  if (input.currentStepId && refersToUploadedDocument(input.userMessage)) {
    return `Ik heb opnieuw in het geuploade document gekeken, maar ik kan daar ${humanizeCurrentStep(input.currentStepId)} nog niet betrouwbaar uit halen. Kun je dat kort zelf noemen?${missingFactsLine}`;
  }

  if (input.currentStepId === "bestuursorgaan" && /\bwaarom|waarvoor|welk\b/i.test(normalizedMessage)) {
    return `Ik vraag naar het bestuursorgaan zodat de brief aan de juiste instantie wordt gericht en de context van het besluit klopt.${missingFactsLine}`;
  }

  if (input.currentStepId === "categorie" && /\b(wat|welke|bedoel|categorie|soort besluit)\b/i.test(normalizedMessage)) {
    return "Met dit antwoord wil ik scherp krijgen om wat voor soort besluit het gaat, bijvoorbeeld een vergunning, uitkering, boete, belastingzaak of iets anders. Dat helpt om de brief juridisch beter te laten aansluiten.";
  }

  if (input.currentStepId === "doel" && /\b(wat|welke|bedoel|bereiken|doel)\b/i.test(normalizedMessage)) {
    return "Met je doel bedoel ik wat je uiteindelijk van het bestuursorgaan of de rechter wilt: bijvoorbeeld intrekken, herzien, aanpassen, matigen of een nieuw besluit.";
  }

  if (input.currentStepId === "gronden" && /\b(wat|welke|bedoel|grond|gronden)\b/i.test(normalizedMessage)) {
    return "Met gronden bedoel ik de inhoudelijke redenen waarom het besluit volgens jou niet klopt, onvolledig is of te zware gevolgen heeft. Denk aan feiten die niet zijn meegewogen, een onjuiste uitleg of een gebrekkige motivering.";
  }

  if (/\bdatum\b|\bkenmerk\b/i.test(normalizedMessage)) {
    return "Als je datum of kenmerk zelf al weet, mag je die zeker noemen. Maar als ik ze betrouwbaar uit het besluit haal, hoeft dat niet nog eens apart.";
  }

  if (hasText(input.routeExplanation) && /\bwaarom|route|bezwaar|beroep|zienswijze\b/i.test(normalizedMessage)) {
    return `${normalizeWhitespace(input.routeExplanation)} Controleer de rechtsmiddelenclausule altijd goed als daar twijfel over bestaat.`;
  }

  if (input.reason === "stuck_answer" && hasText(input.currentStepQuestion)) {
    return `Ik probeer je antwoord beter te plaatsen in de intake. ${missingFactsLine} Reageer gewoon in je eigen woorden; ik vertaal het daarna naar de juiste briefinformatie.`;
  }

  return `Ik help je daar graag kort bij.${missingFactsLine}`;
}
