"use client";

import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/index";
import { Flow, IntakeFormData } from "@/types";

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
      <div className="max-w-2xl mx-auto">
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

  const renderField = (
    label: string,
    value: string | boolean | undefined | null
  ) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "boolean") {
      value = value ? "Ja" : "Nee";
    }
    return (
      <div className="flex justify-between items-start py-2 border-b border-gray-200 last:border-0">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className="text-sm text-gray-900 font-semibold text-right max-w-sm">
          {value}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card title="Overzicht je antwoorden" subtitle="Controleer alles en pas aan indien nodig">
        <div className="space-y-6">
          {/* Bezwaar Summary */}
          {flow === "bezwaar" && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">📋 Bezwaardetails</h3>
              <div className="bg-gray-50 rounded p-4 space-y-2">
                {renderField(
                  "Bestuursorgaan",
                  intakeData.bestuursorgaan
                )}
                {renderField(
                  "Datum besluit",
                  intakeData.datumBesluit
                )}
                {renderField(
                  "Kenmerk/zaaknummer",
                  intakeData.kenmerk || "Niet ingevuld"
                )}
                {renderField(
                  "Soort besluit",
                  intakeData.categorie
                )}
                {renderField(
                  "Doel van bezwaar",
                  intakeData.doel
                )}
                {renderField(
                  "Gronden (samenvatting)",
                  intakeData.gronden
                    ? `${intakeData.gronden.substring(0, 100)}...`
                    : "Niet ingevuld"
                )}
                {renderField(
                  "Persoonlijke omstandigheden",
                  intakeData.persoonlijkeOmstandigheden || "Niet ingevuld"
                )}
                {renderField(
                  "Besluit PDF",
                  intakeData.files?.besluit?.name || "Niet geüpload"
                )}
              </div>
            </div>
          )}

          {/* WOO Summary */}
          {flow === "woo" && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">📖 WOO-verzoek Details</h3>
              <div className="bg-gray-50 rounded p-4 space-y-2">
                {renderField(
                  "Bestuursorgaan",
                  intakeData.bestuursorgaan
                )}
                {renderField(
                  "Onderwerp",
                  intakeData.wooOnderwerp
                )}
                {renderField(
                  "Periode",
                  intakeData.wooPeriode
                )}
                {renderField(
                  "Documenten",
                  intakeData.wooDocumenten
                )}
                {renderField(
                  "Digitale verstrekking",
                  intakeData.digitaleVerstrekking
                )}
                {renderField(
                  "Spoedeisend",
                  intakeData.spoed
                )}
              </div>
            </div>
          )}

          <Alert type="info">
            Klopt alles? Klik Terug naar intake als je iets wilt wijzigen. Anders ga je door naar
            het volgende stap waar je je pakket kiest.
          </Alert>
        </div>

        <div className="flex gap-4 mt-8">
          <Button variant="secondary" onClick={handleEdit} className="flex-1">
            Terug naar intake
          </Button>
          <Button onClick={handleContinue} className="flex-1">
            Ga naar productkeuze →
          </Button>
        </div>
      </Card>
    </div>
  );
}
