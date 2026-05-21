import { Product, IntakeFormData } from "@/types";
import { PromptPayload } from "@/lib/legal/types";

function sanitize(value?: string | null): string {
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
    payload.caseType === "niet_tijdig_beslissen"
      ? [
          "Afzender met placeholders",
          "Adresblok bevoegde rechtbank",
          "Betreft en datumregel",
          "Inleiding beroep wegens niet tijdig beslissen",
          "Procesverloop met aanvraag of bezwaar, beslistermijn en ingebrekestelling",
          "Toelichting waarom beroep openstaat",
          "Verzoek om een beslistermijn op te leggen voor zover dat uit het dossier volgt",
          "Slotformule",
        ]
      : payload.flow === "woo"
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
                "Samenvatting van het geschil met korte subparagrafen",
                "Gronden van bezwaar",
                "Verzoek",
                "Slotformule",
              ];

  const promptPayload = {
    caseFacts: payload.caseFacts,
    decisionMeta: payload.decisionMeta,
    caseAnalysis: payload.caseAnalysis,
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
      verifiedHolding: item.verifiedHolding ?? null,
      sourceUrl: item.sourceUrl,
      sourceType: item.sourceType,
      verificationStatus: item.verificationStatus,
      officialTitle: item.officialTitle,
      courtName: item.courtName,
      decisionDate: item.decisionDate,
      coreConsiderationRead: item.coreConsiderationRead,
      factualSimilarity: item.factualSimilarity,
      factualSimilarityAssessed: item.factualSimilarityAssessed,
      helpsUserOrAuthority: item.helpsUserOrAuthority,
      distinguishable: item.distinguishable,
      useInLetter: item.useInLetter,
      selectionReason: item.selectionReason,
      valueAddScore: item.valueAddScore,
    })),
    disallowedBehaviors: payload.disallowedBehaviors,
  };

  const decisionStatusInstruction =
    payload.decisionAnalysisStatus === "read"
      ? "Gebruik de besluitanalyse en de geextraheerde feiten actief in de brief en verwerk deze herkenbaar."
      : payload.decisionAnalysisStatus === "partial"
        ? "Gebruik de besluitanalyse waar die betrouwbaar is, maar formuleer voorzichtig bij onderdelen die niet volledig uit het besluit blijken."
        : "Het besluit is beperkt uitgelezen. Gebruik de aangevulde kerngegevens en de intake, maar verzin geen details uit het besluit.";

  const bezwaarGeschilSamenvattingInstructions =
    payload.flow === "bezwaar"
      ? [
          "",
          "Samenvatting van het geschil bij bezwaar (verplicht, geen bijlage):",
          "- Voeg na de inleiding en voor de gronden een gewone briefsectie toe met exact het kopje: SAMENVATTING VAN HET GESCHIL.",
          "- Noem deze sectie nooit 'bijlage', 'dossierbijlage', 'bijlage A' of 'dossieroverzicht'. Het is onderdeel van de brief zelf.",
          "- Gebruik onder dit kopje korte subparagrafen met precies deze volgorde waar er concrete inhoud voor is: Bestreden besluit, Feiten en context, Kern van het geschil, Belangen en gevolgen, Gewenste oplossing, Relevante stukken.",
          "- Schrijf per subparagraaf 1 tot 3 korte zinnen of maximaal 3 compacte bullets. Het doel is dat het bestuursorgaan het geschil binnen 30 seconden begrijpt.",
          "- Vat het geschil daadwerkelijk samen: wat is besloten, welke feiten/context zijn relevant, waar zijn partijen het over oneens, welk belang of gevolg speelt en welke oplossing wordt gevraagd.",
          "- Houd feiten, context, bezwaren, belangen/gevolgen en bewijs zichtbaar gescheiden. Dit volgt de kwaliteitslijn van begrijpelijke, probleemgerichte bezwaarafhandeling en de lessen van Marseille en collega's: eerst het conflict en het burgerperspectief helder maken, daarna juridisch uitwerken.",
          "- Zet juridische argumenten niet in een aparte bijlage. Werk ze na de samenvatting uit onder Gronden van bezwaar, per bezwaargrond met een korte titel en compacte toelichting.",
          "- Gebruik onder Relevante stukken alleen bewijsstukken of documenten die daadwerkelijk blijken uit intake, besluitanalyse of gekoppelde bestanden. Als er geen concrete stukken zijn, laat deze subparagraaf weg.",
          "- Presenteer interpretaties nooit als vaststaande feiten en verzin geen bijlagen, geen bronnen en geen bewijsstukken.",
          "- Koppel bewijs waar mogelijk aan de relevante feiten of bezwaren, maar maak de samenvatting niet langer dan nodig.",
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
          "- Is de samenvatting van het geschil een gewone briefsectie en geen bijlage?",
          "- Zijn geen fictieve elementen of niet-bestaande bijlagen toegevoegd?",
          "- Helpt de samenvatting de behandelaar om sneller te begrijpen wat er feitelijk, juridisch en persoonlijk op het spel staat?",
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
    "- Als de zaak deels onzeker is maar de basisinformatie aanwezig is, ga dan verder met relevante, voorzichtige extrapolaties uit de intake en het besluit in plaats van een kale basisbrief te maken.",
    "- Benoem aannames niet als vaststaand feit in de brief; formuleer ze voorzichtig en dossiergedragen.",
    "- Lever een schone, verzendklare brieftekst die direct bruikbaar is in e-mail of PDF zonder nabewerking.",
    "",
    "Interne werkvolgorde (niet uitschrijven in de output):",
    "- Fase 1 documentanalyse: lees metadata, dragende overwegingen, wettelijke grondslagen, procedurele aanwijzingen en verwijzingen uit de meegegeven besluitanalyse.",
    "- Fase 2 zaakclassificatie: gebruik caseAnalysis voor module, procedurefase, kernconflict, procesrisico's en ontbrekende informatie.",
    "- Fase 3 gerichte checkvragen: gebruik alleen de bestaande gerichte checkvragen uit caseAnalysis als interne onzekerheidsmarkering; stel geen nieuwe vragen in de brief.",
    "- Fase 4 jurisprudentie-verificatie: beoordeel eerst of jurisprudentie in deze zaak echt meerwaarde heeft. Gebruik alleen gevalideerde bronnen uit validatedAuthorities en laat rechtspraak weg als die te zwak of onzeker is.",
    "- Fase 5 grondenbouw: bouw alleen gronden die reageren op de dragende motivering uit het besluit of de beslissing op bezwaar.",
    "- Fase 6 outputcontrol: controleer intern op hallucinaties, standaardgronden zonder dossierbasis, ongedekte stelligheid en ontbrekende termijnen of procesdrempels.",
    "- Fase 7 pre-output-checks: loop workflowProfile.pre_output_checks langs voordat je de definitieve tekst geeft.",
    "- Gebruik intern de labelset voor juridische stellingen: letterlijk uit besluit, letterlijk uit wet, volgt uit geverifieerde jurisprudentie, afgeleide interpretatie, gebruikersstelling / nog niet geverifieerd.",
    "",
    "Interne briefstructuur (gebruik dit als opbouw, niet als letterlijke meta-kopjes):",
    structureInstructions.map((line) => `- ${line}`).join("\n"),
    "",
    "Beschikbare intakegegevens:",
    `- Bestuursorgaan: ${sanitize(intakeData.bestuursorgaan)}`,
    `- Datum besluit: ${sanitize(intakeData.datumBesluit)}`,
    `- Kenmerk: ${sanitize(intakeData.kenmerk)}`,
    `- Categorie: ${sanitize(intakeData.categorie)}`,
    `- Onderwerp besluit: ${sanitize(intakeData.besluitOnderwerp ?? intakeData.besluitAnalyse?.onderwerp)}`,
    `- Beslissing of maatregel: ${sanitize(intakeData.beslissingOfMaatregel ?? intakeData.besluitAnalyse?.besluitInhoud)}`,
    `- Belangrijkste reden of motivering: ${sanitize(
      intakeData.belangrijksteMotivering ??
        intakeData.besluitAnalyse?.dragendeOverwegingen?.[0]?.duiding ??
        intakeData.besluitAnalyse?.rechtsgrond
    )}`,
    `- Relevante termijn: ${sanitize(intakeData.relevanteTermijn ?? intakeData.besluitAnalyse?.termijnen)}`,
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
    "- Reageer primair op de dragende overwegingen uit decisionAnalysis.dragendeOverwegingen. Als die ontbreken, wees zichtbaar terughoudend met algemene gronden.",
    "- Bouw geen grond op als je daarvoor geen combinatie hebt van besluitpassage, concreet juridisch probleem en relevant feit of bewijs uit intake of bijlagen.",
    "- Gebruik caseAnalysis.labeledStellingen en caseAnalysis.groundsMatrix als interne steunstructuur. Een juridische stelling zonder herleidbaar label mag niet dragend worden gebruikt.",
    "- Gebruik caseAnalysis.relevanteAanvullendeArgumenten om te beoordelen of zorgvuldigheidsbeginsel, motiveringsbeginsel, evenredigheidsbeginsel, gelijkheidsbeginsel, persoonlijke omstandigheden of financiele impact relevant maar nog onderbenut zijn.",
    "- Neem een aanvullend argument alleen op als caseAnalysis.relevanteAanvullendeArgumenten daar een concrete reden en steunfeit of passage voor geeft. Maak hiervan nooit een generieke checklist.",
    "- Als een aanvullend argument integrationMode=direct heeft, verwerk je het gewoon als onderdeel van de inhoudelijke grond en koppel je het aan het relevante dossierfeit of de relevante besluitpassage.",
    "- Als een aanvullend argument integrationMode=cautious heeft, gebruik je voorzichtige formuleringen zoals 'Daarnaast is van belang dat...' of 'In dit kader had het bestuursorgaan moeten...'.",
    "- Voeg niet automatisch alle zes mogelijke beginselen toe. Gebruik alleen de aanvullende argumenten die logisch passen bij deze specifieke zaak.",
    "- Bij niet tijdig beslissen mag je alleen een beroepschrift schrijven als uit het dossier blijkt dat de beslistermijn is verstreken, een ingebrekestelling is verzonden en ontvangen, en het bestuursorgaan daarna nog niet heeft beslist.",
    "- Een gebruikersstelling of nog niet geverifieerde stelling mag feitelijk worden genoemd, maar niet als zelfstandig juridisch anker worden gepresenteerd.",
    "- Gebruik bij zienswijze geen taal alsof er al bezwaar of beroep loopt; schrijf gericht op beinvloeding van het definitieve besluit.",
    "- Neem bij beroep zonder bezwaar altijd een aparte, expliciete paragraaf op over waarom direct beroep mogelijk is.",
    "- Leg bij beroep na bezwaar concreet uit waarom de beslissing op bezwaar de eerder aangevoerde bezwaren niet wegneemt.",
    "- Als caseFacts onderliggende processtukken noemen, betrek die actief bij beroep en beperk je niet tot alleen het besluit of de beslissing op bezwaar.",
    "- Gebruik een eerdere bezwaarbrief of zienswijze alleen voor punten die daadwerkelijk uit intake, bestandsnaam of tekstfragment blijken.",
    "- Gebruik relevante gevalideerde wettelijke grondslagen actief als die in validatedAuthorities staan.",
    "- Gebruik jurisprudentie als kwaliteitsversterker, niet als standaardonderdeel. Als er geen duidelijke meerwaarde is, laat je jurisprudentie weg.",
    "- Noem jurisprudentie uitsluitend wanneer de uitspraak al in validatedAuthorities staat als verified en useInLetter=true. Als er geen gevalideerde jurisprudentie met duidelijke meerwaarde is, noem je geen jurisprudentie.",
    "- Gebruik geen jurisprudentie als ECLI, instantie, datum, geverifieerde kernoverweging of beoordeelde feitelijke vergelijkbaarheid ontbreken.",
    "- Gebruik geen jurisprudentie als validatedAuthorities niet expliciet aangeeft of de uitspraak de gebruiker helpt, de overheid helpt of onderscheidbaar is.",
    "- Als een uitspraak de overheid helpt en validatedAuthorities niet expliciet distinguishable=yes aangeeft, laat je die uitspraak volledig weg.",
    "- Gebruik in een gewone burgerbrief meestal maximaal 1 tot 2 uitspraken en alleen compact gekoppeld aan een concrete grond.",
    "- Gebruik liever geen uitspraak dan een zwakke, generieke of onzekere uitspraak.",
    "- Voeg geen nabrief-secties toe zoals 'Wat de overheid mogelijk zal aanvoeren', 'Hoe u daarop kunt reageren', 'Wat gebeurt hierna?', 'Waar moet u op letten?', 'Als uw bezwaar/beroep wordt afgewezen' of 'Praktische tip'. Die informatie wordt buiten de brief apart in de interface getoond.",
    "- Als in het besluit zelf een rechtsgrond zichtbaar is, mag je die beschrijven, maar verzin geen extra artikelnummer of sectorspecifieke regeling.",
    "- Geen hallucinaties: geen niet-verifieerbare ECLI's, geen nieuwe wetten, geen verzonnen feiten, geen verzonnen termijnen.",
    "- Behandel reactie-, bezwaar- en beroepstermijnen als aandachtspunt, niet als blokkade of definitief ontvankelijkheidsoordeel. Stel niet zelf vast dat de gebruiker te laat is; benoem hooguit voorzichtig wat uit het besluit of de rechtsmiddelenclausule als mogelijke termijn blijkt en dat het bestuursorgaan of de rechtbank ontvankelijkheid beoordeelt.",
    "- Doe bij niet tijdig beslissen niet alsof ingebrekestelling, ontvangst, tweewekentermijn of toepasselijkheid van een dwangsom vaststaan als dat niet expliciet uit dossierinput blijkt.",
    "- Nooit een citaat uit het besluit opnemen tenzij die passage letterlijk of bijna letterlijk in decisionAnalysis.dragendeOverwegingen of andere dossierinput staat.",
    "- Noem geen hoorzitting, geen eerdere correspondentie en geen procescontacten tenzij die expliciet uit intake, besluitanalyse of bijlagen blijken.",
    "- Ken de gebruiker geen rol of status toe zoals belanghebbende, vergunninghouder, verzoeker, appellant of bezwaarmaker tenzij dat uit de stukken blijkt.",
    "- Gebruik gegevens over procespositie of belanghebbendheid niet als zelfstandig inhoudelijk argument in de brief, behalve als het besluit zelf daarover gaat of de gebruiker dit expliciet als grond aanvoert. Twijfel over procespositie hoort alleen in het nabrief-aandachtsblok.",
    "- Gebruik geen formuleringen als 'vaste jurisprudentie' of 'bestendige jurisprudentie' zonder een of meer geverifieerde uitspraken in validatedAuthorities.",
    "- Als documentsignalen of caseAnalysis twijfel geven over de module, neem geen sectorspecifieke module-aannames over en blijf bij veilige, dossiergedragen formuleringen.",
    "- Als caseAnalysis.onzekerheden of caseAnalysis.ontbrekendeInformatie wijzen op gaten, formuleer voorzichtig en presenteer aannames nooit als vaststaand.",
    "- Laat generieke standaardgronden weg als ze niet duidelijk aansluiten op besluitpassage, dossierfeit of procedurele fout.",
    "- Schrijf niet simpelweg 'het besluit is onzorgvuldig voorbereid' zonder het concrete onderzoeksgebrek meteen te benoemen.",
    "- Schrijf niet simpelweg 'het besluit is ondeugdelijk gemotiveerd' zonder een aanwijsbare passage, overweging of concrete motiveringsstap uit het besluit te noemen.",
    "- Schrijf niet simpelweg 'het besluit is in strijd met artikel 3:4 Awb' zonder zowel het concrete nadeel voor de gebruiker als de ontbrekende of scheve belangenafweging uit te leggen.",
    "- Schrijf niet simpelweg 'de volledige heroverweging ontbreekt' zonder te specificeren welke bezwaargronden, argumenten of onderdelen niet zijn heroverwogen.",
    "- Controleer voor verzendingstekst expliciet of er zichtbare termijnen, hoorverplichtingen of andere procesdrempels in het dossier zitten en benoem die alleen als ze blijken uit de input.",
    "- Als besluituitlezing beperkt is, wees daar intern zorgvuldig mee: schrijf niet alsof je iets zeker weet terwijl dat niet uit intake of besluit blijkt.",
    bezwaarGeschilSamenvattingInstructions,
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
