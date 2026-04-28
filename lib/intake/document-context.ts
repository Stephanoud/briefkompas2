import { IntakeFormData } from "@/types";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && normalizeWhitespace(value).length > 0;
}

export function getKnownBestuursorgaan(data: Partial<IntakeFormData>): string | null {
  if (hasText(data.bestuursorgaan)) {
    return normalizeWhitespace(data.bestuursorgaan);
  }

  if (hasText(data.besluitAnalyse?.bestuursorgaan)) {
    return normalizeWhitespace(data.besluitAnalyse.bestuursorgaan);
  }

  return null;
}

export function refersToUploadedDocument(value: string): boolean {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  const mentionsDocument =
    /\b(document|bestand|pdf|bijlage|upload|geupload|geuploade|foto|scan|brief|besluit|beschikking)\b/.test(
      normalized
    );
  if (!mentionsDocument) {
    return false;
  }

  return /\b(zie|kijk|gebruik|pak|haal|zoek|staat|daar|daarin|hierin|lees)\b/.test(normalized);
}

export function isDocumentLookupRequest(value: string): boolean {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized || !refersToUploadedDocument(normalized)) {
    return false;
  }

  return (
    /\b(haal|kijk|zie|gebruik|pak|zoek|lees|controleer)\b/.test(normalized) ||
    /\bkun\s+je\b.*\b(halen|lezen|pakken|zoeken|zien|gebruiken|controleren)\b/.test(normalized) ||
    /\bstaat\s+(dat|dit|die|het)\b/.test(normalized)
  );
}

function buildDecisionContext(data: Partial<IntakeFormData>): string {
  return [
    data.besluitDocumentType,
    data.besluitSamenvatting,
    data.besluitTekst?.slice(0, 4000),
    data.files?.besluit?.extractedText?.slice(0, 4000),
    data.besluitAnalyse?.onderwerp,
    data.besluitAnalyse?.rechtsgrond,
    data.besluitAnalyse?.besluitInhoud,
    data.besluitAnalyse?.termijnen,
    data.besluitAnalyse?.rechtsmiddelenclausule,
    ...(data.besluitAnalyse?.dragendeOverwegingen ?? []).flatMap((item) => [item.passage, item.duiding]),
    ...(data.besluitAnalyse?.wettelijkeGrondslagen ?? []),
    ...(data.besluitAnalyse?.procedureleAanwijzingen ?? []),
    ...(data.besluitAnalyse?.aandachtspunten ?? []),
    ...(data.files?.bijlagen ?? []).map((file) => file.extractedText?.slice(0, 1500)),
  ]
    .filter(hasText)
    .join(" ");
}

function hasMeaningfulDecisionContext(data: Partial<IntakeFormData>): boolean {
  return Boolean(
    hasText(data.besluitDocumentType) ||
      hasText(data.besluitSamenvatting) ||
      hasText(data.besluitTekst) ||
      hasText(data.files?.besluit?.extractedText) ||
      hasText(data.besluitAnalyse?.onderwerp) ||
      hasText(data.besluitAnalyse?.besluitInhoud) ||
      hasText(data.besluitAnalyse?.rechtsgrond) ||
      hasText(data.besluitAnalyse?.termijnen) ||
      (data.files?.bijlagen ?? []).some((file) => hasText(file.extractedText))
  );
}

function inferCategoryFromDocument(data: Partial<IntakeFormData>): string | null {
  if (hasText(data.categorie)) {
    return normalizeWhitespace(data.categorie).toLowerCase();
  }

  const normalized = buildDecisionContext(data).toLowerCase();
  if (!normalized) {
    return null;
  }

  const hasBelastingSignals =
    /\b(belasting|aanslag|naheffing|woz|fiscaal|heffing|heffingsambtenaar|inspecteur)\b/.test(normalized);
  if (hasBelastingSignals) {
    return "belasting";
  }

  if (/\b(bestuurlijke boete|boetebesluit|verkeersboete|mulder|cjib|boete)\b/.test(normalized)) {
    return "boete";
  }

  if (/\b(uitkering|uwv|ww\b|wia|wajong|wao|ziektewet|participatiewet|bijstand)\b/.test(normalized)) {
    return "uitkering";
  }

  if (/\b(omgevingsvergunning|bouwvergunning|exploitatievergunning|vergunning)\b/.test(normalized)) {
    return "vergunning";
  }

  if (
    /\b(wft|wet op het financieel toezicht|aanwijzing|toezichthouder|toezicht|nza|afm|dnb|acm|beslissing op bezwaar)\b/.test(
      normalized
    )
  ) {
    return "overig";
  }

  return hasMeaningfulDecisionContext(data) ? "overig" : null;
}

function getDocumentSummaryForOntwerpbesluit(data: Partial<IntakeFormData>): string | null {
  if (hasText(data.besluitSamenvatting)) {
    return normalizeWhitespace(data.besluitSamenvatting);
  }

  if (hasText(data.besluitAnalyse?.besluitInhoud)) {
    return normalizeWhitespace(data.besluitAnalyse.besluitInhoud);
  }

  if (hasText(data.besluitAnalyse?.onderwerp)) {
    return `Het ontwerpbesluit gaat over ${normalizeWhitespace(data.besluitAnalyse.onderwerp)}.`;
  }

  return null;
}

export function getReferencedDocumentBestuursorgaan(
  value: string,
  data: Partial<IntakeFormData>
): string | null {
  const knownBestuursorgaan = getKnownBestuursorgaan(data);
  if (!knownBestuursorgaan || !refersToUploadedDocument(value)) {
    return null;
  }

  return knownBestuursorgaan;
}

export function getReferencedDocumentFieldValue(
  value: string,
  stepId: string | undefined,
  data: Partial<IntakeFormData>
): string | null {
  if (!stepId || !refersToUploadedDocument(value)) {
    return null;
  }

  switch (stepId) {
    case "bestuursorgaan":
      return getReferencedDocumentBestuursorgaan(value, data);
    case "categorie":
      return inferCategoryFromDocument(data);
    case "ontwerpbesluit":
      return getDocumentSummaryForOntwerpbesluit(data);
    default:
      return null;
  }
}
