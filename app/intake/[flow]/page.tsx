"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { getStepsByFlow, validateStep, needsFollowUp, isIntakeComplete } from "@/lib/intake-flow";
import { ChatMessage, ChatStep, Flow, IntakeFormData } from "@/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import { UploadBox } from "@/components/UploadBox";
import { ChatBubble } from "@/components/ChatBubble";
import { StepHeader, Alert, LoadingSpinner } from "@/components/index";

interface IntakePageProps {
  params: { flow: Flow };
}

export default function IntakePage({ params }: IntakePageProps) {
  const router = useRouter();
  const flow = params.flow as Flow;
  
  const appStore = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [intakeData, setIntakeData] = useState<Partial<IntakeFormData>>({
    flow,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const steps = getStepsByFlow(flow);

  // Initialize chat
  useEffect(() => {
    if (messages.length === 0) {
      const initialMessage: ChatMessage = {
        id: "intro-" + Date.now(),
        role: "assistant",
        content: `Hallo! Ik ben de BriefKompas chatbot. Ik zal je helpen bij het opstellen van je ${
          flow === "bezwaar" ? "bezwaarschrift" : "WOO-verzoek"
        }. Laten we beginnen! ${
          flow === "bezwaar"
            ? "Tegen welk bestuursorgaan richt je het bezwaar?"
            : "Aan welk bestuursorgaan stel je het WOO-verzoek?"
        }`,
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const currentStep = steps[currentStepIndex];

  const handleSubmitAnswer = async () => {
    if (!currentInput.trim()) {
      setValidationError("Vul een antwoord in");
      return;
    }

    if (currentStep.validation && !validateStep(currentStep, currentInput)) {
      setValidationError("Dit antwoord voldoet niet aan de vereisten");
      return;
    }

    setValidationError("");
    setIsLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: currentInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Update intake data
    const fieldName = currentStep.field;
    const updatedData = {
      ...intakeData,
      [fieldName]:
        fieldName === "digitaleVerstrekking" || fieldName === "spoed"
          ? ["ja", "yes", "j"].includes(currentInput.toLowerCase())
          : currentInput,
    } as Partial<IntakeFormData>;
    setIntakeData(updatedData);

    // Check for follow-ups
    const followUp = needsFollowUp(updatedData as IntakeFormData, currentStep.id);
    let assistantResponse = "";

    if (followUp) {
      assistantResponse = followUp;
    } else if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      assistantResponse = nextStep.question;
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // For bezwaar, ask for file upload
      if (flow === "bezwaar") {
        assistantResponse = "Prima! Nu graag het PDF-bestand van je besluit. Dit is verplicht.";
      } else {
        assistantResponse =
          "Dank je! Je intake is voltooid. We gaan nu naar het overzicht.";
        setCurrentStepIndex(steps.length);
      }
    }

    // Add assistant response
    const assistantMessage: ChatMessage = {
      id: "assistant-" + Date.now(),
      role: "assistant",
      content: assistantResponse,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setCurrentInput("");
    setIsLoading(false);
  };

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
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

      const message: ChatMessage = {
        id: "assistant-" + Date.now(),
        role: "assistant",
        content: `Prima! Ik heb je bestand ontvangen (${files[0].name}). Je intake is nu voltooid. Laten we naar het overzicht gaan.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, message]);
    }
  };

  const handleContinue = () => {
    appStore.setIntakeData(intakeData as IntakeFormData);
    router.push(`/review/${flow}`);
  };

  const isIntakeReady =
    currentStepIndex >= steps.length &&
    (flow === "woo" ||
      (flow === "bezwaar" && intakeData.files?.besluit));

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col">
      <Card>
        <StepHeader
          currentStep={Math.min(currentStepIndex + 1, steps.length)}
          totalSteps={steps.length}
          title="Intake Interview"
        />

        {/* Chat Container */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 h-96 overflow-y-auto chat-container">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {currentStepIndex < steps.length && (
          <div className="space-y-3 mb-4">
            {currentStep?.field !== "files" ? (
              <>
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
              </>
            ) : (
              <UploadBox
                label="Upload je besluit (PDF)"
                accept=".pdf"
                onFileSelect={handleFileSelect}
                required
              />
            )}
          </div>
        )}

        {flow === "bezwaar" && (
          <UploadBox
            label="Upload je besluit (PDF verplicht)"
            accept=".pdf"
            onFileSelect={handleFileSelect}
            uploadedFiles={
              intakeData.files?.besluit ? [intakeData.files.besluit] : []
            }
            required
          />
        )}

        {/* Continue Button */}
        {isIntakeReady && (
          <Alert type="success" title="✓ Intake voltooid">
            Je intake is voltooid! Klik hieronder om je antwoorden te controleren.
          </Alert>
        )}

        <div className="mt-6 flex gap-4">
          <Button
            variant="secondary"
            onClick={() => router.push("/")}
            className="flex-1"
          >
            Annuleren
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!isIntakeReady}
            className="flex-1"
          >
            Naar Overzicht →
          </Button>
        </div>
      </Card>
    </div>
  );
}
