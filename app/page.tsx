import Link from "next/link";
import { Container } from "@/components/Container";

const sectionCardClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

export default function HomePage() {
  return (
    <div className="w-full text-slate-900">
      <section className="scroll-mt-24">
        <Container>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-7 text-center">
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
                    className="inline-flex h-11 items-center justify-center rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
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

              <div className="lg:col-span-5">
                <div className={sectionCardClass}>
                  <h2 className="text-base font-semibold">Wat je krijgt</h2>
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

      <section id="hoe-het-werkt" className="scroll-mt-24 py-12">
        <Container>
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Hoe het werkt</h2>
            <p className="mt-2 text-sm text-slate-600">Drie stappen. Duidelijk en praktisch.</p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
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
              <article key={item.title} className={sectionCardClass}>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section id="prijzen" className="scroll-mt-24 py-12 bg-slate-50 border-y border-slate-200">
        <Container>
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Prijzen</h2>
            <p className="mt-2 text-sm text-slate-600">Je kiest je pakket na intake en review.</p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className={sectionCardClass}>
              <h3 className="text-base font-semibold">Basis</h3>
              <p className="mt-1 text-3xl font-semibold">EUR 7,95</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>1 besluit upload (bij bezwaar)</li>
                <li>Begeleide intake en overzicht</li>
                <li>Conceptbrief in vaste structuur</li>
                <li>Download als DOCX</li>
              </ul>
            </article>

            <article className={sectionCardClass}>
              <h3 className="text-base font-semibold">Uitgebreid</h3>
              <p className="mt-1 text-3xl font-semibold">EUR 14,95</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>Alles van Basis</li>
                <li>Extra bijlagen upload (maximaal 5)</li>
                <li>Bijlagenoverzicht in de brief</li>
                <li>Extra bewerkbare sectie voor verwijzingen</li>
              </ul>
            </article>
          </div>
        </Container>
      </section>

      <section id="faq" className="scroll-mt-24 py-12">
        <Container>
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight">FAQ</h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              {
                q: "Is dit juridisch advies?",
                a: "Nee. BriefKompas helpt je met opbouw en formulering, maar vervangt geen juridisch advies.",
              },
              {
                q: "Kan ik bijlagen toevoegen?",
                a: "Ja. Het besluit is verplicht bij bezwaar; extra bijlagen zijn mogelijk in Uitgebreid.",
              },
              {
                q: "Kan ik de brief aanpassen?",
                a: "Ja. Je kunt de conceptbrief controleren en aanpassen voordat je deze downloadt.",
              },
            ].map((item) => (
              <article key={item.q} className={sectionCardClass}>
                <h3 className="text-base font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
