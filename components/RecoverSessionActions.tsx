"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { writeStoredGeneratedLetter } from "@/lib/generatedLetterSession";
import { writeStoredResultDraft } from "@/lib/resultDraftSession";
import { useAppStore } from "@/lib/store";
import { RecoveredLetterSessionPayload } from "@/lib/saved-letters/types";

interface RecoverSessionActionsProps {
  payload: RecoveredLetterSessionPayload;
}

export function RecoverSessionActions({ payload }: RecoverSessionActionsProps) {
  const router = useRouter();
  const [isRestoring, setIsRestoring] = useState(false);
  const setFlow = useAppStore((state) => state.setFlow);
  const setProduct = useAppStore((state) => state.setProduct);
  const setIntakeData = useAppStore((state) => state.setIntakeData);
  const setGeneratedLetter = useAppStore((state) => state.setGeneratedLetter);

  const handleRestore = async () => {
    setIsRestoring(true);

    try {
      sessionStorage.setItem("briefkompas_intake", JSON.stringify(payload.intakeData));

      if (payload.product) {
        sessionStorage.setItem("briefkompas_product", payload.product);
        setProduct(payload.product);
      } else {
        sessionStorage.removeItem("briefkompas_product");
      }

      setFlow(payload.flow);
      setIntakeData(payload.intakeData);
      setGeneratedLetter(payload.generatedLetter);
      writeStoredGeneratedLetter(payload.flow, payload.generatedLetter);
      writeStoredResultDraft(payload.flow, payload.manualReferences);

      router.push(`/result/${payload.flow}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" onClick={handleRestore} isLoading={isRestoring}>
        Verder met deze brief
      </Button>
      <Button type="button" variant="secondary" onClick={() => router.push("/")}>
        Start opnieuw
      </Button>
    </div>
  );
}
