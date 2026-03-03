"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Alert } from "@/components/index";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Jouw bezwaar- en WOO-brief in minuten
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            BriefKompas.nl helpt je stap voor stap bij het opstellen van een bezwaarschrift of WOO-verzoek.
            Geen juridisch advies, wel professionele begeleiding.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/start-bezwaar" className="flex-1 sm:flex-none">
            <Button size="lg" className="w-full sm:w-auto">
              Start Bezwaar
            </Button>
          </Link>
          <Link href="/start-woo" className="flex-1 sm:flex-none">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Start WOO-verzoek
            </Button>
          </Link>
        </div>

        {/* Disclaimer Alert */}
        <Alert type="warning" title="Belangrijk">
          Dit is GEEN juridisch advies. BriefKompas.nl helpt je bij het structureren van je brief.
          Je bent zelf verantwoordelijk voor de inhoud en verzending.
        </Alert>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-20 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 my-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Hoe werkt BriefKompas?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <div className="text-3xl mb-4">💬</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Geleide Chat</h3>
              <p className="text-gray-600 text-sm">
                Een AI-chatbot stelt je stap voor stap de juiste vragen om alle noodzakelijke informatie
                in kaart te brengen.
              </p>
            </Card>

            <Card>
              <div className="text-3xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Controleer Gegevens</h3>
              <p className="text-gray-600 text-sm">
                Bekijk je antwoorden in een duidelijk overzicht. Pas alles aan als je dat wilt voordat
                je verder gaat.
              </p>
            </Card>

            <Card>
              <div className="text-3xl mb-4">📄</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Brief Gegenereerd</h3>
              <p className="text-gray-600 text-sm">
                Je krijgt een professioneel opgemaakte conceptbrief die je kunt aanpassen en downloaden
                als PDF of Word.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Prijzen
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Basic Plan */}
            <Card title="Basis" subtitle="€7,95 eenmalig">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Inclusief:</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>Geleide chatbot intake</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>1 PDF-upload (besluit)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>Standaard brief</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>Download als .docx</span>
                    </li>
                  </ul>
                </div>
                <Link href="/pricing/basis">
                  <Button variant="secondary" className="w-full">
                    Bekijk details
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Premium Plan */}
            <Card title="Uitgebreid" subtitle="€14,95 eenmalig">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs font-semibold text-blue-700 mb-3 inline-block">
                  AANBEVOLEN
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Alles van Basis, plus:</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">+</span>
                      <span>Tot 5 bijlagen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">+</span>
                      <span>Samenvatting van besluit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">+</span>
                      <span>Bijlagenoverzicht in brief</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">+</span>
                      <span>Editable jurisprudentikolom</span>
                    </li>
                  </ul>
                </div>
                <Link href="/pricing/uitgebreid">
                  <Button className="w-full">
                    Aan de slag →
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-12 md:py-20 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Veel Gestelde Vragen
          </h2>

          <div className="space-y-6">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">
                Geeft BriefKompas juridisch advies?
              </h3>
              <p className="text-gray-600 text-sm">
                Nee, BriefKompas geeft geen juridisch advies. We helpen je bij het structureren en
                formuleren van je brief, maar je bent zelf verantwoordelijk voor de inhoud en
                verzending. Voor juridisch advies raadpleeg je een advocaat.
              </p>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">
                Wat is het verschil tussen Basis en Uitgebreid?
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                Basis is geschikt voor eenvoudige bezwaren. Uitgebreid geeft je extra ruimte voor
                bijlagen, samenvatting van het besluit en een jurisprudentiëkolom waar je relevante
                rechtszaken kunt toevoegen.
              </p>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">
                Hoe lang duurt het proces?
              </h3>
              <p className="text-gray-600 text-sm">
                De intake duurt ongeveer 10-15 minuten. Daarna keer je de gegevens en selecteer je je
                pakket. De brief wordt direct gegenereerd.
              </p>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">
                Kan ik mijn brief aanpassen?
              </h3>
              <p className="text-gray-600 text-sm">
                Ja! Je krijgt de brief als bewerkbaar document (.docx/PDF). Je kunt deze volledig
                aanpassen voordat je deze verzendt.
              </p>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">
                Is mijn gegevens veilig?
              </h3>
              <p className="text-gray-600 text-sm">
                We slaan je gegevens alleen op voor deze sessie. Na afronding van je bestelling,
                worden alle persoonlijke gegevens verwijderd. Zie onze privacyverklaring voor meer
                informatie.
              </p>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-2">
                Wat is een WOO-verzoek?
              </h3>
              <p className="text-gray-600 text-sm">
                WOO staat voor Wet Open Overheid. Dit geeft je het recht om documenten van
                overheidsinstanties op te vragen. BriefKompas helpt je een gestructureerd verzoek in
                te dienen.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Klaar om te beginnen?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Kies je type verzoek en volg de geleide intake.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/start-bezwaar">
              <Button size="lg" className="px-8">
                Bezwaarbrief
              </Button>
            </Link>
            <Link href="/start-woo">
              <Button size="lg" variant="secondary" className="px-8">
                WOO-verzoek
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
