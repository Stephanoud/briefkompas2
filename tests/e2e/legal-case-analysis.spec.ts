import { expect, test } from "@playwright/test";
import { buildLetterPrompt } from "@/lib/ai/buildLetterPrompt";
import { findLetterGuardViolations } from "@/lib/ai/output-guards";
import { buildCaseFileAnalysis } from "@/lib/legal/case-file-analysis";
import { classifyCase } from "@/lib/intake/classifyCase";
import { determineRoute } from "@/lib/intake/determineRoute";
import { evaluateLateDecisionGate } from "@/lib/legal/late-decision";
import { validateAuthorities } from "@/lib/sources/validateAuthorities";
import { buildSafeFallbackLetter } from "@/app/api/generate-letter/route";
import { SelectedSourceSet } from "@/lib/legal/types";
import { ReferenceItem } from "@/src/types/references";

const sourceSet: SelectedSourceSet = {
  caseType: "algemeen_bestuursrecht",
  route: "bezwaar_bestuursrecht",
  allowedDomains: ["data.rechtspraak.nl", "rechtspraak.nl", "wetten.overheid.nl"],
  primarySources: [{ domain: "wetten.overheid.nl", url: "https://wetten.overheid.nl", role: "primary" }],
  useCaseLaw: "only_if_validated",
};

const baseReference: ReferenceItem = {
  id: "test-rvs-zoekplicht",
  title: "ABRvS 24 februari 2021",
  sourceType: "jurisprudentie",
  ecli: "ECLI:NL:RVS:2021:371",
  citation: "ABRvS 24 februari 2021, ECLI:NL:RVS:2021:371",
  topic: "zoekplicht",
  principle: "zorgvuldig onderzoek naar documenten",
  keywords: ["zoekplicht", "zorgvuldig onderzoek"],
  flow: "bezwaar",
};

const baseAuthorityIntake = {
  flow: "bezwaar" as const,
  bestuursorgaan: "Gemeente Amsterdam",
  categorie: "overig",
  doel: "openbaarmaking of betere motivering",
  gronden: "Het bestuursorgaan heeft onvoldoende uitgelegd hoe naar documenten is gezocht en waarom informatie is geweigerd.",
  files: {},
  besluitAnalyse: {
    onderwerp: "Besluit op verzoek om informatie",
    besluitInhoud: "Volgens het bestuursorgaan zijn niet meer documenten aangetroffen.",
    dragendeOverwegingen: [
      {
        passage: "Er is gezocht in mailboxen en het zaaksysteem, maar niet nader uitgelegd met welke zoektermen.",
        duiding: "zoekslag en motivering",
      },
    ],
  },
};

test.describe("Legal case analysis", () => {
  const originalFetch = global.fetch;

  test.afterEach(() => {
    global.fetch = originalFetch;
  });

  test("1. bouwt gerichte checkvragen en onzekerheden op dossierniveau", () => {
    const analysis = buildCaseFileAnalysis({
      flow: "beroep_na_bezwaar",
      intakeData: {
        flow: "beroep_na_bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "vernietigen",
        gronden: "De beslissing op bezwaar gaat niet in op mijn bezwaargronden.",
        files: {},
        besluitAnalyseStatus: "partial",
        besluitAnalyse: {
          besluitInhoud: "Beslissing op bezwaar: ongegrond.",
        },
      },
      guard: {
        ok: false,
        fallbackMode: "none",
        generationMode: "safe_generic_ai",
        reasons: ["route_uncertain"],
        hardBlockers: [],
        softSignals: ["route_uncertain"],
        missingFields: ["eerdereBezwaargronden"],
        caseType: "algemeen_bestuursrecht",
        route: "beroep_na_bezwaar_bestuursrecht",
        caseTypeConfidence: 0.92,
        routeConfidence: 0.55,
        selectedSourceSet: sourceSet,
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module.toLowerCase()).toContain("beroep");
    expect(analysis.gerichteCheckvragen.length).toBeGreaterThan(0);
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(analysis.onzekerheden.join(" ").toLowerCase()).toContain("deels");
    expect(analysis.ontbrekendeInformatie).toContain("de eerder aangevoerde bezwaargronden");
    expect(analysis.workflowProfile?.question_logic.max_questions_per_round).toBe(5);
    expect(analysis.workflowProfile?.question_logic.do_not_ask_if_already_known).toBeTruthy();
    expect(analysis.workflowProfile?.hallucination_guards).toContain("verzin geen ECLI");
    expect(analysis.labeledStellingen?.some((item) => item.label === "afgeleide interpretatie")).toBeTruthy();
    expect(analysis.labeledStellingen?.some((item) => item.label === "gebruikersstelling / nog niet geverifieerd")).toBeTruthy();
  });

  test("2. labelt een officieel bevestigde uitspraak als verified", async () => {
    global.fetch = (async () =>
      new Response(
        `<?xml version="1.0" encoding="utf-8"?>
        <open-rechtspraak>
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcterms="http://purl.org/dc/terms/">
            <rdf:Description>
              <dcterms:creator>Raad van State</dcterms:creator>
              <dcterms:date>2021-02-24</dcterms:date>
            </rdf:Description>
            <rdf:Description>
              <dcterms:title>ECLI:NL:RVS:2021:371 Raad van State, 24-02-2021</dcterms:title>
            </rdf:Description>
          </rdf:RDF>
          <inhoudsindicatie>Het bestuursorgaan moet een zorgvuldig onderzoek verrichten naar de aanwezigheid van documenten.</inhoudsindicatie>
        </open-rechtspraak>`,
        {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        }
      )) as typeof fetch;

    const result = await validateAuthorities({
      references: [baseReference],
      sourceSet,
      intakeData: baseAuthorityIntake,
    });

    expect(result.allowedAuthorities).toHaveLength(1);
    expect(result.selectedAuthorities).toHaveLength(1);
    expect(result.selectedAuthorities[0].useInLetter).toBeTruthy();
    expect(result.allowedAuthorities[0].verificationStatus).toBe("verified");
    expect(result.allowedAuthorities[0].searchQueries).toContain("ECLI:NL:RVS:2021:371");
    expect(result.rejectedAuthorities).toHaveLength(0);
  });

  test("3. markeert niet-ophaalbare jurisprudentie als not_usable", async () => {
    global.fetch = (async () =>
      new Response("not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      })) as typeof fetch;

    const result = await validateAuthorities({
      references: [baseReference],
      sourceSet,
      intakeData: baseAuthorityIntake,
    });

    expect(result.allowedAuthorities).toHaveLength(0);
    expect(result.rejectedAuthorities).toHaveLength(1);
    expect(result.rejectedAuthorities[0].verificationStatus).toBe("not_usable");
    expect(result.rejectedAuthorities[0].reasons).toContain("official_fetch_failed");
  });

  test("4. document dat op andere module wijst forceert geen sectorspecifieke aanname", () => {
    const result = classifyCase({
      flow: "beroep_na_bezwaar",
      intakeData: {
        flow: "beroep_na_bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herziening",
        gronden: "Het besluit klopt niet.",
        files: {},
        besluitSamenvatting: "Besluit over uw WIA-uitkering.",
        besluitAnalyse: {
          onderwerp: "WIA-uitkering",
          besluitInhoud: "UWV handhaaft de weigering van een uitkering.",
        },
      },
    });

    expect(result.caseType).toBe("onzeker_handmatige_triage");
    expect(result.reasons.join(" ").toLowerCase()).toContain("documentsignalen");
  });

  test("5. outputguard vangt ongefundeerde ecli, termijn en hoorzitting af", () => {
    const violations = findLetterGuardViolations({
      letterText:
        'Volgens vaste jurisprudentie, waaronder ECLI:NL:RVS:2020:9999, geldt hier een termijn van zes weken. Ik verzoek om een hoorzitting.',
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herziening",
        gronden: "De motivering klopt niet.",
        files: {},
      },
      validatedAuthorities: [],
    });

    expect(violations).toContain("output_unvalidated_ecli");
    expect(violations).toContain("output_unverified_term");
    expect(violations).toContain("output_unverified_hearing_reference");
    expect(violations).toContain("output_unverified_case_law_claim");
  });

  test("6. bestuurlijke boete gebruikt boeteprofiel en gerichte boetevragen", () => {
    const intakeData = {
      flow: "bezwaar" as const,
      bestuursorgaan: "Gemeente Amsterdam",
      categorie: "boete",
      doel: "herroepen of matigen",
      gronden: "Ik betwist dat de overtreding voldoende is bewezen.",
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Bestuurlijke boete",
        rechtsgrond: "artikel 5:46 Awb",
        besluitInhoud: "Boetebesluit van 900 euro wegens overtreding van de APV.",
        dragendeOverwegingen: [
          {
            passage: "Volgens het college staat vast dat betrokkene de overtreding heeft begaan.",
            duiding: "bewijs van de overtreding",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "bezwaar",
      intakeData,
    });

    expect(classification.caseType).toBe("bestuurlijke_boete");

    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "bestuurlijke_boete",
        route: "bezwaar_bestuursrecht",
        caseTypeConfidence: 0.91,
        routeConfidence: 0.95,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "bestuurlijke_boete",
          route: "bezwaar_bestuursrecht",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Boete");
    expect(analysis.workflowProfile?.module).toBe("boete");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("wettelijke_grondslag_boete");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[0]).toContain("Welke concrete gedraging betwist u");
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("verwijtbaar"))
    ).toBeTruthy();
  });

  test("7. mulder-signalen blijven naar verkeersboete routeren", () => {
    const result = classifyCase({
      flow: "bezwaar",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "CJIB",
        categorie: "boete",
        doel: "vernietigen",
        gronden: "Het betreft een Mulderbeschikking voor een snelheidsovertreding met kenteken.",
        files: {},
        besluitSamenvatting: "CJIB-beschikking wegens snelheidsovertreding.",
      },
    });

    expect(result.caseType).toBe("verkeersboete");
  });

  test("8. Wmo/PGB gebruikt wmo-profiel en gerichte Wmo-vragen", () => {
    const intakeData = {
      flow: "bezwaar" as const,
      bestuursorgaan: "Gemeente Utrecht",
      categorie: "overig",
      doel: "toekenning van een passend pgb",
      gronden: "De gemeente legt niet uit waarom zorg in natura passend zou zijn en het budget is te laag.",
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Wmo aanvraag pgb begeleiding",
        besluitInhoud: "Afwijzing van het gevraagde pgb voor begeleiding; zorg in natura is volgens de gemeente passend.",
        dragendeOverwegingen: [
          {
            passage: "De gemeente acht zorg in natura een passend alternatief voor de gevraagde ondersteuning.",
            duiding: "passendheid van zorg in natura",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "bezwaar",
      intakeData,
    });

    expect(classification.caseType).toBe("wmo_pgb");

    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "wmo_pgb",
        route: "bezwaar_bestuursrecht",
        caseTypeConfidence: 0.92,
        routeConfidence: 0.95,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "wmo_pgb",
          route: "bezwaar_bestuursrecht",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Wmo / PGB");
    expect(analysis.workflowProfile?.module).toBe("wmo_pgb");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("voorzieningstype");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[1]).toContain("zorg in natura");
    expect(analysis.workflowProfile?.abort_or_redirect_conditions).toContain(
      "als_het_gaat_om_Wlz_of_Zvw_redirect_naar_andere_zorgmodule"
    );
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("budgetplan"))
    ).toBeTruthy();
  });

  test("9. Jeugdwet-signalen blokkeren automatische Wmo-classificatie", () => {
    const result = classifyCase({
      flow: "bezwaar",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Rotterdam",
        categorie: "overig",
        doel: "herziening",
        gronden: "Het gaat om een pgb voor jeugdhulp onder de Jeugdwet.",
        files: {},
        besluitSamenvatting: "Afwijzing van een persoonsgebonden budget voor jeugdhulp.",
        besluitAnalyse: {
          onderwerp: "Jeugdwet pgb",
          besluitInhoud: "De aanvraag om jeugdhulp in de vorm van een pgb wordt afgewezen.",
        },
      },
    });

    expect(result.caseType).toBe("onzeker_handmatige_triage");
    expect(result.reasons.join(" ").toLowerCase()).toContain("andere zorgregeling");
  });

  test("10. handhaving gebruikt handhavingsprofiel en gerichte handhavingsvragen", () => {
    const intakeData = {
      flow: "bezwaar" as const,
      bestuursorgaan: "Gemeente Eindhoven",
      categorie: "overig",
      doel: "intrekken van de last onder dwangsom",
      gronden: "De last is te vaag en de gemeente gaat niet in op legalisatie.",
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Last onder dwangsom",
        besluitInhoud: "Aan betrokkene is een last onder dwangsom opgelegd wegens strijdig gebruik.",
        dragendeOverwegingen: [
          {
            passage: "Volgens het college is sprake van strijdig gebruik zonder toereikende vergunning.",
            duiding: "gestelde overtreding",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "bezwaar",
      intakeData,
    });

    expect(classification.caseType).toBe("handhaving");

    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "handhaving",
        route: "bezwaar_bestuursrecht",
        caseTypeConfidence: 0.93,
        routeConfidence: 0.95,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "handhaving",
          route: "bezwaar_bestuursrecht",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Handhaving");
    expect(analysis.workflowProfile?.module).toBe("handhaving");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("type_sanctie");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[0]).toContain("om handhaving heeft gevraagd");
    expect(analysis.workflowProfile?.abort_or_redirect_conditions).toContain(
      "als_het_eigenlijk_gaat_om_verlening_of_weigering_van_vergunning_redirect_vergunning"
    );
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("onevenredig"))
    ).toBeTruthy();
  });

  test("11. zuivere vergunningssignalen blijven uit de handhavingsmodule", () => {
    const result = classifyCase({
      flow: "bezwaar",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Tilburg",
        categorie: "vergunning",
        doel: "verlening van de omgevingsvergunning",
        gronden: "De aanvraag om omgevingsvergunning is ten onrechte geweigerd.",
        files: {},
        besluitSamenvatting: "Weigering van de omgevingsvergunning.",
        besluitAnalyse: {
          onderwerp: "Weigering omgevingsvergunning",
          besluitInhoud: "De gevraagde vergunning wordt niet verleend.",
        },
      },
    });

    expect(result.caseType).toBe("omgevingswet_vergunning");
    expect(result.caseType).not.toBe("handhaving");
  });

  test("12. belasting gebruikt belastingprofiel en gerichte fiscale vragen", () => {
    const intakeData = {
      flow: "bezwaar" as const,
      bestuursorgaan: "Belastingdienst",
      categorie: "belasting",
      doel: "vermindering van de aanslag en vernietiging van de boete",
      gronden: "De correctie is niet feitelijk onderbouwd en de inspecteur heeft mijn administratie onvolledig gelezen.",
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Navorderingsaanslag inkomstenbelasting met vergrijpboete",
        besluitInhoud: "De inspecteur corrigeert de aangifte en legt daarnaast een vergrijpboete op.",
        dragendeOverwegingen: [
          {
            passage: "Volgens de inspecteur zijn de opgevoerde kosten niet aannemelijk gemaakt.",
            duiding: "feitelijke onderbouwing van de correctie",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "bezwaar",
      intakeData,
    });

    expect(classification.caseType).toBe("belastingaanslag");

    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "belastingaanslag",
        route: "bezwaar_fiscaal",
        caseTypeConfidence: 0.95,
        routeConfidence: 0.95,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "belastingaanslag",
          route: "bezwaar_fiscaal",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Belasting");
    expect(analysis.workflowProfile?.module).toBe("belasting");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("belastingsoort");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[0]).toContain("de aanslag, de boete, of allebei");
    expect(analysis.workflowProfile?.abort_or_redirect_conditions).toContain(
      "als_het_gaat_om_toeslagen_redirect_toeslagen"
    );
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("opzet of grove schuld"))
    ).toBeTruthy();
  });

  test("13. belastingboete blijft in belastingmodule en niet in algemene boetemodule", () => {
    const result = classifyCase({
      flow: "bezwaar",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Belastingdienst",
        categorie: "boete",
        doel: "vernietiging van de vergrijpboete",
        gronden: "De vergrijpboete bij de navorderingsaanslag inkomstenbelasting is onterecht en een pleitbaar standpunt is genegeerd.",
        files: {},
        besluitSamenvatting: "Navorderingsaanslag inkomstenbelasting met vergrijpboete wegens vermeende grove schuld.",
      },
    });

    expect(result.caseType).toBe("belastingaanslag");
    expect(result.caseType).not.toBe("bestuurlijke_boete");
  });

  test("14. toeslagen gebruikt toeslagenprofiel en gerichte toeslagvragen", () => {
    const intakeData = {
      flow: "bezwaar" as const,
      bestuursorgaan: "Dienst Toeslagen",
      categorie: "overig",
      doel: "verlaging van de terugvordering",
      gronden: "De berekening is niet inzichtelijk en mijn bijzondere omstandigheden zijn niet kenbaar meegewogen.",
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Definitieve berekening kinderopvangtoeslag",
        besluitInhoud: "De kinderopvangtoeslag wordt definitief lager vastgesteld en deels teruggevorderd.",
        dragendeOverwegingen: [
          {
            passage: "Volgens Toeslagen sluiten de opgegeven opvanguren niet aan op de beschikbare gegevens.",
            duiding: "feitenbasis opvanguren",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "bezwaar",
      intakeData,
    });

    expect(classification.caseType).toBe("toeslag");

    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "toeslag",
        route: "bezwaar_toeslagen",
        caseTypeConfidence: 0.94,
        routeConfidence: 0.95,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "toeslag",
          route: "bezwaar_toeslagen",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Toeslagen");
    expect(analysis.workflowProfile?.module).toBe("toeslagen");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("toeslagsoort");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[0]).toContain("voorschot");
    expect(analysis.workflowProfile?.abort_or_redirect_conditions).toContain(
      "als_alleen_niet_tijdig_beslissen_speelt_en_nog_geen_inhoudelijk_besluit_is_genomen_redirect_niet_tijdig"
    );
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("tijdig aangeleverd"))
    ).toBeTruthy();
  });

  test("15. expliciete toeslagsignalen blijven gescheiden van belastingzaken", () => {
    const result = classifyCase({
      flow: "bezwaar",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Belastingdienst/Toeslagen",
        categorie: "belasting",
        doel: "herziening",
        gronden: "De definitieve berekening van de zorgtoeslag klopt niet vanwege een onjuiste partnerregistratie.",
        files: {},
        besluitSamenvatting: "Definitieve berekening zorgtoeslag met terugvordering.",
      },
    });

    expect(result.caseType).toBe("toeslag");
    expect(result.caseType).not.toBe("belastingaanslag");
  });

  test("16. niet tijdig beslissen gebruikt eigen profiel en gerichte termijnvragen", () => {
    const intakeData = {
      flow: "beroep_zonder_bezwaar" as const,
      bestuursorgaan: "Gemeente Leiden",
      categorie: "overig",
      doel: "een beslissing afdwingen",
      gronden:
        "Mijn aanvraag is al te lang blijven liggen. Ik heb een ingebrekestelling gestuurd en daarna zijn meer dan twee weken verstreken zonder besluit.",
      procedureAdvies: "niet_tijdig_beslissen" as const,
      nietTijdigBeslissen: true,
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Niet tijdig beslissen op aanvraag",
        termijnen: "Volgens de stukken is de beslistermijn verstreken en is een ingebrekestelling verzonden.",
        besluitInhoud: "Er is nog geen inhoudelijk besluit genomen.",
        dragendeOverwegingen: [
          {
            passage: "Op 5 januari 2026 is een ingebrekestelling verzonden.",
            duiding: "ingebrekestelling en uitblijven van besluit",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "beroep_zonder_bezwaar",
      intakeData,
    });

    expect(classification.caseType).toBe("niet_tijdig_beslissen");

    const analysis = buildCaseFileAnalysis({
      flow: "beroep_zonder_bezwaar",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "niet_tijdig_beslissen",
        route: "beroep_niet_tijdig_beslissen",
        caseTypeConfidence: 0.97,
        routeConfidence: 0.97,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "niet_tijdig_beslissen",
          route: "beroep_niet_tijdig_beslissen",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Niet tijdig beslissen");
    expect(analysis.workflowProfile?.module).toBe("niet_tijdig_beslissen");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("datum_ingebrekestelling");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[2]).toContain("ingebrekestelling");
    expect(analysis.workflowProfile?.abort_or_redirect_conditions).toContain(
      "als_nog_geen_ingebrekestelling_is_verzonden"
    );
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("opgeschort"))
    ).toBeTruthy();
  });

  test("17. late-decision gate blokkeert zonder geverifieerde ingebrekestelling", () => {
    const gate = evaluateLateDecisionGate({
      flow: "beroep_zonder_bezwaar",
      bestuursorgaan: "Gemeente Haarlem",
      categorie: "overig",
      doel: "een beslissing afdwingen",
      gronden: "Er is nog steeds niet beslist op mijn aanvraag.",
      procedureAdvies: "niet_tijdig_beslissen",
      nietTijdigBeslissen: true,
      files: {},
      besluitAnalyse: {
        onderwerp: "Niet tijdig beslissen",
      },
    });

    expect(gate.hardBlockers).toContain("late_decision_missing_ingebrekestelling");
    expect(gate.hardBlockers).toContain("late_decision_deadline_unverified");
    expect(gate.hardBlockers).toContain("late_decision_two_week_wait_unverified");
  });

  test("18. niet-ontvankelijkheid gebruikt eigen profiel en gerichte ontvankelijkheidsvragen", () => {
    const intakeData = {
      flow: "bezwaar" as const,
      bestuursorgaan: "Gemeente Zwolle",
      categorie: "overig",
      doel: "inhoudelijke behandeling van het bezwaar",
      gronden: "Mijn bezwaar is niet-ontvankelijk verklaard wegens termijnoverschrijding, maar de bekendmaking en termijnstart zijn onduidelijk.",
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Niet-ontvankelijkverklaring bezwaar",
        besluitInhoud: "Het bezwaar is niet-ontvankelijk verklaard wegens termijnoverschrijding.",
        dragendeOverwegingen: [
          {
            passage: "Volgens het bestuursorgaan is het bezwaarschrift buiten de termijn ontvangen.",
            duiding: "termijnoverschrijding als ontvankelijkheidsgrond",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "bezwaar",
      intakeData,
    });

    expect(classification.caseType).toBe("niet_ontvankelijkheid");

    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "niet_ontvankelijkheid",
        route: "bezwaar_bestuursrecht",
        caseTypeConfidence: 0.95,
        routeConfidence: 0.95,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "niet_ontvankelijkheid",
          route: "bezwaar_bestuursrecht",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Niet-ontvankelijkheid");
    expect(analysis.workflowProfile?.module).toBe("niet_ontvankelijkheid");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("reden_niet_ontvankelijkheid");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[2]).toContain("verzuim te herstellen");
    expect(analysis.workflowProfile?.abort_or_redirect_conditions).toContain(
      "als_het_eigenlijk_om_niet_tijdig_beslissen_gaat_redirect_niet_tijdig"
    );
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("verschoonbaar"))
    ).toBeTruthy();
  });

  test("19. niet tijdig beslissen houdt voorrang boven niet-ontvankelijkheidsframe", () => {
    const result = classifyCase({
      flow: "beroep_zonder_bezwaar",
      intakeData: {
        flow: "beroep_zonder_bezwaar",
        bestuursorgaan: "Gemeente Arnhem",
        categorie: "overig",
        doel: "een beslissing afdwingen",
        gronden: "Mijn beroep wegens niet tijdig beslissen zou volgens het bestuursorgaan niet-ontvankelijk zijn omdat geen ingebrekestelling is ontvangen.",
        procedureAdvies: "niet_tijdig_beslissen",
        nietTijdigBeslissen: true,
        files: {},
      },
    });

    expect(result.caseType).toBe("niet_tijdig_beslissen");
    expect(result.caseType).not.toBe("niet_ontvankelijkheid");
  });

  test("20. Woo gebruikt eigen profiel en gerichte Woo-vragen", () => {
    const intakeData = {
      flow: "woo" as const,
      bestuursorgaan: "Gemeente Delft",
      wooOnderwerp: "Correspondentie over een bouwproject",
      wooPeriode: "2024-01-01 tot 2024-12-31",
      wooDocumenten: "E-mails, notulen en memo's",
      doel: "openbaarmaking",
      files: {},
      besluitAnalyseStatus: "read" as const,
      besluitAnalyse: {
        onderwerp: "Besluit op Woo-verzoek",
        besluitInhoud: "Deels openbaarmaking, deels weigering wegens vertrouwelijke bedrijfsgegevens.",
        dragendeOverwegingen: [
          {
            passage: "Er is gezocht binnen de mailboxen van het projectteam en het zaaksysteem.",
            duiding: "beschrijving van de zoekslag",
          },
        ],
      },
    };

    const classification = classifyCase({
      flow: "woo",
      intakeData,
    });

    expect(classification.caseType).toBe("woo");

    const analysis = buildCaseFileAnalysis({
      flow: "woo",
      intakeData,
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "woo",
        route: "bezwaar_woo_besluit",
        caseTypeConfidence: 0.98,
        routeConfidence: 0.9,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "woo",
          route: "bezwaar_woo_besluit",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.module).toContain("Woo");
    expect(analysis.workflowProfile?.module).toBe("woo");
    expect(analysis.workflowProfile?.document_extraction.required_fields).toContain("beschrijving_van_de_zoekslag");
    expect(analysis.workflowProfile?.question_logic.sample_questions?.[1]).toContain("zoektermen");
    expect(analysis.workflowProfile?.abort_or_redirect_conditions).toContain(
      "als_er_nog_geen_besluit_is_en_alleen_termijnoverschrijding_speelt_redirect_niet_tijdig"
    );
    expect(analysis.gerichteCheckvragen.length).toBeLessThanOrEqual(5);
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("woo-uitzondering"))
    ).toBeTruthy();
  });

  test("21. niet tijdig Woo routeert naar de Woo-submodule", () => {
    const intakeData = {
      flow: "woo" as const,
      bestuursorgaan: "Gemeente Nijmegen",
      wooOnderwerp: "Subsidiedossier",
      wooPeriode: "2025",
      wooDocumenten: "Besluiten en e-mails",
      doel: "een beslissing afdwingen",
      procedureAdvies: "niet_tijdig_beslissen" as const,
      nietTijdigBeslissen: true,
      gronden: "Er is nog niet beslist op mijn Woo-verzoek ondanks ingebrekestelling.",
      files: {},
    };

    const classification = classifyCase({
      flow: "woo",
      intakeData,
    });
    const route = determineRoute({
      flow: "woo",
      caseType: classification.caseType,
      intakeData,
    });

    expect(classification.caseType).toBe("niet_tijdig_beslissen");
    expect(route.route).toBe("woo_niet_tijdig_beslissen");
  });

  test("22. jurisprudentie zonder beoordeelde feitelijke vergelijkbaarheid wordt niet gebruikt", async () => {
    global.fetch = (async () =>
      new Response(
        `<?xml version="1.0" encoding="utf-8"?>
        <open-rechtspraak>
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcterms="http://purl.org/dc/terms/">
            <rdf:Description>
              <dcterms:creator>Raad van State</dcterms:creator>
              <dcterms:date>2021-02-24</dcterms:date>
            </rdf:Description>
            <rdf:Description>
              <dcterms:title>ECLI:NL:RVS:2021:371 Raad van State, 24-02-2021</dcterms:title>
            </rdf:Description>
          </rdf:RDF>
          <inhoudsindicatie>Het bestuursorgaan moet een zorgvuldig onderzoek verrichten naar de aanwezigheid van documenten.</inhoudsindicatie>
        </open-rechtspraak>`,
        {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        }
      )) as typeof fetch;

    const result = await validateAuthorities({
      references: [baseReference],
      sourceSet,
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "verlening van de omgevingsvergunning",
        gronden: "Het bouwplan past wel binnen het omgevingsplan.",
        files: {},
        besluitAnalyse: {
          onderwerp: "Weigering omgevingsvergunning",
          besluitInhoud: "De gevraagde omgevingsvergunning is geweigerd wegens strijd met het omgevingsplan.",
        },
      },
    });

    expect(result.allowedAuthorities).toHaveLength(0);
    expect(result.rejectedAuthorities[0].reasons).toContain("insufficient_factual_similarity");
    expect(result.rejectedAuthorities[0].factualSimilarity).toBe("low");
  });

  test("23. overheid-helpende jurisprudentie zonder onderscheidbaarheid blijft buiten de brief", async () => {
    global.fetch = (async () =>
      new Response(
        `<?xml version="1.0" encoding="utf-8"?>
        <open-rechtspraak>
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcterms="http://purl.org/dc/terms/">
            <rdf:Description>
              <dcterms:creator>Raad van State</dcterms:creator>
              <dcterms:date>2024-09-10</dcterms:date>
            </rdf:Description>
            <rdf:Description>
              <dcterms:title>ECLI:NL:RVS:2024:9999 Raad van State, 10-09-2024</dcterms:title>
            </rdf:Description>
          </rdf:RDF>
          <inhoudsindicatie>Het bestuursorgaan mocht in redelijkheid concluderen dat de verrichte zoekslag voldoende was en hoefde geen verdere documenten te verstrekken.</inhoudsindicatie>
        </open-rechtspraak>`,
        {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        }
      )) as typeof fetch;

    const result = await validateAuthorities({
      references: [
        {
          ...baseReference,
          id: "authority-helpful-woo-case",
          title: "ABRvS 10 september 2024",
          ecli: "ECLI:NL:RVS:2024:9999",
          citation: "ABRvS 10 september 2024, ECLI:NL:RVS:2024:9999",
          principle: "bestuursorgaan mocht in redelijkheid volstaan met de verrichte zoekslag",
        },
      ],
      sourceSet,
      intakeData: baseAuthorityIntake,
    });

    expect(result.allowedAuthorities).toHaveLength(0);
    expect(result.rejectedAuthorities[0].helpsUserOrAuthority).toBe("authority");
    expect(result.rejectedAuthorities[0].distinguishable).toBe("no");
    expect(result.rejectedAuthorities[0].reasons).toContain("authority_helpful_case_not_distinguishable");
  });

  test("24. outputguard blokkeert kale standaardgronden zonder concrete invulling", () => {
    const violations = findLetterGuardViolations({
      letterText: [
        "Het besluit is onzorgvuldig voorbereid.",
        "Het besluit is ondeugdelijk gemotiveerd.",
        "Het besluit is in strijd met artikel 3:4 Awb.",
        "De volledige heroverweging ontbreekt.",
      ].join(" "),
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herziening",
        gronden: "Het besluit klopt niet.",
        files: {},
      },
      validatedAuthorities: [],
    });

    expect(violations).toContain("output_generic_zorgvuldigheid_without_research_defect");
    expect(violations).toContain("output_generic_motivation_without_decision_passage");
    expect(violations).toContain("output_generic_evenredigheid_without_harm_or_balancing");
    expect(violations).toContain("output_generic_reconsideration_without_missing_points");
  });

  test("25. outputguard laat geconcretiseerde gronden staan", () => {
    const violations = findLetterGuardViolations({
      letterText: [
        "Het besluit is onzorgvuldig voorbereid, omdat geen onderzoek is gedaan naar de medische stukken die al in het dossier zaten.",
        "Het besluit is ondeugdelijk gemotiveerd, omdat in de passage onder kopje Motivering alleen staat dat zorg in natura passend zou zijn zonder uit te leggen waarom.",
        "Het besluit is in strijd met artikel 3:4 Awb, omdat de nadelige gevolgen voor mijn draagkracht niet kenbaar zijn afgewogen tegen het doel van het besluit.",
        "De volledige heroverweging ontbreekt, omdat op mijn bezwaargronden over draagkracht en verwijtbaarheid niet is ingegaan.",
      ].join(" "),
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "wmo",
        doel: "herziening",
        gronden: "De gemeente heeft mijn medische stukken niet onderzocht en mijn bezwaargronden zijn onbesproken gebleven.",
        files: {},
        besluitAnalyse: {
          besluitInhoud: "De gemeente wijst de aanvraag af.",
          dragendeOverwegingen: [
            {
              passage: "Zorg in natura is passend.",
              duiding: "motivering van de afwijzing",
            },
          ],
        },
      },
      validatedAuthorities: [],
    });

    expect(violations).not.toContain("output_generic_zorgvuldigheid_without_research_defect");
    expect(violations).not.toContain("output_generic_motivation_without_decision_passage");
    expect(violations).not.toContain("output_generic_evenredigheid_without_harm_or_balancing");
    expect(violations).not.toContain("output_generic_reconsideration_without_missing_points");
  });

  test("26. workflowprofiel en checkvragen reageren op dossierverwijzingen en procedurepoort", () => {
    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Leiden",
        categorie: "overig",
        doel: "herziening",
        gronden: "Het besluit verwijst naar een zienswijzenota en een rapport, maar ik ken die stukken niet.",
        files: {},
        besluitAnalyseStatus: "read",
        besluitAnalyse: {
          onderwerp: "Beslissing op bezwaar",
          besluitInhoud: "Het bezwaar is ongegrond verklaard.",
          rechtsmiddelenclausule: "Tegen deze beslissing kan beroep worden ingesteld.",
          dragendeOverwegingen: [
            {
              passage: "Zoals in de zienswijzenota en het rapport is uiteengezet, ziet het college geen aanleiding het besluit te herroepen.",
              duiding: "verwijzing naar onderliggende stukken",
            },
          ],
          bijlageReferenties: ["Zienswijzenota", "Rapport"],
          inventarislijstOfDocumenttabel: ["Documenttabel Woo"],
          correspondentieVerwijzingen: ["Brief van 3 mei 2025"],
          aandachtspunten: ["Mogelijk discussie over geen besluit."],
        },
      },
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "algemeen_bestuursrecht",
        route: "bezwaar_bestuursrecht",
        caseTypeConfidence: 0.91,
        routeConfidence: 0.93,
        selectedSourceSet: sourceSet,
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    expect(analysis.workflowProfile?.document_extraction.optional_fields).toContain("rechtsmiddelenclausule");
    expect(analysis.workflowProfile?.document_extraction.optional_fields).toContain("inventarislijstOfDocumenttabel");
    expect(analysis.workflowProfile?.pre_output_checks).toContain("module_correctly_classified");
    expect(analysis.workflowProfile?.pre_output_checks).toContain("all_key_dates_extracted");
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("zienswijzenota"))
    ).toBeTruthy();
    expect(
      analysis.gerichteCheckvragen.some((question) => question.toLowerCase().includes("rapport"))
    ).toBeTruthy();
    expect(analysis.ontbrekendeInformatie).toContain("de precieze termijninformatie");
    expect(analysis.ontbrekendeInformatie).toContain("de wijze van bekendmaking of ontvangst");
    expect(analysis.ontbrekendeInformatie).toContain("de juiste procespositie van de gebruiker");
    expect(
      analysis.onzekerheden.some((item) => item.toLowerCase().includes("alertsignaal 'geen besluit'"))
    ).toBeTruthy();
  });

  test("27. jurisprudentie blijft beperkt tot de sterkste 1 tot 2 kwaliteitsversterkers", async () => {
    const references: ReferenceItem[] = [
      {
        ...baseReference,
        id: "case-law-1",
        ecli: "ECLI:NL:RVS:2021:371",
        citation: "ABRvS 24 februari 2021, ECLI:NL:RVS:2021:371",
        title: "ABRvS 24 februari 2021",
        topic: "zoekslag",
        principle: "zorgvuldig onderzoek naar documenten",
        keywords: ["zoekslag", "zorgvuldig onderzoek"],
      },
      {
        ...baseReference,
        id: "case-law-2",
        ecli: "ECLI:NL:RVS:2018:321",
        citation: "ABRvS 31 januari 2018, ECLI:NL:RVS:2018:321",
        title: "ABRvS 31 januari 2018",
        topic: "motiveringsplicht",
        principle: "het bestuursorgaan moet per document motiveren waarom informatie niet openbaar wordt gemaakt",
        keywords: ["motivering", "weigeringsgrond", "per document"],
      },
      {
        ...baseReference,
        id: "case-law-3",
        ecli: "ECLI:NL:RVS:2019:1603",
        citation: "ABRvS 15 mei 2019, ECLI:NL:RVS:2019:1603",
        title: "ABRvS 15 mei 2019",
        topic: "belangenafweging",
        principle: "bij relatieve weigeringsgronden is een concrete belangenafweging vereist",
        keywords: ["belangenafweging", "weigeringsgrond", "openbaarheid"],
      },
    ];

    global.fetch = (async (input) => {
      const url = String(input);
      const xmlByEcli: Record<string, string> = {
        "ECLI:NL:RVS:2021:371": `<?xml version="1.0" encoding="utf-8"?>
          <open-rechtspraak>
            <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcterms="http://purl.org/dc/terms/">
              <rdf:Description><dcterms:creator>Raad van State</dcterms:creator><dcterms:date>2021-02-24</dcterms:date></rdf:Description>
              <rdf:Description><dcterms:title>ECLI:NL:RVS:2021:371 Raad van State, 24-02-2021</dcterms:title><dcterms:subject>zoekslag</dcterms:subject></rdf:Description>
            </rdf:RDF>
            <inhoudsindicatie>Het bestuursorgaan moet een zorgvuldig onderzoek verrichten naar de aanwezigheid van documenten.</inhoudsindicatie>
          </open-rechtspraak>`,
        "ECLI:NL:RVS:2018:321": `<?xml version="1.0" encoding="utf-8"?>
          <open-rechtspraak>
            <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcterms="http://purl.org/dc/terms/">
              <rdf:Description><dcterms:creator>Raad van State</dcterms:creator><dcterms:date>2018-01-31</dcterms:date></rdf:Description>
              <rdf:Description><dcterms:title>ECLI:NL:RVS:2018:321 Raad van State, 31-01-2018</dcterms:title><dcterms:subject>motiveringsplicht</dcterms:subject></rdf:Description>
            </rdf:RDF>
            <inhoudsindicatie>Het bestuursorgaan moet per document concreet motiveren waarom informatie niet openbaar wordt gemaakt.</inhoudsindicatie>
          </open-rechtspraak>`,
        "ECLI:NL:RVS:2019:1603": `<?xml version="1.0" encoding="utf-8"?>
          <open-rechtspraak>
            <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcterms="http://purl.org/dc/terms/">
              <rdf:Description><dcterms:creator>Raad van State</dcterms:creator><dcterms:date>2019-05-15</dcterms:date></rdf:Description>
              <rdf:Description><dcterms:title>ECLI:NL:RVS:2019:1603 Raad van State, 15-05-2019</dcterms:title><dcterms:subject>belangenafweging</dcterms:subject></rdf:Description>
            </rdf:RDF>
            <inhoudsindicatie>Bij relatieve weigeringsgronden moet het bestuursorgaan een concrete belangenafweging maken.</inhoudsindicatie>
          </open-rechtspraak>`,
      };
      const matchedEntry = Object.entries(xmlByEcli).find(([ecli]) => url.includes(encodeURIComponent(ecli)));
      if (!matchedEntry) {
        return new Response("not found", { status: 404 });
      }
      return new Response(matchedEntry[1], {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    }) as typeof fetch;

    const result = await validateAuthorities({
      references,
      sourceSet,
      intakeData: {
        ...baseAuthorityIntake,
        flow: "woo",
        wooOnderwerp: "Zoekslag en weigeringsgronden rond bouwproject",
        wooDocumenten: "E-mails en memo's",
      },
    });

    expect(result.allowedAuthorities.filter((item) => item.sourceType === "jurisprudentie")).toHaveLength(3);
    expect(result.selectedAuthorities.filter((item) => item.sourceType === "jurisprudentie").length).toBeLessThanOrEqual(2);
    expect(
      result.auditTrail.some((line) => line.includes("useInLetter=yes"))
    ).toBeTruthy();
  });

  test("28. safe fallback plaatst tegenwerpingen en procedureuitleg direct na de brief", () => {
    const letter = buildSafeFallbackLetter({
      flow: "bezwaar",
      caseType: "algemeen_bestuursrecht",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herroepen",
        gronden: "De motivering klopt niet en relevante feiten zijn gemist.",
        files: {},
      },
    });

    expect(letter).toContain("Wat de overheid mogelijk zal aanvoeren:");
    expect(letter).toContain("Hoe u daarop kunt reageren:");
    expect(letter).toContain("Wat gebeurt hierna?");
    expect(letter).toContain("Waar moet u op letten?");
    expect(letter).toContain("Praktische tip:");
    expect(letter.indexOf("Praktische tip:")).toBeLessThan(letter.indexOf("BIJLAGE A - SAMENVATTING VAN HET GESCHIL"));
  });

  test("29. prompt instrueert de nabrief-secties direct na de brief", () => {
    const prompt = buildLetterPrompt({
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herroepen",
        gronden: "De motivering klopt niet.",
        files: {},
      },
      product: "basis",
      payload: {
        flow: "bezwaar",
        caseType: "algemeen_bestuursrecht",
        route: "bezwaar_bestuursrecht",
        caseFacts: [],
        decisionMeta: [],
        selectedSources: [],
        validatedAuthorities: [],
        disallowedBehaviors: [],
      },
    });

    expect(prompt).toContain("Wat de overheid mogelijk zal aanvoeren:");
    expect(prompt).toContain("Hoe u daarop kunt reageren:");
    expect(prompt).toContain("Wat gebeurt hierna?");
    expect(prompt).toContain("Plaats deze nabrief-secties altijd direct na de brief en voor een eventuele dossierbijlage.");
  });

  test("30. detecteert relevante aanvullende argumenten zonder generieke checklist", () => {
    const analysis = buildCaseFileAnalysis({
      flow: "bezwaar",
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Utrecht",
        categorie: "wmo",
        doel: "toekenning van een passend pgb",
        gronden: "In het besluit staat alleen dat zorg in natura passend zou zijn.",
        persoonlijkeOmstandigheden:
          "Door mijn autisme en de onregelmatige werktijden van mijn partner is zorg in natura voor ons gezin niet werkbaar; met dit budget kan ik de noodzakelijke hulp ook niet inkopen.",
        files: {},
        besluitAnalyseStatus: "read",
        besluitAnalyse: {
          onderwerp: "Wmo pgb begeleiding",
          besluitInhoud: "De gemeente wijst het gevraagde pgb af omdat zorg in natura passend is.",
          dragendeOverwegingen: [
            {
              passage: "Zorg in natura is passend.",
              duiding: "passend alternatief volgens de gemeente",
            },
          ],
        },
      },
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "wmo_pgb",
        route: "bezwaar_bestuursrecht",
        caseTypeConfidence: 0.93,
        routeConfidence: 0.95,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "wmo_pgb",
          route: "bezwaar_bestuursrecht",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    const principles = analysis.relevanteAanvullendeArgumenten?.map((item) => item.principle) ?? [];

    expect(principles).toContain("motiveringsbeginsel");
    expect(principles).toContain("persoonlijke omstandigheden");
    expect(principles).toContain("financiële impact");
    expect(principles).not.toContain("gelijkheidsbeginsel");
    expect(
      analysis.relevanteAanvullendeArgumenten?.some(
        (item) => item.principle === "persoonlijke omstandigheden" && item.integrationMode === "direct"
      )
    ).toBeTruthy();
  });

  test("31. voegt zorgvuldigheid toe bij een Woo-zoekslag maar geen gelijkheidsbeginsel zonder basis", () => {
    const analysis = buildCaseFileAnalysis({
      flow: "woo",
      intakeData: {
        flow: "woo",
        bestuursorgaan: "Gemeente Zwolle",
        wooOnderwerp: "E-mails over een bouwproject",
        wooPeriode: "2024",
        wooDocumenten: "E-mails en notulen",
        doel: "volledige openbaarmaking",
        gronden: "Er moeten meer documenten zijn dan nu zijn gevonden.",
        files: {},
        besluitAnalyseStatus: "read",
        besluitAnalyse: {
          onderwerp: "Besluit op Woo-verzoek",
          besluitInhoud: "Volgens het bestuursorgaan zijn geen extra documenten gevonden.",
          dragendeOverwegingen: [
            {
              passage: "Er is gezocht in mailboxen en het zaaksysteem.",
              duiding: "beschrijving van de zoekslag",
            },
          ],
        },
      },
      guard: {
        ok: true,
        fallbackMode: "none",
        generationMode: "validated",
        reasons: [],
        hardBlockers: [],
        softSignals: [],
        missingFields: [],
        caseType: "woo",
        route: "bezwaar_woo_besluit",
        caseTypeConfidence: 0.97,
        routeConfidence: 0.93,
        selectedSourceSet: {
          ...sourceSet,
          caseType: "woo",
          route: "bezwaar_woo_besluit",
        },
        rejectedSources: [],
        validatedAuthorities: [],
        reviewedAuthorities: [],
        auditTrail: [],
      },
      reviewedAuthorities: [],
    });

    const zorgvuldigheid = analysis.relevanteAanvullendeArgumenten?.find(
      (item) => item.principle === "zorgvuldigheidsbeginsel"
    );

    expect(zorgvuldigheid?.integrationMode).toBe("direct");
    expect(zorgvuldigheid?.suggestedPhrasing).toContain("welk onderzoek is verricht");
    expect(
      analysis.relevanteAanvullendeArgumenten?.some((item) => item.principle === "gelijkheidsbeginsel")
    ).toBeFalsy();
  });

  test("32. prompt stuurt op direct of voorzichtig verwerken van aanvullende argumenten", () => {
    const prompt = buildLetterPrompt({
      intakeData: {
        flow: "bezwaar",
        bestuursorgaan: "Gemeente Amsterdam",
        categorie: "vergunning",
        doel: "herroepen",
        gronden: "De motivering klopt niet.",
        files: {},
      },
      product: "basis",
      payload: {
        flow: "bezwaar",
        caseType: "algemeen_bestuursrecht",
        route: "bezwaar_bestuursrecht",
        caseFacts: [],
        decisionMeta: [],
        decisionAnalysis: null,
        caseAnalysis: {
          module: "Algemeen bestuursrecht - bezwaar",
          procedurefase: "bezwaarfase",
          kernconflict: "Het bestuursorgaan wijst af zonder concrete uitleg.",
          primaireProcesrisicos: [],
          ontbrekendeInformatie: [],
          gerichteCheckvragen: [],
          onzekerheden: [],
          relevanteAanvullendeArgumenten: [
            {
              principle: "motiveringsbeginsel",
              relevance: "De dragende motivering blijft vooral conclusief.",
              support: "Dragende passage: de aanvraag is niet passend.",
              integrationMode: "direct",
              suggestedPhrasing:
                "De motivering blijft te abstract, omdat alleen een conclusie wordt genoemd.",
            },
            {
              principle: "evenredigheidsbeginsel",
              relevance: "De gevolgen voor de gebruiker zijn nog niet duidelijk afgewogen.",
              integrationMode: "cautious",
              suggestedPhrasing:
                "Daarnaast is van belang dat uit het besluit niet goed blijkt of de nadelige gevolgen in verhouding zijn gebracht tot het doel ervan.",
            },
          ],
        },
        selectedSources: [],
        validatedAuthorities: [],
        disallowedBehaviors: [],
      },
    });

    expect(prompt).toContain("Gebruik caseAnalysis.relevanteAanvullendeArgumenten");
    expect(prompt).toContain("integrationMode=direct");
    expect(prompt).toContain("integrationMode=cautious");
    expect(prompt).toContain("Daarnaast is van belang dat...");
    expect(prompt).toContain("In dit kader had het bestuursorgaan moeten...");
  });
});
