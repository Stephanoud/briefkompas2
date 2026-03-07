import Link from "next/link";
import Container from "@/components/Container";

const contentWidthClass = "mx-auto w-full max-w-[1100px]";
const surfaceCardClass =
  "rounded-2xl border border-[var(--border)] bg-white shadow-[0_14px_36px_rgba(17,33,28,0.08)]";
const surfaceCardHighContrastClass =
  "rounded-2xl border border-[var(--border-strong)] bg-white shadow-[0_14px_32px_rgba(17,33,28,0.11)]";
const primaryButtonClass =
  "cta-button-link inline-flex h-12 items-center justify-center rounded-lg bg-[var(--brand)] px-7 text-base font-semibold text-white shadow-[0_12px_28px_rgba(31,102,87,0.24)] hover:bg-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";
const tertiaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]";

const heroBenefits = [
  "Begeleide intake die doorvraagt waar nodig.",
  "Overzicht van feiten en doelen voordat je de brief verstuurt.",
  "Conceptbrief in vaste juridische structuur.",
  "Direct downloadbaar als DOCX.",
];

const steps = [
  {
    number: "1",
    title: "Intake",
    text: "Je beantwoordt gerichte vragen over jouw situatie.",
  },
  {
    number: "2",
    title: "Controle",
    text: "Je controleert de feiten en past antwoorden aan.",
  },
  {
    number: "3",
    title: "Brief klaar",
    text: "Je ontvangt een downloadbare conceptbrief.",
  },
];

const useCases = [
  "Bezwaar tegen boetes",
  "Bezwaar tegen vergunning",
  "WOO-verzoek bij gemeente",
  "Bezwaar tegen rioolheffing",
];

export default function Page() {
  return (
    <>
      <section className="w-full border-b border-[var(--border)] py-10 sm:py-14">
        <Container>
          <div className={contentWidthClass}>
            <div className="text-center">
              <p className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                Van intake tot conceptbrief
              </p>
              <h1 className="mx-auto mt-4 w-full text-4xl leading-[1.02] tracking-[-0.02em] sm:text-5xl">
                Jouw bezwaar- of WOO-brief.
              </h1>
              <h2 className="mt-2 text-3xl leading-tight tracking-[-0.02em] sm:text-4xl">
                Zonder jurist, maar met structuur.
              </h2>
            </div>

            <div
              className="mt-7 rounded-[28px] border border-[var(--border)] bg-[linear-gradient(145deg,#ffffff_0%,#f6faf8_62%,#edf7f3_100%)] px-6 py-8 shadow-[0_24px_48px_rgba(17,33,28,0.08)] sm:px-10 sm:py-10"
            >
              <div className="grid gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-start">
                <div className="text-center">
                  <p className="mx-auto max-w-[58ch] text-base leading-relaxed text-[var(--muted)]">
                    Van intake tot conceptbrief, jouw hulp voor een goede brief.
                  </p>

                  <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                    Duurt ongeveer 5 minuten
                  </p>

                  <div className="mt-5 flex flex-col items-center gap-3">
                    <Link href="/start-brief" className={primaryButtonClass}>
                      Start je brief
                    </Link>
                    <a href="#hoe-het-werkt" className={tertiaryButtonClass}>
                      Hoe het werkt
                    </a>
                  </div>

                  <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[10px] font-semibold text-[var(--accent)]"
                        aria-hidden="true"
                      >
                        &#10003;
                      </span>
                      Geen account nodig
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[10px] font-semibold text-[var(--accent)]"
                        aria-hidden="true"
                      >
                        &#10003;
                      </span>
                      Download direct
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[10px] font-semibold text-[var(--accent)]"
                        aria-hidden="true"
                      >
                        &#10003;
                      </span>
                      Geen juridisch advies
                    </span>
                  </p>
                </div>

                <div className="mx-auto w-full max-w-md">
                  <div className={`${surfaceCardClass} p-6 sm:p-7`}>
                    <h2 className="text-lg font-semibold text-center text-[var(--foreground)]">Wat je krijgt</h2>

                    <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--muted)]">
                      {heroBenefits.map((benefit, index) => (
                        <li key={benefit} className="flex gap-3">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs font-semibold text-[var(--brand)]">
                            {index + 1}
                          </span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ol>

                    <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
                      <span className="font-semibold text-[var(--foreground)]">Belangrijk:</span> BriefKompas geeft
                      geen juridisch advies. Jij blijft verantwoordelijk voor de inhoud en verzending.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="hoe-het-werkt" className="w-full py-12 sm:py-14 scroll-mt-24">
        <Container>
          <div className={contentWidthClass}>
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Hoe het werkt</h2>
              <p className="mx-auto mt-3 max-w-[56ch] text-base leading-relaxed text-[var(--muted-strong)]">
                Drie stappen. Duidelijk en praktisch.
              </p>
            </div>

            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {steps.map((item) => (
                <article
                  key={item.title}
                  className={`${surfaceCardHighContrastClass} flex h-full flex-col items-center justify-start p-6 text-center sm:p-7`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)] text-base font-semibold text-[var(--brand)]">
                    {item.number}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold leading-snug text-[var(--foreground)]">{item.title}</h3>
                  <p className="mx-auto mt-3 max-w-[24ch] text-[15px] leading-[1.7] text-[var(--muted-strong)] sm:max-w-[28ch]">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="w-full border-t border-[var(--border)] py-12 sm:py-14">
        <Container>
          <div className={contentWidthClass}>
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                Voorbeelden waarvoor mensen BriefKompas gebruiken
              </h2>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {useCases.map((item) => (
                <article
                  key={item}
                  tabIndex={0}
                  className={`${surfaceCardHighContrastClass} group flex min-h-[96px] items-center justify-center p-5 text-center transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_18px_36px_rgba(17,33,28,0.16)] focus-visible:-translate-y-0.5 focus-visible:border-[var(--accent)] focus-visible:shadow-[0_18px_36px_rgba(17,33,28,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2`}
                >
                  <p className="text-[15px] font-semibold leading-snug text-[var(--foreground)] transition-colors duration-200 group-hover:text-[var(--accent)] sm:text-base">
                    {item}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="w-full border-t border-[var(--border)] py-12 sm:py-14">
        <Container>
          <div className={contentWidthClass}>
            <div className={`${surfaceCardClass} px-6 py-8 text-center sm:px-10 sm:py-10`}>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Klaar om te starten?</h2>
              <p className="mx-auto mt-3 max-w-[48ch] text-sm leading-relaxed text-[var(--muted)]">
                Begin direct met de intake van jouw traject.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link href="/start-brief" className={primaryButtonClass}>
                  Start je brief
                </Link>

                <Link href="/faq" className={tertiaryButtonClass}>
                  Veelgestelde vragen
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
