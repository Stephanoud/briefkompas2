declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
  export const VerbosityLevel: {
    ERRORS: number;
  };
  export function getDocument(options: Record<string, unknown>): {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string }>;
        }>;
      }>;
    }>;
  };
}
