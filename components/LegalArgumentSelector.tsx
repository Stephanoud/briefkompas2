import React from "react";
import {
  LEGAL_ARGUMENT_OPTIONS,
  LegalArgumentOption,
} from "@/lib/legal-argument-options";
import { LegalArgumentOptionId } from "@/types";
import { Textarea } from "./Textarea";

interface LegalArgumentSelectorProps {
  selectedIds: LegalArgumentOptionId[];
  customText: string;
  onToggle: (id: LegalArgumentOptionId, checked: boolean) => void;
  onCustomTextChange: (value: string) => void;
  options?: readonly LegalArgumentOption[];
}

export const LegalArgumentSelector: React.FC<LegalArgumentSelectorProps> = ({
  selectedIds,
  customText,
  onToggle,
  onCustomTextChange,
  options = LEGAL_ARGUMENT_OPTIONS,
}) => {
  const baseId = React.useId();
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <fieldset className="space-y-4" aria-describedby={`${baseId}-help ${baseId}-status`}>
      <div>
        <legend className="text-2xl font-semibold text-[var(--foreground)]">
          Mogelijke argumenten
        </legend>
        <p id={`${baseId}-help`} className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Kruis alleen aan welke invalshoeken u mogelijk relevant vindt. Dit is optioneel en geen juridisch advies.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const inputId = `${baseId}-${option.id}`;
          const descriptionId = `${inputId}-description`;
          const checked = selectedSet.has(option.id);

          return (
            <div
              key={option.id}
              className={`rounded-xl border bg-white p-4 transition-colors ${
                checked ? "border-[var(--brand)] shadow-sm" : "border-[var(--border)]"
              }`}
            >
              <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
                <input
                  id={inputId}
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[var(--border)] accent-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  checked={checked}
                  onChange={(event) => onToggle(option.id, event.target.checked)}
                  aria-describedby={descriptionId}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    {option.label}
                  </span>
                  <span id={descriptionId} className="mt-1 block text-sm leading-6 text-[var(--muted-strong)]">
                    {option.description}
                  </span>
                </span>
              </label>

              {option.allowsCustomText && checked && (
                <div className="mt-4">
                  <Textarea
                    label="Welke andere mogelijke invalshoek bedoelt u?"
                    value={customText}
                    onChange={(event) => onCustomTextChange(event.target.value)}
                    placeholder="Bijvoorbeeld: er is eerder iets toegezegd, of een specifiek stuk ontbreekt."
                    characterCount={customText.trim().length}
                    maxLength={500}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p id={`${baseId}-status`} className="text-sm text-[var(--muted)]" aria-live="polite">
        {selectedIds.length === 0
          ? "Geen invalshoeken geselecteerd. U kunt gewoon doorgaan."
          : `${selectedIds.length} mogelijke invalshoek${selectedIds.length === 1 ? "" : "en"} geselecteerd.`}
      </p>
    </fieldset>
  );
};
