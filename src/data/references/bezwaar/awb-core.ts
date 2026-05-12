import { ReferencePack } from "@/src/types/references";

export const bezwaarAwbCore: ReferencePack = {
  packId: "bezwaar-awb-core",
  label: "Algemene Awb-grondslagen voor bezwaar",
  flow: "bezwaar",
  items: [
    {
      id: "awb-3-2-zorgvuldigheid",
      title: "Artikel 3:2 Awb",
      sourceType: "wet",
      citation: "Artikel 3:2 Algemene wet bestuursrecht",
      topic: "zorgvuldige voorbereiding",
      principle:
        "Het bestuursorgaan moet de relevante feiten en belangen zorgvuldig vaststellen voordat een besluit wordt genomen.",
      keywords: ["zorgvuldigheid", "onderzoek", "feiten", "onvoldoende onderzoek", "dossier"],
      flow: "bezwaar",
    },
    {
      id: "awb-3-4-evenredigheid",
      title: "Artikel 3:4 lid 2 Awb",
      sourceType: "wet",
      citation: "Artikel 3:4 lid 2 Algemene wet bestuursrecht",
      topic: "evenredigheid en belangenafweging",
      principle:
        "De nadelige gevolgen van een besluit mogen niet onevenredig zijn in verhouding tot de met het besluit te dienen doelen.",
      keywords: ["evenredig", "onevenredig", "belangenafweging", "proportioneel", "gevolgen"],
      flow: "bezwaar",
    },
    {
      id: "rvs-2022-285-harderwijk-evenredigheid",
      title: "ABRvS 2 februari 2022",
      sourceType: "jurisprudentie",
      ecli: "ECLI:NL:RVS:2022:285",
      citation: "ABRvS 2 februari 2022, ECLI:NL:RVS:2022:285",
      topic: "evenredigheid en concrete belangenafweging",
      principle:
        "Bij besluiten met beleidsruimte moeten doel, geschiktheid, noodzaak, evenwichtigheid en de concrete gevolgen voor belanghebbenden zichtbaar worden meegewogen.",
      keywords: [
        "evenredigheid",
        "belangenafweging",
        "persoonlijke omstandigheden",
        "gezondheid",
        "gevolgen",
        "noodzaak",
        "evenwichtigheid",
        "Harderwijk",
      ],
      flow: "bezwaar",
    },
    {
      id: "awb-3-46-motivering",
      title: "Artikel 3:46 Awb",
      sourceType: "wet",
      citation: "Artikel 3:46 Algemene wet bestuursrecht",
      topic: "deugdelijke motivering",
      principle:
        "Een besluit moet berusten op een draagkrachtige, kenbare en controleerbare motivering.",
      keywords: ["motivering", "ondeugdelijk", "onvoldoende onderbouwd", "reden", "uitleg"],
      flow: "bezwaar",
    },
    {
      id: "rvs-2022-3903-geluid-woon-leefklimaat",
      title: "ABRvS 21 december 2022",
      sourceType: "jurisprudentie",
      ecli: "ECLI:NL:RVS:2022:3903",
      citation: "ABRvS 21 december 2022, ECLI:NL:RVS:2022:3903",
      topic: "geluidhinder en woon- en leefklimaat",
      principle:
        "Bij geluidhinder moet het bestuursorgaan onderzoeken of directe, indirecte en cumulatieve geluidbelasting het woon- en leefklimaat aanvaardbaar laten en dat deugdelijk motiveren.",
      keywords: [
        "geluid",
        "geluidsoverlast",
        "geluidhinder",
        "geluidsnorm",
        "geluidsmetingen",
        "akoestisch onderzoek",
        "cumulatie",
        "woon- en leefklimaat",
        "motivering",
        "zorgvuldigheid",
      ],
      flow: "bezwaar",
    },
    {
      id: "awb-6-7-termijn",
      title: "Artikel 6:7 Awb",
      sourceType: "wet",
      citation: "Artikel 6:7 Algemene wet bestuursrecht",
      topic: "bezwaartermijn",
      principle:
        "De wettelijke termijn voor het indienen van bezwaar bedraagt in beginsel zes weken.",
      keywords: ["termijn", "zes weken", "bezwaartermijn", "te laat", "tijdig"],
      flow: "bezwaar",
    },
    {
      id: "awb-7-2-hoorplicht",
      title: "Artikel 7:2 Awb",
      sourceType: "wet",
      citation: "Artikel 7:2 Algemene wet bestuursrecht",
      topic: "hoorplicht",
      principle:
        "In de bezwaarfase moet de indiener in beginsel worden gehoord voordat op het bezwaar wordt beslist.",
      keywords: ["horen", "hoorzitting", "zienswijze", "toelichten", "mondeling"],
      flow: "bezwaar",
    },
    {
      id: "awb-7-11-heroverweging",
      title: "Artikel 7:11 Awb",
      sourceType: "wet",
      citation: "Artikel 7:11 Algemene wet bestuursrecht",
      topic: "volledige heroverweging",
      principle:
        "Het bestuursorgaan moet het bestreden besluit in bezwaar volledig heroverwegen.",
      keywords: ["heroverweging", "volledig", "opnieuw beoordelen", "bezwaarfase", "nieuw besluit"],
      flow: "bezwaar",
    },
  ],
};
