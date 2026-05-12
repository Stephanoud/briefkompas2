"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getFlowDocumentLabel, getFlowLabel, isFlow } from "@/lib/flow";
import { readStoredGeneratedLetter } from "@/lib/generatedLetterSession";
import { readStoredResultDraft, writeStoredResultDraft } from "@/lib/resultDraftSession";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { LetterPreview, Textarea, LoadingSpinner } from "@/components";
import { Alert } from "@/components/index";
import { SaveLetterPanel } from "@/components/SaveLetterPanel";
import { downloadFile, generateDocx, generatePdf } from "@/lib/utils";
import { cleanLetterTextForDelivery } from "@/lib/letter-format";
import {
  AdditionalLegalArgument,
  CaseFileAnalysisSummary,
  DecisionAnalysisStatus,
  DecisionAnalysisSummary,
  Flow,
  GroundSupportEntry,
  GeneratedLetter,
  GeneratedLetterSupportSection,
  IntakeFormData,
  LabeledLegalStatement,
} from "@/types";
import { ReferenceItem } from "@/src/types/references";

type DownloadFormat = "docx" | "pdf";

type AnalysisTableRow = {
  label: string;
  content: ReactNode | null;
};

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
    "eventueel een concreet procedureel verzoek dat uit het dossier blijkt",
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

  return "Controleer altijd welke termijn in het besluit of de rechtsmiddelenclausule staat.";
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
    title: "Besluitinformatie aanvullen",
    type: "warning" as const,
    description:
      "Het besluit kon niet volledig worden uitgelezen. Verplichte kerngegevens moeten zijn aangevuld voordat de brief wordt gemaakt.",
  };
}

function renderTextCell(value?: string | null) {
  if (!value) {
    return null;
  }

  return (
    <p className="text-sm leading-6 text-[var(--foreground)]">
      {value}
    </p>
  );
}

function renderListCell(items?: string[]) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--foreground)]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function renderAnalysisTable(params: {
  title: string;
  subtitle?: string;
  rows: AnalysisTableRow[];
}) {
  const rows = params.rows.filter((row) => row.content);
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-base font-semibold text-[var(--foreground)]">{params.title}</h4>
        {params.subtitle && (
          <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{params.subtitle}</p>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full table-fixed border-collapse">
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.label} className="align-top">
                  <th className="w-44 bg-[var(--surface-soft)] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    {row.label}
                  </th>
                  <td className="px-3 py-3">{row.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function getStatementLabelClass(label: LabeledLegalStatement["label"]): string {
  switch (label) {
    case "letterlijk uit besluit":
      return "bg-amber-100 text-amber-900";
    case "letterlijk uit wet":
      return "bg-emerald-100 text-emerald-900";
    case "volgt uit geverifieerde jurisprudentie":
      return "bg-sky-100 text-sky-900";
    case "gebruikersstelling / nog niet geverifieerd":
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-slate-100 text-slate-900";
  }
}

function renderLabeledStatement(item: LabeledLegalStatement) {
  return (
    <article
      key={`${item.label}-${item.statement}-${item.source ?? ""}`}
      className="rounded-2xl border border-[var(--border)] bg-white p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatementLabelClass(item.label)}`}>
          {item.label}
        </span>
        {item.source && <span className="text-xs text-[var(--muted)]">{item.source}</span>}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{item.statement}</p>
      {item.note && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{item.note}</p>}
    </article>
  );
}

function renderGroundCard(ground: GroundSupportEntry) {
  return (
    <article key={ground.title} className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <h4 className="text-sm font-semibold text-[var(--foreground)]">{ground.title}</h4>
      <div className="mt-3 space-y-3">
        {ground.decisionPassage && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Passage uit besluit</p>
            <div className="mt-2">{renderLabeledStatement(ground.decisionPassage)}</div>
          </div>
        )}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Juridisch probleem</p>
          <div className="mt-2">{renderLabeledStatement(ground.juridischProbleem)}</div>
        </div>
        {ground.relevantFeitOfBewijs && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Relevant feit of bewijs</p>
            <div className="mt-2">{renderLabeledStatement(ground.relevantFeitOfBewijs)}</div>
          </div>
        )}
        {ground.jurisprudentieOfWet && ground.jurisprudentieOfWet.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Wet of geverifieerde rechtspraak</p>
            <div className="mt-2 space-y-2">
              {ground.jurisprudentieOfWet.map((item) => renderLabeledStatement(item))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function renderAdditionalArgument(argument: AdditionalLegalArgument) {
  return (
    <article
      key={`${argument.principle}-${argument.relevance}-${argument.support ?? ""}`}
      className="rounded-2xl border border-[var(--border)] bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground)]">
          {argument.principle}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {argument.integrationMode === "direct" ? "Direct opnemen" : "Voorzichtig formuleren"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{argument.relevance}</p>
      {argument.support && <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{argument.support}</p>}
      <p className="mt-3 rounded-2xl bg-[var(--surface-soft)] p-3 text-sm leading-6 text-[var(--foreground)]">
        {argument.suggestedPhrasing}
      </p>
    </article>
  );
}

function shortenAnalysisText(value: string, maxLength = 150): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function firstAnalysisText(...values: Array<string | null | undefined>): string | null {
  return values.find((value): value is string => Boolean(value?.trim())) ?? null;
}

function renderCompactSection(title: string, items: string[]) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-5 text-[var(--muted-strong)]">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{shortenAnalysisText(item)}</li>
        ))}
      </ul>
    </section>
  );
}

function renderFullDecisionAnalysis(analysis?: DecisionAnalysisSummary | null) {
  if (!analysis) {
    return null;
  }

  return renderAnalysisTable({
    title: "Wat uit het besluit is gehaald",
    subtitle: "Deze gegevens zijn gebruikt als basis voor de brief",
    rows: [
      { label: "Bestuursorgaan", content: renderTextCell(analysis.bestuursorgaan) },
      { label: "Onderwerp", content: renderTextCell(analysis.onderwerp) },
      { label: "Rechtsgrond", content: renderTextCell(analysis.rechtsgrond) },
      { label: "Besluitinhoud", content: renderTextCell(analysis.besluitInhoud) },
      { label: "Termijnen", content: renderTextCell(analysis.termijnen) },
      { label: "Rechtsmiddelenclausule", content: renderTextCell(analysis.rechtsmiddelenclausule) },
      {
        label: "Dragende overwegingen",
        content:
          analysis.dragendeOverwegingen && analysis.dragendeOverwegingen.length > 0 ? (
            <div className="space-y-3">
              {analysis.dragendeOverwegingen.map((item) => (
                <div key={`${item.passage}-${item.duiding}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <p className="text-sm leading-6 text-[var(--foreground)]">{item.duiding}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Passage: {item.passage}</p>
                </div>
              ))}
            </div>
          ) : null,
      },
      { label: "Wettelijke grondslagen", content: renderListCell(analysis.wettelijkeGrondslagen) },
      { label: "Procedurele aanwijzingen", content: renderListCell(analysis.procedureleAanwijzingen) },
      { label: "Beleidsverwijzingen", content: renderListCell(analysis.beleidsReferenties) },
      { label: "Jurisprudentieverwijzingen", content: renderListCell(analysis.jurisprudentieReferenties) },
      { label: "Bijlageverwijzingen", content: renderListCell(analysis.bijlageReferenties) },
      { label: "Bijlagenlijst", content: renderListCell(analysis.bijlagenLijst) },
      {
        label: "Inventarislijst of documenttabel",
        content: renderListCell(analysis.inventarislijstOfDocumenttabel),
      },
      {
        label: "Eerdere correspondentie",
        content: renderListCell(analysis.correspondentieVerwijzingen),
      },
      { label: "Aandachtspunten", content: renderListCell(analysis.aandachtspunten) },
    ],
  });
}

function renderSupportSections(sections?: GeneratedLetterSupportSection[]) {
  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <Card
      title="Aandachtsblok"
      subtitle="Deze punten horen niet bij de te verzenden brief en worden niet meegekopieerd of meegeexporteerd"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-[var(--border)] bg-white p-4">
            <h4 className="text-sm font-semibold text-[var(--foreground)]">{section.title}</h4>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--muted-strong)]">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}

function renderFullCaseAnalysis(caseAnalysis?: CaseFileAnalysisSummary | null) {
  if (!caseAnalysis) {
    return null;
  }

  return renderAnalysisTable({
    title: "Zaakanalyse",
    subtitle: "Samenvatting van zaaktype, risico's en juridische aanknopingspunten",
    rows: [
      { label: "Module", content: renderTextCell(caseAnalysis.module) },
      { label: "Procedurefase", content: renderTextCell(caseAnalysis.procedurefase) },
      { label: "Kernconflict", content: renderTextCell(caseAnalysis.kernconflict) },
      { label: "Toelichting", content: renderTextCell(caseAnalysis.toelichting) },
      { label: "Primaire procesrisico's", content: renderListCell(caseAnalysis.primaireProcesrisicos) },
      { label: "Ontbrekende informatie", content: renderListCell(caseAnalysis.ontbrekendeInformatie) },
      { label: "Gerichte checkvragen", content: renderListCell(caseAnalysis.gerichteCheckvragen) },
      { label: "Waar nog onzekerheid zit", content: renderListCell(caseAnalysis.onzekerheden) },
      {
        label: "Gelabelde juridische stellingen",
        content:
          caseAnalysis.labeledStellingen && caseAnalysis.labeledStellingen.length > 0 ? (
            <div className="space-y-3">
              {caseAnalysis.labeledStellingen.map((item) => renderLabeledStatement(item))}
            </div>
          ) : null,
      },
      {
        label: "Aanvullende argumenten",
        content:
          caseAnalysis.relevanteAanvullendeArgumenten &&
          caseAnalysis.relevanteAanvullendeArgumenten.length > 0 ? (
            <div className="space-y-3">
              {caseAnalysis.relevanteAanvullendeArgumenten.map((argument) => renderAdditionalArgument(argument))}
            </div>
          ) : null,
      },
      {
        label: "Grondmatrix",
        content:
          caseAnalysis.groundsMatrix && caseAnalysis.groundsMatrix.length > 0 ? (
            <div className="space-y-3">
              {caseAnalysis.groundsMatrix.map((ground) => renderGroundCard(ground))}
            </div>
          ) : null,
      },
    ],
  });
}

function renderCompactAnalysisCard(params: {
  flow: Flow;
  intakeData?: IntakeFormData | null;
  caseAnalysis?: CaseFileAnalysisSummary | null;
}) {
  const { flow, intakeData, caseAnalysis } = params;
  const decisionAnalysis = intakeData?.besluitAnalyse;

  if (!decisionAnalysis && !caseAnalysis) {
    return null;
  }

  const summary = firstAnalysisText(
    intakeData?.besluitSamenvatting,
    decisionAnalysis?.besluitInhoud,
    caseAnalysis?.kernconflict
  );
  const coreData = [
    intakeData?.datumBesluit ? `Datum: ${intakeData.datumBesluit}` : null,
    intakeData?.bestuursorgaan || decisionAnalysis?.bestuursorgaan
      ? `Bestuursorgaan: ${intakeData?.bestuursorgaan ?? decisionAnalysis?.bestuursorgaan}`
      : null,
    `Procedure: ${getFlowLabel(flow)}`,
    decisionAnalysis?.onderwerp ? `Onderwerp: ${decisionAnalysis.onderwerp}` : null,
    decisionAnalysis?.besluitInhoud ? `Beslissing: ${decisionAnalysis.besluitInhoud}` : null,
    decisionAnalysis?.termijnen ? `Termijn: ${decisionAnalysis.termijnen}` : null,
  ].filter((item): item is string => Boolean(item));
  const hooks = [
    ...(caseAnalysis?.groundsMatrix?.map((ground) => ground.title) ?? []),
    ...(caseAnalysis?.relevanteAanvullendeArgumenten?.map((argument) => argument.principle) ?? []),
    ...(decisionAnalysis?.aandachtspunten ?? []),
  ].slice(0, 4);
  const missing = (caseAnalysis?.ontbrekendeInformatie ?? []).filter(Boolean).slice(0, 3);

  return (
    <Card title="Analyse" subtitle="Compacte samenvatting van besluit, intake en juridische aanknopingspunten">
      <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
        <div className="space-y-4">
          {renderCompactSection("Korte samenvatting besluit", summary ? [summary] : [])}
          {renderCompactSection("Herkende kerngegevens", coreData)}
          {renderCompactSection("Mogelijke aanknopingspunten", hooks)}
          {renderCompactSection("Ontbrekende informatie", missing)}
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-[var(--foreground)]">Toon volledige analyse</summary>
        <div className="mt-3 space-y-4">
          {renderFullDecisionAnalysis(decisionAnalysis)}
          {renderFullCaseAnalysis(caseAnalysis)}
        </div>
      </details>
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
  const cachedProduct =
    typeof window !== "undefined" ? sessionStorage.getItem("briefkompas_product") : null;
  const resolvedProduct =
    appStore.product === "basis" || appStore.product === "uitgebreid"
      ? appStore.product
      : cachedProduct === "basis" || cachedProduct === "uitgebreid"
        ? cachedProduct
        : null;
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
  const [manualReferences, setManualReferences] = useState(() => (flow ? readStoredResultDraft(flow) : ""));
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat | null>(null);
  const [copyTextStatus, setCopyTextStatus] = useState<"idle" | "done" | "error">("idle");
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

  useEffect(() => {
    if (!flow) {
      return;
    }

    writeStoredResultDraft(flow, manualReferences);
  }, [flow, manualReferences]);

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

  const handleCopyLetterText = async () => {
    try {
      await navigator.clipboard.writeText(cleanLetterTextForDelivery(letterText));
      setCopyTextStatus("done");
      window.setTimeout(() => setCopyTextStatus("idle"), 2200);
    } catch {
      setCopyTextStatus("error");
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

          {renderCompactAnalysisCard({
            flow,
            intakeData,
            caseAnalysis: resolvedGeneratedLetter?.caseAnalysis,
          })}

          {resolvedGeneratedLetter?.emailDelivery && (
            <Alert
              type={
                resolvedGeneratedLetter.emailDelivery.status === "sent"
                  ? "success"
                  : resolvedGeneratedLetter.emailDelivery.status === "failed"
                    ? "warning"
                    : "info"
              }
              title={
                resolvedGeneratedLetter.emailDelivery.status === "sent"
                  ? "E-mail verzonden"
                  : resolvedGeneratedLetter.emailDelivery.status === "failed"
                    ? "E-mail niet verzonden"
                    : "E-mail nog niet actief"
              }
            >
              {resolvedGeneratedLetter.emailDelivery.message ??
                `Status voor ${resolvedGeneratedLetter.emailDelivery.to}: ${resolvedGeneratedLetter.emailDelivery.status}`}
            </Alert>
          )}

          {renderSupportSections(resolvedGeneratedLetter?.supportSections)}

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

          {intakeData && (
            <Card
              title="Bewaren en terugvinden"
              subtitle="Je gegevens worden standaard niet opgeslagen. Je kunt deze brief wel tijdelijk voor 7 dagen bewaren."
            >
              <div className="space-y-5">
                <p className="text-sm leading-6 text-[var(--muted-strong)]">
                  Je gegevens worden standaard niet opgeslagen. Met de knop hieronder maak je een tijdelijke
                  herstel-link waarmee je deze brief later nog eens kunt openen.
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => handleDownload("docx")}
                    isLoading={downloadFormat === "docx"}
                    disabled={downloadFormat !== null}
                  >
                    {downloadFormat === "docx" ? "Brief downloaden..." : "Download brief"}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleDownload("pdf")}
                    isLoading={downloadFormat === "pdf"}
                    disabled={downloadFormat !== null}
                  >
                    {downloadFormat === "pdf" ? "PDF maken..." : "Download PDF"}
                  </Button>

                  <Button type="button" variant="secondary" onClick={handleCopyLetterText}>
                    {copyTextStatus === "done" ? "Tekst gekopieerd" : "Kopieer tekst"}
                  </Button>
                </div>

                {copyTextStatus === "error" && (
                  <p className="text-sm text-red-700">
                    Kopiëren lukt in deze browser niet automatisch. Selecteer en kopieer de tekst dan handmatig.
                  </p>
                )}

                <SaveLetterPanel
                  flow={flow}
                  content={cleanLetterTextForDelivery(letterText)}
                  product={resolvedProduct}
                  intakeData={intakeData}
                  generatedLetter={{
                    ...(resolvedGeneratedLetter ?? {
                      references: [],
                      generationMode: "validated",
                      guardReasons: [],
                    }),
                    letterText: cleanLetterTextForDelivery(letterText),
                  }}
                  manualReferences={manualReferences}
                />

                <p className="text-xs leading-6 text-[var(--muted)]">
                  <Link href="/privacy" className="underline underline-offset-4 hover:text-[var(--foreground)]">
                    Meer weten? Lees hoe we omgaan met privacy en tijdelijke opslag.
                  </Link>
                </p>
              </div>
            </Card>
          )}

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

          {resolvedProduct === "uitgebreid" && flow !== "bezwaar" && (
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
              <p className="text-sm leading-6 text-[var(--muted-strong)]">
                Gebruik links de download-, kopieer- of herstelopties als je een kopie wilt bewaren. Controleer
                hieronder vooral of de brief klaar is om te verzenden.
              </p>

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
