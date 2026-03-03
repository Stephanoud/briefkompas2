import { create } from "zustand";
import { AppState, Flow, IntakeFormData, Product, GeneratedLetter } from "@/types";

interface AppStore extends AppState {
  setFlow: (flow: Flow) => void;
  setProduct: (product: Product) => void;
  setIntakeData: (data: IntakeFormData) => void;
  setCurrentStep: (step: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setGeneratedLetter: (letter: GeneratedLetter | null) => void;
  setSessionId: (sessionId: string | null) => void;
  reset: () => void;
}

const initialState: AppState = {
  flow: null,
  product: null,
  intakeData: null,
  currentStep: 0,
  isLoading: false,
  error: null,
  generatedLetter: null,
  sessionId: null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setFlow: (flow) => set({ flow }),
  
  setProduct: (product) => set({ product }),
  
  setIntakeData: (data) => set({ intakeData: data }),
  
  setCurrentStep: (step) => set({ currentStep: step }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  setGeneratedLetter: (letter) => set({ generatedLetter: letter }),
  
  setSessionId: (sessionId) => set({ sessionId }),
  
  reset: () => set(initialState),
}));
