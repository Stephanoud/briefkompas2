"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { readStoredIntake, readStoredProduct, writeStoredIntake } from "@/lib/browser-persistence";
import { getFlowDocumentLabel, isFlow } from "@/lib/flow";
import { LEGAL_ARGUMENT_OPTIONS, normalizeLegalArgumentSelections } from "@/lib/legal-argument-options";
import { useAppStore } from "@/lib/store";
import { Alert, Button, Card, LegalArgumentSelector } from "@/components";
import { Flow, IntakeFormData, LegalArgumentOptionId, LegalArgumentSelection } from "@/types";

const toFlow = (value: string | string[] | undefined): Flow | null => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isFlow(candidate) ? candidate : null;
};

function buildSelections(
  selectedIds: LegalArgumentOptionId[],
  customText: string
): LegalArgumentSelection[] {
  const rawSelections = selectedIds.map((id) =>
    id === "anders" ? { id, customText } : { id }
  );

  return normalizeLegalArgumentSelections(rawSelections);
}

export default function ArgumentenPage() {
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
  const resolvedIntakeData = flow
    ? intakeData?.flow === flow
      ? intakeData
      : storedIntakeData
    : null;
  const initialSelections = normalizeLegalArgumentSelections(resolvedIntakeData?.mogelijkeArgumenten);
  const [selectedIds, setSelectedIds] = useState<LegalArgumentOptionId[]>(
    () => initialSelections.map((selection) => selection.id)
  );
  const [customText, setCustomText] = useState(
    () => initialSelections.find((selection) => selection.id === "anders")?.customText ?? ""
  );

  useEffect(() => {
    if (!flow) {
      return;
    }

    const storedProduct = readStoredProduct();
    const storedIntake = readStoredIntake(flow) as IntakeFormData | null;
    const nextIntake = intakeData?.flow === flow ? intakeData : storedIntake ? { ...storedIntake, flow } : null;

    if (currentFlow !== flow) {
      setFlow(flow);
    }
    if (storedProduct && currentProduct !== storedProduct) {
      setProduct(storedProduct);
    }
    if (nextIntake && (!intakeData || intakeData.flow !== flow)) {
      setIntakeData(nextIntake);
    }
  }, [currentFlow, currentProduct, flow, intakeData, setFlow, setIntakeData, setProduct]);

  const selectedCount = useMemo(
    () => buildSelections(selectedIds, customText).length,
    [customText, selectedIds]
  );

  const handleToggle = (id: LegalArgumentOptionId, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((item) => item !== id);
    });
  };

  const saveAndContinue = (selections: LegalArgumentSelection[]) => {
    if (!flow || !resolvedIntakeData) {
      return;
    }

    const withFlow = {
      ...resolvedIntakeData,
      flow,
      mogelijkeArgumenten: selections,
    };

    setIntakeData(withFlow);
    writeStoredIntake(withFlow);
    router.push(`/generate/${flow}`);
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

  if (!resolvedIntakeData) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Mogelijke argumenten niet beschikbaar">
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
        <div className="border-b border-[var(--border)] pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Optionele stap
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--foreground)]">
            Mogelijke argumenten
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
            U kunt hier aangeven welke invalshoeken volgens u aandacht verdienen. Als u niets kiest,
            maken we uw {getFlowDocumentLabel(flow)} op basis van de bestaande intake.
          </p>
        </div>

        <div className="mt-5">
          <Alert type="info" title="Geen juridisch advies">
            Deze stap helpt de generator om uw aandachtspunten te herkennen. BriefKompas trekt hieruit
            geen juridische conclusie en voorspelt geen uitkomst.
          </Alert>
        </div>

        <div className="mt-6">
          <LegalArgumentSelector
            selectedIds={selectedIds}
            customText={customText}
            onToggle={handleToggle}
            onCustomTextChange={setCustomText}
            options={LEGAL_ARGUMENT_OPTIONS}
          />
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--muted-strong)]">
          {selectedCount === 0
            ? "Geen keuze gemaakt. De huidige flow blijft werken en de brief wordt zonder extra argumentkeuzes gegenereerd."
            : "De gekozen invalshoeken worden alleen verwerkt als de intake, het besluit of uploads daarvoor concrete aanknopingspunten geven."}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/dossiercheck/${flow}`)}
            className="flex-1"
          >
            Terug naar Dossiercheck
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => saveAndContinue([])}
            className="flex-1"
          >
            Overslaan
          </Button>
          <Button
            type="button"
            onClick={() => saveAndContinue(buildSelections(selectedIds, customText))}
            className="flex-1"
          >
            Maak {getFlowDocumentLabel(flow)}
          </Button>
        </div>
      </Card>
    </div>
  );
}
