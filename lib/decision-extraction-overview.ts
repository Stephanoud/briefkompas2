import { getDecisionProcedureDetectionLabel } from "@/lib/decision-procedure";
import {
  DecisionExtractionFieldStatus,
  DecisionExtractionOverview,
  DecisionExtractionOverviewField,
  DecisionExtractionOverviewFieldKey,
  DecisionExtractionResult,
  DecisionReadability,
} from "@/types";

const CERTAINTY_THRESHOLD = 70;

export const decisionExtractionOverviewFieldLabels: Record<DecisionExtractionOverviewFieldKey, string> = {
  bestuursorgaan: "Bestuursorgaan",
  besluitdatum: "Besluitdatum",
  procedure: "Procedure",
  termijnEindigt: "Termijn eindigt",
  onderwerp: "Onderwerp",
  korteSamenvatting: "Korte samenvatting",
};

export const decisionExtractionOverviewFieldOrder: DecisionExtractionOverviewFieldKey[] = [
  "bestuursorgaan",
  "besluitdatum",
  "procedure",
  "termijnEindigt",
  "onderwerp",
  "korteSamenvatting",
];

const FIELD_ALIASES: Record<DecisionExtractionOverviewFieldKey, string[]> = {
  bestuursorgaan: ["bestuursorgaan", "authority"],
  besluitdatum: ["besluitdatum", "datumBesluit", "decisionDate"],
  procedure: ["procedure", "procedureDetectie", "procedureDetection"],
  termijnEindigt: ["termijnEindigt", "termijnEinde", "deadline", "deadlineDate"],
  onderwerp: ["onderwerp", "subject"],
  korteSamenvatting: ["korteSamenvatting", "samenvatting", "summary"],
};

const MONTH_NAME_ALIASES: Record<string, string> = {
  january: "januari",
  jan: "januari",
  februari: "februari",
  february: "februari",
  feb: "februari",
  maart: "maart",
  march: "maart",
  mar: "maart",
  april: "april",
  apr: "april",
  mei: "mei",
  may: "mei",
  juni: "juni",
  june: "juni",
  jun: "juni",
  juli: "juli",
  july: "juli",
  jul: "juli",
  augustus: "augustus",
  august: "augustus",
  aug: "augustus",
  september: "september",
  sept: "september",
  sep: "september",
  oktober: "oktober",
  october: "oktober",
  oct: "oktober",
  november: "november",
  nov: "november",
  december: "december",
  dec: "december",
};

const MONTH_NAME_PATTERN = Object.keys(MONTH_NAME_ALIASES)
  .sort((left, right) => right.length - left.length)
  .join("|");

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimLength(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && normalizeWhitespace(value).length > 0;
}

function sanitizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized ? trimLength(normalized, maxLength) : null;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function sanitizeConfidence(value: unknown): number | null {
  if (typeof value === "number") {
    return clampConfidence(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(parsed) ? clampConfidence(parsed) : null;
  }

  return null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getRawFields(rawOverview: unknown): Record<string, unknown> {
  const record = getRecord(rawOverview);
  const nestedFields = getRecord(record?.fields ?? record?.velden);
  return nestedFields ?? record ?? {};
}

function getRawField(rawOverview: unknown, fieldKey: DecisionExtractionOverviewFieldKey): unknown {
  const fields = getRawFields(rawOverview);

  for (const alias of FIELD_ALIASES[fieldKey]) {
    if (Object.prototype.hasOwnProperty.call(fields, alias)) {
      return fields[alias];
    }
  }

  return null;
}

function getRawFieldRecord(rawOverview: unknown, fieldKey: DecisionExtractionOverviewFieldKey) {
  return getRecord(getRawField(rawOverview, fieldKey));
}

function getRawFieldValue(rawOverview: unknown, fieldKey: DecisionExtractionOverviewFieldKey): string | null {
  const rawField = getRawField(rawOverview, fieldKey);
  const record = getRecord(rawField);

  if (record) {
    return sanitizeOptionalString(
      record.value ?? record.waarde ?? record.text ?? record.tekst,
      fieldKey === "korteSamenvatting" ? 650 : 220
    );
  }

  return sanitizeOptionalString(rawField, fieldKey === "korteSamenvatting" ? 650 : 220);
}

function getRawFieldConfidence(rawOverview: unknown, fieldKey: DecisionExtractionOverviewFieldKey): number | null {
  const record = getRawFieldRecord(rawOverview, fieldKey);
  if (!record) {
    return null;
  }

  return sanitizeConfidence(record.confidence ?? record.confidenceScore ?? record.score ?? record.zekerheid);
}

function normalizeStatus(value: unknown): DecisionExtractionFieldStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  if (["found", "gevonden", "zeker", "vastgesteld"].includes(normalized)) {
    return "found";
  }

  if (["uncertain", "onzeker", "twijfel", "niet_zeker"].includes(normalized)) {
    return "uncertain";
  }

  if (["missing", "ontbreekt", "niet_gevonden", "unknown", "onbekend"].includes(normalized)) {
    return "missing";
  }

  return null;
}

function getRawFieldStatus(rawOverview: unknown, fieldKey: DecisionExtractionOverviewFieldKey): DecisionExtractionFieldStatus | null {
  const record = getRawFieldRecord(rawOverview, fieldKey);
  if (!record) {
    return null;
  }

  return normalizeStatus(record.status ?? record.staat ?? record.state);
}

function getDefaultConfidence(
  fieldKey: DecisionExtractionOverviewFieldKey,
  extraction: Partial<DecisionExtractionResult>,
  value: string | null
): number {
  if (!value) {
    return 0;
  }

  if (fieldKey === "procedure" && extraction.procedureDetection?.confidence !== undefined) {
    return clampConfidence(extraction.procedureDetection.confidence);
  }

  const status = extraction.analysisStatus;
  const readability = extraction.readability;
  const baseByStatus: Record<string, number> = {
    read: 82,
    partial: 64,
    failed: 45,
  };
  const readabilityAdjustment: Record<DecisionReadability, number> = {
    high: 6,
    medium: 0,
    low: -10,
  };
  const fieldAdjustment: Record<DecisionExtractionOverviewFieldKey, number> = {
    bestuursorgaan: 4,
    besluitdatum: 5,
    procedure: 0,
    termijnEindigt: -2,
    onderwerp: 2,
    korteSamenvatting: -3,
  };

  return clampConfidence(
    (status ? baseByStatus[status] ?? 60 : 60) +
      (readability ? readabilityAdjustment[readability] : 0) +
      fieldAdjustment[fieldKey]
  );
}

function buildField(params: {
  fieldKey: DecisionExtractionOverviewFieldKey;
  value: string | null;
  extraction: Partial<DecisionExtractionResult>;
  rawOverview?: unknown;
}): DecisionExtractionOverviewField {
  const rawConfidence = getRawFieldConfidence(params.rawOverview, params.fieldKey);
  const confidence = rawConfidence ?? getDefaultConfidence(params.fieldKey, params.extraction, params.value);
  const rawStatus = getRawFieldStatus(params.rawOverview, params.fieldKey);
  const status =
    !params.value
      ? "missing"
      : rawStatus === "uncertain"
        ? "uncertain"
        : rawStatus === "found" && confidence >= CERTAINTY_THRESHOLD
          ? "found"
        : confidence >= CERTAINTY_THRESHOLD
          ? "found"
          : "uncertain";

  return {
    value: params.value,
    confidence: params.value ? clampConfidence(confidence) : 0,
    status,
  };
}

function normalizeMonthNames(value: string): string {
  return value.replace(new RegExp(`\\b(${MONTH_NAME_PATTERN})\\b`, "gi"), (match) => {
    const normalized = MONTH_NAME_ALIASES[match.toLowerCase()];
    return normalized ?? match;
  });
}

function extractExplicitDeadlineEnd(extraction: Partial<DecisionExtractionResult>): string | null {
  const sourceText = [
    extraction.decisionAnalysis?.termijnen,
    extraction.decisionAnalysis?.rechtsmiddelenclausule,
    ...(extraction.decisionAnalysis?.procedureleAanwijzingen ?? []),
  ]
    .filter(hasText)
    .join(" ");

  if (!sourceText) {
    return null;
  }

  const explicitDeadlinePattern = new RegExp(
    `\\b(?:termijn|bezwaar|beroep|zienswijze|uiterlijk|v[o\\u00f3]or|tot(?: en met)?|eindigt|loopt af)\\b.{0,90}\\b(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTH_NAME_PATTERN})\\s+\\d{4})\\b`,
    "i"
  );
  const match = normalizeWhitespace(sourceText).match(explicitDeadlinePattern);
  return match?.[1] ? normalizeWhitespace(normalizeMonthNames(match[1])) : null;
}

function getProcedureValue(extraction: Partial<DecisionExtractionResult>): string | null {
  const detection = extraction.procedureDetection;
  if (!detection || detection.procedure === "onbekend") {
    return null;
  }

  return getDecisionProcedureDetectionLabel(detection);
}

function getOverviewValue(
  fieldKey: DecisionExtractionOverviewFieldKey,
  extraction: Partial<DecisionExtractionResult>,
  rawOverview?: unknown
): string | null {
  switch (fieldKey) {
    case "bestuursorgaan":
      return sanitizeOptionalString(extraction.decisionAnalysis?.bestuursorgaan, 180);
    case "besluitdatum":
      return sanitizeOptionalString(extraction.datumBesluit, 120);
    case "procedure":
      return getProcedureValue(extraction);
    case "termijnEindigt":
      return (
        getRawFieldValue(rawOverview, "termijnEindigt") ??
        extractExplicitDeadlineEnd(extraction)
      );
    case "onderwerp":
      return sanitizeOptionalString(extraction.decisionAnalysis?.onderwerp, 220);
    case "korteSamenvatting":
      return sanitizeOptionalString(extraction.samenvatting, 650);
    default:
      return null;
  }
}

function getOverviewWarnings(
  fields: Record<DecisionExtractionOverviewFieldKey, DecisionExtractionOverviewField>
): string[] {
  const warnings: string[] = [];

  if (fields.besluitdatum.status !== "found") {
    warnings.push("Besluitdatum ontbreekt of is niet zeker uit het besluit gehaald.");
  }

  if (fields.termijnEindigt.status !== "found") {
    warnings.push("Termijn kan niet met zekerheid worden vastgesteld uit het besluit.");
  }

  if (fields.bestuursorgaan.status !== "found") {
    warnings.push("Bestuursorgaan is onbekend of niet zeker uit het besluit gehaald.");
  }

  return warnings;
}

export function buildDecisionExtractionOverview(
  extraction: Partial<DecisionExtractionResult>,
  rawOverview?: unknown
): DecisionExtractionOverview {
  const fields = decisionExtractionOverviewFieldOrder.reduce(
    (result, fieldKey) => {
      const value = getOverviewValue(fieldKey, extraction, rawOverview);
      result[fieldKey] = buildField({
        fieldKey,
        value,
        extraction,
        rawOverview,
      });
      return result;
    },
    {} as Record<DecisionExtractionOverviewFieldKey, DecisionExtractionOverviewField>
  );
  const missingFields = decisionExtractionOverviewFieldOrder.filter(
    (fieldKey) => fields[fieldKey].status === "missing"
  );

  return {
    fields,
    missingFields,
    warnings: getOverviewWarnings(fields),
  };
}
