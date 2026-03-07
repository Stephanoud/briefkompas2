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
  const rawText =
    flow === "woo"
      ? [data.bestuursorgaan, data.wooOnderwerp, data.wooDocumenten, data.wooPeriode].join(" ")
      : [data.bestuursorgaan, data.categorie, data.doel, data.gronden].join(" ");

  return rawText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 3);
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
    `Gronden: ${data.gronden ?? "onbekend"}`,
    `Persoonlijke omstandigheden: ${data.persoonlijkeOmstandigheden ?? "geen"}`,
  ];

  if (data.besluitDocumentType) {
    caseFacts.push(`Documenttype besluit: ${data.besluitDocumentType}`);
  }

  if (data.besluitSamenvatting) {
    caseFacts.push(`Samenvatting van besluit: ${data.besluitSamenvatting}`);
  }

  if (data.besluitTekst) {
    caseFacts.push(`Tekstfragment uit besluit: ${data.besluitTekst.slice(0, 1600)}`);
  }

  return caseFacts;
}

function buildSafeFallbackLetter(params: {
  flow: Flow;
  intakeData: IntakeFormData;
  guard: GenerationGuardResult;
}): string {
  const { flow, intakeData, guard } = params;

  const reasonText = guard.reasons.length
    ? `Waarom fallback is gebruikt: ${guard.reasons.join("; ")}.`
    : "Waarom fallback is gebruikt: onvoldoende zekerheid voor specialistische generatie.";

  if (flow === "woo") {
    return [
      "CONCEPT WOO-VERZOEK (VEILIGE FALLBACK)",
      "",
      "[Jouw naam]",
      "[Jouw adres]",
      "[Postcode en woonplaats]",
      "",
      `${intakeData.bestuursorgaan}`,
      "[Adres bestuursorgaan]",
      "",
      "Betreft: Woo-verzoek",
      "",
      "Geacht bestuursorgaan,",
      "",
      "Hierbij verzoek ik op grond van de Wet open overheid om documenten over het volgende onderwerp:",
      `${intakeData.wooOnderwerp ?? "[onderwerp invullen]"}`,
      "",
      `Periode: ${intakeData.wooPeriode ?? "[periode invullen]"}`,
      `Gevraagde documentsoorten: ${intakeData.wooDocumenten ?? "[documentsoorten invullen]"}`,
      "",
      "Ik verzoek om ontvangstbevestiging en, waar mogelijk, digitale verstrekking van de stukken.",
      "",
      "Met vriendelijke groet,",
      "[Jouw naam]",
      "",
      reasonText,
      "Dit is een veilige conceptbrief zonder jurisprudentieverwijzingen. Controleer alle gegevens voor verzending. BriefKompas.nl geeft geen juridisch advies.",
    ].join("\n");
  }

  return [
    "CONCEPT BEZWAARSCHRIFT (VEILIGE FALLBACK)",
    "",
    "[Jouw naam]",
    "[Jouw adres]",
    "[Postcode en woonplaats]",
    "",
    `${intakeData.bestuursorgaan}`,
    "[Adres bestuursorgaan]",
    "",
    "Betreft: Bezwaarschrift",
    "",
    "Geacht bestuursorgaan,",
    "",
    `Hierbij maak ik bezwaar tegen het besluit van ${intakeData.datumBesluit ?? "[datum invullen]"}.`,
    `Kenmerk/zaaknummer: ${intakeData.kenmerk ?? "[kenmerk invullen]"}`,
    "",
    `Doel van bezwaar: ${intakeData.doel ?? "[doel invullen]"}`,
    `Kern van mijn bezwaar: ${intakeData.gronden ?? "[gronden invullen]"}`,
    "",
    "Ik verzoek u mijn bezwaar in behandeling te nemen en het besluit te heroverwegen.",
    "",
    "Met vriendelijke groet,",
    "[Jouw naam]",
    "",
    reasonText,
    "Dit is een veilige conceptbrief zonder jurisprudentieverwijzingen. Controleer alle gegevens voor verzending. BriefKompas.nl geeft geen juridisch advies.",
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

  const reasons: string[] = [];
  if (classification.caseType === "onzeker_handmatige_triage" || classification.confidence < 0.7) {
    reasons.push("case_type_uncertain");
  }

  if (routing.route === "handmatige_triage" || routing.confidence < 0.6) {
    reasons.push("route_uncertain");
  }

  if (!sourceSetValidation.ok) {
    reasons.push(...sourceSetValidation.reasons);
  }

  if (missingFields.length > 0) {
    reasons.push("missing_required_intake_fields");
  }

  const auditTrail = [
    `Classified caseType=${classification.caseType} confidence=${classification.confidence.toFixed(2)}`,
    `Determined route=${routing.route} confidence=${routing.confidence.toFixed(2)}`,
    sourceSet ? `Loaded source set: ${sourceSet.caseType}/${sourceSet.route}` : "No source set loaded",
    ...authorityValidation.auditTrail,
  ];

  return {
    ok: reasons.length === 0,
    fallbackMode: reasons.length === 0 ? "none" : "safe_generic",
    reasons,
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

    if (!guard.ok || !guard.selectedSourceSet) {
      const fallbackLetter = buildSafeFallbackLetter({
        flow,
        intakeData,
        guard,
      });

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: [] as ReferenceItem[],
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
      ],
      selectedSources: guard.selectedSourceSet.primarySources,
      validatedAuthorities: guard.validatedAuthorities,
      disallowedBehaviors: [
        "Geen nieuwe bronnen buiten selectedSources/validatedAuthorities.",
        "Geen ECLI's zonder validatie.",
        "Geen wetsartikelen op basis van aannames.",
        "Geen stellige juridische conclusie zonder bronbasis.",
      ],
    };

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
        guard: {
          ...guard,
          ok: false,
          fallbackMode: "safe_generic",
          reasons: [...guard.reasons, "empty_generation_output"],
        },
      });

      return NextResponse.json({
        letter: {
          letterText: fallbackLetter,
          references: [] as ReferenceItem[],
        },
        guard: {
          ...guard,
          ok: false,
          fallbackMode: "safe_generic",
          reasons: [...guard.reasons, "empty_generation_output"],
        },
      });
    }

    return NextResponse.json({
      letter: {
        letterText,
        references: guard.validatedAuthorities,
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
