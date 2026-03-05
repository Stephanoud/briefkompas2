"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Flow } from "@/types";

export default function StartBrief() {
  const router = useRouter();
  const { setFlow } = useAppStore();

  const handleSelect = (flow: Flow) => {
    setFlow(flow);
    router.push(flow === "bezwaar" ? "/start-bezwaar" : "/start-woo");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Start je brief</h1>
          <p className="text-gray-600">
            Kies eerst welk type brief je wilt opstellen. Daarna start je direct de juiste module.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">Bezwaar</h2>
            <p className="text-sm text-blue-800 mb-4">
              Voor bezwaar tegen een besluit van een bestuursorgaan.
            </p>
            <Button onClick={() => handleSelect("bezwaar")} className="w-full">
              Kies bezwaar
            </Button>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-5">
            <h2 className="text-xl font-semibold text-green-900 mb-2">WOO-verzoek</h2>
            <p className="text-sm text-green-800 mb-4">
              Voor het opvragen van documenten bij een overheidsinstantie.
            </p>
            <Button onClick={() => handleSelect("woo")} className="w-full">
              Kies WOO-verzoek
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <Button variant="secondary" onClick={() => router.push("/")} className="w-full">
            Terug naar homepage
          </Button>
        </div>
      </Card>
    </div>
  );
}
