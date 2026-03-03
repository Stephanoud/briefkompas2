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
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
            <Container className="flex items-center justify-between py-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-md bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center">
                  BK
                </span>
                <span className="text-sm font-semibold tracking-tight text-slate-900">
                  BriefKompas.nl
                </span>
              </Link>

              <nav className="hidden sm:flex items-center gap-7 text-sm text-slate-600">
                <Link href="/#prijzen" className="hover:text-slate-900">
                  Prijzen
                </Link>
                <Link href="/#faq" className="hover:text-slate-900">
                  FAQ
                </Link>
                <Link href="/disclaimer" className="hover:text-slate-900">
                  Disclaimer
                </Link>
              </nav>

              <Link
                href="/start-bezwaar"
                className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                Start bezwaar
              </Link>
            </Container>
          </header>

          <main className="flex-1 w-full py-10">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
          </main>

          <footer className="w-full border-t border-slate-200 bg-slate-50">
            <Container className="py-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">BriefKompas.nl</p>
                  <p className="text-sm text-slate-600">
                    AI-gestuurde self-service tool voor bezwaar- en WOO-brieven.
                  </p>
                </div>

                <div className="flex items-center gap-5 text-sm text-slate-600">
                  <Link href="/privacy" className="hover:text-slate-900">
                    Privacy
                  </Link>
                  <Link href="/over" className="hover:text-slate-900">
                    Over
                  </Link>
                  <a href="mailto:info@briefkompas.nl" className="hover:text-slate-900">
                    Contact
                  </a>
                </div>
              </div>

              <p className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
                Copyright 2026 BriefKompas.nl. Alle rechten voorbehouden.
              </p>
            </Container>
          </footer>
        </div>
      </body>
    </html>
  );
}
