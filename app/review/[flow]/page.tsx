"use client";

import { useParams, useRouter } from "next/navigation";
import { getFlowActionLabel, getFlowDocumentLabel, getFlowLabel, isFlow } from "@/lib/flow";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/index";
import { Flow, IntakeFormData } from "@/types";

function truncatePreview(value: string, maxLength = 320): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function getDecisionStatusLabel(status?: IntakeFormData["besluitAnalyseStatus"]): string {
  if (status === "read") return "Besluit gelezen";
  if (status === "partial") return "Besluit deels gelezen";
  return "Alleen intake gebruikt";
}

function getProcedureAdviceLabel(value?: IntakeFormData["procedureAdvies"]): string | null {
  if (!value) return null;
  if (value === "bezwaarfase") return "U zit nog in de bezwaarfase";
  if (value === "niet_tijdig_beslissen") return "Niet tijdig beslissen";
  return getFlowActionLabel(value);
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ flow?: string }>();
  const rawFlow = params?.flow;
  const flow = isFlow(Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) ? (Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) : null;
  const appStore = useAppStore();
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

  const handleEdit = () => {
    router.push(`/intake/${flow}`);
  };

  const handleContinue = () => {
    router.push(`/pricing/${flow}`);
  };

  const renderField = (label: string, value: string | boolean | undefined | null) => {
    if (value === undefined || value === null || value === "") return null;
    const displayValue = typeof value === "boolean" ? (value ? "Ja" : "Nee") : value;

    return (
      <div className="flex items-start justify-between border-b border-gray-200 py-2 last:border-0">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className="max-w-sm text-right text-sm font-semibold text-gray-900">{displayValue}</span>
      </div>
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
            <div className="space-y-2 rounded bg-gray-50 p-4">
              {renderFlowFields(flow)}
              {renderDecisionSummary()}
            </div>
          </div>

          {(intakeData.besluitSamenvatting || intakeData.besluitTekst || intakeData.besluitAnalyse) && flow !== "woo" && (
            <div className="rounded border border-[var(--border)] bg-white p-4">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">Uit het besluit gehaald</h4>
              {intakeData.besluitAnalyse?.onderwerp && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Onderwerp:</span>{" "}
                  {intakeData.besluitAnalyse.onderwerp}
                </p>
              )}
              {intakeData.besluitAnalyse?.rechtsgrond && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Rechtsgrond:</span>{" "}
                  {intakeData.besluitAnalyse.rechtsgrond}
                </p>
              )}
              {intakeData.besluitAnalyse?.besluitInhoud && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Besluitinhoud:</span>{" "}
                  {intakeData.besluitAnalyse.besluitInhoud}
                </p>
              )}
              {intakeData.besluitAnalyse?.dragendeOverwegingen?.length ? (
                <div className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <p className="font-semibold text-[var(--foreground)]">Dragende overwegingen:</p>
                  {intakeData.besluitAnalyse.dragendeOverwegingen.map((item) => (
                    <div key={`${item.passage}-${item.duiding}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                      <p>{item.duiding}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Passage: {item.passage}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {intakeData.besluitAnalyse?.wettelijkeGrondslagen?.length ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Wettelijke grondslagen:</span>{" "}
                  {intakeData.besluitAnalyse.wettelijkeGrondslagen.join(", ")}
                </p>
              ) : null}
              {intakeData.besluitAnalyse?.procedureleAanwijzingen?.length ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Procedurele aanwijzingen:</span>{" "}
                  {intakeData.besluitAnalyse.procedureleAanwijzingen.join(", ")}
                </p>
              ) : null}
              {intakeData.besluitAnalyse?.rechtsmiddelenclausule ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Rechtsmiddelenclausule:</span>{" "}
                  {intakeData.besluitAnalyse.rechtsmiddelenclausule}
                </p>
              ) : null}
              {intakeData.besluitAnalyse?.bijlagenLijst?.length ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Bijlagenlijst:</span>{" "}
                  {intakeData.besluitAnalyse.bijlagenLijst.join(", ")}
                </p>
              ) : null}
              {intakeData.besluitAnalyse?.inventarislijstOfDocumenttabel?.length ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Inventarislijst of documenttabel:</span>{" "}
                  {intakeData.besluitAnalyse.inventarislijstOfDocumenttabel.join(", ")}
                </p>
              ) : null}
              {intakeData.besluitAnalyse?.correspondentieVerwijzingen?.length ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Eerdere correspondentie:</span>{" "}
                  {intakeData.besluitAnalyse.correspondentieVerwijzingen.join(", ")}
                </p>
              ) : null}
              {intakeData.besluitSamenvatting && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-strong)]">
                  <span className="font-semibold text-[var(--foreground)]">Samenvatting:</span>{" "}
                  {intakeData.besluitSamenvatting}
                </p>
              )}
              {intakeData.besluitTekst && (
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                  <span className="font-semibold text-[var(--foreground)]">Tekstfragment:</span>{" "}
                  {truncatePreview(intakeData.besluitTekst)}
                </p>
              )}
            </div>
          )}

          <Alert type="info">
            Controleer of feiten, data, bestuursorgaan en gewenste uitkomst kloppen. Daarna ga je door
            naar de pakketkeuze.
          </Alert>
        </div>

        <div className="mt-8 flex gap-4">
          <Button variant="secondary" onClick={handleEdit} className="flex-1">
            Terug naar intake
          </Button>
          <Button onClick={handleContinue} className="flex-1">
            Ga naar productkeuze {"->"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
