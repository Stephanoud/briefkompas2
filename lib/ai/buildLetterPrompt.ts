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
  const besluitBestand = intakeData.files?.besluit?.name?.trim() || "geen besluitbestand gekoppeld";
  const extraBijlagen =
    intakeData.files?.bijlagen
      ?.map((file) => file.name.trim())
      .filter(Boolean) ?? [];

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
      : payload.flow === "zienswijze"
        ? [
            "Afzender met placeholders",
            "Adresblok bestuursorgaan",
            "Betreft en datumregel",
            "Inleiding",
            "Beschrijving van het ontwerpbesluit",
            "Belangen van indiener",
            "Zienswijzen en argumenten",
            "Verzoek tot aanpassing",
            "Slotformule",
          ]
        : payload.flow === "beroep_zonder_bezwaar"
          ? [
              "Afzender met placeholders",
              "Adresblok rechtbank",
              "Betreft, kenmerk, datum besluit en datumregel",
              "Inleiding",
              "Waarom direct beroep mogelijk is",
              "Feiten en bestreden besluit",
              "Beroepsgronden",
              "Verzoek",
              "Slotformule",
            ]
          : payload.flow === "beroep_na_bezwaar"
            ? [
                "Afzender met placeholders",
                "Adresblok rechtbank",
                "Betreft, kenmerk, datum beslissing op bezwaar en datumregel",
                "Inleiding",
                "Voorgeschiedenis en bezwaar",
                "Weerlegging van de motivering in de beslissing op bezwaar",
                "Beroepsgronden",
                "Verzoek",
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
                "Daarna een gestructureerde dossierbijlage voor de behandelaar",
              ];

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
      ? "Gebruik de besluitanalyse en de geextraheerde feiten actief in de brief en verwerk deze herkenbaar."
      : payload.decisionAnalysisStatus === "partial"
        ? "Gebruik de besluitanalyse waar die betrouwbaar is, maar formuleer voorzichtig bij onderdelen die niet volledig uit het besluit blijken."
        : "Het besluit is onvoldoende uitgelezen. Verzint geen details uit het besluit en baseer je dan op de intake plus algemene Awb-grondslagen.";

  const bezwaarDossierInstructions =
    payload.flow === "bezwaar"
      ? [
          "",
          "Dossierbijlage bij bezwaar (verplicht):",
          "- Voeg na de slotformule een gestructureerde bijlage toe die functioneert als dossieroverzicht voor de behandelaar.",
          "- Gebruik exact deze kopjes in deze volgorde, volledig in hoofdletters:",
          "- BIJLAGE A - SAMENVATTING VAN HET GESCHIL",
          "- BIJLAGE B - FEITEN EN CONTEXT",
          "- BIJLAGE C - JURIDISCHE BEZWAREN",
          "- BIJLAGE D - OVERZICHT BEWIJSSTUKKEN",
          "- BIJLAGE E - GEWENSTE OPLOSSING",
          "- BIJLAGE A is altijd verplicht en bevat maximaal 8 bullets.",
          "- Neem in BIJLAGE A in elk geval op: bestreden besluit, bestuursorgaan, kern van het geschil, gewenste uitkomst, belangrijkste bezwaren en eventuele impact.",
          "- Schrijf BIJLAGE B feitelijk en neutraal, met tijdlijn, communicatie en context, zonder juridische argumentatie.",
          "- Werk in BIJLAGE C per bezwaargrond een korte titel en een compacte juridische toelichting uit. Categoriseer waar passend als motiveringsgebrek, zorgvuldigheidsbeginsel, evenredigheidsbeginsel, feitelijke onjuistheid, bevoegdheidsgebrek of procedureel gebrek.",
          "- Gebruik in BIJLAGE D alleen bewijsstukken of documenten die daadwerkelijk blijken uit intake, besluitanalyse of gekoppelde bestanden. Maak onderscheid tussen meegezonden stukken en wel genoemde maar niet meegezonden stukken.",
          "- Neem BIJLAGE E alleen op als de gewenste oplossing logisch en concreet uit intake of hoofdbrief volgt.",
          "- Genereer geen lege secties. Als een sectie geen concrete inhoud heeft, laat je die weg, behalve BIJLAGE A. Behoud de vaste volgorde van de secties die je wel opneemt.",
          "- Presenteer interpretaties nooit als vaststaande feiten en verzin geen bijlagen, geen bronnen en geen bewijsstukken.",
          "- Koppel bewijs waar mogelijk aan de relevante feiten of bezwaren.",
        ].join("\n")
      : "";

  const bezwaarQualityCheck =
    payload.flow === "bezwaar"
      ? [
          "",
          "Interne kwaliteitscheck voor bezwaar (niet uitschrijven in de output):",
          "- Is het geschil binnen 30 seconden te begrijpen?",
          "- Is de gewenste uitkomst concreet geformuleerd?",
          "- Zijn feiten, juridische argumenten en bewijs strikt gescheiden?",
          "- Is de tekst scanbaar met korte alineas, bullets en duidelijke kopjes?",
          "- Zijn geen fictieve elementen of niet-bestaande bijlagen toegevoegd?",
          "- Helpt de dossierbijlage de behandelaar om sneller te beoordelen of gericht contact op te nemen?",
          "- Als een van deze vragen negatief uitvalt, herschrijf je de relevante sectie voordat je antwoord geeft.",
        ].join("\n")
      : "";

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
    "- Lever een schone, verzendklare brieftekst die direct bruikbaar is in e-mail of PDF zonder nabewerking.",
    "",
    "Interne briefstructuur (gebruik dit als opbouw, niet als letterlijke meta-kopjes):",
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
    `- Proceduretoelichting: ${sanitize(intakeData.procedureReden)}`,
    `- Eerdere bezwaargronden: ${sanitize(intakeData.eerdereBezwaargronden)}`,
    `- Woo onderwerp: ${sanitize(intakeData.wooOnderwerp)}`,
    `- Woo periode: ${sanitize(intakeData.wooPeriode)}`,
    `- Woo documenten: ${sanitize(intakeData.wooDocumenten)}`,
    `- Besluitbestand: ${besluitBestand}`,
    `- Extra bijlagen: ${extraBijlagen.length > 0 ? extraBijlagen.join(", ") : "geen extra bijlagen gekoppeld"}`,
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
    "- Maak bij bezwaar of beroep eerst een herkenbare samenvatting van het relevante besluit voordat je de gronden uitwerkt.",
    "- Werk de argumenten inhoudelijk uit en koppel feiten aan juridische normen zoals zorgvuldigheid, deugdelijke motivering, evenredigheid en volledige heroverweging, voor zover die passen bij de feiten.",
    "- Gebruik bij zienswijze geen taal alsof er al bezwaar of beroep loopt; schrijf gericht op beinvloeding van het definitieve besluit.",
    "- Neem bij beroep zonder bezwaar altijd een aparte, expliciete paragraaf op over waarom direct beroep mogelijk is.",
    "- Leg bij beroep na bezwaar concreet uit waarom de beslissing op bezwaar de eerder aangevoerde bezwaren niet wegneemt.",
    "- Gebruik relevante gevalideerde wettelijke grondslagen actief als die in validatedAuthorities staan.",
    "- Noem jurisprudentie uitsluitend wanneer de ECLI of uitspraak al in validatedAuthorities staat. Als er geen gevalideerde jurisprudentie is, noem je geen jurisprudentie.",
    "- Als in het besluit zelf een rechtsgrond zichtbaar is, mag je die beschrijven, maar verzin geen extra artikelnummer of sectorspecifieke regeling.",
    "- Geen hallucinaties: geen niet-verifieerbare ECLI's, geen nieuwe wetten, geen verzonnen feiten, geen verzonnen termijnen.",
    "- Als besluituitlezing beperkt is, wees daar intern zorgvuldig mee: schrijf niet alsof je iets zeker weet terwijl dat niet uit intake of besluit blijkt.",
    bezwaarDossierInstructions,
    "",
    "Opmaakregels voor de uitvoer:",
    "- Lever platte tekst op zonder markdowntekens zoals **, #, >, ``` of ---.",
    "- Gebruik gewone kopjes op een eigen regel, gevolgd door lege regels en nette alineas.",
    "- Gebruik bij bezwaar een scanbare combinatie van korte alineas, bullets en genummerde onderdelen waar dat de leesbaarheid vergroot.",
    "- Neem geen waarschuwingen, disclaimers, gebruiksinstructies of platformverwijzingen op in de brief.",
    "- Laat teksten over eigen verantwoordelijkheid, controle voor verzending en geen juridisch advies volledig weg uit de brief.",
    "- Zet meta-kopjes zoals 'Inleiding', 'Aanhef' of 'Slotformule' niet letterlijk in de output, tenzij een kopje inhoudelijk echt deel uitmaakt van een formele brief.",
    bezwaarQualityCheck,
  ].join("\n");
}
