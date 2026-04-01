import { AttachmentDocumentKind, Flow, IntakeFormData, UploadedFileRef } from "@/types";

export interface RelevantProceduralAttachment {
  fileName: string;
  attachmentKind: AttachmentDocumentKind;
  relevance: string;
  excerpt: string | null;
}

const EXCERPT_MAX_LENGTH = 900;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimExcerpt(value?: string | null, maxLength = EXCERPT_MAX_LENGTH): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function buildAttachmentHaystack(file: Pick<UploadedFileRef, "name" | "extractedText">): string {
  return `${file.name} ${file.extractedText ?? ""}`.toLowerCase();
}

export function inferAttachmentKind(file: Pick<UploadedFileRef, "name" | "extractedText">): AttachmentDocumentKind {
  const haystack = buildAttachmentHaystack(file);

  if (/\b(beslissing|besluit) op bezwaar\b/.test(haystack)) {
    return "overig";
  }

  const mentionsAanvulling = /\b(aanvulling|aanvullende|nadere)\b/.test(haystack);
  const mentionsZienswijze =
    /\bzienswijz(e|en)\b/.test(haystack) ||
    /\bhierbij dien ik .*zienswijze in\b/.test(haystack);
  const mentionsBezwaar =
    /\bbezwaarschrift\b/.test(haystack) ||
    /\bbezwaarbrief\b/.test(haystack) ||
    /\bpro forma bezwaar\b/.test(haystack) ||
    /\bhierbij maak ik bezwaar\b/.test(haystack) ||
    /\bgronden van bezwaar\b/.test(haystack);

  if (mentionsZienswijze && mentionsAanvulling) {
    return "aanvulling_zienswijze";
  }

  if (mentionsZienswijze) {
    return "zienswijze";
  }

  if (mentionsBezwaar && mentionsAanvulling) {
    return "aanvulling_bezwaar";
  }

  if (mentionsBezwaar) {
    return "bezwaarbrief";
  }

  if (/\bberoepschrift\b/.test(haystack) || /\bhierbij stel ik beroep in\b/.test(haystack)) {
    return "beroepschrift";
  }

  if (/\b(gronden|toelichting|reactie)\b/.test(haystack)) {
    return "onderliggend_processtuk";
  }

  return "overig";
}

function getRelevanceForKind(kind: AttachmentDocumentKind): string {
  switch (kind) {
    case "bezwaarbrief":
    case "aanvulling_bezwaar":
      return "Onderliggend bezwaarschrift of nadere bezwaargronden; relevant om te toetsen of de beslissing op bezwaar de eerder aangevoerde punten voldoende weerlegt.";
    case "zienswijze":
    case "aanvulling_zienswijze":
      return "Onderliggende zienswijze of aanvulling daarop; relevant om te zien welke bezwaren al in de voorprocedure zijn ingebracht.";
    case "onderliggend_processtuk":
      return "Onderliggend processtuk met eerdere standpunten of toelichting; kan relevant zijn voor de voorgeschiedenis van het beroep.";
    default:
      return "Aanvullend stuk uit het dossier.";
  }
}

function getAttachmentPriority(kind: AttachmentDocumentKind): number {
  switch (kind) {
    case "bezwaarbrief":
    case "zienswijze":
      return 1;
    case "aanvulling_bezwaar":
    case "aanvulling_zienswijze":
      return 2;
    case "onderliggend_processtuk":
      return 3;
    case "beroepschrift":
      return 4;
    default:
      return 5;
  }
}

function isRelevantForAppealFlow(params: {
  flow: Flow;
  intakeData: Partial<IntakeFormData>;
  kind: AttachmentDocumentKind;
}): boolean {
  const { flow, intakeData, kind } = params;
  const hasZienswijzeHistory = Boolean(
    intakeData.hadOntwerpbesluit || intakeData.konZienswijzeIndienen || intakeData.heeftZienswijzeIngediend
  );

  if (flow === "beroep_na_bezwaar") {
    if (kind === "bezwaarbrief" || kind === "aanvulling_bezwaar") {
      return true;
    }

    if (hasZienswijzeHistory && (kind === "zienswijze" || kind === "aanvulling_zienswijze")) {
      return true;
    }

    return kind === "onderliggend_processtuk";
  }

  if (flow === "beroep_zonder_bezwaar") {
    if (kind === "zienswijze" || kind === "aanvulling_zienswijze") {
      return true;
    }

    return hasZienswijzeHistory && kind === "onderliggend_processtuk";
  }

  return false;
}

export function getRelevantProceduralAttachments(params: {
  flow: Flow;
  intakeData: Partial<IntakeFormData>;
  maxItems?: number;
}): RelevantProceduralAttachment[] {
  const { flow, intakeData, maxItems = 3 } = params;
  const attachments = intakeData.files?.bijlagen ?? [];

  if (flow !== "beroep_na_bezwaar" && flow !== "beroep_zonder_bezwaar") {
    return [];
  }

  return attachments
    .map((file) => {
      const attachmentKind = file.attachmentKind ?? inferAttachmentKind(file);
      return {
        fileName: file.name,
        attachmentKind,
        relevance: getRelevanceForKind(attachmentKind),
        excerpt: trimExcerpt(file.extractedText),
      };
    })
    .filter((file) => isRelevantForAppealFlow({ flow, intakeData, kind: file.attachmentKind }))
    .sort((left, right) => getAttachmentPriority(left.attachmentKind) - getAttachmentPriority(right.attachmentKind))
    .slice(0, maxItems);
}

export function getAttachmentKindLabel(kind?: AttachmentDocumentKind | null): string | null {
  switch (kind) {
    case "bezwaarbrief":
      return "bezwaarbrief";
    case "aanvulling_bezwaar":
      return "aanvulling bezwaar";
    case "zienswijze":
      return "zienswijze";
    case "aanvulling_zienswijze":
      return "aanvulling zienswijze";
    case "beroepschrift":
      return "beroepschrift";
    case "onderliggend_processtuk":
      return "onderliggend processtuk";
    default:
      return null;
  }
}
