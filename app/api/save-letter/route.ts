import { NextRequest, NextResponse } from "next/server";

import {
  buildSavedLetterDocumentPayload,
  buildSavedLetterResearchPayload,
} from "@/lib/saved-letters/payload";
import { saveLetterRecord } from "@/lib/saved-letters/store";
import type { SaveLetterResponse } from "@/lib/temporaryLetterStorageTypes";
import { cleanLetterTextForDelivery } from "@/lib/letter-format";
import { isFlow } from "@/lib/flow";
import type { GeneratedLetter, IntakeFormData, Product } from "@/types";

export const runtime = "nodejs";

type SaveLetterRequestBody = {
  content?: unknown;
  flow?: unknown;
  product?: unknown;
  intakeData?: unknown;
  generatedLetter?: unknown;
  manualReferences?: unknown;
  consentResearch?: unknown;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Het tijdelijk opslaan van de brief is mislukt.";
}

export async function POST(request: NextRequest) {
  let body: SaveLetterRequestBody;

  try {
    body = (await request.json()) as SaveLetterRequestBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const rawContent = typeof body.content === "string" ? body.content : "";
  const content = cleanLetterTextForDelivery(rawContent);
  if (!content.trim()) {
    return NextResponse.json({ error: "De briefinhoud mag niet leeg zijn." }, { status: 400 });
  }

  const flow = typeof body.flow === "string" && isFlow(body.flow) ? body.flow : null;
  if (!flow) {
    return NextResponse.json({ error: "Het traject ontbreekt of is ongeldig." }, { status: 400 });
  }

  const product: Product | null =
    body.product === "basis" || body.product === "uitgebreid" ? body.product : null;
  const intakeData =
    body.intakeData && typeof body.intakeData === "object"
      ? (body.intakeData as IntakeFormData)
      : null;
  const generatedLetter =
    body.generatedLetter &&
    typeof body.generatedLetter === "object" &&
    typeof (body.generatedLetter as GeneratedLetter).letterText === "string"
      ? ({
          ...(body.generatedLetter as GeneratedLetter),
          letterText: content,
        } satisfies GeneratedLetter)
      : null;
  const manualReferences =
    typeof body.manualReferences === "string" ? body.manualReferences : "";
  const consentResearch = body.consentResearch === true;

  if (!intakeData || !generatedLetter) {
    return NextResponse.json(
      { error: "De gegevens voor tijdelijke opslag zijn onvolledig." },
      { status: 400 }
    );
  }

  try {
    const documentPayload = buildSavedLetterDocumentPayload({
      flow,
      product,
      intakeData,
      generatedLetter,
      manualReferences,
    });
    const researchPayload = consentResearch
      ? buildSavedLetterResearchPayload({
          flow,
          product,
          intakeData,
          generatedLetter,
          manualReferences,
        })
      : null;
    const result = await saveLetterRecord({
      documentPayload,
      generatedLetter: content,
      researchPayload,
      consentResearch,
    });

    const response: SaveLetterResponse = {
      id: result.id,
      access_token: result.recoveryToken,
      expires_at: result.expiresAt,
      restoreUrl: `/recover/${result.recoveryToken}`,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to save letter", error);

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
