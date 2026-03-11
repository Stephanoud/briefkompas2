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
import { ChatMessage, DecisionExtractionResult, Flow, IntakeFormData } from "@/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { UploadBox } from "@/components/UploadBox";
import { ChatBubble } from "@/components/ChatBubble";
import { StepHeader, Alert } from "@/components";

const shortGrondenThreshold = 120;
const confirmYesValues = new Set(["ja", "ja, doorgaan", "ja doorgaan", "doorgaan", "ok", "oke", "prima"]);
const confirmNoValues = new Set(["nee", "nee, ik wil meer toelichten", "nee ik wil meer toelichten", "meer toelichten"]);

function truncatePreview(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function getDocumentSourceLabel(source?: IntakeFormData["besluitBronType"]): string | null {
  if (source === "image") return "foto";
  if (source === "pdf") return "PDF";
  return null;
}

function getDocumentAnalysisPresentation(status?: IntakeFormData["besluitAnalyseStatus"]) {
  if (status === "read") {
    return {
      title: "Besluit gelezen",
      type: "success" as const,
      description:
        "De kern van het besluit is meegenomen. Controleer wel altijd datum, kenmerk en inhoud.",
    };
  }

  if (status === "partial") {
    return {
      title: "Besluit deels gelezen",
      type: "warning" as const,
      description:
        "Slechts een deel van het besluit kon betrouwbaar worden uitgelezen. Controleer de overgenomen gegevens extra goed.",
    };
  }

  return {
    title: "Alleen intake gebruikt",
    type: "warning" as const,
    description:
      "Het besluit kon niet voldoende worden uitgelezen. Upload bij voorkeur een scherpere afbeelding of een doorzoekbare PDF.",
  };
}

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
  const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false);
  const [documentAnalysisMessage, setDocumentAnalysisMessage] = useState("");

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
        addAssistantMessage(
          "Prima! Upload nu je besluit als PDF of maak met je telefoon een foto. Datum, kenmerk en een korte samenvatting halen we daar automatisch uit."
        );
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
    let extractedSummary = intakeData.besluitSamenvatting;
    let extractedText = intakeData.besluitTekst;
    let extractedSource = intakeData.besluitBronType;
    let extractedDocumentType = intakeData.besluitDocumentType;
    let extractedAnalysis = intakeData.besluitAnalyse;
    let extractedAnalysisStatus = intakeData.besluitAnalyseStatus;
    let extractedReadability = intakeData.besluitLeeskwaliteit;
    let analysisNote = "";

    setIsAnalyzingDocument(true);
    setDocumentAnalysisMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/extract-decision-meta", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as DecisionExtractionResult | { error?: string };

      if (response.ok && "extracted" in payload) {
        const extraction = payload as DecisionExtractionResult;
        extractedDatumBesluit = extraction.datumBesluit ?? extractedDatumBesluit;
        extractedKenmerk = extraction.kenmerk ?? extractedKenmerk;
        extractedSummary = extraction.samenvatting ?? extractedSummary;
        extractedText = extraction.extractedText ?? extractedText;
        extractedSource = extraction.analysisSource ?? extractedSource;
        extractedDocumentType = extraction.documentType ?? extractedDocumentType;
        extractedAnalysis = extraction.decisionAnalysis ?? extractedAnalysis;
        extractedAnalysisStatus = extraction.analysisStatus ?? extractedAnalysisStatus;
        extractedReadability = extraction.readability ?? extractedReadability;
        analysisNote = extraction.warning ?? "";
      } else if ("error" in payload && payload.error) {
        analysisNote = payload.error;
      }
    } catch {
      analysisNote = "Automatische analyse van het besluit is niet gelukt. Controleer datum en kenmerk handmatig.";
    } finally {
      setIsAnalyzingDocument(false);
      setDocumentAnalysisMessage(analysisNote);
    }

    const updatedData = {
      ...intakeData,
      datumBesluit: extractedDatumBesluit,
      kenmerk: extractedKenmerk,
      besluitSamenvatting: extractedSummary,
      besluitTekst: extractedText,
      besluitBronType: extractedSource,
      besluitDocumentType: extractedDocumentType,
      besluitAnalyse: extractedAnalysis,
      besluitAnalyseStatus: extractedAnalysisStatus,
      besluitLeeskwaliteit: extractedReadability,
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
      if (updatedData.besluitDocumentType) extractionNotes.push(`documenttype: ${updatedData.besluitDocumentType}`);
      if (updatedData.besluitAnalyse?.onderwerp) extractionNotes.push(`onderwerp: ${updatedData.besluitAnalyse.onderwerp}`);
      if (updatedData.besluitAnalyse?.termijnen) extractionNotes.push(`termijn: ${updatedData.besluitAnalyse.termijnen}`);

      const sourceLabel = getDocumentSourceLabel(updatedData.besluitBronType);
      const summaryLine = updatedData.besluitSamenvatting
        ? ` Samenvatting: ${truncatePreview(updatedData.besluitSamenvatting)}`
        : "";
      const statusLine = updatedData.besluitAnalyseStatus
        ? ` Status: ${getDocumentAnalysisPresentation(updatedData.besluitAnalyseStatus).title.toLowerCase()}.`
        : "";
      const noteLine = analysisNote ? ` ${analysisNote}` : "";
      const sourceLine = sourceLabel ? ` via ${sourceLabel}` : "";

      if (questionsCompleted) {
        const extractionLine =
          extractionNotes.length > 0
            ? ` Gevonden in het besluit: ${extractionNotes.join(", ")}.`
            : " Datum en kenmerk konden niet betrouwbaar uit het bestand worden gehaald.";
        addAssistantMessage(
          `Bestand ontvangen${sourceLine} (${selectedFile.name}). Je intake is voltooid. Klik op 'Naar Overzicht'.${statusLine}${extractionLine}${summaryLine}${noteLine}`
        );
      } else {
        const extractionLine =
          extractionNotes.length > 0
            ? ` Ik heb alvast ${extractionNotes.join(" en ")} uit het besluit gehaald.`
            : " Ik kon datum en kenmerk nog niet betrouwbaar uitlezen.";
        addAssistantMessage(
          `Bestand ontvangen${sourceLine} (${selectedFile.name}).${statusLine}${extractionLine}${summaryLine}${noteLine} Ga verder met de intakevragen.`
        );
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
          <div className="space-y-4">
            <UploadBox
              label="Upload of fotografeer je besluit (verplicht)"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              descriptionText="Sleep je besluit hier of"
              actionText="maak een foto of kies een bestand"
              helperText="Op telefoon kun je direct een foto maken. Ondersteund: PDF, JPG, PNG en WEBP."
              capture="environment"
              disabled={isAnalyzingDocument}
              onFileSelect={handleFileSelect}
              uploadedFiles={intakeData.files?.besluit ? [intakeData.files.besluit] : []}
              required
            />

            {isAnalyzingDocument && (
              <Alert type="info" title="Besluit wordt geanalyseerd">
                We lezen datum, kenmerk en relevante tekst uit je bestand. Dit duurt meestal enkele seconden.
              </Alert>
            )}

            {(documentAnalysisMessage || intakeData.besluitAnalyseStatus) && !isAnalyzingDocument && (
              <Alert
                type={getDocumentAnalysisPresentation(intakeData.besluitAnalyseStatus).type}
                title={getDocumentAnalysisPresentation(intakeData.besluitAnalyseStatus).title}
              >
                <span>{getDocumentAnalysisPresentation(intakeData.besluitAnalyseStatus).description}</span>
                {documentAnalysisMessage && <span className="block pt-2">{documentAnalysisMessage}</span>}
              </Alert>
            )}

            {(intakeData.besluitSamenvatting || intakeData.besluitTekst || intakeData.besluitAnalyse) && (
              <Alert type="success" title="Uit het besluit gehaald">
                <div className="space-y-2 text-sm">
                  {intakeData.besluitAnalyse?.onderwerp && (
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Onderwerp:</span>{" "}
                      {intakeData.besluitAnalyse.onderwerp}
                    </p>
                  )}
                  {intakeData.besluitAnalyse?.rechtsgrond && (
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Rechtsgrond:</span>{" "}
                      {intakeData.besluitAnalyse.rechtsgrond}
                    </p>
                  )}
                  {intakeData.besluitAnalyse?.besluitInhoud && (
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Besluitinhoud:</span>{" "}
                      {intakeData.besluitAnalyse.besluitInhoud}
                    </p>
                  )}
                  {intakeData.besluitAnalyse?.termijnen && (
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Termijnen:</span>{" "}
                      {intakeData.besluitAnalyse.termijnen}
                    </p>
                  )}
                  {intakeData.besluitSamenvatting && (
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Samenvatting:</span>{" "}
                      {intakeData.besluitSamenvatting}
                    </p>
                  )}
                  {intakeData.besluitTekst && (
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">Tekstfragment:</span>{" "}
                      {truncatePreview(intakeData.besluitTekst, 320)}
                    </p>
                  )}
                </div>
              </Alert>
            )}
          </div>
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
