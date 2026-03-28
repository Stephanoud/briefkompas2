import Link from "next/link";
import { FAQPreview } from "@/components/homepage/FAQPreview";
import { HeroStartSection } from "@/components/homepage/HeroStartSection";
import { PrimaryRouteCard } from "@/components/homepage/PrimaryRouteCard";
import { homepageEntryOptions } from "@/lib/flow";

const faqItems = [
  {
    question: "Wanneer kies ik bezwaar, beroep of zienswijze?",
    answer:
      "Twijfelt u? Kies de route die het meest logisch lijkt. De tool controleert daarna aan de hand van uw besluit of dit waarschijnlijk de juiste procedure is.",
  },
  {
    question: "Controleert de tool of ik de juiste procedure kies?",
    answer:
      "Ja. Waar mogelijk controleert de tool dit aan de hand van het geuploade besluit. Blijkt uit het document dat een andere route hoort, dan krijgt u daarvan een melding.",
  },
];

export function HomepageStartContent() {
  return (
    <div className="space-y-6">
      <HeroStartSection
        eyebrow="BriefKompas"
        title="Start je brief"
        subtitle="Kies wat u wilt doen. Daarna helpt de tool u verder met de juiste brief."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {homepageEntryOptions.map((option) => (
            <PrimaryRouteCard
              key={option.title}
              title={option.title}
              description={option.description}
              href={option.href}
              actionLabel="Start"
            />
          ))}
        </div>
      </HeroStartSection>

      <section className="rounded-2xl border border-[var(--border)] bg-white px-5 py-5 shadow-[0_12px_28px_rgba(17,33,28,0.05)] sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Twijfelt u over de route?</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted-strong)]">
              Kies de meest logische startoptie. Na upload controleert de tool of het besluit waarschijnlijk
              verwijst naar bezwaar, beroep of een zienswijzetraject.
            </p>
          </div>
          <Link
            href="/faq"
            className="text-sm font-medium text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Bekijk de FAQ
          </Link>
        </div>
      </section>

      <div id="faq-preview">
        <FAQPreview items={faqItems} href="/faq" />
      </div>
    </div>
  );
}
