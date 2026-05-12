const answerSuggestionsByStepId: Record<string, string[]> = {
  categorie: ["boete", "uitkering", "belasting", "vergunning", "overig"],
  doel: [
    "intrekken",
    "herzien",
    "aanpassen",
    "matigen",
    "kwijtschelden",
    "uitstel van betaling",
    "opschorten",
    "vernietigen",
  ],
  gronden: [
    "Feiten in het besluit kloppen niet.",
    "Neem mee dat onderzoek, metingen of bewijs ontbreken.",
    "Neem mee dat geluidsnormen of meetgegevens onvoldoende zijn onderbouwd.",
    "Het besluit houdt onvoldoende rekening met mijn persoonlijke situatie.",
    "De gevolgen van dit besluit zijn voor mij onevenredig zwaar.",
    "Belangrijke informatie of stukken zijn niet meegewogen.",
    "Het besluit is te algemeen of onvoldoende gemotiveerd.",
    "Controleer of relevante jurisprudentie over motivering of evenredigheid past.",
    "Ik ben niet (goed) gehoord voordat het besluit is genomen.",
  ],
  digitale_verstrekking: ["ja", "nee"],
  spoed: ["ja", "nee"],
};

export const grondenSuggestionOptions = answerSuggestionsByStepId.gronden;

export function getAnswerSuggestions(stepId: string | undefined, input: string, maxResults = 8): string[] {
  if (!stepId) return [];

  const options = answerSuggestionsByStepId[stepId] ?? [];
  if (!options.length) return [];

  const query = input.trim().toLowerCase();
  if (!query) {
    return options.slice(0, maxResults);
  }

  return options
    .filter((option) => option.toLowerCase().includes(query))
    .slice(0, maxResults);
}
