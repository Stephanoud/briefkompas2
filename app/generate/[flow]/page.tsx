"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearStoredGeneratedLetter, writeStoredGeneratedLetter } from "@/lib/generatedLetterSession";
import { clearStoredResultDraft } from "@/lib/resultDraftSession";
import { readStoredIntake, readStoredProduct, writeStoredIntake } from "@/lib/browser-persistence";
import { getFlowDocumentLabel, isFlow } from "@/lib/flow";
import { isValidDeliveryEmail, normalizeDeliveryEmail, readStoredDeliveryEmail } from "@/lib/delivery-email";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { LoadingSpinner, Alert, Input, Textarea } from "@/components/index";
import { Flow, IntakeFormData } from "@/types";

const toFlow = (value: string | null | undefined): Flow | null => (isFlow(value) ? value : null);

type MissingInfoField = {
  field: keyof IntakeFormData | "decisionDocument" | "procedureType";
  label: string;
  question: string;
  inputType: "text" | "textarea" | "upload";
};

type NeedsMoreInfoPayload = {
  status: "needs_more_info";
  blocking: true;
  missingFields: MissingInfoField[];
  message: string;
  error?: string;
};

function isNeedsMoreInfoPayload(value: unknown): value is NeedsMoreInfoPayload {
  const payload = value as Partial<NeedsMoreInfoPayload>;
  return (
    payload?.status === "needs_more_info" &&
    payload.blocking === true &&
    Array.isArray(payload.missingFields)
  );
}

function readCachedIntake(): IntakeFormData | null {
  return readStoredIntake() as IntakeFormData | null;
}

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
  const [blockingInfo, setBlockingInfo] = useState<NeedsMoreInfoPayload | null>(null);
  const [missingValues, setMissingValues] = useState<Record<string, string>>({});
  const [blockingError, setBlockingError] = useState("");

  useEffect(() => {
    if (requestStartedRef.current === attempt) {
      return;
    }

    requestStartedRef.current = attempt;

    const generateLetter = async () => {
      const cachedProduct = readStoredProduct();
      const deliveryEmail = normalizeDeliveryEmail(readStoredDeliveryEmail());

      let resolvedIntakeData = intakeData;
      if (!resolvedIntakeData) {
        resolvedIntakeData = readCachedIntake();
      }

      const resolvedProduct = product ?? cachedProduct;

      if (!flow || !resolvedIntakeData || !resolvedProduct) {
        setError(
          "Je sessie mist gegevens voor het genereren van de brief. Ga terug naar de productkeuze en probeer opnieuw."
        );
        return;
      }

      if (!isValidDeliveryEmail(deliveryEmail)) {
        setError(
          "Vul eerst een geldig e-mailadres in waar de brief en gebruikte gegevens naartoe mogen."
        );
        return;
      }

      setFlow(flow);
      setProduct(resolvedProduct);
      setIntakeData(resolvedIntakeData);

      try {
        setLoading(true);
        setError(null);
        setBlockingInfo(null);
        setBlockingError("");
        clearStoredGeneratedLetter();
        clearStoredResultDraft();

        const response = await fetch("/api/generate-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intakeData: resolvedIntakeData,
            product: resolvedProduct,
            flow,
            deliveryEmail,
          }),
        });

        const data = await response.json();

        if (isNeedsMoreInfoPayload(data)) {
          setBlockingInfo(data);
          setMissingValues({});
          return;
        }

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

  const handleMissingInfoSubmit = () => {
    if (!blockingInfo) {
      return;
    }

    const uploadField = blockingInfo.missingFields.find((field) => field.inputType === "upload");
    if (uploadField) {
      router.push(flow ? `/intake/${flow}` : "/start-brief");
      return;
    }

    const missingAnswers = blockingInfo.missingFields.filter(
      (field) => !missingValues[String(field.field)]?.trim()
    );

    if (missingAnswers.length > 0) {
      setBlockingError(
        `Vul alle verplichte velden in: ${missingAnswers.map((field) => field.label).join(", ")}.`
      );
      return;
    }

    const currentIntake = intakeData ?? readCachedIntake();
    if (!currentIntake) {
      setBlockingError("Je intakegegevens konden niet worden bijgewerkt. Ga terug naar de intake.");
      return;
    }

    const updatedIntake = { ...currentIntake };
    blockingInfo.missingFields.forEach((field) => {
      if (field.field === "decisionDocument" || field.field === "procedureType") {
        return;
      }

      const value = missingValues[String(field.field)]?.trim();
      if (value) {
        (updatedIntake as Record<string, unknown>)[field.field] = value;
      }
    });

    setIntakeData(updatedIntake);
    writeStoredIntake(updatedIntake);

    setBlockingInfo(null);
    setMissingValues({});
    setBlockingError("");
    setError(null);
    setAttempt((current) => current + 1);
  };

  if (blockingInfo) {
    const uploadField = blockingInfo.missingFields.find((field) => field.inputType === "upload");

    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Verplichte aanvulling nodig">
          <div className="space-y-5">
            <Alert type="warning" title="Briefgeneratie geblokkeerd">
              {blockingInfo.message}
            </Alert>

            {uploadField ? (
              <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">{uploadField.question}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                  De brief kan pas worden gemaakt nadat het besluit of ontwerpbesluit is toegevoegd.
                </p>
                <Button
                  type="button"
                  onClick={() => router.push(flow ? `/intake/${flow}` : "/start-brief")}
                  className="mt-4"
                >
                  Besluit uploaden
                </Button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleMissingInfoSubmit();
                }}
              >
                {blockingInfo.missingFields.map((field) => {
                  const fieldKey = String(field.field);
                  const value = missingValues[fieldKey] ?? "";

                  return field.inputType === "textarea" ? (
                    <Textarea
                      key={fieldKey}
                      label={field.question}
                      value={value}
                      onChange={(event) => {
                        setMissingValues((current) => ({
                          ...current,
                          [fieldKey]: event.target.value,
                        }));
                        setBlockingError("");
                      }}
                    />
                  ) : (
                    <Input
                      key={fieldKey}
                      label={field.question}
                      value={value}
                      onChange={(event) => {
                        setMissingValues((current) => ({
                          ...current,
                          [fieldKey]: event.target.value,
                        }));
                        setBlockingError("");
                      }}
                    />
                  );
                })}

                {blockingError && (
                  <Alert type="error" title="Nog niet compleet">
                    {blockingError}
                  </Alert>
                )}

                <div className="flex flex-col gap-3 md:flex-row">
                  <Button type="submit" className="flex-1">
                    Aanvullen en brief maken
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(flow ? `/review/${flow}` : "/start-brief")}
                    className="flex-1"
                  >
                    Terug naar overzicht
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>
      </div>
    );
  }

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
            Je {flow ? getFlowDocumentLabel(flow) : "brief"} wordt gegenereerd...
          </h2>
          <p className="text-gray-600 mt-2">
            Dit duurt ongeveer 10-15 seconden. Even geduld alstublieft.
          </p>
        </div>
      </Card>
    </div>
  );
}
