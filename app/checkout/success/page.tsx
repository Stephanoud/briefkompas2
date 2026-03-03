"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert, LoadingSpinner } from "@/components/Alerts";
import { Flow } from "@/types";

function CheckoutContent() {
  const router = useRouter();
  const { useSearchParams } = require("next/navigation");
  const searchParams = useSearchParams();
  const appStore = useAppStore();

  const sessionId = searchParams.get("session_id");
  const flow = searchParams.get("flow");

  useEffect(() => {
    if (sessionId) {
      appStore.setSessionId(sessionId);
    }
  }, [sessionId]);

  const handleGenerateLetter = () => {
    if (flow) {
      router.push(`/generate/${flow}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-green-600 mb-2">Betaling ontvangen!</h1>
          <p className="text-gray-600">
            Dank je voor je bestelling. Je brief wordt nu gegenereerd.
          </p>
        </div>

        {sessionId && (
          <Alert type="info" title="Sessie-ID">
            Sessie: {sessionId}
          </Alert>
        )}

        <div className="my-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <h3 className="font-semibold mb-2">📋 Volgende stap:</h3>
          <p>
            Klik hieronder om je {flow === "bezwaar" ? "bezwaarbrief" : "WOO-verzoek"} te genereren. Dit duurt
            enkele seconden. Je krijgt daarna een bewerkbare versie die je kunt aanpassen.
          </p>
        </div>

        <Button onClick={handleGenerateLetter} size="lg" className="w-full mb-4">
          Genereer mijn brief →
        </Button>

        <Button
          variant="secondary"
          onClick={() => router.push("/")}
          className="w-full"
        >
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
