import { validateCitation } from "@/lib/citation-guard";
import {
  CaseLawDistinguishable,
  CaseLawHelpfulness,
  CaseLawSimilarity,
  SelectedSourceSet,
  ValidatedCitation,
} from "@/lib/legal/types";
import { ReferenceItem } from "@/src/types/references";
import { IntakeFormData } from "@/types";

const OFFICIAL_CASELAW_TIMEOUT_MS = 5000;
const MAX_HOLDING_LENGTH = 420;
const USER_HELPFUL_PATTERNS = [
  /\bbestuursorgaan moet\b/i,
  /\b(?:zorgvuldig|zorgvuldige)\b/i,
  /\b(?:deugdelijk|dragend|kenbaar|controleerbaar)\b/i,
  /\b(?:motiver|onderbouw|onderzoek)\w*\b/i,
  /\b(?:evenredig|onevenredig|belangenafweging)\b/i,
  /\b(?:matiging|verschoonbaar|heroverweging)\b/i,
  /\b(?:passend|restrictief|openbaar(?:making)?|inventarislijst)\b/i,
];
const AUTHORITY_HELPFUL_PATTERNS = [
  /\bbestuursorgaan mocht\b/i,
  /\bin redelijkheid\b/i,
  /\bgeen verplichting\b/i,
  /\bniet vereist\b/i,
  /\bgeen recht\b/i,
  /\bniet onredelijk\b/i,
  /\bgeen belanghebbende\b/i,
  /\bniet-ontvankelijk\b/i,
  /\bomkering(?: van)? bewijslast\b/i,
];

function inferSourceUrl(reference: ReferenceItem): string {
  if (reference.ecli || reference.sourceType === "jurisprudentie") {
    return "https://data.rechtspraak.nl";
  }

  if (reference.sourceType === "wet") {
    return "https://wetten.overheid.nl";
  }

  if (reference.sourceType === "beleid") {
    return "https://rijksoverheid.nl";
  }

  return "https://overheid.nl";
}

function extractDecisionDate(title: string): string | undefined {
  const match = title.match(
    /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i
  );
  if (!match) return undefined;
  return `${match[1]} ${match[2]} ${match[3]}`;
}

function extractCourtName(title: string): string | undefined {
  if (/abrvs/i.test(title)) {
    return "Afdeling bestuursrechtspraak van de Raad van State";
  }
  if (/hr\b/i.test(title)) {
    return "Hoge Raad";
  }
  if (/crvb/i.test(title)) {
    return "Centrale Raad van Beroep";
  }
  return undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripXml(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, " "));
}

function sanitizeSnippet(value?: string | null, maxLength = MAX_HOLDING_LENGTH): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(stripXml(value));
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function extractFirstMatch(xml: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) {
      const normalized = normalizeWhitespace(stripXml(match[1]));
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function extractListMatches(xml: string, pattern: RegExp, maxItems = 5): string[] {
  const matches = Array.from(xml.matchAll(pattern));

  return matches
    .map((match) => sanitizeSnippet(match[1], 200))
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, maxItems);
}

function extractRelevantCaseLawSnippet(xml: string): string | null {
  const paragraphs = extractListMatches(xml, /<para[^>]*>([\s\S]*?)<\/para>/gi, 120);
  const highPriorityPattern =
    /\b(evenredig|onevenredig|belangenafweging|motivering|zorgvuldig|zorgvuldigheid|geluid|geluidhinder|geluidsoverlast|woon- en leefklimaat|leefklimaat|cumulatie)\b/i;

  return (
    paragraphs.find((paragraph) => highPriorityPattern.test(paragraph)) ??
    paragraphs.find((paragraph) => /\bonderzoek\b/i.test(paragraph)) ??
    null
  );
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
}

function buildAuthoritySearchQueries(reference: ReferenceItem): string[] {
  const queries = new Set<string>();

  if (reference.ecli) {
    queries.add(reference.ecli);
    queries.add(`${reference.ecli} ${reference.topic}`.trim());
  }

  queries.add(`${reference.topic} ${reference.title}`.trim());

  if (reference.keywords?.length) {
    queries.add(`${reference.topic} ${reference.keywords.slice(0, 3).join(" ")}`.trim());
  }

  return Array.from(queries).slice(0, 3);
}

function buildTopicMatch(reference: ReferenceItem, textParts: string[]): boolean {
  const haystack = textParts.join(" ").toLowerCase();
  const keywords = new Set([
    ...tokenize(reference.topic),
    ...tokenize(reference.principle),
    ...(reference.keywords ?? []).flatMap((keyword) => tokenize(keyword)),
  ]);

  if (keywords.size === 0) {
    return true;
  }

  let matchCount = 0;
  keywords.forEach((keyword) => {
    if (haystack.includes(keyword)) {
      matchCount += 1;
    }
  });

  return matchCount >= 1;
}

function buildCaseLawContextText(intakeData?: IntakeFormData): string {
  if (!intakeData) {
    return "";
  }

  const decisionAnalysis = intakeData.besluitAnalyse;

  return [
    intakeData.bestuursorgaan,
    intakeData.categorie,
    intakeData.doel,
    intakeData.gronden,
    intakeData.procedureReden,
    intakeData.eerdereBezwaargronden,
    intakeData.wooOnderwerp,
    intakeData.wooPeriode,
    intakeData.wooDocumenten,
    intakeData.besluitDocumentType,
    intakeData.besluitSamenvatting,
    intakeData.besluitTekst,
    intakeData.files?.besluit?.name,
    intakeData.files?.besluit?.extractedText,
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
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function assessFactualSimilarity(params: {
  reference: ReferenceItem;
  officialTitle?: string;
  verifiedHolding?: string | null;
  subjects: string[];
  intakeData?: IntakeFormData;
}): {
  assessed: boolean;
  similarity: CaseLawSimilarity;
} {
  const { reference, officialTitle, verifiedHolding, subjects, intakeData } = params;
  const caseContext = buildCaseLawContextText(intakeData);
  const caseTokens = new Set(tokenize(caseContext));
  const referenceTokens = new Set([
    ...tokenize(reference.topic),
    ...tokenize(reference.principle),
    ...(reference.keywords ?? []).flatMap((keyword) => tokenize(keyword)),
    ...tokenize(officialTitle ?? ""),
    ...tokenize(verifiedHolding ?? ""),
    ...subjects.flatMap((subject) => tokenize(subject)),
  ]);

  if (caseTokens.size === 0 || referenceTokens.size === 0) {
    return {
      assessed: false,
      similarity: "unknown",
    };
  }

  let overlap = 0;
  referenceTokens.forEach((token) => {
    if (caseTokens.has(token)) {
      overlap += 1;
    }
  });

  if (overlap >= 3) {
    return {
      assessed: true,
      similarity: "high",
    };
  }

  const topicMatchesCase = buildTopicMatch(reference, [caseContext]);

  if (topicMatchesCase || overlap >= 1) {
    return {
      assessed: true,
      similarity: "medium",
    };
  }

  return {
    assessed: true,
    similarity: "low",
  };
}

function countPatternHits(patterns: RegExp[], value: string): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(value) ? 1 : 0), 0);
}

function assessCaseLawHelpfulness(params: {
  reference: ReferenceItem;
  verifiedHolding?: string | null;
}): CaseLawHelpfulness {
  const text = normalizeWhitespace(
    [params.reference.topic, params.reference.principle, params.verifiedHolding ?? ""].join(" ")
  );

  if (!text) {
    return "unknown";
  }

  const userHelpfulScore = countPatternHits(USER_HELPFUL_PATTERNS, text);
  const authorityHelpfulScore = countPatternHits(AUTHORITY_HELPFUL_PATTERNS, text);

  if (userHelpfulScore > authorityHelpfulScore && userHelpfulScore > 0) {
    return "user";
  }

  if (authorityHelpfulScore > userHelpfulScore && authorityHelpfulScore > 0) {
    return "authority";
  }

  if (userHelpfulScore > 0 && authorityHelpfulScore > 0) {
    return "mixed";
  }

  return "unknown";
}

function assessDistinguishable(params: {
  helpsUserOrAuthority: CaseLawHelpfulness;
  factualSimilarity: CaseLawSimilarity;
}): CaseLawDistinguishable {
  const { helpsUserOrAuthority, factualSimilarity } = params;

  if (helpsUserOrAuthority !== "authority") {
    return "not_applicable";
  }

  if (factualSimilarity === "low") {
    return "yes";
  }

  if (factualSimilarity === "medium" || factualSimilarity === "high") {
    return "no";
  }

  return "unknown";
}

function hasCaseLawOpportunitySignals(intakeData?: IntakeFormData): boolean {
  if (!intakeData) {
    return false;
  }

  const haystack = buildCaseLawContextText(intakeData).toLowerCase();
  return /(zoekslag|weigeringsgrond|gedeeltelijke openbaarmaking|niet[- ]ontvankelijk|ingebrekestelling|legalisatie|sociaal netwerk|definitieve berekening|opzet|grove schuld|verwijtbaarheid|matiging|pleitbaar standpunt|omkering(?: van)? bewijslast|hardheid|evenredigheid|boete|dwangsom|heroverweging)/.test(
    haystack
  );
}

function scoreCaseLawValueAdd(params: {
  authority: ValidatedCitation;
  intakeData?: IntakeFormData;
}): {
  score: number;
  likelyAddsValue: boolean;
  reason: string;
} {
  const { authority, intakeData } = params;

  if (authority.sourceType !== "jurisprudentie" || authority.verificationStatus !== "verified") {
    return {
      score: 0,
      likelyAddsValue: false,
      reason: "not_applicable",
    };
  }

  let score = 0;

  if (authority.factualSimilarity === "high") {
    score += 4;
  } else if (authority.factualSimilarity === "medium") {
    score += 2;
  }

  if (authority.helpsUserOrAuthority === "user") {
    score += 3;
  } else if (authority.helpsUserOrAuthority === "authority" && authority.distinguishable === "yes") {
    score += 1;
  }

  if (authority.coreConsiderationRead) {
    score += 1;
  }

  if (authority.verifiedHolding) {
    score += 1;
  }

  if (hasCaseLawOpportunitySignals(intakeData)) {
    score += 1;
  }

  const likelyAddsValue = score >= 5;

  return {
    score,
    likelyAddsValue,
    reason: likelyAddsValue ? "case_law_quality_booster" : "case_law_not_needed_or_too_weak",
  };
}

function applyCaseLawSelection(params: {
  authorities: ValidatedCitation[];
  intakeData?: IntakeFormData;
}): {
  selectedAuthorities: ValidatedCitation[];
  reviewedAuthorities: ValidatedCitation[];
  auditTrail: string[];
} {
  const { authorities, intakeData } = params;
  const selectedAuthorities: ValidatedCitation[] = [];
  const reviewedAuthorities = authorities.map((authority) => ({ ...authority }));
  const auditTrail: string[] = [];

  const verifiedCaseLaw = reviewedAuthorities
    .filter((authority) => authority.sourceType === "jurisprudentie" && authority.verificationStatus === "verified")
    .map((authority) => {
      const selection = scoreCaseLawValueAdd({ authority, intakeData });
      authority.valueAddScore = selection.score;
      authority.selectionReason = selection.reason;
      authority.useInLetter = selection.likelyAddsValue;
      return authority;
    })
    .sort((left, right) => (right.valueAddScore ?? 0) - (left.valueAddScore ?? 0));

  const chosenCaseLawIds = new Set(
    verifiedCaseLaw
      .filter((authority) => authority.useInLetter)
      .slice(0, 2)
      .map((authority) => authority.id)
  );

  reviewedAuthorities.forEach((authority) => {
    if (authority.sourceType !== "jurisprudentie") {
      authority.useInLetter = authority.verificationStatus === "verified";
      authority.selectionReason = authority.verificationStatus === "verified" ? "non_case_law_verified" : authority.selectionReason;
      if (authority.useInLetter) {
        selectedAuthorities.push(authority);
      }
      return;
    }

    if (authority.verificationStatus !== "verified") {
      authority.useInLetter = false;
      authority.selectionReason = authority.selectionReason ?? "case_law_not_verified";
      return;
    }

    authority.useInLetter = chosenCaseLawIds.has(authority.id);
    if (!authority.useInLetter && authority.selectionReason === "case_law_quality_booster") {
      authority.selectionReason = "case_law_deprioritized_due_to_letter_limit";
    }

    if (authority.useInLetter) {
      selectedAuthorities.push(authority);
    }
  });

  reviewedAuthorities
    .filter((authority) => authority.sourceType === "jurisprudentie")
    .forEach((authority) => {
      auditTrail.push(
        `Case law ${authority.id}: useInLetter=${authority.useInLetter ? "yes" : "no"} score=${authority.valueAddScore ?? 0} reason=${authority.selectionReason ?? "unknown"}`
      );
    });

  return {
    selectedAuthorities,
    reviewedAuthorities,
    auditTrail,
  };
}

async function fetchOfficialCaseLaw(ecli: string): Promise<{
  ok: boolean;
  url: string;
  officialTitle?: string;
  courtName?: string;
  decisionDate?: string;
  holding?: string | null;
  subjects: string[];
}> {
  const url = `https://data.rechtspraak.nl/uitspraken/content?id=${encodeURIComponent(ecli)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OFFICIAL_CASELAW_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/xml, text/xml;q=0.9, */*;q=0.1",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        url,
        subjects: [],
      };
    }

    const xml = await response.text();
    const officialTitle = extractFirstMatch(xml, [/<dcterms:title[^>]*>([\s\S]*?)<\/dcterms:title>/i]);
    const courtName = extractFirstMatch(xml, [/<dcterms:creator[^>]*>([\s\S]*?)<\/dcterms:creator>/i]);
    const decisionDate = extractFirstMatch(xml, [/<dcterms:date[^>]*>([\s\S]*?)<\/dcterms:date>/i]);
    const abstract = extractFirstMatch(xml, [/<inhoudsindicatie[^>]*>([\s\S]*?)<\/inhoudsindicatie>/i]);
    const relevantSnippet = extractRelevantCaseLawSnippet(xml);
    const holding = [relevantSnippet, abstract]
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" ");
    const subjects = extractListMatches(xml, /<dcterms:subject[^>]*>([\s\S]*?)<\/dcterms:subject>/gi, 4);

    return {
      ok: Boolean(officialTitle || courtName || decisionDate || holding),
      url,
      officialTitle: officialTitle ?? undefined,
      courtName: courtName ?? undefined,
      decisionDate: decisionDate ?? undefined,
      holding: holding || null,
      subjects,
    };
  } catch {
    return {
      ok: false,
      url,
      subjects: [],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildVerifiedAuthority(params: {
  reference: ReferenceItem;
  sourceUrl: string;
  verificationStatus: ValidatedCitation["verificationStatus"];
  reasons: string[];
  officialTitle?: string;
  verifiedHolding?: string | null;
  courtName?: string;
  decisionDate?: string;
  coreConsiderationRead?: boolean;
  factualSimilarity?: CaseLawSimilarity;
  factualSimilarityAssessed?: boolean;
  helpsUserOrAuthority?: CaseLawHelpfulness;
  distinguishable?: CaseLawDistinguishable;
}): ValidatedCitation {
  return {
    ...params.reference,
    sourceUrl: params.sourceUrl,
    allowed: params.verificationStatus === "verified",
    reasons: params.reasons,
    verificationStatus: params.verificationStatus,
    searchQueries: buildAuthoritySearchQueries(params.reference),
    officialTitle: params.officialTitle,
    verifiedHolding: params.verifiedHolding ?? null,
    courtName: params.courtName,
    decisionDate: params.decisionDate,
    coreConsiderationRead: params.coreConsiderationRead,
    factualSimilarity: params.factualSimilarity,
    factualSimilarityAssessed: params.factualSimilarityAssessed,
    helpsUserOrAuthority: params.helpsUserOrAuthority,
    distinguishable: params.distinguishable,
  };
}

async function verifyReference(params: {
  reference: ReferenceItem;
  sourceSet: SelectedSourceSet;
  intakeData?: IntakeFormData;
}): Promise<ValidatedCitation> {
  const { reference, sourceSet, intakeData } = params;
  const sourceUrl = inferSourceUrl(reference);
  const isCaseLaw = Boolean(reference.ecli || reference.sourceType === "jurisprudentie");

  if (!isCaseLaw) {
    return buildVerifiedAuthority({
      reference,
      sourceUrl,
      verificationStatus: "verified",
      reasons: [],
    });
  }

  if (sourceSet.useCaseLaw !== "only_if_validated") {
    return buildVerifiedAuthority({
      reference,
      sourceUrl,
      verificationStatus: "not_usable",
      reasons: ["case_law_disabled_for_case_type"],
    });
  }

  if (!reference.ecli) {
    return buildVerifiedAuthority({
      reference,
      sourceUrl,
      verificationStatus: "not_usable",
      reasons: ["missing_ecli"],
    });
  }

  const official = await fetchOfficialCaseLaw(reference.ecli);
  const topicMatch = buildTopicMatch(reference, [
    official.officialTitle ?? "",
    official.holding ?? "",
    official.subjects.join(" "),
  ]);
  const verifiedHolding = sanitizeSnippet(official.holding);
  const factualSimilarityAssessment = assessFactualSimilarity({
    reference,
    officialTitle: official.officialTitle,
    verifiedHolding,
    subjects: official.subjects,
    intakeData,
  });
  const helpsUserOrAuthority = assessCaseLawHelpfulness({
    reference,
    verifiedHolding,
  });
  const distinguishable = assessDistinguishable({
    helpsUserOrAuthority,
    factualSimilarity: factualSimilarityAssessment.similarity,
  });
  const validation = validateCitation({
    url: official.url,
    ecli: reference.ecli,
    fetchedFromOfficialSource: official.ok,
    courtName: official.courtName ?? extractCourtName(reference.title),
    decisionDate: official.decisionDate ?? extractDecisionDate(reference.title),
    topicMatch,
    holdingExtracted: Boolean(verifiedHolding),
    coreConsiderationRead: Boolean(verifiedHolding),
    factualSimilarityAssessed: factualSimilarityAssessment.assessed,
    factualSimilarityMatch:
      factualSimilarityAssessment.similarity === "high" || factualSimilarityAssessment.similarity === "medium",
    helpsUserOrAuthority,
    distinguishable,
    allowedDomains: sourceSet.allowedDomains,
  });

  const reasons = official.ok ? validation.reasons : ["official_fetch_failed", ...validation.reasons];
  const verificationStatus =
    validation.allowed
      ? "verified"
      : official.ok
        ? "mixed"
        : "not_usable";

  return buildVerifiedAuthority({
    reference,
    sourceUrl: official.url,
    verificationStatus,
    reasons,
    officialTitle: official.officialTitle,
    verifiedHolding,
    courtName: official.courtName ?? extractCourtName(reference.title),
    decisionDate: official.decisionDate ?? extractDecisionDate(reference.title),
    coreConsiderationRead: Boolean(verifiedHolding),
    factualSimilarity: factualSimilarityAssessment.similarity,
    factualSimilarityAssessed: factualSimilarityAssessment.assessed,
    helpsUserOrAuthority,
    distinguishable,
  });
}

export async function validateAuthorities(params: {
  references: ReferenceItem[];
  sourceSet: SelectedSourceSet;
  intakeData?: IntakeFormData;
}): Promise<{
  selectedAuthorities: ValidatedCitation[];
  allowedAuthorities: ValidatedCitation[];
  rejectedAuthorities: ValidatedCitation[];
  reviewedAuthorities: ValidatedCitation[];
  auditTrail: string[];
}> {
  const { references, sourceSet, intakeData } = params;

  const validatedReferences = await Promise.all(
    references.map((reference) => verifyReference({ reference, sourceSet, intakeData }))
  );

  const allowedAuthorities = validatedReferences.filter((reference) => reference.verificationStatus === "verified");
  const rejectedAuthorities = validatedReferences.filter((reference) => reference.verificationStatus !== "verified");
  const selection = applyCaseLawSelection({
    authorities: [...allowedAuthorities, ...rejectedAuthorities],
    intakeData,
  });
  const auditTrail = validatedReferences.map((reference) => {
    const caseLawAssessment =
      reference.sourceType === "jurisprudentie"
        ? ` [holding=${reference.coreConsiderationRead ? "yes" : "no"}, similarity=${reference.factualSimilarity ?? "unknown"}, helps=${reference.helpsUserOrAuthority ?? "unknown"}, distinguishable=${reference.distinguishable ?? "unknown"}]`
        : "";
    const reasonSuffix = reference.reasons.length > 0 ? ` (${reference.reasons.join(",")})` : "";
    return `Authority ${reference.id}: ${reference.verificationStatus}${caseLawAssessment}${reasonSuffix}`;
  });

  return {
    selectedAuthorities: selection.selectedAuthorities,
    allowedAuthorities,
    rejectedAuthorities,
    reviewedAuthorities: selection.reviewedAuthorities,
    auditTrail: [...auditTrail, ...selection.auditTrail],
  };
}
