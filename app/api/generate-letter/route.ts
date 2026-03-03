import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { IntakeFormData, Flow, Product } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function generateBezwaarPrompt(
  data: IntakeFormData,
  product: Product
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

Voeg onderaan toe: "Dit is een conceptbrief. Controleer alle gegevens zorgvuldig voordat verzending. BriefKompas.nl geeft geen juridisch advies."

Zorg dat de brief professioneel, duidelijk en zonder juridische jargon wordt opgesteld.`;
}

function generateWooPrompt(data: IntakeFormData): string {
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

Voeg onderaan toe: "Dit is een conceptbrief. Controleer alles zorgvuldig voordat verzending. BriefKompas.nl geeft geen juridisch advies."

Zorg dat het verzoek professioneel, duidelijk en zonder juridische jargon wordt opgesteld.`;
}

export async function POST(req: NextRequest) {
  try {
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

    const prompt =
      flow === "bezwaar"
        ? generateBezwaarPrompt(intakeData, product)
        : generateWooPrompt(intakeData);

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
        references: [],
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
