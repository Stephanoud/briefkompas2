"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/Textarea";
import { Alert } from "@/components/index";
import { generateDocx, downloadFile } from "@/lib/utils";
import { Flow } from "@/types";
import { ReferenceItem } from "@/src/types/references";

interface ResultPageProps {
  params: { flow: Flow };
}

export default function ResultPage({ params }: ResultPageProps) {
  const router = useRouter();
  const flow = params.flow as Flow;
  const appStore = useAppStore();
  const generatedReferences: ReferenceItem[] = appStore.generatedLetter?.references || [];

  const [letterText, setLetterText] = useState(
    appStore.generatedLetter?.letterText || ""
  );
  const [manualReferences, setManualReferences] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const getEcliSearchUrl = (ecli: string) =>
    `https://uitspraken.rechtspraak.nl/#zoekresultaten?zoekterm=${encodeURIComponent(ecli)}`;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
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
        finalText += "\n\n--- EIGEN TOEVOEGINGEN ---\n" + manualReferences.trim();
      }

      const blob = await generateDocx(finalText);
      const filename = `${flow === "bezwaar" ? "bezwaarbrief" : "woo-verzoek"}-${
        new Date().toISOString().split("T")[0]
      }.docx`;

      downloadFile(blob, filename);
      setIsDownloading(false);
    } catch (error) {
      console.error("Download error:", error);
      setIsDownloading(false);
    }
  };

  if (!letterText) {
    return (
      <div className="max-w-2xl mx-auto">
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
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Letter Preview */}
          <Card title="Je Brief" subtitle="Pas deze aan naar je wensen">
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

          {/* Extra user references (only for uitgebreid) */}
          {appStore.product === "uitgebreid" && (
            <Card
              title="Eigen toevoegingen (optioneel)"
              subtitle="Voeg zelf extra verwijzingen of notities toe"
            >
              <Textarea
                value={manualReferences}
                onChange={(e) => setManualReferences(e.target.value)}
                className="min-h-32 font-mono text-sm"
                placeholder="Bijv: ECLI:NL:HR:2020:123, artikel 6:233 BW, etc."
              />
            </Card>
          )}

          {/* Disclaimer */}
          <Alert type="warning" title="Aandacht">
            Dit is een conceptbrief. Controleer alles zorgvuldig voordat je deze verzendt.
            BriefKompas levert geen juridisch advies. Je bent zelf verantwoordelijk.
          </Alert>

          {/* Confirmation */}
          <Card>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">
                Ik heb de brief gecontroleerd en ben zelf verantwoordelijk voor de inhoud en
                verzending.
              </span>
            </label>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card title="Verzenden">
            <div className="space-y-3">
              <Button
                onClick={handleDownload}
                disabled={!confirmed || isDownloading}
                isLoading={isDownloading}
                className="w-full"
              >
                {isDownloading ? "Downloaden..." : "Download .docx"}
              </Button>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">Volgende stappen:</h4>
                <ol className="text-xs text-gray-600 space-y-1">
                  <li>1. Download je brief</li>
                  <li>2. Open in Word/LibreOffice</li>
                  <li>3. Controleer gegevens</li>
                  <li>4. Voeg handtekening toe (optioneel)</li>
                  <li>5. Verzend naar bestuursorgaan</li>
                </ol>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-600 font-semibold">
                  ⏰ {flow === "bezwaar" ? "Verzenden binnen 6 weken" : "Geen vaste termijn"}
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
