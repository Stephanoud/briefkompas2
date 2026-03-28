import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildIntakeAssistantFallbackReply,
  IntakeAssistantRequest,
  IntakeAssistantResponse,
} from "@/lib/intake/assistant-guidance";

export const runtime = "nodejs";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_") || apiKey.includes("YOUR-")) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function normalizeReply(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildPrompt(input: IntakeAssistantRequest): string {
  return [
    "Beantwoord de vraag van de gebruiker binnen een lopende BriefKompas-intake.",
    "Regels:",
    "- Antwoord in het Nederlands.",
    "- Maximaal 3 korte zinnen.",
    "- Gebruik alleen de meegegeven context.",
    "- Verzin geen documentinhoud die niet expliciet is uitgelezen.",
    "- Als documentuitlezing onzeker of mislukt is, zeg dat eerlijk.",
    "- Als de gebruiker een verduidelijkingsvraag stelt, beantwoord die direct en vriendelijk.",
    "- Houd in het achterhoofd welke informatie nog ontbreekt voor de intake, maar stel niet meer dan hooguit een zachte brug terug naar die informatie.",
    "",
    `Flow: ${input.flow}`,
    `Reden: ${input.reason}`,
    `Huidige stap: ${input.currentStepId ?? "onbekend"}`,
    `Vraag die nu openstaat: ${input.currentStepQuestion ?? "onbekend"}`,
    `Ontbrekende punten: ${(input.missingFacts ?? []).join(", ") || "geen"}`,
    `Route-uitleg: ${input.routeExplanation ?? "geen"}`,
    `Documentmelding: ${input.documentAnalysisMessage ?? "geen"}`,
    `Al bekende intakegegevens: ${JSON.stringify(input.intakeData)}`,
    `Gebruikersbericht: ${input.userMessage}`,
    "",
    "Geef alleen het uiteindelijke antwoord als platte tekst terug.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  let input: IntakeAssistantRequest;

  try {
    input = (await request.json()) as IntakeAssistantRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const fallbackReply = buildIntakeAssistantFallbackReply(input);
  const openai = getOpenAIClient();

  if (!openai) {
    const response: IntakeAssistantResponse = { reply: fallbackReply };
    return NextResponse.json(response);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "Je bent de BriefKompas intake-assistent. Je helpt een gebruiker tijdens een bestuursrechtelijke intake, beantwoordt verduidelijkingsvragen kort en netjes, en blijft eerlijk over onzekerheid.",
        },
        {
          role: "user",
          content: buildPrompt(input),
        },
      ],
    });

    const reply = normalizeReply(completion.choices[0]?.message?.content);
    const response: IntakeAssistantResponse = {
      reply: reply || fallbackReply,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate intake assistant reply", error);
    const response: IntakeAssistantResponse = { reply: fallbackReply };
    return NextResponse.json(response);
  }
}
