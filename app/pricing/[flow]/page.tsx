"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getFlowDocumentLabel, getFlowLabel, isFlow, supportsDecisionUpload } from "@/lib/flow";
import { extractTextFromPdfInBrowser } from "@/lib/client-pdf-extraction";
import { getAttachmentKindLabel, inferAttachmentKind } from "@/lib/intake/procedural-attachments";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert, UploadBox } from "@/components/index";
import { Flow, IntakeFormData, Product, UploadedFileRef } from "@/types";
import { getPriceFormatted, TEST_PRICING_LABEL } from "@/lib/utils";

const toFlow = (value: unknown): Flow | null => (isFlow(value) ? value : null);

const toProduct = (value: unknown): Product | null =>
  value === "basis" || value === "uitgebreid" ? value : null;

function getStoredProduct(): Product | null {
  if (typeof window === "undefined") {
    return null;
  }

  return toProduct(sessionStorage.getItem("briefkompas_product"));
}

function getStoredBijlagen(): UploadedFileRef[] {
  if (typeof window === "undefined") {
    return [];
  }

  const cachedIntake = sessionStorage.getItem("briefkompas_intake");
  if (!cachedIntake) {
    return [];
  }

  try {
    const parsed = JSON.parse(cachedIntake) as Partial<IntakeFormData>;
    return parsed.files?.bijlagen ?? [];
  } catch {
    return [];
  }
}

function trimExtractedAttachmentText(value?: string | null, maxLength = 4000): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export default function PricingPage() {
  const router = useRouter();
  const routeParams = useParams<{ flow?: string }>();
  const appStore = useAppStore();

  const routeFlow = toFlow(routeParams?.flow);
  const activeFlow = routeFlow || toFlow(appStore.flow);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() =>
    toProduct(appStore.product) ?? getStoredProduct()
  );
  const [bijlagen, setBijlagen] = useState<UploadedFileRef[]>(
    () => appStore.intakeData?.files?.bijlagen ?? getStoredBijlagen()
  );
  const [isAnalyzingBijlagen, setIsAnalyzingBijlagen] = useState(false);
  const [error, setError] = useState("");

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    appStore.setProduct(product);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("briefkompas_product", product);
    }
    setError("");
  };

  const handleBijlagenSelect = async (files: File[]) => {
    if (selectedProduct === "basis") {
      setError("Bijlagen zijn alleen beschikbaar in het Uitgebreid pakket");
      return;
    }

    if (files.length + bijlagen.length > 5) {
      setError("Maximaal 5 bijlagen per bestelling");
      return;
    }

    setIsAnalyzingBijlagen(true);
    try {
      const newBijlagen = await Promise.all(
        files.map(async (file) => {
          let extractedText: string | undefined;

          try {
            const extraction = await extractTextFromPdfInBrowser(file);
            extractedText = trimExtractedAttachmentText(extraction.extractedText);
          } catch {
            extractedText = undefined;
          }

          return {
            name: file.name,
            size: file.size,
            type: file.type,
            path: URL.createObjectURL(file),
            extractedText,
            attachmentKind: inferAttachmentKind({
              name: file.name,
              extractedText,
            }),
          } satisfies UploadedFileRef;
        })
      );

      setBijlagen((prev) => [...prev, ...newBijlagen]);
      setError("");
    } finally {
      setIsAnalyzingBijlagen(false);
    }
  };

  const handleRemoveBijlage = (path: string) => {
    setBijlagen((prev) => prev.filter((b) => b.path !== path));
  };

  const prepareCheckoutContext = () => {
    const checkoutProduct = selectedProduct || toProduct(appStore.product);
    if (!checkoutProduct) {
      setError("Selecteer een pakket");
      return null;
    }

    const checkoutFlow = activeFlow;
    if (!checkoutFlow) {
      setError("Je sessie mist het type traject. Ga een stap terug en probeer opnieuw.");
      return null;
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
    appStore.setProduct(checkoutProduct);
    sessionStorage.setItem("briefkompas_intake", JSON.stringify(mergedIntakeData));
    sessionStorage.setItem("briefkompas_product", checkoutProduct);
    setError("");

    return {
      checkoutFlow,
      checkoutProduct,
    };
  };

  const handleContinueToPayment = async () => {
    const checkoutContext = prepareCheckoutContext();
    if (!checkoutContext) {
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow: checkoutContext.checkoutFlow,
          product: checkoutContext.checkoutProduct,
          selectedProduct: checkoutContext.checkoutProduct,
        }),
      });

      const data = await response.json();
      if (response.ok && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        setError(data.error || "Fout bij het aanmaken van de checkout sessie");
      }
    } catch {
      setError("Er ging iets fout. Probeer opnieuw.");
    }
  };

  const handleContinueToTestVersion = () => {
    const checkoutContext = prepareCheckoutContext();
    if (!checkoutContext) {
      return;
    }

    router.push(`/checkout/success?flow=${checkoutContext.checkoutFlow}&bypass_payment=1`);
  };

  const flowLabel = activeFlow ? getFlowDocumentLabel(activeFlow) : "brief";
  const standardLetterLabel =
    activeFlow === "bezwaar"
      ? "Bezwaarschrift met dossierbijlage"
      : activeFlow === "beroep_zonder_bezwaar"
        ? "Beroepschrift met toelichting op direct beroep"
        : activeFlow === "beroep_na_bezwaar"
          ? "Beroepschrift tegen beslissing op bezwaar"
          : activeFlow === "zienswijze"
            ? "Zienswijze in formele bestuursrechtelijke structuur"
            : `Standaard ${flowLabel}`;
  const expandedFeatureLabel =
    activeFlow === "bezwaar"
      ? "Tot 5 extra dossierstukken"
      : activeFlow === "woo"
        ? "Bijlagenoverzicht in brief"
        : "Extra onderbouwing en bijlagenoverzicht";
  const decisionUploadLabel =
    activeFlow && supportsDecisionUpload(activeFlow)
      ? "1 besluit-upload (PDF of foto)"
      : "Geen besluit-upload vereist";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kies je pakket</h1>
        <p className="text-gray-600">
          Selecteer het pakket dat het beste past bij je {activeFlow ? getFlowLabel(activeFlow) : "traject"}.
        </p>
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
                <span>{decisionUploadLabel}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">&#10003;</span>
                <span>{standardLetterLabel}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">&#10003;</span>
                <span>Download als PDF en DOCX</span>
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
                <span>{expandedFeatureLabel}</span>
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
            helperText="Upload bij beroep bij voorkeur ook je eerdere bezwaarbrief, nadere bezwaargronden of zienswijze. Als zo'n stuk herkenbaar is, nemen we die context mee naast het besluit."
            onFileSelect={handleBijlagenSelect}
            uploadedFiles={bijlagen}
            disabled={isAnalyzingBijlagen}
          />

          {isAnalyzingBijlagen && (
            <Alert type="info" title="Bijlagen worden geanalyseerd">
              We kijken of een geuploade bijlage waarschijnlijk een bezwaarbrief, zienswijze of ander relevant processtuk is.
            </Alert>
          )}

          {bijlagen.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">{bijlagen.length} bijlage(n) geselecteerd</p>
              <ul className="space-y-1">
                {bijlagen.map((file) => (
                  <li key={file.path} className="flex justify-between items-center text-sm">
                    <span className="text-blue-800">
                      {file.name}
                      {getAttachmentKindLabel(file.attachmentKind) && (
                        <span className="ml-2 text-xs text-blue-600">
                          ({getAttachmentKindLabel(file.attachmentKind)})
                        </span>
                      )}
                    </span>
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

      <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-5 py-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">Test versie</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Gebruik deze route als je de flow wilt controleren zonder Stripe-betaling. De gekozen productvariant blijft wel actief.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 md:flex-row">
        <Button variant="secondary" onClick={() => router.back()} className="flex-1">
          Terug
        </Button>
        <Button
          onClick={handleContinueToPayment}
          disabled={!selectedProduct || !activeFlow || isAnalyzingBijlagen}
          className="flex-1"
        >
          Ga naar betaling
        </Button>
        <Button
          variant="secondary"
          onClick={handleContinueToTestVersion}
          disabled={!selectedProduct || !activeFlow || isAnalyzingBijlagen}
          className="flex-1"
        >
          Verder naar test versie
        </Button>
      </div>
    </div>
  );
}
