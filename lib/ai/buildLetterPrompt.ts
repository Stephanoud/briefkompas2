import { Product, IntakeFormData } from "@/types";
import { PromptPayload } from "@/lib/legal/types";

function sanitize(value?: string): string {
  return (value ?? "onbekend").trim() || "onbekend";
}

export function buildLetterPrompt(params: {
  intakeData: IntakeFormData;
  product: Product;
  payload: PromptPayload;
}): string {
  const { intakeData, product, payload } = params;

  const structureInstructions =
    payload.flow === "woo"
      ? [
          "1. AFZENDER (placeholders)",
          "2. BESTUURSORGAAN",
          "3. VERZOEK ONDER DE WOO",
          "4. FEITELIJKE OMSCHRIJVING",
          "5. PERIODE EN DOCUMENTEN",
          "6. SLOT EN VERZOEK OM ONTVANGSTBEVESTIGING",
        ]
      : [
          "1. AFZENDER (placeholders)",
          "2. BESTUURSORGAAN",
          "3. BETREFT",
          "4. FEITEN EN BESLUIT",
          "5. BEZWAARGRONDEN",
          "6. VERZOEK",
          "7. SLOT",
        ];

  if (payload.flow === "bezwaar" && product === "uitgebreid") {
    structureInstructions.push("8. BIJLAGENOVERZICHT");
  }

  const promptPayload = {
    caseFacts: payload.caseFacts,
    decisionMeta: payload.decisionMeta,
    selectedSources: payload.selectedSources,
    validatedAuthorities: payload.validatedAuthorities.map((item) => ({
      title: item.title,
      ecli: item.ecli,
      topic: item.topic,
      principle: item.principle,
      sourceUrl: item.sourceUrl,
    })),
    disallowedBehaviors: payload.disallowedBehaviors,
  };

  return [
    "Je bent een strikte juridische schrijfassistent voor Nederlandse bezwaar- en Woo-brieven.",
    "Gebruik alleen de aangeleverde data en bronnen.",
    "",
    `Zaaktype: ${payload.caseType}`,
    `Route: ${payload.route}`,
    `Product: ${product}`,
    "",
    "Verplichte briefstructuur:",
    structureInstructions.map((line) => `- ${line}`).join("\n"),
    "",
    "Beschikbare intakegegevens:",
    `- Bestuursorgaan: ${sanitize(intakeData.bestuursorgaan)}`,
    `- Datum besluit: ${sanitize(intakeData.datumBesluit)}`,
    `- Kenmerk: ${sanitize(intakeData.kenmerk)}`,
    `- Categorie: ${sanitize(intakeData.categorie)}`,
    `- Doel: ${sanitize(intakeData.doel)}`,
    `- Gronden: ${sanitize(intakeData.gronden)}`,
    `- Persoonlijke omstandigheden: ${sanitize(intakeData.persoonlijkeOmstandigheden)}`,
    `- Woo onderwerp: ${sanitize(intakeData.wooOnderwerp)}`,
    `- Woo periode: ${sanitize(intakeData.wooPeriode)}`,
    `- Woo documenten: ${sanitize(intakeData.wooDocumenten)}`,
    `- Digitale verstrekking: ${intakeData.digitaleVerstrekking ? "ja" : "nee"}`,
    `- Spoed: ${intakeData.spoed ? "ja" : "nee"}`,
    "",
    "Gestructureerde promptinput (bindend):",
    JSON.stringify(promptPayload, null, 2),
    "",
    "Uitvoerregels:",
    "- Verwijs uitsluitend naar gevalideerde bronnen in validatedAuthorities.",
    "- Voeg geen nieuwe bronnen, ECLI's of wetsartikelen toe.",
    "- Als er geen gevalideerde jurisprudentie is, noem je geen jurisprudentie.",
    "- Houd feit, bron, argument en verzoek duidelijk gescheiden.",
    "- Voeg onderaan toe: 'Dit is een conceptbrief. Controleer alle gegevens zorgvuldig voor verzending. BriefKompas.nl geeft geen juridisch advies.'",
  ].join("\n");
}
