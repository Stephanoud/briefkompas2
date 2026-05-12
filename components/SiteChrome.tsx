"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Container from "@/components/Container";
import { StorageConsentBanner } from "@/components/StorageConsentBanner";

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="min-h-screen flex flex-col">
      {!isLoginPage && (
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/85 backdrop-blur-md">
          <Container className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-md bg-[var(--foreground)] text-white text-sm font-semibold inline-flex items-center justify-center">
                BK
              </span>
              <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                BriefKompas.nl
              </span>
            </Link>

            <nav className="hidden sm:flex items-center justify-center gap-7 text-sm text-[var(--muted)]">
              <Link href="/#hoe-het-werkt" className="hover:text-[var(--foreground)]">
                Hoe het werkt
              </Link>
              <Link href="/faq" className="hover:text-[var(--foreground)]">
                FAQ
              </Link>
              <Link href="/disclaimer" className="hover:text-[var(--foreground)]">
                Disclaimer
              </Link>
            </nav>

            <div className="flex items-center justify-end gap-2">
              <Link
                href="/api/test-logout"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Uitloggen
              </Link>
              <Link
                href="/start-brief"
                className="cta-button-link inline-flex h-10 items-center justify-center rounded-md bg-[var(--brand)] px-5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]"
              >
                Start brief
              </Link>
            </div>
          </Container>
        </header>
      )}

      <main className={isLoginPage ? "flex-1 w-full" : "flex-1 w-full py-8 sm:py-10"}>{children}</main>
      {!isLoginPage && <StorageConsentBanner />}

      {!isLoginPage && (
        <footer className="w-full border-t border-[var(--border)] bg-white/70">
          <Container className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">BriefKompas.nl</p>
                <p className="text-sm text-[var(--muted)]">
                  AI-gestuurde self-service tool voor bezwaar- en WOO-brieven.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-[var(--muted)]">
                <Link href="/privacy" className="hover:text-[var(--foreground)]">
                  Privacy
                </Link>
                <Link href="/over" className="hover:text-[var(--foreground)]">
                  Over
                </Link>
                <a href="mailto:info@briefkompas.nl" className="hover:text-[var(--foreground)]">
                  Contact
                </a>
              </div>
            </div>

            <p className="mt-6 border-t border-[var(--border)] pt-4 text-center text-sm text-[var(--muted)]">
              Copyright 2026 BriefKompas.nl. Alle rechten voorbehouden.
            </p>
          </Container>
        </footer>
      )}
    </div>
  );
}
