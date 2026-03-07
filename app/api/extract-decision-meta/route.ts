import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractDateFromText(text: string): string | null {
  const normalized = normalizeWhitespace(text);

  const contextualPatterns = [
    /(datum(?:\s+van\s+het\s+besluit|\s+besluit|\s+beschikking|\s+brief)?|dagtekening)\s*[:\-]?\s*(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /(datum(?:\s+van\s+het\s+besluit|\s+besluit|\s+beschikking|\s+brief)?|dagtekening)\s*[:\-]?\s*(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i,
  ];

  for (const pattern of contextualPatterns) {
    const match = normalized.match(pattern);
    if (match?.[2]) {
      return match[2].trim();
    }
  }

  const genericPattern = /\b(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})\b/i;
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
    /(kenmerk|ons kenmerk|zaaknummer|zaaknr\.?|dossiernummer|referentie)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_\.\s]{2,60})/i;
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const text = parsed.text ?? "";
    await parser.destroy();

    const datumBesluit = extractDateFromText(text);
    const kenmerk = extractKenmerkFromText(text);

    return NextResponse.json({
      datumBesluit,
      kenmerk,
      extracted: Boolean(datumBesluit || kenmerk),
    });
  } catch (error) {
    console.error("Failed to extract decision metadata", error);
    return NextResponse.json(
      { error: "Could not extract decision metadata" },
      { status: 500 }
    );
  }
}
