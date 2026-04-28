"use client";

import { useMemo, useState } from "react";

import { Alert } from "@/components/Alerts";
import { Button } from "@/components/Button";
import { RecoveryLinkBox } from "@/components/RecoveryLinkBox";
import type { SaveLetterResponse } from "@/lib/temporaryLetterStorageTypes";
import type { Flow, GeneratedLetter, IntakeFormData, Product } from "@/types";

interface SaveLetterPanelProps {
  flow: Flow;
  content: string;
  product: Product | null;
  intakeData: IntakeFormData;
  generatedLetter: GeneratedLetter;
  manualReferences: string;
}

function getPanelIntro(flow: Flow) {
  const label = flow === "woo" ? "je verzoek" : "je brief";
  return `Wil je later verder kunnen met ${label}? Sla hem tijdelijk voor 7 dagen op en ontvang een herstel-link.`;
}

export function SaveLetterPanel({
  flow,
  content,
  product,
  intakeData,
  generatedLetter,
  manualReferences,
}: SaveLetterPanelProps) {
  const [requestError, setRequestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedState, setSavedState] = useState<SaveLetterResponse | null>(null);

  const introText = useMemo(() => getPanelIntro(flow), [flow]);

  const handleSubmit = async () => {
    setRequestError("");

    if (!content.trim()) {
      setSavedState(null);
      setRequestError("Er is nog geen briefinhoud om tijdelijk op te slaan.");
      return;
    }

    try {
      setIsSaving(true);
      setSavedState(null);

      const response = await fetch("/api/save-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          flow,
          product,
          intakeData,
          generatedLetter: {
            ...generatedLetter,
            letterText: content,
          },
          manualReferences,
          consentResearch: false,
        }),
      });

      const payload = (await response.json()) as SaveLetterResponse | { error?: string };
      if (!response.ok || !("restoreUrl" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error : "Opslaan mislukt.");
      }

      setSavedState(payload);
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
        <Button type="button" onClick={handleSubmit} isLoading={isSaving}>
          {isSaving ? "Brief opslaan..." : "Bewaar mijn brief"}
        </Button>
      </div>

      {requestError && (
        <Alert type="error" title="Opslaan lukt nu niet">
          {requestError}
        </Alert>
      )}

      {savedState && (
        <RecoveryLinkBox
          restoreUrl={savedState.restoreUrl}
          expiresAt={savedState.expires_at}
        />
      )}
    </div>
  );
}
