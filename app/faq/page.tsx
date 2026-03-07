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
        <h2 className="text-xl text-[var(--foreground)] mb-2">
          Waarom is BriefKompas beter dan als leek je vraag direct in ChatGPT zetten?
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Een losse vraag in ChatGPT kan snel zijn, maar bij bezwaar- en WOO-brieven zitten er risico&apos;s aan. Als
          leek zie je vaak niet welke informatie juridisch cruciaal is, waardoor de uitkomst onvolledig of te
          algemeen kan zijn.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>Belangrijke feiten of termijnen ontbreken sneller zonder gestructureerde intake.</li>
          <li>De briefopbouw is niet altijd consistent met wat een bestuursorgaan praktisch verwacht.</li>
          <li>Tekst kan overtuigend klinken, maar inhoudelijk te vaag of niet toetsbaar zijn.</li>
          <li>Je kunt ongemerkt te veel persoonlijke gegevens delen in open prompts.</li>
        </ul>
        <p className="mt-3 text-sm text-[var(--muted)]">
          BriefKompas probeert die risico&apos;s te mitigeren met een juridische backbone: een vaste briefstructuur,
          stapsgewijze intake, controlemomenten vóór genereren en een duidelijk concept dat jij altijd zelf controleert
          en aanpast.
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
