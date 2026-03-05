export type ReferenceSourceType = "jurisprudentie" | "wet" | "beleid" | "leidraad";

export interface ReferenceItem {
  id: string;
  title: string;
  sourceType: ReferenceSourceType;
  ecli?: string;
  citation?: string;
  topic: string;
  principle: string;
  keywords?: string[];
  flow: "woo" | "bezwaar";
  orgType?: "gemeente" | "provincie" | "waterschap" | "rijk" | "overig";
  decisionType?: string;
}

export interface ReferencePack {
  packId: string;
  label: string;
  flow: "woo" | "bezwaar";
  orgType?: "gemeente" | "provincie" | "waterschap" | "rijk" | "overig";
  decisionType?: string;
  items: ReferenceItem[];
}
