import { ChatStep, IntakeFormData, Flow } from "@/types";

const questionPrefixPattern = /^(wat|hoe|waarom|welke|wanneer|wie|kan|kun|mag|moet)\b/i;
const yearPattern = /\b(19|20)\d{2}\b/;
const datePattern = /\b\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?\b/;
const monthPattern =
  /\b(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\b/i;
const rangeWordPattern = /\b(van|tot|tussen|sinds|vanaf|voor|na|afgelopen|laatste)\b/i;
const periodUnitPattern = /\b(jaar|jaren|maand|maanden|week|weken|dag|dagen|kwartaal|kwartalen)\b/i;
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

export function isLikelyClarifyingQuestion(value: string): boolean {
  const trimmed = normalizeInput(value);
  if (!trimmed) return false;
  if (trimmed.includes("?")) return true;

  const lower = trimmed.toLowerCase();
  const isShortInput = lower.split(/\s+/).length <= 10;
  return isShortInput && questionPrefixPattern.test(lower);
}

function isWooPeriodAnswer(value: string): boolean {
  const trimmed = normalizeInput(value);
  if (trimmed.length < 6) return false;
  if (isLikelyClarifyingQuestion(trimmed)) return false;

  const hasDateReference =
    yearPattern.test(trimmed) || datePattern.test(trimmed) || monthPattern.test(trimmed);
  const hasRangeWord = rangeWordPattern.test(trimmed);
  const hasPeriodUnit = periodUnitPattern.test(trimmed);
  const hasNumber = /\d/.test(trimmed);

  return (hasDateReference && (hasRangeWord || hasNumber || hasPeriodUnit)) || (hasRangeWord && hasPeriodUnit && hasNumber);
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
  doel: "Geef je doel, bijvoorbeeld: intrekken, herzien, aanpassen of matigen.",
  gronden: "Geef in ieder geval kort aan waarom je het niet eens bent met het besluit.",
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
    validation: (value) => normalizeInput(value).length > 10,
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
  return flow === "bezwaar" ? bezwaarSteps : wooSteps;
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

export function isIntakeWOOComplete(formData: IntakeFormData): boolean {
  return !!(
    formData.bestuursorgaan &&
    formData.wooOnderwerp &&
    formData.wooPeriode &&
    formData.wooDocumenten
  );
}

export function isIntakeComplete(formData: IntakeFormData): boolean {
  return formData.flow === "bezwaar"
    ? isIntakeBezwaarComplete(formData)
    : isIntakeWOOComplete(formData);
}
