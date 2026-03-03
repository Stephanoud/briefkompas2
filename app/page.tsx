"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Alert } from "@/components";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-12 md:px-12 md:py-14 text-center shadow-[0_20px_50px_rgba(17,33,28,0.08)]">
        <p className="text-sm font-semibold tracking-wide text-[var(--brand)] uppercase mb-3">
          BriefKompas.nl
        </p>
        <h1 className="text-4xl md:text-6xl text-[var(--foreground)] leading-tight max-w-3xl mx-auto">
          Jouw bezwaar- of WOO-brief in een rustige, heldere flow.
        </h1>
        <p className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto mt-5">
          Geen juridisch advies, wel duidelijke begeleiding van intake tot conceptbrief.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] text-center">Hoe het werkt</h2>
        <div className="grid md:grid-cols-3 gap-4 text-center">
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 1</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Intake met vragen</h3>
            <p className="text-sm text-[var(--muted)]">
              De chatbot vraagt precies wat nodig is voor jouw situatie.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 2</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Controle</h3>
            <p className="text-sm text-[var(--muted)]">
              Je controleert je antwoorden in een helder overzicht.
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-[var(--brand)] uppercase mb-2">Stap 3</p>
            <h3 className="text-xl text-[var(--foreground)] mb-2">Brief klaar</h3>
            <p className="text-sm text-[var(--muted)]">
              Je brief wordt direct gegenereerd en is te downloaden als DOCX.
            </p>
          </Card>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 md:px-10 text-center">
        <h2 className="text-3xl md:text-4xl text-[var(--foreground)] mb-4">Kies je traject</h2>
        <p className="text-[var(--muted)] mb-7">Start direct met de intake.</p>
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
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

      <Alert type="warning" title="Belangrijk">
        BriefKompas geeft geen juridisch advies. Je blijft zelf verantwoordelijk voor de inhoud en verzending.
      </Alert>
    </div>
  );
}
