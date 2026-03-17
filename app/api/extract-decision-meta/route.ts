import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import {
  DecisionAnalysisStatus,
  DecisionAnalysisSummary,
  DecisionDocumentSource,
  DecisionExtractionResult,
  DecisionReadability,
} from "@/types";

export const runtime = "nodejs";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_ANALYSIS_MODEL = "gpt-4.1";
const TEXT_ANALYSIS_MODEL = "gpt-4.1-mini";
const MAX_EXTRACTED_TEXT_LENGTH = 6000;
const MAX_ANALYSIS_INPUT_LENGTH = 12000;
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

type LlmDecisionAnalysis = {
  extractedText?: string | null;
  samenvatting?: string | null;
  datumBesluit?: string | null;
  kenmerk?: string | null;
  documentType?: string | null;
  bestuursorgaan?: string | null;
  onderwerp?: string | null;
  rechtsgrond?: string | null;
  besluitInhoud?: string | null;
  termijnen?: string | null;
  aandachtspunten?: string[] | null;
  leeskwaliteit?: DecisionReadability | null;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || isPlaceholderSecret(apiKey)) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function isPlaceholderSecret(value?: string) {
  return !value || value.includes("YOUR_") || value.includes("YOUR-");
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

function trimLength(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function sanitizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized ? trimLength(normalized, maxLength) : null;
}

function sanitizeOptionalList(value: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeOptionalString(item, maxItemLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function sanitizeReadability(value: unknown): DecisionReadability | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return null;
}

function countDecisionFields(analysis?: DecisionAnalysisSummary | null): number {
  if (!analysis) {
    return 0;
  }

  const scalarFields = [
    analysis.bestuursorgaan,
    analysis.onderwerp,
    analysis.rechtsgrond,
    analysis.besluitInhoud,
    analysis.termijnen,
  ].filter(Boolean).length;

  return scalarFields + (analysis.aandachtspunten?.length ?? 0);
}

function estimateReadability(extractedText: string, fieldCount: number): DecisionReadability {
  if (extractedText.length >= 1200 || (extractedText.length >= 600 && fieldCount >= 4)) {
    return "high";
  }
  if (extractedText.length >= 180 || fieldCount >= 2) {
    return "medium";
  }
  return "low";
}

function determineAnalysisStatus(params: {
  extractedText: string;
  decisionAnalysis?: DecisionAnalysisSummary | null;
  readability: DecisionReadability;
}): DecisionAnalysisStatus {
  const { extractedText, decisionAnalysis, readability } = params;
  const fieldCount = countDecisionFields(decisionAnalysis);

  if (
    extractedText.length >= 500 ||
    (readability === "high" && fieldCount >= 3) ||
    (extractedText.length >= 250 && fieldCount >= 2)
  ) {
    return "read";
  }

  if (extractedText.length >= 80 || fieldCount >= 1) {
    return "partial";
  }

  return "failed";
}

function buildQualityWarning(params: {
  analysisStatus: DecisionAnalysisStatus;
  readability: DecisionReadability;
  analysisSource: DecisionDocumentSource;
  openAiUnavailable?: boolean;
}): string | null {
  const { analysisStatus, readability, analysisSource, openAiUnavailable } = params;

  if (openAiUnavailable && analysisSource === "image") {
    return "De afbeelding is opgeslagen, maar automatische beeldanalyse is niet beschikbaar. De brief zal daarom vooral op je intake steunen.";
  }

  if (analysisStatus === "failed") {
    return analysisSource === "pdf"
      ? "Het besluit kon niet voldoende uit de PDF worden gelezen. Gaat het om een scan-PDF, upload dan liever een scherpere foto of een doorzoekbare PDF. Zonder leesbare besluittekst steunt de brief vooral op je intake."
      : "Het besluit kon niet voldoende uit de afbeelding worden gelezen. Upload bij voorkeur een scherpere foto of een doorzoekbare PDF. Zonder leesbare besluittekst steunt de brief vooral op je intake.";
  }

  if (analysisStatus === "partial") {
    return "Het besluit is slechts deels gelezen. Controleer datum, kenmerk en inhoud zorgvuldig en upload zo nodig een scherpere afbeelding of een doorzoekbare PDF.";
  }

  if (readability === "low") {
    return "Het besluit is gelezen, maar de leeskwaliteit was beperkt. Controleer de overgenomen gegevens zorgvuldig.";
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

function sanitizeKenmerk(value: string): string {
  return value
    .replace(/[\s]{2,}/g, " ")
    .replace(/^[\s:;.-]+/, "")
    .replace(/[\s:;.-]+$/, "")
    .trim();
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

function cleanJsonResponse(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function parseJsonResponse(content: string): LlmDecisionAnalysis | null {
  try {
    return JSON.parse(cleanJsonResponse(content)) as LlmDecisionAnalysis;
  } catch {
    return null;
  }
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isSupportedImageFile(file: File): boolean {
  return IMAGE_MIME_TYPES.has(file.type);
}

function buildDecisionAnalysis(analysis?: LlmDecisionAnalysis | null): DecisionAnalysisSummary | null {
  if (!analysis) {
    return null;
  }

  const attentionPoints = sanitizeOptionalList(analysis.aandachtspunten, 4, 220);

  const normalized: DecisionAnalysisSummary = {
    bestuursorgaan: sanitizeOptionalString(analysis.bestuursorgaan, 180),
    onderwerp: sanitizeOptionalString(analysis.onderwerp, 220),
    rechtsgrond: sanitizeOptionalString(analysis.rechtsgrond, 220),
    besluitInhoud: sanitizeOptionalString(analysis.besluitInhoud, 450),
    termijnen: sanitizeOptionalString(analysis.termijnen, 220),
    aandachtspunten: attentionPoints.length > 0 ? attentionPoints : undefined,
  };

  if (countDecisionFields(normalized) === 0) {
    return null;
  }

  return normalized;
}

function mergeAnalyses(
  primary: LlmDecisionAnalysis | null,
  secondary: LlmDecisionAnalysis | null
): LlmDecisionAnalysis | null {
  if (!primary && !secondary) {
    return null;
  }

  const longestExtractedText =
    (primary?.extractedText?.length ?? 0) >= (secondary?.extractedText?.length ?? 0)
      ? primary?.extractedText
      : secondary?.extractedText;

  return {
    extractedText: longestExtractedText ?? primary?.extractedText ?? secondary?.extractedText ?? null,
    samenvatting: primary?.samenvatting ?? secondary?.samenvatting ?? null,
    datumBesluit: primary?.datumBesluit ?? secondary?.datumBesluit ?? null,
    kenmerk: primary?.kenmerk ?? secondary?.kenmerk ?? null,
    documentType: primary?.documentType ?? secondary?.documentType ?? null,
    bestuursorgaan: primary?.bestuursorgaan ?? secondary?.bestuursorgaan ?? null,
    onderwerp: primary?.onderwerp ?? secondary?.onderwerp ?? null,
    rechtsgrond: primary?.rechtsgrond ?? secondary?.rechtsgrond ?? null,
    besluitInhoud: primary?.besluitInhoud ?? secondary?.besluitInhoud ?? null,
    termijnen: primary?.termijnen ?? secondary?.termijnen ?? null,
    aandachtspunten: primary?.aandachtspunten ?? secondary?.aandachtspunten ?? null,
    leeskwaliteit: primary?.leeskwaliteit ?? secondary?.leeskwaliteit ?? null,
  };
}

function shouldRunTargetedImageFallback(analysis: LlmDecisionAnalysis | null): boolean {
  if (!analysis) {
    return true;
  }

  const extractedText = sanitizeOptionalString(analysis.extractedText, MAX_EXTRACTED_TEXT_LENGTH) ?? "";
  const fieldCount = countDecisionFields(buildDecisionAnalysis(analysis));
  return extractedText.length < 140 || fieldCount < 2;
}

async function analyzeDecisionText(openai: OpenAI, extractedText: string): Promise<LlmDecisionAnalysis | null> {
  const content = trimLength(extractedText, MAX_ANALYSIS_INPUT_LENGTH);
  if (!content) {
    return null;
  }

  const completion = await openai.chat.completions.create({
    model: TEXT_ANALYSIS_MODEL,
    temperature: 0,
    max_tokens: 1100,
    messages: [
      {
        role: "system",
        content:
          "Je analyseert Nederlandse overheidsbesluiten. Geef alleen geldige JSON terug. Vul een veld alleen in als het voldoende uit de tekst blijkt. Gebruik null als iets niet betrouwbaar is vast te stellen.",
      },
      {
        role: "user",
        content:
          "Analyseer de volgende besluittekst en geef uitsluitend JSON terug in dit formaat:\n" +
          '{"samenvatting":"...", "datumBesluit":"...", "kenmerk":"...", "documentType":"...", "bestuursorgaan":"...", "onderwerp":"...", "rechtsgrond":"...", "besluitInhoud":"...", "termijnen":"...", "aandachtspunten":["..."], "leeskwaliteit":"high|medium|low"}\n\n' +
          "Regels:\n" +
          "- samenvatting: maximaal 650 tekens.\n" +
          "- documentType: bijvoorbeeld beschikking, boete, aanslag, vergunning of null.\n" +
          "- bestuursorgaan: noem alleen als het expliciet uit de tekst blijkt.\n" +
          "- onderwerp: korte omschrijving van waar het besluit over gaat.\n" +
          "- rechtsgrond: alleen invullen als wet of regeling expliciet zichtbaar is.\n" +
          "- besluitInhoud: kern van wat is besloten, maximaal 350 tekens.\n" +
          "- termijnen: alleen als een bezwaar-, betaal- of hersteltermijn zichtbaar is.\n" +
          "- aandachtspunten: maximaal 4 korte punten met potentieel relevante kwesties of onzekerheden.\n" +
          "- leeskwaliteit: high, medium of low.\n" +
          "- Geen markdown, geen code fences, alleen JSON.\n\n" +
          `Tekst:\n${content}`,
      },
    ],
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (typeof responseContent !== "string") {
    return null;
  }

  return parseJsonResponse(responseContent);
}

async function extractFromImageWithOpenAI(
  openai: OpenAI,
  file: File,
  buffer: Buffer
): Promise<LlmDecisionAnalysis | null> {
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  const completion = await openai.chat.completions.create({
    model: IMAGE_ANALYSIS_MODEL,
    temperature: 0,
    max_tokens: 2200,
    messages: [
      {
        role: "system",
        content:
          "Je leest afbeeldingen van Nederlandse overheidsbesluiten. Geef alleen geldige JSON terug. Gebruik null als iets niet betrouwbaar zichtbaar is.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Lees deze afbeelding van een besluit en geef uitsluitend JSON terug in dit formaat:\n" +
              '{"extractedText":"...", "samenvatting":"...", "datumBesluit":"...", "kenmerk":"...", "documentType":"...", "bestuursorgaan":"...", "onderwerp":"...", "rechtsgrond":"...", "besluitInhoud":"...", "termijnen":"...", "aandachtspunten":["..."], "leeskwaliteit":"high|medium|low"}\n\n' +
              "Regels:\n" +
              "- extractedText: relevante zichtbare tekst in leesvolgorde, maximaal 6000 tekens.\n" +
              "- samenvatting: maximaal 650 tekens.\n" +
              "- besluitInhoud: kern van wat zichtbaar is besloten, maximaal 350 tekens.\n" +
              "- rechtsgrond en termijnen alleen invullen als die zichtbaar zijn.\n" +
              "- aandachtspunten: maximaal 4 korte punten.\n" +
              "- Geen markdown, geen code fences, alleen JSON.",
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (typeof responseContent !== "string") {
    return null;
  }

  return parseJsonResponse(responseContent);
}

async function extractKeyFieldsFromImageWithOpenAI(
  openai: OpenAI,
  file: File,
  buffer: Buffer
): Promise<LlmDecisionAnalysis | null> {
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  const completion = await openai.chat.completions.create({
    model: IMAGE_ANALYSIS_MODEL,
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "Je haalt kerngegevens uit moeilijk leesbare afbeeldingen van Nederlandse overheidsbesluiten. Geef alleen geldige JSON terug.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "De afbeelding kan deels onleesbaar zijn. Bepaal toch zo betrouwbaar mogelijk de kerngegevens en geef alleen JSON terug in dit formaat:\n" +
              '{"datumBesluit":"...", "kenmerk":"...", "documentType":"...", "bestuursorgaan":"...", "onderwerp":"...", "rechtsgrond":"...", "besluitInhoud":"...", "termijnen":"...", "aandachtspunten":["..."], "leeskwaliteit":"high|medium|low"}\n\n' +
              "Regels:\n" +
              "- Vul alleen gegevens in die echt zichtbaar of sterk afleidbaar zijn.\n" +
              "- Laat twijfelgevallen leeg met null.\n" +
              "- aandachtspunten: maximaal 4 korte punten.\n" +
              "- Geen markdown, geen code fences, alleen JSON.",
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (typeof responseContent !== "string") {
    return null;
  }

  return parseJsonResponse(responseContent);
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return parsed.text ?? "";
  } finally {
    await parser.destroy();
  }
}

function buildResponse(params: {
  extractedText: string;
  samenvatting?: string | null;
  datumBesluit?: string | null;
  kenmerk?: string | null;
  analysisSource: DecisionDocumentSource;
  documentType?: string | null;
  decisionAnalysis?: DecisionAnalysisSummary | null;
  analysisStatus: DecisionAnalysisStatus;
  readability: DecisionReadability;
  warning?: string | null;
}): DecisionExtractionResult {
  const extractedText = trimLength(params.extractedText, MAX_EXTRACTED_TEXT_LENGTH);

  return {
    datumBesluit: params.datumBesluit ?? null,
    kenmerk: params.kenmerk ?? null,
    samenvatting: params.samenvatting ? trimLength(params.samenvatting, 650) : null,
    extractedText: extractedText || null,
    analysisSource: params.analysisSource,
    documentType: params.documentType ? trimLength(params.documentType, 120) : null,
    decisionAnalysis: params.decisionAnalysis ?? null,
    analysisStatus: params.analysisStatus,
    readability: params.readability,
    extracted:
      Boolean(extractedText) ||
      Boolean(params.decisionAnalysis) ||
      Boolean(params.datumBesluit) ||
      Boolean(params.kenmerk) ||
      Boolean(params.samenvatting),
    warning: params.warning ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!isPdfFile(file) && !isSupportedImageFile(file)) {
      return NextResponse.json(
        { error: "Only PDF, JPG, PNG and WEBP files are supported" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const openai = getOpenAIClient();

    if (isPdfFile(file)) {
      const extractedText = await extractTextFromPdf(buffer);
      const fallbackDate = extractDateFromText(extractedText);
      const fallbackKenmerk = extractKenmerkFromText(extractedText);

      let analysis: LlmDecisionAnalysis | null = null;
      let warning: string | null = null;

      if (openai && extractedText.trim()) {
        try {
          analysis = await analyzeDecisionText(openai, extractedText);
        } catch (error) {
          console.error("Failed to analyze PDF decision text", error);
          warning =
            "De tekst van de PDF is gelezen, maar de besluitanalyse bleef beperkt. Controleer de kerngegevens handmatig.";
        }
      }

      const decisionAnalysis = buildDecisionAnalysis(analysis);
      const readability =
        sanitizeReadability(analysis?.leeskwaliteit) ??
        estimateReadability(extractedText, countDecisionFields(decisionAnalysis));
      const analysisStatus = determineAnalysisStatus({
        extractedText,
        decisionAnalysis,
        readability,
      });

      const finalWarning =
        warning ??
        buildQualityWarning({
          analysisStatus,
          readability,
          analysisSource: "pdf",
        });

      return NextResponse.json(
        buildResponse({
          extractedText,
          samenvatting: sanitizeOptionalString(analysis?.samenvatting, 650),
          datumBesluit: sanitizeOptionalString(analysis?.datumBesluit, 120) ?? fallbackDate,
          kenmerk: sanitizeOptionalString(analysis?.kenmerk, 120) ?? fallbackKenmerk,
          analysisSource: "pdf",
          documentType: sanitizeOptionalString(analysis?.documentType, 120),
          decisionAnalysis,
          analysisStatus,
          readability,
          warning: extractedText.trim()
            ? finalWarning
            : buildQualityWarning({
                analysisStatus: "failed",
                readability: "low",
                analysisSource: "pdf",
              }),
        })
      );
    }

    if (!openai) {
      return NextResponse.json(
        buildResponse({
          extractedText: "",
          samenvatting: null,
          datumBesluit: null,
          kenmerk: null,
          analysisSource: "image",
          documentType: null,
          decisionAnalysis: null,
          analysisStatus: "failed",
          readability: "low",
          warning: buildQualityWarning({
            analysisStatus: "failed",
            readability: "low",
            analysisSource: "image",
            openAiUnavailable: true,
          }),
        })
      );
    }

    try {
      const primaryAnalysis = await extractFromImageWithOpenAI(openai, file, buffer);
      let mergedAnalysis = primaryAnalysis;

      if (shouldRunTargetedImageFallback(primaryAnalysis)) {
        try {
          const fallbackAnalysis = await extractKeyFieldsFromImageWithOpenAI(openai, file, buffer);
          mergedAnalysis = mergeAnalyses(primaryAnalysis, fallbackAnalysis);
        } catch (fallbackError) {
          console.error("Failed targeted image fallback analysis", fallbackError);
        }
      }

      const extractedText = sanitizeOptionalString(mergedAnalysis?.extractedText, MAX_EXTRACTED_TEXT_LENGTH) ?? "";
      const decisionAnalysis = buildDecisionAnalysis(mergedAnalysis);
      const readability =
        sanitizeReadability(mergedAnalysis?.leeskwaliteit) ??
        estimateReadability(extractedText, countDecisionFields(decisionAnalysis));
      const analysisStatus = determineAnalysisStatus({
        extractedText,
        decisionAnalysis,
        readability,
      });

      return NextResponse.json(
        buildResponse({
          extractedText,
          samenvatting: sanitizeOptionalString(mergedAnalysis?.samenvatting, 650),
          datumBesluit:
            sanitizeOptionalString(mergedAnalysis?.datumBesluit, 120) ?? extractDateFromText(extractedText),
          kenmerk:
            sanitizeOptionalString(mergedAnalysis?.kenmerk, 120) ?? extractKenmerkFromText(extractedText),
          analysisSource: "image",
          documentType: sanitizeOptionalString(mergedAnalysis?.documentType, 120),
          decisionAnalysis,
          analysisStatus,
          readability,
          warning: buildQualityWarning({
            analysisStatus,
            readability,
            analysisSource: "image",
          }),
        })
      );
    } catch (error) {
      console.error("Failed to analyze decision image", error);
      return NextResponse.json(
        buildResponse({
          extractedText: "",
          samenvatting: null,
          datumBesluit: null,
          kenmerk: null,
          analysisSource: "image",
          documentType: null,
          decisionAnalysis: null,
          analysisStatus: "failed",
          readability: "low",
          warning: buildQualityWarning({
            analysisStatus: "failed",
            readability: "low",
            analysisSource: "image",
          }),
        })
      );
    }
  } catch (error) {
    console.error("Failed to extract decision metadata", error);
    return NextResponse.json(
      { error: "Could not extract decision metadata" },
      { status: 500 }
    );
  }
}
