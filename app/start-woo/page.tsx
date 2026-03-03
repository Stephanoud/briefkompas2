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
            <h3 className="font-semibold text-blue-900 mb-2">📖 Wat is een WOO-verzoek?</h3>
            <p className="text-sm text-blue-800">
              De Wet Open Overheid (WOO) geeft je het recht om documenten van overheidsinstanties
              op te vragen. Dit helpt je inzicht krijgen in overheidshandelen.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">⏰ Responstermijn</h3>
            <p className="text-sm text-yellow-800">
              Het bestuursorgaan moet binnen 5 werkdagen op je verzoek reageren. Ze kunnen maximaal
              10 werkdagen extra nodig hebben.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">💡 Spoedeisend?</h3>
            <p className="text-sm text-green-800">
              Je kunt aangeven dat het verzoek spoedeisend is. Dit kan helpen bij snellere
              verwerking.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            ✓ Je weet welk bestuursorgaan<br/>
            ✓ Je weet wat je wilt opvragen<br/>
            ✓ Je bent klaar om te beginnen
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
