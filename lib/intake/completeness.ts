import { Flow, IntakeFormData } from "@/types";
import { getMissingRequiredFields } from "@/lib/intake/requiredFields";

export const NEEDS_MORE_INFO_MESSAGE =
  "Om een juridisch bruikbare brief te maken ontbreekt nog verplichte informatie. Vul dit eerst aan of upload het besluit.";

export type MissingCriticalInfoField = {
  field: keyof IntakeFormData | "decisionDocument" | "procedureType";
  label: string;
  question: string;
  inputType: "text" | "textarea" | "upload";
};

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstText(...values: Array<string | null | undefined>): string | undefined {
  return values.map((value) => (hasText(value) ? normalizeWhitespace(value) : "")).find(Boolean);
}

export function humanizeMissingInfoField(field: MissingCriticalInfoField | string): string {
  const fieldName = typeof field === "string" ? field : field.field;
  if (typeof field !== "string" && field.label) {
    return field.label;
  }

  switch (fieldName) {
    case "decisionDocument":
      return "besluit uploaden";
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
    case "besluitOnderwerp":
      return "onderwerp van het besluit";
    case "beslissingOfMaatregel":
      return "beslissing of maatregel";
    case "belangrijksteMotivering":
      return "belangrijkste reden of motivering";
    case "relevanteTermijn":
      return "relevante termijn";
    case "datumBesluit":
      return "datum besluit";
    case "eerdereBezwaargronden":
      return "eerdere bezwaargronden";
    case "wooOnderwerp":
      return "Woo-onderwerp";
    case "wooPeriode":
      return "Woo-periode";
    case "wooDocumenten":
      return "gevraagde Woo-documenten";
    default:
      return String(fieldName);
  }
}

export function getDecisionSubject(data: IntakeFormData): string | undefined {
  return firstText(
    data.besluitOnderwerp,
    data.besluitAnalyse?.onderwerp,
    data.besluitDocumentType,
    data.besluitSamenvatting,
    data.categorie
  );
}

export function getDecisionAction(data: IntakeFormData): string | undefined {
  return firstText(
    data.beslissingOfMaatregel,
    data.besluitAnalyse?.besluitInhoud,
    data.besluitSamenvatting,
    data.besluitAnalyse?.onderwerp
  );
}

export function getDecisionMotivation(data: IntakeFormData): string | undefined {
  const considerations =
    data.besluitAnalyse?.dragendeOverwegingen?.flatMap((item) => [item.duiding, item.passage]) ?? [];

  return firstText(
    data.belangrijksteMotivering,
    ...considerations,
    data.besluitAnalyse?.rechtsgrond,
    data.besluitAnalyse?.besluitInhoud
  );
}

export function getDecisionTerm(data: IntakeFormData): string | undefined {
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

export function resolveIntakeDataForGeneration(data: IntakeFormData, flow: Flow): IntakeFormData {
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
        label: "Gevraagde Woo-documenten",
        question: "Vul in welke documenten of documentsoorten moeten worden verstrekt.",
        inputType: "textarea",
      };
    default:
      return {
        field: field as keyof IntakeFormData,
        label: humanizeMissingInfoField(field),
        question: `Vul ${humanizeMissingInfoField(field)} in.`,
        inputType: "textarea",
      };
  }
}

function addMissingField(fields: MissingCriticalInfoField[], field: MissingCriticalInfoField) {
  if (!fields.some((item) => item.field === field.field)) {
    fields.push(field);
  }
}

export function getMissingCriticalInfo(flow: Flow, data: IntakeFormData): MissingCriticalInfoField[] {
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

export function getMissingGenerationInfo(flow: Flow, data: IntakeFormData): MissingCriticalInfoField[] {
  return getMissingCriticalInfo(flow, resolveIntakeDataForGeneration(data, flow));
}
