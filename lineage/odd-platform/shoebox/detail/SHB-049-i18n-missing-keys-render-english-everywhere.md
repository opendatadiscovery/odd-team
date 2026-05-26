# SHB-049 — 14+ code-referenced i18n keys missing from en.json; every non-English locale silently shows English text for top-level navigation, Lookup Tables form, Query Examples flows

**Category**: clustering
**Severity**: HIGH

## Hypothesis

The platform UI ships six locales (English, Spanish, Chinese, French, Ukrainian, Armenian per F-043's six-locale i18next bootstrap). Across the SPA, 14+ user-visible labels are referenced via `t('...')` call sites whose keys do NOT exist in `en.json` (the canonical English source). i18next's `fallbackLng` chain walks `en → es → ch → fr → ua → hy`; none of the six locales has these keys; i18next's default `parseMissingKeyHandler: undefined` falls through to returning the KEY STRING itself. The English UI accidentally works (the key IS the English text via the natural-keys pattern), but every non-English-locale user sees ENGLISH text rendered for keys including the top-level navigation labels "Data Quality", "Data Modelling", "Master Data"; the Lookup Tables form labels "Save lookup table", "Add lookup table", "Table name", "Enter business name", "lookup table"; the Query Examples flow labels "Query Examples", "Add query example", "Link query", "Delete query example", "Are you sure you want to delete this query example?"; plus secondary labels. A French / Spanish / Chinese / Ukrainian / Armenian user navigating to "Quality Dashboard" → "Master Data" → creating a Lookup Table sees a UI that switches mid-flow between localised labels (translated keys that DO exist) and English labels (missing keys that fall through). The localisation product-feature is partial; the platform claims multilingual UI but ships per-page English bleed-through that no automated build step or test catches.

## Evidence

- `odd-platform-ui/src/locales/translations/en.json` — verified absence of the 14+ enumerated keys (per the en.json sidecar `bugs_limitations_corner_cases[0]`): `"Data Quality"`, `"Data Modelling"`, `"Master Data"` (`ToolbarTabs.tsx:46,51,56`); `"Query Examples"`, `"query examples overall"`, `"Add query example"` (`QueryExamples.tsx`, `AssignEntityQueryExampleForm.tsx`); `"lookup table"`, `"Table name"`, `"Save lookup table"`, `"Add lookup table"` (`LookupTableForm.tsx:77,90,129`); `"Enter business name"` (`InternalNameFormDialog.tsx:69`); `"Link query"`, `"tab"`, `"Delete query example"`, `"Are you sure you want to delete this query example?"` (multiple Query-Example call sites). All 14+ verified absent across all six locale files.
- `odd-platform-ui/src/locales/i18n.ts:27-31` — the i18next init call has only `resources`, `lng`, `fallbackLng`; no `missingKeyHandler`, no `saveMissing`, no `parseMissingKeyHandler` — the silent-fall-through is the default.
- `odd-platform-ui/src/locales/i18n.ts:30` — `fallbackLng: ['en','es','ch','fr','ua','hy']`. English is first; if a key exists in `en.json` it serves every locale (the natural-keys cover). When the key is absent from ALL six, the rendered text IS the key string.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:46,51,56` — the three top-level navigation tab labels are missing from en.json — meaning every non-English-locale user sees the English navigation in their otherwise-translated chrome.
- `odd-platform-ui/src/components/MasterData/LookupTables/LookupTableForm.tsx:77,90,129` — three form labels in the Lookup Tables create / edit flow are missing from en.json. Combined with SHB-046 (Lookup Tables list shows 30 max) and SHB-047 (rename breaks downstream), this means the entire P-03 pillar's UX has both functional defects AND localisation defects.
- Per locale-line-count from the en.json sidecar `bugs_limitations_corner_cases[1]`: `wc -l` on the six files: en=418, ch=415, fr=415, es=414, hy=414, ua=414. Even WITHIN the keys that DO exist in en.json, the non-English locales drop 3-4 entries each — additional silent English bleed.

## Notes

- This is an ENRICHER for F-043 (Multilingual UI — six-locale i18next, silent missing-key fallback). F-043 anchors the silent-fallback architectural design; this thread anchors the CONCRETE CONSEQUENCE — the 14+ specific keys missing today, the operator-visible features affected (top-level navigation, Master Data lifecycle, Query Examples lifecycle), and the absence of any CI guard.
- The bug class is methodology-load-bearing: it is a **drift between the code (the t() call sites) and the resource bundle (en.json)** with NO build-time check, NO test, NO CI step, and NO runtime warning. The fix exists at three layers:
  - **(a) Add the missing keys to en.json**: mechanical, low-cost, one-time. But every future regression of the same shape reappears.
  - **(b) Wire `missingKeyHandler` in `i18n.ts`**: i18next's `parseMissingKeyHandler: (lng, ns, key) => { console.error('MISSING KEY', { lng, ns, key }); return key; }` would emit a structured log on every missing key — surfaces the drift in development browsers without a build step.
  - **(c) CI script**: enumerate `t\(['"]([^'"]+)['"]\)` across `odd-platform-ui/src/`, assert each key exists in `en.json` AND each non-English locale, fail the build on drift. This is the durable fix — covers (a) AND prevents regression AND enforces locale parity.
- The Activity Feed `"User"` filter label is in en.json but represents a DIFFERENT drift class (LSN-020 — label vs SQL-implementation drift, handled in F-021 + DOC-GAP-303). NOT this thread's scope.
- The natural-keys pattern (the SPA's i18next convention that keys ARE the English source phrase) is the design that ENABLES the silent fallback — without natural-keys, missing-key would render `[null]` or `[key:Data Quality]` and operators would immediately notice. The convention is good for English contributors (no extra resource-file edit per new label); bad for non-English users (silent English bleed). The fix needs to PRESERVE the natural-keys pattern AND enforce the absence-of-drift.
- This thread also enriches F-041 (Application Toolbar — unconditional render) tangentially — F-041 already notes the toolbar shows the top-level tabs unconditionally; this thread adds that the top-level TAB LABELS are not localised when missing.

## Next

1. **Add the 14+ missing keys to en.json + propagate to the other five locales**: mechanical, low-cost, one-time. Should be a single DOC-NNN / TEST-NNN PR. Cite this thread as the source-of-evidence.
2. **Wire the CI guard**: enumerate `t\(['"]([^'"]+)['"]\)` across `odd-platform-ui/src/` (single grep), build a JSON of keys, assert presence in en.json AND each non-English locale. Add a `package.json` script `npm run i18n:check`, wire into the CI workflow. This is REFACTOR-NNN.
3. **Wire `missingKeyHandler` in `i18n.ts`**: console-level surfacing in development; opt-in production logging. Low-cost.
4. **Promote**: this is a clear enricher for F-043. The feature-flow-builder folds it into F-043 as `drift_class: missing_keys_silent_english_bleed` with the concrete enumerated list.
5. **DOC-NNN**: the docs page `docs.opendatadiscovery.org/features/active-platform-features/multilingual-ui` (if it exists per F-043's discovery) — must state the natural-keys pattern, the silent-fallback contract, and reference the CI guard. If the page does NOT exist, that is itself a DOC-NNN.

## Links

- cluster_with: [F-043, F-041, F-026, SHB-147, SHB-148, SHB-149]
- merged_into: (open — cluster pending Slice H1 i18n threads)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: leave-as-note + cluster — i18n thread sits at the intersection of P-08 (F-043 Multilingual UI) and the cross-pillar surfaces (P-02 Query Examples, P-03 Lookup Tables) whose missing keys this thread enumerates. Per the slice brief's hint, SHB-147/148/149 from Slice H1 may carry sibling i18n threads — if so the cluster should be bidirectional. Without sight of those sibling threads in this slice, the safe verdict is leave-as-note with the cluster_with set extended to include SHB-147/148/149 speculatively (the next pass — if those siblings exist — will reciprocate). Next-pass graduation criterion: when Slice H1's i18n threads land their evaluations, reconsider as a single graduation — likely "P-08:F-014 i18n Build-Time Validation Contract" (Code↔Resource-bundle drift with CI guard). Current evidence (14+ enumerated missing keys, 6-locale fallback chain spec) is graduation-ready; deferring to allow bidirectional cluster reconciliation. F-NNN allocation range (F-054..F-063) has 4 unused slots after this slice (F-060..F-063) — sufficient capacity for the next pass to graduate.
