import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

export function formatDate(date: Date | string): string {
  if (typeof date === "string") return date;
  return new Date(date).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getLetterId(): string {
  return `BRIEF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getPriceInCents(product: "basis" | "uitgebreid"): number {
  return product === "basis" ? 795 : 1495;
}

export function getPriceFormatted(product: "basis" | "uitgebreid"): string {
  return product === "basis" ? "€7,95" : "€14,95";
}

export async function generateDocx(letterText: string): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: letterText,
            spacing: {
              line: 240,
              after: 200,
            },
          }),
          new Paragraph({
            text: "",
            spacing: { before: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Dit is een conceptbrief gegenereerd met BriefKompas.nl. Controleer de inhoud zorgvuldig voordat u deze verzendt.",
                italics: true,
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
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
      ? `Bezwaarbrief - ${tier}`
      : `WOO-verzoek - ${tier}`;

  return {
    price_data: {
      currency: "eur",
      product_data: {
        name: name,
        description:
          product === "basis"
            ? "Basisversie met standaard brief"
            : "Uitgebreide versie met extra bijlagen en referenties",
      },
      unit_amount: price,
    },
    quantity: 1,
  };
}

export const DISCLAIMER_TEXT = `BELANGRIJK: Dit is GEEN juridisch advies. BriefKompas.nl biedt voorlichting en hulp bij het opstellen van brieven, maar vervangt geen advocaat. Je bent zelf verantwoordelijk voor de inhoud van je brief. Controleer alles zorgvuldig voordat je indient.`;
