"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert, LoadingSpinner } from "@/components/Alerts";
import { Flow, IntakeFormData, Product } from "@/types";

const toFlow = (value: string | null): Flow | null =>
  value === "bezwaar" || value === "woo" ? value : null;

const toProduct = (value: string | null): Product | null =>
  value === "basis" || value === "uitgebreid" ? value : null;

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSessionId = useAppStore((state) => state.setSessionId);
  const setFlow = useAppStore((state) => state.setFlow);
  const setProduct = useAppStore((state) => state.setProduct);
  const setIntakeData = useAppStore((state) => state.setIntakeData);

  const sessionId = searchParams.get("session_id");
  const flow = searchParams.get("flow");
  const bypassPayment = searchParams.get("bypass_payment") === "1";

  useEffect(() => {
    const storedFlow = toFlow(flow);
    const storedProduct =
      typeof window !== "undefined" ? toProduct(sessionStorage.getItem("briefkompas_product")) : null;
    const cachedIntake =
      typeof window !== "undefined" ? sessionStorage.getItem("briefkompas_intake") : null;

    setSessionId(sessionId);

    if (storedFlow) {
      setFlow(storedFlow);
    }

    if (storedProduct) {
      setProduct(storedProduct);
    }

    if (cachedIntake) {
      try {
        setIntakeData(JSON.parse(cachedIntake) as IntakeFormData);
      } catch {
        // Ignore malformed session data and let downstream validation handle it.
      }
    }
  }, [flow, sessionId, setFlow, setIntakeData, setProduct, setSessionId]);

  const handleGenerateLetter = () => {
    if (flow) {
      router.push(`/generate/${flow}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">&#10003;</div>
          <h1 className="text-3xl font-bold text-green-600 mb-2">
            {bypassPayment ? "Testversie gestart" : "Betaling ontvangen!"}
          </h1>
          <p className="text-gray-600">
            {bypassPayment
              ? "De betaalomgeving is overgeslagen. Je brief kan direct worden gegenereerd."
              : "Dank je voor je bestelling. Je brief wordt nu gegenereerd."}
          </p>
        </div>

        {sessionId && !bypassPayment && (
          <Alert type="info" title="Sessie-ID">
            Sessie: {sessionId}
          </Alert>
        )}

        {bypassPayment && (
          <Alert type="success" title="Testversie">
            Deze bestelling is vrijgegeven via de testroute. Er is geen Stripe-betaling uitgevoerd.
          </Alert>
        )}

        <div className="my-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <h3 className="font-semibold mb-2">Volgende stap:</h3>
          <p>
            Klik hieronder om je {flow === "bezwaar" ? "bezwaarbrief" : "WOO-verzoek"} te
            genereren. Dit duurt enkele seconden. Je krijgt daarna een bewerkbare versie die je kunt
            aanpassen.
          </p>
        </div>

        <Button onClick={handleGenerateLetter} size="lg" className="w-full mb-4">
          Genereer mijn brief -&gt;
        </Button>

        <Button variant="secondary" onClick={() => router.push("/")} className="w-full">
          Terug naar start
        </Button>
      </Card>
    </div>
  );
}

export default function CheckoutSuccess() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CheckoutContent />
    </Suspense>
  );
}
