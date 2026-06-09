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
  return flow !== "woo";
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

export function inferFlowFromProcedureText(value: string): Flow | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  const isExactly = (candidate: string) => normalized === candidate;
  const hasRouteIntentBefore = (routeWord: string) =>
    new RegExp(`\\b(wil|wilt|willen|ga|gaan|moet|moeten|kies|gebruik)\\b.{0,50}\\b${routeWord}\\b`, "i").test(
      normalized
    );
  const hasRouteIntentAfter = (routeWord: string) =>
    new RegExp(`\\b${routeWord}\\b.{0,50}\\b(indienen|instellen|aantekenen|maken|doen|gebruiken|kiezen)\\b`, "i").test(
      normalized
    );

  const mentionsWoo = /\b(woo|wob|wet open overheid)\b/.test(normalized);
  if (
    mentionsWoo &&
    (isExactly("woo") ||
      /\b(woo-verzoek|woo verzoek|wob-verzoek|wob verzoek|wet open overheid|documenten opvragen)\b/.test(
        normalized
      ) ||
      hasRouteIntentBefore("woo") ||
      hasRouteIntentAfter("woo"))
  ) {
    return "woo";
  }

  const mentionsBeroep = /\b(beroep|beroepschrift|rechtbank|rechter)\b/.test(normalized);
  const negatesBeroep = /\b(niet|geen)\s+(?:in\s+)?beroep\b/.test(normalized);
  const explicitBeroep =
    mentionsBeroep &&
    !negatesBeroep &&
    (isExactly("beroep") ||
      /\b(in beroep|beroep instellen|beroep indienen|beroep aantekenen|beroepschrift)\b/.test(normalized) ||
      /\b(rechtstreeks|direct|zonder bezwaar)\s+beroep\b/.test(normalized) ||
      /\bberoep\b.{0,50}\b(rechtstreeks|direct|zonder bezwaar)\b/.test(normalized) ||
      /\b(wil|wilt|willen|ga|gaan|moet|moeten)\b.{0,50}\b(rechtbank|rechter)\b/.test(normalized) ||
      /\b(niet|geen)\s+(?:eerst\s+)?bezwaar(?:\s+(?:maken|indienen|aantekenen))?\b/.test(normalized) ||
      hasRouteIntentBefore("beroep") ||
      hasRouteIntentAfter("beroep"));

  if (explicitBeroep) {
    if (
      /\b(na bezwaar|beslissing op bezwaar|besluit op bezwaar|op mijn bezwaar beslist|op ons bezwaar beslist)\b/.test(
        normalized
      ) &&
      !/\b(zonder bezwaar|rechtstreeks beroep|direct beroep)\b/.test(normalized)
    ) {
      return "beroep_na_bezwaar";
    }

    return "beroep_zonder_bezwaar";
  }

  const mentionsZienswijze = /\bzienswijze(n)?\b/.test(normalized);
  if (
    mentionsZienswijze &&
    (isExactly("zienswijze") ||
      /\bzienswijze\b.{0,50}\b(indienen|naar voren brengen|geven|gebruiken|kiezen)\b/.test(normalized) ||
      /\b(wil|wilt|willen|ga|gaan|moet|moeten|kies|gebruik)\b.{0,50}\bzienswijze\b/.test(normalized) ||
      /\b(ontwerpbesluit|ontwerpbeschikking)\b/.test(normalized))
  ) {
    return "zienswijze";
  }

  const mentionsBezwaar = /\b(bezwaar|bezwaarschrift)\b/.test(normalized);
  const negatesBezwaar =
    /\b(niet|geen)\s+(?:eerst\s+)?bezwaar(?:\s+(?:maken|indienen|aantekenen))?\b/.test(normalized) ||
    /\bzonder bezwaar\b/.test(normalized);

  if (
    mentionsBezwaar &&
    !negatesBezwaar &&
    (isExactly("bezwaar") ||
      /\bbezwaar\b.{0,50}\b(maken|indienen|aantekenen|gebruiken|kiezen)\b/.test(normalized) ||
      /\b(wil|wilt|willen|ga|gaan|moet|moeten|kies|gebruik)\b.{0,50}\bbezwaar\b/.test(normalized) ||
      /\bbezwaarschrift\b/.test(normalized))
  ) {
    return "bezwaar";
  }

  return null;
}

export const homepageProcedureOptions = ALL_FLOWS.map((flow) => ({
  flow,
  title: getFlowActionLabel(flow),
  description: getFlowShortDescription(flow),
  href: getFlowPath(flow),
}));

export const homepageEntryOptions = [
  {
    title: "Zienswijze indienen",
    description: "Reageer op een ontwerpbesluit voordat een definitief besluit wordt genomen.",
    href: "/intake/zienswijze",
    flow: "zienswijze" as const,
  },
  {
    title: "Bezwaar maken",
    description: "Maak bezwaar tegen een besluit van een bestuursorgaan.",
    href: "/intake/bezwaar",
    flow: "bezwaar" as const,
  },
  {
    title: "Beroep instellen",
    description: "Ga naar de rechter als beroep openstaat of na een beslissing op bezwaar.",
    href: "/intake/beroep",
    flow: "beroep_zonder_bezwaar" as const,
  },
  {
    title: "WOO-verzoek doen",
    description: "Vraag documenten op bij een bestuursorgaan via de Wet open overheid.",
    href: "/intake/woo",
    flow: "woo" as const,
  },
];

export function resolveFlowFromRoute(value: string | null | undefined): Flow | null {
  if (!value) {
    return null;
  }

  if (value === "beroep") {
    return "beroep_zonder_bezwaar";
  }

  return isFlow(value) ? value : null;
}
