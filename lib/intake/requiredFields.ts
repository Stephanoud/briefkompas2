import { Flow, IntakeFormData } from "@/types";

const requiredByFlow: Record<Flow, Array<keyof IntakeFormData>> = {
  zienswijze: ["bestuursorgaan", "besluitSamenvatting", "persoonlijkeOmstandigheden", "doel", "gronden"],
  bezwaar: ["bestuursorgaan", "categorie", "doel", "gronden"],
  beroep_zonder_bezwaar: ["bestuursorgaan", "categorie", "doel", "gronden"],
  beroep_na_bezwaar: ["bestuursorgaan", "categorie", "eerdereBezwaargronden", "doel", "gronden"],
  woo: ["bestuursorgaan", "wooOnderwerp", "wooPeriode", "wooDocumenten"],
};

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  return Boolean(value);
}

export function getMissingRequiredFields(flow: Flow, data: IntakeFormData): string[] {
  return requiredByFlow[flow].filter((field) => !hasMeaningfulValue(data[field])) as string[];
}
