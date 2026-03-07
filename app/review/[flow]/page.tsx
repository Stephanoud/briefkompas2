"use client";

import { useParams, useRouter } from "next/navigation";
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

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ flow: string }>();
  const rawFlow = params?.flow;
  const flow = (Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) as Flow;
  const appStore = useAppStore();
  const cachedIntake =
    typeof window !== "undefined"
      ? sessionStorage.getItem("briefkompas_intake")
      : null;
  let intakeData: IntakeFormData | null = appStore.intakeData;

  if (!intakeData && cachedIntake) {
    try {
      intakeData = JSON.parse(cachedIntake) as IntakeFormData;
    } catch {
      intakeData = null;
    }
  }

  if (!intakeData) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert type="error" title="Fout">
          Geen intake gegevens gevonden. Start opnieuw.
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

  return (
    <div className="mx-auto max-w-2xl">
      <Card title="Overzicht van je antwoorden" subtitle="Controleer alles en pas aan indien nodig">
        <div className="space-y-6">
          {flow === "bezwaar" && (
            <div>
              <h3 className="mb-3 font-semibold text-gray-900">Bezwaardetails</h3>
              <div className="space-y-2 rounded bg-gray-50 p-4">
                {renderField("Bestuursorgaan", intakeData.bestuursorgaan)}
                {renderField("Datum besluit", intakeData.datumBesluit)}
                {renderField("Kenmerk/zaaknummer", intakeData.kenmerk || "Niet ingevuld")}
                {renderField("Soort besluit", intakeData.categorie)}
                {renderField("Doel van bezwaar", intakeData.doel)}
                {renderField(
                  "Gronden (samenvatting)",
                  intakeData.gronden ? `${intakeData.gronden.substring(0, 100)}...` : "Niet ingevuld"
                )}
                {renderField(
                  "Persoonlijke omstandigheden",
                  intakeData.persoonlijkeOmstandigheden || "Niet ingevuld"
                )}
                {renderField("Besluitbestand", intakeData.files?.besluit?.name || "Niet geupload")}
                {renderField(
                  "Analysebron",
                  intakeData.besluitBronType === "image"
                    ? "Foto"
                    : intakeData.besluitBronType === "pdf"
                      ? "PDF"
                      : "Niet beschikbaar"
                )}
                {renderField(
                  "Gedetecteerd documenttype",
                  intakeData.besluitDocumentType || "Niet vastgesteld"
                )}
              </div>

              {(intakeData.besluitSamenvatting || intakeData.besluitTekst) && (
                <div className="mt-4 rounded border border-[var(--border)] bg-white p-4">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">Uit het besluit gehaald</h4>
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
            </div>
          )}

          {flow === "woo" && (
            <div>
              <h3 className="mb-3 font-semibold text-gray-900">WOO-verzoek details</h3>
              <div className="space-y-2 rounded bg-gray-50 p-4">
                {renderField("Bestuursorgaan", intakeData.bestuursorgaan)}
                {renderField("Onderwerp", intakeData.wooOnderwerp)}
                {renderField("Periode", intakeData.wooPeriode)}
                {renderField("Documenten", intakeData.wooDocumenten)}
                {renderField("Digitale verstrekking", intakeData.digitaleVerstrekking)}
                {renderField("Spoedeisend", intakeData.spoed)}
              </div>
            </div>
          )}

          <Alert type="info">
            Klopt alles? Klik op Terug naar intake als je iets wilt wijzigen. Anders ga je door naar
            de productkeuze.
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
