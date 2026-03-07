import OpenAI from "openai";

export async function generateLetter(openai: OpenAI, prompt: string): Promise<string> {
  const message = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "Je bent een juridische assistent voor formele Nederlandse brieven. Je volgt strikt de meegegeven bronnen en verzint geen jurisprudentie, wetten of feiten.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 2000,
    temperature: 0.2,
  });

  return message.choices[0]?.message?.content ?? "";
}
