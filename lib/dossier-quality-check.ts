import {
  DossierCheckItem,
  DossierCheckLevel,
  DossierQualityCheck,
  IntakeFormData,
} from "@/types";

const MONTH_NAME_ALIASES: Record<string, number> = {
  januari: 0,
  january: 0,
  jan: 0,
  februari: 1,
  february: 1,
  feb: 1,
  maart: 2,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  may: 4,
  juni: 5,
  june: 5,
  jun: 5,
  juli: 6,
  july: 6,
  jul: 6,
  augustus: 7,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  oktober: 9,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const MONTH_NAME_PATTERN = Object.keys(MONTH_NAME_ALIASES)
  .sort((left, right) => right.length - left.length)
  .join("|");

const CONCRETE_ARGUMENT_PATTERN =
  /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|artikel|bijlage|rapport|foto|brief|e-mail|mail|factuur|offerte|verklaring|meting|datum|kenmerk|zaaknummer|adres|perceel|bedrag|gesprek|afspraak|aanvraag|bezwaar)\b/i;

const EVIDENCE_REFERENCE_PATTERN =
  /\b(bijlage|rapport|foto|brief|e-mail|mail|verklaring|factuur|offerte|bewijs|document|stuk|stukken|kenmerk|zaaknummer|meting|advies|aanvraag|beschikking|besluit)\b/i;

export const DOSSIER_CHECK_DISCLAIMER =
  "Deze dossiercheck is een praktische kwaliteitscheck op basis van uw invoer en uploads. Het is geen beoordeling van rechten, geen kansinschatting en geen voorspelling van een uitkomst.";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && normalizeWhitespace(value).length > 0;
}

function wordCount(value: string): number {
  return normalizeWhitespace(value).split(/\s+/).filter(Boolean).length;
}

function joinText(values: Array<string | null | undefined>): string {
  return values.filter(hasText).map(normalizeWhitespace).join(" ");
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseDecisionDate(value?: string | null): Date | null {
  if (!hasText(value)) {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  const numericMatch = normalized.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (numericMatch) {
    const day = Number.parseInt(numericMatch[1], 10);
    const month = Number.parseInt(numericMatch[2], 10) - 1;
    const year = Number.parseInt(numericMatch[3], 10);
    const fullYear = year < 100 ? 2000 + year : year;
    const parsed = new Date(fullYear, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const parsed = new Date(
      Number.parseInt(isoMatch[1], 10),
      Number.parseInt(isoMatch[2], 10) - 1,
      Number.parseInt(isoMatch[3], 10)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const textMatch = normalized.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAME_PATTERN})\\s+(\\d{4})\\b`, "i")
  );
  if (textMatch) {
    const day = Number.parseInt(textMatch[1], 10);
    const month = MONTH_NAME_ALIASES[textMatch[2].toLowerCase()];
    const year = Number.parseInt(textMatch[3], 10);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function getDaysSinceDecision(data: IntakeFormData, now: Date): number | null {
  const decisionDate = parseDecisionDate(data.datumBesluit);
  if (!decisionDate) {
    return null;
  }

  const difference = startOfDay(now).getTime() - startOfDay(decisionDate).getTime();
  return Math.floor(difference / (1000 * 60 * 60 * 24));
}

function getLevelLabel(level: DossierCheckLevel, category: DossierCheckItem["category"]): string {
  if (category === "termijn") {
    if (level === "green") return "Waarschijnlijk op tijd";
    if (level === "orange") return "Mogelijk krap";
    return "Niet goed te duiden";
  }

  if (category === "belanghebbendheid") {
    if (level === "green") return "Lijkt aanwezig";
    if (level === "orange") return "Mogelijk beperkt";
    return "Nog niet duidelijk";
  }

  if (category === "onderbouwing") {
    if (level === "green") return "Waarschijnlijk voldoende";
    if (level === "orange") return "Beperkt";
    return "Weinig concreet";
  }

  if (level === "green") return "Waarschijnlijk voldoende";
  if (level === "orange") return "Beperkt";
  return "Weinig ondersteuning";
}

function scoreTermijn(data: IntakeFormData, now: Date): DossierCheckItem {
  const daysSinceDecision = getDaysSinceDecision(data, now);

  if (daysSinceDecision === null) {
    return {
      category: "termijn",
      title: "Termijn",
      level: "orange",
      label: getLevelLabel("orange", "termijn"),
      explanation:
        "De besluitdatum is niet goed genoeg bekend om de tijdlijn praktisch te plaatsen.",
      signals: ["Besluitdatum ontbreekt of is niet goed leesbaar", `Vandaag: ${now.toLocaleDateString("nl-NL")}`],
    };
  }

  const level: DossierCheckLevel =
    daysSinceDecision <= 35 ? "green" : daysSinceDecision <= 49 ? "orange" : "red";

  return {
    category: "termijn",
    title: "Termijn",
    level,
    label: getLevelLabel(level, "termijn"),
    explanation:
      "Gebaseerd op de datum van het besluit en de huidige datum. Dit rekent geen wettelijke termijn definitief uit.",
    signals: [
      `Besluitdatum: ${data.datumBesluit}`,
      `Vandaag: ${now.toLocaleDateString("nl-NL")}`,
      `${Math.max(daysSinceDecision, 0)} dagen sinds de besluitdatum`,
    ],
  };
}

function scoreBelanghebbendheid(data: IntakeFormData): DossierCheckItem {
  const relationText = joinText([
    data.waaromBelanghebbende,
    data.persoonlijkeOmstandigheden,
    data.besluitAnalyse?.onderwerp,
  ]);
  const words = wordCount(relationText);
  const hasConcreteRelation =
    /\b(aanvrager|eigenaar|bewoner|omwonende|huurder|verzoeker|geadresseerde|ouder|werkgever|werknemer|belang|direct geraakt|naastgelegen|perceel|woning|bedrijf)\b/i.test(
      relationText
    );
  const level: DossierCheckLevel =
    words >= 18 && hasConcreteRelation ? "green" : words >= 8 || hasConcreteRelation ? "orange" : "red";

  return {
    category: "belanghebbendheid",
    title: "Belanghebbendheid",
    level,
    label: getLevelLabel(level, "belanghebbendheid"),
    explanation:
      "Gebaseerd op wat u invulde over uw relatie tot het besluit of de gevolgen voor u.",
    signals: [
      words > 0 ? `${words} woorden over relatie/gevolgen` : "Geen duidelijke relatie tot het besluit ingevuld",
      hasConcreteRelation ? "Concrete rol of geraakt belang genoemd" : "Concrete rol nog beperkt zichtbaar",
    ],
  };
}

function scoreOnderbouwing(data: IntakeFormData): DossierCheckItem {
  const argumentText = joinText([
    data.gronden,
    data.doel,
    data.persoonlijkeOmstandigheden,
    data.eerdereBezwaargronden,
  ]);
  const words = wordCount(argumentText);
  const concreteSignals = argumentText
    .split(/[.;\n]/)
    .filter((part) => CONCRETE_ARGUMENT_PATTERN.test(part)).length;
  const level: DossierCheckLevel =
    words >= 90 && concreteSignals >= 2 ? "green" : words >= 30 || concreteSignals >= 1 ? "orange" : "red";

  return {
    category: "onderbouwing",
    title: "Onderbouwing",
    level,
    label: getLevelLabel(level, "onderbouwing"),
    explanation:
      "Gebaseerd op lengte en concreetheid van uw toelichting, zoals data, stukken, feiten of voorbeelden.",
    signals: [
      words > 0 ? `${words} woorden toelichting` : "Nog weinig toelichting ingevuld",
      concreteSignals > 0
        ? `${concreteSignals} concrete verwijzing(en) in de toelichting`
        : "Nog weinig concrete feiten of voorbeelden herkend",
    ],
  };
}

function scoreBewijsstukken(data: IntakeFormData): DossierCheckItem {
  const attachments = data.files?.bijlagen ?? [];
  const hasDecisionUpload = Boolean(data.files?.besluit);
  const evidenceText = joinText([
    data.gronden,
    data.persoonlijkeOmstandigheden,
    data.eerdereBezwaargronden,
    data.besluitSamenvatting,
    ...(data.besluitAnalyse?.bijlageReferenties ?? []),
    ...(data.besluitAnalyse?.bijlagenLijst ?? []),
  ]);
  const referenceCount = evidenceText
    .split(/[.;,\n]/)
    .filter((part) => EVIDENCE_REFERENCE_PATTERN.test(part)).length;
  const supportScore = attachments.length * 2 + referenceCount + (hasDecisionUpload ? 1 : 0);
  const level: DossierCheckLevel =
    supportScore >= 5 ? "green" : supportScore >= 2 ? "orange" : "red";

  return {
    category: "bewijsstukken",
    title: "Bewijsstukken",
    level,
    label: getLevelLabel(level, "bewijsstukken"),
    explanation:
      "Gebaseerd op uploads en verwijzingen naar stukken in uw toelichting of besluitanalyse.",
    signals: [
      hasDecisionUpload ? "Besluitbestand aanwezig" : "Geen besluitbestand zichtbaar",
      `${attachments.length} extra upload(s)`,
      referenceCount > 0
        ? `${referenceCount} verwijzing(en) naar stukken`
        : "Weinig verwijzingen naar stukken herkend",
    ],
  };
}

export function buildDossierQualityCheck(
  data: IntakeFormData,
  now: Date = new Date()
): DossierQualityCheck {
  return {
    items: [
      scoreTermijn(data, now),
      scoreBelanghebbendheid(data),
      scoreOnderbouwing(data),
      scoreBewijsstukken(data),
    ],
    generatedAt: now.toISOString(),
    disclaimer: DOSSIER_CHECK_DISCLAIMER,
  };
}
