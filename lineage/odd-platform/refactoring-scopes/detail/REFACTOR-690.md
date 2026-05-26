## REFACTOR-690 — Code references 14+ i18n keys via `t('...')` that DO NOT exist in en.json (nor in any other locale) — `Data Quality`, `Data Modelling`, `Master Data`, `Query Examples`, `Add query example`, `Save lookup table`, `Table name`, `Enter business name`, `Link query`, etc.; the natural-keys pattern silently renders the KEY STRING; English users see correct text by accident, non-English users see English text on tab labels every other UI element translates

**Severity**: HIGH
**Category**: missing-i18n-key / silent-fallback-drift / accidentally-works-in-English-only
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-01 Search/Catalog (tab), P-03 Master Data (tab + Lookup Table forms), P-04 Data Quality (tab), P-05 Data Modelling (tab + Query Examples forms), P-02 Data Glossary (tab)]

**Surfaced by**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[0]` (HIGH) — "**Missing-key drift (HIGH, structural LSN-019/020 class)**: The codebase references 12+ keys via `t('...')` that do not exist in this file (en.json). Confirmed missing keys: `\"Data Quality\"` (`ToolbarTabs.tsx:46`), `\"Data Modelling\"` (`ToolbarTabs.tsx:51`), `\"Master Data\"` (`ToolbarTabs.tsx:56`), `\"Query Examples\"` (`QueryExamples.tsx:23`), `\"query examples overall\"` (`QueryExamples.tsx:25`), `\"Add query example\"` (`AssignEntityQueryExampleForm.tsx:47,67` + `QueryExamples.tsx:42`), `\"lookup table\"` (`LookupTableForm.tsx:77`), `\"Table name\"` (`LookupTableForm.tsx:90`), `\"Save lookup table\"` (`LookupTableForm.tsx:129`), `\"Add lookup table\"` (`LookupTableForm.tsx:129`), `\"Enter business name\"` (`InternalNameFormDialog.tsx:69`), `\"Link query\"` (`DataEntityDetailsQueryExamples.tsx:40`), `\"tab\"` (`QueryExampleDetailsContainer.tsx:31` + `QueryExampleDetailsTabs.tsx:38`), `\"Delete query example\"` and `\"Are you sure you want to delete this query example?\"` (`QueryExampleDetailsContainerActions.tsx:68,69`)."

- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "Three of nine tab labels have NO i18n key in any locale — 'Data Quality', 'Data Modelling', 'Master Data' are absent from en.json, es.json, ch.json, fr.json, ua.json, hy.json. `t('Data Quality')` returns the lookup-key literal string for every language."

**Statement**: The code references 14+ i18n keys via `t('...')` that DO NOT exist in en.json OR in any other locale file (`ch.json`, `es.json`, `fr.json`, `ua.json`, `hy.json`). The natural-keys pattern (ADR-CANDIDATE-011) + i18next's default `parseMissingKeyHandler: undefined` + the `fallbackLng: ['en', 'es', 'ch', 'fr', 'ua', 'hy']` chain (`i18n.ts:30`) means: i18next walks all six locales looking for the key; finds it in none; falls through to returning the KEY STRING itself. So `t('Data Quality')` returns the literal string 'Data Quality' — the English KEY rendered as the value.

The natural-keys pattern makes this "accidentally work" for English-locale users (the rendered string IS the English text). But every non-English locale ALSO renders the English key string for these missing entries:
- A French user navigating to the Data Quality tab sees 'Data Quality' in English.
- A Chinese user sees 'Data Quality' in English.
- A Ukrainian user sees 'Data Quality' in English.
- ... while the other 6 tabs (Catalog, Directory, Management, Dictionary, Alerts, Activity) ARE translated in their locale.

The visual UX: six tabs translated + three tabs in English on the non-English-locale toolbar. The inconsistency is operator-visible and erodes trust in the localization.

The 14+ confirmed missing keys span FIVE pillars:
- **P-01 Search/Catalog**: none (the Catalog tab is correctly keyed at en.json:103).
- **P-02 Data Glossary**: `tab`, `Delete query example`, `Are you sure you want to delete this query example?` (overlap with P-05).
- **P-03 Master Data**: `Master Data`, `lookup table`, `Table name`, `Save lookup table`, `Add lookup table`.
- **P-04 Data Quality**: `Data Quality`.
- **P-05 Data Modelling**: `Data Modelling`, `Query Examples`, `query examples overall`, `Add query example`, `Link query`, `tab` (overlapped).
- **Inline**: `Enter business name` (InternalNameFormDialog).

The missing keys are predominantly from FEATURES SHIPPED 2025-Q4 or later (per git blame inference — Master Data + Data Modelling are recent pillar additions). The pattern suggests: the contributor adding the new pillar's UI ALSO needs to add the i18n keys, and the contribution discipline did not include that step. The CI does not catch it (no static-analysis check for code-vs-en.json key parity, no test that fails on missing keys).

**Evidence**:
- en.json + grep verification (the 14+ keys are NOT present in en.json)
- ToolbarTabs.tsx:46 (`name: t('Data Quality')`)
- ToolbarTabs.tsx:51 (`name: t('Data Modelling')`)
- ToolbarTabs.tsx:56 (`name: t('Master Data')`)
- QueryExamples.tsx:23 (`title={t('Query Examples')}`) + line 25 + line 42
- LookupTableForm.tsx:77, 90, 129
- InternalNameFormDialog.tsx:69
- DataEntityDetailsQueryExamples.tsx:40
- QueryExampleDetailsContainer.tsx:31 + QueryExampleDetailsTabs.tsx:38
- QueryExampleDetailsContainerActions.tsx:68-69
- All five non-English locale files (ch/es/fr/hy/ua) — verified by grep that none has these 14+ keys

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-011 (natural-keys i18next pattern) IS the architectural anchor; this refactor is the OPERATOR-VISIBLE CONSEQUENCE of the natural-keys + chained-fallbackLng + no-missingKey-handler combination. The ADR documents the contract; this refactor is the silent-fallback gap the contract creates.

**Proposed remedy**: Two-part fix:

**Part A — Add the missing keys to en.json (mechanical)**:
1. Enumerate the 14+ confirmed missing keys (sidecar's `bugs_limitations_corner_cases[0]` provides the list).
2. Add each as a natural-keys entry to en.json (e.g. `"Data Quality": "Data Quality"`).
3. Propagate to ch.json / es.json / fr.json / hy.json / ua.json — each locale either adds the natural-keys entry OR a translation (the translator can decide per-locale).
4. Bundle the fix in a single i18n-completeness PR.

**Part B — Add a CI step to prevent regression** (couples with REFACTOR-693 NEW this batch):
- Write a script (Node, Python, or shell+jq) that:
  - Greps `t\\(['\"]([^'\"]+)['\"]\\)` across `odd-platform-ui/src/**/*.{ts,tsx}` to enumerate all referenced keys.
  - Reads en.json (and optionally each non-English locale) into memory.
  - Reports any referenced key NOT present in en.json (or in any other locale).
  - Fails the CI build if drift is detected.
- Adds the script to the package.json's `lint` or a dedicated `i18n-check` step.

Part A is the immediate fix; Part B prevents recurrence as new pillars are added.

Effort: Part A is 1-2 hours (the list is 14+ keys; some can be natural-keys, some may want translation). Part B is 2-4 hours for the CI script + integration.

**Severity rationale**: HIGH — affects every non-English user across three primary navigation tabs (the most prominent UI surface) AND multiple form / button labels in the affected pillars. The natural-keys pattern hides this from English users, so the defect has been shipping silently. Operator-impact: erodes localization trust + introduces an English-locale-bias for newly-added features.

**Suggested backlog grouping**: `i18n completeness sprint` — couple with REFACTOR-691 NEW this batch (locale-set drift across the six files), REFACTOR-692 NEW this batch (Statuses partial-translation), REFACTOR-693 NEW this batch (no missingKey handler), REFACTOR-030 (six-element fallbackLng chain), REFACTOR-039 (localStorage unguarded). The full i18n-completeness sprint surfaces a coherent multi-locale UX baseline.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-691 NEW (locale-set drift), REFACTOR-693 NEW (no missingKey handler), REFACTOR-030 (fallbackLng chain); ADR-CANDIDATE-011 (natural-keys pattern — the contract this refactor's gap arises from); ADR-CANDIDATE-235 NEW (the 9 hard-coded tabs — three of which are the most visible missing-key surfaces).
- SUPERSEDES: none.
- CONFLICTS: none.

---
