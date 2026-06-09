"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { buildDossierQualityCheck } from "@/lib/dossier-quality-check";
import { readStoredIntake, readStoredProduct, writeStoredIntake } from "@/lib/browser-persistence";
import { getFlowDocumentLabel, isFlow } from "@/lib/flow";
import { useAppStore } from "@/lib/store";
import { Alert, Button, Card, DossierCheckPanel } from "@/components";
import { Flow, IntakeFormData } from "@/types";

const toFlow = (value: string | string[] | undefined): Flow | null => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isFlow(candidate) ? candidate : null;
};

export default function DossierCheckPage() {
  const router = useRouter();
  const params = useParams<{ flow?: string }>();
  const flow = toFlow(params?.flow);
  const currentFlow = useAppStore((state) => state.flow);
  const currentProduct = useAppStore((state) => state.product);
  const intakeData = useAppStore((state) => state.intakeData);
  const setFlow = useAppStore((state) => state.setFlow);
  const setProduct = useAppStore((state) => state.setProduct);
  const setIntakeData = useAppStore((state) => state.setIntakeData);
  const storedIntakeData = flow ? (readStoredIntake(flow) as IntakeFormData | null) : null;
  const resolvedIntakeData = flow ? intakeData ?? storedIntakeData : null;

  useEffect(() => {
    if (!flow) {
      return;
    }

    const storedProduct = readStoredProduct();
    const storedIntake = readStoredIntake(flow) as IntakeFormData | null;
    const nextIntake = intakeData ?? storedIntake;

    if (currentFlow !== flow) {
      setFlow(flow);
    }
    if (storedProduct && currentProduct !== storedProduct) {
      setProduct(storedProduct);
    }
    if (nextIntake && (!intakeData || intakeData.flow !== flow)) {
      const withFlow = { ...nextIntake, flow };
      setIntakeData(withFlow);
    }
  }, [currentFlow, currentProduct, flow, intakeData, setFlow, setIntakeData, setProduct]);

  const dossierCheck = useMemo(() => {
    if (!resolvedIntakeData) {
      return null;
    }

    return buildDossierQualityCheck(resolvedIntakeData);
  }, [resolvedIntakeData]);

  const handleGenerate = () => {
    if (!flow || !resolvedIntakeData) {
      return;
    }

    const withFlow = { ...resolvedIntakeData, flow };
    setIntakeData(withFlow);
    writeStoredIntake(withFlow);
    router.push(`/argumenten/${flow}`);
  };

  if (!flow) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert type="error" title="Route ontbreekt">
          Het type traject ontbreekt. Ga terug naar de start en probeer opnieuw.
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          Terug naar start
        </Button>
      </div>
    );
  }

  if (!resolvedIntakeData || !dossierCheck) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Dossiercheck niet beschikbaar">
          <div className="space-y-4">
            <Alert type="warning" title="Geen intakegegevens gevonden">
              We konden uw dossiergegevens niet vinden. Controleer de intake voordat u de brief maakt.
            </Alert>
            <Button onClick={() => router.push(`/intake/${flow}`)} className="w-full">
              Terug naar intake
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <DossierCheckPanel check={dossierCheck} />

        <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
          <p className="font-semibold">Wat gebeurt hierna?</p>
          <p className="mt-1">
            Als u doorgaat, kunt u optioneel aangeven welke mogelijke argumentlijnen aandacht verdienen.
            Daarna maken we uw {getFlowDocumentLabel(flow)} met de gegevens uit uw intake en uploads.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/review/${flow}`)}
            className="flex-1"
          >
            Dossier aanpassen
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/pricing/${flow}`)}
            className="flex-1"
          >
            Productkeuze
          </Button>
          <Button type="button" onClick={handleGenerate} className="flex-1">
            Verder naar mogelijke argumenten
          </Button>
        </div>
      </Card>
    </div>
  );
}
