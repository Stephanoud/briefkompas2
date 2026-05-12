import { getFlowDocumentLabel, getFlowLabel } from "@/lib/flow";
import { isValidDeliveryEmail, normalizeDeliveryEmail } from "@/lib/delivery-email";
import type {
  Flow,
  GeneratedLetter,
  GeneratedLetterEmailDelivery,
  GeneratedLetterSupportSection,
  IntakeFormData,
  Product,
} from "@/types";

interface SendGeneratedLetterEmailParams {
  to: string;
  flow: Flow;
  product: Product;
  intakeData: IntakeFormData;
  generatedLetter: GeneratedLetter;
}

const isPlaceholder = (value?: string) =>
  !value || value.includes("YOUR_") || value.includes("YOUR-");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatBoolean(value?: boolean): string | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value ? "Ja" : "Nee";
}

function renderRow(label: string, value?: string | null): string {
  if (!hasText(value)) {
    return "";
  }

  return `
    <tr>
      <th align="left" style="width: 32%; padding: 10px 12px; border-bottom: 1px solid #e5ece8; color: #4b635c; font-size: 12px; text-transform: uppercase; letter-spacing: .08em;">${escapeHtml(label)}</th>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5ece8; color: #1d2d2a; font-size: 14px; line-height: 1.55;">${escapeHtml(value)}</td>
    </tr>`;
}

function renderList(title: string, items?: string[]): string {
  const cleanItems = (items ?? []).filter(hasText);
  if (cleanItems.length === 0) {
    return "";
  }

  return `
    <h3 style="margin: 22px 0 8px; color: #1d2d2a; font-size: 16px;">${escapeHtml(title)}</h3>
    <ul style="margin: 0; padding-left: 20px; color: #1d2d2a; font-size: 14px; line-height: 1.65;">
      ${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>`;
}

function renderSupportSections(sections?: GeneratedLetterSupportSection[]): string {
  if (!sections || sections.length === 0) {
    return "";
  }

  return sections
    .map(
      (section) => `
        <div style="margin-top: 14px; padding: 14px; border: 1px solid #e5ece8; border-radius: 12px; background: #ffffff;">
          <h3 style="margin: 0 0 8px; color: #1d2d2a; font-size: 15px;">${escapeHtml(section.title)}</h3>
          <ul style="margin: 0; padding-left: 20px; color: #4b635c; font-size: 14px; line-height: 1.6;">
            ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>`
    )
    .join("");
}

function buildInputRows(params: {
  flow: Flow;
  product: Product;
  intakeData: IntakeFormData;
  generatedLetter: GeneratedLetter;
}): string {
  const { flow, product, intakeData, generatedLetter } = params;
  const analysis = intakeData.besluitAnalyse;
  const rows = [
    renderRow("Traject", getFlowLabel(flow)),
    renderRow("Pakket", product === "uitgebreid" ? "Uitgebreid" : "Basis"),
    renderRow("Bestuursorgaan", intakeData.bestuursorgaan),
    renderRow("Datum besluit", intakeData.datumBesluit),
    renderRow("Kenmerk", intakeData.kenmerk),
    renderRow("Categorie", intakeData.categorie),
    renderRow("Doel", intakeData.doel),
    renderRow("Gronden", intakeData.gronden),
    renderRow("Persoonlijke omstandigheden", intakeData.persoonlijkeOmstandigheden),
    renderRow("Eerdere bezwaargronden", intakeData.eerdereBezwaargronden),
    renderRow("Woo onderwerp", intakeData.wooOnderwerp),
    renderRow("Woo periode", intakeData.wooPeriode),
    renderRow("Woo documenten", intakeData.wooDocumenten),
    renderRow("Digitale verstrekking", formatBoolean(intakeData.digitaleVerstrekking)),
    renderRow("Spoed", formatBoolean(intakeData.spoed)),
    renderRow("Besluitbestand", intakeData.files?.besluit?.name),
    renderRow("Extra bijlagen", (intakeData.files?.bijlagen ?? []).map((file) => file.name).join(", ")),
    renderRow("Uitleesstatus", intakeData.besluitAnalyseStatus),
    renderRow("Leeskwaliteit", intakeData.besluitLeeskwaliteit),
    renderRow("Generatiemodus", generatedLetter.generationMode),
    renderRow("Onderwerp uit besluit", analysis?.onderwerp),
    renderRow("Rechtsgrond uit besluit", analysis?.rechtsgrond),
    renderRow("Besluitinhoud", analysis?.besluitInhoud),
    renderRow("Termijnen", analysis?.termijnen),
    renderRow("Rechtsmiddelenclausule", analysis?.rechtsmiddelenclausule),
  ].join("");

  return `<table style="width: 100%; border-collapse: collapse;">${rows}</table>`;
}

function buildEmailHtml(params: SendGeneratedLetterEmailParams): string {
  const { flow, product, intakeData, generatedLetter } = params;
  const analysis = intakeData.besluitAnalyse;
  const letterLabel = getFlowDocumentLabel(flow);
  const escapedLetter = escapeHtml(generatedLetter.letterText);

  return `
    <!doctype html>
    <html lang="nl">
      <body style="margin: 0; padding: 0; background: #f4f7f5; font-family: Arial, sans-serif; color: #1d2d2a;">
        <div style="max-width: 760px; margin: 0 auto; padding: 28px 16px;">
          <div style="background: #ffffff; border: 1px solid #d8e1da; border-radius: 18px; overflow: hidden;">
            <div style="padding: 24px 28px; background: #12312b; color: #ffffff;">
              <p style="margin: 0 0 8px; font-size: 13px; opacity: .82;">BriefKompas</p>
              <h1 style="margin: 0; font-size: 24px; line-height: 1.25;">Uw gegenereerde ${escapeHtml(letterLabel)}</h1>
            </div>
            <div style="padding: 24px 28px;">
              <p style="margin: 0 0 18px; color: #4b635c; line-height: 1.6;">
                Hieronder vindt u de gegenereerde brief en de gegevens waarop de brief is gebaseerd. Controleer de inhoud altijd voordat u deze verzendt.
              </p>

              <h2 style="margin: 24px 0 12px; color: #1d2d2a; font-size: 18px;">Gegenereerde brief</h2>
              <div style="white-space: pre-wrap; padding: 18px; border: 1px solid #d8e1da; border-radius: 14px; background: #fffef8; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.75;">${escapedLetter}</div>

              <h2 style="margin: 28px 0 12px; color: #1d2d2a; font-size: 18px;">Gebruikte intake en opgehaalde informatie</h2>
              ${buildInputRows({ flow, product, intakeData, generatedLetter })}

              ${renderList("Wettelijke grondslagen", analysis?.wettelijkeGrondslagen)}
              ${renderList("Procedurele aanwijzingen", analysis?.procedureleAanwijzingen)}
              ${renderList("Aandachtspunten uit documentanalyse", analysis?.aandachtspunten)}
              ${renderList("Bijlagenlijst", analysis?.bijlagenLijst)}

              ${
                generatedLetter.supportSections && generatedLetter.supportSections.length > 0
                  ? `<h2 style="margin: 28px 0 12px; color: #1d2d2a; font-size: 18px;">Aandachtsblok</h2>${renderSupportSections(generatedLetter.supportSections)}`
                  : ""
              }
            </div>
          </div>
        </div>
      </body>
    </html>`;
}

function buildEmailText(params: SendGeneratedLetterEmailParams): string {
  const { flow, product, intakeData, generatedLetter } = params;
  return [
    `BriefKompas - ${getFlowDocumentLabel(flow)}`,
    "",
    "GEGENEREERDE BRIEF",
    generatedLetter.letterText,
    "",
    "GEBRUIKTE GEGEVENS",
    `Traject: ${getFlowLabel(flow)}`,
    `Pakket: ${product}`,
    `Bestuursorgaan: ${intakeData.bestuursorgaan ?? ""}`,
    `Datum besluit: ${intakeData.datumBesluit ?? ""}`,
    `Kenmerk: ${intakeData.kenmerk ?? ""}`,
    `Categorie: ${intakeData.categorie ?? ""}`,
    `Doel: ${intakeData.doel ?? ""}`,
    `Gronden: ${intakeData.gronden ?? ""}`,
    `Besluitinhoud: ${intakeData.besluitAnalyse?.besluitInhoud ?? ""}`,
  ].join("\n");
}

export async function sendGeneratedLetterEmail(
  params: SendGeneratedLetterEmailParams
): Promise<GeneratedLetterEmailDelivery> {
  const to = normalizeDeliveryEmail(params.to);
  if (!isValidDeliveryEmail(to)) {
    return {
      to,
      status: "failed",
      message: "Het e-mailadres is ongeldig.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BRIEFKOMPAS_FROM_EMAIL || "BriefKompas <noreply@briefkompas.nl>";

  if (isPlaceholder(apiKey)) {
    return {
      to,
      status: "skipped",
      message: "E-mailprovider is nog niet geconfigureerd op de server.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Uw BriefKompas ${getFlowDocumentLabel(params.flow)}`,
        html: buildEmailHtml(params),
        text: buildEmailText(params),
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      return {
        to,
        status: "failed",
        message: responseText || "De e-mailprovider kon het bericht niet verzenden.",
      };
    }

    return {
      to,
      status: "sent",
      message: "De brief en gebruikte gegevens zijn per e-mail verzonden.",
    };
  } catch (error) {
    return {
      to,
      status: "failed",
      message: error instanceof Error ? error.message : "E-mail verzenden is mislukt.",
    };
  }
}
