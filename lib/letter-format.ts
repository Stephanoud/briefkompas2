export type LetterBlock =
  | { type: "heading"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "text"; lines: string[] };

const DELIVERY_META_HEADINGS = new Set(
  [
    "afzender met placeholders",
    "adresblok bestuursorgaan",
    "betreft-regel",
    "datumregel",
    "slotformule",
  ].map((heading) => heading.toLowerCase())
);

const DELIVERY_EXCLUDED_PATTERNS = [
  /dit is (een )?conceptbrief/i,
  /gegenereerd met briefkompas/i,
  /briefkompas(?:\.nl)?/i,
  /geen juridisch advies/i,
  /controleer (?:alle gegevens|de inhoud|alles) zorgvuldig/i,
  /voordat je (?:deze|dit|de brief) verzendt/i,
  /\bje bent zelf verantwoordelijk\b/i,
  /\bik ben zelf verantwoordelijk\b/i,
  /\bik heb de brief gecontroleerd\b/i,
  /aansprakelijkheidsmelding/i,
  /hoe te gebruiken/i,
];

const KNOWN_HEADINGS = new Set(
  [
    "aan",
    "inleiding",
    "feiten en besluit",
    "bestreden besluit",
    "gronden van bezwaar",
    "bezwaargronden",
    "verzoek",
    "slot",
    "bijlagenoverzicht",
    "juridische aanknopingspunten",
    "eigen toevoegingen",
    "verzoek onder de woo",
    "feitelijke omschrijving",
    "periode en documenten",
  ].map((heading) => heading.toLowerCase())
);

const ORDERED_LIST_PATTERN = /^\d+\.\s+/;
const UNORDERED_LIST_PATTERN = /^[-*]\s+/;

function stripInlineMarkdown(line: string): string {
  return line
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .trimEnd();
}

function isHeadingCandidate(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.replace(/[:.]$/, "").trim().toLowerCase();
  if (KNOWN_HEADINGS.has(normalized)) {
    return true;
  }

  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "");
  return lettersOnly.length >= 4 && trimmed === trimmed.toUpperCase();
}

function shouldExcludeLineFromDelivery(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.replace(/[:.]$/, "").trim().toLowerCase();
  if (DELIVERY_META_HEADINGS.has(normalized)) {
    return true;
  }

  return DELIVERY_EXCLUDED_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function sanitizeLetterText(letterText: string): string {
  const normalized = letterText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (/^```/.test(trimmed) || /^-{3,}$/.test(trimmed)) {
        return "";
      }
      return stripInlineMarkdown(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized;
}

export function cleanLetterTextForDelivery(letterText: string): string {
  const sanitized = sanitizeLetterText(letterText);
  if (!sanitized) {
    return "";
  }

  return sanitized
    .split("\n")
    .filter((line) => !shouldExcludeLineFromDelivery(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toTextBlock(lines: string[]): LetterBlock | null {
  const cleanedLines = lines.map((line) => line.trim()).filter(Boolean);
  if (cleanedLines.length === 0) {
    return null;
  }

  if (cleanedLines.every((line) => ORDERED_LIST_PATTERN.test(line))) {
    return {
      type: "list",
      ordered: true,
      items: cleanedLines.map((line) => line.replace(ORDERED_LIST_PATTERN, "").trim()),
    };
  }

  if (cleanedLines.every((line) => UNORDERED_LIST_PATTERN.test(line))) {
    return {
      type: "list",
      ordered: false,
      items: cleanedLines.map((line) => line.replace(UNORDERED_LIST_PATTERN, "").trim()),
    };
  }

  return {
    type: "text",
    lines: cleanedLines,
  };
}

export function parseLetterBlocks(letterText: string): LetterBlock[] {
  const sanitized = cleanLetterTextForDelivery(letterText);
  if (!sanitized) {
    return [];
  }

  const groups = sanitized
    .split(/\n{2,}/)
    .map((group) => group.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((group) => group.length > 0);

  const blocks: LetterBlock[] = [];

  groups.forEach((group) => {
    if (group.length === 1 && isHeadingCandidate(group[0])) {
      blocks.push({ type: "heading", text: group[0].trim() });
      return;
    }

    if (group.length > 1 && isHeadingCandidate(group[0])) {
      blocks.push({ type: "heading", text: group[0].trim() });
      const trailingBlock = toTextBlock(group.slice(1));
      if (trailingBlock) {
        blocks.push(trailingBlock);
      }
      return;
    }

    const block = toTextBlock(group);
    if (block) {
      blocks.push(block);
    }
  });

  return blocks;
}
