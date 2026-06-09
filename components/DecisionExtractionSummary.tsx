import React from "react";
import {
  decisionExtractionOverviewFieldLabels,
  decisionExtractionOverviewFieldOrder,
} from "@/lib/decision-extraction-overview";
import { DecisionExtractionOverview, DecisionExtractionOverviewField } from "@/types";

interface DecisionExtractionSummaryProps extends React.HTMLAttributes<HTMLElement> {
  overview: DecisionExtractionOverview;
}

function getStatusLabel(field: DecisionExtractionOverviewField): string {
  if (field.status === "found") return "Herkend";
  if (field.status === "uncertain") return "Onzeker";
  return "Ontbreekt";
}

function getStatusClassName(field: DecisionExtractionOverviewField): string {
  if (field.status === "found") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (field.status === "uncertain") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted-strong)]";
}

function getDisplayValue(field: DecisionExtractionOverviewField): string {
  return field.status === "found" && field.value
    ? field.value
    : "Niet met zekerheid vastgesteld";
}

export const DecisionExtractionSummary: React.FC<DecisionExtractionSummaryProps> = ({
  overview,
  className = "",
  ...props
}) => {
  const missingLabels = overview.missingFields.map((fieldKey) => decisionExtractionOverviewFieldLabels[fieldKey]);

  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_8px_24px_rgba(17,33,28,0.04)] ${className}`.trim()}
      {...props}
    >
      <div className="border-b border-[var(--border)] pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Na upload
        </p>
        <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
          Wat hebben wij uit uw besluit gehaald?
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
          Alleen gegevens die in het besluit zijn herkend. Dit is geen juridische beoordeling.
        </p>
      </div>

      {overview.warnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
          <p className="font-semibold">Let op</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {overview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {decisionExtractionOverviewFieldOrder.map((fieldKey) => {
          const field = overview.fields[fieldKey];

          return (
            <div
              key={fieldKey}
              className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3"
            >
              <dt className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {decisionExtractionOverviewFieldLabels[fieldKey]}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStatusClassName(field)}`}
                >
                  {getStatusLabel(field)}
                </span>
              </dt>
              <dd className="mt-2 min-h-12 text-sm font-semibold leading-6 text-[var(--foreground)]">
                {getDisplayValue(field)}
              </dd>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                Confidence-score: {field.confidence}%
              </p>
            </div>
          );
        })}
      </dl>

      {missingLabels.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">Ontbrekende gegevens</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
            {missingLabels.join(", ")}
          </p>
        </div>
      )}
    </section>
  );
};
