import { Flow, GeneratedLetter, IntakeFormData, Product } from "@/types";

export type SavedLetterStatus = "active" | "expired" | "deleted";

export interface SavedLetterDocumentPayload {
  version: 1;
  flow: Flow;
  product: Product | null;
  intakeData: IntakeFormData;
  generatedLetterMeta: Omit<GeneratedLetter, "letterText">;
  manualReferences: string;
}

export interface SavedLetterResearchPayload {
  version: 1;
  flow: Flow;
  product: Product | null;
  bestuursorgaanType: "gemeente" | "provincie" | "waterschap" | "rijk" | "overig" | "onbekend";
  procedureAdvice: string | null;
  decisionAnalysisStatus: string | null;
  decisionReadability: string | null;
  category: string | null;
  hasDecisionUpload: boolean;
  attachmentCount: number;
  generatedLetterLength: number;
  manualReferencesLength: number;
  referenceCount: number;
  generationMode: string | null;
  guardReasonCount: number;
  fieldLengths: Record<string, number>;
  booleanFlags: Record<string, boolean>;
}

export interface SavedLetterRecord {
  id: string;
  recoveryTokenHash: string;
  documentPayload: SavedLetterDocumentPayload;
  generatedLetter: string;
  researchPayload: SavedLetterResearchPayload | null;
  createdAt: string;
  expiresAt: string;
  consentStorage: boolean;
  consentResearch: boolean;
  status: SavedLetterStatus;
}

export interface SaveLetterRecordInput {
  documentPayload: SavedLetterDocumentPayload;
  generatedLetter: string;
  researchPayload: SavedLetterResearchPayload | null;
  consentResearch: boolean;
}

export interface SaveLetterResult {
  id: string;
  recoveryToken: string;
  expiresAt: string;
}

export interface CleanupSavedLettersResult {
  expiredCount: number;
  deletedCount: number;
  storageMode: "postgres" | "file" | "unavailable";
}

export interface RecoveredLetterSessionPayload {
  flow: Flow;
  product: Product | null;
  intakeData: IntakeFormData;
  generatedLetter: GeneratedLetter;
  manualReferences: string;
  expiresAt: string;
}
