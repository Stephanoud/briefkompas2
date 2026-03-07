# Guardrail Integration Changelog

## 2026-03-06

### Nieuwe guardrail-basis
- `docs/CODEX_PROMPT_VSCODE.md` toegevoegd als operationele integratie-opdracht.
- `docs/codex-legal-guardrails.md` toegevoegd als beleids- en veiligheidskader.
- `config/source-map.json` toegevoegd als machineleesbare bronconfig en route-allowlist.
- `lib/citation-guard.ts` toegevoegd voor domein- en ECLI-validatie.

### Nieuwe pipeline-modules
- `lib/legal/types.ts`: centrale types voor CaseType, RouteType, SourceSet, PromptPayload en guard-resultaat.
- `lib/intake/classifyCase.ts`: intakeclassificatie naar zaaktype.
- `lib/intake/determineRoute.ts`: procedure-routebepaling.
- `lib/intake/requiredFields.ts`: verplichte velden per flow.
- `lib/sources/loadSourceSet.ts`: bronsetselectie uit source-map.
- `lib/sources/validateSourceSet.ts`: bronset-allowlistvalidatie.
- `lib/sources/validateAuthorities.ts`: validatie van referenties/citaties.
- `lib/ai/buildLetterPrompt.ts`: gestructureerde promptopbouw.
- `lib/ai/generateLetter.ts`: LLM-aanroep met strikte system-instructie.

### API refactor
- `app/api/generate-letter/route.ts` omgezet naar guardrail-keten:
  `classificatie -> route -> source set -> preflight -> prompt -> generatie`
- Veilig fallback-protocol toegevoegd bij onzekerheid of validatiefouten.
- Audit trail en guard-resultaat toegevoegd aan API-respons.

### Intake UX
- `lib/intake/bestuursorganen.ts` toegevoegd met suggestielijst.
- `app/intake/[flow]/page.tsx` uitgebreid met datalist-autocomplete voor `bestuursorgaan`.
