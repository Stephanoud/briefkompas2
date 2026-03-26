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

export interface DecisionAnalysisSummary {
  bestuursorgaan?: string | null;
  onderwerp?: string | null;
  rechtsgrond?: string | null;
  besluitInhoud?: string | null;
  termijnen?: string | null;
  aandachtspunten?: string[];
}

export interface UploadedFileRef {
  name: string;
  size: number;
  type: string;
  path: string;
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
