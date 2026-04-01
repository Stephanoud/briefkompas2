import { expect, test } from "@playwright/test";
import {
  detectBestuursorgaanScope,
  extractBestuursorgaanName,
  filterBestuursorganen,
  findBestuursorgaanMatch,
} from "@/lib/intake/bestuursorganen";

test.describe("Bestuursorganen registry", () => {
  test("1. alias nza resolveert naar Nederlandse Zorgautoriteit", () => {
    const match = findBestuursorgaanMatch("De NZa heeft op mijn bezwaar beslist.");

    expect(match?.canonicalName).toBe("Nederlandse Zorgautoriteit (NZa)");
    expect(match?.recognitionKind).toBe("zelfstandig_bestuursorgaan");
  });

  test("2. college van burgemeester en wethouders wordt rolgebaseerd herkend", () => {
    const match = findBestuursorgaanMatch("college van burgemeester en wethouders van utrecht");

    expect(match?.canonicalName).toBe("College van burgemeester en wethouders van Utrecht");
    expect(match?.scope).toBe("gemeente");
  });

  test("3. burgemeester wordt als bestuursorgaan herkend", () => {
    expect(extractBestuursorgaanName("De burgemeester van Amsterdam heeft de vergunning geweigerd.")).toBe(
      "Burgemeester van Amsterdam"
    );
  });

  test("4. filteren zoekt ook op aliassen", () => {
    const suggestions = filterBestuursorganen("rdw");

    expect(suggestions).toContain("Dienst Wegverkeer (RDW)");
  });

  test("5. scope-detectie werkt voor zelfstandige bestuursorganen", () => {
    expect(detectBestuursorgaanScope("Kamer van Koophandel (KvK)")).toBe("overig");
    expect(detectBestuursorgaanScope("Belastingdienst")).toBe("rijk");
  });

  test("6. privaatrechtelijke wederpartij wordt niet ten onrechte als bestuursorgaan gematcht", () => {
    expect(findBestuursorgaanMatch("De zorgverzekeraar heeft mijn declaratie afgewezen.")).toBeNull();
  });
});
