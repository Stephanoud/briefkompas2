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

  const mentionsDocument = /\b(document|bestand|pdf|bijlage|upload|geupload|geuploade|foto|scan)\b/.test(normalized);
  if (!mentionsDocument) {
    return false;
  }

  return /\b(zie|kijk|gebruik|pak|haal|zoek|staat|daar|daarin|hierin|lees)\b/.test(normalized);
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
