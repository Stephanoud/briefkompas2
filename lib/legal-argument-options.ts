import { LegalArgumentOptionId, LegalArgumentSelection } from "@/types";

export interface LegalArgumentOption {
  id: LegalArgumentOptionId;
  label: string;
  description: string;
  promptGuidance: string;
  allowsCustomText?: boolean;
}

export interface LegalArgumentPromptItem {
  id: LegalArgumentOptionId;
  label: string;
  guidance: string;
  customText?: string;
}

export const LEGAL_ARGUMENT_OPTIONS: LegalArgumentOption[] = [
  {
    id: "onvoldoende_motivering",
    label: "Onvoldoende motivering",
    description: "Het besluit lijkt mogelijk niet goed uit te leggen waarom deze uitkomst volgt.",
    promptGuidance:
      "Controleer of de gekozen lijn steun vindt in concrete besluitpassages over de motivering en in de intake.",
  },
  {
    id: "onzorgvuldige_voorbereiding",
    label: "Onzorgvuldige voorbereiding",
    description: "Er lijken mogelijk feiten, belangen of stukken niet voldoende te zijn meegenomen.",
    promptGuidance:
      "Gebruik deze lijn alleen als uit het dossier blijkt welke feiten, belangen of stukken mogelijk onvoldoende zijn onderzocht.",
  },
  {
    id: "onevenredige_gevolgen",
    label: "Onevenredige gevolgen",
    description: "De gevolgen voor de gebruiker lijken mogelijk zwaar in verhouding tot het doel.",
    promptGuidance:
      "Koppel deze lijn aan concrete gevolgen uit de intake en formuleer voorzichtig als de gevolgen nog niet zijn onderbouwd.",
  },
  {
    id: "feitelijke_onjuistheden",
    label: "Feitelijke onjuistheden",
    description: "Het besluit lijkt mogelijk uit te gaan van feiten die volgens de gebruiker niet kloppen.",
    promptGuidance:
      "Gebruik deze lijn alleen met concrete feitelijke correcties uit intake, besluitanalyse of uploadnamen.",
  },
  {
    id: "vertrouwensbeginsel",
    label: "Vertrouwensbeginsel",
    description: "Er lijkt mogelijk een eerdere toezegging of verwachting te spelen.",
    promptGuidance:
      "Neem dit alleen op als een concrete toezegging, gedraging of correspondentie uit het dossier blijkt.",
  },
  {
    id: "gelijkheidsbeginsel",
    label: "Gelijkheidsbeginsel",
    description: "Er lijken mogelijk vergelijkbare gevallen anders te zijn behandeld.",
    promptGuidance:
      "Neem dit alleen op als de gebruiker een concreet vergelijkbaar geval of vaste gedragslijn noemt.",
  },
  {
    id: "onvoldoende_belangenafweging",
    label: "Onvoldoende belangenafweging",
    description: "Het besluit lijkt mogelijk belangen niet volledig of niet zichtbaar te wegen.",
    promptGuidance:
      "Koppel deze lijn aan belangen die concreet in intake, besluitanalyse of bijlagen naar voren komen.",
  },
  {
    id: "anders",
    label: "Anders",
    description: "De gebruiker noemt zelf een mogelijke invalshoek.",
    promptGuidance:
      "Gebruik de eigen toelichting alleen als feitelijk aanknopingspunt en presenteer dit niet als juridisch vastgesteld.",
    allowsCustomText: true,
  },
];

const optionById = new Map<LegalArgumentOptionId, LegalArgumentOption>(
  LEGAL_ARGUMENT_OPTIONS.map((option) => [option.id, option])
);

export function getLegalArgumentOption(id: LegalArgumentOptionId): LegalArgumentOption | undefined {
  return optionById.get(id);
}

export function normalizeLegalArgumentSelections(
  selections: LegalArgumentSelection[] | null | undefined
): LegalArgumentSelection[] {
  const seen = new Set<LegalArgumentOptionId>();
  const normalized: LegalArgumentSelection[] = [];

  for (const selection of selections ?? []) {
    const option = optionById.get(selection.id);
    if (!option || seen.has(selection.id)) {
      continue;
    }

    const customText = selection.customText?.replace(/\s+/g, " ").trim();
    if (option.allowsCustomText && !customText) {
      continue;
    }

    normalized.push({
      id: selection.id,
      ...(customText ? { customText } : {}),
    });
    seen.add(selection.id);
  }

  return normalized;
}

export function toLegalArgumentPromptItems(
  selections: LegalArgumentSelection[] | null | undefined
): LegalArgumentPromptItem[] {
  return normalizeLegalArgumentSelections(selections).flatMap((selection) => {
    const option = optionById.get(selection.id);
    if (!option) {
      return [];
    }

    return [
      {
        id: option.id,
        label: option.label,
        guidance: option.promptGuidance,
        ...(selection.customText ? { customText: selection.customText } : {}),
      },
    ];
  });
}

export function buildSelectedLegalArgumentPromptSection(
  selections: LegalArgumentSelection[] | null | undefined
): string {
  const items = toLegalArgumentPromptItems(selections);
  if (items.length === 0) {
    return "";
  }

  return [
    "Mogelijke argumentlijnen van gebruiker (optioneel, geen juridisch advies):",
    "- De gebruiker heeft deze punten zelf aangekruist als mogelijke invalshoeken. Dit zijn geen juridische conclusies en geen voorspelling.",
    "- Verwerk een gekozen invalshoek alleen als intake, besluitanalyse of uploads daar concrete feitelijke steun voor geven.",
    "- Laat een gekozen invalshoek weg als het dossier daarvoor geen basis bevat; maak er geen standaardgrond of checklist van.",
    "- Formuleer voorzichtig bij onzekerheid, bijvoorbeeld met 'lijkt', 'mogelijk' of 'voor zover uit de stukken blijkt'.",
    "Gekozen invalshoeken:",
    ...items.map((item) => {
      const customText = item.customText ? ` Eigen toelichting: ${item.customText}` : "";
      return `- ${item.label}: ${item.guidance}${customText}`;
    }),
  ].join("\n");
}
