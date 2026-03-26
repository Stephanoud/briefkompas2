import {
  DecisionAnalysisStatus,
  DecisionAnalysisSummary,
  DecisionReadability,
  Flow,
  IntakeFormData,
  LetterGenerationMode,
} from "@/types";
import { ReferenceItem } from "@/src/types/references";

export type CaseType =
  | "woo"
  | "algemeen_bestuursrecht"
  | "omgevingswet_vergunning"
  | "taakstraf"
  | "verkeersboete"
  | "belastingaanslag"
  | "uwv_uitkering"
  | "toeslag"
  | "onzeker_handmatige_triage";

export type RouteType =
  | "woo_verzoek"
  | "bezwaar_woo_besluit"
  | "zienswijze_bestuursrecht"
  | "bezwaar_bestuursrecht"
  | "beroep_rechtstreeks_bestuursrecht"
  | "beroep_na_bezwaar_bestuursrecht"
  | "bezwaar_awb"
  | "zienswijze_of_beroep"
  | "administratief_beroep_ovj"
  | "beroep_kantonrechter"
  | "bezwaar_omzettingskennisgeving"
  | "verzet_strafbeschikking"
  | "bezwaar_fiscaal"
  | "beroep_belastingrechter"
  | "bezwaar_uwv"
  | "bezwaar_toeslagen"
  | "bezwaar_definitieve_berekening"
  | "bezwaar_uht"
  | "handmatige_triage";

export type UseCaseLawMode = false | "only_if_validated";

export interface SourceDefinition {
  domain: string;
  url: string;
  role: "primary";
}

export interface SelectedSourceSet {
  caseType: CaseType;
  route: RouteType;
  allowedDomains: string[];
  primarySources: SourceDefinition[];
  useCaseLaw: UseCaseLawMode;
}

export interface ValidatedCitation extends ReferenceItem {
  allowed: boolean;
  reasons: string[];
  sourceUrl: string;
}

export interface PromptPayload {
  flow: Flow;
  caseType: CaseType;
  route: RouteType;
  caseFacts: string[];
  decisionMeta: string[];
  decisionAnalysis?: DecisionAnalysisSummary | null;
  decisionAnalysisStatus?: DecisionAnalysisStatus;
  decisionReadability?: DecisionReadability | null;
  selectedSources: SourceDefinition[];
  validatedAuthorities: ValidatedCitation[];
  disallowedBehaviors: string[];
}

export interface CaseClassificationResult {
  caseType: CaseType;
  confidence: number;
  reasons: string[];
  needsClarification: boolean;
}

export interface RouteDeterminationResult {
  route: RouteType;
  confidence: number;
  reasons: string[];
}

export interface SourceMapCaseConfig {
  routes: RouteType[];
  primarySources: string[];
  useCaseLaw: UseCaseLawMode;
}

export interface SourceMapConfig {
  version: string;
  allowlistDomains: string[];
  caseTypes: Record<CaseType, SourceMapCaseConfig>;
  validation: {
    law: {
      requireOfficialSource: boolean;
      requireBwbr: boolean;
    };
    caseLaw: {
      requireEcliFormat: boolean;
      requireOfficialFetch: boolean;
      requireCourt: boolean;
      requireDecisionDate: boolean;
      requireTopicMatch: boolean;
      requireHoldingExtraction: boolean;
    };
    routing: {
      decisionDocumentOverridesGenericWebsite: boolean;
      fallbackToSafeDraftOnConflict: boolean;
    };
  };
}

export interface GenerationGuardResult {
  ok: boolean;
  fallbackMode: "none" | "safe_generic";
  generationMode: LetterGenerationMode;
  reasons: string[];
  hardBlockers: string[];
  softSignals: string[];
  missingFields: string[];
  caseType: CaseType;
  route: RouteType;
  caseTypeConfidence: number;
  routeConfidence: number;
  selectedSourceSet?: SelectedSourceSet;
  rejectedSources: string[];
  validatedAuthorities: ValidatedCitation[];
  auditTrail: string[];
}

export interface GuardInput {
  flow: Flow;
  intakeData: IntakeFormData;
  selectedSourceSet?: SelectedSourceSet;
  classification: CaseClassificationResult;
  routing: RouteDeterminationResult;
  validatedAuthorities: ValidatedCitation[];
  rejectedSources: string[];
  missingFields: string[];
}
