"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/Textarea";
import { Alert } from "@/components/index";
import { downloadFile, generateDocx, generatePdf } from "@/lib/utils";
import { Flow } from "@/types";
import { ReferenceItem } from "@/src/types/references";

type DownloadFormat = "docx" | "pdf";

export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ flow: string }>();
  const rawFlow = params?.flow;
  const flow = (Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) as Flow;
  const appStore = useAppStore();
  const generatedReferences: ReferenceItem[] = appStore.generatedLetter?.references || [];

  const [letterText, setLetterText] = useState(appStore.generatedLetter?.letterText || "");
  const [manualReferences, setManualReferences] = useState("");
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const getEcliSearchUrl = (ecli: string) =>
    `https://uitspraken.rechtspraak.nl/#zoekresultaten?zoekterm=${encodeURIComponent(ecli)}`;

  const buildExportText = () => {
    let finalText = letterText;

    if (generatedReferences.length > 0) {
      const referenceText = generatedReferences
        .map((reference, index) => {
          const ecliPart = reference.ecli ? ` (${reference.ecli})` : "";
          return `${index + 1}. ${reference.title}${ecliPart}\nTopic: ${reference.topic}\nToepasregel: ${reference.principle}`;
        })
        .join("\n\n");

      finalText += `\n\n--- BRONNEN / JURISPRUDENTIE ---\n${referenceText}`;
    }

    if (appStore.product === "uitgebreid" && manualReferences.trim()) {
      finalText += `\n\n--- EIGEN TOEVOEGINGEN ---\n${manualReferences.trim()}`;
    }

    return finalText;
  };

  const handleDownload = async (format: DownloadFormat) => {
    try {
      setDownloadFormat(format);

      const finalText = buildExportText();
      const filenameBase = `${flow === "bezwaar" ? "bezwaarbrief" : "woo-verzoek"}-${
        new Date().toISOString().split("T")[0]
      }`;

      const blob =
        format === "pdf"
          ? await generatePdf(finalText)
          : await generateDocx(finalText);

      downloadFile(blob, `${filenameBase}.${format}`);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloadFormat(null);
    }
  };

  if (!letterText) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert type="error" title="Fout">
          Geen brief gegenereerd. Ga terug en probeer opnieuw.
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          Terug naar start
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card title="Je brief" subtitle="Pas deze aan naar je wensen">
            <Textarea
              value={letterText}
              onChange={(e) => setLetterText(e.target.value)}
              className="min-h-96 font-mono text-sm"
              placeholder="Brief content"
            />
          </Card>

          {generatedReferences.length > 0 && (
            <Card title="Bronnen / jurisprudentie" subtitle="Bronnen die beschikbaar zijn voor deze brief">
              <div className="space-y-4">
                {generatedReferences.map((reference) => (
                  <article
                    key={reference.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3"
                  >
                    <h4 className="text-sm font-semibold text-[var(--foreground)]">{reference.title}</h4>
                    {reference.ecli && (
                      <a
                        href={getEcliSearchUrl(reference.ecli)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-[var(--brand)] hover:underline"
                      >
                        {reference.ecli}
                      </a>
                    )}
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      <span className="font-semibold text-[var(--foreground)]">Topic:</span> {reference.topic}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{reference.principle}</p>
                  </article>
                ))}
              </div>
            </Card>
          )}

          {appStore.product === "uitgebreid" && (
            <Card title="Eigen toevoegingen (optioneel)" subtitle="Voeg zelf extra verwijzingen of notities toe">
              <Textarea
                value={manualReferences}
                onChange={(e) => setManualReferences(e.target.value)}
                className="min-h-32 font-mono text-sm"
                placeholder="Bijv: ECLI:NL:HR:2020:123, artikel 6:233 BW, etc."
              />
            </Card>
          )}

          <Alert type="warning" title="Aandacht">
            Dit is een conceptbrief. Controleer alles zorgvuldig voordat je deze verzendt. BriefKompas
            levert geen juridisch advies. Je bent zelf verantwoordelijk.
          </Alert>

          <Card>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 cursor-pointer rounded"
              />
              <span className="text-sm text-gray-600">
                Ik heb de brief gecontroleerd en ben zelf verantwoordelijk voor de inhoud en verzending.
              </span>
            </label>
          </Card>
        </div>

        <div>
          <Card title="Verzenden">
            <div className="space-y-3">
              <Button
                onClick={() => handleDownload("pdf")}
                disabled={!confirmed || downloadFormat !== null}
                isLoading={downloadFormat === "pdf"}
                className="w-full"
              >
                {downloadFormat === "pdf" ? "PDF maken..." : "Download PDF"}
              </Button>

              <Button
                variant="secondary"
                onClick={() => handleDownload("docx")}
                disabled={!confirmed || downloadFormat !== null}
                isLoading={downloadFormat === "docx"}
                className="w-full"
              >
                {downloadFormat === "docx" ? "DOCX maken..." : "Download DOCX"}
              </Button>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="mb-2 text-sm font-semibold text-gray-900">Volgende stappen:</h4>
                <ol className="space-y-1 text-xs text-gray-600">
                  <li>1. Download je brief als PDF of DOCX</li>
                  <li>2. Controleer persoonsgegevens en inhoud</li>
                  <li>3. Voeg handtekening toe als dat nodig is</li>
                  <li>4. Verstuur de brief naar het bestuursorgaan</li>
                </ol>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-600">
                  {flow === "bezwaar" ? "Verzenden binnen 6 weken" : "Geen vaste termijn"}
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => router.push("/")}
              className="w-full"
            >
              Terug naar start
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
