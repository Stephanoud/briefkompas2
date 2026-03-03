"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Alert } from "@/components";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-12 md:px-12 md:py-14 text-center shadow-[0_20px_50px_rgba(17,33,28,0.08)]">
        <p className="text-sm font-semibold tracking-wide text-[var(--brand)] uppercase mb-3">
          BriefKompas.nl
        </p>
        <h1 className="text-4xl md:text-6xl text-[var(--foreground)] leading-tight max-w-4xl mx-auto">
          Jouw bezwaar- of WOO-brief, strak geregeld in een heldere flow.
        </h1>
        <p className="text-lg md:text-xl text-[var(--muted)] max-w-3xl mx-auto mt-5">
          Geen juridisch advies, wel duidelijke begeleiding van intake tot conceptbrief.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] text-center">Hoe het werkt</h2>
        <div className="grid md:grid-cols-3 gap-5 text-center">
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 1</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Intake met vragen</h3>
            <p className="text-sm text-[var(--muted)]">
              De chatbot vraagt precies wat nodig is voor jouw bezwaar of WOO-verzoek.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 2</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Controle en keuze</h3>
            <p className="text-sm text-[var(--muted)]">
              Je controleert de gegevens en kiest het pakket dat bij je situatie past.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 3</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Brief direct klaar</h3>
            <p className="text-sm text-[var(--muted)]">
              Je krijgt een nette conceptbrief die je kunt bijwerken en downloaden.
            </p>
          </Card>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 md:px-12 md:py-12 text-center">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] mb-4">Kies je traject</h2>
        <p className="text-[var(--muted)] mb-8">Start direct met de intake van jouw type verzoek.</p>
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <Link href="/start-bezwaar" className="block">
            <Button size="lg" className="w-full min-h-16 text-lg">
              Start bezwaar
            </Button>
          </Link>
          <Link href="/start-woo" className="block">
            <Button size="lg" variant="secondary" className="w-full min-h-16 text-lg">
              Start WOO-verzoek
            </Button>
          </Link>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] text-center">Pakketvarianten</h2>
        <div className="grid md:grid-cols-2 gap-5">
          <Card title="Basis" subtitle="EUR 7,95 eenmalig">
            <ul className="text-sm text-[var(--muted)] space-y-2">
              <li>Chat intake</li>
              <li>1 PDF upload (besluit)</li>
              <li>Standaard brief</li>
              <li>Download als DOCX</li>
            </ul>
          </Card>
          <Card title="Uitgebreid" subtitle="EUR 14,95 eenmalig" className="relative overflow-hidden">
            <div className="absolute right-4 top-4 rounded-full bg-[var(--accent)]/20 px-3 py-1 text-xs font-semibold text-[var(--brand-strong)]">
              Aanbevolen
            </div>
            <ul className="text-sm text-[var(--muted)] space-y-2">
              <li>Alles van Basis</li>
              <li>Tot 5 bijlagen</li>
              <li>Samenvatting van besluit</li>
              <li>Verwijzingen en jurisprudentieblok</li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="text-center">
        <Link href="/faq">
          <Button variant="secondary">Bekijk veelgestelde vragen</Button>
        </Link>
      </section>

      <Alert type="warning" title="Belangrijk">
        BriefKompas geeft geen juridisch advies. Je blijft zelf verantwoordelijk voor de inhoud en verzending.
      </Alert>
    </div>
  );
}
