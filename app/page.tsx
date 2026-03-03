import Link from "next/link";
import Container from "@/components/Container";

const sectionCardClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const contentWidthClass = "mx-auto w-full max-w-5xl";

export default function Page() {
  return (
    <>
      <section className="w-full border-b border-slate-200 py-12 sm:py-16">
        <Container>
          <div className={contentWidthClass}>
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="text-center">
                <p className="mb-3 inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                  Van intake tot conceptbrief
                </p>

                <h1 className="mx-auto max-w-3xl text-4xl sm:text-5xl leading-[1.05] tracking-tight">
                  Jouw bezwaar- of WOO-brief. Helder, rustig en controleerbaar.
                </h1>

                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
                  Van intake tot conceptbrief, jouw hulp voor een goede brief.
                </p>

                <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/start-bezwaar"
                    className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-600"
                  >
                    Start bezwaar
                  </Link>

                  <Link
                    href="/start-woo"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Start WOO-verzoek
                  </Link>

                  <a
                    href="#hoe-het-werkt"
                    className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Hoe het werkt
                  </a>
                </div>
              </div>

              <div className="mx-auto w-full max-w-md">
                <div className={sectionCardClass}>
                  <h2 className="text-base font-semibold text-center">Wat je krijgt</h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>1. Begeleide intake die doorvraagt waar nodig.</li>
                    <li>2. Overzicht om feiten en doelen te controleren.</li>
                    <li>3. Conceptbrief in vaste structuur, downloadbaar als DOCX.</li>
                  </ul>
                  <p className="mt-4 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Belangrijk:</span> BriefKompas geeft geen
                    juridisch advies. Jij blijft verantwoordelijk voor de inhoud en verzending.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="hoe-het-werkt" className="w-full py-12 sm:py-16 scroll-mt-24">
        <Container>
          <div className={contentWidthClass}>
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Hoe het werkt</h2>
              <p className="mt-2 text-sm text-slate-600">Drie stappen. Duidelijk en praktisch.</p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Intake",
                  text: "Begeleide vragen over jouw situatie, doel en onderbouwing.",
                },
                {
                  title: "Controle",
                  text: "Je ziet een overzicht en past antwoorden aan waar nodig.",
                },
                {
                  title: "Brief klaar",
                  text: "Je ontvangt een conceptbrief in vaste structuur, direct downloadbaar.",
                },
              ].map((item) => (
                <article key={item.title} className={`${sectionCardClass} text-center`}>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="w-full border-t border-slate-200 py-12 sm:py-16">
        <Container>
          <div className="mx-auto w-full max-w-3xl">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-2xl font-semibold tracking-tight">Klaar om te starten?</h2>
              <p className="mt-3 text-sm text-slate-600">Begin direct met de intake van jouw traject.</p>

              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/start-bezwaar"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Start bezwaar
                </Link>

                <Link
                  href="/start-woo"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Start WOO-verzoek
                </Link>

                <Link
                  href="/faq"
                  className="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
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
