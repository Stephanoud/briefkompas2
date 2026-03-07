import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";

function normalizeLetterLines(letterText: string): string[] {
  return letterText.replace(/\r\n/g, "\n").split("\n");
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

export function getPriceInCents(product: "basis" | "uitgebreid"): number {
  void product;
  return 1;
}

export function getPriceFormatted(product: "basis" | "uitgebreid"): string {
  void product;
  return `EUR0,01 (${TEST_PRICING_LABEL})`;
}

export async function generateDocx(letterText: string): Promise<Blob> {
  const paragraphs = normalizeLetterLines(letterText).map((line) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: {
        line: 300,
        after: line.trim() ? 120 : 80,
      },
      children: [
        new TextRun({
          text: line || " ",
          size: 22,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          ...paragraphs,
          new Paragraph({
            spacing: { before: 240 },
            children: [
              new TextRun({
                text: "Dit is een conceptbrief gegenereerd met BriefKompas.nl. Controleer de inhoud zorgvuldig voordat je deze verzendt.",
                italics: true,
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function generatePdf(letterText: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  const margin = 18;
  const lineHeight = 6;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const writeParagraph = (paragraph: string, extraSpacing = 2) => {
    const lines = paragraph.trim() ? doc.splitTextToSize(paragraph, maxWidth) : [""];

    for (const line of lines) {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }

      doc.text(line || " ", margin, cursorY);
      cursorY += lineHeight;
    }

    cursorY += extraSpacing;
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  for (const line of normalizeLetterLines(letterText)) {
    writeParagraph(line);
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  writeParagraph(
    "Dit is een conceptbrief gegenereerd met BriefKompas.nl. Controleer de inhoud zorgvuldig voordat je deze verzendt.",
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
