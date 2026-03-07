import { isAllowedDomain } from "@/lib/citation-guard";
import { SelectedSourceSet } from "@/lib/legal/types";

export interface SourceSetValidationResult {
  ok: boolean;
  reasons: string[];
  rejectedSources: string[];
}

export function validateSourceSet(sourceSet: SelectedSourceSet | null): SourceSetValidationResult {
  if (!sourceSet) {
    return {
      ok: false,
      reasons: ["missing_or_incompatible_source_set"],
      rejectedSources: [],
    };
  }

  const rejectedSources = sourceSet.primarySources
    .filter((source) => !isAllowedDomain(source.url, sourceSet.allowedDomains))
    .map((source) => source.url);

  if (rejectedSources.length > 0) {
    return {
      ok: false,
      reasons: ["source_domain_not_in_allowlist"],
      rejectedSources,
    };
  }

  if (sourceSet.primarySources.length === 0) {
    return {
      ok: false,
      reasons: ["empty_primary_source_set"],
      rejectedSources: [],
    };
  }

  return {
    ok: true,
    reasons: [],
    rejectedSources: [],
  };
}
