"use client";

import Link from "next/link";
import Container from "@/components/Container";
import { homepageProcedureOptions } from "@/lib/flow";

const contentWidthClass = "mx-auto w-full max-w-[1120px]";
const cardClass =
  "rounded-2xl border border-[var(--border)] bg-white shadow-[0_16px_40px_rgba(17,33,28,0.08)]";
const heroButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-white px-5 py-4 text-left text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[0_14px_28px_rgba(17,33,28,0.12)]";
const primaryButtonClass =
  "inline-flex h-12 items-center justify-center rounded-lg bg-[var(--brand)] px-7 text-base font-semibold text-white shadow-[0_12px_28px_rgba(31,102,87,0.24)] hover:bg-[var(--brand-strong)]";

const routeSignals = [
  "Eerst routecheck, daarna pas inhoudelijke intake.",
  "Ondersteunt zienswijze, bezwaar, beroep en WOO.",
  "Ontworpen voor scanbare, formele bestuursrechtelijke brieven.",
];

const faqItems = [
  {
    question: "Wanneer maak ik bezwaar?",
    answer:
      "Als u een definitief besluit heeft ontvangen en onderaan staat dat u bezwaar kunt maken. Dit is de standaardroute.",
  },
  {
    question: "Wanneer ga ik direct in beroep?",
    answer:
      "Als er eerst een ontwerpbesluit lag en u een zienswijze kon indienen, of als in het besluit staat dat u direct beroep kunt instellen.",
  },
  {
    question: "Wanneer dien ik een zienswijze in?",
    answer:
      "Als er nog geen definitief besluit is, maar wel een ontwerpbesluit waar u op kunt reageren.",
  },
  {
    question: "Moet ik altijd eerst bezwaar maken?",
    answer:
      "Nee. Bij sommige procedures, zoals uitgebreide voorbereidingsprocedures, slaat u bezwaar over en gaat u direct naar de rechter.",
  },
  {
    question: "Wat als ik het niet zeker weet?",
    answer:
      "De tool helpt automatisch de juiste route bepalen op basis van uw antwoorden.",
  },
];

export default function Page() {
  return (
    <>
      <section className="w-full border-b border-[var(--border)] py-12 sm:py-16">
        <Container>
          <div className={contentWidthClass}>
            <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
              <div>
                <p className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
                  Procedurele navigator + documentgenerator
                </p>
                <h1 className="mt-5 text-4xl leading-[1.02] tracking-[-0.03em] text-[var(--foreground)] sm:text-5xl">
                  Niet elke overheidsbeslissing begint met bezwaar.
                </h1>
                <p className="mt-5 max-w-[58ch] text-base leading-8 text-[var(--muted-strong)]">
                  Soms moet u eerst een zienswijze indienen, of kunt u direct in beroep. BriefKompas
                  helpt u de juiste route kiezen.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {homepageProcedureOptions.map((option) => (
                    <Link key={option.flow} href={option.href} className={heroButtonClass}>
                      <span>
                        <span className="block text-base text-[var(--foreground)]">{option.title}</span>
                        <span className="mt-1 block font-normal leading-6 text-[var(--muted)]">
                          {option.description}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/start-brief" className={primaryButtonClass}>
                    Start procedurecheck
                  </Link>
                  <Link
                    href="#faq"
                    className="inline-flex h-12 items-center justify-center rounded-lg px-4 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Bekijk veelgestelde vragen
                  </Link>
                </div>
              </div>

              <div className={`${cardClass} p-6 sm:p-7`}>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Wat deze tool eerst doet</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted-strong)]">
                  {routeSignals.map((item, index) => (
                    <li key={item} className="flex gap-3">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs font-semibold text-[var(--brand)]">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Routecheck in de intake</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    De intake begint met vragen over besluit, ontwerpbesluit, zienswijze, bezwaar,
                    beslissing op bezwaar, rechtsmiddelenclausule en belanghebbendheid. Daarna
                    bevestigt de tool welke procedure op basis van uw antwoorden het meest voor de
                    hand ligt.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="w-full py-12 sm:py-14">
        <Container>
          <div className={contentWidthClass}>
            <div className="grid gap-5 md:grid-cols-3">
              <article className={`${cardClass} p-6`}>
                <p className="text-sm font-semibold text-[var(--brand)]">1. Route bepalen</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                  Eerst wordt bepaald of zienswijze, bezwaar, beroep zonder bezwaar, beroep na bezwaar
                  of een WOO-verzoek het beste past.
                </p>
              </article>
              <article className={`${cardClass} p-6`}>
                <p className="text-sm font-semibold text-[var(--brand)]">2. Intake aanscherpen</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                  Pas daarna volgt een inhoudelijke intake met gerichte vragen over besluit, argumenten,
                  belangen, feiten en bewijs.
                </p>
              </article>
              <article className={`${cardClass} p-6`}>
                <p className="text-sm font-semibold text-[var(--brand)]">3. Brief genereren</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                  De output is een formeel document in bestuursrechtelijke structuur, geschikt voor
                  verzending per e-mail of als PDF.
                </p>
              </article>
            </div>
          </div>
        </Container>
      </section>

      <section id="faq" className="w-full border-t border-[var(--border)] py-12 sm:py-14 scroll-mt-24">
        <Container>
          <div className={contentWidthClass}>
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">FAQ</h2>
              <p className="mx-auto mt-3 max-w-[56ch] text-base leading-relaxed text-[var(--muted-strong)]">
                Korte antwoorden op de meest voorkomende procedurevragen.
              </p>
            </div>

            <div className="mt-8 grid gap-4">
              {faqItems.map((item) => (
                <article key={item.question} className={`${cardClass} p-6`}>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{item.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
