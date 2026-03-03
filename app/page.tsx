"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Alert } from "@/components";

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-12 md:px-12 md:py-16 shadow-[0_20px_50px_rgba(17,33,28,0.08)]">
        <p className="text-sm font-semibold tracking-wide text-[var(--brand)] uppercase mb-4">
          BriefKompas.nl
        </p>
        <h1 className="text-4xl md:text-6xl text-[var(--foreground)] leading-tight">
          Maak je bezwaar- of WOO-brief in een rustige, heldere flow.
        </h1>
        <p className="text-lg md:text-xl text-[var(--muted)] max-w-3xl mt-5">
          Je krijgt stap voor stap begeleiding, met duidelijke vragen en direct een bruikbare conceptbrief.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link href="/start-bezwaar">
            <Button size="lg">Start bezwaar</Button>
          </Link>
          <Link href="/start-woo">
            <Button size="lg" variant="secondary">
              Start WOO-verzoek
            </Button>
          </Link>
        </div>
      </section>

      <Alert type="warning" title="Belangrijk">
        BriefKompas geeft geen juridisch advies. Je blijft altijd zelf verantwoordelijk voor inhoud en verzending.
      </Alert>

      <section className="space-y-6">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] text-center">Hoe het werkt</h2>
        <div className="grid md:grid-cols-3 gap-5">
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 1</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Intake met vragen</h3>
            <p className="text-sm text-[var(--muted)]">
              De chatbot stelt precies de vragen die nodig zijn voor jouw situatie.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 2</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Controle en keuze</h3>
            <p className="text-sm text-[var(--muted)]">
              Je controleert je antwoorden en kiest het pakket dat bij je past.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 3</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Brief klaar</h3>
            <p className="text-sm text-[var(--muted)]">
              Je ontvangt een nette conceptbrief die je aanpast en als DOCX downloadt.
            </p>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] text-center">Pakketten</h2>
        <div className="grid md:grid-cols-2 gap-5">
          <Card title="Basis" subtitle="EUR 7,95 eenmalig">
            <ul className="text-sm text-[var(--muted)] space-y-2">
              <li>Chat intake</li>
              <li>1 PDF upload</li>
              <li>Standaard brief</li>
              <li>Download als DOCX</li>
            </ul>
          </Card>
          <Card title="Uitgebreid" subtitle="EUR 14,95 eenmalig" className="relative overflow-hidden">
            <div className="absolute right-4 top-4 rounded-full bg-[var(--accent)]/20 px-3 py-1 text-xs font-semibold text-[var(--brand-strong)]">
              Aanbevolen
            </div>
            <ul className="text-sm text-[var(--muted)] space-y-2">
              <li>Alles uit Basis</li>
              <li>Tot 5 bijlagen</li>
              <li>Samenvatting van besluit</li>
              <li>Verwijzingen en jurisprudentieblok</li>
            </ul>
          </Card>
        </div>
      </section>

      <section id="faq" className="space-y-4">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] text-center">Veelgestelde vragen</h2>
        <Card>
          <h3 className="text-lg text-[var(--foreground)] mb-2">Is dit juridisch advies?</h3>
          <p className="text-sm text-[var(--muted)]">
            Nee. De tool helpt met structuur en formulering, maar geeft geen juridisch advies.
          </p>
        </Card>
        <Card>
          <h3 className="text-lg text-[var(--foreground)] mb-2">Hoe lang duurt het?</h3>
          <p className="text-sm text-[var(--muted)]">
            De intake duurt meestal 10 tot 15 minuten, afhankelijk van je dossier.
          </p>
        </Card>
        <Card>
          <h3 className="text-lg text-[var(--foreground)] mb-2">Kan ik de brief aanpassen?</h3>
          <p className="text-sm text-[var(--muted)]">
            Ja. Na generatie kun je tekst aanpassen voordat je de brief verstuurt.
          </p>
        </Card>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 md:px-10 md:py-12">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl text-[var(--foreground)]">Klaar om te starten?</h2>
          <p className="text-[var(--muted)] mt-3 mb-6">
            Kies je traject en ga direct verder met de intake.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/start-bezwaar">
              <Button size="lg">Start bezwaar</Button>
            </Link>
            <Link href="/start-woo">
              <Button size="lg" variant="secondary">
                Start WOO-verzoek
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
