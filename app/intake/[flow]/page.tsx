"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
  getStepsByFlow,
  getValidationErrorMessage,
  isLikelyClarifyingQuestion,
  needsFollowUp,
} from "@/lib/intake-flow";
import { getAnswerSuggestions, grondenFallbackOptions } from "@/lib/intake/answerSuggestions";
import { filterBestuursorganen } from "@/lib/intake/bestuursorganen";
import { ChatMessage, Flow, IntakeFormData } from "@/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { UploadBox } from "@/components/UploadBox";
import { ChatBubble } from "@/components/ChatBubble";
import { StepHeader, Alert } from "@/components";

const shortGrondenThreshold = 120;
const confirmYesValues = new Set(["ja", "ja, doorgaan", "ja doorgaan", "doorgaan", "ok", "oke", "prima"]);
const confirmNoValues = new Set(["nee", "nee, ik wil meer toelichten", "nee ik wil meer toelichten", "meer toelichten"]);

export default function IntakePage() {
  const router = useRouter();
  const params = useParams<{ flow: Flow }>();
  const rawFlow = params?.flow;
  const flow = (Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) as Flow;
  const appStore = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const submitInFlightRef = useRef(false);

  const initialAssistantMessage = useMemo<ChatMessage>(
    () => ({
      id: `intro-${flow}`,
      role: "assistant",
      content: `Hallo! Ik ben de BriefKompas chatbot. Ik help je bij het opstellen van je ${
        flow === "bezwaar" ? "bezwaarschrift" : "WOO-verzoek"
      }. ${
        flow === "bezwaar"
          ? "Tegen welk bestuursorgaan richt je het bezwaar?"
          : "Aan welk bestuursorgaan stel je het WOO-verzoek?"
      }`,
      timestamp: new Date(),
    }),
    [flow]
  );

  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [intakeData, setIntakeData] = useState<Partial<IntakeFormData>>({ flow });
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [pendingGrondenConfirmation, setPendingGrondenConfirmation] = useState<string | null>(null);

  const steps = getStepsByFlow(flow);
  const currentStep = steps[currentStepIndex];
  const bestuursorgaanOptions =
    currentStep?.field === "bestuursorgaan"
      ? filterBestuursorganen(currentInput)
      : [];
  const genericStepOptions = currentStep?.field !== "bestuursorgaan"
    ? getAnswerSuggestions(currentStep?.id, currentInput)
    : [];
  const activeOptions = currentStep?.field === "bestuursorgaan" ? bestuursorgaanOptions : genericStepOptions;
  const inputListId = currentStep?.field === "bestuursorgaan"
    ? "bestuursorgaan-options"
    : currentStep
      ? `step-options-${currentStep.id}`
      : undefined;
  const questionsCompleted = currentStepIndex >= steps.length;
  const hasRequiredBezwaarFile = flow !== "bezwaar" || Boolean(intakeData.files?.besluit);
  const isIntakeReady = questionsCompleted && hasRequiredBezwaarFile;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addAssistantMessage = (content: string) => {
    const assistantMessage: ChatMessage = {
      id: "assistant-" + Date.now(),
      role: "assistant",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleBackStep = () => {
    if (isLoading) return;
    if (currentStepIndex <= 0) return;
    const previousIndex = Math.max(0, Math.min(currentStepIndex - 1, steps.length - 1));
    setPendingGrondenConfirmation(null);
    setValidationError("");
    setCurrentStepIndex(previousIndex);
    addAssistantMessage(`Terug naar vorige vraag: ${steps[previousIndex].question}`);
  };

  const buildUserMessage = (content: string): ChatMessage => ({
    id: "user-" + Date.now(),
    role: "user",
    content,
    timestamp: new Date(),
  });

  const processStepAnswer = (answer: string) => {
    if (!currentStep) return;

    const fieldName = currentStep.field;
    const normalizedValue =
      fieldName === "digitaleVerstrekking" || fieldName === "spoed"
        ? ["ja", "yes", "j"].includes(answer.toLowerCase())
        : answer;

    const updatedData = {
      ...intakeData,
      [fieldName]: normalizedValue,
    } as Partial<IntakeFormData>;
    setIntakeData(updatedData);
    setPendingGrondenConfirmation(null);

    const followUp = needsFollowUp(updatedData as IntakeFormData, currentStep.id);

    if (followUp) {
      addAssistantMessage(followUp);
      setCurrentInput("");
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      setCurrentStepIndex((prev) => prev + 1);
      addAssistantMessage(nextStep.question);
      setCurrentInput("");
      return;
    }

    if (flow === "bezwaar") {
      setCurrentStepIndex(steps.length);
      if (updatedData.files?.besluit) {
        addAssistantMessage("Dank je! Je intake is voltooid. Klik op 'Naar Overzicht'.");
      } else {
        addAssistantMessage("Prima! Upload nu het PDF-bestand van je besluit. Datum en kenmerk halen we daar automatisch uit.");
      }
    } else {
      setCurrentStepIndex(steps.length);
      addAssistantMessage("Dank je! Je intake is voltooid. Klik op 'Naar Overzicht'.");
    }

    setCurrentInput("");
  };

  const handleSubmitAnswer = () => {
    if (submitInFlightRef.current) return;

    const trimmedInput = currentInput.trim();
    if (!trimmedInput || !currentStep) {
      setValidationError("Vul een antwoord in");
      return;
    }

    if (currentStep.id === "gronden" && pendingGrondenConfirmation) {
      const normalized = trimmedInput.toLowerCase();
      const userMessage = buildUserMessage(trimmedInput);
      setMessages((prev) => [...prev, userMessage]);
      setValidationError("");

      if (confirmYesValues.has(normalized)) {
        processStepAnswer(pendingGrondenConfirmation);
        return;
      }

      if (confirmNoValues.has(normalized)) {
        setPendingGrondenConfirmation(null);
        addAssistantMessage(
          "Helder. Licht gerust iets meer toe. Meer specifieke informatie leidt tot een brief die beter aansluit op jouw situatie."
        );
        setCurrentInput("");
        return;
      }

      const combined = `${pendingGrondenConfirmation} ${trimmedInput}`.replace(/\s+/g, " ").trim();
      if (combined.length >= shortGrondenThreshold) {
        processStepAnswer(combined);
        return;
      }

      setPendingGrondenConfirmation(combined);
      addAssistantMessage(
        "Dank je. Als dit alles is, typ dan 'ja, doorgaan'. Wil je nog aanvullen, typ dan verder of kies een van de voorbeeldopties hieronder."
      );
      setCurrentInput("");
      return;
    }

    const validationMessage = getValidationErrorMessage(currentStep, trimmedInput);
    if (validationMessage) {
      setValidationError(validationMessage);
      if (isLikelyClarifyingQuestion(trimmedInput)) {
        addAssistantMessage(`Ik kan pas doorgaan zodra je deze vraag beantwoordt: ${currentStep.question}`);
      }
      return;
    }

    if (currentStep.id === "gronden" && trimmedInput.length < shortGrondenThreshold) {
      const userMessage = buildUserMessage(trimmedInput);
      setMessages((prev) => [...prev, userMessage]);
      setPendingGrondenConfirmation(trimmedInput);
      setCurrentInput("");
      setValidationError("");
      addAssistantMessage(
        "Je toelichting is nog vrij kort. Weet je zeker dat je niet meer wilt toelichten? Meer specifieke informatie leidt tot een brief die beter aansluit op jouw specifieke situatie. Antwoord met 'ja, doorgaan' of 'nee, ik wil meer toelichten'."
      );
      return;
    }

    setValidationError("");
    submitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const userMessage = buildUserMessage(trimmedInput);
      setMessages((prev) => [...prev, userMessage]);
      processStepAnswer(trimmedInput);
    } finally {
      submitInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    const selectedFile = files[0];
    let extractedDatumBesluit = intakeData.datumBesluit;
    let extractedKenmerk = intakeData.kenmerk;

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/extract-decision-meta", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const extraction = (await response.json()) as {
          datumBesluit?: string | null;
          kenmerk?: string | null;
        };
        extractedDatumBesluit = extraction.datumBesluit ?? extractedDatumBesluit;
        extractedKenmerk = extraction.kenmerk ?? extractedKenmerk;
      }
    } catch {
      // Metadata extractie is best effort; intake moet verder kunnen.
    }

    const updatedData = {
      ...intakeData,
      datumBesluit: extractedDatumBesluit,
      kenmerk: extractedKenmerk,
      files: {
        ...intakeData.files,
        besluit: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          path: URL.createObjectURL(selectedFile),
        },
      },
    } as Partial<IntakeFormData>;

    setIntakeData(updatedData);

    if (flow === "bezwaar") {
      const extractionNotes: string[] = [];
      if (updatedData.datumBesluit) extractionNotes.push(`datum: ${updatedData.datumBesluit}`);
      if (updatedData.kenmerk) extractionNotes.push(`kenmerk: ${updatedData.kenmerk}`);

      if (questionsCompleted) {
        const extractionLine =
          extractionNotes.length > 0
            ? ` Gevonden in het besluit: ${extractionNotes.join(", ")}.`
            : " Datum en kenmerk konden niet betrouwbaar uit de PDF worden gehaald.";
        addAssistantMessage(
          `Bestand ontvangen (${selectedFile.name}). Je intake is voltooid. Klik op 'Naar Overzicht'.${extractionLine}`
        );
      } else {
        const extractionLine =
          extractionNotes.length > 0
            ? ` Ik heb alvast ${extractionNotes.join(" en ")} uit het besluit gehaald.`
            : " Ik kon datum en kenmerk nog niet betrouwbaar uitlezen.";
        addAssistantMessage(`Bestand ontvangen (${selectedFile.name}).${extractionLine} Ga verder met de intakevragen.`);
      }
      return;
    }

    if (questionsCompleted) {
      addAssistantMessage(`Bestand ontvangen (${selectedFile.name}). Je intake is voltooid. Klik op 'Naar Overzicht'.`);
    }
  };

  const handleContinue = () => {
    if (!isIntakeReady) return;
    const finalizedData = { ...intakeData, flow } as IntakeFormData;
    appStore.setIntakeData(finalizedData);
    sessionStorage.setItem("briefkompas_intake", JSON.stringify(finalizedData));
    router.push(`/review/${flow}`);
  };

  return (
    <div className="max-w-2xl mx-auto min-h-[78vh] flex flex-col justify-center">
      <Card>
        <StepHeader
          currentStep={Math.min(currentStepIndex + 1, steps.length)}
          totalSteps={steps.length}
          title="Intake Interview"
        />

        <div className="bg-white rounded-xl border border-[var(--border)] p-4 mb-4 h-96 overflow-y-auto chat-container">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {!isIntakeReady && currentStepIndex < steps.length && (
          <div className="space-y-3 mb-4">
            <Input
              placeholder="Typ je antwoord..."
              value={currentInput}
              list={activeOptions.length > 0 ? inputListId : undefined}
              onChange={(e) => {
                setCurrentInput(e.target.value);
                setValidationError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitAnswer();
              }}
              error={validationError}
              disabled={isLoading}
            />
            {activeOptions.length > 0 && inputListId && (
              <>
                <datalist id={inputListId}>
                  {activeOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {currentStep?.field === "bestuursorgaan" && (
                  <p className="text-xs text-[var(--muted)]">
                    Begin met typen en kies een bestuursorgaan uit de suggesties.
                  </p>
                )}
                {currentStep?.id === "doel" && (
                  <p className="text-xs text-[var(--muted)]">
                    Je kunt ook korte doelen gebruiken, zoals: intrekken, herzien of aanpassen.
                  </p>
                )}
              </>
            )}
            {currentStep?.id === "gronden" && (
              <div className="flex flex-wrap gap-2">
                {grondenFallbackOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setCurrentInput(option);
                      setValidationError("");
                    }}
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            <Button
              onClick={handleSubmitAnswer}
              disabled={!currentInput.trim() || isLoading}
              isLoading={isLoading}
              className="w-full"
            >
              Volgende
            </Button>
          </div>
        )}

        {flow === "bezwaar" && !isIntakeReady && (
          <UploadBox
            label="Upload je besluit (PDF verplicht)"
            accept=".pdf"
            onFileSelect={handleFileSelect}
            uploadedFiles={intakeData.files?.besluit ? [intakeData.files.besluit] : []}
            required
          />
        )}

        {isIntakeReady && (
          <Alert type="success" title="Intake voltooid">
            Je intake is voltooid. Klik op Naar Overzicht om je antwoorden te controleren.
          </Alert>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => router.push("/")} className="flex-1">
            Annuleren
          </Button>
          <Button
            variant="secondary"
            onClick={handleBackStep}
            disabled={isLoading || currentStepIndex === 0}
            className="flex-1"
          >
            Vorige vraag
          </Button>
          <Button onClick={handleContinue} disabled={!isIntakeReady} className="flex-1">
            Naar Overzicht
          </Button>
        </div>
      </Card>
    </div>
  );
}
