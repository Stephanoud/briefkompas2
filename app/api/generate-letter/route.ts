import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { IntakeFormData, Flow, Product } from "@/types";
import { getReferences } from "@/src/data/references";
import { ReferenceItem } from "@/src/types/references";

export const runtime = "nodejs";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function generateBezwaarPrompt(
  data: IntakeFormData,
  product: Product,
  referencesBlock: string
): string {
  return `Je bent een juridisch assistent. Genereer een professioneel bezwaarschrift op basis van deze gegevens:

Bestuursorgaan: ${data.bestuursorgaan}
Datum besluit: ${data.datumBesluit}
Kenmerk/zaaknummer: ${data.kenmerk || "niet opgegeven"}
Soort besluit: ${data.categorie}
Doel van bezwaar: ${data.doel}
Gronden: ${data.gronden}
Persoonlijke omstandigheden: ${data.persoonlijkeOmstandigheden || "geen"}

Genereer een formeel bezwaarschrift met deze onderdelen:
1. AFZENDER (placeholder: [Jouw naam], [Adres], [Woonplaats])
2. BESTUURSORGAAN ([naam en adres])
3. BETREFT
4. INLEIDING
5. FEITEN
6. GRONDEN VOOR BEZWAAR
7. VERZOEK
8. SLOTWOORD

${ 
  product === "uitgebreid"
    ? "Voeg ook een sectie toe: BIJLAGEN - met een overzicht van meegestuurde documenten."
    : ""
}

${referencesBlock}

Voeg onderaan toe: "Dit is een conceptbrief. Controleer alle gegevens zorgvuldig voordat verzending. BriefKompas.nl geeft geen juridisch advies."

Zorg dat de brief professioneel, duidelijk en zonder juridische jargon wordt opgesteld.`;
}

function generateWooPrompt(data: IntakeFormData, referencesBlock: string): string {
  return `Je bent een juridisch assistent. Genereer een professioneel WOO-verzoek op basis van deze gegevens:

Bestuursorgaan: ${data.bestuursorgaan}
Onderwerp: ${data.wooOnderwerp}
Periode: ${data.wooPeriode}
Documenten: ${data.wooDocumenten}
Digitale verstrekking gevraagd: ${data.digitaleVerstrekking ? "ja" : "nee"}
Spoedeisend: ${data.spoed ? "ja" : "nee"}

Genereer een formeel WOO-verzoek met deze onderdelen:
1. AFZENDER (placeholder: [Jouw naam], [Adres], [Woonplaats])
2. BESTUURSORGAAN ([naam en adres])
3. VERZOEK OM INFORMATIE ONDER DE WOO
4. BESCHRIJVING
5. PERIODE EN DOCUMENTEN
6. ${data.digitaleVerstrekking ? "VERZOEK DIGITALE VERSTREKKING" : "VERSTREKKING"}
7. ${data.spoed ? "SPOEDEISEND BELANG" : ""}
8. SLOTWOORD

${referencesBlock}

Voeg onderaan toe: "Dit is een conceptbrief. Controleer alles zorgvuldig voordat verzending. BriefKompas.nl geeft geen juridisch advies."

Zorg dat het verzoek professioneel, duidelijk en zonder juridische jargon wordt opgesteld.`;
}

function detectOrgType(value?: string): ReferenceItem["orgType"] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("gemeente")) return "gemeente";
  if (normalized.includes("provincie")) return "provincie";
  if (normalized.includes("waterschap")) return "waterschap";
  if (normalized.includes("ministerie") || normalized.includes("rijk") || normalized.includes("belastingdienst")) {
    return "rijk";
  }
  return "overig";
}

function buildReferenceKeywords(data: IntakeFormData, flow: Flow): string[] {
  const rawText =
    flow === "woo"
      ? [data.bestuursorgaan, data.wooOnderwerp, data.wooDocumenten, data.wooPeriode].join(" ")
      : [data.bestuursorgaan, data.categorie, data.doel, data.gronden].join(" ");

  return rawText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 3);
}

function formatReferencesForPrompt(references: ReferenceItem[]): string {
  if (!references.length) return "";

  const lines = references.map((reference, index) => {
    const ecliPart = reference.ecli ? ` (${reference.ecli})` : "";
    return `${index + 1}. ${reference.title}${ecliPart} | topic: ${reference.topic} | toepasregel: ${reference.principle}`;
  });

  return [
    "Gebruik indien relevant onderstaande bronnen ter onderbouwing. Noem ECLI's alleen als je ze daadwerkelijk gebruikt.",
    ...lines,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY ontbreekt op de server." },
        { status: 500 }
      );
    }

    const { intakeData, product, flow } = await req.json() as {
      intakeData: IntakeFormData;
      product: Product;
      flow: Flow;
    };

    if (!intakeData || !product || !flow) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const references = getReferences({
      flow,
      orgType: detectOrgType(intakeData.bestuursorgaan),
      decisionType: flow === "bezwaar" ? intakeData.categorie : undefined,
      keywords: buildReferenceKeywords(intakeData, flow),
      limit: 6,
    });

    const referencesBlock = formatReferencesForPrompt(references);

    const prompt =
      flow === "bezwaar"
        ? generateBezwaarPrompt(intakeData, product, referencesBlock)
        : generateWooPrompt(intakeData, referencesBlock);

    const message = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Je bent een juridische assistent die helpt bij het opstellen van formele brieven. Je schrijft helder, professioneel en begrijpelijk Nederlands.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const letterText =
      message.choices[0]?.message?.content ||
      "Fout bij het genereren van de brief";

    return NextResponse.json({
      letter: {
        letterText,
        references,
      },
    });
  } catch (error) {
    console.error("Error generating letter:", error);
    return NextResponse.json(
      { error: "Failed to generate letter" },
      { status: 500 }
    );
  }
}
