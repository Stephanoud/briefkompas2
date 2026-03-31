"use client";

import { Card } from "@/components/Card";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card title="Privacy" subtitle="Kort en duidelijk uitgelegd">
        <div className="space-y-4 text-sm leading-7 text-[var(--muted-strong)]">
          <h3 className="font-semibold text-[var(--foreground)]">Standaard slaan we niets op</h3>
          <p>
            Je kunt BriefKompas gebruiken zonder account en zonder blijvende opslag van je brief. Als je niets
            aanvinkt, bewaren we je brief niet. Download of kopieer hem dan zelf als je hem wilt houden.
          </p>

          <h3 className="font-semibold text-[var(--foreground)]">Tijdelijke opslag alleen na opt-in</h3>
          <p>
            Alleen als je daar expliciet voor kiest, slaan we je brief en de bijbehorende intakegegevens tijdelijk op
            zodat je later verder kunt via een herstel-link. Die tijdelijke opslag duurt maximaal 30 dagen. Daarna is
            de link niet meer bruikbaar.
          </p>

          <h3 className="font-semibold text-[var(--foreground)]">Onderzoek en verbetering</h3>
          <p>
            Daarvoor is een tweede, losse toestemming nodig. Die staat nooit vooraf aangevinkt. Alleen met die extra
            toestemming mogen we geanonimiseerde gegevens gebruiken voor onderzoek en productverbetering.
          </p>

          <h3 className="font-semibold text-[var(--foreground)]">Wat we niet doen voor recovery</h3>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Geen recovery op basis van IP-adres</li>
            <li>Geen device fingerprint of andere stilzwijgende tracking</li>
            <li>Geen analytics-events met de inhoud van je brief</li>
          </ul>

          <h3 className="font-semibold text-[var(--foreground)]">Welke partijen gebruiken we wel?</h3>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Stripe voor betalingen</li>
            <li>OpenAI voor briefgeneratie en documentanalyse</li>
          </ul>

          <h3 className="font-semibold text-[var(--foreground)]">Jouw keuzes</h3>
          <p>
            Jij bepaalt zelf of tijdelijke opslag aan staat. Zonder toestemming slaan we niets op voor herstel. Geef je
            wel toestemming, bewaar de herstel-link dan goed. Zonder die link kunnen we je brief niet terughalen.
          </p>

          <h3 className="font-semibold text-[var(--foreground)]">Jouw rechten</h3>
          <ul className="ml-2 list-inside list-disc space-y-1">
            <li>Je toestemming intrekken</li>
            <li>Informatie vragen over tijdelijke opslag</li>
            <li>Verwijdering vragen zolang gegevens nog niet automatisch zijn verlopen</li>
          </ul>

          <h3 className="font-semibold text-[var(--foreground)]">Beveiliging</h3>
          <p>
            Herstel-links gebruiken een cryptografisch sterk token. We bewaren niet het token zelf, maar alleen een
            hash. Verlopen records worden geblokkeerd via hun einddatum en daarna opgeschoond.
          </p>

          <h3 className="font-semibold text-[var(--foreground)]">Contact</h3>
          <p>
            Voor vragen over privacy: <strong>privacy@briefkompas.nl</strong>
          </p>

          <h3 className="font-semibold text-[var(--foreground)]">Wijzigingen</h3>
          <p>Als we deze uitleg aanpassen, publiceren we dat op deze pagina.</p>

          <p className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">Gewijzigd: 31 maart 2026</p>
        </div>
      </Card>
    </div>
  );
}
