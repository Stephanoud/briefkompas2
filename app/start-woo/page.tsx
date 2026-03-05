"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function StartWoo() {
  const router = useRouter();
  const { setFlow } = useAppStore();

  const handleStart = () => {
    setFlow("woo");
    router.push("/intake/woo");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">WOO-Verzoek Opstellen</h1>
          <p className="text-gray-600 mb-4">
            Vraag documenten op bij overheidsinstanties via de Wet Open Overheid (WOO).
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Wat is een WOO-verzoek?</h3>
            <p className="text-sm text-blue-800">
              De Wet Open Overheid (WOO) geeft je het recht om documenten van
              overheidsinstanties op te vragen. Dit helpt je inzicht krijgen in
              overheidshandelen.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Responstermijn</h3>
            <p className="text-sm text-yellow-800">
              Het bestuursorgaan beslist in principe binnen 4 weken op je verzoek.
              Deze termijn kan eenmalig met 2 weken worden verlengd.
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="font-semibold text-orange-900 mb-2">
              Wanneer mag een bestuursorgaan weigeren?
            </h3>
            <p className="text-sm text-orange-800">
              Een bestuursorgaan mag informatie alleen geheel of gedeeltelijk weigeren
              bij een wettelijke uitzonderingsgrond, bijvoorbeeld bescherming van
              privacy, opsporing en veiligheid, of vertrouwelijke bedrijfsgegevens.
              Zonder zo&apos;n wettelijke grond mag een verzoek niet zomaar worden
              afgewezen: wat wel openbaar kan, moet worden verstrekt.
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

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Spoedeisend?</h3>
            <p className="text-sm text-green-800">
              Je kunt aangeven dat het verzoek spoedeisend is. Dit kan helpen bij
              snellere verwerking.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            &#10003; Je weet welk bestuursorgaan
            <br />
            &#10003; Je weet wat je wilt opvragen
            <br />
            &#10003; Je bent klaar om te beginnen
          </p>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleStart} size="lg" className="flex-1">
              Start WOO-verzoek
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
