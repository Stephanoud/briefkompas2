import { expect, test } from "@playwright/test";
import { getRelevantProceduralAttachments, inferAttachmentKind } from "@/lib/intake/procedural-attachments";

test.describe("Procedural attachments", () => {
  test("1. herkent een bezwaarbrief als onderliggend stuk bij beroep na bezwaar", () => {
    const relevant = getRelevantProceduralAttachments({
      flow: "beroep_na_bezwaar",
      intakeData: {
        flow: "beroep_na_bezwaar",
        files: {
          bijlagen: [
            {
              name: "bezwaarschrift-14-08-2023.pdf",
              size: 1000,
              type: "application/pdf",
              path: "stored:bezwaarschrift",
              extractedText: "Hierbij maak ik bezwaar tegen het besluit van 14 juli 2023.",
              attachmentKind: inferAttachmentKind({
                name: "bezwaarschrift-14-08-2023.pdf",
                extractedText: "Hierbij maak ik bezwaar tegen het besluit van 14 juli 2023.",
              }),
            },
          ],
        },
      },
    });

    expect(relevant).toHaveLength(1);
    expect(relevant[0].attachmentKind).toBe("bezwaarbrief");
    expect(relevant[0].fileName).toContain("bezwaarschrift");
  });

  test("2. herkent een zienswijze als relevant stuk bij direct beroep", () => {
    const relevant = getRelevantProceduralAttachments({
      flow: "beroep_zonder_bezwaar",
      intakeData: {
        flow: "beroep_zonder_bezwaar",
        hadOntwerpbesluit: true,
        konZienswijzeIndienen: true,
        heeftZienswijzeIngediend: true,
        files: {
          bijlagen: [
            {
              name: "zienswijze-ontwerpbesluit.pdf",
              size: 1000,
              type: "application/pdf",
              path: "stored:zienswijze",
              extractedText: "Hierbij dien ik een zienswijze in tegen het ontwerpbesluit.",
              attachmentKind: inferAttachmentKind({
                name: "zienswijze-ontwerpbesluit.pdf",
                extractedText: "Hierbij dien ik een zienswijze in tegen het ontwerpbesluit.",
              }),
            },
          ],
        },
      },
    });

    expect(relevant).toHaveLength(1);
    expect(relevant[0].attachmentKind).toBe("zienswijze");
  });

  test("3. beslissing op bezwaar wordt niet ten onrechte als bezwaarbrief gelabeld", () => {
    expect(
      inferAttachmentKind({
        name: "beslissing-op-bezwaar.pdf",
        extractedText: "Beslissing op bezwaar. Het bezwaar is ongegrond.",
      })
    ).toBe("overig");
  });

  test("4. irrelevante dossierstukken worden niet als onderliggend processtuk opgehaald", () => {
    const relevant = getRelevantProceduralAttachments({
      flow: "beroep_na_bezwaar",
      intakeData: {
        flow: "beroep_na_bezwaar",
        files: {
          bijlagen: [
            {
              name: "medische-bijlage.pdf",
              size: 1000,
              type: "application/pdf",
              path: "stored:medisch",
              extractedText: "Medische informatie ter onderbouwing van de gevolgen van het besluit.",
              attachmentKind: inferAttachmentKind({
                name: "medische-bijlage.pdf",
                extractedText: "Medische informatie ter onderbouwing van de gevolgen van het besluit.",
              }),
            },
          ],
        },
      },
    });

    expect(relevant).toHaveLength(0);
  });
});
