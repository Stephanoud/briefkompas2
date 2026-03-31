"use client";

import Link from "next/link";

interface ConsentCheckboxGroupProps {
  consentStorage: boolean;
  consentResearch: boolean;
  disabled?: boolean;
  storageError?: string;
  onConsentStorageChange: (nextValue: boolean) => void;
  onConsentResearchChange: (nextValue: boolean) => void;
}

export function ConsentCheckboxGroup({
  consentStorage,
  consentResearch,
  disabled = false,
  storageError,
  onConsentStorageChange,
  onConsentResearchChange,
}: ConsentCheckboxGroupProps) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
        <input
          type="checkbox"
          checked={consentStorage}
          disabled={disabled}
          onChange={(event) => onConsentStorageChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--border)]"
        />
        <span className="text-sm leading-6 text-[var(--foreground)]">
          Ik geef toestemming om mijn gegevens tijdelijk op te slaan voor herstel van mijn brief.
        </span>
      </label>

      {storageError && <p className="text-sm text-red-700">{storageError}</p>}

      <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
        <input
          type="checkbox"
          checked={consentResearch}
          disabled={disabled}
          onChange={(event) => onConsentResearchChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--border)]"
        />
        <span className="text-sm leading-6 text-[var(--foreground)]">
          Ik geef toestemming om mijn brief geanonimiseerd te gebruiken voor onderzoek en verbetering.
        </span>
      </label>

      <div className="space-y-2 text-sm text-[var(--muted-strong)]">
        <p>Je brief wordt maximaal 30 dagen bewaard. Zonder toestemming slaan we niets op.</p>
        <p>
          <Link href="/privacy" className="underline underline-offset-4 hover:text-[var(--foreground)]">
            Meer weten? Lees hoe we omgaan met privacy en tijdelijke opslag.
          </Link>
        </p>
      </div>
    </div>
  );
}
