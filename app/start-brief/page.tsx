"use client";

import { useRouter } from "next/navigation";
import { homepageProcedureOptions } from "@/lib/flow";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Flow } from "@/types";

export default function StartBrief() {
  const router = useRouter();
  const { setFlow } = useAppStore();

  const handleSelect = (flow: Flow) => {
    setFlow(flow);
    router.push(`/intake/${flow}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Start je brief</h1>
          <p className="text-gray-600">
            Niet elke overheidsbeslissing begint met bezwaar. Kies een startpunt; in de intake controleren
            we daarna eerst welke procedure het beste past.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {homepageProcedureOptions.map((option) => (
            <div key={option.flow} className="rounded-lg border border-[var(--border)] bg-white p-5">
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">{option.title}</h2>
              <p className="text-sm text-[var(--muted-strong)] mb-4">{option.description}</p>
              <Button onClick={() => handleSelect(option.flow)} className="w-full">
                Kies {option.title.toLowerCase()}
              </Button>
            </div>
          ))}
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
