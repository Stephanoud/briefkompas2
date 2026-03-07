# Codex Prompt for VS Code - BriefKompas bronselectie en anti-hallucinatie

Dit document is een operationele instructie voor de code-integratie van bronselectie, routering en guardrails.

## Doel

Bouw een keten die juridisch veilige conceptbrieven genereert:

`intake -> classificatie -> routebepaling -> bronsetselectie -> validatie -> promptopbouw -> briefgeneratie -> eindcontrole`

## Harde bronnen

1. `docs/codex-legal-guardrails.md`
2. `config/source-map.json`
3. `lib/citation-guard.ts`

## Functionele eisen

- Intake classificeert minimaal naar: `woo`, `omgevingswet_vergunning`, `taakstraf`, `verkeersboete`, `belastingaanslag`, `uwv_uitkering`, `toeslag`.
- Bronselectie gebeurt uitsluitend via `config/source-map.json`.
- Routebepaling volgt procespad (geen simpele knoplabel-routering).
- Preflight-validatie is verplicht voor generatie.
- Jurisprudentie alleen bij geldige en geverifieerde ECLI.
- Promptopbouw scheidt feiten, besluitmetadata, bronnen en interpretatie-opdracht.
- Output bevat geen niet-geverifieerde bronnen of stellige claims zonder basis.

## Fallbackprotocol

- Ontbrekende bronset: veilige generieke conceptbrief, zonder jurisprudentie.
- ECLI-validatie faalt: verwijder uitspraak volledig.
- Zaaktype onzeker: verduidelijking vragen of veilige fallback.
- Conflicterende bronnen: prioriteit volgens source-map en conflict loggen.

## Logging

Log minimaal:

- gekozen zaaktype
- gekozen route
- geladen bronset
- afgewezen bronnen
- gevalideerde/verworpen ECLI
- reden van fallback
