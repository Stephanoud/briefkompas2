import { ValidatedCitation } from "@/lib/legal/types";
import { IntakeFormData } from "@/types";

const ECLI_PATTERN = /\bECLI:NL:[A-Z0-9]+:\d{4}:\d+\b/gi;
const TERM_PATTERN = /\b(?:\d+|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|twaalf)\s+(?:dag|dagen|week|weken|maand|maanden)\b/gi;
const ROLE_STATUS_PATTERN = /\b(belanghebbende|vergunninghouder|bezwaarmaker|appellant|eiser|verzoeker)\b/gi;
const HEARING_PATTERN = /\b(hoorzitting|gehoord|horen)\b/gi;
const CORRESPONDENCE_PATTERN = /\b(correspondentie|briefwisseling|e-mailwisseling|mailwisseling|telefoongesprek|telefonisch contact|ingebrekestelling)\b/gi;
const CASE_LAW_CLAIM_PATTERN = /\b(volgens de rechtspraak|volgens jurisprudentie|uit de jurisprudentie volgt|blijkens de jurisprudentie)\b/gi;
const QUOTED_SEGMENT_PATTERN = /["“”](.{15,180}?)["“”]/g;
const GENERIC_GROUND_RULES = [
  {
    pattern: /\bhet besluit is onzorgvuldig voorbereid\b/i,
    violation: "output_generic_zorgvuldigheid_without_research_defect",
    supportGroups: [[
      "onderzoek",
      "onderzoeks",
      "onderzocht",
      "rapport",
      "verslag",
      "zoekslag",
      "inspectie",
      "controle",
      "gegevens",
      "stukken",
      "feiten",
      "niet onderzocht",
      "niet nagegaan",
      "niet bekeken",
      "niet meegewogen",
    ]],
  },
  {
    pattern: /\bhet besluit is ondeugdelijk gemotiveerd\b/i,
    violation: "output_generic_motivation_without_decision_passage",
    supportGroups: [[
      "passage",
      "overweging",
      "alinea",
      "pagina",
      "onderdeel",
      "dragende overweging",
      "het besluit vermeldt",
      "het besluit stelt",
      "volgens het besluit",
      "staat in het besluit",
    ]],
  },
  {
    pattern: /\bhet besluit is in strijd met artikel 3:4 awb\b/i,
    violation: "output_generic_evenredigheid_without_harm_or_balancing",
    supportGroups: [[
      "nadeel",
      "nadelige",
      "gevolgen",
      "impact",
      "draagkracht",
      "kosten",
      "inkomen",
      "gezondheid",
      "beperkingen",
      "belasting",
      "last",
    ], [
      "afweging",
      "belangen",
      "evenredig",
      "onevenredig",
      "doel",
      "minder bezwar",
      "alternatief",
      "proportioneel",
    ]],
  },
  {
    pattern: /\bde volledige heroverweging ontbreekt\b/i,
    violation: "output_generic_reconsideration_without_missing_points",
    supportGroups: [[
      "bezwaargrond",
      "bezwaargronden",
      "argument",
      "argumenten",
      "onderdeel",
      "onderdelen",
      "punt",
      "punten",
      "gronden",
      "zienswijze",
    ], [
      "niet heroverwogen",
      "niet beoordeeld",
      "niet besproken",
      "niet ingegaan",
      "niet is ingegaan",
      "is niet ingegaan",
      "onbesproken",
      "buiten beschouwing",
    ]],
  },
] as const;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function collectMatches(pattern: RegExp, value: string): string[] {
  const source = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  return Array.from(value.matchAll(source))
    .map((match) => normalizeWhitespace(match[0]))
    .filter(Boolean)
    .filter((item, index, values) => values.indexOf(item) === index);
}

function splitIntoSentences(value: string): string[] {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function hasSupportAroundSentence(params: {
  sentences: string[];
  index: number;
  supportGroups: readonly (readonly string[])[];
}): boolean {
  const { sentences, index, supportGroups } = params;
  const context = sentences
    .slice(Math.max(0, index - 1), Math.min(sentences.length, index + 2))
    .join(" ")
    .toLowerCase();

  return supportGroups.every((group) => containsAny(context, group));
}

function buildEvidenceHaystack(intakeData: IntakeFormData): string {
  const decisionAnalysis = intakeData.besluitAnalyse;

  return [
    intakeData.bestuursorgaan,
    intakeData.datumBesluit,
    intakeData.kenmerk,
    intakeData.besluitSamenvatting,
    intakeData.besluitTekst,
    intakeData.besluitDocumentType,
    intakeData.procedureReden,
    intakeData.gronden,
    intakeData.doel,
    intakeData.persoonlijkeOmstandigheden,
    intakeData.eerdereBezwaargronden,
    decisionAnalysis?.onderwerp,
    decisionAnalysis?.rechtsgrond,
    decisionAnalysis?.besluitInhoud,
    decisionAnalysis?.termijnen,
    ...(decisionAnalysis?.dragendeOverwegingen ?? []).flatMap((item) => [item.passage, item.duiding]),
    ...(decisionAnalysis?.wettelijkeGrondslagen ?? []),
    ...(decisionAnalysis?.procedureleAanwijzingen ?? []),
    ...(decisionAnalysis?.beleidsReferenties ?? []),
    ...(decisionAnalysis?.jurisprudentieReferenties ?? []),
    ...(decisionAnalysis?.bijlageReferenties ?? []),
    ...(decisionAnalysis?.aandachtspunten ?? []),
    ...(intakeData.files?.bijlagen ?? []).flatMap((file) => [file.name, file.extractedText ?? ""]),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function findLetterGuardViolations(params: {
  letterText: string;
  intakeData: IntakeFormData;
  validatedAuthorities: ValidatedCitation[];
}): string[] {
  const { letterText, intakeData, validatedAuthorities } = params;
  const normalizedLetter = normalizeWhitespace(letterText);
  const normalizedLetterLower = normalizedLetter.toLowerCase();
  const evidenceHaystack = buildEvidenceHaystack(intakeData);
  const allowedEclis = new Set(
    validatedAuthorities
      .map((authority) => authority.ecli?.toUpperCase())
      .filter((value): value is string => Boolean(value))
  );
  const hasVerifiedCaseLaw = validatedAuthorities.some(
    (authority) => authority.sourceType === "jurisprudentie" && authority.verificationStatus === "verified"
  );
  const violations: string[] = [];

  collectMatches(ECLI_PATTERN, normalizedLetter).forEach((match) => {
    if (!allowedEclis.has(match.toUpperCase())) {
      violations.push("output_unvalidated_ecli");
    }
  });

  collectMatches(TERM_PATTERN, normalizedLetterLower).forEach((match) => {
    if (!evidenceHaystack.includes(match)) {
      violations.push("output_unverified_term");
    }
  });

  collectMatches(HEARING_PATTERN, normalizedLetterLower).forEach((match) => {
    if (!evidenceHaystack.includes(match)) {
      violations.push("output_unverified_hearing_reference");
    }
  });

  collectMatches(CORRESPONDENCE_PATTERN, normalizedLetterLower).forEach((match) => {
    if (!evidenceHaystack.includes(match)) {
      violations.push("output_unverified_correspondence_reference");
    }
  });

  collectMatches(ROLE_STATUS_PATTERN, normalizedLetterLower).forEach((match) => {
    if (!evidenceHaystack.includes(match)) {
      violations.push("output_unverified_user_role_or_status");
    }
  });

  const sentences = splitIntoSentences(normalizedLetter);
  sentences.forEach((sentence, index) => {
    GENERIC_GROUND_RULES.forEach((rule) => {
      if (rule.pattern.test(sentence) && !hasSupportAroundSentence({
        sentences,
        index,
        supportGroups: rule.supportGroups,
      })) {
        violations.push(rule.violation);
      }
    });
  });

  if (
    (/(vaste jurisprudentie|bestendige jurisprudentie)/i.test(normalizedLetter) ||
      CASE_LAW_CLAIM_PATTERN.test(normalizedLetterLower)) &&
    !hasVerifiedCaseLaw
  ) {
    violations.push("output_unverified_case_law_claim");
  }

  const quoteMatches = Array.from(normalizedLetter.matchAll(QUOTED_SEGMENT_PATTERN))
    .map((match) => normalizeWhitespace(match[1]))
    .filter((segment) => segment.length >= 15);

  quoteMatches.forEach((segment) => {
    if (!evidenceHaystack.includes(segment.toLowerCase())) {
      violations.push("output_unverified_decision_quote");
    }
  });

  return violations.filter((item, index, values) => values.indexOf(item) === index);
}
