"use client";

import { useRouter } from "next/navigation";
import { HeroStartSection } from "@/components/homepage/HeroStartSection";
import { PrimaryRouteCard } from "@/components/homepage/PrimaryRouteCard";
import { ProcedureHelpNote } from "@/components/homepage/ProcedureHelpNote";
import { SecondaryRouteLinks } from "@/components/homepage/SecondaryRouteLinks";
import { Card } from "@/components/Card";

export default function StartBrief() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <HeroStartSection
          eyebrow="BriefKompas"
          title="Start je brief"
          subtitle="Begin eenvoudig. In de intake bepalen we of het gaat om zienswijze, bezwaar, beroep of WOO."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <PrimaryRouteCard
              title="Hulp bij een besluit van de overheid"
              description="Voor besluiten, ontwerpbesluiten en vragen over de juiste bestuursrechtelijke route."
              href="/intake/bezwaar"
              actionLabel="Start intake"
            />
            <PrimaryRouteCard
              title="WOO-verzoek starten"
              description="Voor het opvragen van documenten bij een bestuursorgaan."
              href="/intake/woo"
              actionLabel="Start WOO-verzoek"
            />
          </div>

          <SecondaryRouteLinks
            links={[
              { label: "Zienswijze", href: "/faq" },
              { label: "Bezwaar", href: "/faq" },
              { label: "Beroep zonder bezwaar", href: "/faq" },
              { label: "Beroep na bezwaar", href: "/faq" },
            ]}
          />
        </HeroStartSection>

        <div className="mt-6">
          <ProcedureHelpNote
            href="/intake/bezwaar"
            text="Twijfel je tussen bezwaar, beroep of zienswijze? Wij helpen je kiezen in de intake."
          />
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm font-medium text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Terug naar homepage
          </button>
        </div>
      </Card>
    </div>
  );
}
