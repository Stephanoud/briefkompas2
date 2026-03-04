import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import Container from "@/components/Container";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "BriefKompas.nl - Bezwaarbrief & WOO-verzoek Generator",
  description:
    "Genereer professionele bezwaarschriften en WOO-verzoeken met AI-ondersteuning. Geen juridisch advies, wel begeleiding.",
  keywords: ["bezwaar", "woo", "brief", "overheid", "verzoek"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} antialiased`}
      >
        <div className="min-h-screen flex flex-col">
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

              <Link
                href="/start-bezwaar"
                className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--brand)] px-5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]"
              >
                Start bezwaar
              </Link>
            </Container>
          </header>

          <main className="flex-1 w-full py-8 sm:py-10">{children}</main>

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
        </div>
      </body>
    </html>
  );
}
