import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Flow, IntakeFormData, Product } from "@/types";
import { getReferences } from "@/src/data/references";
import { ReferenceItem } from "@/src/types/references";
import { generateLetter } from "@/lib/ai/generateLetter";
import { buildLetterPrompt } from "@/lib/ai/buildLetterPrompt";
import { classifyCase } from "@/lib/intake/classifyCase";
import { determineRoute } from "@/lib/intake/determineRoute";
import { getMissingRequiredFields } from "@/lib/intake/requiredFields";
import { GenerationGuardResult, PromptPayload } from "@/lib/legal/types";
import { loadSourceSet } from "@/lib/sources/loadSourceSet";
import { validateAuthorities } from "@/lib/sources/validateAuthorities";
import { validateSourceSet } from "@/lib/sources/validateSourceSet";

export const runtime = "nodejs";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function sanitize(value?: string): string {
  return (value ?? "onbekend").trim() || "onbekend";
}

function detectOrgType(value?: string): ReferenceItem["orgType"] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("gemeente")) return "gemeente";
  if (normalized.includes("provincie")) return "provincie";
  if (normalized.includes("waterschap")) return "waterschap";
  if (normalized.includes("ministerie") || normalized.includes("rijk") || normalized.includes("belastingdienst")) {
    return "rijk";
  }
  return "overig";
}

function buildReferenceKeywords(data: IntakeFormData, flow: Flow): string[] {
  const decisionSignals = [
    data.besluitDocumentType,
    data.besluitSamenvatting,
    data.besluitAnalyse?.onderwerp,
    data.besluitAnalyse?.rechtsgrond,
    data.besluitAnalyse?.besluitInhoud,
    ...(data.besluitAnalyse?.aandachtspunten ?? []),
  ];

  const rawText =
    flow === "woo"
      ? [data.bestuursorgaan, data.wooOnderwerp, data.wooDocumenten, data.wooPeriode].join(" ")
      : [
          data.bestuursorgaan,
          data.categorie,
          data.doel,
          data.gronden,
          ...decisionSignals,
        ].join(" ");

  return rawText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 3);
}

function getDecisionStatusLabel(data: IntakeFormData): string {
  if (data.besluitAnalyseStatus === "read") {
    return "besluit gelezen";
  }
  if (data.besluitAnalyseStatus === "partial") {
    return "besluit deels gelezen";
  }
  return "alleen intake gebruikt";
}

function buildCaseFacts(data: IntakeFormData, flow: Flow): string[] {
  if (flow === "woo") {
    return [
      `Bestuursorgaan: ${data.bestuursorgaan}`,
      `Onderwerp: ${data.wooOnderwerp ?? "onbekend"}`,
      `Periode: ${data.wooPeriode ?? "onbekend"}`,
      `Documentsoorten: ${data.wooDocumenten ?? "onbekend"}`,
      `Digitale verstrekking gevraagd: ${data.digitaleVerstrekking ? "ja" : "nee"}`,
      `Spoed: ${data.spoed ? "ja" : "nee"}`,
    ];
  }

  const caseFacts = [
    `Bestuursorgaan: ${data.bestuursorgaan}`,
    `Datum besluit: ${data.datumBesluit ?? "onbekend"}`,
    `Kenmerk: ${data.kenmerk ?? "onbekend"}`,
    `Categorie: ${data.categorie ?? "onbekend"}`,
    `Doel: ${data.doel ?? "onbekend"}`,
    `Gronden uit intake: ${data.gronden ?? "onbekend"}`,
    `Persoonlijke omstandigheden: ${data.persoonlijkeOmstandigheden ?? "geen"}`,
    `Status besluituitlezing: ${getDecisionStatusLabel(data)}`,
    `Leeskwaliteit besluitbestand: ${data.besluitLeeskwaliteit ?? "onbekend"}`,
  ];

  if (data.besluitDocumentType) {
    caseFacts.push(`Documenttype besluit: ${data.besluitDocumentType}`);
  }

  if (data.besluitSamenvatting) {
    caseFacts.push(`Samenvatting van besluit: ${data.besluitSamenvatting}`);
  }

  if (data.besluitAnalyse?.bestuursorgaan) {
    caseFacts.push(`Bestuursorgaan uit besluit: ${data.besluitAnalyse.bestuursorgaan}`);
  }

  if (data.besluitAnalyse?.onderwerp) {
    caseFacts.push(`Onderwerp uit besluit: ${data.besluitAnalyse.onderwerp}`);
  }

  if (data.besluitAnalyse?.rechtsgrond) {
    caseFacts.push(`Rechtsgrond uit besluit: ${data.besluitAnalyse.rechtsgrond}`);
  }

  if (data.besluitAnalyse?.besluitInhoud) {
    caseFacts.push(`Kern van het besluit: ${data.besluitAnalyse.besluitInhoud}`);
  }

  if (data.besluitAnalyse?.termijnen) {
    caseFacts.push(`Zichtbare termijn: ${data.besluitAnalyse.termijnen}`);
  }

  if (data.besluitAnalyse?.aandachtspunten?.length) {
    caseFacts.push(`Aandachtspunten uit besluit: ${data.besluitAnalyse.aandachtspunten.join("; ")}`);
  }

  if (data.besluitTekst) {
    caseFacts.push(`Tekstfragment uit besluit: ${data.besluitTekst.slice(0, 2500)}`);
  }

  return caseFacts;
}

function buildSafeFallbackLetter(params: {
  flow: Flow;
  intakeData: IntakeFormData;
}): string {
  const { flow, intakeData } = params;

  if (flow === "woo") {
    return [
      "[Jouw naam]",
      "[Jouw adres]",
      "[Postcode en woonplaats]",
      "[E-mailadres]",
      "[Telefoonnummer]",
      "",
      "Aan:",
      `${intakeData.bestuursorgaan}`,
      "[Adres bestuursorgaan]",
      "[Postcode en plaats]",
      "",
      "Betreft: Woo-verzoek",
      "Datum: [vandaag invullen]",
      "",
      "Geacht bestuursorgaan,",
      "",
      "Hierbij verzoek ik op grond van de Wet open overheid om openbaarmaking van documenten over het volgende onderwerp.",
      "",
      `${intakeData.wooOnderwerp ?? "[onderwerp invullen]"}`,
      "",
      `Periode: ${intakeData.wooPeriode ?? "[periode invullen]"}`,
      `Gevraagde documenten: ${intakeData.wooDocumenten ?? "[documentsoorten invullen]"}`,
      "",
      "Ik verzoek u de documenten, waar mogelijk, digitaal te verstrekken en de ontvangst van dit verzoek te bevestigen.",
      "",
      "Hoogachtend,",
      "",
      "[Jouw naam]",
      "",
      "Dit is een conceptbrief. Controleer alle gegevens zorgvuldig voor verzending. BriefKompas.nl geeft geen juridisch advies.",
    ].join("\n");
  }

  const subject = intakeData.besluitDocumentType
    ? `Bezwaarschrift tegen ${intakeData.besluitDocumentType}`
    : "Bezwaarschrift";

  return [
    "[Jouw naam]",
    "[Jouw adres]",
    "[Postcode en woonplaats]",
    "[E-mailadres]",
    "[Telefoonnummer]",
    "",
    "Aan:",
    `${intakeData.bestuursorgaan}`,
    "[Adres bestuursorgaan]",
    "[Postcode en plaats]",
    "",
    `Betreft: ${subject}`,
    `Kenmerk: ${intakeData.kenmerk ?? "[kenmerk invullen]"}`,
    `Datum besluit: ${intakeData.datumBesluit ?? "[datum invullen]"}`,
    "Datum: [vandaag invullen]",
    "",
    "Geacht bestuursorgaan,",
    "",
    "Hierbij maak ik bezwaar tegen het hierboven genoemde besluit.",
    "",
    "Feiten en besluit",
    `Volgens mijn gegevens betreft het een ${intakeData.categorie ?? "bestuursrechtelijk"} besluit van ${intakeData.bestuursorgaan}.`,
    intakeData.besluitSamenvatting
      ? intakeData.besluitSamenvatting
      : "De precieze inhoud van het bestreden besluit moet nog nader worden gecontroleerd aan de hand van het besluit zelf.",
    "",
    "Gronden van bezwaar",
    `Ik ben het niet eens met het besluit omdat ${sanitize(intakeData.gronden)}.`,
    "Ik verzoek u het besluit opnieuw en volledig te beoordelen en daarbij ook mijn persoonlijke belangen mee te wegen.",
    "",
    "Verzoek",
    `Ik verzoek u het besluit te ${sanitize(intakeData.doel)} of daarvoor een nieuw besluit in de plaats te stellen.`,
    "",
    "Slot",
    "Ik verzoek u mij in de gelegenheid te stellen mijn bezwaar zo nodig nader toe te lichten tijdens een hoorzitting.",
    "",
    "Hoogachtend,",
    "",
    "[Jouw naam]",
    "",
    "Dit is een conceptbrief. Controleer alle gegevens zorgvuldig voor verzending. BriefKompas.nl geeft geen juridisch advies.",
  ].join("\n");
}

function buildGuardResult(params: {
  intakeData: IntakeFormData;
  flow: Flow;
  references: ReferenceItem[];
}): GenerationGuardResult {
  const { intakeData, flow, references } = params;
  const classification = classifyCase({ flow, intakeData });
  const routing = determineRoute({ caseType: classification.caseType, intakeData });
  const sourceSet = loadSourceSet(classification.caseType, routing.route);
  const sourceSetValidation = validateSourceSet(sourceSet);
  const missingFields = getMissingRequiredFields(flow, intakeData);

  const authorityValidation = sourceSet
    ? validateAuthorities({ references, sourceSet })
    : { allowedAuthorities: [], rejectedAuthorities: [], auditTrail: ["No source set available for authority validation."] };

  const softSignals: string[] = [];
  const hardBlockers: string[] = [];

  if (classification.caseType === "onzeker_handmatige_triage" || classification.confidence < 0.7) {
    softSignals.push("case_type_uncertain");
  }

  if (routing.route === "handmatige_triage" || routing.confidence < 0.6) {
    softSignals.push("route_uncertain");
  }

  if (!sourceSetValidation.ok) {
    hardBlockers.push(...sourceSetValidation.reasons);
  }

  if (!sourceSet) {
    hardBlockers.push("missing_source_set");
  }

  if (missingFields.length > 0) {
    hardBlockers.push("missing_required_intake_fields");
  }

  const auditTrail = [
    `Classified caseType=${classification.caseType} confidence=${classification.confidence.toFixed(2)}`,
    `Determined route=${routing.route} confidence=${routing.confidence.toFixed(2)}`,
    sourceSet ? `Loaded source set: ${sourceSet.caseType}/${sourceSet.route}` : "No source set loaded",
    ...authorityValidation.auditTrail,
  ];

  const generationMode =
    hardBlockers.length > 0
      ? "static_fallback"
      : softSignals.length > 0
        ? "safe_generic_ai"
        : "validated";

  return {
    ok: generationMode === "validated",
    fallbackMode: generationMode === "static_fallback" ? "safe_generic" : "none",
    generationMode,
    reasons: [...softSignals, ...hardBlockers],
    hardBlockers,
    softSignals,
    missingFields,
    caseType: classification.caseType,
    route: routing.route,
    caseTypeConfidence: classification.confidence,
    routeConfidence: routing.confidence,
    selectedSourceSet: sourceSet ?? undefined,
    rejectedSources: [
      ...sourceSetValidation.rejectedSources,
      ...authorityValidation.rejectedAuthorities.map((authority) => authority.id),
    ],
    validatedAuthorities: authorityValidation.allowedAuthorities,
    auditTrail,
  };
}

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY ontbreekt op de server." },
        { status: 500 }
      );
    }

    const { intakeData, product, flow } = (await req.json()) as {
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

    const references = getReferences({
      flow,
      orgType: detectOrgType(intakeData.bestuursorgaan),
      decisionType: flow === "bezwaar" ? intakeData.categorie : undefined,
      keywords: buildReferenceKeywords(intakeData, flow),
      limit: 6,
    });

    const guard = buildGuardResult({ intakeData, flow, references });

    if (guard.generationMode === "static_fallback" || !guard.selectedSourceSet) {
      const fallbackLetter = buildSafeFallbackLetter({
        flow,
        intakeData,
      });

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: [] as ReferenceItem[],
          generationMode: "static_fallback" as const,
          guardReasons: guard.reasons,
        },
        guard,
      });
    }

    const payload: PromptPayload = {
      flow,
      caseType: guard.caseType,
      route: guard.route,
      caseFacts: buildCaseFacts(intakeData, flow),
      decisionMeta: [
        `CaseType: ${guard.caseType}`,
        `Route: ${guard.route}`,
        `CaseType confidence: ${guard.caseTypeConfidence.toFixed(2)}`,
        `Route confidence: ${guard.routeConfidence.toFixed(2)}`,
        `Generation mode: ${guard.generationMode}`,
        `Decision extraction status: ${intakeData.besluitAnalyseStatus ?? "failed"}`,
        `Decision readability: ${intakeData.besluitLeeskwaliteit ?? "unknown"}`,
        `Guard reasons: ${guard.reasons.length > 0 ? guard.reasons.join(", ") : "none"}`,
      ],
      decisionAnalysis: intakeData.besluitAnalyse ?? null,
      decisionAnalysisStatus: intakeData.besluitAnalyseStatus ?? "failed",
      decisionReadability: intakeData.besluitLeeskwaliteit ?? null,
      selectedSources: guard.selectedSourceSet.primarySources,
      validatedAuthorities: guard.validatedAuthorities,
      disallowedBehaviors: [
        "Geen nieuwe bronnen buiten selectedSources/validatedAuthorities.",
        "Geen ECLI's zonder validatie.",
        "Geen wetsartikelen of sectorspecifieke rechtsgronden op basis van aannames.",
        "Geen stellige juridische conclusie zonder feitelijke basis in intake of besluitanalyse.",
      ],
    };

    if (guard.generationMode === "safe_generic_ai") {
      payload.disallowedBehaviors.push(
        "Veilige modus actief: baseer je op algemene Awb-grondslagen en expliciet uit het besluit blijkende gegevens, zonder sectorspecifieke details te raden."
      );
    }

    const prompt = buildLetterPrompt({
      intakeData,
      product,
      payload,
    });

    const letterText = await generateLetter(openai, prompt);

    if (!letterText.trim()) {
      const fallbackLetter = buildSafeFallbackLetter({
        flow,
        intakeData,
      });

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: guard.validatedAuthorities,
          generationMode: "static_fallback" as const,
          guardReasons: [...guard.reasons, "empty_generation_output"],
        },
        guard: {
          ...guard,
          ok: false,
          fallbackMode: "safe_generic",
          generationMode: "static_fallback" as const,
          reasons: [...guard.reasons, "empty_generation_output"],
          hardBlockers: [...guard.hardBlockers, "empty_generation_output"],
        },
      });
    }

    return NextResponse.json({
      letter: {
        letterText,
        references: guard.validatedAuthorities,
        generationMode: guard.generationMode,
        guardReasons: guard.reasons,
      },
      guard,
    });
  } catch (error) {
    console.error("Error generating letter:", error);
    return NextResponse.json(
      { error: "Failed to generate letter" },
      { status: 500 }
    );
  }
}
