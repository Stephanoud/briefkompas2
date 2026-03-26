import { Flow } from "@/types";
import { bezwaarReferencePacks } from "@/src/data/references/bezwaar";
import { wooCore } from "@/src/data/references/woo/woo-core";
import { ReferenceItem, ReferencePack } from "@/src/types/references";

interface GetReferencesParams {
  flow: Flow;
  orgType?: ReferenceItem["orgType"];
  decisionType?: string;
  keywords?: string[];
  limit?: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function scoreReference(item: ReferenceItem, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const haystack = [item.title, item.topic, item.principle, ...(item.keywords ?? [])]
    .join(" ")
    .toLowerCase();

  return keywords.reduce((score, keyword) => {
    return haystack.includes(keyword) ? score + 1 : score;
  }, 0);
}

function getFlowPacks(flow: Flow): ReferencePack[] {
  if (flow === "woo") {
    return [wooCore];
  }

  if (
    flow === "bezwaar" ||
    flow === "zienswijze" ||
    flow === "beroep_zonder_bezwaar" ||
    flow === "beroep_na_bezwaar"
  ) {
    return bezwaarReferencePacks;
  }

  return [];
}

export function getReferences(params: GetReferencesParams): ReferenceItem[] {
  if (!params?.flow) {
    return [];
  }

  const packs = getFlowPacks(params.flow);
  if (!packs.length) {
    return [];
  }

  const filteredPacks = packs.filter((pack) => {
    if (params.orgType && pack.orgType && pack.orgType !== params.orgType) {
      return false;
    }

    if (
      params.decisionType &&
      pack.decisionType &&
      normalize(pack.decisionType) !== normalize(params.decisionType)
    ) {
      return false;
    }

    return true;
  });

  const allItems = filteredPacks.flatMap((pack) => (Array.isArray(pack.items) ? pack.items : []));
  if (!allItems.length) {
    return [];
  }

  const keywords = Array.from(
    new Set(
      (params.keywords ?? [])
        .map(normalize)
        .filter((keyword) => keyword.length >= 3)
    )
  );

  let selectedItems = allItems;

  if (keywords.length > 0) {
    const scored = allItems
      .map((item) => ({ item, score: scoreReference(item, keywords) }))
      .sort((a, b) => b.score - a.score);

    const withMatches = scored.filter((entry) => entry.score > 0);
    selectedItems = (withMatches.length > 0 ? withMatches : scored).map((entry) => entry.item);
  }

  const limit = typeof params.limit === "number" && params.limit > 0 ? params.limit : selectedItems.length;
  return selectedItems.slice(0, limit);
}
