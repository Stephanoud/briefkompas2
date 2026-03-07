import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { DecisionDocumentSource, DecisionExtractionResult } from "@/types";

export const runtime = "nodejs";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ANALYSIS_MODEL = "gpt-4.1-mini";
const MAX_EXTRACTED_TEXT_LENGTH = 6000;
const MAX_ANALYSIS_INPUT_LENGTH = 12000;

type LlmDecisionAnalysis = {
  extractedText?: string | null;
  samenvatting?: string | null;
  datumBesluit?: string | null;
  kenmerk?: string | null;
  documentType?: string | null;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimLength(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function extractDateFromText(text: string): string | null {
  const normalized = normalizeWhitespace(text);

  const contextualPatterns = [
    /(datum(?:\s+van\s+het\s+besluit|\s+besluit|\s+beschikking|\s+brief)?|dagtekening)\s*[:\-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /(datum(?:\s+van\s+het\s+besluit|\s+besluit|\s+beschikking|\s+brief)?|dagtekening)\s*[:\-]?\s*(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i,
  ];

  for (const pattern of contextualPatterns) {
    const match = normalized.match(pattern);
    if (match?.[2]) {
      return match[2].trim();
    }
  }

  const genericPattern =
    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})\b/i;
  const genericMatch = normalized.match(genericPattern);
  return genericMatch?.[1]?.trim() ?? null;
}

function sanitizeKenmerk(value: string): string {
  return value
    .replace(/[\s]{2,}/g, " ")
    .replace(/^[\s:;.-]+/, "")
    .replace(/[\s:;.-]+$/, "")
    .trim();
}

function extractKenmerkFromText(text: string): string | null {
  const normalized = normalizeWhitespace(text);
  const kenmerkPattern =
    /(kenmerk|ons kenmerk|zaaknummer|zaaknr\.?|dossiernummer|referentie)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/_.\s]{2,60})/i;
  const match = normalized.match(kenmerkPattern);
  if (!match?.[2]) {
    return null;
  }

  const cleaned = sanitizeKenmerk(match[2]);
  if (cleaned.length < 3) {
    return null;
  }

  return cleaned;
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

async function summarizeDecisionText(openai: OpenAI, extractedText: string): Promise<LlmDecisionAnalysis | null> {
  const content = trimLength(extractedText, MAX_ANALYSIS_INPUT_LENGTH);
  if (!content) {
    return null;
  }

  const completion = await openai.chat.completions.create({
    model: ANALYSIS_MODEL,
    temperature: 0,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content:
          "Je analyseert Nederlandse overheidsbesluiten. Geef alleen JSON terug met de velden samenvatting, datumBesluit, kenmerk en documentType. Gebruik null als iets niet betrouwbaar vast te stellen is.",
      },
      {
        role: "user",
        content: `Analyseer de volgende tekst van een besluit.\n\nGeef uitsluitend geldige JSON in dit formaat:\n{"samenvatting":"...", "datumBesluit":"...", "kenmerk":"...", "documentType":"..."}\n\nVoorwaarden:\n- samenvatting: maximaal 600 tekens in helder Nederlands.\n- datumBesluit: alleen invullen als expliciet zichtbaar.\n- kenmerk: alleen invullen als expliciet zichtbaar.\n- documentType: bijvoorbeeld beschikking, boete, vergunning, aanslag of null.\n\nTekst:\n${content}`,
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
    model: ANALYSIS_MODEL,
    temperature: 0,
    max_tokens: 1800,
    messages: [
      {
        role: "system",
        content:
          "Je leest foto's van Nederlandse overheidsbesluiten. Geef alleen JSON terug met de velden extractedText, samenvatting, datumBesluit, kenmerk en documentType. Gebruik null als iets niet betrouwbaar zichtbaar is.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Lees deze foto van een besluit. Extraheer de zichtbare tekst en geef uitsluitend geldige JSON terug in dit formaat:\n" +
              '{"extractedText":"...", "samenvatting":"...", "datumBesluit":"...", "kenmerk":"...", "documentType":"..."}\n' +
              "Regels:\n" +
              "- extractedText: de relevante zichtbare tekst in leesvolgorde, maximaal 6000 tekens.\n" +
              "- samenvatting: compacte Nederlandse samenvatting van maximaal 600 tekens.\n" +
              "- datumBesluit en kenmerk alleen invullen als die duidelijk zichtbaar zijn.\n" +
              "- documentType: bijvoorbeeld beschikking, boete, vergunning, aanslag of null.\n" +
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
  warning?: string | null;
}): DecisionExtractionResult {
  const extractedText = trimLength(params.extractedText, MAX_EXTRACTED_TEXT_LENGTH);

  return {
    datumBesluit: params.datumBesluit ?? null,
    kenmerk: params.kenmerk ?? null,
    samenvatting: params.samenvatting ? trimLength(params.samenvatting, 600) : null,
    extractedText: extractedText || null,
    analysisSource: params.analysisSource,
    documentType: params.documentType ? trimLength(params.documentType, 120) : null,
    extracted: Boolean(extractedText || params.datumBesluit || params.kenmerk || params.samenvatting),
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
      const datumBesluit = extractDateFromText(extractedText);
      const kenmerk = extractKenmerkFromText(extractedText);

      let samenvatting: string | null = null;
      let documentType: string | null = null;
      let warning: string | null = null;

      if (openai && extractedText.trim()) {
        try {
          const analysis = await summarizeDecisionText(openai, extractedText);
          samenvatting = analysis?.samenvatting ?? null;
          documentType = analysis?.documentType ?? null;
        } catch (error) {
          console.error("Failed to summarize PDF decision text", error);
          warning = "De PDF is opgeslagen, maar de samenvatting kon niet automatisch worden gemaakt.";
        }
      } else if (!extractedText.trim()) {
        warning = "De PDF bevatte weinig leesbare tekst. Controleer datum en kenmerk handmatig.";
      }

      return NextResponse.json(
        buildResponse({
          extractedText,
          samenvatting,
          datumBesluit,
          kenmerk,
          analysisSource: "pdf",
          documentType,
          warning,
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
          warning:
            "Foto-analyse is op dit moment niet beschikbaar omdat OPENAI_API_KEY ontbreekt op de server.",
        })
      );
    }

    try {
      const imageAnalysis = await extractFromImageWithOpenAI(openai, file, buffer);
      const extractedText = imageAnalysis?.extractedText ?? "";
      const datumBesluit = imageAnalysis?.datumBesluit ?? extractDateFromText(extractedText);
      const kenmerk = imageAnalysis?.kenmerk ?? extractKenmerkFromText(extractedText);

      return NextResponse.json(
        buildResponse({
          extractedText,
          samenvatting: imageAnalysis?.samenvatting ?? null,
          datumBesluit,
          kenmerk,
          analysisSource: "image",
          documentType: imageAnalysis?.documentType ?? null,
          warning: extractedText
            ? null
            : "De foto is ontvangen, maar er kon niet genoeg tekst uit worden gehaald. Maak eventueel een scherpere foto.",
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
          warning:
            "De foto is opgeslagen, maar automatische tekstanalyse is niet gelukt. Probeer eventueel een scherpere foto of upload een PDF.",
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
