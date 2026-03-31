import Link from "next/link";
import { Alert } from "@/components/Alerts";
import { Card } from "@/components/Card";
import { LetterPreview } from "@/components/LetterPreview";
import { RecoverSessionActions } from "@/components/RecoverSessionActions";
import { findLetterRecordByToken } from "@/lib/saved-letters/store";
import { toRecoveredLetterSessionPayload } from "@/lib/saved-letters/payload";
import { getFlowDocumentLabel, getFlowLabel } from "@/lib/flow";

type RecoverPageProps = {
  params: Promise<{
    token: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildSummaryRows(payload: NonNullable<ReturnType<typeof toRecoveredLetterSessionPayload>>) {
  const data = payload.intakeData;

  return [
    { label: "Traject", value: getFlowLabel(payload.flow) },
    { label: "Bestuursorgaan", value: data.bestuursorgaan },
    { label: "Datum besluit", value: data.datumBesluit },
    { label: "Kenmerk", value: data.kenmerk },
    { label: "Categorie", value: data.categorie },
    { label: "Doel", value: data.doel },
    { label: "Gronden", value: data.gronden },
    { label: "Persoonlijke omstandigheden", value: data.persoonlijkeOmstandigheden },
    { label: "WOO-onderwerp", value: data.wooOnderwerp },
    { label: "WOO-periode", value: data.wooPeriode },
    { label: "WOO-documenten", value: data.wooDocumenten },
  ].filter((row) => typeof row.value === "string" && row.value.trim().length > 0);
}

export default async function RecoverPage({ params }: RecoverPageProps) {
  const { token } = await params;
  const record = await findLetterRecordByToken(token);
  const payload = record ? toRecoveredLetterSessionPayload(record) : null;

  if (!record || !payload) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Alert type="error" title="Deze herstel-link is ongeldig of verlopen.">
          Start opnieuw om een nieuwe brief te maken.
        </Alert>
        <Link
          href="/"
          className="inline-flex rounded-xl bg-[var(--brand)] px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)]"
        >
          Start opnieuw
        </Link>
      </div>
    );
  }

  const summaryRows = buildSummaryRows(payload);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Alert type="success" title="Je brief is teruggevonden.">
        Zet deze brief terug in je browser om verder te gaan in de editor.
      </Alert>

      <Card
        title={`Herstel je ${getFlowDocumentLabel(payload.flow)}`}
        subtitle={`Deze link blijft geldig tot ${formatDate(payload.expiresAt)}.`}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted-strong)]">
            We slaan standaard niets op. Deze herstelpagina werkt alleen omdat er eerder expliciet toestemming is
            gegeven voor tijdelijke opslag.
          </p>
          <RecoverSessionActions payload={payload} />
        </div>
      </Card>

      {summaryRows.length > 0 && (
        <Card title="Ingevoerde gegevens" subtitle="Kerninformatie die bij deze brief hoort">
          <div className="space-y-3">
            {summaryRows.map((row) => (
              <div key={row.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{row.label}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--foreground)]">{row.value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {payload.manualReferences && (
        <Card title="Eigen toevoegingen" subtitle="Tekst die je eerder zelf had toegevoegd">
          <p className="whitespace-pre-line text-sm leading-6 text-[var(--foreground)]">{payload.manualReferences}</p>
        </Card>
      )}

      <Card title="Briefpreview" subtitle="Controleer even of dit de juiste brief is">
        <LetterPreview letterText={payload.generatedLetter.letterText} />
      </Card>
    </div>
  );
}
