import { Flow, IntakeFormData } from "@/types";
import { CaseType, RouteDeterminationResult, RouteType } from "@/lib/legal/types";

function flattenInput(data: IntakeFormData): string {
  return [
    data.bestuursorgaan,
    data.categorie,
    data.doel,
    data.gronden,
    data.kenmerk,
    data.wooOnderwerp,
    data.wooPeriode,
    data.wooDocumenten,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function determineRoute(input: {
  flow: Flow;
  caseType: CaseType;
  intakeData: IntakeFormData;
}): RouteDeterminationResult {
  const { flow, caseType, intakeData } = input;
  const text = flattenInput(intakeData);

  const pick = (route: RouteType, confidence: number, reason: string): RouteDeterminationResult => ({
    route,
    confidence,
    reasons: [reason],
  });

  if (caseType === "niet_tijdig_beslissen") {
    if (flow === "woo" || hasAny(text, ["woo", "wet open overheid"])) {
      return pick("woo_niet_tijdig_beslissen", 0.97, "Niet tijdig beslissen in Woo-context gedetecteerd.");
    }

    return pick("beroep_niet_tijdig_beslissen", 0.97, "Niet tijdig beslissen volgt de aparte beroepsroute.");
  }

  if (flow === "zienswijze") {
    return pick("zienswijze_bestuursrecht", 0.96, "Procedurecheck wijst op zienswijze.");
  }

  if (flow === "beroep_zonder_bezwaar") {
    return pick(
      "beroep_rechtstreeks_bestuursrecht",
      0.96,
      "Procedurecheck wijst op rechtstreeks beroep zonder bezwaar."
    );
  }

  if (flow === "beroep_na_bezwaar") {
    return pick(
      "beroep_na_bezwaar_bestuursrecht",
      0.97,
      "Procedurecheck wijst op beroep tegen een beslissing op bezwaar."
    );
  }

  if (
    flow === "bezwaar" &&
    (
      caseType === "algemeen_bestuursrecht" ||
      caseType === "bestuurlijke_boete" ||
      caseType === "wmo_pgb" ||
      caseType === "handhaving" ||
      caseType === "niet_ontvankelijkheid"
    )
  ) {
    return pick(
      "bezwaar_bestuursrecht",
      0.95,
      caseType === "bestuurlijke_boete"
        ? "Procedurecheck wijst op de reguliere Awb-bezwaarroute voor een bestuurlijke boete."
        : caseType === "wmo_pgb"
          ? "Procedurecheck wijst op de reguliere Awb-bezwaarroute voor een Wmo/PGB-besluit."
          : caseType === "handhaving"
            ? "Procedurecheck wijst op de reguliere Awb-bezwaarroute voor een handhavingsbesluit."
            : caseType === "niet_ontvankelijkheid"
              ? "Procedurecheck wijst op de reguliere route voor een ontvankelijkheidsgeschil."
        : "Procedurecheck wijst op de standaard bezwaarrroute."
    );
  }

  switch (caseType) {
    case "woo": {
      if (hasAny(text, ["bezwaar", "afwijzing", "weigering", "besluit op woo"])) {
        return pick("bezwaar_woo_besluit", 0.8, "Intake wijst op bezwaar tegen Woo-besluit.");
      }
      return pick("woo_verzoek", 0.95, "Intake wijst op nieuw Woo-verzoek.");
    }
    case "bestuurlijke_boete": {
      return pick("bezwaar_bestuursrecht", 0.9, "Bestuurlijke boete volgt in beginsel de reguliere Awb-route.");
    }
    case "wmo_pgb": {
      return pick("bezwaar_bestuursrecht", 0.9, "Wmo/PGB-besluiten volgen in beginsel de reguliere Awb-route.");
    }
    case "handhaving": {
      return pick("bezwaar_bestuursrecht", 0.9, "Handhavingsbesluiten volgen in beginsel de reguliere Awb-route.");
    }
    case "niet_ontvankelijkheid": {
      return pick("bezwaar_bestuursrecht", 0.9, "Ontvankelijkheidsgeschillen volgen in beginsel de reguliere Awb-route.");
    }
    case "omgevingswet_vergunning": {
      if (hasAny(text, ["afdeling 3.4", "uitgebreide procedure", "zienswijze", "ontwerpbesluit", "beroep"])) {
        return pick("zienswijze_of_beroep", 0.88, "Signalen voor uitgebreide procedure gedetecteerd.");
      }
      return pick("bezwaar_awb", 0.86, "Reguliere bezwaarrroute omgevingswet.");
    }
    case "verkeersboete": {
      if (hasAny(text, ["kantonrechter", "beroep rechtbank"])) {
        return pick("beroep_kantonrechter", 0.82, "Intake wijst op kantonrechterroute.");
      }
      return pick("administratief_beroep_ovj", 0.9, "Standaard Mulder-route via OvJ.");
    }
    case "taakstraf": {
      if (hasAny(text, ["strafbeschikking", "verzet"])) {
        return pick("verzet_strafbeschikking", 0.86, "Intake wijst op verzet tegen strafbeschikking.");
      }
      return pick("bezwaar_omzettingskennisgeving", 0.84, "Intake wijst op bezwaar omzettingskennisgeving.");
    }
    case "belastingaanslag": {
      if (hasAny(text, ["beroep", "belastingrechter", "rechtbank"])) {
        return pick("beroep_belastingrechter", 0.78, "Intake wijst op beroepsfase belastingrechter.");
      }
      return pick("bezwaar_fiscaal", 0.92, "Standaard fiscale bezwaarrroute.");
    }
    case "uwv_uitkering": {
      return pick("bezwaar_uwv", 0.9, "UWV-besluiten volgen standaard bezwaarroute.");
    }
    case "toeslag": {
      if (hasAny(text, ["uht", "herstel", "hersteloperatie"])) {
        return pick("bezwaar_uht", 0.9, "UHT/herstelroute gedetecteerd.");
      }
      if (hasAny(text, ["definitieve berekening"])) {
        return pick(
          "bezwaar_definitieve_berekening",
          0.86,
          "Definitieve berekening toeslag gedetecteerd."
        );
      }
      return pick("bezwaar_toeslagen", 0.88, "Standaard toeslagenbezwaar.");
    }
    default:
      return pick("handmatige_triage", 0.2, "Zaaktype onzeker, handmatige triage vereist.");
  }
}
