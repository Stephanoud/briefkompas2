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
          "Afzender met placeholders",
          "Adresblok bestuursorgaan",
          "Betreft-regel",
          "Inleiding",
          "Feitelijke omschrijving van het verzoek",
          "Periode en gevraagde documenten",
          "Verzoek om ontvangstbevestiging en vorm van verstrekking",
          "Slotformule",
        ]
      : [
          "Afzender met placeholders",
          "Adresblok bestuursorgaan",
          "Betreft, kenmerk, datum besluit en datumregel",
          "Inleiding",
          "Feiten en bestreden besluit",
          "Gronden van bezwaar",
          "Verzoek",
          "Slotformule",
        ];

  if (payload.flow === "bezwaar" && product === "uitgebreid") {
    structureInstructions.push("Bijlagenoverzicht als daar een duidelijke aanleiding voor is");
  }

  const promptPayload = {
    caseFacts: payload.caseFacts,
    decisionMeta: payload.decisionMeta,
    decisionAnalysisStatus: payload.decisionAnalysisStatus,
    decisionReadability: payload.decisionReadability,
    decisionAnalysis: payload.decisionAnalysis,
    selectedSources: payload.selectedSources,
    validatedAuthorities: payload.validatedAuthorities.map((item) => ({
      title: item.title,
      citation: item.citation,
      ecli: item.ecli,
      topic: item.topic,
      principle: item.principle,
      sourceUrl: item.sourceUrl,
      sourceType: item.sourceType,
    })),
    disallowedBehaviors: payload.disallowedBehaviors,
  };

  const decisionStatusInstruction =
    payload.decisionAnalysisStatus === "read"
      ? "Gebruik de besluitanalyse en de geëxtraheerde feiten actief in de brief en verwerk deze herkenbaar."
      : payload.decisionAnalysisStatus === "partial"
        ? "Gebruik de besluitanalyse waar die betrouwbaar is, maar formuleer voorzichtig bij onderdelen die niet volledig uit het besluit blijken."
        : "Het besluit is onvoldoende uitgelezen. Verzint geen details uit het besluit en baseer je dan op de intake plus algemene Awb-grondslagen.";

  return [
    "Je bent een senior juridisch schrijver voor Nederlandse bestuursrechtelijke conceptbrieven.",
    "Je schrijft formeel, precies en overtuigend Nederlands.",
    "De brief moet merkbaar verder gaan dan het herhalen van de intake en moet juridisch steviger zijn dan een simpele samenvatting.",
    "",
    `Zaaktype: ${payload.caseType}`,
    `Route: ${payload.route}`,
    `Product: ${product}`,
    "",
    "Doel van de output:",
    "- Stel een serieuze conceptbrief op die eruitziet als een echte formele brief.",
    "- Combineer intakegegevens en besluitanalyse tot een logisch en juridisch samenhangend betoog.",
    "- Werk zelfstandig de meest verdedigbare argumenten uit voor zover ze worden gedragen door intake, besluitanalyse en gevalideerde bronnen.",
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
    `- Gronden uit intake: ${sanitize(intakeData.gronden)}`,
    `- Persoonlijke omstandigheden: ${sanitize(intakeData.persoonlijkeOmstandigheden)}`,
    `- Woo onderwerp: ${sanitize(intakeData.wooOnderwerp)}`,
    `- Woo periode: ${sanitize(intakeData.wooPeriode)}`,
    `- Woo documenten: ${sanitize(intakeData.wooDocumenten)}`,
    `- Digitale verstrekking: ${intakeData.digitaleVerstrekking ? "ja" : "nee"}`,
    `- Spoed: ${intakeData.spoed ? "ja" : "nee"}`,
    "",
    "Besluituitlezing:",
    `- Status: ${payload.decisionAnalysisStatus ?? "failed"}`,
    `- Leeskwaliteit: ${payload.decisionReadability ?? "unknown"}`,
    `- Instructie: ${decisionStatusInstruction}`,
    "",
    "Gestructureerde promptinput (bindend):",
    JSON.stringify(promptPayload, null, 2),
    "",
    "Juridische schrijfregels:",
    "- Maak bij bezwaar een herkenbare samenvatting van het bestreden besluit voordat je de gronden uitwerkt.",
    "- Werk de bezwaargronden inhoudelijk uit en koppel feiten aan juridische normen zoals zorgvuldigheid, deugdelijke motivering, evenredigheid en volledige heroverweging, voor zover die passen bij de feiten.",
    "- Gebruik relevante gevalideerde wettelijke grondslagen actief als die in validatedAuthorities staan.",
    "- Noem jurisprudentie uitsluitend wanneer de ECLI of uitspraak al in validatedAuthorities staat. Als er geen gevalideerde jurisprudentie is, noem je geen jurisprudentie.",
    "- Als in het besluit zelf een rechtsgrond zichtbaar is, mag je die beschrijven, maar verzin geen extra artikelnummer of sectorspecifieke regeling.",
    "- Geen hallucinaties: geen niet-verifieerbare ECLI's, geen nieuwe wetten, geen verzonnen feiten, geen verzonnen termijnen.",
    "- Als besluituitlezing beperkt is, wees daar intern zorgvuldig mee: schrijf niet alsof je iets zeker weet terwijl dat niet uit intake of besluit blijkt.",
    "",
    "Opmaakregels voor de uitvoer:",
    "- Lever platte tekst op zonder markdowntekens zoals **, #, >, ``` of ---.",
    "- Gebruik gewone kopjes op een eigen regel, gevolgd door lege regels en nette alineas.",
    "- Gebruik waar passend genummerde bezwaargronden in lopende formele taal.",
    "- Voeg onderaan exact deze zin toe: Dit is een conceptbrief. Controleer alle gegevens zorgvuldig voor verzending. BriefKompas.nl geeft geen juridisch advies.",
  ].join("\n");
}
