## STRENGTHENS — AppToolbar + en.json + ToolbarTabs sidecars supply the first PRIMARY SOURCES for the F-047 multilingual-UI missing-page (batch ZJ)

DOC-GAP-020 documents the "Concept Locale Bundle / Multilingual UI — F-047 is filed; cross-referenced here" with sparse evidence. Batch ZJ supplies the FIRST THREE detailed primary sources that establish the multilingual-UI surface's full operator-impact contour — the en.json bundle (418 entries), the i18n bootstrap (`i18n.ts` initialization), and the AppToolbar user-cluster (the language switcher's UI surface). Combined with batch ZJ's new findings DOC-GAP-307 (UI-shell canonical page absent), DOC-GAP-309 (3 primary-nav tabs missing keys), and DOC-GAP-310 (locale-set drift + no missing-key handler), F-047 now has the structural detail required to author the canonical page.

### Added surfaced_by (new sidecars cited)

- `odd-platform__json__locales_translations__i18n-resource__en.md:docs_link_semantic.doc_drift_findings[1]` — **NEW PRIMARY SOURCE**: "The multilingual UI feature (six locales, locale-switcher widget, persisted preference in `localStorage('i18nextLng')`) is undocumented on the public docs site as of 2026-05-08 (per i18n.ts sidecar's three WebFetch attempts on configuration page, Features hub, site index — all 200 with zero i18n references). Surfaced as F-047. Operators have no way to discover which locales ship, how preference is persisted (browser-only, no server-side binding), or how to contribute a new locale." **(NEW batch ZJ — en.json sidecar PRIMARY SOURCE; the canonical i18n source-of-truth)**
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:docs_link_semantic.doc_drift_findings[2]` — **NEW**: "the language switcher and its 6 supported locales (English, Spanish, Chinese, French, Ukrainian, Armenian) are completely undocumented; an operator deploying for a Spanish-speaking team has no way to know the locale exists short of finding the gear-menu in the user dropdown" **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:bugs_limitations_corner_cases[6]` — **NEW**: "language switcher list is bound to `i18n.languages` (`SelectLanguage.tsx:48`) which i18next derives from the `fallbackLng` array; the fallbackLng is `['en', 'es', 'ch', 'fr', 'ua', 'hy']` (`i18n.ts:30`) — but this means SELECTING any language from the dropdown TRIGGERS fallbackLng iteration. The first language in fallbackLng is 'en'; so unrecognised entries silently fall back to English." **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:bugs_limitations_corner_cases[7]` — **NEW**: "browser language preference (navigator.language) is NEVER consulted — i18n.ts:22 reads localStorage('i18nextLng') with fallback to 'en' (hardcoded). A user with a Spanish-language browser sees English on first visit; they have to manually switch via the gear menu (which is itself in English). Cross-cultural UX defect" **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:bugs_limitations_corner_cases[1]` — **NEW**: 3 of 9 primary-nav tab labels are absent from EVERY locale (Data Quality / Data Modelling / Master Data — see DOC-GAP-309 NEW for the dedicated finding) — concrete instance of the multilingual-UI promise breaking on the load-bearing top navigation surface

### New evidence (supplementary)

- `odd-platform-ui/src/locales/i18n.ts:27-31` (verbatim, full Read of the i18n bootstrap): `i18n.use(initReactI18next).init({ resources, lng, fallbackLng })` — the entire i18n init logic. NO `missingKeyHandler`, NO `parseMissingKeyHandler`, NO `saveMissing` wired (DOC-GAP-310 NEW dedicated finding).
- `odd-platform-ui/src/locales/i18n.ts:3-8` — eager static imports of the 6 locale bundles (`en.json`, `es.json`, `ch.json`, `fr.json`, `ua.json`, `hy.json`); the 6 locales are statically chosen at build time, not dynamically loaded.
- `odd-platform-ui/src/locales/i18n.ts:30` — `fallbackLng: ['en','es','ch','fr','ua','hy']` (6-element chain; English first).
- `odd-platform-ui/src/lib/constants.ts:158-165` — `LANGUAGES_MAP` (6 entries mapping locale codes to display names).
- `odd-platform-ui/src/locales/translations/en.json` — 418-entry canonical English bundle; 417 entries follow the natural-keys pattern (`key === value`); 1 entry uses slug-key indirection (`"main search placeholder": "Search data tables, feature group, jobs and ML models via keywords"`); the structural pattern itself is undocumented.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:18-79` (per AppToolbar sidecar) — the language-switch dialog inside the user menu; persists choice to `localStorage('i18nextLng')` at line 30.
- Live WebFetch this session — `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (200) confirmed silent on multilingual UI / locales / language selection; `https://docs.opendatadiscovery.org/active-platform-features/ui-overview` (404 — the natural-fit canonical URL doesn't exist; DOC-GAP-307 NEW).
- 6-locale entry counts per en.json sidecar (verified `wc -l`): en=418, ch=415, fr=415, es=414, hy=414, ua=414 — 3-4 keys per non-English locale are absent (DOC-GAP-310 NEW dedicated finding).

### New operator-impact dimensions surfaced

1. **CONCRETE CONTENT DRIFT on primary nav** (DOC-GAP-309 NEW): three primary-nav tabs are silently UNTRANSLATED in every non-English locale. The English UI accidentally works; the multilingual promise is broken on the FIRST surface every operator sees.
2. **STRUCTURAL MAINTENANCE-CONTRACT DRIFT** (DOC-GAP-310 NEW): the platform has no missing-key handler, no CI key-parity check, no contributor guide. The maintenance contract is enforced by nothing; future i18n drift is the default.
3. **NO BROWSER-LANGUAGE DETECTION**: a user with a Spanish-language browser sees English on first visit; they have to manually switch via the gear menu (which is itself in English). The first-visit UX defaults to English for ALL users; the platform's "multilingual UI" promise is undermined by the first-visit default.
4. **LOCALSTORAGE-PERSISTED PREFERENCE**: language choice persists via `localStorage('i18nextLng')` (browser-only, no server-side binding). An operator clearing browser data loses their preference. A user accessing ODD from multiple browsers configures the locale separately on each. Cross-device UX is degraded.
5. **NO CSP / PRIVATE-BROWSING CAVEAT**: the i18n bootstrap reads `localStorage.getItem('i18nextLng')` unguarded; in browsers' private/incognito mode, this throws a SecurityError before the SPA renders (DOC-GAP-027 sibling). The multilingual-UI feature is inaccessible in private-browsing mode.

### Triangulation update

DOC-GAP-020 was originally surfaced by 2 sources (`concepts.yaml:entities[Locale Bundle]` + sidecar refs unspecified). Batch ZJ adds 4 NEW PRIMARY SOURCES:
- en.json sidecar (the 418-entry canonical English bundle)
- AppToolbar sidecar (the user-cluster + language-switcher mount)
- ToolbarTabs sidecar (the 9-tab labels rendered via t() — the concrete content drift instance)
- (Indirectly via cross-references — the i18n.ts sidecar from prior batches; SelectLanguage from this batch)

**Coverage: 2 → 6 sidecars + 3 sibling new DOC-GAPs (307 / 309 / 310 batch ZJ). F-047 now has the structural detail required to author the canonical page.**

### Proposed doc action update

The original DOC-GAP-020 proposed action was minimal ("Already filed as F-047; no new authoring action"). Batch ZJ supplies the structural content to actually author the F-047 / multilingual-UI doc page. The recommended page (housed at `features/ui-overview.md` per DOC-GAP-307 NEW OR as a dedicated `features/multilingual-ui.md` page) needs FIVE sections:

1. **Supported locales**: enumerate the 6 locales (English / Spanish / Chinese / French / Ukrainian / Armenian — `en/es/ch/fr/ua/hy`); explain that they are statically bundled at build time (no dynamic locale loading).
2. **Language selection**: describe the language switcher in the user-cluster of the toolbar (click the user-name → gear menu); explain the localStorage persistence (`i18nextLng`); explain that browser-language preference is NOT auto-detected (operators / users must manually pick on first visit).
3. **Known translation gaps**: cross-link to DOC-GAP-309 NEW (3 primary-nav tabs untranslated in every non-English locale: Data Quality / Data Modelling / Master Data). Surface the per-locale completeness ratio (en=418, others=414-415).
4. **Contributing translations**: cross-link to DOC-GAP-310 NEW's contributor-guide section — describe the natural-keys pattern, the single slug-key exception, the maintenance contract.
5. **Known limitations**: cross-link to DOC-GAP-027 (CSP / private-browsing caveat); explain the localStorage requirement; explain that language preference is browser-local (not synced across devices).

### Cross-references update

Add to existing DOC-GAP-020 cross-references:
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — the natural home for the multilingual-UI sections
- **DOC-GAP-309 NEW** (3 primary-nav tabs missing keys across all 6 locales) — the CONCRETE CONTENT DRIFT inside the multilingual-UI surface
- **DOC-GAP-310 NEW** (locale-set drift + no missing-key handler — the maintenance-contract META)
- F-047 status: with batch ZJ's contributions, the F-047 authoring task transitions from "high-level concept" to "ready-to-author" — the structural detail is now triangulated across 6 sidecars + 3 sibling DOC-GAPs

### Severity update

Severity remains **MEDIUM** (per F-047) — batch ZJ's 4-primary-source addition reinforces the original assessment. The multilingual-UI feature ships in the SPA but is undocumented end-to-end; operators have no way to discover the feature or contribute to it. Severity is MEDIUM, not HIGH, because: (a) the feature is functional for English users (the English UI accidentally works); (b) no security boundary is crossed. Severity is MEDIUM, not LOW, because: (a) the feature is a load-bearing operator-facing capability; (b) the gap compounds with three new DOC-GAPs from batch ZJ (307 / 309 / 310) all of which need the F-047 canonical home; (c) once authored, the F-047 page closes multiple cross-references in one place — high doc-product leverage.

---

**Batch ZJ contribution**: 4 NEW PRIMARY SOURCES + 5 NEW operator-impact dimensions surfaced; coverage 2 → 6 sidecars; F-047 transitions from "concept" to "ready-to-author" with structural detail across the 5 sections above; severity unchanged (MEDIUM); proposed doc action elevated from "no new authoring action" to "author the canonical multilingual-UI doc page using the 5-section structure".
