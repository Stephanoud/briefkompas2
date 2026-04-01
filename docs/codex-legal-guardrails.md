# Codex Legal Guardrails

## Basisprincipes

- Gebruik alleen officiele of vooraf goedgekeurde bronnen.
- Geen verzonnen jurisprudentie, ECLI, wetsartikelen of procesroutes.
- Geen verzonnen citaten uit het besluit.
- Geen verzonnen termijnen, hoorzittingen, correspondentie of procescontacten.
- Geen aannames over de rol of status van de gebruiker zonder basis in dossier of intake.
- Geen beroep op "vaste jurisprudentie" zonder geverifieerde uitspraken.
- Geen module-aannames als het document duidelijk op een andere module wijst.
- Beschikkingstekst (termijn, adres, rechtsmiddelenclausule) gaat voor generieke webinformatie.
- Bij onzekerheid altijd terugschalen naar veilige conceptbrief zonder jurisprudentie.

## Toegestane domeinen

- wetten.overheid.nl
- overheid.nl
- rijksoverheid.nl
- iplo.nl
- belastingdienst.nl
- uwv.nl
- cjib.nl
- om.nl
- rechtspraak.nl
- uitspraken.rechtspraak.nl
- data.rechtspraak.nl
- raadvanstate.nl
- herstel.toeslagen.nl
- handboek.toeslagen.nl

## Zaaktypen

- woo
- omgevingswet_vergunning
- verkeersboete
- taakstraf
- belastingaanslag
- uwv_uitkering
- toeslag
- onzeker_handmatige_triage

## Verplichte preflight

Voor generatie moet worden gevalideerd:

- zaaktype heeft voldoende zekerheid
- route is toegestaan voor zaaktype
- bronset bestaat en gebruikt alleen allowlist-domeinen
- verplichte intakevelden zijn aanwezig
- jurisprudentie is gevalideerd (of wordt niet gebruikt)

## Jurisprudentiebeleid

Een ECLI wordt alleen opgenomen als:

- syntaxis geldig is
- bron op toegestaan domein staat
- metadata voldoende is gevalideerd
- topic matcht met zaaktype/route

Anders: uitspraak volledig weglaten.

## Promptregels

Promptpayload moet gescheiden blokken bevatten:

- `caseFacts`
- `decisionMeta`
- `selectedSources`
- `validatedAuthorities`
- `disallowedBehaviors`

LLM mag geen extra bronnen buiten dit pakket toevoegen.
