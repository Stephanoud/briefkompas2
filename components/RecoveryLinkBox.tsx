"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alerts";

interface RecoveryLinkBoxProps {
  recoveryUrl: string;
  expiresAt: string;
}

function formatExpiresAt(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function RecoveryLinkBox({ recoveryUrl, expiresAt }: RecoveryLinkBoxProps) {
  const [copied, setCopied] = useState(false);
  const formattedExpiry = useMemo(() => formatExpiresAt(expiresAt), [expiresAt]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4 rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5">
      <Alert type="success" title="Je brief is tijdelijk opgeslagen.">
        De herstel-link blijft geldig tot {formattedExpiry}.
      </Alert>

      <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Herstel-link</p>
        <p className="mt-2 break-all text-sm leading-6 text-[var(--foreground)]">{recoveryUrl}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleCopy}>
          {copied ? "Herstel-link gekopieerd" : "Kopieer herstel-link"}
        </Button>
      </div>

      <p className="text-sm leading-6 text-emerald-900">
        Bewaar deze herstel-link goed. Zonder deze link kunnen we je brief niet terughalen.
      </p>
    </div>
  );
}
