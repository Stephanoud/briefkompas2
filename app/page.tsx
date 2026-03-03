import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-white text-slate-900 w-full">
      {/* Hero */}
      <section className="border-b border-slate-200">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
              AI-gestuurde briefopbouw • Geen juridisch advies
            </p>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Jouw bezwaar- of WOO-brief.
              <span className="block text-slate-600">Helder, rustig en controleerbaar.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              Je doorloopt een begeleide intake, controleert de samenvatting, en downloadt een nette conceptbrief.
              Jij blijft verantwoordelijk voor inhoud en verzending.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
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
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Hoe het werkt →
              </a>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="rounded-md border border-slate-200 px-2 py-1">Geen account nodig</span>
              <span className="rounded-md border border-slate-200 px-2 py-1">DOCX download</span>
              <span className="rounded-md border border-slate-200 px-2 py-1">Duidelijke stappen</span>
            </div>
          </div>

          {/* Trust / summary card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold">Wat je krijgt</div>

              <ul className="mt-3 space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-xs">
                    1
                  </span>
                  <span>Begeleide intake die doorvraagt waar nodig.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-xs">
                    2
                  </span>
                  <span>Review-scherm: jij checkt de feiten en je doelen.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-xs">
                    3
                  </span>
                  <span>Conceptbrief in vaste structuur, direct downloadbaar als DOCX.</span>
                </li>
              </ul>

              <div className="mt-5 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Belangrijk</div>
                <p className="mt-1 leading-relaxed">
                  BriefKompas geeft geen juridisch advies en garandeert geen uitkomst. Controleer altijd de conceptbrief
                  voordat je deze verstuurt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="hoe-het-werkt" className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Hoe het werkt</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Drie stappen. Geen gedoe. Jij houdt regie.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              {
                title: "Intake",
                text: "Begeleide vragen die focussen op besluit, doel en gronden. Waar nodig: verdiepingsvragen.",
              },
              {
                title: "Controle",
                text: "Je ziet een overzicht en kunt corrigeren voordat er een brief wordt gegenereerd.",
              },
              {
                title: "Brief klaar",
                text: "Conceptbrief wordt gegenereerd in vaste structuur en is downloadbaar als DOCX.",
              },
            ].map((s) => (
              <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold">{s.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="prijzen" className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Prijzen</h2>
              <p className="mt-2 text-sm text-slate-600">
                Eenvoudig: betalen per brief. Geen abonnement.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {/* Basic */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Basis</div>
                  <div className="mt-1 text-3xl font-semibold">€7,95</div>
                </div>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  Meest gekozen
                </div>
              </div>

              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li>• 1 besluit upload (bij bezwaar)</li>
                <li>• Begeleide intake + review</li>
                <li>• Conceptbrief in vaste structuur</li>
                <li>• Download als DOCX</li>
              </ul>

              <div className="mt-6 flex gap-3">
                <Link
                  href="/start-bezwaar"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Start bezwaar
                </Link>
                <Link
                  href="/start-woo"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Start WOO
                </Link>
              </div>
            </div>

            {/* Extended */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <div className="text-sm font-semibold">Uitgebreid</div>
                <div className="mt-1 text-3xl font-semibold">€14,95</div>
              </div>

              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li>• Extra bijlagen upload (max 5)</li>
                <li>• Bijlagenoverzicht in de brief</li>
                <li>• Extra bewerkbare sectie "verwijzingen/jurisprudentie"</li>
                <li>• Besluit-samenvatting (indien beschikbaar)</li>
              </ul>

              <div className="mt-6">
                <Link
                  href="/start-bezwaar"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Start met intake (kies later)
                </Link>
                <p className="mt-2 text-xs text-slate-500">
                  Je kiest Basis of Uitgebreid pas na de intake en review.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Let op:</span> BriefKompas geeft geen juridisch advies. Jij
            controleert en verstuurt de brief zelf.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              {
                q: "Is dit juridisch advies?",
                a: "Nee. BriefKompas structureert jouw input en genereert een conceptbrief. Jij blijft verantwoordelijk voor inhoud en verzending.",
              },
              {
                q: "Kan ik bijlagen toevoegen?",
                a: "Bij bezwaar: het besluit is verplicht. Extra bijlagen kunnen in de Uitgebreid-variant (max 5).",
              },
              {
                q: "Kan ik de brief aanpassen?",
                a: "Ja. Je ziet de tekst in de resultaatpagina en kunt aanpassen vóór je downloadt.",
              },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold">{item.q}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
