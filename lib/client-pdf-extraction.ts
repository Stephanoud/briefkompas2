import { DecisionAnalysisStatus, DecisionReadability } from "@/types";

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

const STRUCTURED_FIELD_STOP_LABELS = [
  "datum van het besluit",
  "datum besluit",
  "datum beschikking",
  "datum brief",
  "dagtekening",
  "datum",
  "bestuursorgaan",
  "betreft",
  "onderwerp",
  "besluit",
  "motivering",
  "zaaknummer",
  "zaaknr",
  "kenmerk",
  "ons kenmerk",
  "referentie",
  "bijlage",
  "bijlagen",
  "namens",
];

let browserPdfWorkerConfigured = false;

export interface ClientPdfExtractionResult {
  extractedText: string;
  datumBesluit: string | null;
  kenmerk: string | null;
  analysisStatus: DecisionAnalysisStatus;
  readability: DecisionReadability;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitIntoNormalizedLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function normalizeMonthNames(value: string): string {
  return value.replace(new RegExp(`\\b(${MONTH_NAME_PATTERN})\\b`, "gi"), (match) => {
    const normalized = MONTH_NAME_ALIASES[match.toLowerCase()];
    return normalized ?? match;
  });
}

function normalizeExtractedDate(value: string): string {
  return normalizeWhitespace(normalizeMonthNames(value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimAtStructuredFieldBoundary(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "";
  }

  const stopPattern = new RegExp(
    `\\s+(?=(?:${STRUCTURED_FIELD_STOP_LABELS.map((label) => escapeRegExp(label)).join("|")})\\b)`,
    "i"
  );
  const [firstPart] = normalized.split(stopPattern);
  return firstPart?.trim() ?? normalized;
}

function sanitizeKenmerk(value: string): string {
  return value
    .replace(/[\s]{2,}/g, " ")
    .replace(/^[\s:;.-]+/, "")
    .replace(/[\s:;.-]+$/, "")
    .trim();
}

function looksLikeKenmerk(value: string): boolean {
  if (value.length < 3 || value.length > 60) {
    return false;
  }

  const hasNumericSignal = /\d/.test(value);
  const hasStructuredToken = /[A-Z0-9]+[-/_.][A-Z0-9]+/i.test(value);

  if ((!hasNumericSignal && !hasStructuredToken) || /[.!?]/.test(value)) {
    return false;
  }

  const lowercaseWords = value
    .split(/\s+/)
    .filter((token) => /^[a-z]{3,}$/u.test(token));

  return lowercaseWords.length <= 1;
}

function sanitizeKenmerkCandidate(value: string): string | null {
  const cleaned = sanitizeKenmerk(trimAtStructuredFieldBoundary(value));
  if (!looksLikeKenmerk(cleaned)) {
    return null;
  }

  return cleaned;
}

function extractDateCandidate(value: string): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const patterns = [
    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i,
    new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTH_NAME_PATTERN})\\s+\\d{4})\\b`, "i"),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return normalizeExtractedDate(match[1]);
    }
  }

  return null;
}

function extractDateFromText(text: string): string | null {
  const lines = splitIntoNormalizedLines(text);
  const contextualLinePattern =
    /^(datum(?:\s+van\s+het\s+besluit|\s+besluit|\s+beschikking|\s+brief)?|dagtekening)\s*[:\-]?\s*(.+)$/i;

  for (const line of lines) {
    const match = line.match(contextualLinePattern);
    if (!match?.[2]) {
      continue;
    }

    const candidate = extractDateCandidate(match[2]);
    if (candidate) {
      return candidate;
    }
  }

  const normalized = normalizeWhitespace(text);
  const contextualPatterns = [
    new RegExp(
      "(?:datum(?:\\s+van\\s+het\\s+besluit|\\s+besluit|\\s+beschikking|\\s+brief)?|dagtekening)\\s*[:\\-]?\\s*(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})",
      "i"
    ),
    new RegExp(
      `(?:datum(?:\\s+van\\s+het\\s+besluit|\\s+besluit|\\s+beschikking|\\s+brief)?|dagtekening)\\s*[:\\-]?\\s*(\\d{1,2}\\s+(?:${MONTH_NAME_PATTERN})\\s+\\d{4})`,
      "i"
    ),
  ];

  for (const pattern of contextualPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return normalizeExtractedDate(match[1]);
    }
  }

  return extractDateCandidate(normalized);
}

function extractKenmerkFromText(text: string): string | null {
  const lines = splitIntoNormalizedLines(text);
  const linePattern =
    /^(kenmerk|ons kenmerk|zaaknummer|zaaknr\.?|dossiernummer|referentie)\s*[:\-]?\s*(.+)$/i;

  for (const line of lines) {
    const match = line.match(linePattern);
    if (!match?.[2]) {
      continue;
    }

    const candidate = sanitizeKenmerkCandidate(match[2]);
    if (candidate) {
      return candidate;
    }
  }

  const normalized = normalizeWhitespace(text);
  const boundaryPattern = new RegExp(
    `(?:kenmerk|ons kenmerk|zaaknummer|zaaknr\\.?|dossiernummer|referentie)\\s*[:\\-]?\\s*(.{2,80}?)(?=\\s+(?:${STRUCTURED_FIELD_STOP_LABELS.map((label) => escapeRegExp(label)).join("|")})\\b|$)`,
    "i"
  );
  const match = normalized.match(boundaryPattern);
  if (!match?.[1]) {
    return null;
  }

  return sanitizeKenmerkCandidate(match[1]);
}

function normalizePdfJsExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, " ")
    .replace(/\b(?:[\p{L}\d]\s+){2,}[\p{L}\d]\b/gu, (match) => match.replace(/\s+/g, ""))
    .replace(/\b([\p{L}])\s+([\p{Ll}]{4,})\b/gu, "$1$2")
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function estimateReadability(extractedText: string): DecisionReadability {
  if (extractedText.length >= 1200) {
    return "high";
  }
  if (extractedText.length >= 180) {
    return "medium";
  }
  return "low";
}

function determineAnalysisStatus(extractedText: string): DecisionAnalysisStatus {
  if (extractedText.length >= 500) {
    return "read";
  }
  if (extractedText.length >= 80) {
    return "partial";
  }
  return "failed";
}

export async function extractTextFromPdfInBrowser(file: File): Promise<ClientPdfExtractionResult> {
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
  if (!browserPdfWorkerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    browserPdfWorkerConfigured = true;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    verbosity: pdfjsLib.VerbosityLevel?.ERRORS,
  } as Record<string, unknown>).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  const extractedText = normalizePdfJsExtractedText(pageTexts.join("\n\n"));
  return {
    extractedText,
    datumBesluit: extractDateFromText(extractedText),
    kenmerk: extractKenmerkFromText(extractedText),
    analysisStatus: determineAnalysisStatus(extractedText),
    readability: estimateReadability(extractedText),
  };
}
