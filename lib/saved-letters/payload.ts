import { Flow, GeneratedLetter, IntakeFormData, Product, UploadedFileRef } from "@/types";
import {
  RecoveredLetterSessionPayload,
  SavedLetterDocumentPayload,
  SavedLetterRecord,
  SavedLetterResearchPayload,
} from "@/lib/saved-letters/types";

function sanitizeFileRef(file?: UploadedFileRef): UploadedFileRef | undefined {
  if (!file) {
    return undefined;
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    path: `stored:${file.name}:${file.size}`,
  };
}

export function sanitizeIntakeForStorage(intakeData: IntakeFormData): IntakeFormData {
  return {
    ...intakeData,
    besluitTekst: undefined,
    files: {
      besluit: sanitizeFileRef(intakeData.files?.besluit),
      bijlagen: (intakeData.files?.bijlagen ?? []).map((file) => sanitizeFileRef(file)!).filter(Boolean),
    },
  };
}

function detectBestuursorgaanType(value?: string | null): SavedLetterResearchPayload["bestuursorgaanType"] {
  if (!value) {
    return "onbekend";
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("gemeente")) return "gemeente";
  if (normalized.includes("provincie")) return "provincie";
  if (normalized.includes("waterschap")) return "waterschap";
  if (normalized.includes("ministerie") || normalized.includes("rijk") || normalized.includes("belastingdienst")) {
    return "rijk";
  }
  return "overig";
}

function getLength(value?: string | null) {
  return typeof value === "string" ? value.trim().length : 0;
}

export function buildSavedLetterDocumentPayload(params: {
  flow: Flow;
  product: Product | null;
  intakeData: IntakeFormData;
  generatedLetter: GeneratedLetter;
  manualReferences: string;
}): SavedLetterDocumentPayload {
  const sanitizedIntake = sanitizeIntakeForStorage(params.intakeData);

  return {
    version: 1,
    flow: params.flow,
    product: params.product,
    intakeData: sanitizedIntake,
    generatedLetterMeta: {
      references: params.generatedLetter.references,
      generationMode: params.generatedLetter.generationMode,
      guardReasons: params.generatedLetter.guardReasons,
    },
    manualReferences: params.manualReferences,
  };
}

export function buildSavedLetterResearchPayload(params: {
  flow: Flow;
  product: Product | null;
  intakeData: IntakeFormData;
  generatedLetter: GeneratedLetter;
  manualReferences: string;
}): SavedLetterResearchPayload {
  const intakeData = params.intakeData;

  return {
    version: 1,
    flow: params.flow,
    product: params.product,
    bestuursorgaanType: detectBestuursorgaanType(intakeData.bestuursorgaan),
    procedureAdvice: intakeData.procedureAdvies ?? null,
    decisionAnalysisStatus: intakeData.besluitAnalyseStatus ?? null,
    decisionReadability: intakeData.besluitLeeskwaliteit ?? null,
    category: intakeData.categorie ?? null,
    hasDecisionUpload: Boolean(intakeData.files?.besluit),
    attachmentCount: intakeData.files?.bijlagen?.length ?? 0,
    generatedLetterLength: getLength(params.generatedLetter.letterText),
    manualReferencesLength: getLength(params.manualReferences),
    referenceCount: params.generatedLetter.references?.length ?? 0,
    generationMode: params.generatedLetter.generationMode ?? null,
    guardReasonCount: params.generatedLetter.guardReasons?.length ?? 0,
    fieldLengths: {
      doel: getLength(intakeData.doel),
      gronden: getLength(intakeData.gronden),
      persoonlijkeOmstandigheden: getLength(intakeData.persoonlijkeOmstandigheden),
      eerdereBezwaargronden: getLength(intakeData.eerdereBezwaargronden),
      wooOnderwerp: getLength(intakeData.wooOnderwerp),
      wooPeriode: getLength(intakeData.wooPeriode),
      wooDocumenten: getLength(intakeData.wooDocumenten),
      besluitSamenvatting: getLength(intakeData.besluitSamenvatting),
    },
    booleanFlags: {
      digitaleVerstrekking: Boolean(intakeData.digitaleVerstrekking),
      spoed: Boolean(intakeData.spoed),
      procedureBevestigd: Boolean(intakeData.procedureBevestigd),
      nietTijdigBeslissen: Boolean(intakeData.nietTijdigBeslissen),
      heeftBezwaarGemaakt: Boolean(intakeData.heeftBezwaarGemaakt),
      heeftBeslissingOpBezwaar: Boolean(intakeData.heeftBeslissingOpBezwaar),
    },
  };
}

export function toRecoveredLetterSessionPayload(
  record: SavedLetterRecord
): RecoveredLetterSessionPayload | null {
  const { documentPayload } = record;
  if (!documentPayload?.intakeData || !documentPayload.flow) {
    return null;
  }

  return {
    flow: documentPayload.flow,
    product: documentPayload.product,
    intakeData: documentPayload.intakeData,
    generatedLetter: {
      letterText: record.generatedLetter,
      ...documentPayload.generatedLetterMeta,
    },
    manualReferences: documentPayload.manualReferences,
    expiresAt: record.expiresAt,
  };
}
