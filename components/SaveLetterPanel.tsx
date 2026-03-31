"use client";

import { useMemo, useState } from "react";
import { Flow, GeneratedLetter, IntakeFormData, Product } from "@/types";
import { Alert } from "@/components/Alerts";
import { Button } from "@/components/Button";
import { ConsentCheckboxGroup } from "@/components/ConsentCheckboxGroup";
import { RecoveryLinkBox } from "@/components/RecoveryLinkBox";

interface SaveLetterPanelProps {
  flow: Flow;
  product: Product | null;
  intakeData: IntakeFormData;
  generatedLetter: GeneratedLetter;
  manualReferences: string;
}

type SaveLetterResponse = {
  ok: true;
  recoveryUrl: string;
  expiresAt: string;
};

function getPanelIntro(flow: Flow) {
  const label = flow === "woo" ? "je verzoek" : "je brief";
  return `Wil je later verder kunnen met ${label}? Sla hem tijdelijk op en ontvang een herstel-link.`;
}

export function SaveLetterPanel({
  flow,
  product,
  intakeData,
  generatedLetter,
  manualReferences,
}: SaveLetterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [consentStorage, setConsentStorage] = useState(false);
  const [consentResearch, setConsentResearch] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedState, setSavedState] = useState<SaveLetterResponse | null>(null);

  const introText = useMemo(() => getPanelIntro(flow), [flow]);

  const handleSubmit = async () => {
    setStorageError("");
    setRequestError("");

    if (!consentStorage) {
      setStorageError("Vink eerst de toestemming voor tijdelijke opslag aan.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/save-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          flow,
          product,
          intakeData,
          generatedLetter,
          manualReferences,
          consentStorage,
          consentResearch,
        }),
      });

      const payload = (await response.json()) as SaveLetterResponse | { error?: string };
      if (!response.ok || !("ok" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error : "Opslaan mislukt.");
      }

      setSavedState(payload);
      setIsOpen(true);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-[26px] border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Bewaar mijn brief</p>
          <p className="mt-2 max-w-[52ch] text-sm leading-6 text-[var(--muted-strong)]">{introText}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setIsOpen((current) => !current)}>
          {isOpen ? "Sluit" : "Bewaar mijn brief"}
        </Button>
      </div>

      {savedState && <RecoveryLinkBox recoveryUrl={savedState.recoveryUrl} expiresAt={savedState.expiresAt} />}

      {isOpen && (
        <div className="space-y-4 rounded-[22px] border border-[var(--border)] bg-white p-4">
          <ConsentCheckboxGroup
            consentStorage={consentStorage}
            consentResearch={consentResearch}
            disabled={isSaving}
            storageError={storageError}
            onConsentStorageChange={setConsentStorage}
            onConsentResearchChange={setConsentResearch}
          />

          {requestError && (
            <Alert type="error" title="Opslaan lukt nu niet">
              {requestError}
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleSubmit} isLoading={isSaving}>
              Opslaan en herstel-link maken
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
