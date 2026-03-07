"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { LoadingSpinner, Alert } from "@/components/index";
import { Flow } from "@/types";

export default function GeneratePage() {
  const router = useRouter();
  const params = useParams<{ flow: string }>();
  const rawFlow = params?.flow;
  const flow = (Array.isArray(rawFlow) ? rawFlow[0] : rawFlow) as Flow;
  const appStore = useAppStore();

  useEffect(() => {
    const generateLetter = async () => {
      try {
        appStore.setLoading(true);
        appStore.setError(null);

        const response = await fetch("/api/generate-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intakeData: appStore.intakeData,
            product: appStore.product,
            flow,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Fout bij genereren brief");
        }

        appStore.setGeneratedLetter(data.letter);
        appStore.setLoading(false);

        router.push(`/result/${flow}`);
      } catch (error) {
        appStore.setError(
          error instanceof Error ? error.message : "Er ging iets fout"
        );
        appStore.setLoading(false);
      }
    };

    generateLetter();
  }, []);

  if (appStore.error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <Alert type="error" title="Fout bij genereren">
            {appStore.error}
          </Alert>
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
