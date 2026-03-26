"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getFlowDocumentLabel, getFlowLabel, isFlow } from "@/lib/flow";
import { readStoredGeneratedLetter } from "@/lib/generatedLetterSession";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { LetterPreview, Textarea, LoadingSpinner } from "@/components";
import { Alert } from "@/components/index";
import { downloadFile, generateDocx, generatePdf } from "@/lib/utils";
import { cleanLetterTextForDelivery } from "@/lib/letter-format";
import {
  DecisionAnalysisStatus,
  DecisionAnalysisSummary,
  Flow,
  GeneratedLetter,
  IntakeFormData,
  LetterGenerationMode,
} from "@/types";
import { ReferenceItem } from "@/src/types/references";

type DownloadFormat = "docx" | "pdf";

function getLetterChecklist(flow: Flow): string[] {
  if (flow === "woo") {
    return [
      "welk bestuursorgaan je aanspreekt",
      "welke documenten of informatie je vraagt",
      "over welke periode het verzoek gaat",
      "of je digitale verstrekking en een ontvangstbevestiging vraagt",
    ];
  }

  if (flow === "zienswijze") {
    return [
      "op welk ontwerpbesluit je reageert",
      "welke belangen jou raken",
      "welke inhoudelijke zienswijzen je naar voren brengt",
      "welke aanpassing van het ontwerpbesluit je vraagt",
    ];
  }

  if (flow === "beroep_zonder_bezwaar") {
    return [
      "welk besluit je aanvecht, inclusief datum en kenmerk",
      "waarom direct beroep mogelijk is",
      "waarom het besluit volgens jou onjuist is",
      "wat je de rechtbank concreet vraagt",
    ];
  }

  if (flow === "beroep_na_bezwaar") {
    return [
      "tegen welke beslissing op bezwaar je opkomt",
      "welke bezwaren al eerder zijn aangevoerd",
      "waarom de beslissing op bezwaar volgens jou tekortschiet",
      "wat je de rechtbank concreet vraagt",
    ];
  }

  return [
    "welke beslissing je aanvecht, inclusief datum en kenmerk",
    "waarom je het niet eens bent met die beslissing",
    "wat volgens jou de juiste uitkomst moet zijn",
    "eventueel een verzoek om een hoorzitting of om uitvoering op te schorten",
  ];
}

function getDeliveryChecklist(flow: Flow): string[] {
  if (flow === "woo") {
    return [
      "controleer bestuursorgaan, onderwerp en periode nog een keer",
      "voeg alleen extra notities of bijlagen toe als die echt nodig zijn",
      "bewaar een kopie van je verzoek en de verzendbevestiging",
      "verstuur het verzoek via het kanaal dat het bestuursorgaan accepteert",
    ];
  }

  if (flow === "zienswijze") {
    return [
      "controleer de reactietermijn uit de publicatie of begeleidende brief",
      "voeg relevante stukken toe als die je zienswijze ondersteunen",
      "bewaar een kopie van je zienswijze en het verzendbewijs",
      "dien zo mogelijk in via het kanaal dat in de publicatie of brief staat",
    ];
  }

  if (flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar") {
    return [
      "voeg een kopie van het besluit of de beslissing op bezwaar toe",
      "stuur relevante bewijsstukken mee als je die hebt",
      "bewaar een kopie van het beroepschrift en het verzendbewijs",
      "controleer altijd de beroepstermijn in het besluit of de beslissing op bezwaar",
    ];
  }

  return [
    "voeg een kopie van de beslissing toe en stuur bewijsstukken mee als je die hebt",
    "verstuur bij voorkeur aangetekend en per gewone post",
    "bewaar een kopie van je brief, je verzendbewijs en het ontvangstbewijs",
    "is het de laatste dag van de termijn, breng de brief dan zelf langs of controleer of online indienen mogelijk is",
  ];
}

function getFilenameBase(flow: Flow): string {
  switch (flow) {
    case "zienswijze":
      return "zienswijze";
    case "beroep_zonder_bezwaar":
      return "beroepschrift-rechtstreeks";
    case "beroep_na_bezwaar":
      return "beroepschrift-na-bezwaar";
    case "woo":
      return "woo-verzoek";
    default:
      return "bezwaarschrift";
  }
}

function getDeadlineHint(flow: Flow): string {
  if (flow === "woo") {
    return "Bewaar de ontvangstbevestiging en noteer wanneer het bestuursorgaan moet reageren.";
  }

  if (flow === "zienswijze") {
    return "Controleer altijd de reactietermijn die bij het ontwerpbesluit of de publicatie staat.";
  }

  if (flow === "beroep_zonder_bezwaar" || flow === "beroep_na_bezwaar") {
    return "Beroepstermijnen zijn strikt. Controleer altijd de termijn in het besluit of de beslissing op bezwaar.";
  }

  return "De bezwaartermijn is vaak 6 weken. Controleer altijd de termijn in het besluit.";
}

function getDecisionStatusPresentation(status?: DecisionAnalysisStatus) {
  if (status === "read") {
    return {
      title: "Besluit gelezen",
      type: "success" as const,
      description:
        "De inhoud van het besluit is inhoudelijk meegenomen in de briefgeneratie. Controleer wel altijd datum, kenmerk en rechtsgrond.",
    };
  }

  if (status === "partial") {
    return {
      title: "Besluit deels gelezen",
      type: "warning" as const,
      description:
        "Slechts een deel van het besluit kon betrouwbaar worden uitgelezen. De brief gebruikt dus zowel intake als gedeeltelijke besluitanalyse.",
    };
  }

  return {
    title: "Alleen intake gebruikt",
    type: "warning" as const,
    description:
      "Het besluit kon niet voldoende worden uitgelezen. De brief steunt daarom vooral op je intake. Upload een scherpere afbeelding of een doorzoekbare PDF als de inhoud ontbreekt.",
  };
}

function getGenerationModePresentation(mode?: LetterGenerationMode) {
  if (mode === "validated") {
    return null;
  }

  if (mode === "safe_generic_ai") {
    return {
      title: "Veilige algemene juridische modus",
      type: "info" as const,
      description:
        "De brief is wel met AI opgesteld, maar zonder sectorspecifieke aannames. De argumentatie leunt in die situatie vooral op algemene Awb-grondslagen en de gegevens die wel zeker zijn.",
    };
  }

  return {
    title: "Statische fallback gebruikt",
    type: "warning" as const,
    description:
      "Door ontbrekende of onzekere gegevens kon geen volledige AI-generatie worden uitgevoerd. De tekst is daarom een veilige basisversie die je extra zorgvuldig moet nalopen.",
  };
}

function renderDecisionRow(label: string, value?: string | null) {
  if (!value) {
    return null;
  }

  return (
    <div className="border-b border-[var(--border)] py-2 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function renderAnalysisCard(analysis?: DecisionAnalysisSummary | null) {
  if (!analysis) {
    return null;
  }

  return (
    <Card title="Wat uit het besluit is gehaald" subtitle="Deze gegevens zijn gebruikt als basis voor de brief">
      <div className="space-y-1">
        {renderDecisionRow("Bestuursorgaan", analysis.bestuursorgaan)}
        {renderDecisionRow("Onderwerp", analysis.onderwerp)}
        {renderDecisionRow("Rechtsgrond", analysis.rechtsgrond)}
        {renderDecisionRow("Besluitinhoud", analysis.besluitInhoud)}
        {renderDecisionRow("Termijnen", analysis.termijnen)}
        {analysis.aandachtspunten && analysis.aandachtspunten.length > 0 && (
          <div className="py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Aandachtspunten
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--foreground)]">
              {analysis.aandachtspunten.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ flow?: string }>();
  const rawFlow = params?.flow;
  const routeFlow = Array.isArray(rawFlow) ? rawFlow[0] : rawFlow;
  const flow = isFlow(routeFlow) ? routeFlow : null;
  const appStore = useAppStore();
  const setGeneratedLetter = useAppStore((state) => state.setGeneratedLetter);
  const cachedIntake =
    typeof window !== "undefined" ? sessionStorage.getItem("briefkompas_intake") : null;
  let intakeData: IntakeFormData | null = appStore.intakeData;

  if (!intakeData && cachedIntake) {
    try {
      intakeData = JSON.parse(cachedIntake) as IntakeFormData;
    } catch {
      intakeData = null;
    }
  }

  const [resolvedGeneratedLetter, setResolvedGeneratedLetter] = useState<GeneratedLetter | null>(
    appStore.generatedLetter
  );
  const [hasCheckedStoredLetter, setHasCheckedStoredLetter] = useState(Boolean(appStore.generatedLetter));
  const [letterText, setLetterText] = useState(
    cleanLetterTextForDelivery(appStore.generatedLetter?.letterText || "")
  );
  const [manualReferences, setManualReferences] = useState("");
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!flow) {
      setHasCheckedStoredLetter(true);
      return;
    }

    if (appStore.generatedLetter) {
      setResolvedGeneratedLetter(appStore.generatedLetter);
      setHasCheckedStoredLetter(true);
      return;
    }

    const storedLetter = readStoredGeneratedLetter(flow);
    if (storedLetter) {
      setResolvedGeneratedLetter(storedLetter);
      setGeneratedLetter(storedLetter);
    }

    setHasCheckedStoredLetter(true);
  }, [appStore.generatedLetter, flow, setGeneratedLetter]);

  useEffect(() => {
    if (resolvedGeneratedLetter?.letterText && !letterText) {
      setLetterText(cleanLetterTextForDelivery(resolvedGeneratedLetter.letterText));
    }
  }, [resolvedGeneratedLetter, letterText]);

  if (!flow) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert type="error" title="Fout">
          Ongeldige route. Start opnieuw vanaf de homepage.
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          Terug naar start
        </Button>
      </div>
    );
  }

  const generatedReferences: ReferenceItem[] = resolvedGeneratedLetter?.references || [];
  const decisionStatus = getDecisionStatusPresentation(intakeData?.besluitAnalyseStatus);
  const generationMode = getGenerationModePresentation(resolvedGeneratedLetter?.generationMode);
  const referencesSubtitle =
    flow === "bezwaar"
      ? "Deze bronnen blijven alleen zichtbaar in de interface en worden niet als losse restbijlage meegeexporteerd."
      : `Gevalideerde aanknopingspunten voor ${getFlowLabel(flow)}`;

  const getEcliSearchUrl = (ecli: string) =>
    `https://uitspraken.rechtspraak.nl/#zoekresultaten?zoekterm=${encodeURIComponent(ecli)}`;

  const handleDownload = async (format: DownloadFormat) => {
    try {
      setDownloadFormat(format);

      const filenameBase = `${getFilenameBase(flow)}-${new Date().toISOString().split("T")[0]}`;

      const exportPayload = {
        flow,
        letterText: cleanLetterTextForDelivery(letterText),
        generatedReferences,
        manualReferences,
      };

      const blob =
        format === "pdf"
          ? await generatePdf(exportPayload)
          : await generateDocx(exportPayload);

      downloadFile(blob, `${filenameBase}.${format}`);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloadFormat(null);
    }
  };

  if (!hasCheckedStoredLetter) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <LoadingSpinner />
        </Card>
      </div>
    );
  }

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
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_18rem]">
        <div className="space-y-6">
          {flow !== "woo" && intakeData && (
            <Alert type={decisionStatus.type} title={decisionStatus.title}>
              <span>{decisionStatus.description}</span>
              {intakeData.besluitBronType && (
                <span className="block pt-2 text-xs opacity-80">
                  Bestandsbron: {intakeData.besluitBronType === "image" ? "afbeelding" : "PDF"}
                </span>
              )}
            </Alert>
          )}

          {intakeData?.besluitAnalyse && renderAnalysisCard(intakeData.besluitAnalyse)}

          {generationMode && (
            <Alert type={generationMode.type} title={generationMode.title}>
              {generationMode.description}
            </Alert>
          )}

          <Card
            title={`Je ${getFlowDocumentLabel(flow)}`}
            subtitle="Standaard zie je een opgemaakte preview. Schakel alleen naar bewerken als je tekst wilt aanpassen."
          >
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  !isEditing
                    ? "bg-[var(--brand)] text-white shadow-sm"
                    : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--ring)]"
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isEditing
                    ? "bg-[var(--brand)] text-white shadow-sm"
                    : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--ring)]"
                }`}
              >
                Bewerk tekst
              </button>
            </div>

            {isEditing ? (
              <Textarea
                value={letterText}
                onChange={(e) => setLetterText(cleanLetterTextForDelivery(e.target.value))}
                className="min-h-[34rem] text-[15px] leading-7 text-[var(--foreground)]"
                placeholder="Brief content"
              />
            ) : (
              <LetterPreview letterText={letterText} />
            )}
          </Card>

          {generatedReferences.length > 0 && (
            <Card title="Juridische aanknopingspunten" subtitle={referencesSubtitle}>
              <div className="space-y-4">
                {generatedReferences.map((reference) => (
                  <article
                    key={reference.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
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
                      <span className="font-semibold text-[var(--foreground)]">Onderwerp:</span> {reference.topic}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">{reference.principle}</p>
                  </article>
                ))}
              </div>
            </Card>
          )}

          {appStore.product === "uitgebreid" && flow !== "bezwaar" && (
            <Card title="Eigen toevoegingen" subtitle="Voeg desgewenst eigen notities of aanvullende bronnen toe aan de export">
              <Textarea
                value={manualReferences}
                onChange={(e) => setManualReferences(e.target.value)}
                className="min-h-32 text-[15px] leading-7 text-[var(--foreground)]"
                placeholder="Bijv. extra toelichting, dossiernotitie of een zelf gecontroleerde bronverwijzing."
              />
            </Card>
          )}

          <Alert type="warning" title="Aandacht">
            Dit is een conceptdocument. Controleer feiten, data, bestuursorgaan en uitkomst voordat je
            het verzendt. BriefKompas levert geen juridisch advies.
          </Alert>

          <Card>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 cursor-pointer rounded"
              />
              <span className="text-sm text-[var(--muted-strong)]">
                Ik heb de brief gecontroleerd en ben zelf verantwoordelijk voor de inhoud en verzending.
              </span>
            </label>
          </Card>
        </div>

        <div className="space-y-4">
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

              <div className="border-t border-[var(--border)] pt-4">
                <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                  Controleer of je document bevat
                </h4>
                <ul className="space-y-1 text-xs leading-5 text-[var(--muted)]">
                  {getLetterChecklist(flow).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <h4 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Voor verzending</h4>
                <ul className="space-y-1 text-xs leading-5 text-[var(--muted)]">
                  {getDeliveryChecklist(flow).map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-xs font-semibold text-[var(--muted-strong)]">{getDeadlineHint(flow)}</p>
              </div>
            </div>
          </Card>

          <Button variant="secondary" onClick={() => router.push("/")} className="w-full">
            Terug naar start
          </Button>
        </div>
      </div>
    </div>
  );
}
