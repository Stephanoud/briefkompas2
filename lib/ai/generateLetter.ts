import OpenAI from "openai";
import { sanitizeLetterText } from "@/lib/letter-format";

export async function generateLetter(openai: OpenAI, prompt: string): Promise<string> {
  const message = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content:
          "Je bent een juridisch assistent voor formele Nederlandse bestuursrechtelijke brieven. Je volgt strikt de meegegeven bronnen, verzint geen jurisprudentie, wetten of feiten en levert schone platte tekst zonder markdownartefacten.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 2600,
    temperature: 0.2,
  });

  return sanitizeLetterText(message.choices[0]?.message?.content ?? "");
}
