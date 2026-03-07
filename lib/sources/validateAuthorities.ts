import { validateCitation } from "@/lib/citation-guard";
import { SelectedSourceSet, ValidatedCitation } from "@/lib/legal/types";
import { ReferenceItem } from "@/src/types/references";

function inferSourceUrl(reference: ReferenceItem): string {
  if (reference.ecli || reference.sourceType === "jurisprudentie") {
    return "https://uitspraken.rechtspraak.nl";
  }

  if (reference.sourceType === "wet") {
    return "https://wetten.overheid.nl";
  }

  if (reference.sourceType === "beleid") {
    return "https://rijksoverheid.nl";
  }

  return "https://overheid.nl";
}

function extractDecisionDate(title: string): string | undefined {
  const match = title.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
  if (!match) return undefined;
  return `${match[1]} ${match[2]} ${match[3]}`;
}

function extractCourtName(title: string): string | undefined {
  if (/abrvs/i.test(title)) {
    return "Afdeling bestuursrechtspraak van de Raad van State";
  }
  if (/hr\b/i.test(title)) {
    return "Hoge Raad";
  }
  if (/crvb/i.test(title)) {
    return "Centrale Raad van Beroep";
  }
  return undefined;
}

export function validateAuthorities(params: {
  references: ReferenceItem[];
  sourceSet: SelectedSourceSet;
}): {
  allowedAuthorities: ValidatedCitation[];
  rejectedAuthorities: ValidatedCitation[];
  auditTrail: string[];
} {
  const { references, sourceSet } = params;

  const allowedAuthorities: ValidatedCitation[] = [];
  const rejectedAuthorities: ValidatedCitation[] = [];
  const auditTrail: string[] = [];

  references.forEach((reference) => {
    const sourceUrl = inferSourceUrl(reference);
    const isCaseLaw = Boolean(reference.ecli || reference.sourceType === "jurisprudentie");

    if (isCaseLaw && sourceSet.useCaseLaw !== "only_if_validated") {
      const rejected: ValidatedCitation = {
        ...reference,
        allowed: false,
        reasons: ["case_law_disabled_for_case_type"],
        sourceUrl,
      };
      rejectedAuthorities.push(rejected);
      auditTrail.push(`Citation rejected (${reference.id}): case law disabled for ${sourceSet.caseType}.`);
      return;
    }

    const result = validateCitation({
      url: sourceUrl,
      ecli: reference.ecli,
      // In deze implementatie valideren we zonder externe fetch; daardoor geen geverifieerde jurisprudentie claimen.
      fetchedFromOfficialSource: false,
      courtName: extractCourtName(reference.title),
      decisionDate: extractDecisionDate(reference.title),
      topicMatch: true,
      holdingExtracted: Boolean(reference.principle && reference.principle.length > 20),
      allowedDomains: sourceSet.allowedDomains,
    });

    const validated: ValidatedCitation = {
      ...reference,
      sourceUrl,
      allowed: result.allowed,
      reasons: result.reasons,
    };

    if (validated.allowed) {
      allowedAuthorities.push(validated);
      auditTrail.push(`Citation allowed (${reference.id}).`);
    } else {
      rejectedAuthorities.push(validated);
      auditTrail.push(`Citation rejected (${reference.id}): ${validated.reasons.join(",")}`);
    }
  });

  return {
    allowedAuthorities,
    rejectedAuthorities,
    auditTrail,
  };
}
