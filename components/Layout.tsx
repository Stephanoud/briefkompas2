import React from "react";
import Link from "next/link";

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">BK</span>
          </div>
          <span className="text-xl font-bold text-gray-900">BriefKompas.nl</span>
        </Link>

        <nav className="hidden sm:flex gap-8">
          <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
            Prijzen
          </Link>
          <Link href="/#faq" className="text-gray-600 hover:text-gray-900">
            FAQ
          </Link>
          <Link href="/disclaimer" className="text-gray-600 hover:text-gray-900">
            Disclaimer
          </Link>
        </nav>
      </div>
    </header>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">BriefKompas.nl</h4>
            <p className="text-sm text-gray-600">
              AI-gestuurde self-service tool voor bezwaarschriften en WOO-verzoeken.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/disclaimer" className="text-gray-600 hover:text-gray-900">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-600 hover:text-gray-900">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/over" className="text-gray-600 hover:text-gray-900">
                  Over
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Contact</h4>
            <p className="text-sm text-gray-600">
              info@briefkompas.nl
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            © 2024 BriefKompas.nl. Alle rechten voorbehouden.
          </p>
        </div>
      </div>
    </footer>
  );
};
