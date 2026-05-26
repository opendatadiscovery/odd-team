---
doc_gap_id: DOC-GAP-309
severity: HIGH
category: drift
batch: ZJ
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"     # Data Quality tab — Quality Dashboard landing
  - "P-05:F-031"     # Data Modelling tab — Query Examples landing
  - "P-03:F-029"     # Master Data tab — Lookup Tables landing
related_features: []
related_doc_gaps:
  - DOC-GAP-020      # Locale Bundle / Multilingual UI missing-page (F-047)
  - DOC-GAP-027      # Locale-bundle CSP / localStorage caveat
  - DOC-GAP-307      # UI-shell canonical doc page absent
  - DOC-GAP-308      # Label↔URL drift on 4 primary tabs
  - DOC-GAP-310      # Locale-set drift + no missing-key handler (sibling i18n surface)
related_retrospectives:
  - LSN-019          # ordering-stress class (silent fallback)
  - LSN-020          # name-vs-implementation drift class
  - LSN-001          # operator-trap canonical
---

## DOC-GAP-309 — Three of the nine primary navigation tab labels — `Data Quality`, `Data Modelling`, `Master Data` — have NO i18n key in ANY of the 6 locale bundles (`en.json`, `es.json`, `ch.json`, `fr.json`, `hy.json`, `ua.json`); `ToolbarTabs.tsx:46,51,56` calls `t('Data Quality')` / `t('Data Modelling')` / `t('Master Data')` but the keys are absent from `en.json`, so i18next's natural-keys default returns the lookup-key string itself; the English UI accidentally works (the key IS the English label); EVERY non-English UI shows the same English text because the missing-key fall-through resolves to the literal key, NOT to a locale translation; a Ukrainian operator sees "Активність / Сповіщення / Каталог / **Data Quality** / **Data Modelling** / **Master Data** / Менеджмент / Словник / Директорія" — six tabs translated, three untranslated; the gap is INVISIBLE in development (the English UI looks fine), undetected by CI (no key-parity check exists per en.json sidecar), and uniformly shipped across all 6 locales since the three pillar-rename tabs were added — F-047 / DOC-GAP-020 surfaces the multilingual UI as a missing-page concern, but this is a CONCRETE CONTENT-LEVEL DRIFT inside the multilingual UI surface

**Severity**: HIGH
**Category**: drift (i18n content drift on the load-bearing top-navigation surface; LSN-019/LSN-020 class — silent natural-keys fallback is the i18next default + the platform has no missing-key handler wired)

### Surfaced by

- `odd-platform__json__locales_translations__i18n-resource__en.md:docs_link_semantic.doc_drift_findings[2]` ("Code references 12+ keys that DO NOT exist in this file (en.json) — notably `t('Data Quality')`, `t('Data Modelling')`, `t('Master Data')` (top-level navigation labels in `ToolbarTabs.tsx:46,51,56`)... The natural-keys pattern means the rendered text falls through to the KEY STRING — so the English UI accidentally works. But every non-English locale ALSO renders the English key string for these missing entries (verified: the missing keys are absent across all six locales). The doc surface does not document the natural-keys fallback contract; a contributor reading the docs has no way to know that a typo in a t() key call site fails silently.") **(NEW batch ZJ — en.json sidecar PRIMARY SOURCE)**
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[0]` ("**Missing-key drift (HIGH, structural LSN-019/020 class)**: The codebase references 12+ keys via `t('...')` that do not exist in this file (en.json). Confirmed missing keys: `\"Data Quality\"` (`ToolbarTabs.tsx:46`), `\"Data Modelling\"` (`ToolbarTabs.tsx:51`), `\"Master Data\"` (`ToolbarTabs.tsx:56`)...") **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:bugs_limitations_corner_cases[1]` ("Three of nine tab labels have NO i18n key in any locale — 'Data Quality', 'Data Modelling', 'Master Data' are absent from en.json, es.json, ch.json, fr.json, ua.json, hy.json. `t('Data Quality')` returns the lookup-key literal string for every language. Operator-visible impact: a Ukrainian user sees 'Активність / Сповіщення / Каталог / Data Quality / Data Modelling / Master Data / Менеджмент / Словник / Директорія' — six tabs translated, three untranslated.") **(NEW batch ZJ — ToolbarTabs sidecar CORROBORATING SOURCE)**

### Evidence

- `odd-platform-ui/src/locales/translations/en.json` (primary source — full read this session via en.json sidecar enrichment): grep for `"Data Quality"`, `"Data Modelling"`, `"Master Data"` returns ZERO matches; the file has 418 entries, none with these three keys.
- `odd-platform-ui/src/locales/translations/{es,ch,fr,hy,ua}.json` (per en.json sidecar bugs[0] — verified across all 5 non-English bundles): same three keys absent in EVERY non-English locale.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:46` — `{ name: t('Data Quality'), link: dataQualityPath(), value: 'data-quality' }`
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:51` — `{ name: t('Data Modelling'), link: queryExamplesPath(), value: 'data-modelling' }`
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:56` — `{ name: t('Master Data'), link: lookupTablesPath(), value: 'master-data' }`
- `odd-platform-ui/src/locales/i18n.ts:27-31` — `i18n.use(initReactI18next).init({ resources, lng, fallbackLng })` — NO `missingKeyHandler`, NO `parseMissingKeyHandler`, NO `saveMissing` configured. The default i18next behaviour for a complete fall-through miss is to return the lookup-key STRING ITSELF (i.e. the literal `'Data Quality'`).
- `odd-platform-ui/src/locales/i18n.ts:30` — `fallbackLng: ['en','es','ch','fr','ua','hy']` — the 6-element fall-through chain. Even with English first in the chain, the absence of the key in en.json means the chain never finds a match; i18next falls through to returning the key.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-26 status **200** — verbatim: NO mention of multilingual UI, locales, language selection, supported languages, translation contributor guide. F-047 / DOC-GAP-020 already documents this absence as a missing-page; this finding adds the CONCRETE CONTENT DRIFT inside that surface.
- WebFetch `https://docs.opendatadiscovery.org/active-platform-features/ui-overview` 2026-05-26 status **404** — confirmed this session; no UI-shell page hosts a "Supported locales / known translation gaps" section.

### Drift narrative

The Open Data Discovery SPA ships six locale bundles (English / Spanish / Chinese / French / Ukrainian / Armenian) and a language switcher in the user menu. The maintenance contract is: every `t('<key>')` call site has a matching entry in en.json, and every non-English bundle mirrors the en.json key set. The contract is enforced by NOTHING — no CI step validates code-to-resource key parity, no CI step validates locale-to-locale key parity, and the i18next instance is configured WITHOUT a missing-key handler (per `i18n.ts:27-31`). Silent failure is the default.

Three of the nine primary-navigation tab labels — `Data Quality`, `Data Modelling`, `Master Data` — are absent from the en.json bundle. The natural-keys pattern (417 of 418 en.json entries have `key === value`) means the English UI accidentally works: a missing key falls through to the key string itself, which happens to be the English label. But every non-English locale ALSO renders the English key string for these three tabs (because the fall-through chain never finds a non-English translation for a key that doesn't exist in the source bundle). A Ukrainian operator who switches the UI to Ukrainian sees:

- Активність (Activity) — translated
- Сповіщення (Alerts) — translated
- Каталог (Catalog) — translated
- **Data Quality** — UNTRANSLATED (English literal)
- **Data Modelling** — UNTRANSLATED (English literal)
- **Master Data** — UNTRANSLATED (English literal)
- Менеджмент (Management) — translated
- Словник (Dictionary) — translated
- Директорія (Directory) — translated

The pattern is identical for Spanish / Chinese / French / Armenian. The three missing-key tabs are uniformly the same three across all 5 non-English locales — strongly suggesting the three pillar-rename tabs (Data Quality, Data Modelling, Master Data) were added to the toolbar AFTER the last locale-corpus sync, and the en.json + 5-locale propagation was never completed.

The operator-impact:

1. **Localized-UI contributors lose trust**: a Spanish-speaking team rolling out ODD to non-English-speaking analysts ships an inconsistent UI where 6 of 9 primary tabs are translated and 3 are not. The operator cannot tell whether (a) the platform doesn't support localization for those tabs, or (b) the platform has a translation bug. The platform's multilingual-UI promise is structurally undermined.
2. **Doc-product asymmetry**: per F-047 / DOC-GAP-020 the multilingual-UI feature is unmentioned across the doc site; combined with this gap, the FIRST thing a Spanish operator notices when switching the UI to Spanish is the three untranslated tabs. The doc-product surface does not warn about this and does not provide a contributor-guide pointer for the missing translations.
3. **Silent failure mode for future contributors**: a contributor adding a new tab via `t('New Tab Name')` without updating en.json sees the English UI work; the bug surfaces only when a non-English user encounters the new tab. The platform has no CI / static-analysis gate for this contract; the en.json sidecar names it as a HIGH-severity structural gap.

### Proposed doc action

**Three-part action — code-side and doc-side BOTH apply.**

1. **Code-side PRIMARY** — file `/log-issue odd-platform` for a 2-edit fix:
   - **(a)** Add the three missing keys to `odd-platform-ui/src/locales/translations/en.json` (one-line addition per key — the natural-keys pattern means `"Data Quality": "Data Quality"`, `"Data Modelling": "Data Modelling"`, `"Master Data": "Master Data"`).
   - **(b)** Propagate to the 5 non-English bundles with proper translations: `es.json` → "Calidad de los datos" / "Modelado de datos" / "Datos maestros"; `ch.json` → "数据质量" / "数据建模" / "主数据"; `fr.json` → "Qualité des données" / "Modélisation des données" / "Données de référence"; `ua.json` → "Якість даних" / "Моделювання даних" / "Основні дані"; `hy.json` → "Տվյալների որակ" / "Տվյալների մոդելավորում" / "Հիմնական տվյալներ". (Translations are illustrative; the ODD maintainer should validate with native speakers OR delegate to a community-translation pass.)
   - **(c)** Optionally — wire a `missingKeyHandler` in `i18n.ts` that warns to console in development and records the missing key in a Sentry-like sink in production; this prevents future contributors from shipping the same drift silently.

2. **Code-side OPTIONAL SAFETY NET** — file `/log-issue odd-platform` for a CI / pre-commit script that:
   - Enumerates every `t\(['\"](...)['\"]\)` call site in `odd-platform-ui/src/`.
   - Asserts each enumerated key has a matching entry in en.json.
   - Asserts each en.json key has a matching entry in every non-English locale.
   - Fails the build on any drift.
   Pairs with DOC-GAP-310 NEW (the locale-set-drift companion finding).

3. **Doc-side COMPANION** — in DOC-GAP-307 NEW's proposed `features/ui-overview.md` page, the "Language selection" section needs a "Known translation gaps" sub-section listing the current state (English source of truth; 5 non-English locales mirror with X / Y / Z completeness; contributors who notice an untranslated label can submit a PR with the missing key). After the code-side fix lands, this section can shrink to a contributor-guide pointer; until then it WARNS operators of the gap.

### Cross-references

- **DOC-GAP-020 + DOC-GAP-027 + F-047** (Multilingual UI / Locale Bundle missing-page) — this finding is the CONCRETE CONTENT-DRIFT instance inside the missing-page surface; once F-047 ships, this finding's caveat sub-section is its natural home
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — this finding's "Known translation gaps" sub-section belongs there
- **DOC-GAP-310 NEW** (locale-set drift + no missing-key handler) — sibling i18n surface; both share the same code-side fix (CI key-parity check) + same doc-side fix (contributor-guide)
- **DOC-GAP-303** (Activity Feed User-filter LSN-020) — sibling LSN-020 instance at the i18n channel; both gaps ship to every locale uniformly via the natural-keys pattern, both demonstrate "the i18n layer is the channel through which the misleading content reaches every user"
- **DOC-GAP-308 NEW** (label↔URL drift on 4 primary tabs) — sibling toolbar surface; both findings affect the same 9-tab nav widget
- **LSN-019** (ordering-stress class — silent fallback) — i18next's natural-keys fallback is the canonical "silent fallback returns sensible-looking but wrong content" pattern at the UI surface
- **LSN-020** (name-vs-implementation drift class) — the i18n channel surfaces the toolbar-vocabulary contract; missing keys mean the contract is enforced by nothing
- **LSN-001** (operator-trap canonical) — operator-impact is operator-trust ("the platform supports multilingual UI" / "but my team's locale shows English on three primary tabs")

### Severity rationale

HIGH — operator-impact on a load-bearing surface (the 9-tab top navigation visible on every page to every user under all 4 auth modes), uniformly shipped across all 5 non-English locales. Severity is NOT MEDIUM because: (a) the surface is THE first thing every operator sees on every login; (b) the drift uniformly affects ALL 5 non-English locales (the platform's entire multilingual-UI surface for any non-English team); (c) the platform CLAIMS multilingual support via the language switcher in the user menu but ships an inconsistent UI on the primary navigation — claim-vs-reality mismatch, LSN-001 class; (d) the fix is bounded — 3 keys per locale × 6 locales = 18 string additions, plus an optional CI safety net. Severity is NOT CRITICAL because no security boundary is crossed, no data is lost, and the English UI accidentally works — the impact is operator-experience-quality and doc-product-coherence on the localized UI specifically. The HIGH rating tracks the en.json sidecar's own severity rating for the same finding.

### Last verified

- 2026-05-26 — en.json sidecar (PRIMARY SOURCE — full Read of the 418-entry bundle) + ToolbarTabs sidecar (CORROBORATING SOURCE — full Read) at substrate commit 4ec2b20; live WebFetch confirmations on `/configuration-and-deployment/odd-platform` (200) and `/active-platform-features/ui-overview` (404).
