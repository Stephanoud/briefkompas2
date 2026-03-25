"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearStoredGeneratedLetter, writeStoredGeneratedLetter } from "@/lib/generatedLetterSession";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LoadingSpinner, Alert } from "@/components/index";
import { Flow, IntakeFormData, Product } from "@/types";

const toFlow = (value: string | null | undefined): Flow | null =>
  value === "bezwaar" || value === "woo" ? value : null;

const toProduct = (value: string | null): Product | null =>
  value === "basis" || value === "uitgebreid" ? value : null;

export default function GeneratePage() {
  const router = useRouter();
  const params = useParams<{ flow: string }>();
  const rawFlow = params?.flow;
  const flow = toFlow(Array.isArray(rawFlow) ? rawFlow[0] : rawFlow);
  const requestStartedRef = useRef<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const intakeData = useAppStore((state) => state.intakeData);
  const product = useAppStore((state) => state.product);
  const error = useAppStore((state) => state.error);
  const setFlow = useAppStore((state) => state.setFlow);
  const setProduct = useAppStore((state) => state.setProduct);
  const setIntakeData = useAppStore((state) => state.setIntakeData);
  const setGeneratedLetter = useAppStore((state) => state.setGeneratedLetter);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);

  useEffect(() => {
    if (requestStartedRef.current === attempt) {
      return;
    }

    requestStartedRef.current = attempt;

    const generateLetter = async () => {
      const cachedIntake =
        typeof window !== "undefined" ? sessionStorage.getItem("briefkompas_intake") : null;
      const cachedProduct =
        typeof window !== "undefined" ? sessionStorage.getItem("briefkompas_product") : null;

      let resolvedIntakeData = intakeData;
      if (!resolvedIntakeData && cachedIntake) {
        try {
          resolvedIntakeData = JSON.parse(cachedIntake) as IntakeFormData;
        } catch {
          resolvedIntakeData = null;
        }
      }

      const resolvedProduct = product ?? toProduct(cachedProduct);

      if (!flow || !resolvedIntakeData || !resolvedProduct) {
        setError(
          "Je sessie mist gegevens voor het genereren van de brief. Ga terug naar de productkeuze en probeer opnieuw."
        );
        return;
      }

      setFlow(flow);
      setProduct(resolvedProduct);
      setIntakeData(resolvedIntakeData);

      try {
        setLoading(true);
        setError(null);
        clearStoredGeneratedLetter();

        const response = await fetch("/api/generate-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intakeData: resolvedIntakeData,
            product: resolvedProduct,
            flow,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Fout bij genereren brief");
        }

        if (!data.letter?.letterText) {
          throw new Error("De server gaf geen geldige brief terug.");
        }

        setGeneratedLetter(data.letter);
        writeStoredGeneratedLetter(flow, data.letter);
        router.push(`/result/${flow}`);
      } catch (generationError) {
        setError(
          generationError instanceof Error ? generationError.message : "Er ging iets fout"
        );
      } finally {
        setLoading(false);
      }
    };

    void generateLetter();
  }, [
    attempt,
    flow,
    intakeData,
    product,
    router,
    setError,
    setFlow,
    setGeneratedLetter,
    setIntakeData,
    setLoading,
    setProduct,
  ]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <Alert type="error" title="Fout bij genereren">
            {error}
          </Alert>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Je intake en pakketkeuze blijven bewaard in deze sessie. Je kunt dus veilig terug zonder gegevens te verliezen.
          </p>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <Button
              onClick={() => {
                setError(null);
                setAttempt((current) => current + 1);
              }}
              className="flex-1"
            >
              Opnieuw proberen
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(flow ? `/review/${flow}` : "/start-brief")}
              className="flex-1"
            >
              Terug naar overzicht
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(flow ? `/pricing/${flow}` : "/start-brief")}
              className="flex-1"
            >
              Terug naar productkeuze
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="text-center">
          <LoadingSpinner />
          <h2 className="text-xl font-semibold text-gray-900 mt-4">
            Je brief wordt gegenereerd...
          </h2>
          <p className="text-gray-600 mt-2">
            Dit duurt ongeveer 10-15 seconden. Even geduld alstublieft.
          </p>
        </div>
      </Card>
    </div>
  );
}
