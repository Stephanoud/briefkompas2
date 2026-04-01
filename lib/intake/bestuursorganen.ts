type BestuursorgaanScope = "gemeente" | "provincie" | "waterschap" | "rijk" | "overig";

export type BestuursorgaanRecognitionKind =
  | "klassiek_overheid"
  | "zelfstandig_bestuursorgaan"
  | "publieke_taak_bij_privaatrechtelijke_partij"
  | "contextafhankelijk";

export interface BestuursorgaanRegistryEntry {
  canonicalName: string;
  aliases: readonly string[];
  scope: BestuursorgaanScope;
  recognitionKind: BestuursorgaanRecognitionKind;
}

export interface BestuursorgaanMatch extends BestuursorgaanRegistryEntry {
  confidence: "high" | "medium";
}

function titleCase(value: string): string {
  return value.replace(/\b\p{L}+/gu, (part) => part.charAt(0).toUpperCase() + part.slice(1));
}

function cleanDetectedEntitySuffix(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const [beforePunctuation] = normalized.split(/[,:;.!?]/);
  const [beforeVerb] = beforePunctuation.split(
    /\s+(?=(?:heeft|hebben|had|nam|neemt|weigerde|weigert|besloot|besluit|verklaart|verleent|legt|legde|stelt|stelde|namens|kunt|kan|is|zijn)\b)/i
  );
  return titleCase((beforeVerb ?? beforePunctuation).trim());
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "'")
    .replace(/&/g, " en ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAlias(text: string, alias: string): boolean {
  const normalizedAlias = normalizeSearchText(alias);
  if (!normalizedAlias) {
    return false;
  }

  const aliasPattern = escapeRegExp(normalizedAlias).replace(/\\ /g, "\\s+");
  return new RegExp(`(?:^|\\b)${aliasPattern}(?:$|\\b)`, "i").test(text);
}

const registryEntries: readonly BestuursorgaanRegistryEntry[] = [
  {
    canonicalName: "Belastingdienst",
    aliases: ["belastingdienst"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Dienst Toeslagen",
    aliases: ["dienst toeslagen", "toeslagen"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Uitvoeringsinstituut Werknemersverzekeringen (UWV)",
    aliases: ["uitvoeringsinstituut werknemersverzekeringen", "uwv"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Sociale Verzekeringsbank (SVB)",
    aliases: ["sociale verzekeringsbank", "svb"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Dienst Uitvoering Onderwijs (DUO)",
    aliases: ["dienst uitvoering onderwijs", "duo"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Centraal Justitieel Incassobureau (CJIB)",
    aliases: ["centraal justitieel incassobureau", "cjib"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Dienst Wegverkeer (RDW)",
    aliases: ["dienst wegverkeer", "rdw"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Centraal Bureau Rijvaardigheidsbewijzen (CBR)",
    aliases: ["centraal bureau rijvaardigheidsbewijzen", "cbr"],
    scope: "overig",
    recognitionKind: "publieke_taak_bij_privaatrechtelijke_partij",
  },
  {
    canonicalName: "Kamer van Koophandel (KvK)",
    aliases: ["kamer van koophandel", "kvk"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Nederlandse Zorgautoriteit (NZa)",
    aliases: ["nederlandse zorgautoriteit", "nza"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Zorginstituut Nederland",
    aliases: ["zorginstituut nederland"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Centraal Administratie Kantoor (CAK)",
    aliases: ["centraal administratie kantoor", "cak"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Rijksdienst voor Ondernemend Nederland (RVO)",
    aliases: ["rijksdienst voor ondernemend nederland", "rvo"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Immigratie- en Naturalisatiedienst (IND)",
    aliases: ["immigratie- en naturalisatiedienst", "immigratie en naturalisatiedienst", "ind"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Rijksdienst voor Identiteitsgegevens (RvIG)",
    aliases: ["rijksdienst voor identiteitsgegevens", "rvig"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Rijkswaterstaat",
    aliases: ["rijkswaterstaat"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Nederlandse Voedsel- en Warenautoriteit (NVWA)",
    aliases: ["nederlandse voedsel- en warenautoriteit", "nederlandse voedsel en warenautoriteit", "nvwa"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Inspectie Gezondheidszorg en Jeugd (IGJ)",
    aliases: ["inspectie gezondheidszorg en jeugd", "igj"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Inspectie Leefomgeving en Transport (ILT)",
    aliases: ["inspectie leefomgeving en transport", "ilt"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Autoriteit Persoonsgegevens",
    aliases: ["autoriteit persoonsgegevens", "ap"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Autoriteit Consument en Markt (ACM)",
    aliases: ["autoriteit consument en markt", "acm"],
    scope: "overig",
    recognitionKind: "zelfstandig_bestuursorgaan",
  },
  {
    canonicalName: "Autoriteit Financiele Markten (AFM)",
    aliases: ["autoriteit financiele markten", "afm"],
    scope: "overig",
    recognitionKind: "publieke_taak_bij_privaatrechtelijke_partij",
  },
  {
    canonicalName: "De Nederlandsche Bank (DNB)",
    aliases: ["de nederlandsche bank", "dnb"],
    scope: "overig",
    recognitionKind: "publieke_taak_bij_privaatrechtelijke_partij",
  },
  {
    canonicalName: "Ministerie van Algemene Zaken",
    aliases: ["ministerie van algemene zaken"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Binnenlandse Zaken en Koninkrijksrelaties",
    aliases: [
      "ministerie van binnenlandse zaken en koninkrijksrelaties",
      "ministerie van bzk",
      "bzk",
    ],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Buitenlandse Zaken",
    aliases: ["ministerie van buitenlandse zaken"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Defensie",
    aliases: ["ministerie van defensie"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Economische Zaken",
    aliases: ["ministerie van economische zaken", "ministerie van ez"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Financien",
    aliases: ["ministerie van financien"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Infrastructuur en Waterstaat",
    aliases: ["ministerie van infrastructuur en waterstaat", "ministerie van ienw", "ienw"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Justitie en Veiligheid",
    aliases: ["ministerie van justitie en veiligheid", "ministerie van jenv", "jenv"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Landbouw, Visserij, Voedselzekerheid en Natuur",
    aliases: [
      "ministerie van landbouw, visserij, voedselzekerheid en natuur",
      "ministerie van landbouw",
      "ministerie van lvvn",
      "lvvn",
    ],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Onderwijs, Cultuur en Wetenschap",
    aliases: ["ministerie van onderwijs, cultuur en wetenschap", "ministerie van ocw", "ocw"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Sociale Zaken en Werkgelegenheid",
    aliases: ["ministerie van sociale zaken en werkgelegenheid", "ministerie van szw", "szw"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Volksgezondheid, Welzijn en Sport",
    aliases: ["ministerie van volksgezondheid, welzijn en sport", "ministerie van vws", "vws"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Ministerie van Volkshuisvesting en Ruimtelijke Ordening",
    aliases: ["ministerie van volkshuisvesting en ruimtelijke ordening", "ministerie van vro", "vro"],
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Amsterdam",
    aliases: ["gemeente amsterdam"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Rotterdam",
    aliases: ["gemeente rotterdam"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Den Haag",
    aliases: ["gemeente den haag", "gemeente 's-gravenhage", "gemeente s gravenhage"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Utrecht",
    aliases: ["gemeente utrecht"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Eindhoven",
    aliases: ["gemeente eindhoven"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Tilburg",
    aliases: ["gemeente tilburg"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Groningen",
    aliases: ["gemeente groningen"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Almere",
    aliases: ["gemeente almere"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Breda",
    aliases: ["gemeente breda"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Nijmegen",
    aliases: ["gemeente nijmegen"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Enschede",
    aliases: ["gemeente enschede"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Haarlem",
    aliases: ["gemeente haarlem"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Arnhem",
    aliases: ["gemeente arnhem"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Zaanstad",
    aliases: ["gemeente zaanstad"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Amersfoort",
    aliases: ["gemeente amersfoort"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Apeldoorn",
    aliases: ["gemeente apeldoorn"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Gemeente Zwolle",
    aliases: ["gemeente zwolle"],
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Drenthe",
    aliases: ["provincie drenthe"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Flevoland",
    aliases: ["provincie flevoland"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Friesland",
    aliases: ["provincie friesland", "provincie fryslan", "provincie fryslân"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Gelderland",
    aliases: ["provincie gelderland"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Groningen",
    aliases: ["provincie groningen"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Limburg",
    aliases: ["provincie limburg"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Noord-Brabant",
    aliases: ["provincie noord-brabant", "provincie noord brabant"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Noord-Holland",
    aliases: ["provincie noord-holland", "provincie noord holland"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Overijssel",
    aliases: ["provincie overijssel"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Utrecht",
    aliases: ["provincie utrecht"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Zeeland",
    aliases: ["provincie zeeland"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Provincie Zuid-Holland",
    aliases: ["provincie zuid-holland", "provincie zuid holland"],
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Amstel, Gooi en Vecht",
    aliases: ["waterschap amstel, gooi en vecht", "waterschap amstel gooi en vecht", "agv"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Brabantse Delta",
    aliases: ["waterschap brabantse delta"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap De Dommel",
    aliases: ["waterschap de dommel"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Drents Overijsselse Delta",
    aliases: ["waterschap drents overijsselse delta"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Hollandse Delta",
    aliases: ["waterschap hollandse delta"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Limburg",
    aliases: ["waterschap limburg"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Noorderzijlvest",
    aliases: ["waterschap noorderzijlvest"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Rijn en IJssel",
    aliases: ["waterschap rijn en ijssel"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Rivierenland",
    aliases: ["waterschap rivierenland"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Scheldestromen",
    aliases: ["waterschap scheldestromen"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Vallei en Veluwe",
    aliases: ["waterschap vallei en veluwe"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Vechtstromen",
    aliases: ["waterschap vechtstromen"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
  {
    canonicalName: "Waterschap Zuiderzeeland",
    aliases: ["waterschap zuiderzeeland"],
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
  },
] as const;

const rolePatterns: Array<{
  pattern: RegExp;
  scope: BestuursorgaanScope;
  recognitionKind: BestuursorgaanRecognitionKind;
  formatter: (match: RegExpMatchArray) => string;
}> = [
  {
    pattern: /\bcollege van burgemeester en wethouders(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `College van burgemeester en wethouders van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bburgemeester(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Burgemeester van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bgemeenteraad(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Gemeenteraad van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bheffingsambtenaar(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "gemeente",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Heffingsambtenaar van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bprovinciale staten(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Provinciale Staten van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bgedeputeerde staten(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Gedeputeerde Staten van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bcommissaris van de koning(?: in| van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "provincie",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Commissaris van de Koning in ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\balgemeen bestuur(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Algemeen bestuur van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bdagelijks bestuur(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Dagelijks bestuur van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bcollege van dijkgraaf en heemraden(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "waterschap",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `College van dijkgraaf en heemraden van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bomgevingsdienst\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "overig",
    recognitionKind: "contextafhankelijk",
    formatter: (match) => `Omgevingsdienst ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bminister(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Minister van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bstaatssecretaris(?: van)?\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Staatssecretaris van ${cleanDetectedEntitySuffix(match[1])}`,
  },
  {
    pattern: /\bagentschap\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu,
    scope: "rijk",
    recognitionKind: "klassiek_overheid",
    formatter: (match) => `Agentschap ${cleanDetectedEntitySuffix(match[1])}`,
  },
];

const suggestionSet = new Set<string>();
for (const entry of registryEntries) {
  suggestionSet.add(entry.canonicalName);
}
for (const roleSuggestion of [
  "College van burgemeester en wethouders",
  "Burgemeester",
  "Gemeenteraad",
  "Heffingsambtenaar",
  "Provinciale Staten",
  "Gedeputeerde Staten",
  "Commissaris van de Koning",
  "Algemeen bestuur van een waterschap",
  "Dagelijks bestuur van een waterschap",
  "College van dijkgraaf en heemraden",
  "Omgevingsdienst",
]) {
  suggestionSet.add(roleSuggestion);
}

export const bestuursorgaanSuggestions = [...suggestionSet].sort((left, right) => left.localeCompare(right, "nl"));

function buildGenericPublicBodyMatch(text: string): BestuursorgaanMatch | null {
  const genericMatch = text.match(
    /\b(gemeente|provincie|waterschap|ministerie)\s+([a-z0-9\u00c0-\u017f'().,&\- ]{2,})/iu
  );
  if (!genericMatch) {
    return null;
  }

  const bodyType = genericMatch[1].toLowerCase();
  const suffix = titleCase(genericMatch[2].trim().replace(/\s+/g, " "));
  const canonicalName = `${titleCase(bodyType)} ${suffix}`;
  const scope: BestuursorgaanScope =
    bodyType === "gemeente"
      ? "gemeente"
      : bodyType === "provincie"
        ? "provincie"
        : bodyType === "waterschap"
          ? "waterschap"
          : "rijk";

  return {
    canonicalName,
    aliases: [canonicalName],
    scope,
    recognitionKind: "klassiek_overheid",
    confidence: "medium",
  };
}

export function findBestuursorgaanMatch(value: string): BestuursorgaanMatch | null {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return null;
  }

  for (const entry of registryEntries) {
    if (entry.aliases.some((alias) => matchesAlias(normalized, alias))) {
      return { ...entry, confidence: "high" };
    }
  }

  for (const rolePattern of rolePatterns) {
    const match = value.match(rolePattern.pattern);
    if (match?.[1]) {
      const canonicalName = rolePattern.formatter(match);
      return {
        canonicalName,
        aliases: [canonicalName],
        scope: rolePattern.scope,
        recognitionKind: rolePattern.recognitionKind,
        confidence: "medium",
      };
    }
  }

  return buildGenericPublicBodyMatch(value);
}

export function extractBestuursorgaanName(value: string): string | undefined {
  return findBestuursorgaanMatch(value)?.canonicalName;
}

export function detectBestuursorgaanScope(value?: string | null): BestuursorgaanScope | "onbekend" {
  if (!value) {
    return "onbekend";
  }

  const match = findBestuursorgaanMatch(value);
  if (match) {
    return match.scope;
  }

  const normalized = normalizeSearchText(value);
  if (normalized.includes("gemeente")) return "gemeente";
  if (normalized.includes("provincie")) return "provincie";
  if (normalized.includes("waterschap")) return "waterschap";
  if (
    normalized.includes("ministerie") ||
    normalized.includes("rijk") ||
    normalized.includes("belastingdienst") ||
    normalized.includes("inspectie") ||
    normalized.includes("agentschap")
  ) {
    return "rijk";
  }

  return "overig";
}

export function filterBestuursorganen(input: string, maxResults = 12): string[] {
  const query = normalizeSearchText(input);
  if (!query) {
    return bestuursorgaanSuggestions.slice(0, maxResults);
  }

  return bestuursorgaanSuggestions
    .filter((entry) => {
      const normalizedEntry = normalizeSearchText(entry);
      if (normalizedEntry.includes(query)) {
        return true;
      }

      const registryEntry = registryEntries.find((candidate) => candidate.canonicalName === entry);
      return registryEntry?.aliases.some((alias) => normalizeSearchText(alias).includes(query)) ?? false;
    })
    .slice(0, maxResults);
}
