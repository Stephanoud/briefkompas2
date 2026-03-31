import { NextRequest, NextResponse } from "next/server";
import { Flow, GeneratedLetter, IntakeFormData, Product } from "@/types";
import { buildSavedLetterDocumentPayload, buildSavedLetterResearchPayload } from "@/lib/saved-letters/payload";
import {
  getSavedLetterStorageMode,
  SAVED_LETTER_STORAGE_UNAVAILABLE_MESSAGE,
  saveLetterRecord,
} from "@/lib/saved-letters/store";
import { isFlow } from "@/lib/flow";

export const runtime = "nodejs";

type SaveLetterRequestBody = {
  flow?: Flow;
  product?: Product | null;
  intakeData?: IntakeFormData;
  generatedLetter?: GeneratedLetter;
  manualReferences?: string;
  consentStorage?: boolean;
  consentResearch?: boolean;
};

function isProduct(value: unknown): value is Product {
  return value === "basis" || value === "uitgebreid";
}

function hasValidGeneratedLetter(value: unknown): value is GeneratedLetter {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as GeneratedLetter).letterText === "string" &&
    (value as GeneratedLetter).letterText.trim().length > 0
  );
}

export async function GET() {
  const storageMode = getSavedLetterStorageMode();

  return NextResponse.json({
    available: storageMode !== "unavailable",
    storageMode,
    message: storageMode === "unavailable" ? SAVED_LETTER_STORAGE_UNAVAILABLE_MESSAGE : null,
  });
}

export async function POST(request: NextRequest) {
  let body: SaveLetterRequestBody;

  try {
    body = (await request.json()) as SaveLetterRequestBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (!body.consentStorage) {
    return NextResponse.json(
      { error: "Tijdelijke opslag mag alleen na expliciete toestemming." },
      { status: 400 }
    );
  }

  if (!isFlow(body.flow) || !body.intakeData || !hasValidGeneratedLetter(body.generatedLetter)) {
    return NextResponse.json(
      { error: "De brief of intakegegevens ontbreken voor tijdelijke opslag." },
      { status: 400 }
    );
  }

  const product = isProduct(body.product) ? body.product : null;
  const manualReferences = typeof body.manualReferences === "string" ? body.manualReferences : "";
  const documentPayload = buildSavedLetterDocumentPayload({
    flow: body.flow,
    product,
    intakeData: body.intakeData,
    generatedLetter: body.generatedLetter,
    manualReferences,
  });
  const researchPayload = body.consentResearch
    ? buildSavedLetterResearchPayload({
        flow: body.flow,
        product,
        intakeData: body.intakeData,
        generatedLetter: body.generatedLetter,
        manualReferences,
      })
    : null;

  try {
    const saved = await saveLetterRecord({
      documentPayload,
      generatedLetter: body.generatedLetter.letterText,
      researchPayload,
      consentResearch: Boolean(body.consentResearch),
    });
    const recoveryUrl = new URL(`/recover/${saved.recoveryToken}`, request.url).toString();

    return NextResponse.json({
      ok: true,
      recoveryUrl,
      expiresAt: saved.expiresAt,
    });
  } catch (error) {
    console.error("Failed to save letter", error);
    const message =
      error instanceof Error && error.message ? error.message : "Het opslaan van de brief is niet gelukt.";
    const status = message === SAVED_LETTER_STORAGE_UNAVAILABLE_MESSAGE ? 503 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
