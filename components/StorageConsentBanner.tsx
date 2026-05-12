"use client";

import { useState } from "react";
import Link from "next/link";
import {
  readStorageConsent,
  setStorageConsent,
  type StorageConsent,
} from "@/lib/browser-persistence";
import { Button } from "@/components/Button";

export function StorageConsentBanner() {
  const [consent, setConsent] = useState<StorageConsent | null>(() => readStorageConsent());

  if (consent) {
    return null;
  }

  const choose = (value: StorageConsent) => {
    setStorageConsent(value);
    setConsent(value);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-white/95 px-4 py-4 shadow-[0_-18px_45px_rgba(18,35,31,0.12)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl text-sm leading-6 text-[var(--muted-strong)]">
          <p className="font-semibold text-[var(--foreground)]">Voortgang bewaren in je browser?</p>
          <p>
            We gebruiken noodzakelijke sessie-opslag om de intake te laten werken. Met toestemming bewaren
            we je intake ook lokaal in deze browser, zodat teruggaan of later verdergaan je invoer behoudt.
            We plaatsen geen trackingcookies en zetten inhoudelijke zaakdata niet in cookies.
          </p>
          <Link href="/privacy" className="text-[var(--brand)] underline underline-offset-4">
            Lees het cookie- en opslagbeleid
          </Link>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => choose("declined")}>
            Alleen deze sessie
          </Button>
          <Button type="button" onClick={() => choose("accepted")}>
            Bewaar voortgang
          </Button>
        </div>
      </div>
    </div>
  );
}
