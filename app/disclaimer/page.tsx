"use client";

import { Card } from "@/components/Card";
import { DISCLAIMER_TEXT } from "@/lib/utils";

export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card title="Disclaimer" subtitle="Belangrijk: Lees dit aandachtig">
        <div className="space-y-4 text-sm text-gray-600">
          <p className="bg-red-50 border border-red-200 rounded p-4 font-semibold text-red-900">
            {DISCLAIMER_TEXT}
          </p>

          <h3 className="font-semibold text-gray-900 mt-6">Geen juridisch advies</h3>
          <p>
            BriefKompas.nl biedt geen juridisch advies. We stellen gestructureerde vragen en
            helpen je bij het formuleren van je bezwaarschrift of WOO-verzoek, maar dit vervangt
            geen advocaat of juridisch expert.
          </p>

          <h3 className="font-semibold text-gray-900">Je verantwoordelijkheid</h3>
          <p>
            Je bent volledig zelf verantwoordelijk voor:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>De inhoud van je brief</li>
            <li>De juistheid van de informatie</li>
            <li>Het naleven van wettelijke termijnen</li>
            <li>De verzending</li>
          </ul>

          <h3 className="font-semibold text-gray-900">Ontvankelijkheid</h3>
          <p>
            BriefKompas garandeert niet dat je bezwaar of WOO-verzoek ontvankelijk is of
            behandeld wordt. Veel factoren spelen een rol, waaronder timing, juistheid van gegevens,
            en de specifieke omstandigheden.
          </p>

          <h3 className="font-semibold text-gray-900">Geen garantie</h3>
          <p>
            We doen ons best om accuraat advies te geven via onze chatbot, maar we geven geen
            garantie op de juistheid of beschikbaarheid van de service.
          </p>

          <h3 className="font-semibold text-gray-900">Aansprakelijkheid</h3>
          <p>
            BriefKompas.nl is niet aansprakelijk voor enige directe of indirecte schade voortvloeiend
            uit het gebruik van deze service.
          </p>

          <h3 className="font-semibold text-gray-900">Juridische hulp</h3>
          <p>
            Voor juridische vragen of complexe zaken, raadpleeg een advocaat. Er zijn verschillende
            organisaties die juridische bijstand bieden tegen voordelige tariefen.
          </p>

          <h3 className="font-semibold text-gray-900">Wijzigingen</h3>
          <p>
            We kunnen deze Disclaimer op elk moment aanpassen. Het is je verantwoordelijkheid deze
            regelmatig te lezen.
          </p>

          <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
            <span className="text-lg">✓</span>
            <p className="text-sm">
              Ik begrijp dat dit geen juridisch advies is en ik ben zelf verantwoordelijk voor mijn
              brief.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
