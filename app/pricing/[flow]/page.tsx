"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { UploadBox } from "@/components/UploadBox";
import { Alert } from "@/components/index";
import { Flow, IntakeFormData, Product, UploadedFileRef } from "@/types";
import { getPriceFormatted, TEST_PRICING_LABEL } from "@/lib/utils";

const toFlow = (value: unknown): Flow | null =>
  value === "bezwaar" || value === "woo" ? value : null;

const toProduct = (value: unknown): Product | null =>
  value === "basis" || value === "uitgebreid" ? value : null;

export default function PricingPage() {
  const router = useRouter();
  const routeParams = useParams<{ flow?: string }>();
  const appStore = useAppStore();

  const routeFlow = toFlow(routeParams?.flow);
  const activeFlow = routeFlow || toFlow(appStore.flow);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() =>
    toProduct(appStore.product)
  );
  const [bijlagen, setBijlagen] = useState<UploadedFileRef[]>([]);
  const [error, setError] = useState("");

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    appStore.setProduct(product);
    setError("");
  };

  const handleBijlagenSelect = (files: File[]) => {
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
    const checkoutProduct = selectedProduct || toProduct(appStore.product);
    if (!checkoutProduct) {
      setError("Selecteer een pakket");
      return;
    }

    const checkoutFlow = activeFlow;
    if (!checkoutFlow) {
      setError("Je sessie mist het type traject. Ga een stap terug en probeer opnieuw.");
      return;
    }

    const cachedIntake =
      typeof window !== "undefined" ? sessionStorage.getItem("briefkompas_intake") : null;
    let parsedCachedIntake: Partial<IntakeFormData> = {};

    if (cachedIntake) {
      try {
        parsedCachedIntake = JSON.parse(cachedIntake) as Partial<IntakeFormData>;
      } catch {
        parsedCachedIntake = {};
      }
    }

    const mergedIntakeData: Partial<IntakeFormData> = {
      ...parsedCachedIntake,
      ...appStore.intakeData,
      flow: checkoutFlow,
      files: {
        ...parsedCachedIntake.files,
        ...appStore.intakeData?.files,
        bijlagen,
      },
    };

    appStore.setIntakeData(mergedIntakeData as IntakeFormData);
    sessionStorage.setItem("briefkompas_intake", JSON.stringify(mergedIntakeData));

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: checkoutFlow,
          product: checkoutProduct,
          selectedProduct: checkoutProduct,
        }),
      });

      const data = await response.json();
      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.error || "Fout bij het aanmaken van de checkout sessie");
      }
    } catch {
      setError("Er ging iets fout. Probeer opnieuw.");
    }
  };

  const flowLabel =
    activeFlow === "bezwaar" ? "bezwaarbrief" : activeFlow === "woo" ? "WOO-verzoek" : "brief";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kies je pakket</h1>
        <p className="text-gray-600">Selecteer het pakket dat het beste bij je behoeften past</p>
      </div>

      {!activeFlow && (
        <Alert type="error" title="Fout">
          Het type traject ontbreekt in deze sessie. Ga terug naar het overzicht en kies opnieuw.
        </Alert>
      )}

      {error && (
        <Alert type="error" title="Fout">
          {error}
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card
          className={`cursor-pointer transition-all ${
            selectedProduct === "basis" ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-lg"
          }`}
          onClick={() => handleSelectProduct("basis")}
        >
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-gray-900">Basis</h3>
            <p className="text-3xl font-bold text-blue-600">{getPriceFormatted("basis")}</p>
            <p className="text-sm text-gray-600">eenmalige betaling - {TEST_PRICING_LABEL}</p>
          </div>

          <div className="space-y-3 mb-6">
            <h4 className="font-semibold text-gray-900">Inclusief:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-600">&#10003;</span>
                <span>Geleide chatbot intake</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">&#10003;</span>
                <span>1 PDF-upload (besluit)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">&#10003;</span>
                <span>Standaard {flowLabel}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">&#10003;</span>
                <span>Download als .docx</span>
              </li>
            </ul>
          </div>

          <Button variant={selectedProduct === "basis" ? "primary" : "secondary"} className="w-full">
            {selectedProduct === "basis" ? "Geselecteerd" : "Selecteer"}
          </Button>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            selectedProduct === "uitgebreid" ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-lg"
          }`}
          onClick={() => handleSelectProduct("uitgebreid")}
        >
          <div className="mb-4">
            <div className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold mb-2">
              AANBEVOLEN
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Uitgebreid</h3>
            <p className="text-3xl font-bold text-blue-600">{getPriceFormatted("uitgebreid")}</p>
            <p className="text-sm text-gray-600">eenmalige betaling - {TEST_PRICING_LABEL}</p>
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
                <span>Editable jurisprudentiekolom</span>
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

      {selectedProduct === "uitgebreid" && (
        <Card title="Optionele extra bijlagen" subtitle="Tot 5 bestanden">
          <UploadBox
            label="Upload extra bijlagen (PDF's)"
            accept=".pdf"
            multiple
            maxSize={25 * 1024 * 1024}
            onFileSelect={handleBijlagenSelect}
            uploadedFiles={bijlagen}
          />

          {bijlagen.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">{bijlagen.length} bijlage(n) geselecteerd</p>
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

      <div className="flex gap-4 mt-8">
        <Button variant="secondary" onClick={() => router.back()} className="flex-1">
          Terug
        </Button>
        <Button onClick={handleContinue} disabled={!selectedProduct || !activeFlow} className="flex-1">
          Ga naar betaling
        </Button>
      </div>
    </div>
  );
}
