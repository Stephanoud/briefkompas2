import React from "react";
import Link from "next/link";

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(245,248,246,0.84)] backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand)] shadow-sm flex items-center justify-center">
            <span className="text-white font-bold text-sm">BK</span>
          </div>
          <span className="text-xl font-semibold text-[var(--foreground)]">BriefKompas.nl</span>
        </Link>

        <nav className="hidden sm:flex gap-8">
          <Link href="/pricing" className="text-[var(--muted)] hover:text-[var(--brand-strong)]">
            Prijzen
          </Link>
          <Link href="/#faq" className="text-[var(--muted)] hover:text-[var(--brand-strong)]">
            FAQ
          </Link>
          <Link href="/disclaimer" className="text-[var(--muted)] hover:text-[var(--brand-strong)]">
            Disclaimer
          </Link>
        </nav>
      </div>
    </header>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[var(--surface-soft)] border-t border-[var(--border)] py-8 mt-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-4">BriefKompas.nl</h4>
            <p className="text-sm text-[var(--muted)]">
              AI-gestuurde self-service tool voor bezwaarschriften en WOO-verzoeken.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-4">Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/disclaimer" className="text-[var(--muted)] hover:text-[var(--brand-strong)]">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[var(--muted)] hover:text-[var(--brand-strong)]">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/over" className="text-[var(--muted)] hover:text-[var(--brand-strong)]">
                  Over
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-[var(--foreground)] mb-4">Contact</h4>
            <p className="text-sm text-[var(--muted)]">info@briefkompas.nl</p>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--muted)] text-center">
            Copyright 2026 BriefKompas.nl. Alle rechten voorbehouden.
          </p>
        </div>
      </div>
    </footer>
  );
};
