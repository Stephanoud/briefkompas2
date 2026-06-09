import React from "react";
import { DossierCheckItem, DossierCheckLevel, DossierQualityCheck } from "@/types";

interface DossierCheckPanelProps extends React.HTMLAttributes<HTMLElement> {
  check: DossierQualityCheck;
}

const levelPresentation: Record<
  DossierCheckLevel,
  {
    icon: string;
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  green: {
    icon: "🟢",
    label: "Groen",
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    dotClassName: "bg-emerald-500",
  },
  orange: {
    icon: "🟠",
    label: "Oranje",
    className: "border-amber-200 bg-amber-50 text-amber-950",
    dotClassName: "bg-amber-500",
  },
  red: {
    icon: "🔴",
    label: "Rood",
    className: "border-red-200 bg-red-50 text-red-950",
    dotClassName: "bg-red-500",
  },
};

function DossierCheckRow({ item }: { item: DossierCheckItem }) {
  const presentation = levelPresentation[item.level];

  return (
    <li className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{item.title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">{item.explanation}</p>
        </div>
        <div
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${presentation.className}`}
          aria-label={`${presentation.label}: ${item.label}`}
        >
          <span aria-hidden="true">{presentation.icon}</span>
          <span>{item.label}</span>
        </div>
      </div>

      {item.signals.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={`Signalen voor ${item.title}`}>
          {item.signals.map((signal) => (
            <li
              key={signal}
              className="flex min-w-0 items-start gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--muted-strong)]"
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${presentation.dotClassName}`} aria-hidden="true" />
              <span>{signal}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export const DossierCheckPanel: React.FC<DossierCheckPanelProps> = ({
  check,
  className = "",
  ...props
}) => {
  return (
    <section className={className} aria-labelledby="dossiercheck-title" {...props}>
      <div className="border-b border-[var(--border)] pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Voor generatie
        </p>
        <h2 id="dossiercheck-title" className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
          Dossiercheck
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Een praktische check op volledigheid en concreetheid van uw dossier.
        </p>
      </div>

      <ul className="mt-5 space-y-3">
        {check.items.map((item) => (
          <DossierCheckRow key={item.category} item={item} />
        ))}
      </ul>

      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--muted-strong)]">
        {check.disclaimer}
      </div>
    </section>
  );
};
