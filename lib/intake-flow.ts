import { ChatStep, IntakeFormData, Flow } from "@/types";

export const bezwaarSteps: ChatStep[] = [
  {
    id: "bestuursorgaan",
    question:
      "Tegen welk bestuursorgaan richt je het bezwaar? (bijvoorbeeld: gemeente Amsterdam, belastingdienst)",
    field: "bestuursorgaan",
    required: true,
    validation: (value) => value.length > 5,
  },
  {
    id: "datum_besluit",
    question: "Op welke datum is het besluit genomen?",
    field: "datumBesluit",
    required: true,
    validation: (value) => /^\d{2}-\d{2}-\d{4}$|^\d{4}-\d{2}-\d{2}$/.test(value),
  },
  {
    id: "kenmerk",
    question:
      "Wat is het kenmerk of zaaknummer van het besluit? (dit staat meestal op de brief)",
    field: "kenmerk",
    required: false,
    validation: (value) => value.length > 2,
  },
  {
    id: "categorie",
    question:
      "Wat is de soort besluit? (Kies één: boete, uitkering, belasting, vergunning, overig)",
    field: "categorie",
    required: true,
    validation: (value) =>
      ["boete", "uitkering", "belasting", "vergunning", "overig"].includes(
        value.toLowerCase()
      ),
  },
  {
    id: "doel",
    question: "Wat wil je bereiken met dit bezwaar? (Wil je het intrekken, herzien, etc.?)",
    field: "doel",
    required: true,
    validation: (value) => value.length > 10,
  },
  {
    id: "gronden",
    question:
      "Waarom ben je het niet eens met het besluit? Beschrijf zo uitgebreid mogelijk wat volgens jou onjuist is.",
    field: "gronden",
    required: true,
    validation: (value) => value.length >= 200,
  },
  {
    id: "persoonlijke_omstandigheden",
    question:
      "Zijn er relevante persoonlijke omstandigheden? (bijv. financiële moeilijkheden, gezondheid - dit is optioneel)",
    field: "persoonlijkeOmstandigheden",
    required: false,
    validation: (value) => true,
  },
];

export const wooSteps: ChatStep[] = [
  {
    id: "bestuursorgaan",
    question:
      "Aan welk bestuursorgaan stel je het WOO-verzoek? (bijvoorbeeld: gemeente Amsterdam, ministerie van BIZA)",
    field: "bestuursorgaan",
    required: true,
    validation: (value) => value.length > 5,
  },
  {
    id: "onderwerp",
    question:
      "Over welk onderwerp wil je documenten opvragen? Zijn er concrete onderwerpen of projecten?",
    field: "wooOnderwerp",
    required: true,
    validation: (value) => value.length > 10,
  },
  {
    id: "periode",
    question:
      "Over welke periode wil je documenten? (bijv. 'januari 2023 tot januari 2024' of 'van voor 1 januari 2023')",
    field: "wooPeriode",
    required: true,
    validation: (value) => value.length > 5,
  },
  {
    id: "documenten",
    question:
      "Welke soort documenten vermoed je dat bestaan? (bijv. emails, rapporten, notulen, besluitstukken)",
    field: "wooDocumenten",
    required: true,
    validation: (value) => value.length > 5,
  },
  {
    id: "digitale_verstrekking",
    question: "Wil je dat de documenten digitaal worden verstrekt? (ja/nee)",
    field: "digitaleVerstrekking",
    required: false,
    validation: (value) => ["ja", "nee", "yes", "no"].includes(value.toLowerCase()),
  },
  {
    id: "spoed",
    question: "Is er sprake van spoedeisend belang? (ja/nee)",
    field: "spoed",
    required: false,
    validation: (value) => ["ja", "nee", "yes", "no"].includes(value.toLowerCase()),
  },
];

export function getStepsByFlow(flow: Flow): ChatStep[] {
  return flow === "bezwaar" ? bezwaarSteps : wooSteps;
}

export function validateStep(step: ChatStep, value: string): boolean {
  if (!step.validation) return true;
  return step.validation(value);
}

export function needsFollowUp(
  formData: IntakeFormData,
  stepId: string
): string | null {
  if (stepId === "gronden" && formData.gronden) {
    const len = formData.gronden.length;
    if (len < 300) {
      return "Je omschrijving is nog wat beperkt. Kun je wat meer details geven over waarom je het niet eens bent met het besluit?";
    }
  }
  return null;
}

export function isIntakeBezwaarComplete(formData: IntakeFormData): boolean {
  return !!(
    formData.bestuursorgaan &&
    formData.datumBesluit &&
    formData.categorie &&
    formData.doel &&
    formData.gronden &&
    formData.gronden.length >= 200 &&
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
