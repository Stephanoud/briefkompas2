"use client";

import Container from "@/components/Container";
import { FAQPreview } from "@/components/homepage/FAQPreview";
import { HeroStartSection } from "@/components/homepage/HeroStartSection";
import { PrimaryRouteCard } from "@/components/homepage/PrimaryRouteCard";
import { ProcedureHelpNote } from "@/components/homepage/ProcedureHelpNote";
import { SecondaryRouteLinks } from "@/components/homepage/SecondaryRouteLinks";

const contentWidthClass = "mx-auto w-full max-w-[980px]";

const faqItems = [
  {
    question: "Wanneer maak ik bezwaar?",
    answer: "Als je een definitief besluit hebt ontvangen en daartegen wilt opkomen.",
  },
  {
    question: "Wanneer dien ik een zienswijze in?",
    answer: "Als er nog geen definitief besluit is, maar wel een ontwerpbesluit waarop je mag reageren.",
  },
];

export default function Page() {
  return (
    <section className="w-full py-10 sm:py-14">
      <Container>
        <div className={`${contentWidthClass} space-y-6`}>
          <HeroStartSection
            eyebrow="BriefKompas"
            title="Start je brief"
            subtitle="Beantwoord een paar vragen. Daarna bepalen we welke procedure past: zienswijze, bezwaar, beroep of WOO."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <PrimaryRouteCard
                title="Hulp bij een besluit van de overheid"
                description="Voor besluiten, ontwerpbesluiten en procedures rond zienswijze, bezwaar of beroep."
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
                { label: "Zienswijze", href: "#faq-preview" },
                { label: "Bezwaar", href: "#faq-preview" },
                { label: "Beroep zonder bezwaar", href: "#faq-preview" },
                { label: "Beroep na bezwaar", href: "#faq-preview" },
              ]}
            />
          </HeroStartSection>

          <ProcedureHelpNote
            href="/intake/bezwaar"
            text="Twijfel je tussen bezwaar, beroep of zienswijze? Wij helpen je kiezen in de intake."
          />

          <div id="faq-preview">
            <FAQPreview items={faqItems} href="/faq" />
          </div>
        </div>
      </Container>
    </section>
  );
}
