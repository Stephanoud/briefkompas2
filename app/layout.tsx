import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Layout";

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
        <div className="flex flex-col min-h-screen">
          {/* Global Sticky Header */}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white text-sm font-semibold">
                  BK
                </div>
                <span className="text-sm font-semibold tracking-tight">BriefKompas.nl</span>
              </div>

              <nav className="hidden items-center gap-6 text-sm text-slate-600 sm:flex">
                <a href="#prijzen" className="hover:text-slate-900">
                  Prijzen
                </a>
                <a href="#faq" className="hover:text-slate-900">
                  FAQ
                </a>
                <a href="/disclaimer" className="hover:text-slate-900">
                  Disclaimer
                </a>
              </nav>

              <div className="flex items-center gap-2">
                <a
                  href="/start-bezwaar"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Start bezwaar
                </a>
              </div>
            </div>
          </header>

          <main className="flex-1 w-full">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
