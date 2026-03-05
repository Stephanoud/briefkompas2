import Link from "next/link";
import Container from "@/components/Container";

const contentWidthClass = "mx-auto w-full max-w-[1100px]";
const surfaceCardClass =
  "rounded-2xl border border-[var(--border)] bg-white shadow-[0_14px_36px_rgba(17,33,28,0.08)]";
const heroStartButtonClass =
  "inline-flex h-14 min-w-[230px] items-center justify-center rounded-xl border border-[#cfd6db] bg-[#f7f8fa] px-8 text-base font-semibold text-[var(--foreground)] shadow-[0_8px_18px_rgba(18,35,31,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_24px_rgba(18,35,31,0.18)] active:translate-y-0 active:shadow-[0_6px_12px_rgba(18,35,31,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";
const startButtonClass =
  "inline-flex h-11 items-center justify-center rounded-md border border-[#d7dde1] bg-[#f3f5f7] px-5 text-sm font-semibold text-[var(--foreground)] hover:bg-[#e9edf1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";
const tertiaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]";

const heroBenefits = [
  "Begeleide intake die doorvraagt waar nodig.",
  "Overzicht om feiten en doelen te controleren.",
  "Conceptbrief in vaste structuur, downloadbaar als DOCX.",
];

const steps = [
  {
    number: "1",
    title: "Intake",
    text: "Begeleide vragen over jouw situatie, doel en onderbouwing.",
  },
  {
    number: "2",
    title: "Controle",
    text: "Je ziet een overzicht en past antwoorden aan waar nodig.",
  },
  {
    number: "3",
    title: "Brief klaar",
    text: "Je ontvangt een conceptbrief in vaste structuur, direct downloadbaar.",
  },
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
                <span className="block">Helder, met impact en controleerbaar.</span>
              </h1>
            </div>

            <div
              className="mt-7 rounded-[28px] border border-[var(--border)] bg-[linear-gradient(145deg,#ffffff_0%,#f6faf8_62%,#edf7f3_100%)] px-6 py-8 shadow-[0_24px_48px_rgba(17,33,28,0.08)] sm:px-10 sm:py-10"
            >
              <div className="grid gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-start">
                <div className="text-center lg:text-left">
                  <p className="mx-auto max-w-[58ch] text-base leading-relaxed text-[var(--muted)] lg:mx-0">
                    Van intake tot conceptbrief, jouw hulp voor een goede brief.
                  </p>

                  <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
                    <Link href="/start-bezwaar" className={heroStartButtonClass}>
                      Start bezwaar
                    </Link>

                    <Link href="/start-woo" className={heroStartButtonClass}>
                      Start WOO-verzoek
                    </Link>

                    <a href="#hoe-het-werkt" className={tertiaryButtonClass}>
                      Hoe het werkt
                    </a>
                  </div>
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
              <p className="mt-2 text-sm text-[var(--muted)]">Drie stappen. Duidelijk en praktisch.</p>
            </div>

            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {steps.map((item) => (
                <article key={item.title} className={`${surfaceCardClass} h-full p-5 text-center`}>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] text-sm font-semibold text-[var(--brand)]">
                    {item.number}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.text}</p>
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
                <Link href="/start-bezwaar" className={startButtonClass}>
                  Start bezwaar
                </Link>

                <Link href="/start-woo" className={startButtonClass}>
                  Start WOO-verzoek
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
