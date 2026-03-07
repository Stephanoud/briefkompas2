export type CitationValidationResult = {
  allowed: boolean;
  reasons: string[];
};

export const DEFAULT_ALLOWLIST_DOMAINS = [
  "wetten.overheid.nl",
  "overheid.nl",
  "rijksoverheid.nl",
  "iplo.nl",
  "belastingdienst.nl",
  "uwv.nl",
  "cjib.nl",
  "om.nl",
  "rechtspraak.nl",
  "uitspraken.rechtspraak.nl",
  "data.rechtspraak.nl",
  "raadvanstate.nl",
  "herstel.toeslagen.nl",
  "handboek.toeslagen.nl",
] as const;

const ALLOWLIST = new Set<string>(DEFAULT_ALLOWLIST_DOMAINS);

function matchesAllowedHost(host: string, allowedDomains: readonly string[]): boolean {
  return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function isAllowedDomain(url: string, allowedDomains: readonly string[] = DEFAULT_ALLOWLIST_DOMAINS): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return matchesAllowedHost(host, allowedDomains);
  } catch {
    return false;
  }
}

export function isValidDutchEcli(ecli: string): boolean {
  return /^ECLI:NL:[A-Z0-9]+:\d{4}:\d+$/i.test(ecli.trim());
}

export function isAllowedHost(hostname: string): boolean {
  return ALLOWLIST.has(hostname.toLowerCase());
}

export function validateCitation(params: {
  url: string;
  ecli?: string;
  fetchedFromOfficialSource: boolean;
  courtName?: string;
  decisionDate?: string;
  topicMatch: boolean;
  holdingExtracted: boolean;
  allowedDomains?: readonly string[];
}): CitationValidationResult {
  const reasons: string[] = [];
  const allowlist = params.allowedDomains ?? DEFAULT_ALLOWLIST_DOMAINS;

  if (!isAllowedDomain(params.url, allowlist)) {
    reasons.push("domain_not_allowed");
  }

  if (params.ecli && !isValidDutchEcli(params.ecli)) {
    reasons.push("invalid_ecli_format");
  }

  if (params.ecli && !params.fetchedFromOfficialSource) {
    reasons.push("ecli_not_fetched_from_official_source");
  }

  if (params.ecli && !params.courtName) {
    reasons.push("missing_court_name");
  }

  if (params.ecli && !params.decisionDate) {
    reasons.push("missing_decision_date");
  }

  if (params.ecli && !params.topicMatch) {
    reasons.push("topic_mismatch");
  }

  if (params.ecli && !params.holdingExtracted) {
    reasons.push("no_verified_holding_extracted");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
