"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { UploadBox } from "@/components/UploadBox";
import { Alert } from "@/components/index";
import { Flow, Product, UploadedFileRef } from "@/types";
import { getPriceFormatted } from "@/lib/utils";

interface PricingPageProps {
  params: { flow: Flow };
}

export default function PricingPage({ params }: PricingPageProps) {
  const router = useRouter();
  const flow = params.flow as Flow;
  const appStore = useAppStore();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bijlagen, setBijlagen] = useState<UploadedFileRef[]>([]);
  const [error, setError] = useState("");

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    appStore.setProduct(product);
  };

  const handleBijagenSelect = (files: File[]) => {
    if (selectedProduct === "basis") {
      setError("Bijlagen zijn alleen beschikbaar in het Uitgebreid pakket");
      return;
    }

    if (files.length + bijlagen.length > 5) {
      setError("Maximaal 5 bijlagen per bestelling");
      return;
    }

    const newBijlagen = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      path: URL.createObjectURL(file),
    }));

    setBijlagen((prev) => [...prev, ...newBijlagen]);
    setError("");
  };

  const handleRemoveBijlage = (path: string) => {
    setBijlagen((prev) => prev.filter((b) => b.path !== path));
  };

  const handleContinue = async () => {
    if (!selectedProduct) {
      setError("Selecteer een pakket");
      return;
    }

    // Update store with bijlagen
    appStore.setIntakeData({
      ...appStore.intakeData!,
      files: {
        ...appStore.intakeData?.files,
        bijlagen,
      },
    });

    // Create Stripe checkout session
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow,
          product: selectedProduct,
        }),
      });

      const data = await response.json();
      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.error || "Fout bij het creeren van checkout sessie");
      }
    } catch {
      setError("Er ging iets fout. Probeer opnieuw.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kies je pakket</h1>
        <p className="text-gray-600">
          Selecteer het pakket dat het beste bij je behoeften past
        </p>
      </div>

      {error && <Alert type="error" title="Fout">{error}</Alert>}

      {/* Product Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Basis */}
        <Card
          className={`cursor-pointer transition-all ${
            selectedProduct === "basis"
              ? "ring-2 ring-blue-500 bg-blue-50"
              : "hover:shadow-lg"
          }`}
          onClick={() => handleSelectProduct("basis")}
        >
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-gray-900">Basis</h3>
            <p className="text-3xl font-bold text-blue-600">
              {getPriceFormatted("basis")}
            </p>
            <p className="text-sm text-gray-600">eenmalige betaling</p>
          </div>

          <div className="space-y-3 mb-6">
            <h4 className="font-semibold text-gray-900">Inclusief:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Geleide chatbot intake</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>1 PDF-upload (besluit)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>
                  Standaard {flow === "bezwaar" ? "bezwaarbrief" : "WOO-verzoek"}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Download als .docx</span>
              </li>
            </ul>
          </div>

          <Button
            variant={selectedProduct === "basis" ? "primary" : "secondary"}
            className="w-full"
          >
            {selectedProduct === "basis" ? "Geselecteerd" : "Selecteer"}
          </Button>
        </Card>

        {/* Uitgebreid */}
        <Card
          className={`cursor-pointer transition-all ${
            selectedProduct === "uitgebreid"
              ? "ring-2 ring-blue-500 bg-blue-50"
              : "hover:shadow-lg"
          }`}
          onClick={() => handleSelectProduct("uitgebreid")}
        >
          <div className="mb-4">
            <div className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold mb-2">
              AANBEVOLEN
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Uitgebreid</h3>
            <p className="text-3xl font-bold text-blue-600">
              {getPriceFormatted("uitgebreid")}
            </p>
            <p className="text-sm text-gray-600">eenmalige betaling</p>
          </div>

          <div className="space-y-3 mb-6">
            <h4 className="font-semibold text-gray-900">Alles van Basis, plus:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-blue-600">+</span>
                <span>Tot 5 bijlagen</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">+</span>
                <span>Samenvatting van besluit</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">+</span>
                <span>Bijlagenoverzicht in brief</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-600">+</span>
                <span>Editable jurisprudentikolom</span>
              </li>
            </ul>
          </div>

          <Button
            className="w-full"
            variant={selectedProduct === "uitgebreid" ? "primary" : "secondary"}
          >
            {selectedProduct === "uitgebreid" ? "Geselecteerd" : "Selecteer"}
          </Button>
        </Card>
      </div>

      {/* Extra Bijlagen Upload (only for uitgebreid) */}
      {selectedProduct === "uitgebreid" && (
        <Card title="Optionele extra bijlagen" subtitle="Tot 5 bestanden">
          <UploadBox
            label="Upload extra bijlagen (PDF's)"
            accept=".pdf"
            multiple
            maxSize={25 * 1024 * 1024}
            onFileSelect={handleBijagenSelect}
            uploadedFiles={bijlagen}
          />

          {bijlagen.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                {bijlagen.length} bijlage(n) geselecteerd
              </p>
              <ul className="space-y-1">
                {bijlagen.map((file) => (
                  <li key={file.path} className="flex justify-between items-center text-sm">
                    <span className="text-blue-800">{file.name}</span>
                    <button
                      onClick={() => handleRemoveBijlage(file.path)}
                      className="text-red-600 hover:text-red-700 font-semibold"
                    >
                      Verwijderen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 mt-8">
        <Button
          variant="secondary"
          onClick={() => router.back()}
          className="flex-1"
        >
          Terug
        </Button>
        <Button onClick={handleContinue} disabled={!selectedProduct} className="flex-1">
          Ga naar betaling →
        </Button>
      </div>
    </div>
  );
}

