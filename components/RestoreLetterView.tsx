"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Alert, LoadingSpinner } from "@/components/Alerts";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Textarea } from "@/components/Textarea";
import type { LoadLetterResponse } from "@/lib/temporaryLetterStorageTypes";

interface RestoreLetterViewProps {
  id: string;
  token: string | null;
}

function formatExpiresAt(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RestoreLetterView({ id, token }: RestoreLetterViewProps) {
  const [content, setContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    let isActive = true;

    const loadLetter = async () => {
      if (!token) {
        setErrorMessage("Deze herstel-link is onvolledig. Controleer of het token in de link staat.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch("/api/load-letter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, token }),
        });

        const payload = (await response.json()) as LoadLetterResponse | { error?: string };
        if (!response.ok || !("content" in payload)) {
          throw new Error(payload && "error" in payload ? payload.error : "De brief kon niet worden opgehaald.");
        }

        if (!isActive) {
          return;
        }

        setContent(payload.content);
        setExpiresAt(payload.expires_at);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "De brief kon niet worden opgehaald."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadLetter();

    return () => {
      isActive = false;
    };
  }, [id, token]);

  const formattedExpiry = useMemo(
    () => (expiresAt ? formatExpiresAt(expiresAt) : ""),
    [expiresAt]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("error");
    }
  };

  if (isLoading) {
    return (
      <Card title="Brief herstellen" subtitle="We halen je tijdelijke concept op.">
        <LoadingSpinner />
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <Alert type="error" title="Herstellen lukt niet">
          {errorMessage}
        </Alert>
        <Link
          href="/"
          className="inline-flex rounded-xl bg-[var(--brand)] px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)]"
        >
          Start opnieuw
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert type="success" title="Je brief is teruggevonden.">
        Deze tijdelijke opslag blijft geldig tot {formattedExpiry}.
      </Alert>

      <Card
        title="Herstelde brief"
        subtitle="Controleer de inhoud en kopieer de tekst terug naar de editor als je verder wilt werken."
      >
        <div className="space-y-4">
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[32rem] text-[15px] leading-7 text-[var(--foreground)]"
          />

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleCopy}>
              {copyState === "done" ? "Brief gekopieerd" : "Kopieer brief"}
            </Button>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2.5 text-base font-semibold text-[var(--foreground)] shadow-sm transition hover:border-[var(--ring)] hover:bg-white hover:shadow-md"
            >
              Terug naar start
            </Link>
          </div>

          {copyState === "error" && (
            <p className="text-sm text-red-700">
              Kopieren lukt in deze browser niet automatisch. Selecteer de tekst dan handmatig.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
