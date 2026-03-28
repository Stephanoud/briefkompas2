"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
  WOO_SUBJECT_CLARIFICATION_OPTIONS,
  getStepsByFlow,
  getValidationErrorMessage,
  interpretWooPeriodAnswer,
  interpretWooSubjectAnswer,
  isLikelyClarifyingQuestion,
  needsFollowUp,
  normalizeBezwaarCategorie,
} from "@/lib/intake-flow";
import { getAnswerSuggestions, grondenFallbackOptions } from "@/lib/intake/answerSuggestions";
import { filterBestuursorganen } from "@/lib/intake/bestuursorganen";
import {
  createInitialIntakeInterpretation,
  getContextualQuestion,
  getContextualValidationMessage,
  getSuggestedStepId,
  interpretIntakeTurn,
  type IntakeInterpretationState,
} from "@/lib/intake/interpretation";
import {
  assessDecisionProcedure,
  buildDecisionProcedureSwitchPrompt,
  type DecisionProcedureAssessment,
} from "@/lib/decision-procedure";
import {
  getFlowActionLabel,
  getFlowDocumentLabel,
  requiresDecisionUpload,
  supportsDecisionUpload,
  resolveFlowFromRoute,
} from "@/lib/flow";
import { extractTextFromPdfInBrowser } from "@/lib/client-pdf-extraction";
import { ChatMessage, DecisionExtractionResult, Flow, IntakeFormData } from "@/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { UploadBox } from "@/components/UploadBox";
import { ChatBubble } from "@/components/ChatBubble";
import { StepHeader, Alert } from "@/components";

const shortGrondenThreshold = 120;
const confirmYesValues = new Set([
  "ja",
  "ja, doorgaan",
  "ja doorgaan",
  "doorgaan",
  "ok",
  "oke",
  "prima",
  "klopt",
  "dat klopt",
]);
const confirmNoValues = new Set([
  "nee",
  "nee, ik wil meer toelichten",
  "nee ik wil meer toelichten",
  "meer toelichten",
  "klopt niet",
]);

interface PendingStepConfirmation {
  stepId: string;
  value: string;
}

interface PendingWooSubjectClarification {
  baseTopic: string;
  options: string[];
}

type IntakeStage = "route_confirm" | "substantive";

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  return Boolean(value);
}

function isChatStepSatisfied(step: ReturnType<typeof getStepsByFlow>[number] | undefined, data: Partial<IntakeFormData>): boolean {
  if (!step) return false;

  const value = data[step.field as keyof IntakeFormData];
  if (!hasMeaningfulValue(value)) return false;
  if (!step.validation || typeof value !== "string") return true;
  return step.validation(value);
}

function findNextUnsatisfiedStepIndex(
  stepList: ReturnType<typeof getStepsByFlow>,
  data: Partial<IntakeFormData>
): number {
  for (let index = 0; index < stepList.length; index += 1) {
    if (!isChatStepSatisfied(stepList[index], data)) {
      return index;
    }
  }

  return stepList.length;
}

function buildCurrentStepPatch(
  step: ReturnType<typeof getStepsByFlow>[number] | undefined,
  answer: string,
  interpretedPatch: Partial<IntakeFormData>
): Partial<IntakeFormData> {
  if (!step) return {};

  const interpretedFieldValue = interpretedPatch[step.field as keyof IntakeFormData];

  switch (step.id) {
    case "bestuursorgaan":
      return interpretedPatch.bestuursorgaan ? { [step.field]: interpretedPatch.bestuursorgaan } : {};
    case "categorie": {
      const normalizedCategory = normalizeBezwaarCategorie(answer);
      return normalizedCategory ? { [step.field]: normalizedCategory } : {};
    }
    case "digitale_verstrekking":
    case "spoed":
      return {
        [step.field]: ["ja", "yes", "j"].includes(answer.toLowerCase()),
      };
    default:
      return {
        [step.field]: interpretedFieldValue ?? answer,
      };
  }
}

function truncatePreview(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function hasReadableDecisionExtraction(data: Partial<IntakeFormData>): boolean {
  return Boolean(
    data.datumBesluit ||
      data.kenmerk ||
      data.besluitSamenvatting ||
      data.besluitTekst ||
      data.besluitAnalyse ||
      data.besluitDocumentType
  );
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

function buildIntroMessage(
  flow: Flow,
  interpretation: IntakeInterpretationState,
  requestedFlowValue?: string
): string {
  if (supportsDecisionUpload(flow)) {
    const routeLabel =
      requestedFlowValue === "beroep"
        ? "beroep"
        : flow === "zienswijze"
          ? "zienswijze"
          : getFlowActionLabel(flow).toLowerCase();
    return `Hallo! Ik ben de BriefKompas chatbot. Upload eerst je besluit of ontwerpbesluit. Daarna controleer ik of ${routeLabel} waarschijnlijk de juiste route is en stel ik een paar korte vragen voor je ${getFlowDocumentLabel(
      flow
    )}.`;
  }

  const steps = getStepsByFlow(flow);
  return `Hallo! Ik ben de BriefKompas chatbot. Ik help je bij het opstellen van je ${getFlowDocumentLabel(flow)}. ${getContextualQuestion({
    flow,
    step: steps[0],
    interpretation,
    intakeData: { flow },
  })}`;
}

export default function IntakePage() {
  const router = useRouter();
  const params = useParams<{ flow?: string }>();
  const rawFlow = params?.flow;
  const routeFlowValue = Array.isArray(rawFlow) ? rawFlow[0] : rawFlow;
  const routeFlow = resolveFlowFromRoute(routeFlowValue);
  const initialFlow = routeFlow ?? "bezwaar";
  const [resolvedFlow, setResolvedFlow] = useState<Flow>(initialFlow);
  const activeFlow = resolvedFlow;
  const steps = getStepsByFlow(activeFlow);
  const initialInterpretation = useMemo<IntakeInterpretationState>(
    () => createInitialIntakeInterpretation(initialFlow),
    [initialFlow]
  );
  const appStore = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const submitInFlightRef = useRef(false);
  const [stage, setStage] = useState<IntakeStage>("substantive");
  const [routeCheckResult, setRouteCheckResult] = useState<DecisionProcedureAssessment | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: `intro-${initialFlow}`,
      role: "assistant",
      content: buildIntroMessage(initialFlow, initialInterpretation, routeFlowValue),
      timestamp: new Date(),
    },
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [intakeData, setIntakeData] = useState<Partial<IntakeFormData>>({ flow: initialFlow });
  const [interpretationState, setInterpretationState] =
    useState<IntakeInterpretationState>(initialInterpretation);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [pendingGrondenConfirmation, setPendingGrondenConfirmation] = useState<string | null>(null);
  const [pendingStepConfirmation, setPendingStepConfirmation] = useState<PendingStepConfirmation | null>(null);
  const [pendingWooSubjectClarification, setPendingWooSubjectClarification] =
    useState<PendingWooSubjectClarification | null>(null);
  const [stepPromptCounts, setStepPromptCounts] = useState<Record<string, number>>(
    supportsDecisionUpload(initialFlow)
      ? {}
      : steps[0]
        ? { [steps[0].id]: 1 }
        : {}
  );
  const [deferredStepIds, setDeferredStepIds] = useState<string[]>([]);
  const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false);
  const [documentAnalysisMessage, setDocumentAnalysisMessage] = useState("");
  const currentStep = stage === "substantive" ? steps[currentStepIndex] : undefined;
  const bestuursorgaanOptions =
    stage === "substantive" && currentStep?.field === "bestuursorgaan"
      ? filterBestuursorganen(currentInput)
      : [];
  const wooSubjectClarificationOptions =
    activeFlow === "woo" && currentStep?.id === "onderwerp" && pendingWooSubjectClarification
      ? pendingWooSubjectClarification.options
      : [];
  const genericStepOptions =
    stage === "substantive" && currentStep && currentStep.field !== "bestuursorgaan"
      ? getAnswerSuggestions(getSuggestedStepId(currentStep, interpretationState), currentInput)
      : [];
  const routeConfirmOptions = stage === "route_confirm" ? ["ja", "nee"] : [];
  const activeOptions =
    stage === "route_confirm"
      ? routeConfirmOptions
      : currentStep?.field === "bestuursorgaan"
        ? bestuursorgaanOptions
        : wooSubjectClarificationOptions.length > 0
          ? wooSubjectClarificationOptions
          : genericStepOptions;
  const inputListId =
    stage === "route_confirm"
        ? "route-confirm-options"
      : currentStep?.field === "bestuursorgaan"
        ? "bestuursorgaan-options"
        : currentStep
          ? `step-options-${currentStep.id}`
          : undefined;
  const hasDecisionFile = !supportsDecisionUpload(activeFlow) || Boolean(intakeData.files?.besluit);
  const questionsCompleted = stage === "substantive" && hasDecisionFile && currentStepIndex >= steps.length;
  const totalSteps = steps.length + (supportsDecisionUpload(activeFlow) ? 1 : 0);
  const visibleStepNumber =
    supportsDecisionUpload(activeFlow) && !hasDecisionFile
      ? 1
      : (supportsDecisionUpload(activeFlow) ? 1 : 0) +
        (questionsCompleted ? steps.length : Math.min(currentStepIndex + 1, steps.length));
  const isIntakeReady = stage === "substantive" && questionsCompleted;

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

  const addUserMessage = (content: string) => {
    const userMessage: ChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
  };

  const buildUserMessage = (content: string): ChatMessage => ({
    id: "user-" + Date.now(),
    role: "user",
    content,
    timestamp: new Date(),
  });

  const incrementStepPromptCount = (stepId: string) => {
    setStepPromptCounts((prev) => ({
      ...prev,
      [stepId]: (prev[stepId] ?? 0) + 1,
    }));
  };

  const getActiveDeferredStepIds = (data: Partial<IntakeFormData>, candidateDeferredIds = deferredStepIds) => {
    return candidateDeferredIds.filter((stepId) => {
      const deferredStep = steps.find((item) => item.id === stepId);
      return deferredStep ? !isChatStepSatisfied(deferredStep, data) : false;
    });
  };

  const findNextConversationStepIndex = (
    data: Partial<IntakeFormData>,
    startIndex: number,
    candidateDeferredIds = deferredStepIds
  ) => {
    const activeDeferredStepIds = getActiveDeferredStepIds(data, candidateDeferredIds);

    for (let index = startIndex; index < steps.length; index += 1) {
      const step = steps[index];
      if (!isChatStepSatisfied(step, data) && !activeDeferredStepIds.includes(step.id)) {
        return index;
      }
    }

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (!isChatStepSatisfied(step, data)) {
        return index;
      }
    }

    return steps.length;
  };

  const askStepQuestion = (params: {
    stepIndex: number;
    data: Partial<IntakeFormData>;
    interpretation: IntakeInterpretationState;
    prefix?: string;
  }) => {
    const step = steps[params.stepIndex];
    if (!step) {
      return;
    }

    const question = getContextualQuestion({
      flow: activeFlow,
      step,
      interpretation: params.interpretation,
      intakeData: params.data,
    });

    setCurrentStepIndex(params.stepIndex);
    incrementStepPromptCount(step.id);
    addAssistantMessage(params.prefix ? `${params.prefix}${question}` : question);
  };

  const startSubstantiveFlow = (nextFlow: Flow, nextData: Partial<IntakeFormData>) => {
    const nextInterpretation = createInitialIntakeInterpretation(nextFlow);
    const nextSteps = getStepsByFlow(nextFlow);
    const nextStepIndex = findNextUnsatisfiedStepIndex(nextSteps, { ...nextData, flow: nextFlow });
    const nextStep = nextSteps[nextStepIndex];
    setResolvedFlow(nextFlow);
    setStage("substantive");
    setCurrentStepIndex(nextStepIndex);
    setDeferredStepIds([]);
    setPendingGrondenConfirmation(null);
    setPendingStepConfirmation(null);
    setPendingWooSubjectClarification(null);
    setValidationError("");
    setCurrentInput("");
    setStepPromptCounts(nextStep ? { [nextStep.id]: 1 } : {});
    setInterpretationState(nextInterpretation);
    setIntakeData({
      ...nextData,
      flow: nextFlow,
      procedureAdvies: nextFlow,
      procedureBevestigd: true,
    });

    if (!nextStep) {
      addAssistantMessage(
        `Helder. We gaan verder met ${getFlowActionLabel(nextFlow).toLowerCase()}. Je intake is inhoudelijk al compleet.`
      );
      return;
    }

    const firstQuestion = getContextualQuestion({
      flow: nextFlow,
      step: nextStep,
      interpretation: nextInterpretation,
      intakeData: { ...nextData, flow: nextFlow },
    });

    addAssistantMessage(
      `Helder. We gaan verder met ${getFlowActionLabel(nextFlow).toLowerCase()}. ${firstQuestion}`
    );
  };

  const askFirstQuestionForCurrentFlow = (data: Partial<IntakeFormData>, prefix?: string) => {
    const nextStepIndex = findNextUnsatisfiedStepIndex(steps, data);
    const firstStep = steps[nextStepIndex];
    if (!firstStep || (stepPromptCounts[firstStep.id] ?? 0) > 0) {
      return;
    }

    const question = getContextualQuestion({
      flow: activeFlow,
      step: firstStep,
      interpretation: interpretationState,
      intakeData: data,
    });

    setCurrentStepIndex(nextStepIndex);
    incrementStepPromptCount(firstStep.id);
    addAssistantMessage(prefix ? `${prefix}${question}` : question);
  };

  const finalizeIntake = (data: Partial<IntakeFormData>) => {
    setCurrentStepIndex(steps.length);

    if (requiresDecisionUpload(activeFlow) && !data.files?.besluit) {
      addAssistantMessage(
        activeFlow === "zienswijze"
          ? "Upload eerst het ontwerpbesluit voordat je verdergaat."
          : "Upload eerst het besluit voordat je verdergaat."
      );
      return;
    }

    addAssistantMessage("Dank je! Je intake is voltooid. Klik op 'Naar Overzicht'.");
  };

  const continueToNextRelevantStep = (params: {
    data: Partial<IntakeFormData>;
    interpretation: IntakeInterpretationState;
    startIndex: number;
    prefix?: string;
    candidateDeferredIds?: string[];
  }) => {
    const activeDeferredStepIds = getActiveDeferredStepIds(
      params.data,
      params.candidateDeferredIds ?? deferredStepIds
    );
    setDeferredStepIds(activeDeferredStepIds);

    const nextStepIndex = findNextConversationStepIndex(
      params.data,
      params.startIndex,
      activeDeferredStepIds
    );

    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];
      if (activeDeferredStepIds.includes(nextStep.id)) {
        setCurrentStepIndex(nextStepIndex);
        incrementStepPromptCount(nextStep.id);
        addAssistantMessage(
          params.prefix
            ? `${params.prefix}${getStepRecoveryPrompt(nextStep, "")}`
            : `Ik mis nog een open punt. ${getStepRecoveryPrompt(nextStep, "")}`
        );
        return;
      }

      askStepQuestion({
        stepIndex: nextStepIndex,
        data: params.data,
        interpretation: params.interpretation,
        prefix: params.prefix,
      });
      return;
    }

    finalizeIntake(params.data);
  };

  const processRouteConfirmation = (answer: string) => {
    if (!routeCheckResult) return;

    const normalized = answer.trim().toLowerCase();
    addUserMessage(answer);
    setCurrentInput("");
    setValidationError("");

    if (confirmYesValues.has(normalized) && routeCheckResult.suggestedFlow) {
      startSubstantiveFlow(routeCheckResult.suggestedFlow, {
        ...intakeData,
        procedureAdvies: routeCheckResult.suggestedFlow,
        procedureReden: routeCheckResult.explanation,
        procedureBevestigd: true,
      });
      return;
    }

    if (confirmNoValues.has(normalized)) {
      const continuedData = {
        ...intakeData,
        procedureAdvies: activeFlow,
        procedureReden: routeCheckResult.explanation,
        procedureBevestigd: false,
      } as Partial<IntakeFormData>;
      setStage("substantive");
      setIntakeData(continuedData);
      addAssistantMessage("Helder. We gaan verder met de gekozen route.");
      askFirstQuestionForCurrentFlow(continuedData, "Nog een korte vraag om je brief goed op te bouwen: ");
      return;
    }

    setValidationError("Antwoord met 'ja' of 'nee'.");
    addAssistantMessage("Laat even weten of dit klopt. Antwoord met 'ja' of 'nee'.");
  };

  const getStepRecoveryPrompt = (
    step: ReturnType<typeof getStepsByFlow>[number],
    answer: string
  ) => {
    if (activeFlow === "woo" && step.id === "onderwerp") {
      if (pendingWooSubjectClarification?.baseTopic) {
        return `Ik wil eerst scherper krijgen wat je precies zoekt over ${pendingWooSubjectClarification.baseTopic}. Kies bijvoorbeeld uit besluiten en onderbouwing, interne e-mails en afstemming, beleidskeuzes en notities, of uitvoering en financiele informatie.`;
      }

      return "Omschrijf eerst wat je inhoudelijk wilt achterhalen. Gaat het bijvoorbeeld om besluiten en onderbouwing, interne e-mails en afstemming, beleidskeuzes en notities, of uitvoering en financiele informatie?";
    }

    if (step.id === "periode") {
      const interpretation = interpretWooPeriodAnswer(answer);
      if (interpretation.status === "ambiguous" && interpretation.clarificationPrompt) {
        return interpretation.clarificationPrompt;
      }

      return "Ik mis nog een bruikbare periode. Je mag bijvoorbeeld antwoorden met 'laatste twee jaar', 'januari 2023 tot januari 2024' of 'sinds 2020'.";
    }

    switch (step.id) {
      case "bestuursorgaan":
        return "Ik mis nog het bestuursorgaan. Noem bijvoorbeeld 'gemeente Utrecht', 'Belastingdienst' of 'UWV'.";
      case "categorie":
        return "Ik heb nog niet scherp om wat voor besluit het gaat. Is het een vergunning, uitkering, boete, belastingzaak of iets anders?";
      case "doel":
        return "Ik hoor nog niet precies wat je wilt bereiken. Gaat het je om intrekking, herziening, aanpassing, verlaging of een nieuw besluit?";
      case "gronden":
        return "Ik mis nog waarom het besluit volgens jou niet klopt. Noem bijvoorbeeld wat onjuist is, wat niet is meegewogen of waarom de gevolgen te zwaar zijn.";
      case "documenten":
        return "Ik mis nog welke stukken je zoekt. Denk aan e-mails, memo's, rapporten, notulen of besluiten.";
      case "digitale_verstrekking":
        return "Laat even weten of je digitale verstrekking wilt: antwoord met 'ja' of 'nee'.";
      case "spoed":
        return "Laat even weten of er spoed is: antwoord met 'ja' of 'nee'.";
      default:
        return `Ik kan nog niet door op basis van dit antwoord. ${step.question}`;
    }
  };

  const handleBackStep = () => {
    if (isLoading) return;
    setPendingGrondenConfirmation(null);
    setPendingStepConfirmation(null);
    setPendingWooSubjectClarification(null);
    setValidationError("");

    if (stage === "route_confirm") {
      setStage("substantive");
      addAssistantMessage("We laten de routecontrole staan. Je kunt doorgaan met de gekozen route.");
      return;
    }

    if (currentStepIndex <= 0) return;
    const previousIndex = Math.max(0, Math.min(currentStepIndex - 1, steps.length - 1));
    setCurrentStepIndex(previousIndex);
    incrementStepPromptCount(steps[previousIndex].id);
    addAssistantMessage(
      `Terug naar vorige vraag: ${getContextualQuestion({
        flow: activeFlow,
        step: steps[previousIndex],
        interpretation: interpretationState,
        intakeData,
      })}`
    );
  };

  const processStepAnswer = (answer: string) => {
    if (!currentStep) return;
    const interpretedTurn = interpretIntakeTurn({
      flow: activeFlow,
      latestUserMessage: answer,
      currentStep,
      intakeData,
      previousState: interpretationState,
    });
    const currentStepPatch = buildCurrentStepPatch(currentStep, answer, interpretedTurn.patch);

    const updatedData = {
      ...intakeData,
      ...interpretedTurn.patch,
      ...currentStepPatch,
      flow: activeFlow,
    } as Partial<IntakeFormData>;
    const currentFieldSatisfied = isChatStepSatisfied(currentStep, updatedData);

    if (!currentFieldSatisfied) {
      const currentPromptCount = stepPromptCounts[currentStep.id] ?? 1;
      const semanticOnlyData = {
        ...intakeData,
        ...interpretedTurn.patch,
        flow: activeFlow,
      } as Partial<IntakeFormData>;
      setInterpretationState(interpretedTurn.state);
      setIntakeData(semanticOnlyData);
      setPendingGrondenConfirmation(null);
      setPendingStepConfirmation(null);
      setPendingWooSubjectClarification(null);

      if (currentPromptCount >= 2) {
        const deferredIds = Array.from(new Set([...deferredStepIds, currentStep.id]));
        continueToNextRelevantStep({
          data: semanticOnlyData,
          interpretation: interpretedTurn.state,
          startIndex: currentStepIndex + 1,
          prefix: "Ik laat deze informatie even open en ga door naar het volgende punt. ",
          candidateDeferredIds: deferredIds,
        });
        setDeferredStepIds(getActiveDeferredStepIds(semanticOnlyData, deferredIds));
        setCurrentInput("");
        return;
      }

      incrementStepPromptCount(currentStep.id);
      addAssistantMessage(
        interpretedTurn.hasMeaningfulAdvance
          ? getContextualQuestion({
              flow: activeFlow,
              step: currentStep,
              interpretation: interpretedTurn.state,
              intakeData: semanticOnlyData,
            })
          : getStepRecoveryPrompt(currentStep, answer)
      );
      setCurrentInput("");
      return;
    }

    setInterpretationState(interpretedTurn.state);
    setIntakeData(updatedData);
    setPendingGrondenConfirmation(null);
    setPendingStepConfirmation(null);
    setPendingWooSubjectClarification(null);

    const followUp = needsFollowUp(updatedData as IntakeFormData, currentStep.id);

    if (followUp) {
      addAssistantMessage(followUp);
      setCurrentInput("");
      return;
    }

    continueToNextRelevantStep({
      data: updatedData,
      interpretation: interpretedTurn.state,
      startIndex: currentStepIndex + 1,
    });
    setCurrentInput("");
  };

  const handleSubmitAnswer = () => {
    if (submitInFlightRef.current) return;

    const trimmedInput = currentInput.trim();
    if (!trimmedInput) {
      setValidationError("Vul een antwoord in");
      return;
    }

    if (stage === "route_confirm") {
      processRouteConfirmation(trimmedInput);
      return;
    }

    if (!currentStep) {
      setValidationError("Er is geen actieve vraag om te beantwoorden.");
      return;
    }

    if (pendingStepConfirmation) {
      const normalizedConfirmation = trimmedInput.toLowerCase();

      if (confirmYesValues.has(normalizedConfirmation)) {
        const userMessage = buildUserMessage(trimmedInput);
        setMessages((prev) => [...prev, userMessage]);
        setPendingStepConfirmation(null);
        setValidationError("");
        processStepAnswer(pendingStepConfirmation.value);
        return;
      }

      if (confirmNoValues.has(normalizedConfirmation)) {
        const userMessage = buildUserMessage(trimmedInput);
        setMessages((prev) => [...prev, userMessage]);
        setPendingStepConfirmation(null);
        setValidationError("");
        incrementStepPromptCount(currentStep.id);
        addAssistantMessage(getStepRecoveryPrompt(currentStep, trimmedInput));
        setCurrentInput("");
        return;
      }

      setPendingStepConfirmation(null);
    }

    if (activeFlow === "woo" && currentStep.id === "onderwerp" && pendingWooSubjectClarification) {
      const userMessage = buildUserMessage(trimmedInput);
      setMessages((prev) => [...prev, userMessage]);

      const clarificationInterpretation = interpretWooSubjectAnswer(
        trimmedInput,
        pendingWooSubjectClarification.baseTopic
      );

      if (
        clarificationInterpretation.status === "valid" &&
        clarificationInterpretation.normalizedValue
      ) {
        setPendingWooSubjectClarification(null);
        setValidationError("");
        processStepAnswer(clarificationInterpretation.normalizedValue);
        return;
      }

      setValidationError(getValidationErrorMessage(currentStep, trimmedInput));
      incrementStepPromptCount(currentStep.id);
      setPendingWooSubjectClarification({
        baseTopic: pendingWooSubjectClarification.baseTopic,
        options: clarificationInterpretation.clarificationOptions
          ? [...clarificationInterpretation.clarificationOptions]
          : [...WOO_SUBJECT_CLARIFICATION_OPTIONS],
      });
      addAssistantMessage(
        clarificationInterpretation.clarificationPrompt ?? getStepRecoveryPrompt(currentStep, trimmedInput)
      );
      setCurrentInput("");
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

    if (activeFlow === "woo" && currentStep.id === "onderwerp") {
      const subjectInterpretation = interpretWooSubjectAnswer(trimmedInput);
      if (
        subjectInterpretation.status === "needs_clarification" &&
        subjectInterpretation.clarificationPrompt
      ) {
        const userMessage = buildUserMessage(trimmedInput);
        setMessages((prev) => [...prev, userMessage]);
        setPendingWooSubjectClarification({
          baseTopic: trimmedInput,
          options: subjectInterpretation.clarificationOptions
            ? [...subjectInterpretation.clarificationOptions]
            : [...WOO_SUBJECT_CLARIFICATION_OPTIONS],
        });
        setValidationError("");
        incrementStepPromptCount(currentStep.id);
        addAssistantMessage(subjectInterpretation.clarificationPrompt);
        setCurrentInput("");
        return;
      }
    }

    const interpretedTurn = interpretIntakeTurn({
      flow: activeFlow,
      latestUserMessage: trimmedInput,
      currentStep,
      intakeData,
      previousState: interpretationState,
    });
    const currentStepPatch = buildCurrentStepPatch(currentStep, trimmedInput, interpretedTurn.patch);
    const semanticPreviewData = {
      ...intakeData,
      ...interpretedTurn.patch,
      ...currentStepPatch,
      flow: activeFlow,
    } as Partial<IntakeFormData>;
    const isPureClarifyingQuestion =
      isLikelyClarifyingQuestion(trimmedInput) && !interpretedTurn.hasMeaningfulAdvance;
    const currentFieldWouldBeSatisfied =
      !isPureClarifyingQuestion && isChatStepSatisfied(currentStep, semanticPreviewData);
    const validationMessage =
      !currentFieldWouldBeSatisfied && !interpretedTurn.hasMeaningfulAdvance
        ? getContextualValidationMessage({
            flow: activeFlow,
            step: currentStep,
            interpretation: interpretedTurn.state,
          }) || getValidationErrorMessage(currentStep, trimmedInput)
        : "";

    if (validationMessage) {
      const currentPromptCount = stepPromptCounts[currentStep.id] ?? 1;

      if (currentPromptCount >= 2) {
        setValidationError("");
        const deferredIds = Array.from(new Set([...deferredStepIds, currentStep.id]));
        setInterpretationState(interpretedTurn.state);
        setIntakeData({
          ...intakeData,
          ...interpretedTurn.patch,
          flow: activeFlow,
        } as Partial<IntakeFormData>);
        continueToNextRelevantStep({
          data: {
            ...intakeData,
            ...interpretedTurn.patch,
            flow: activeFlow,
          } as Partial<IntakeFormData>,
          interpretation: interpretedTurn.state,
          startIndex: currentStepIndex + 1,
          prefix: "Ik laat dit punt heel even open en pak eerst het volgende onderdeel. ",
          candidateDeferredIds: deferredIds,
        });
        setCurrentInput("");
      } else {
        setValidationError(validationMessage);
        incrementStepPromptCount(currentStep.id);
        addAssistantMessage(getStepRecoveryPrompt(currentStep, trimmedInput));
        setCurrentInput("");
      }
      return;
    }

    if (currentStep.id === "periode") {
      const periodInterpretation = interpretWooPeriodAnswer(trimmedInput);
      if (
        periodInterpretation.status === "valid" &&
        periodInterpretation.normalizedValue &&
        periodInterpretation.confirmationPrompt
      ) {
        const userMessage = buildUserMessage(trimmedInput);
        setMessages((prev) => [...prev, userMessage]);
        setPendingStepConfirmation({
          stepId: currentStep.id,
          value: periodInterpretation.normalizedValue,
        });
        setCurrentInput("");
        setValidationError("");
        incrementStepPromptCount(currentStep.id);
        addAssistantMessage(periodInterpretation.confirmationPrompt);
        return;
      }
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
    const selectedFileIsPdf = isPdfFile(selectedFile);
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
    let serverExtractionFailed = false;

    setIsAnalyzingDocument(true);
    setDocumentAnalysisMessage("");
    setRouteCheckResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/extract-decision-meta", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as DecisionExtractionResult | { error?: string })
        : null;

      if (response.ok && payload && "extracted" in payload) {
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
      } else if (payload && "error" in payload && payload.error) {
        serverExtractionFailed = true;
        analysisNote = payload.error;
      } else if (!response.ok) {
        serverExtractionFailed = true;
        analysisNote =
          "Het besluit kon op de server niet goed worden verwerkt. Dit ligt niet per se aan uw PDF.";
      }
    } catch {
      serverExtractionFailed = true;
      analysisNote =
        "Het besluit kon technisch niet goed worden verwerkt. Dit ligt niet per se aan uw PDF.";
    }

    const hasServerReadableExtraction = hasReadableDecisionExtraction({
      datumBesluit: extractedDatumBesluit,
      kenmerk: extractedKenmerk,
      besluitSamenvatting: extractedSummary,
      besluitTekst: extractedText,
      besluitAnalyse: extractedAnalysis,
      besluitDocumentType: extractedDocumentType,
    });

    if (selectedFileIsPdf && !hasServerReadableExtraction) {
      try {
        const browserExtraction = await extractTextFromPdfInBrowser(selectedFile);
        extractedDatumBesluit = browserExtraction.datumBesluit ?? extractedDatumBesluit;
        extractedKenmerk = browserExtraction.kenmerk ?? extractedKenmerk;
        extractedText = browserExtraction.extractedText ?? extractedText;
        extractedSource = "pdf";
        extractedAnalysisStatus = browserExtraction.analysisStatus ?? extractedAnalysisStatus;
        extractedReadability = browserExtraction.readability ?? extractedReadability;

        if (browserExtraction.analysisStatus === "read") {
          analysisNote = serverExtractionFailed
            ? "De serveranalyse liep vast, maar de tekst is wel rechtstreeks uit uw PDF uitgelezen."
            : "";
        } else if (browserExtraction.analysisStatus === "partial") {
          analysisNote = serverExtractionFailed
            ? "De serveranalyse liep vast, maar ik kon wel een deel van de tekst rechtstreeks uit uw PDF lezen. Controleer de overgenomen gegevens goed."
            : "Ik kon wel een deel van de tekst rechtstreeks uit uw PDF lezen. Controleer de overgenomen gegevens goed.";
        } else if (!analysisNote) {
          analysisNote =
            "Deze PDF lijkt technisch lastig uitleesbaar. Upload zo nodig een scherpe foto of een doorzoekbare PDF.";
        }
      } catch {
        if (!analysisNote) {
          analysisNote =
            "Deze PDF kon niet automatisch worden uitgelezen. Upload zo nodig een scherpe foto of een doorzoekbare PDF.";
        }
      }
    }

    setIsAnalyzingDocument(false);
    setDocumentAnalysisMessage(analysisNote);

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

    if (supportsDecisionUpload(activeFlow)) {
      const hasReadableExtraction = hasReadableDecisionExtraction(updatedData);
      const assessment = hasReadableExtraction
        ? assessDecisionProcedure({
            selectedFlow: activeFlow,
            extraction: {
              datumBesluit: updatedData.datumBesluit ?? null,
              kenmerk: updatedData.kenmerk ?? null,
              samenvatting: updatedData.besluitSamenvatting ?? null,
              extractedText: updatedData.besluitTekst ?? null,
              analysisSource: updatedData.besluitBronType ?? null,
              documentType: updatedData.besluitDocumentType ?? null,
              decisionAnalysis: updatedData.besluitAnalyse ?? null,
              analysisStatus: updatedData.besluitAnalyseStatus,
              readability: updatedData.besluitLeeskwaliteit ?? null,
              extracted: hasReadableExtraction,
              warning: analysisNote || null,
            },
          })
        : null;
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
      const extractionLine =
        extractionNotes.length > 0
          ? ` Ik heb alvast ${extractionNotes.join(" en ")} uit het besluit gehaald.`
          : " Ik kon datum en kenmerk nog niet betrouwbaar uitlezen.";
      const procedureLine = assessment ? ` ${assessment.explanation}` : "";

      setRouteCheckResult(assessment);

      if (!assessment) {
        setIntakeData(updatedData);
        setStage("substantive");
        addAssistantMessage(
          `Bestand ontvangen${sourceLine} (${selectedFile.name}).${statusLine}${extractionLine}${summaryLine}${noteLine}`
        );
        return;
      }

      if (assessment.shouldAutoSwitch && assessment.suggestedFlow) {
        addAssistantMessage(
          `Bestand ontvangen${sourceLine} (${selectedFile.name}).${statusLine}${extractionLine}${summaryLine}${noteLine}${procedureLine}`
        );
        startSubstantiveFlow(assessment.suggestedFlow, {
          ...updatedData,
          procedureAdvies: assessment.suggestedFlow,
          procedureReden: assessment.explanation,
          procedureBevestigd: true,
        });
        return;
      }

      const nextData = {
        ...updatedData,
        procedureAdvies: assessment.suggestedFlow ?? activeFlow,
        procedureReden: assessment.explanation,
        procedureBevestigd: assessment.matchedSelectedFlow,
      } as Partial<IntakeFormData>;
      setIntakeData(nextData);

      if (questionsCompleted) {
        const completedExtractionLine =
          extractionNotes.length > 0
            ? ` Gevonden in het besluit: ${extractionNotes.join(", ")}.`
            : " Datum en kenmerk konden niet betrouwbaar uit het bestand worden gehaald.";
        addAssistantMessage(
          `Bestand ontvangen${sourceLine} (${selectedFile.name}). Je intake is voltooid. Klik op 'Naar Overzicht'.${statusLine}${completedExtractionLine}${summaryLine}${noteLine}${procedureLine}`
        );
        return;
      }

      if (assessment.shouldConfirmSwitch) {
        setStage("route_confirm");
        addAssistantMessage(
          `Bestand ontvangen${sourceLine} (${selectedFile.name}).${statusLine}${extractionLine}${summaryLine}${noteLine}`
        );
        addAssistantMessage(buildDecisionProcedureSwitchPrompt(assessment));
        return;
      }

      setStage("substantive");
      addAssistantMessage(
        `Bestand ontvangen${sourceLine} (${selectedFile.name}).${statusLine}${extractionLine}${summaryLine}${noteLine}${procedureLine}`
      );
      askFirstQuestionForCurrentFlow(nextData, "Nog een korte vraag om je brief op te bouwen: ");
      return;
    }

    setIntakeData(updatedData);

    if (questionsCompleted) {
      addAssistantMessage(`Bestand ontvangen (${selectedFile.name}). Je intake is voltooid. Klik op 'Naar Overzicht'.`);
    }
  };

  const handleContinue = () => {
    if (!isIntakeReady) return;
    const finalizedData = { ...intakeData, flow: activeFlow } as IntakeFormData;
    appStore.setIntakeData(finalizedData);
    sessionStorage.setItem("briefkompas_intake", JSON.stringify(finalizedData));
    router.push(`/review/${activeFlow}`);
  };

  const procedureSummaryLabel =
    routeCheckResult?.suggestedFlow ? getFlowActionLabel(routeCheckResult.suggestedFlow) : null;
  const shouldShowAnswerInput =
    stage === "route_confirm" ||
    (stage === "substantive" && hasDecisionFile && !questionsCompleted && currentStepIndex < steps.length);

  return (
    <div className="max-w-2xl mx-auto min-h-[78vh] flex flex-col justify-center">
      <Card>
        <StepHeader
          currentStep={visibleStepNumber}
          totalSteps={totalSteps}
          title="Intake"
        />

        {supportsDecisionUpload(activeFlow) && !isIntakeReady && (
          <div className="space-y-4">
            <UploadBox
              label={
                activeFlow === "zienswijze"
                  ? "Upload of fotografeer het ontwerpbesluit (verplicht)"
                  : "Upload of fotografeer je besluit (verplicht)"
              }
              accept="application/pdf,image/jpeg,image/png,image/webp"
              descriptionText={activeFlow === "zienswijze" ? "Sleep het ontwerpbesluit hier of" : "Sleep je besluit hier of"}
              actionText="maak een foto of kies een bestand"
              helperText="Op telefoon kun je direct een foto maken. Ondersteund: PDF, JPG, PNG en WEBP. Na upload controleert de tool eerst of de gekozen route waarschijnlijk klopt."
              capture="environment"
              disabled={isAnalyzingDocument}
              onFileSelect={handleFileSelect}
              uploadedFiles={intakeData.files?.besluit ? [intakeData.files.besluit] : []}
              required={requiresDecisionUpload(activeFlow)}
            />

            {!hasDecisionFile && !isAnalyzingDocument && (
              <Alert type="info" title="Eerst het document, daarna de vragen">
                Upload eerst het besluit of ontwerpbesluit. Daarna controleert de tool de route en gaat de intake verder.
              </Alert>
            )}

            {isAnalyzingDocument && (
              <Alert type="info" title="Besluit wordt geanalyseerd">
                We lezen datum, kenmerk en relevante tekst uit je bestand en controleren of bezwaar, beroep of zienswijze waarschijnlijk past.
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

        {routeCheckResult && (
          <Alert type={routeCheckResult.alertType} title={routeCheckResult.title}>
            {procedureSummaryLabel && (
              <span className="block font-semibold text-[var(--foreground)]">
                Waarschijnlijke route: {procedureSummaryLabel}
              </span>
            )}
            <span className="block pt-2">{routeCheckResult.explanation}</span>
            {routeCheckResult.shouldConfirmSwitch && (
              <span className="block pt-2 text-xs opacity-80">
                Bevestig hieronder of je wilt wisselen van route.
              </span>
            )}
          </Alert>
        )}

        <div className="bg-white rounded-xl border border-[var(--border)] p-4 mb-4 h-96 overflow-y-auto chat-container">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {shouldShowAnswerInput ? (
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
                {stage === "route_confirm" && (
                  <p className="text-xs text-[var(--muted)]">
                    Bevestig of je wilt overschakelen naar de voorgestelde route.
                  </p>
                )}
                {activeFlow === "woo" && currentStep?.id === "onderwerp" && pendingWooSubjectClarification && (
                  <p className="text-xs text-[var(--muted)]">
                    Kies wat het beste past, of typ zelf specifieker wat je inhoudelijk wilt achterhalen.
                  </p>
                )}
              </>
            )}
            {activeFlow === "woo" && currentStep?.id === "onderwerp" && pendingWooSubjectClarification && (
              <div className="flex flex-wrap gap-2">
                {pendingWooSubjectClarification.options.map((option) => (
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
        ) : null}

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
            disabled={
              isLoading ||
              (!hasDecisionFile && stage === "substantive") ||
              (stage === "substantive" && currentStepIndex === 0)
            }
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
