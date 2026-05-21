import OpenAI from "openai";
import { Flow, GeneratedLetterSupportSection, IntakeFormData } from "@/types";
import { PromptPayload } from "@/lib/legal/types";

const MAX_ITEMS_PER_SECTION = 3;
const MAX_ITEM_LENGTH = 260;

const SUPPORT_TITLES_BY_FLOW: Record<Flow, string[]> = {
  bezwaar: [
    "Wat de overheid mogelijk zal aanvoeren",
    "Hoe u daarop kunt reageren",
    "Wat gebeurt hierna?",
    "Waar moet u op letten?",
    "Als uw bezwaar wordt afgewezen",
    "Praktische tip",
  ],
  beroep_zonder_bezwaar: [
    "Wat de overheid mogelijk zal aanvoeren",
    "Hoe u daarop kunt reageren",
    "Wat gebeurt hierna?",
    "Waar moet u op letten?",
    "Als uw beroep wordt afgewezen",
    "Praktische tip",
  ],
  beroep_na_bezwaar: [
    "Wat de overheid mogelijk zal aanvoeren",
    "Hoe u daarop kunt reageren",
    "Wat gebeurt hierna?",
    "Waar moet u op letten?",
    "Als uw beroep wordt afgewezen",
    "Praktische tip",
  ],
  zienswijze: [
    "Wat de overheid mogelijk zal aanvoeren",
    "Hoe u daarop kunt reageren",
    "Wat gebeurt hierna?",
    "Waar moet u op letten?",
    "Na het definitieve besluit",
    "Praktische tip",
  ],
  woo: [
    "Wat de overheid mogelijk zal aanvoeren",
    "Hoe u daarop kunt reageren",
    "Wat gebeurt hierna?",
    "Waar moet u op letten?",
    "Als de Woo-reactie ongunstig blijft",
    "Praktische tip",
  ],
};

interface RawSupportSection {
  title?: unknown;
  items?: unknown;
}

interface RawSupportResponse {
  sections?: RawSupportSection[];
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanJsonResponse(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function normalizeTitle(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function parseSupportResponse(content: string): RawSupportResponse | null {
  try {
    return JSON.parse(cleanJsonResponse(content)) as RawSupportResponse;
  } catch {
    return null;
  }
}

function trimItem(value: string): string {
  const cleaned = normalizeWhitespace(
    value
      .replace(/^[-*\u2022\d.)\s]+/, "")
      .replace(/\*\*/g, "")
      .replace(/^["']|["']$/g, "")
  );

  if (cleaned.length <= MAX_ITEM_LENGTH) {
    return cleaned;
  }

  return `${cleaned.slice(0, MAX_ITEM_LENGTH - 1).trimEnd()}.`;
}

function buildValidationContext(intakeData: IntakeFormData, payload?: PromptPayload): string {
  return [
    intakeData.bestuursorgaan,
    intakeData.categorie,
    intakeData.doel,
    intakeData.gronden,
    intakeData.persoonlijkeOmstandigheden,
    intakeData.eerdereBezwaargronden,
    intakeData.waaromBelanghebbende,
    intakeData.besluitDocumentType,
    intakeData.besluitSamenvatting,
    intakeData.besluitOnderwerp,
    intakeData.beslissingOfMaatregel,
    intakeData.belangrijksteMotivering,
    intakeData.relevanteTermijn,
    intakeData.besluitTekst?.slice(0, 4000),
    intakeData.besluitAnalyse?.bestuursorgaan,
    intakeData.besluitAnalyse?.onderwerp,
    intakeData.besluitAnalyse?.rechtsgrond,
    intakeData.besluitAnalyse?.besluitInhoud,
    intakeData.besluitAnalyse?.termijnen,
    intakeData.besluitAnalyse?.rechtsmiddelenclausule,
    ...(intakeData.besluitAnalyse?.aandachtspunten ?? []),
    ...(intakeData.besluitAnalyse?.dragendeOverwegingen ?? []).flatMap((item) => [
      item.passage,
      item.duiding,
    ]),
    ...(intakeData.besluitAnalyse?.wettelijkeGrondslagen ?? []),
    ...(intakeData.besluitAnalyse?.procedureleAanwijzingen ?? []),
    ...(intakeData.besluitAnalyse?.beleidsReferenties ?? []),
    ...(intakeData.besluitAnalyse?.bijlageReferenties ?? []),
    ...(payload?.caseFacts ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasClearProcessPosition(data: IntakeFormData): boolean {
  const positionText = hasText(data.waaromBelanghebbende) ? data.waaromBelanghebbende : "";
  const knownText = [
    positionText,
    data.besluitSamenvatting,
    data.besluitTekst,
    data.gronden,
    data.persoonlijkeOmstandigheden,
    data.eerdereBezwaargronden,
    data.procedureReden,
    data.besluitAnalyse?.besluitInhoud,
    data.besluitAnalyse?.onderwerp,
    ...(data.besluitAnalyse?.procedureleAanwijzingen ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(weet ik niet|onbekend|geen idee|twijfel|onduidelijk|niet zeker)\b/i.test(positionText)) {
    return false;
  }

  return /\b(aanvrager|verzoeker|bezwaarmaker|appellant|eiser|belanghebbende|geadresseerde|aangeschrevene|vergunninghouder|eigenaar|huurder|bewoner|omwonende|buur|ondernemer|bedrijf|uitkering|boete|last opgelegd|mijn aanvraag|mijn vergunning|mijn woning|mijn perceel|mijn bedrijf|mijn inkomen|rechtstreeks|direct geraakt|nabij|naast)\b/.test(
    knownText
  );
}

function isUnsupportedSectorItem(item: string, context: string): boolean {
  const checks = [
    {
      item: /\b(toeslag|toeslagen|kinderopvangtoeslag|zorgtoeslag|huurtoeslag|kindgebonden budget|dienst toeslagen)\b/i,
      context: /\b(toeslag|toeslagen|kinderopvangtoeslag|zorgtoeslag|huurtoeslag|kindgebonden budget|dienst toeslagen)\b/i,
    },
    {
      item: /\b(inspecteur|belastingdienst|aanslag|navorderingsaanslag|naheffingsaanslag|inkomstenbelasting|omzetbelasting|btw|fiscaal)\b/i,
      context: /\b(inspecteur|belastingdienst|aanslag|navorderingsaanslag|naheffingsaanslag|inkomstenbelasting|omzetbelasting|btw|fiscaal)\b/i,
    },
    {
      item: /\b(uwv|ww|wia|wajong|wao|ziektewet)\b/i,
      context: /\b(uwv|ww|wia|wajong|wao|ziektewet)\b/i,
    },
    {
      item: /\b(wmo|pgb|maatwerkvoorziening|zorg in natura|sociaal netwerk)\b/i,
      context: /\b(wmo|pgb|maatwerkvoorziening|zorg in natura|sociaal netwerk)\b/i,
    },
    {
      item: /\b(cjib|wahv|mulder|verkeersboete)\b/i,
      context: /\b(cjib|wahv|mulder|verkeersboete)\b/i,
    },
    {
      item: /\b(de gemeente|het college|burgemeester en wethouders)\b/i,
      context: /\b(gemeente|college|burgemeester en wethouders)\b/i,
    },
  ];

  return checks.some((check) => check.item.test(item) && !check.context.test(context));
}

function isProcedureCompatibleItem(item: string, flow: Flow): boolean {
  const lower = item.toLowerCase();

  if (flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar") {
    if (/\b(bezwaar maken|bezwaarschrift indienen|bezwaar indienen|in bezwaar gaan)\b/.test(lower)) {
      return false;
    }

    if (
      /\b(beroep bij de rechtbank in te stellen|beroep instellen bij de rechtbank|beroep instellen|in beroep gaan|beroepschrift indienen)\b/.test(
        lower
      ) &&
      !/\b(hoger beroep|aanvullende beroepsgronden|verweerschrift|rechtbank vraagt|rechtbank kan)\b/.test(lower)
    ) {
      return false;
    }

    if (/\b(als de reactie op uw bezwaar|reactie op uw bezwaar|uw bezwaar wordt afgewezen)\b/.test(lower)) {
      return false;
    }
  }

  if (flow === "zienswijze" && /\b(uw bezwaar|uw beroep|beroepschrift|bezwaarschrift)\b/.test(lower)) {
    return false;
  }

  if (flow === "bezwaar" && /\b(rechtbank eerst beoordeelt uw beroepschrift|uw beroep ongegrond)\b/.test(lower)) {
    return false;
  }

  return true;
}

function isOldTemplateItem(item: string): boolean {
  return [
    /\brelevante feiten al voldoende in beeld zijn gebracht\b/i,
    /\buitkomst binnen uw eigen verantwoordelijkheid of risicosfeer valt\b/i,
    /\bbewaar de verzendbevestiging, het besluit en alle bijlagen\b/i,
    /\bmaak een korte tijdlijn met de belangrijkste data\b/i,
    /\bcontroleer de mogelijke termijn en datum van bekendmaking\b/i,
    /\bin het algemeen kunt u worden uitgenodigd om uw standpunt mondeling toe te lichten\b/i,
    /\blet op de schriftelijke reactie van het bestuursorgaan\b/i,
  ].some((pattern) => pattern.test(item));
}

function sanitizeItem(params: {
  item: unknown;
  flow: Flow;
  context: string;
}): string | null {
  if (typeof params.item !== "string") {
    return null;
  }

  const cleaned = trimItem(params.item);
  if (cleaned.length < 12) {
    return null;
  }

  if (isOldTemplateItem(cleaned)) {
    return null;
  }

  if (isUnsupportedSectorItem(cleaned, params.context)) {
    return null;
  }

  if (!isProcedureCompatibleItem(cleaned, params.flow)) {
    return null;
  }

  return cleaned;
}

export function getSupportSectionTitles(flow: Flow): string[] {
  return SUPPORT_TITLES_BY_FLOW[flow];
}

export function sanitizeGeneratedSupportSections(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  payload?: PromptPayload;
  sections?: unknown;
}): GeneratedLetterSupportSection[] {
  if (!Array.isArray(params.sections)) {
    return [];
  }

  const allowedTitles = getSupportSectionTitles(params.flow);
  const allowedByNormalizedTitle = new Map(
    allowedTitles.map((title) => [normalizeTitle(title), title])
  );
  const context = buildValidationContext(params.intakeData, params.payload);
  const sectionsByTitle = new Map<string, string[]>();

  for (const section of params.sections as RawSupportSection[]) {
    if (!section || typeof section.title !== "string" || !Array.isArray(section.items)) {
      continue;
    }

    const title = allowedByNormalizedTitle.get(normalizeTitle(section.title));
    if (!title) {
      continue;
    }

    const existing = sectionsByTitle.get(title) ?? [];
    for (const item of section.items) {
      const cleaned = sanitizeItem({ item, flow: params.flow, context });
      if (cleaned && !existing.includes(cleaned)) {
        existing.push(cleaned);
      }
      if (existing.length >= MAX_ITEMS_PER_SECTION) {
        break;
      }
    }

    if (existing.length > 0) {
      sectionsByTitle.set(title, existing);
    }
  }

  return allowedTitles
    .map((title) => {
      const items = sectionsByTitle.get(title) ?? [];
      return items.length > 0 ? { title, items } : null;
    })
    .filter((section): section is GeneratedLetterSupportSection => Boolean(section));
}

function buildCandidateAttentionSignals(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  payload: PromptPayload;
}): string[] {
  const { flow, intakeData, payload } = params;
  const signals: string[] = [];

  if (hasText(intakeData.besluitAnalyse?.rechtsmiddelenclausule)) {
    signals.push(`Mogelijke termijn/processtap uit rechtsmiddelenclausule: ${intakeData.besluitAnalyse.rechtsmiddelenclausule}`);
  } else if (hasText(intakeData.besluitAnalyse?.termijnen) || hasText(intakeData.relevanteTermijn)) {
    signals.push(`Mogelijke termijn uit dossier: ${intakeData.besluitAnalyse?.termijnen ?? intakeData.relevanteTermijn}`);
  }

  if (flow !== "woo" && !hasClearProcessPosition(intakeData)) {
    signals.push(
      "Procespositie/belanghebbendheid is niet scherp uit de intake af te leiden; benoem dit alleen als voorzichtig aandachtspunt als het in deze procedure werkelijk relevant is."
    );
  }

  signals.push(...(intakeData.besluitAnalyse?.aandachtspunten ?? []));
  signals.push(...(payload.caseAnalysis?.primaireProcesrisicos ?? []));
  signals.push(...(payload.caseAnalysis?.onzekerheden ?? []));
  signals.push(...(payload.caseAnalysis?.ontbrekendeInformatie ?? []));

  return signals
    .map((signal) => normalizeWhitespace(signal))
    .filter(Boolean)
    .slice(0, 10);
}

function buildSupportPrompt(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  payload: PromptPayload;
  letterText: string;
}): string {
  const allowedTitles = getSupportSectionTitles(params.flow);
  const candidateAttentionSignals = buildCandidateAttentionSignals(params);
  const compactInput = {
    flow: params.flow,
    caseType: params.payload.caseType,
    route: params.payload.route,
    allowedTitles,
    intake: {
      bestuursorgaan: params.intakeData.bestuursorgaan,
      categorie: params.intakeData.categorie,
      doel: params.intakeData.doel,
      gronden: params.intakeData.gronden,
      persoonlijkeOmstandigheden: params.intakeData.persoonlijkeOmstandigheden,
      waaromBelanghebbende: params.intakeData.waaromBelanghebbende,
      eerdereBezwaargronden: params.intakeData.eerdereBezwaargronden,
    },
    decisionAnalysis: params.payload.decisionAnalysis,
    caseAnalysis: params.payload.caseAnalysis,
    candidateAttentionSignals,
    generatedLetterExcerpt: params.letterText.slice(0, 5000),
  };

  return [
    "Maak een nabrief-aandachtsblok voor de gebruiker. Dit blok wordt niet meegestuurd met de brief.",
    "De kopjes/onderwerpen zijn vast, maar de bullets mogen alleen blijven als ze inhoudelijk passen bij deze concrete zaak.",
    "Geef uitsluitend JSON terug in de vorm: {\"sections\":[{\"title\":\"...\",\"items\":[\"...\"]}]}",
    "",
    "Strikte regels:",
    "- Gebruik alleen de titels uit allowedTitles, exact gespeld.",
    "- Maximaal 3 bullets per titel, liever minder als er weinig concrete basis is.",
    "- Verzin geen sector, bestuursorgaan, processtap, termijn, hoorzitting of vervolgrechtsmiddel.",
    "- Behandel caseType en route als hulpclassificatie; een sectornaam mag alleen worden gebruikt als die ook direct uit intake of decisionAnalysis blijkt.",
    "- Geen generieke templates. Elke bullet moet aansluiten op intake, besluitanalyse, caseAnalysis of de gegenereerde brief.",
    "- Als de zaak over een tracebesluit, infrastructuur, Wft, omgevingsrecht of algemeen bestuursrecht gaat, noem dan geen toeslagen, belasting, Wmo, UWV, CJIB of andere sector die niet in de input staat.",
    "- Wees procedurebewust: bij beroep_zonder_bezwaar en beroep_na_bezwaar loopt de beroepsprocedure al; adviseer dan niet om beroep bij de rechtbank in te stellen.",
    "- Bij zienswijze loopt nog geen bezwaar of beroep; schrijf dus niet alsof er al een bezwaar- of beroepschrift ligt.",
    "- Termijnen en procespositie/belanghebbendheid zijn alleen aandachtspunten, geen harde blokkades of definitieve ontvankelijkheidsoordelen.",
    "- Als een kopje geen concrete, gevalideerde bullet oplevert, laat dat kopje weg.",
    "",
    "Zaakinput:",
    JSON.stringify(compactInput, null, 2),
  ].join("\n");
}

export async function generateAfterLetterSupportSections(
  openai: OpenAI,
  params: {
    flow: Flow;
    intakeData: IntakeFormData;
    payload: PromptPayload;
    letterText: string;
  }
): Promise<GeneratedLetterSupportSection[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "Je bent een Nederlandse bestuursrechtelijke kwaliteitscontroleur. Je maakt alleen zaakgebonden nabrief-aandachtspunten en geeft strikt JSON terug.",
        },
        {
          role: "user",
          content: buildSupportPrompt(params),
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1200,
      temperature: 0.1,
    });

    const parsed = parseSupportResponse(completion.choices[0]?.message?.content ?? "");
    return sanitizeGeneratedSupportSections({
      flow: params.flow,
      intakeData: params.intakeData,
      payload: params.payload,
      sections: parsed?.sections,
    });
  } catch (error) {
    console.error("Failed to generate support sections", error);
    return [];
  }
}
