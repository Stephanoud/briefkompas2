"use client";

import { Card } from "@/components/Card";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card title="Privacyverklaring" subtitle="Hoe wij je gegevens behandelen">
        <div className="space-y-4 text-sm text-gray-600">
          <h3 className="font-semibold text-gray-900">Introductie</h3>
          <p>
            BriefKompas.nl (hierna: &quot;wij&quot;, &quot;ons&quot;) respecteert je privacy. Deze verklaring
            beschrijft hoe we je persoonsgegevens verzamelen, gebruiken en beschermen.
          </p>

          <h3 className="font-semibold text-gray-900">Welke gegevens verzamelen we?</h3>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Je naam en contactgegevens</li>
            <li>Informatie over je bezwaar of WOO-verzoek</li>
            <li>Geuploade PDF-bestanden (je besluit, bijlagen)</li>
            <li>Betaalgegevens (verwerkt via Stripe)</li>
            <li>Technische gegevens (IP-adres, browser)</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Waarom verzamelen we dit?</h3>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Om je brief te genereren</li>
            <li>Om betaling te verwerken</li>
            <li>Om klantservice te bieden</li>
            <li>Om de service te verbeteren</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Hoe lang bewaren we je gegevens?</h3>
          <p>
            We bewaren je gegevens zolang nodig voor de service. Na afronding van je bestelling
            verwijderen we alle persoonlijke gegevens, behalve:
          </p>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Betaalgegevens (nodig voor administratie, max 7 jaar)</li>
            <li>Geanonimiseerde gebruiksgegevens (voor verbetering)</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Delen we je gegevens?</h3>
          <p>We delen je gegevens niet met derden, behalve:</p>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Stripe (voor betaling)</li>
            <li>OpenAI (voor brief-generatie, anoniem)</li>
            <li>Als wettelijk verplicht</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Jouw rechten</h3>
          <p>Je hebt het recht om:</p>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Je gegevens in te zien</li>
            <li>Je gegevens te corrigeren</li>
            <li>Je gegevens te laten verwijderen</li>
            <li>Je gegevens geexporteerd te krijgen</li>
            <li>Je toestemming in te trekken</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Cookies</h3>
          <p>
            We gebruiken cookies voor sessie-management en analytics. Je kunt cookies uitschakelen
            in je browser, maar dit kan de service beinvloeden.
          </p>

          <h3 className="font-semibold text-gray-900">Beveiliging</h3>
          <p>
            We gebruiken standaard beveiligingsmaatregelen (HTTPS, versleuteling, firewalls). We
            kunnen echter niet 100% veiligheid garanderen.
          </p>

          <h3 className="font-semibold text-gray-900">Contacteer ons</h3>
          <p>
            Voor vragen over privacy: <strong>privacy@briefkompas.nl</strong>
          </p>

          <h3 className="font-semibold text-gray-900">Wijzigingen</h3>
          <p>
            We kunnen deze privacyverklaring aanpassen. Wijzigingen worden op deze pagina
            gepubliceerd.
          </p>

          <p className="border-t border-gray-200 pt-4 text-xs">Gewijzigd: maart 2024</p>
        </div>
      </Card>
    </div>
  );
}
