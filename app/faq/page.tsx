import { Card } from "@/components/Card";

const faqItems = [
  {
    question: "Wanneer kies ik bezwaar, beroep of zienswijze?",
    answer:
      "Twijfelt u? Kies de route die het meest logisch lijkt. De tool controleert daarna aan de hand van uw besluit of dit waarschijnlijk de juiste procedure is.",
  },
  {
    question: "Controleert de tool of ik de juiste procedure kies?",
    answer:
      "Ja. Waar mogelijk controleert de tool dit aan de hand van het geuploade besluit. Blijkt uit het besluit dat een andere route hoort, dan krijgt u daarvan een melding.",
  },
  {
    question: "Is BriefKompas juridisch advies?",
    answer:
      "Nee. BriefKompas helpt u met structuur en formulering, maar geeft geen juridisch advies.",
  },
  {
    question: "Hoe lang duurt het proces?",
    answer:
      "De intake duurt meestal 10 tot 15 minuten. Daarna kunt u direct verder met pakketkeuze en briefgeneratie.",
  },
  {
    question: "Wat is het verschil tussen Basis en Uitgebreid?",
    answer:
      "Basis is voor eenvoudige dossiers. Uitgebreid biedt meer ruimte voor bijlagen en extra onderbouwing.",
  },
  {
    question: "Kan ik mijn brief nog aanpassen?",
    answer:
      "Ja. U ontvangt een bewerkbaar document dat u kunt aanpassen voor u het verstuurt.",
  },
  {
    question: "Zijn mijn gegevens veilig?",
    answer:
      "Uw gegevens worden alleen gebruikt voor uw traject. Bekijk de privacypagina voor details over verwerking.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="space-y-3 text-center">
        <h1 className="text-4xl text-[var(--foreground)] md:text-5xl">Veelgestelde vragen</h1>
        <p className="text-[var(--muted)]">
          Korte antwoorden over procedurekeuze, documentcontrole en het gebruik van BriefKompas.
        </p>
      </section>

      {faqItems.map((item) => (
        <Card key={item.question}>
          <h2 className="mb-2 text-xl text-[var(--foreground)]">{item.question}</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">{item.answer}</p>
        </Card>
      ))}

      <Card>
        <h2 className="mb-2 text-xl text-[var(--foreground)]">
          Waarom is BriefKompas beter dan uw vraag direct in een generieke AI-tool zetten?
        </h2>
        <p className="text-sm leading-7 text-[var(--muted)]">
          Een losse prompt kan snel zijn, maar bij bezwaar-, beroep- en WOO-brieven zijn structuur,
          termijnen en procedurekeuze belangrijk. BriefKompas combineert daarom een gerichte intake,
          documentcontrole en vaste briefopbouw.
        </p>
      </Card>
    </div>
  );
}
