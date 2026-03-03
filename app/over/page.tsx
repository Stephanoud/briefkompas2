"use client";

import { Card } from "@/components/Card";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card title="Over BriefKompas" subtitle="Wie zijn wij?">
        <div className="space-y-4 text-sm text-gray-600">
          <h3 className="font-semibold text-gray-900">Onze missie</h3>
          <p>
            BriefKompas.nl maakt het eenvoudiger voor burgers om hun rechten geltend te maken. We
            helpen je bij het opstellen van bezwaarschriften en WOO-verzoeken via AI-begeleiding.
          </p>

          <h3 className="font-semibold text-gray-900">Wat we doen</h3>
          <p>
            We bieden een geïntegreerde platform met:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Geleide chatbot intake-vragen</li>
            <li>AI-ondersteunde brief-generatie</li>
            <li>Professionele opmaak</li>
            <li>Download en aanpassingsmogelijkheden</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Wat we niet doen</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Wij geven geen juridisch advies</li>
            <li>Wij verzenden je brief niet voor je</li>
            <li>Wij garanderen succes niet</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Onze aanpak</h3>
          <p>
            We geloven dat toegang tot informatie en begeleiding recht is, niet voorrecht. Door
            automatisering betaalbaar te maken, hopen we meer burgers te helpen.
          </p>

          <h3 className="font-semibold text-gray-900">Betrouwbaarheid</h3>
          <p>
            Onze brieven volgen de standaard administratieve recht-structuur en worden gegenereerd met
            AI (OpenAI GPT). Echter: jij bent verantwoordelijk voor je brief. Controleer altijd goed
            voordat je verzendt.
          </p>

          <h3 className="font-semibold text-gray-900">Feedback</h3>
          <p>
            We waarderen je feedback! Mail naar <strong>feedback@briefkompas.nl</strong> met je
            suggesties, ervaringen, of vragen.
          </p>

          <h3 className="font-semibold text-gray-900">Contact</h3>
          <ul className="space-y-1">
            <li>Email: <strong>info@briefkompas.nl</strong></li>
            <li>Privacy: <strong>privacy@briefkompas.nl</strong></li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
