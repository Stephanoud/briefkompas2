"use client";

import { type ReactNode, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getFlowActionLabel, getFlowDocumentLabel, getFlowLabel, isFlow } from "@/lib/flow";
import { getMissingGenerationInfo, humanizeMissingInfoField } from "@/lib/intake/completeness";
import { readStoredIntake, writeStoredIntake } from "@/lib/browser-persistence";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/index";
import { MissingIntakeFieldsForm } from "@/components/MissingIntakeFieldsForm";
import { Flow, IntakeFormData } from "@/types";

function truncatePreview(value: string, maxLength = 320): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitIntoReadablePoints(value: string): string[] {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return [];
  }

  const explicitLines = normalized
    .split(/\n+|(?:^|\s)[-*]\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);

  if (explicitLines.length > 1) {
    return explicitLines;
  }

  const sentenceParts = normalized
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);

  if (sentenceParts.length > 1 && normalized.length > 180) {
    return sentenceParts;
  }

  return [normalized];
}

function getDecisionStatusLabel(status?: IntakeFormData["besluitAnalyseStatus"]): string {
  if (status === "read") return "Besluit gelezen";
  if (status === "partial") return "Besluit deels gelezen";
  return "Besluitinformatie aanvullen";
}

function getProcedureAdviceLabel(value?: IntakeFormData["procedureAdvies"]): string | null {
  if (!value) return null;
  if (value === "bezwaarfase") return "U zit nog in de bezwaarfase";
  if (value === "niet_tijdig_beslissen") return "Niet tijdig beslissen";
  return getFlowActionLabel(value);
}

type ReviewAnalysisRow = {
  label: string;
  content: ReactNode | null;
};

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ flow?: string }>();
  const rawFlow = params?.flow;
  const flow = isFlow(Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) ? (Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) : null;
  const appStore = useAppStore();
  let intakeData: IntakeFormData | null = appStore.intakeData;
  const [inlineIntakeData, setInlineIntakeData] = useState<IntakeFormData | null>(null);

  if (!intakeData && flow) {
    intakeData = readStoredIntake(flow) as IntakeFormData | null;
  }

  if (inlineIntakeData) {
    intakeData = inlineIntakeData;
  }

  if (!flow || !intakeData) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert type="error" title="Fout">
          Geen intakegegevens gevonden. Start opnieuw.
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          Terug naar start
        </Button>
      </div>
    );
  }

  const missingProductInfo = getMissingGenerationInfo(flow, intakeData);
  const canContinueToProduct = missingProductInfo.length === 0;

  const handleMissingInfoSave = (updatedIntakeData: IntakeFormData) => {
    const withFlow = { ...updatedIntakeData, flow };
    appStore.setIntakeData(withFlow);
    writeStoredIntake(withFlow);
    setInlineIntakeData(withFlow);
  };

  const handleEdit = () => {
    router.push(`/intake/${flow}`);
  };

  const handleContinue = () => {
    if (!canContinueToProduct) {
      return;
    }

    router.push(`/pricing/${flow}`);
  };

  const renderField = (label: string, value: string | boolean | undefined | null) => {
    if (value === undefined || value === null || value === "") return null;
    const displayValue = typeof value === "boolean" ? (value ? "Ja" : "Nee") : value;
    const points = typeof displayValue === "string" ? splitIntoReadablePoints(displayValue) : [displayValue];
    const shouldUseBullets =
      typeof displayValue === "string" &&
      (points.length > 1 || displayValue.length > 140);

    return (
      <li className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</p>
        {shouldUseBullets ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-medium leading-6 text-gray-900">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-semibold leading-6 text-gray-900">{displayValue}</p>
        )}
      </li>
    );
  };

  const renderAnalysisContent = (value?: string | string[] | null) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return null;
    }

    const points = Array.isArray(value)
      ? value.map((item) => normalizeWhitespace(item)).filter(Boolean)
      : splitIntoReadablePoints(value);

    if (points.length === 0) {
      return null;
    }

    return (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--muted-strong)]">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    );
  };

  const renderDecisionAnalysisTable = () => {
    const rows: ReviewAnalysisRow[] = [
      { label: "Onderwerp", content: renderAnalysisContent(intakeData.besluitAnalyse?.onderwerp) },
      { label: "Rechtsgrond", content: renderAnalysisContent(intakeData.besluitAnalyse?.rechtsgrond) },
      { label: "Besluitinhoud", content: renderAnalysisContent(intakeData.besluitAnalyse?.besluitInhoud) },
      {
        label: "Dragende overwegingen",
        content: intakeData.besluitAnalyse?.dragendeOverwegingen?.length ? (
          <div className="space-y-2">
            {intakeData.besluitAnalyse.dragendeOverwegingen.map((item) => (
              <div key={`${item.passage}-${item.duiding}`} className="rounded-lg border border-[var(--border)] bg-white p-3">
                <p className="text-sm leading-6 text-[var(--muted-strong)]">{item.duiding}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Passage: {item.passage}</p>
              </div>
            ))}
          </div>
        ) : null,
      },
      { label: "Wettelijke grondslagen", content: renderAnalysisContent(intakeData.besluitAnalyse?.wettelijkeGrondslagen) },
      { label: "Procedurele aanwijzingen", content: renderAnalysisContent(intakeData.besluitAnalyse?.procedureleAanwijzingen) },
      { label: "Rechtsmiddelenclausule", content: renderAnalysisContent(intakeData.besluitAnalyse?.rechtsmiddelenclausule) },
      { label: "Bijlagenlijst", content: renderAnalysisContent(intakeData.besluitAnalyse?.bijlagenLijst) },
      {
        label: "Inventarislijst of documenttabel",
        content: renderAnalysisContent(intakeData.besluitAnalyse?.inventarislijstOfDocumenttabel),
      },
      { label: "Eerdere correspondentie", content: renderAnalysisContent(intakeData.besluitAnalyse?.correspondentieVerwijzingen) },
      { label: "Samenvatting", content: renderAnalysisContent(intakeData.besluitSamenvatting) },
      { label: "Tekstfragment", content: renderAnalysisContent(intakeData.besluitTekst ? truncatePreview(intakeData.besluitTekst) : null) },
    ].filter((row) => row.content);

    if (rows.length === 0) {
      return null;
    }

    return (
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full table-fixed border-collapse">
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.label} className="align-top">
                  <th className="w-40 bg-[var(--surface-soft)] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    {row.label}
                  </th>
                  <td className="px-3 py-3">{row.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMissingProductInfo = () => {
    if (canContinueToProduct) {
      return null;
    }

    return (
      <Alert type="warning" title="Productkeuze nog geblokkeerd">
        <span className="block">
          De applicatie maakt geen generieke brief. Vul eerst deze gegevens aan:
        </span>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {missingProductInfo.map((field) => (
            <li key={String(field.field)}>{humanizeMissingInfoField(field)}</li>
          ))}
        </ul>
        <div className="mt-4">
          <MissingIntakeFieldsForm
            key={missingProductInfo.map((field) => String(field.field)).join("|")}
            fields={missingProductInfo}
            intakeData={intakeData}
            onSave={handleMissingInfoSave}
          />
        </div>
      </Alert>
    );
  };

  const renderDecisionSummary = () => {
    if (flow === "woo") return null;

    return (
      <>
        {renderField("Datum besluit", intakeData.datumBesluit)}
        {renderField("Kenmerk/zaaknummer", intakeData.kenmerk)}
        {renderField("Bestandsnaam besluit", intakeData.files?.besluit?.name)}
        {renderField("Status documentuitlezing", getDecisionStatusLabel(intakeData.besluitAnalyseStatus))}
      </>
    );
  };

  const renderFlowFields = (activeFlow: Flow) => {
    if (activeFlow === "woo") {
      return (
        <>
          {renderField("Bestuursorgaan", intakeData.bestuursorgaan)}
          {renderField("Onderwerp", intakeData.wooOnderwerp)}
          {renderField("Periode", intakeData.wooPeriode)}
          {renderField("Documenten", intakeData.wooDocumenten)}
          {renderField("Digitale verstrekking", intakeData.digitaleVerstrekking)}
          {renderField("Spoed", intakeData.spoed)}
        </>
      );
    }

    if (activeFlow === "zienswijze") {
      return (
        <>
          {renderField("Bestuursorgaan", intakeData.bestuursorgaan)}
          {renderField("Ontwerpbesluit", intakeData.categorie)}
          {renderField("Belang", intakeData.persoonlijkeOmstandigheden)}
          {renderField("Verzoek of gewenste aanpassing", intakeData.doel)}
          {renderField("Argumenten", intakeData.gronden)}
        </>
      );
    }

    if (activeFlow === "beroep_zonder_bezwaar") {
      return (
        <>
          {renderField("Bestuursorgaan", intakeData.bestuursorgaan)}
          {renderField("Soort besluit", intakeData.categorie)}
          {renderField("Waarom direct beroep mogelijk is", intakeData.procedureReden)}
          {renderField("Gewenste uitkomst", intakeData.doel)}
          {renderField("Beroepsgronden", intakeData.gronden)}
        </>
      );
    }

    if (activeFlow === "beroep_na_bezwaar") {
      return (
        <>
          {renderField("Bestuursorgaan", intakeData.bestuursorgaan)}
          {renderField("Soort besluit", intakeData.categorie)}
          {renderField("Eerdere bezwaargronden", intakeData.eerdereBezwaargronden)}
          {renderField("Gewenste uitkomst", intakeData.doel)}
          {renderField("Waarom beslissing op bezwaar onjuist is", intakeData.gronden)}
        </>
      );
    }

    return (
      <>
        {renderField("Bestuursorgaan", intakeData.bestuursorgaan)}
        {renderField("Soort besluit", intakeData.categorie)}
        {renderField("Doel", intakeData.doel)}
        {renderField("Gronden", intakeData.gronden)}
        {renderField("Persoonlijke omstandigheden", intakeData.persoonlijkeOmstandigheden)}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card title="Overzicht van je antwoorden" subtitle={`Controleer je intake voor ${getFlowLabel(flow)}`}>
        <div className="space-y-6">
          {intakeData.procedureAdvies && (
            <Alert type="info" title="Procedurecheck">
              <span className="block font-semibold">{getProcedureAdviceLabel(intakeData.procedureAdvies)}</span>
              {intakeData.procedureReden && (
                <span className="block pt-2">{intakeData.procedureReden}</span>
              )}
            </Alert>
          )}

          <div>
            <h3 className="mb-3 font-semibold text-gray-900">
              Intake voor {getFlowDocumentLabel(flow)}
            </h3>
            <ul className="space-y-3 rounded-xl bg-gray-50 p-4">
              {renderFlowFields(flow)}
              {renderDecisionSummary()}
            </ul>
          </div>

          {(intakeData.besluitSamenvatting || intakeData.besluitTekst || intakeData.besluitAnalyse) && flow !== "woo" && (
            <div className="rounded border border-[var(--border)] bg-white p-4">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">Uit het besluit gehaald</h4>
              <div className="mt-3">{renderDecisionAnalysisTable()}</div>
            </div>
          )}

          {renderMissingProductInfo()}

          <Alert type="info">
            Controleer of feiten, data, bestuursorgaan en gewenste uitkomst kloppen. Daarna ga je door
            naar de pakketkeuze.
          </Alert>
        </div>

        <div className="mt-8 flex gap-4">
          <Button variant="secondary" onClick={handleEdit} className="flex-1">
            Terug naar intake
          </Button>
          <Button onClick={handleContinue} disabled={!canContinueToProduct} className="flex-1">
            {canContinueToProduct ? "Ga naar productkeuze ->" : "Vul intake eerst aan"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
