import { Flow } from "@/types";

export const ALL_FLOWS: Flow[] = [
  "zienswijze",
  "bezwaar",
  "beroep_zonder_bezwaar",
  "beroep_na_bezwaar",
  "woo",
];

export const NON_WOO_FLOWS: Flow[] = ALL_FLOWS.filter((flow) => flow !== "woo");
export const DECISION_FLOWS: Flow[] = ALL_FLOWS.filter((flow) => flow !== "woo" && flow !== "zienswijze");

export function isFlow(value: unknown): value is Flow {
  return typeof value === "string" && ALL_FLOWS.includes(value as Flow);
}

export function isWooFlow(flow: Flow): boolean {
  return flow === "woo";
}

export function usesProcedureCheck(flow: Flow): boolean {
  return flow !== "woo";
}

export function requiresDecisionUpload(flow: Flow): boolean {
  return flow === "bezwaar" || flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar";
}

export function supportsDecisionUpload(flow: Flow): boolean {
  return flow !== "woo";
}

export function getFlowLabel(flow: Flow): string {
  switch (flow) {
    case "zienswijze":
      return "zienswijze";
    case "bezwaar":
      return "bezwaar";
    case "beroep_zonder_bezwaar":
      return "beroep zonder bezwaar";
    case "beroep_na_bezwaar":
      return "beroep na bezwaar";
    case "woo":
      return "WOO-verzoek";
    default:
      return "brief";
  }
}

export function getFlowDocumentLabel(flow: Flow): string {
  switch (flow) {
    case "zienswijze":
      return "zienswijze";
    case "bezwaar":
      return "bezwaarschrift";
    case "beroep_zonder_bezwaar":
      return "beroepschrift";
    case "beroep_na_bezwaar":
      return "beroepschrift";
    case "woo":
      return "WOO-verzoek";
    default:
      return "brief";
  }
}

export function getFlowActionLabel(flow: Flow): string {
  switch (flow) {
    case "zienswijze":
      return "Zienswijze indienen";
    case "bezwaar":
      return "Bezwaar maken";
    case "beroep_zonder_bezwaar":
      return "Beroep zonder bezwaar";
    case "beroep_na_bezwaar":
      return "Beroep na bezwaar";
    case "woo":
      return "WOO-verzoek";
    default:
      return "Start";
  }
}

export function getFlowShortDescription(flow: Flow): string {
  switch (flow) {
    case "zienswijze":
      return "Reageer op een ontwerpbesluit voordat het definitieve besluit wordt genomen.";
    case "bezwaar":
      return "Vecht een primair besluit aan via de standaard bezwaarroute.";
    case "beroep_zonder_bezwaar":
      return "Ga rechtstreeks naar de rechter als bezwaar niet de juiste stap is.";
    case "beroep_na_bezwaar":
      return "Stel beroep in tegen een beslissing op bezwaar.";
    case "woo":
      return "Vraag documenten op bij een bestuursorgaan via de Wet open overheid.";
    default:
      return "";
  }
}

export function getFlowPath(flow: Flow): string {
  return `/intake/${flow}`;
}

export const homepageProcedureOptions = ALL_FLOWS.map((flow) => ({
  flow,
  title: getFlowActionLabel(flow),
  description: getFlowShortDescription(flow),
  href: getFlowPath(flow),
}));
