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

interface ResultPageProps {
  params: { flow: Flow };
}

export default function ResultPage({ params }: ResultPageProps) {
  const router = useRouter();
  const flow = params.flow as Flow;
  const appStore = useAppStore();

  const [letterText, setLetterText] = useState(
    appStore.generatedLetter?.letterText || ""
  );
  const [references, setReferences] = useState(
    appStore.generatedLetter?.references?.join("\n") || ""
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      let finalText = letterText;

      if (appStore.product === "uitgebreid" && references) {
        finalText += "\n\n--- VERWIJZINGEN & JURISPRUDENTIE ---\n" + references;
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

          {/* References (only for uitgebreid) */}
          {appStore.product === "uitgebreid" && (
            <Card
              title="Verwijzingen & Jurisprudentie (optioneel)"
              subtitle="Voeg relevante rechtszaken of wetten toe"
            >
              <Textarea
                value={references}
                onChange={(e) => setReferences(e.target.value)}
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
