import { ChatStep, IntakeFormData, Flow } from "@/types";

const questionPrefixPattern = /^(wat|hoe|waarom|welke|wanneer|wie|kan|kun|mag|moet)\b/i;
const yearPattern = /\b(19|20)\d{2}\b/;
const datePattern = /\b\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?\b/;
const monthPattern =
  /\b(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\b/i;
const rangeWordPattern = /\b(van|tot|tussen|sinds|vanaf|voor|na|afgelopen|laatste)\b/i;
const periodUnitPattern = /\b(jaar|jaren|maand|maanden|week|weken|dag|dagen|kwartaal|kwartalen)\b/i;
const spelledNumberPattern =
  /\b(een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf)\b/i;
const commonDoelAnswers = new Set([
  "intrekken",
  "herzien",
  "aanpassen",
  "verminderen",
  "matigen",
  "kwijtschelden",
  "uitstel",
  "opschorten",
  "corrigeren",
  "vernietigen",
]);
const bezwaarCategoriePatterns: Array<{ categorie: string; pattern: RegExp }> = [
  { categorie: "boete", pattern: /\b(boete|verkeersboete|mulder|cjib)\b/i },
  { categorie: "uitkering", pattern: /\b(uitkering|uwv|ww\b|wia|wajong|wao|ziektewet)\b/i },
  { categorie: "belasting", pattern: /\b(belasting|aanslag|fiscaal|naheffing|woz)\b/i },
  {
    categorie: "vergunning",
    pattern: /\b(vergunning|vergunnings|omgevingsvergunning|bouwvergunning|exploitatievergunning)\b/i,
  },
  { categorie: "overig", pattern: /\b(overig|overige|anders|andere)\b/i },
];

function normalizeInput(value: string): string {
  return value.trim();
}

export interface WooSubjectInterpretation {
  status: "valid" | "needs_clarification" | "clarifying" | "invalid";
  normalizedValue?: string;
  clarificationPrompt?: string;
  clarificationOptions?: string[];
}

export interface WooPeriodInterpretation {
  status: "valid" | "ambiguous" | "clarifying" | "invalid";
  normalizedValue?: string;
  confirmationPrompt?: string;
  clarificationPrompt?: string;
}

export const WOO_SUBJECT_CLARIFICATION_OPTIONS = [
  "besluiten en onderbouwing",
  "interne e-mails en afstemming",
  "beleidskeuzes en notities",
  "uitvoering en financiele informatie",
] as const;

const wooSubjectStopWords = new Set([
  "de",
  "het",
  "een",
  "en",
  "of",
  "van",
  "voor",
  "over",
  "onder",
  "rond",
  "rondom",
  "bij",
  "op",
  "in",
  "naar",
  "te",
  "dat",
  "dit",
  "deze",
  "die",
  "wil",
  "wilt",
  "ik",
  "we",
  "mij",
  "mijn",
  "ons",
  "onze",
  "stukken",
  "documenten",
  "informatie",
  "gegevens",
  "dingen",
  "alles",
]);

const wooSubjectBroadKeywords = new Set([
  "subsidie",
  "subsidies",
  "vergunning",
  "vergunningen",
  "project",
  "projecten",
  "beleid",
  "communicatie",
  "correspondentie",
  "emails",
  "email",
  "mails",
  "stukken",
  "documenten",
  "informatie",
  "rapporten",
  "memo",
  "memos",
  "notities",
  "klachten",
  "handhaving",
  "uitvoering",
  "financien",
  "financiele",
  "besluiten",
  "besluitvorming",
]);

function getWooSubjectTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[.,;:!?()[\]"']/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !wooSubjectStopWords.has(token));
}

function combineWooSubject(baseTopic: string, focus: string): string {
  const trimmedBaseTopic = normalizeInput(baseTopic);
  const trimmedFocus = normalizeInput(focus);

  if (!trimmedBaseTopic) {
    return trimmedFocus;
  }

  const normalizedBaseTopic = trimmedBaseTopic.toLowerCase();
  const normalizedFocus = trimmedFocus.toLowerCase();
  if (normalizedFocus.includes(normalizedBaseTopic)) {
    return trimmedFocus;
  }

  return `${trimmedBaseTopic}, met nadruk op ${trimmedFocus}`;
}

function buildWooSubjectClarificationPrompt(topic: string): string {
  return `Ik wil eerst scherper krijgen wat je precies zoekt over ${topic}. Gaat het je vooral om besluiten en onderbouwing, interne e-mails en afstemming, beleidskeuzes en notities, of uitvoering en financiele informatie?`;
}

export function isLikelyClarifyingQuestion(value: string): boolean {
  const trimmed = normalizeInput(value);
  if (!trimmed) return false;
  if (trimmed.includes("?")) return true;

  const lower = trimmed.toLowerCase();
  const isShortInput = lower.split(/\s+/).length <= 10;
  return isShortInput && questionPrefixPattern.test(lower);
}

export function interpretWooSubjectAnswer(value: string, baseTopic?: string): WooSubjectInterpretation {
  const trimmed = normalizeInput(value);
  if (trimmed.length < 3) {
    return { status: "invalid" };
  }

  if (isLikelyClarifyingQuestion(trimmed)) {
    return { status: "clarifying" };
  }

  const normalized = trimmed.toLowerCase();
  const matchedClarificationOption = WOO_SUBJECT_CLARIFICATION_OPTIONS.find(
    (option) => normalized === option || normalized.includes(option)
  );

  if (baseTopic && matchedClarificationOption) {
    return {
      status: "valid",
      normalizedValue: combineWooSubject(baseTopic, matchedClarificationOption),
    };
  }

  const tokens = getWooSubjectTokens(trimmed);
  const broadTokenCount = tokens.filter((token) => wooSubjectBroadKeywords.has(token)).length;
  const hasNonBroadToken = tokens.some((token) => !wooSubjectBroadKeywords.has(token));
  const isVeryBroad =
    tokens.length === 0 ||
    (tokens.length <= 2 && broadTokenCount >= 1 && !hasNonBroadToken) ||
    (tokens.length <= 3 && broadTokenCount === tokens.length);

  if (baseTopic) {
    if (isVeryBroad) {
      return {
        status: "needs_clarification",
        clarificationPrompt: buildWooSubjectClarificationPrompt(baseTopic),
        clarificationOptions: [...WOO_SUBJECT_CLARIFICATION_OPTIONS],
      };
    }

    return {
      status: "valid",
      normalizedValue: combineWooSubject(baseTopic, trimmed),
    };
  }

  if (isVeryBroad) {
    return {
      status: "needs_clarification",
      clarificationPrompt: buildWooSubjectClarificationPrompt(trimmed),
      clarificationOptions: [...WOO_SUBJECT_CLARIFICATION_OPTIONS],
    };
  }

  return {
    status: "valid",
    normalizedValue: trimmed,
  };
}

export function interpretWooPeriodAnswer(value: string): WooPeriodInterpretation {
  const trimmed = normalizeInput(value);
  if (trimmed.length < 2) return { status: "invalid" };
  if (isLikelyClarifyingQuestion(trimmed)) return { status: "clarifying" };

  const normalized = trimmed.toLowerCase();

  if (/^\s*recent\s*$/i.test(trimmed)) {
    return {
      status: "ambiguous",
      clarificationPrompt:
        "Helder. Met 'recent' bedoel je waarschijnlijk een beperkte recente periode. Kun je dat concretiseren, bijvoorbeeld de laatste 6 maanden, 1 jaar of 2 jaar?",
    };
  }

  if (/\b(?:ongeveer\s+)?sinds\s+corona\b/i.test(normalized)) {
    return {
      status: "valid",
      normalizedValue: "ongeveer sinds 2020 tot heden",
      confirmationPrompt: "Helder, dan ga ik uit van ongeveer 2020 tot heden. Klopt dat?",
    };
  }

  if (/\b(?:ongeveer\s+)?vanaf\s+corona\b/i.test(normalized)) {
    return {
      status: "valid",
      normalizedValue: "ongeveer vanaf 2020 tot heden",
      confirmationPrompt: "Helder, dan ga ik uit van ongeveer 2020 tot heden. Klopt dat?",
    };
  }

  const hasDateReference =
    yearPattern.test(trimmed) || datePattern.test(trimmed) || monthPattern.test(trimmed);
  const hasRangeWord = rangeWordPattern.test(trimmed);
  const hasPeriodUnit = periodUnitPattern.test(trimmed);
  const hasNumber = /\d/.test(trimmed) || spelledNumberPattern.test(trimmed);

  const isRelativePeriod = hasRangeWord && hasPeriodUnit && hasNumber;
  const isCalendarRange = hasDateReference && (hasRangeWord || hasNumber || hasPeriodUnit);

  if (isRelativePeriod || isCalendarRange) {
    return {
      status: "valid",
      normalizedValue: trimmed,
    };
  }

  return { status: "invalid" };
}

function isWooPeriodAnswer(value: string): boolean {
  return interpretWooPeriodAnswer(value).status === "valid";
}

function isBezwaarDoelAnswer(value: string): boolean {
  const trimmed = normalizeInput(value).toLowerCase();
  if (trimmed.length < 3) return false;
  if (commonDoelAnswers.has(trimmed)) return true;
  return trimmed.length >= 8;
}

export function normalizeBezwaarCategorie(value: string): string | null {
  const trimmed = normalizeInput(value).toLowerCase();
  if (!trimmed) return null;

  if (["boete", "uitkering", "belasting", "vergunning", "overig"].includes(trimmed)) {
    return trimmed;
  }

  const matchedCategory = bezwaarCategoriePatterns.find(({ pattern }) => pattern.test(trimmed))?.categorie;
  if (matchedCategory) {
    return matchedCategory;
  }

  if (/\b(weigering|weigeren|geweigerd|afwijzing|afwijzen|afgewezen)\b/i.test(trimmed)) {
    return "overig";
  }

  return null;
}

const validationMessageByStepId: Record<string, string> = {
  bestuursorgaan: "Noem een concreet bestuursorgaan, bijvoorbeeld 'gemeente Utrecht'.",
  categorie: "Kies een categorie: boete, uitkering, belasting, vergunning of overig.",
  ontwerpbesluit: "Beschrijf kort en concreet waar het ontwerpbesluit over gaat.",
  belangen: "Omschrijf welke belangen van jou door dit ontwerp of besluit worden geraakt.",
  doel: "Geef je doel, bijvoorbeeld: intrekken, herzien, aanpassen of matigen.",
  gronden: "Geef in ieder geval kort aan waarom je het niet eens bent met het besluit.",
  eerdere_bezwaargronden: "Vat kort samen welke hoofdpunten je eerder in bezwaar hebt aangevoerd.",
  onderwerp:
    "Omschrijf eerst wat je inhoudelijk wilt achterhalen, bijvoorbeeld welke besluiten, interne afstemming, beleidskeuzes of uitvoering je zoekt.",
  periode: "Noem een concrete periode, bijvoorbeeld 'januari 2023 tot januari 2024' of 'afgelopen 2 jaar'.",
  documenten: "Noem welke documenten je verwacht, bijvoorbeeld 'emails, notulen en rapporten'.",
  digitale_verstrekking: "Antwoord met ja of nee.",
  spoed: "Antwoord met ja of nee.",
};

export const bezwaarSteps: ChatStep[] = [
  {
    id: "bestuursorgaan",
    question:
      "Tegen welk bestuursorgaan richt je het bezwaar? (bijvoorbeeld: gemeente Amsterdam, belastingdienst)",
    field: "bestuursorgaan",
    required: true,
    validation: (value) => normalizeInput(value).length > 5,
  },
  {
    id: "categorie",
    question:
      "Wat is de soort besluit? (Kies een: boete, uitkering, belasting, vergunning, overig)",
    field: "categorie",
    required: true,
    validation: (value) => normalizeBezwaarCategorie(value) !== null,
  },
  {
    id: "doel",
    question: "Wat wil je bereiken met dit bezwaar? (Wil je het intrekken, herzien, etc.?)",
    field: "doel",
    required: true,
    validation: (value) => isBezwaarDoelAnswer(value),
  },
  {
    id: "gronden",
    question:
      "Waarom ben je het niet eens met het besluit? Beschrijf zo uitgebreid mogelijk wat volgens jou onjuist is.",
    field: "gronden",
    required: true,
    validation: (value) => normalizeInput(value).length >= 3,
  },
  {
    id: "persoonlijke_omstandigheden",
    question:
      "Zijn er relevante persoonlijke omstandigheden? (bijv. financiele moeilijkheden, gezondheid - dit is optioneel)",
    field: "persoonlijkeOmstandigheden",
    required: false,
    validation: () => true,
  },
];

export const zienswijzeSteps: ChatStep[] = [
  {
    id: "bestuursorgaan",
    question:
      "Welk bestuursorgaan bereidt het ontwerpbesluit voor? (bijvoorbeeld: gemeente Utrecht of provincie Noord-Holland)",
    field: "bestuursorgaan",
    required: true,
    validation: (value) => normalizeInput(value).length > 5,
  },
  {
    id: "ontwerpbesluit",
    question:
      "Wat houdt het ontwerpbesluit volgens jou in? Beschrijf kort waar het ontwerp over gaat.",
    field: "besluitSamenvatting",
    required: true,
    validation: (value) => normalizeInput(value).length >= 12,
  },
  {
    id: "belangen",
    question:
      "Welke belangen van jou worden door het ontwerpbesluit geraakt? Denk aan wonen, ondernemen, bereikbaarheid, geluid of privacy.",
    field: "persoonlijkeOmstandigheden",
    required: true,
    validation: (value) => normalizeInput(value).length >= 8,
  },
  {
    id: "gronden",
    question:
      "Welke bezwaren of aandachtspunten wil je in je zienswijze naar voren brengen?",
    field: "gronden",
    required: true,
    validation: (value) => normalizeInput(value).length >= 8,
  },
  {
    id: "doel",
    question:
      "Wat wil je dat er aan het ontwerpbesluit verandert? Bijvoorbeeld aanpassen, beter motiveren of niet vaststellen.",
    field: "doel",
    required: true,
    validation: (value) => normalizeInput(value).length >= 5,
  },
];

export const beroepZonderBezwaarSteps: ChatStep[] = [
  {
    id: "bestuursorgaan",
    question:
      "Welk bestuursorgaan nam het primaire besluit waartegen je rechtstreeks in beroep wilt?",
    field: "bestuursorgaan",
    required: true,
    validation: (value) => normalizeInput(value).length > 5,
  },
  {
    id: "categorie",
    question:
      "Om wat voor soort besluit gaat het? Kies bijvoorbeeld vergunning, uitkering, belasting, boete of overig.",
    field: "categorie",
    required: true,
    validation: (value) => normalizeBezwaarCategorie(value) !== null,
  },
  {
    id: "gronden",
    question:
      "Waarom is dit besluit volgens jou onjuist en waarom wil je dat de rechter ingrijpt?",
    field: "gronden",
    required: true,
    validation: (value) => normalizeInput(value).length >= 8,
  },
  {
    id: "doel",
    question:
      "Wat wil je dat de rechtbank bereikt met dit beroep? Bijvoorbeeld vernietiging van het besluit of een nieuw besluit.",
    field: "doel",
    required: true,
    validation: (value) => normalizeInput(value).length >= 5,
  },
  {
    id: "persoonlijke_omstandigheden",
    question:
      "Welke gevolgen of belangen moet de rechtbank volgens jou meewegen? Dit mag ook praktisch of financieel zijn.",
    field: "persoonlijkeOmstandigheden",
    required: false,
    validation: () => true,
  },
];

export const beroepNaBezwaarSteps: ChatStep[] = [
  {
    id: "bestuursorgaan",
    question:
      "Welk bestuursorgaan nam de beslissing op bezwaar waartegen je beroep wilt instellen?",
    field: "bestuursorgaan",
    required: true,
    validation: (value) => normalizeInput(value).length > 5,
  },
  {
    id: "categorie",
    question:
      "Om wat voor soort zaak gaat het? Kies bijvoorbeeld vergunning, uitkering, belasting, boete of overig.",
    field: "categorie",
    required: true,
    validation: (value) => normalizeBezwaarCategorie(value) !== null,
  },
  {
    id: "eerdere_bezwaargronden",
    question:
      "Welke hoofdpunten had je al in bezwaar aangevoerd?",
    field: "eerdereBezwaargronden",
    required: true,
    validation: (value) => normalizeInput(value).length >= 8,
  },
  {
    id: "gronden",
    question:
      "Wat is er volgens jou nog steeds onjuist in de beslissing op bezwaar? Licht vooral toe wat onvoldoende is weerlegd of meegewogen.",
    field: "gronden",
    required: true,
    validation: (value) => normalizeInput(value).length >= 8,
  },
  {
    id: "doel",
    question:
      "Wat wil je dat de rechtbank doet? Bijvoorbeeld de beslissing op bezwaar vernietigen of een nieuw besluit laten nemen.",
    field: "doel",
    required: true,
    validation: (value) => normalizeInput(value).length >= 5,
  },
  {
    id: "persoonlijke_omstandigheden",
    question:
      "Zijn er praktische, financiele of persoonlijke gevolgen die in beroep nadrukkelijk moeten worden meegewogen? Dit is optioneel.",
    field: "persoonlijkeOmstandigheden",
    required: false,
    validation: () => true,
  },
];

export const wooSteps: ChatStep[] = [
  {
    id: "bestuursorgaan",
    question:
      "Aan welk bestuursorgaan stel je het WOO-verzoek? (bijvoorbeeld: gemeente Amsterdam, ministerie van BIZA)",
    field: "bestuursorgaan",
    required: true,
    validation: (value) => normalizeInput(value).length > 5,
  },
  {
    id: "onderwerp",
    question:
      "Over welk onderwerp wil je documenten opvragen? Zijn er concrete onderwerpen of projecten?",
    field: "wooOnderwerp",
    required: true,
    validation: (value) => interpretWooSubjectAnswer(value).status === "valid",
  },
  {
    id: "periode",
    question:
      "Over welke periode wil je documenten? (bijv. 'januari 2023 tot januari 2024' of 'van voor 1 januari 2023')",
    field: "wooPeriode",
    required: true,
    validation: (value) => isWooPeriodAnswer(value),
  },
  {
    id: "documenten",
    question:
      "Welke soort documenten vermoed je dat bestaan? (bijv. emails, rapporten, notulen, besluitstukken)",
    field: "wooDocumenten",
    required: true,
    validation: (value) => normalizeInput(value).length > 5,
  },
  {
    id: "digitale_verstrekking",
    question: "Wil je dat de documenten digitaal worden verstrekt? (ja/nee)",
    field: "digitaleVerstrekking",
    required: false,
    validation: (value) => ["ja", "nee", "yes", "no"].includes(normalizeInput(value).toLowerCase()),
  },
  {
    id: "spoed",
    question: "Is er sprake van spoedeisend belang? (ja/nee)",
    field: "spoed",
    required: false,
    validation: (value) => ["ja", "nee", "yes", "no"].includes(normalizeInput(value).toLowerCase()),
  },
];

export function getStepsByFlow(flow: Flow): ChatStep[] {
  switch (flow) {
    case "zienswijze":
      return zienswijzeSteps;
    case "bezwaar":
      return bezwaarSteps;
    case "beroep_zonder_bezwaar":
      return beroepZonderBezwaarSteps;
    case "beroep_na_bezwaar":
      return beroepNaBezwaarSteps;
    case "woo":
      return wooSteps;
    default:
      return bezwaarSteps;
  }
}

export function validateStep(step: ChatStep, value: string): boolean {
  const trimmed = normalizeInput(value);
  if (!trimmed) return false;
  if (isLikelyClarifyingQuestion(trimmed)) return false;
  if (!step.validation) return true;
  return step.validation(trimmed);
}

export function getValidationErrorMessage(step: ChatStep, value: string): string {
  const trimmed = normalizeInput(value);
  if (!trimmed) return "Vul een antwoord in.";

  if (isLikelyClarifyingQuestion(trimmed)) {
    return "Dit lijkt een vraag. Geef eerst een concreet antwoord op de huidige intakevraag.";
  }

  if (!validateStep(step, trimmed)) {
    return validationMessageByStepId[step.id] ?? "Dit antwoord voldoet niet aan de vereisten.";
  }

  return "";
}

export function needsFollowUp(
  formData: IntakeFormData,
  stepId: string
): string | null {
  void formData;
  void stepId;
  return null;
}

export function isIntakeBezwaarComplete(formData: IntakeFormData): boolean {
  return !!(
    formData.bestuursorgaan &&
    formData.categorie &&
    formData.doel &&
    formData.gronden &&
    formData.gronden.length >= 3 &&
    formData.files?.besluit
  );
}

export function isIntakeZienswijzeComplete(formData: IntakeFormData): boolean {
  return !!(
    formData.bestuursorgaan &&
    formData.besluitSamenvatting &&
    formData.persoonlijkeOmstandigheden &&
    formData.gronden &&
    formData.doel
  );
}

export function isIntakeBeroepZonderBezwaarComplete(formData: IntakeFormData): boolean {
  return !!(
    formData.bestuursorgaan &&
    formData.categorie &&
    formData.gronden &&
    formData.doel &&
    formData.files?.besluit
  );
}

export function isIntakeBeroepNaBezwaarComplete(formData: IntakeFormData): boolean {
  return !!(
    formData.bestuursorgaan &&
    formData.categorie &&
    formData.eerdereBezwaargronden &&
    formData.gronden &&
    formData.doel &&
    formData.files?.besluit
  );
}

export function isIntakeWOOComplete(formData: IntakeFormData): boolean {
  return !!(
    formData.bestuursorgaan &&
    formData.wooOnderwerp &&
    formData.wooPeriode &&
    formData.wooDocumenten
  );
}

export function isIntakeComplete(formData: IntakeFormData): boolean {
  switch (formData.flow) {
    case "zienswijze":
      return isIntakeZienswijzeComplete(formData);
    case "bezwaar":
      return isIntakeBezwaarComplete(formData);
    case "beroep_zonder_bezwaar":
      return isIntakeBeroepZonderBezwaarComplete(formData);
    case "beroep_na_bezwaar":
      return isIntakeBeroepNaBezwaarComplete(formData);
    case "woo":
      return isIntakeWOOComplete(formData);
    default:
      return false;
  }
}
