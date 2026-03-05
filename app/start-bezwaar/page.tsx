"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function StartBezwaar() {
  const router = useRouter();
  const { setFlow } = useAppStore();

  const handleStart = () => {
    setFlow("bezwaar");
    router.push("/intake/bezwaar");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Bezwaarschrift Opstellen</h1>
          <p className="text-gray-600 mb-4">
            Maak bezwaar tegen een besluit van een bestuursorgaan.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Wat is een bezwaarschrift?</h3>
            <p className="text-sm text-blue-800">
              Met een bezwaarschrift maak je formeel bezwaar tegen een besluit van een
              bestuursorgaan. Het bestuursorgaan moet je bezwaar in behandeling nemen.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Termijn</h3>
            <p className="text-sm text-yellow-800">
              Je hebt meestal 6 weken om bezwaar in te dienen na ontvangst van het besluit.
              Controleer je brieven voor de exacte termijn.
            </p>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h3 className="font-semibold text-indigo-900 mb-2">Jurisprudentie als kompas</h3>
            <p className="text-sm text-indigo-800">
              BriefKompas gebruikt relevante jurisprudentie als kompas voor de
              briefgeneratie. Zo verkleinen we de kans op verzonnen jurisprudentie.
              De AI wordt als het ware vooraf gevoed met juridische context voordat
              de gestructureerde vragen worden beantwoord. Daarmee verbetert de
              briefkwaliteit ten opzichte van generieke AI-modellen.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">Belangrijk</h3>
            <p className="text-sm text-red-800">
              Dit is GEEN juridisch advies. BriefKompas helpt je structureren, maar je bent zelf
              verantwoordelijk. Voor juridisch advies, raadpleeg een advocaat.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            &#10003; Je hebt je besluit bij de hand
            <br />
            &#10003; Je hebt ongeveer 10-15 minuten
            <br />
            &#10003; Je bent klaar om te beginnen
          </p>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleStart} size="lg" className="flex-1">
              Start Bezwaar
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => router.back()}
              className="flex-1"
            >
              Terug
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
