import { ReferenceItem } from "@/src/types/references";

export type Flow = "bezwaar" | "woo";
export type Product = "basis" | "uitgebreid";

export interface UploadedFileRef {
  name: string;
  size: number;
  type: string;
  path: string;
}

export interface IntakeFormData {
  flow: Flow;
  bestuursorgaan: string;
  datumBesluit?: string;
  kenmerk?: string;
  categorie?: string;
  doel: string;
  gronden?: string;
  persoonlijkeOmstandigheden?: string;
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
