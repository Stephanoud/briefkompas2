import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { parseLetterBlocks, LetterBlock } from "@/lib/letter-format";
import { ReferenceItem } from "@/src/types/references";

export interface LetterExportPayload {
  letterText: string;
  generatedReferences?: ReferenceItem[];
  manualReferences?: string;
}

export function formatDate(date: Date | string): string {
  if (typeof date === "string") return date;
  return new Date(date).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getLetterId(): string {
  return `BRIEF-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const TEST_PRICING_LABEL = "test periode";
export const TEST_BYPASS_DISCOUNT_CODE = "Test2026";

export function isTestBypassDiscountCode(code?: string | null): boolean {
  return code?.trim().toLowerCase() === TEST_BYPASS_DISCOUNT_CODE.toLowerCase();
}

export function getPriceInCents(product: "basis" | "uitgebreid"): number {
  void product;
  return 1;
}

export function getPriceFormatted(product: "basis" | "uitgebreid"): string {
  void product;
  return `EUR0,01 (${TEST_PRICING_LABEL})`;
}

function buildSupplementBlocks(payload: LetterExportPayload): LetterBlock[] {
  const blocks: LetterBlock[] = [];

  if (payload.generatedReferences && payload.generatedReferences.length > 0) {
    blocks.push({ type: "heading", text: "Juridische aanknopingspunten" });
    blocks.push({
      type: "list",
      ordered: true,
      items: payload.generatedReferences.map((reference) => {
        const ecliPart = reference.ecli ? ` (${reference.ecli})` : "";
        return `${reference.title}${ecliPart}. Onderwerp: ${reference.topic}. ${reference.principle}`;
      }),
    });
  }

  if (payload.manualReferences?.trim()) {
    blocks.push({ type: "heading", text: "Eigen toevoegingen" });
    blocks.push({
      type: "text",
      lines: payload.manualReferences
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    });
  }

  return blocks;
}

function buildDocumentBlocks(payload: LetterExportPayload): LetterBlock[] {
  return [...parseLetterBlocks(payload.letterText), ...buildSupplementBlocks(payload)];
}

function buildDocxParagraphs(blocks: LetterBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  blocks.forEach((block) => {
    if (block.type === "heading") {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: {
            before: 220,
            after: 90,
          },
          children: [
            new TextRun({
              text: block.text,
              size: 26,
              bold: true,
              font: "Times New Roman",
            }),
          ],
        })
      );
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item, index) => {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: {
              after: 120,
              line: 320,
            },
            indent: {
              left: 360,
              hanging: 200,
            },
            children: [
              new TextRun({
                text: `${block.ordered ? `${index + 1}.` : "-"} ${item}`,
                size: 24,
                font: "Times New Roman",
              }),
            ],
          })
        );
      });
      return;
    }

    block.lines.forEach((line, lineIndex) => {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: {
            line: 320,
            after: lineIndex === block.lines.length - 1 ? 150 : 40,
          },
          children: [
            new TextRun({
              text: line,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
    });
  });

  return paragraphs;
}

export async function generateDocx(payload: LetterExportPayload): Promise<Blob> {
  const paragraphs = buildDocxParagraphs(buildDocumentBlocks(payload));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1260,
              right: 1260,
              bottom: 1260,
              left: 1260,
            },
          },
        },
        children: [
          ...paragraphs,
          new Paragraph({
            spacing: { before: 240 },
            children: [
              new TextRun({
                text: "Dit is een conceptbrief gegenereerd met BriefKompas.nl. Controleer de inhoud zorgvuldig voordat je deze verzendt.",
                italics: true,
                size: 19,
                font: "Times New Roman",
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function generatePdf(payload: LetterExportPayload): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const blocks = buildDocumentBlocks(payload);
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  const margin = 20;
  const lineHeight = 6.2;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const ensurePageSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - margin) {
      return;
    }
    doc.addPage();
    cursorY = margin;
  };

  const writeLines = (lines: string[], x: number, width: number, extraSpacing: number) => {
    lines.forEach((line) => {
      const wrapped = line.trim() ? doc.splitTextToSize(line, width) : [""];

      wrapped.forEach((wrappedLine: string) => {
        ensurePageSpace(lineHeight);
        doc.text(wrappedLine || " ", x, cursorY);
        cursorY += lineHeight;
      });
    });

    cursorY += extraSpacing;
  };

  doc.setFont("times", "normal");
  doc.setFontSize(11.5);

  blocks.forEach((block) => {
    if (block.type === "heading") {
      doc.setFont("times", "bold");
      doc.setFontSize(12.5);
      writeLines([block.text], margin, maxWidth, 2.2);
      doc.setFont("times", "normal");
      doc.setFontSize(11.5);
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item, index) => {
        const prefix = block.ordered ? `${index + 1}. ` : "- ";
        writeLines([`${prefix}${item}`], margin + 4, maxWidth - 4, 0.8);
      });
      cursorY += 1.5;
      return;
    }

    writeLines(block.lines, margin, maxWidth, 2.3);
  });

  doc.setFont("times", "italic");
  doc.setFontSize(9);
  writeLines(
    ["Dit is een conceptbrief gegenereerd met BriefKompas.nl. Controleer de inhoud zorgvuldig voordat je deze verzendt."],
    margin,
    maxWidth,
    0
  );

  const arrayBuffer = doc.output("arraybuffer");
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateStripeLineItem(
  product: "basis" | "uitgebreid",
  flow: "bezwaar" | "woo"
) {
  const price = getPriceInCents(product);
  const tier = product === "basis" ? "basis" : "uitgebreid";
  const name =
    flow === "bezwaar"
      ? `Bezwaarbrief - ${tier} (${TEST_PRICING_LABEL})`
      : `WOO-verzoek - ${tier} (${TEST_PRICING_LABEL})`;

  return {
    price_data: {
      currency: "eur",
      product_data: {
        name,
        description:
          product === "basis"
            ? `Basisversie met standaard brief - ${TEST_PRICING_LABEL}`
            : `Uitgebreide versie met extra bijlagen en referenties - ${TEST_PRICING_LABEL}`,
      },
      unit_amount: price,
    },
    quantity: 1,
  };
}

export const DISCLAIMER_TEXT =
  "BELANGRIJK: Dit is GEEN juridisch advies. BriefKompas.nl biedt voorlichting en hulp bij het opstellen van brieven, maar vervangt geen advocaat. Je bent zelf verantwoordelijk voor de inhoud van je brief. Controleer alles zorgvuldig voordat je indient.";
