import Link from "next/link";

const steps = [
  "Upload uw besluit",
  "Beantwoord enkele vragen",
  "Controleer de analyse",
  "Download uw conceptbrief",
];

const trustItems = [
  "Geen juridisch advies",
  "U houdt volledige controle",
  "Conceptbrief direct downloadbaar",
  "Geschikt voor bezwaar en beroep",
];

export function HomepageLandingContent() {
  return (
    <div className="space-y-12">
      <section className="overflow-hidden rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf9_100%)] px-5 py-9 shadow-[0_18px_40px_rgba(17,33,28,0.07)] sm:px-8 sm:py-12">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
            BriefKompas
          </p>
          <h1 className="mt-4 text-4xl leading-[1.04] text-[var(--foreground)] sm:text-5xl">
            Maak binnen enkele minuten een professioneel bezwaar- of beroepschrift
          </h1>
          <p className="mt-5 max-w-[62ch] text-base leading-8 text-[var(--muted-strong)] sm:text-lg">
            Upload uw besluit. BriefKompas helpt bij het structureren van uw argumenten en maakt
            een conceptbrief die u zelf kunt controleren en aanpassen.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/start-brief"
              className="cta-button-link inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--brand)] px-6 text-base font-semibold text-white shadow-sm hover:bg-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
            >
              Start met uw besluit
            </Link>
            <Link
              href="#hoe-het-werkt"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-6 text-base font-semibold text-[var(--foreground)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
            >
              Bekijk hoe het werkt
            </Link>
          </div>
        </div>
      </section>

      <section id="hoe-het-werkt" aria-labelledby="how-it-works-title" className="scroll-mt-24">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Stap voor stap
          </p>
          <h2 id="how-it-works-title" className="mt-1 text-3xl font-semibold text-[var(--foreground)]">
            Zo werkt het
          </h2>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step}
              className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_12px_28px_rgba(17,33,28,0.05)]"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-soft)] text-sm font-semibold text-[var(--brand)]">
                {index + 1}
              </span>
              <p className="mt-4 text-base font-semibold text-[var(--foreground)]">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="example-title" className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Voorbeeld
          </p>
          <h2 id="example-title" className="mt-1 text-3xl font-semibold text-[var(--foreground)]">
            Voorbeeld
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
            Een geanonimiseerde mock-up van het soort conceptbrief dat u na controle kunt downloaden.
            De inhoud blijft altijd gebaseerd op uw eigen besluit, antwoorden en uploads.
          </p>
        </div>

        <article
          aria-label="Geanonimiseerde voorbeeldbrief"
          className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_18px_38px_rgba(17,33,28,0.06)] sm:p-6"
        >
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Conceptbrief
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                  Bezwaar tegen besluit [kenmerk]
                </h3>
              </div>
              <p className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
                Geanonimiseerd
              </p>
            </div>

            <div className="mt-4 space-y-4 rounded-lg bg-white p-4 text-sm leading-7 text-[var(--muted-strong)]">
              <p>
                Geachte heer/mevrouw,
              </p>
              <p>
                Hierbij maak ik bezwaar tegen het besluit van [datum] over [onderwerp]. Ik vraag u
                het besluit opnieuw te beoordelen.
              </p>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Gronden van bezwaar</p>
                <ul className="mt-2 space-y-2">
                  <li className="border-l-2 border-[var(--brand)] pl-3">
                    De motivering lijkt onvoldoende in te gaan op de door mij aangeleverde informatie.
                  </li>
                  <li className="border-l-2 border-[var(--brand)] pl-3">
                    Uit het besluit blijkt niet duidelijk hoe mijn belangen zijn meegewogen.
                  </li>
                </ul>
              </div>
              <p>
                Ik verzoek u het besluit te heroverwegen en mij te informeren over het verdere verloop.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section aria-labelledby="trust-title" className="rounded-2xl border border-[var(--border)] bg-white px-5 py-6 shadow-[0_12px_28px_rgba(17,33,28,0.05)] sm:px-6">
        <h2 id="trust-title" className="text-2xl font-semibold text-[var(--foreground)]">
          Vertrouwd werken aan uw conceptbrief
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {trustItems.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-xl bg-[var(--surface-soft)] p-4">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[var(--brand)]"
              >
                &#10003;
              </span>
              <span className="text-sm font-medium leading-6 text-[var(--foreground)]">{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
