import { Card } from "@/components/Card";

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl text-[var(--foreground)]">Veelgestelde vragen</h1>
        <p className="text-[var(--muted)]">
          Antwoorden op de meest voorkomende vragen over bezwaar en WOO-verzoeken via BriefKompas.
        </p>
      </section>

      <Card>
        <h2 className="text-xl text-[var(--foreground)] mb-2">Is BriefKompas juridisch advies?</h2>
        <p className="text-sm text-[var(--muted)]">
          Nee. BriefKompas helpt je met structuur en formulering, maar geeft geen juridisch advies.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl text-[var(--foreground)] mb-2">Hoe lang duurt het proces?</h2>
        <p className="text-sm text-[var(--muted)]">
          De intake duurt meestal 10 tot 15 minuten. Daarna kun je direct verder met pakketkeuze en briefgeneratie.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl text-[var(--foreground)] mb-2">Wat is het verschil tussen Basis en Uitgebreid?</h2>
        <p className="text-sm text-[var(--muted)]">
          Basis is voor eenvoudige dossiers. Uitgebreid biedt meer ruimte voor bijlagen en extra onderbouwing.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl text-[var(--foreground)] mb-2">Kan ik mijn brief nog aanpassen?</h2>
        <p className="text-sm text-[var(--muted)]">
          Ja. Je ontvangt een bewerkbaar document dat je kunt aanpassen voor je het verstuurt.
        </p>
      </Card>

      <Card>
        <h2 className="text-xl text-[var(--foreground)] mb-2">Zijn mijn gegevens veilig?</h2>
        <p className="text-sm text-[var(--muted)]">
          Je gegevens worden alleen gebruikt voor jouw traject. Bekijk de privacypagina voor details over verwerking.
        </p>
      </Card>
    </div>
  );
}
