"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { getStepsByFlow, needsFollowUp, validateStep } from "@/lib/intake-flow";
import { ChatMessage, Flow, IntakeFormData } from "@/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { UploadBox } from "@/components/UploadBox";
import { ChatBubble } from "@/components/ChatBubble";
import { StepHeader, Alert } from "@/components";

interface IntakePageProps {
  params: { flow: Flow };
}

export default function IntakePage({ params }: IntakePageProps) {
  const router = useRouter();
  const flow = params.flow as Flow;
  const appStore = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const [isComplete, setIsComplete] = useState(false);

  const steps = getStepsByFlow(flow);
  const currentStep = steps[currentStepIndex];

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

    if (isComplete) {
      setIsComplete(false);
      const previousIndex = Math.max(0, steps.length - 1);
      setCurrentStepIndex(previousIndex);
      addAssistantMessage(`Terug naar vorige vraag: ${steps[previousIndex].question}`);
      return;
    }

    if (currentStepIndex <= 0) return;
    const previousIndex = currentStepIndex - 1;
    setCurrentStepIndex(previousIndex);
    addAssistantMessage(`Terug naar vorige vraag: ${steps[previousIndex].question}`);
  };

  const handleSubmitAnswer = async () => {
    if (!currentInput.trim() || !currentStep) {
      setValidationError("Vul een antwoord in");
      return;
    }

    if (currentStep.validation && !validateStep(currentStep, currentInput)) {
      setValidationError("Dit antwoord voldoet niet aan de vereisten");
      return;
    }

    setValidationError("");
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: currentInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const fieldName = currentStep.field;
    const normalizedValue =
      fieldName === "digitaleVerstrekking" || fieldName === "spoed"
        ? ["ja", "yes", "j"].includes(currentInput.toLowerCase())
        : currentInput;

    const updatedData = {
      ...intakeData,
      [fieldName]: normalizedValue,
    } as Partial<IntakeFormData>;
    setIntakeData(updatedData);

    const followUp = needsFollowUp(updatedData as IntakeFormData, currentStep.id);

    if (followUp) {
      addAssistantMessage(followUp);
      setCurrentInput("");
      setIsLoading(false);
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      setCurrentStepIndex((prev) => prev + 1);
      addAssistantMessage(nextStep.question);
      setCurrentInput("");
      setIsLoading(false);
      return;
    }

    if (flow === "bezwaar") {
      addAssistantMessage("Prima! Upload nu het PDF-bestand van je besluit. Dit is verplicht.");
    } else {
      setIsComplete(true);
      setCurrentStepIndex(steps.length);
      addAssistantMessage("Dank je! Je intake is voltooid. Klik op 'Naar Overzicht'.");
    }

    setCurrentInput("");
    setIsLoading(false);
  };

  const handleFileSelect = (files: File[]) => {
    if (files.length === 0) return;

    const updatedData = {
      ...intakeData,
      files: {
        ...intakeData.files,
        besluit: {
          name: files[0].name,
          size: files[0].size,
          type: files[0].type,
          path: URL.createObjectURL(files[0]),
        },
      },
    } as Partial<IntakeFormData>;

    setIntakeData(updatedData);
    setIsComplete(true);
    setCurrentStepIndex(steps.length);
    addAssistantMessage(`Bestand ontvangen (${files[0].name}). Je intake is voltooid. Klik op 'Naar Overzicht'.`);
  };

  const isIntakeReady =
    isComplete ||
    (flow === "woo" && currentStepIndex >= steps.length) ||
    (flow === "bezwaar" && Boolean(intakeData.files?.besluit));

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
            disabled={isLoading || (currentStepIndex === 0 && !isComplete)}
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
