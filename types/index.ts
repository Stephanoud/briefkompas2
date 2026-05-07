import { ReferenceItem } from "@/src/types/references";

export type Flow =
  | "zienswijze"
  | "bezwaar"
  | "beroep_zonder_bezwaar"
  | "beroep_na_bezwaar"
  | "woo";
export type Product = "basis" | "uitgebreid";
export type DecisionDocumentSource = "pdf" | "image";
export type DecisionAnalysisStatus = "read" | "partial" | "failed";
export type DecisionReadability = "high" | "medium" | "low";
export type LetterGenerationMode = "validated" | "safe_generic_ai" | "static_fallback";
export type RechtsmiddelenClausule = "bezwaar" | "beroep" | "zienswijze" | "onbekend";
export type ProcedureAdvice = Flow | "bezwaarfase" | "niet_tijdig_beslissen";
export type AttachmentDocumentKind =
  | "bezwaarbrief"
  | "aanvulling_bezwaar"
  | "zienswijze"
  | "aanvulling_zienswijze"
  | "beroepschrift"
  | "onderliggend_processtuk"
  | "overig";
export type AuthorityVerificationStatus = "verified" | "mixed" | "not_usable";
export type LegalStatementLabel =
  | "letterlijk uit besluit"
  | "letterlijk uit wet"
  | "volgt uit geverifieerde jurisprudentie"
  | "afgeleide interpretatie"
  | "gebruikersstelling / nog niet geverifieerd";

export interface DecisionConsideration {
  passage: string;
  duiding: string;
}

export interface LabeledLegalStatement {
  statement: string;
  label: LegalStatementLabel;
  source?: string;
  note?: string;
}

export interface GroundSupportEntry {
  title: string;
  decisionPassage?: LabeledLegalStatement;
  juridischProbleem: LabeledLegalStatement;
  relevantFeitOfBewijs?: LabeledLegalStatement;
  jurisprudentieOfWet?: LabeledLegalStatement[];
}

export type AdditionalLegalArgumentPrinciple =
  | "zorgvuldigheidsbeginsel"
  | "motiveringsbeginsel"
  | "evenredigheidsbeginsel"
  | "gelijkheidsbeginsel"
  | "persoonlijke omstandigheden"
  | "financiële impact";

export interface AdditionalLegalArgument {
  principle: AdditionalLegalArgumentPrinciple;
  relevance: string;
  support?: string;
  integrationMode: "direct" | "cautious";
  suggestedPhrasing: string;
}

export interface LegalWorkflowProfile {
  module: string;
  document_extraction: {
    required_fields: string[];
    optional_fields: string[];
    red_flags: string[];
    missing_info_triggers: string[];
  };
  classification: {
    decision_type_rules: string[];
    procedure_stage_rules: string[];
    misclassification_risks: string[];
  };
  question_logic: {
    max_questions_per_round: number;
    question_priority_rules: string[];
    sample_questions?: string[];
    do_not_ask_if_already_known: boolean;
  };
  jurisprudence: {
    search_queries: string[];
    must_verify_fields: string[];
    use_only_if_verified: boolean;
    fallback_if_not_verified: string;
  };
  grounds: {
    strongest_case_specific_grounds: string[];
    weak_generic_grounds_to_avoid: string[];
    evidence_hooks: string[];
  };
  hallucination_guards: string[];
  value_add_hooks: string[];
  pre_output_checks: string[];
  abort_or_redirect_conditions: string[];
}

export interface DecisionAnalysisSummary {
  bestuursorgaan?: string | null;
  onderwerp?: string | null;
  rechtsgrond?: string | null;
  besluitInhoud?: string | null;
  termijnen?: string | null;
  rechtsmiddelenclausule?: string | null;
  aandachtspunten?: string[];
  dragendeOverwegingen?: DecisionConsideration[];
  wettelijkeGrondslagen?: string[];
  procedureleAanwijzingen?: string[];
  beleidsReferenties?: string[];
  jurisprudentieReferenties?: string[];
  bijlageReferenties?: string[];
  bijlagenLijst?: string[];
  inventarislijstOfDocumenttabel?: string[];
  correspondentieVerwijzingen?: string[];
}

export interface CaseFileAnalysisSummary {
  module: string;
  procedurefase: string;
  kernconflict: string;
  primaireProcesrisicos: string[];
  ontbrekendeInformatie: string[];
  gerichteCheckvragen: string[];
  onzekerheden: string[];
  toelichting?: string;
  labeledStellingen?: LabeledLegalStatement[];
  groundsMatrix?: GroundSupportEntry[];
  relevanteAanvullendeArgumenten?: AdditionalLegalArgument[];
  workflowProfile?: LegalWorkflowProfile;
  jurisprudentieControle?: {
    verified: number;
    mixed: number;
    notUsable: number;
  };
}

export interface UploadedFileRef {
  name: string;
  size: number;
  type: string;
  path: string;
  extractedText?: string;
  attachmentKind?: AttachmentDocumentKind;
}

export interface IntakeFormData {
  flow: Flow;
  heeftOfficieelBesluit?: boolean;
  hadOntwerpbesluit?: boolean;
  konZienswijzeIndienen?: boolean;
  heeftZienswijzeIngediend?: boolean;
  heeftBezwaarGemaakt?: boolean;
  heeftBeslissingOpBezwaar?: boolean;
  rechtsmiddelenClausule?: RechtsmiddelenClausule;
  nietTijdigBeslissen?: boolean;
  waaromBelanghebbende?: string;
  procedureAdvies?: ProcedureAdvice;
  procedureReden?: string;
  procedureBevestigd?: boolean;
  bestuursorgaan: string;
  datumBesluit?: string;
  kenmerk?: string;
  besluitSamenvatting?: string;
  besluitOnderwerp?: string;
  beslissingOfMaatregel?: string;
  belangrijksteMotivering?: string;
  relevanteTermijn?: string;
  besluitTekst?: string;
  besluitBronType?: DecisionDocumentSource;
  besluitDocumentType?: string;
  besluitAnalyse?: DecisionAnalysisSummary | null;
  besluitAnalyseStatus?: DecisionAnalysisStatus;
  besluitLeeskwaliteit?: DecisionReadability | null;
  categorie?: string;
  doel: string;
  gronden?: string;
  persoonlijkeOmstandigheden?: string;
  eerdereBezwaargronden?: string;
  wooOnderwerp?: string;
  wooPeriode?: string;
  wooDocumenten?: string;
  digitaleVerstrekking?: boolean;
  spoed?: boolean;
  files: {
    besluit?: UploadedFileRef;
    bijlagen?: UploadedFileRef[];
  };
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
}

export interface ChatStep {
  id: string;
  question: string;
  field: keyof IntakeFormData | string;
  required?: boolean;
  validation?: (value: string) => boolean;
  followUp?: (formData: IntakeFormData) => ChatStep | null;
}

export interface GeneratedLetter {
  letterText: string;
  references?: ReferenceItem[];
  generationMode?: LetterGenerationMode;
  guardReasons?: string[];
  caseAnalysis?: CaseFileAnalysisSummary;
}

export interface DecisionExtractionResult {
  datumBesluit?: string | null;
  kenmerk?: string | null;
  samenvatting?: string | null;
  extractedText?: string | null;
  analysisSource?: DecisionDocumentSource | null;
  documentType?: string | null;
  decisionAnalysis?: DecisionAnalysisSummary | null;
  analysisStatus?: DecisionAnalysisStatus;
  readability?: DecisionReadability | null;
  extracted: boolean;
  warning?: string | null;
}

export interface StripeCheckoutData {
  flow: Flow;
  product: Product;
  amount: number;
  currency: string;
}

export interface AppState {
  flow: Flow | null;
  product: Product | null;
  intakeData: IntakeFormData | null;
  currentStep: number;
  isLoading: boolean;
  error: string | null;
  generatedLetter: GeneratedLetter | null;
  sessionId: string | null;
}
