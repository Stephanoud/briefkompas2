"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getFlowDocumentLabel, isFlow } from "@/lib/flow";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Alert, LoadingSpinner } from "@/components/Alerts";
import { Flow, IntakeFormData } from "@/types";
import {
  isValidDeliveryEmail,
  normalizeDeliveryEmail,
  readStoredDeliveryEmail,
  writeStoredDeliveryEmail,
} from "@/lib/delivery-email";
import { readStoredIntake, readStoredProduct } from "@/lib/browser-persistence";

const toFlow = (value: string | null): Flow | null => (isFlow(value) ? value : null);

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
  const activeFlow = toFlow(flow);
  const [deliveryEmail, setDeliveryEmail] = useState(() => readStoredDeliveryEmail());
  const [deliveryEmailError, setDeliveryEmailError] = useState("");

  useEffect(() => {
    const storedProduct = readStoredProduct();
    const cachedIntake = activeFlow ? readStoredIntake(activeFlow) : readStoredIntake();

    setSessionId(sessionId);

    if (activeFlow) {
      setFlow(activeFlow);
    }

    if (storedProduct) {
      setProduct(storedProduct);
    }

    if (cachedIntake) {
      setIntakeData(cachedIntake as IntakeFormData);
    }
  }, [activeFlow, sessionId, setFlow, setIntakeData, setProduct, setSessionId]);

  const handleGenerateLetter = () => {
    const normalizedDeliveryEmail = normalizeDeliveryEmail(deliveryEmail);
    if (!isValidDeliveryEmail(normalizedDeliveryEmail)) {
      setDeliveryEmailError("Vul een geldig e-mailadres in.");
      return;
    }

    writeStoredDeliveryEmail(normalizedDeliveryEmail);
    setDeliveryEmail(normalizedDeliveryEmail);
    setDeliveryEmailError("");

    if (activeFlow) {
      router.push(`/generate/${activeFlow}`);
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
            Klik hieronder om je {activeFlow ? getFlowDocumentLabel(activeFlow) : "brief"} te
            genereren. Dit duurt enkele seconden. Je krijgt daarna een bewerkbare versie die je kunt
            aanpassen.
          </p>
        </div>

        <div className="mb-6 text-left">
          <Input
            type="email"
            label="E-mailadres voor toezending"
            value={deliveryEmail}
            onChange={(event) => {
              setDeliveryEmail(event.target.value);
              setDeliveryEmailError("");
            }}
            error={deliveryEmailError}
            autoComplete="email"
            placeholder="naam@example.nl"
            required
          />
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            De gegenereerde brief en de gebruikte intake- en documentgegevens worden naar dit adres gestuurd.
          </p>
        </div>

        <Button onClick={handleGenerateLetter} disabled={!deliveryEmail.trim()} size="lg" className="w-full mb-4">
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
