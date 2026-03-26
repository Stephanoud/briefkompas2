import { Flow, IntakeFormData, ProcedureAdvice, RechtsmiddelenClausule } from "@/types";
import { getFlowActionLabel, getFlowLabel } from "@/lib/flow";

export interface ProcedureCheckStep {
  id: string;
  field: keyof IntakeFormData;
  question: string;
  kind: "boolean" | "clausule" | "text";
  options?: string[];
}

export interface ProcedureRouteResult {
  advice: ProcedureAdvice;
  explanation: string;
}

const yesValues = new Set(["ja", "j", "yes", "y", "klopt", "zeker", "inderdaad"]);
const noValues = new Set(["nee", "n", "no", "niet", "nog niet"]);
const unknownValues = new Set(["onbekend", "weet ik niet", "ik weet het niet", "twijfel"]);
const clauseValues: RechtsmiddelenClausule[] = ["bezwaar", "beroep", "zienswijze", "onbekend"];

export const procedureCheckSteps: ProcedureCheckStep[] = [
  {
    id: "heeft_officieel_besluit",
    field: "heeftOfficieelBesluit",
    kind: "boolean",
    question: "Heeft u al een officieel besluit ontvangen?",
    options: ["ja", "nee"],
  },
  {
    id: "had_ontwerpbesluit",
    field: "hadOntwerpbesluit",
    kind: "boolean",
    question: "Ging er een ontwerpbesluit aan vooraf?",
    options: ["ja", "nee", "onbekend"],
  },
  {
    id: "kon_zienswijze",
    field: "konZienswijzeIndienen",
    kind: "boolean",
    question: "Kon u een zienswijze indienen?",
    options: ["ja", "nee", "onbekend"],
  },
  {
    id: "heeft_zienswijze",
    field: "heeftZienswijzeIngediend",
    kind: "boolean",
    question: "Heeft u een zienswijze ingediend?",
    options: ["ja", "nee"],
  },
  {
    id: "heeft_bezwaar",
    field: "heeftBezwaarGemaakt",
    kind: "boolean",
    question: "Heeft u al bezwaar gemaakt?",
    options: ["ja", "nee"],
  },
  {
    id: "heeft_beslissing_op_bezwaar",
    field: "heeftBeslissingOpBezwaar",
    kind: "boolean",
    question: "Heeft u een beslissing op bezwaar ontvangen?",
    options: ["ja", "nee"],
  },
  {
    id: "rechtsmiddelenclausule",
    field: "rechtsmiddelenClausule",
    kind: "clausule",
    question: "Wat staat onderaan het besluit: bezwaar, beroep, zienswijze of onbekend?",
    options: [...clauseValues],
  },
  {
    id: "niet_tijdig",
    field: "nietTijdigBeslissen",
    kind: "boolean",
    question: "Gaat het om te laat beslissen?",
    options: ["ja", "nee"],
  },
  {
    id: "waarom_belanghebbende",
    field: "waaromBelanghebbende",
    kind: "text",
    question: "Waarom bent u belanghebbende?",
  },
];

export function normalizeRouteInput(value: string): string {
  return value.trim().toLowerCase();
}

export function parseBooleanLikeAnswer(value: string): boolean | undefined {
  const normalized = normalizeRouteInput(value);
  if (yesValues.has(normalized)) return true;
  if (noValues.has(normalized)) return false;

  if (/\b(al\s+)?(een\s+)?(officieel\s+)?besluit\b/i.test(value) && !/\bgeen\b/i.test(value)) {
    return true;
  }
  if (/\bgeen\s+(officieel\s+)?besluit\b/i.test(value)) {
    return false;
  }
  if (/\bontwerpbesluit\b/i.test(value) && !/\bgeen\b/i.test(value)) {
    return true;
  }
  if (/\bgeen\s+ontwerpbesluit\b/i.test(value)) {
    return false;
  }
  if (/\bzienswijze\b/i.test(value) && /\b(kon|ingediend|mogelijk)\b/i.test(value) && !/\b(niet|geen)\b/i.test(value)) {
    return true;
  }
  if (/\b(niet|geen)\b.*\bzienswijze\b/i.test(value)) {
    return false;
  }
  if (/\bbezwaar\b/i.test(value) && /\b(gemaakt|ingediend)\b/i.test(value) && !/\b(nog geen|niet)\b/i.test(value)) {
    return true;
  }
  if (/\b(nog geen|niet)\b.*\bbezwaar\b/i.test(value)) {
    return false;
  }
  if (/\bbeslissing op bezwaar\b/i.test(value) && !/\b(nog geen|niet)\b/i.test(value)) {
    return true;
  }
  if (/\b(nog geen|niet)\b.*\bbeslissing op bezwaar\b/i.test(value)) {
    return false;
  }
  if (/\bte laat beslissen|niet tijdig\b/i.test(value) && !/\b(niet|geen)\b/i.test(value)) {
    return true;
  }

  if (/\b(ja|zeker|inderdaad|klopt)\b/i.test(value)) return true;
  if (/\b(nee|niet|nog niet)\b/i.test(value)) return false;

  return undefined;
}

export function parseRechtsmiddelenClausule(value: string): RechtsmiddelenClausule | undefined {
  const normalized = normalizeRouteInput(value);
  if (clauseValues.includes(normalized as RechtsmiddelenClausule)) {
    return normalized as RechtsmiddelenClausule;
  }

  if (unknownValues.has(normalized)) {
    return "onbekend";
  }

  if (/\bbezwaar\b/i.test(value)) return "bezwaar";
  if (/\bberoep\b/i.test(value)) return "beroep";
  if (/\bzienswijze\b/i.test(value)) return "zienswijze";
  if (/\b(onbekend|weet ik niet|geen idee)\b/i.test(value)) return "onbekend";

  return undefined;
}

export function validateProcedureCheckStep(step: ProcedureCheckStep, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (step.kind === "boolean") {
    return parseBooleanLikeAnswer(trimmed) !== undefined;
  }

  if (step.kind === "clausule") {
    return parseRechtsmiddelenClausule(trimmed) !== undefined;
  }

  return trimmed.length >= 8;
}

export function getProcedureCheckValidationMessage(step: ProcedureCheckStep): string {
  if (step.kind === "boolean") {
    return "Antwoord met ja of nee.";
  }

  if (step.kind === "clausule") {
    return "Kies bezwaar, beroep, zienswijze of onbekend.";
  }

  return "Omschrijf kort waarom u rechtstreeks door het besluit wordt geraakt.";
}

export function buildProcedureCheckPatch(
  step: ProcedureCheckStep,
  answer: string
): Partial<IntakeFormData> {
  if (step.kind === "boolean") {
    const parsed = parseBooleanLikeAnswer(answer);
    return parsed === undefined ? {} : { [step.field]: parsed };
  }

  if (step.kind === "clausule") {
    const parsed = parseRechtsmiddelenClausule(answer);
    return parsed ? { [step.field]: parsed } : {};
  }

  return {
    [step.field]: answer.trim(),
  };
}

export function determineProcedureAdvice(data: Partial<IntakeFormData>): ProcedureRouteResult {
  if (data.nietTijdigBeslissen) {
    return {
      advice: "niet_tijdig_beslissen",
      explanation:
        "Op basis van uw antwoorden lijkt het te gaan om niet tijdig beslissen. Dat is een aparte Awb-route en valt niet onder de standaard modules voor zienswijze, bezwaar of beroep.",
    };
  }

  if (data.heeftBeslissingOpBezwaar) {
    return {
      advice: "beroep_na_bezwaar",
      explanation:
        "Op basis van uw antwoorden lijkt beroep na bezwaar de juiste route, omdat er al een beslissing op bezwaar is ontvangen.",
    };
  }

  if (data.heeftBezwaarGemaakt && !data.heeftBeslissingOpBezwaar) {
    return {
      advice: "bezwaarfase",
      explanation:
        "Op basis van uw antwoorden lijkt u nog in de bezwaarfase te zitten, omdat al bezwaar is gemaakt maar nog geen beslissing op bezwaar is ontvangen.",
    };
  }

  if (!data.heeftOfficieelBesluit && data.hadOntwerpbesluit) {
    return {
      advice: "zienswijze",
      explanation:
        "Op basis van uw antwoorden lijkt een zienswijze de juiste route, omdat er nog geen definitief besluit is maar wel een ontwerpbesluit waar u op kunt reageren.",
    };
  }

  if ((data.hadOntwerpbesluit && data.konZienswijzeIndienen) || data.rechtsmiddelenClausule === "beroep") {
    const reason =
      data.rechtsmiddelenClausule === "beroep"
        ? "onderaan het besluit staat dat direct beroep openstaat"
        : "er eerst een ontwerpbesluit lag en een zienswijze mogelijk was";
    return {
      advice: "beroep_zonder_bezwaar",
      explanation: `Op basis van uw antwoorden lijkt beroep zonder bezwaar de juiste route, omdat ${reason}.`,
    };
  }

  return {
    advice: "bezwaar",
    explanation:
      "Op basis van uw antwoorden lijkt bezwaar de juiste standaardroute, omdat er wel een besluit is maar geen duidelijke aanwijzing voor direct beroep of een lopende beroepsfase.",
  };
}

export function getProcedureAdviceDisplay(result: ProcedureRouteResult): string {
  if (result.advice === "bezwaarfase") {
    return "U zit nog in de bezwaarfase";
  }

  if (result.advice === "niet_tijdig_beslissen") {
    return "Niet tijdig beslissen";
  }

  return getFlowActionLabel(result.advice);
}

export function buildProcedureConfirmationMessage(result: ProcedureRouteResult): string {
  return [
    "Wij gaan uit van de volgende procedure:",
    getProcedureAdviceDisplay(result),
    "",
    "Reden:",
    result.explanation,
    "",
    result.advice === "bezwaarfase" || result.advice === "niet_tijdig_beslissen"
      ? "Als u toch een andere route wilt kiezen, typ dan 'nee' of kies hieronder handmatig een procedure."
      : "Klopt dit? Antwoord met 'ja' of 'nee'.",
  ].join("\n");
}

export function buildManualProcedureOverrideMessage(): string {
  return "Welke procedure wilt u gebruiken? Kies zienswijze, bezwaar, beroep zonder bezwaar, beroep na bezwaar of WOO-verzoek.";
}

export function getProcedureUploadHint(flow: Flow): string {
  switch (flow) {
    case "bezwaar":
      return "Upload of fotografeer het primaire besluit.";
    case "beroep_zonder_bezwaar":
      return "Upload of fotografeer het primaire besluit waartegen u rechtstreeks beroep wilt instellen.";
    case "beroep_na_bezwaar":
      return "Upload of fotografeer de beslissing op bezwaar.";
    default:
      return "";
  }
}

export function getProcedureReasonForPrompt(data: Partial<IntakeFormData>): string {
  if (data.procedureReden?.trim()) {
    return data.procedureReden.trim();
  }

  if (data.procedureAdvies && data.procedureAdvies !== "bezwaarfase" && data.procedureAdvies !== "niet_tijdig_beslissen") {
    return `De intake lijkt te wijzen op de route ${getFlowLabel(data.procedureAdvies)}.`;
  }

  return "De intake bevat nog geen bevestigde proceduretoelichting.";
}
