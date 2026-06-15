---
node_id: "odd-platform json locales/translations i18n-resource:en"
node_kind: i18n-resource
axis: locales
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZJ
---

# en.json — canonical English i18n source for the platform UI — semantic understanding

> **Update 2026-06-15 (CTRIB-014 / odd-platform#1751, ships 0.28.0) — supersedes the stale counts below.**
> en.json now has **600** entries (was 418→505); there are **six** non-en locales (`es/ch/fr/ua/hy/br` — `br`
> added by #1564), all at **exact 600-key parity**. The "~70 keys missing from all catalogs / no CI guard"
> limitation is RESOLVED: #1751 added the missing keys + translated all six catalogs. TWO guards now exist:
> (1) a vitest **catalog-parity** test (every non-en catalog == en's key set; was en-completeness-only) and
> (2) an eslint **`no-literal-string`** rule (PLT-205) that fails on a user-facing JSX string not wrapped in
> `t()` — the latter closed a SEPARATE, larger class: ~208 HARDCODED strings across 98 files that bypassed i18n
> entirely (invisible to the t()-sweep metric). Also `fallbackLng` is now `'en'` (was the 7-locale array — the
> #1564 Portuguese-leak, CTRIB-012). The bodied sections below predate this and describe the old shape.

## understanding

This file is the canonical English-locale translation bundle for the platform
UI's i18n layer. It contains 418 flat string-to-string entries (one per
visible label, button, header, table column, modal title, confirmation
prompt, placeholder, and inline noun/verb across the SPA), each entry shaped
as `"<English-phrase>": "<English-phrase>"` — i.e. **the keys ARE the
English source phrases** (the i18next "natural keys" pattern). The five
other locale files (`ch.json`, `es.json`, `fr.json`, `hy.json`, `ua.json`)
mirror this key set (largely — see `bugs_limitations_corner_cases` for
drift) and provide the localized strings. Because keys are English
phrases, a missing key in ANY locale silently renders the KEY (i.e. the
English phrase) rather than a placeholder or error — the English UI
"accidentally works" for any key the code references but the resource
omits. This is the canonical LSN-019/020 substrate at the i18n layer:
the contract between code and resource is brittle and silent. The file is
bundled statically into the main JS chunk via `import en from
'./translations/en.json'` at `odd-platform-ui/src/locales/i18n.ts:3`; it
participates in the six-element `fallbackLng` chain (`['en','es','ch','fr','ua','hy']`
at `i18n.ts:30`); and it is read on every `useTranslation()` call across
the SPA.

## concepts

- entities:
  - "translation key (verbatim English phrase or short token, e.g. `\"About\"`, `\"Add owner\"`, `\"main search placeholder\"`)"
  - "translation value (the rendered string the UI shows — for `en.json`, identical to the key in 417/418 entries; one entry — `\"main search placeholder\"` line 381 — has a non-key value)"
  - "i18n resource bundle (the whole JSON object, registered under `resources.en.translation` at `i18n.ts:11`)"
  - "natural-keys contract (the SPA-wide convention that keys ARE the English source phrase)"
- operations:
  - "be eagerly loaded as a static JSON import at app start (`i18n.ts:3`)"
  - "expose each entry as the value returned by `useTranslation().t('<key>')` for the active locale"
  - "anchor the six-element `fallbackLng` chain — for any key missing in the active locale, i18next walks `en → es → ch → fr → ua → hy` in order looking for a match; if every locale misses, the rendered value is the KEY ITSELF (this is i18next's default `returnEmptyString: false` plus the natural-keys pattern)"
  - "serve as the SoT for which keys exist — contributors authoring a new feature add keys here first, then propagate to the other five locale files"
- invariants:
  - "Every entry's shape is `\"<key>\": \"<value>\"`; both sides are strings (no nesting, no arrays, no interpolation placeholders)."
  - "417/418 entries have `key === value` (the natural-keys pattern); one entry differs: `\"main search placeholder\": \"Search data tables, feature group, jobs and ML models via keywords\"` (line 381). This single deviation is a placeholder-text indirection — the key is an opaque slug, the value is the actual UI placeholder."
  - "There are NO i18next interpolation placeholders (`{{var}}`) in any value — verified by repo-wide grep on en.json. Variable substitution is handled by JSX composition (e.g. `{t('Hi')} {identity?.username}.` in `OwnerAssociationForm.tsx:153`), not by `t('Hi {{name}}', { name: ... })`."
  - "The file has 418 entries; the other locales have 414 (ua, hy, es), 415 (ch, fr) — see `bugs_limitations_corner_cases.[1]` for the 3-4 key drift across locales."
  - "Keys are CASE-SENSITIVE and whitespace-sensitive (`\"Add\"` vs `\"add\"` vs `\"Add \"` are three distinct keys). The file has 17 distinct entries differing only in capitalisation or trailing space (e.g. `\"description\"` line 369 + `\"Description\"` line 113 are TWO keys for the same English noun, used in different code contexts)."
- audiences:
  - "platform UI end-users (the strings here are what every user sees — every button label, every modal title, every error message, every empty-state placeholder)"
  - "platform UI contributors (every new t('...') call site must add a matching key here, or the rendered text falls through to the key string — see `bugs_limitations_corner_cases.[0]` for the drift this allows)"
  - "translators (when adding a new locale, the canonical reference is this file; the other five locales mirror its key set, sometimes incompletely)"
  - "compliance reviewers (the label-vs-implementation drift surfaced in `bugs_limitations_corner_cases.[2]` — the `\"User\"` key labels the Activity filter that — per LSN-020 — filters by owner-via-mapping at the SQL layer, NOT by actor)"

## dependencies_semantic

- requires-feature:
  - "i18next runtime (`i18n.ts:1,2,27` — the singleton initialized with this file's contents in `resources.en.translation`)"
  - "react-i18next (`i18n.ts:2,27` — exposes the i18next instance via React context, consumed by `useTranslation()` across the SPA)"
- requires-config:
  - "Default locale selection (`i18n.ts:20` — `const defaultLanguage = 'en'` — this file is the implicit default when localStorage `i18nextLng` is unset or whitelisted-out)"
  - "Six-element fallbackLng chain (`i18n.ts:30` — `fallbackLng: ['en','es','ch','fr','ua','hy']`; English is FIRST in the chain, so non-English locales fall through to English on a missing key)"
- requires-runtime:
  - "Browser support for ES-modules JSON imports (verified by `i18n.ts:3` syntax — Vite / Webpack handle JSON loading at build time, not runtime)"
- coupling-notes:
  - "Adding a new t('...') call site in the code does NOT validate against this file at build time — there is no compile-time check that the key exists. A typo in a key, or a code-side key that was never added to en.json, falls through silently to render the KEY itself. Measured 2026-06-10: 73 such call sites; odd-platform#1748 fixed the 3 toolbar-tab keys, the remaining 70 are tracked PLT-215 (see `bugs_limitations_corner_cases.[0]`)."
  - "Adding a new locale requires three files updated (`i18n.ts:3-8,10-17,30` + `lib/constants.ts:LANGUAGES_MAP` + `lib/constants.ts:LANG_TO_COUNTRY_CODE_MAP`) — but does NOT require this file (en.json) to add a marker that a key needs translation. There is no `missingKey` event handler wired in `i18n.ts`."
  - "The Activity Feed filter label `t('User')` (`Filters.tsx:58`) couples this file's line 347 (`\"User\": \"User\"`) to the SQL behavior in `ReactiveActivityRepositoryImpl.java:272-273` — the operator-facing label IS this file's value, but the implementation translates `userIds` to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. The drift is structurally LSN-020 and surfaced in `bugs_limitations_corner_cases.[2]`."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Every t('...') call site in the SPA has a corresponding key in en.json (the missing-key drift)."
    test_class: integration
    criticality: HIGH
    note: "A static-analysis test (or a CI step) enumerating `t\\(['\"]([^'\"]+)['\"]\\)` across the codebase and checking presence against en.json would catch the missing-key drift (measured 2026-06-10: 73 cases, 70 remaining post-#1748). No CI guard exists; PLT-215 proposes one. IT-102 case 4 now covers the nine toolbar tabs."
  - behaviour: "Every key in en.json is referenced by at least one t('...') call site in the SPA (the dead-key drift)."
    test_class: integration
    criticality: MEDIUM
    note: "The inverse direction — unused keys bloat the bundle and obscure intent. No tooling enforces this; some entries (e.g. `\"Statuses\"` at line 418, added 2025-Q4 per git blame) are clearly used; but a key like `\"Hi\"` (line 161) is used ONCE in the entire SPA. The full audit is out of scope for this sidecar but is a probable medium-grade gap."
  - behaviour: "Every key present in en.json is also present in every non-English locale file (the localization-completeness drift)."
    test_class: integration
    criticality: HIGH
    note: "Key counts post-#1748 (json.load, 2026-06-10): en=421, ch=418, fr=418, es=417, hy=417, ua=417 (pre-fix: en=418, ch=415, fr=415, es=414, hy=414, ua=414). Three to four keys are missing from each non-English locale. The natural-keys pattern hides this — the missing entries fall through to English via the fallbackLng chain. Until a non-English-locale user encounters a key that DOES NOT EXIST in their locale but DOES in English, the divergence is invisible."
  - behaviour: "No key uses i18next interpolation placeholders (`{{var}}`) inconsistently across locales."
    test_class: integration
    criticality: LOW
    note: "Verified absent in en.json by repo-wide grep. If a contributor introduces a `{{var}}` placeholder in en.json but forgets it in fr.json, the French rendering shows the literal text without substitution. No test enforces consistency."
  - behaviour: "Activity Feed `t('User')` label is operator-honest (i.e. matches what the SQL filter does)."
    test_class: integration
    criticality: HIGH
    note: "Per LSN-020 / DOC-GAP-303: the label says 'User' (suggesting 'filter by who performed the action'); the SQL binds `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (filters by owner-of-entity via the user-owner-mapping). The label is misleading and uniform across all six locales (no locale corrects it). Probe P-171 verifies the runtime drift."
- test_files: []
- gaps: |
    No test under `odd-platform-ui/src/` references the locale JSON files
    directly. No CI step validates code↔resource key parity. No CI step
    validates locale↔locale key parity. The natural-keys pattern means
    every drift surface listed above ships silently — only a non-English
    user encountering a freshly-added key for the first time, or a
    compliance reviewer reading the doc and clicking the UI filter,
    surfaces the drift. The highest-leverage gap is the integration-test
    category: a one-shot script that greps `t\\(['\"]([^'\"]+)['\"]\\)`
    across `odd-platform-ui/src/` and asserts presence in en.json + each
    non-English locale. This would catch every drift case in this
    sidecar's `bugs_limitations_corner_cases` block.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: "(no explicit anchor — filter section discussed in body)"
    rationale: "The User-filter label in this file (line 347) is the operator-facing surface of the Activity Feed's User filter; the live doc page describes the filter's behaviour — and per LSN-020 / DOC-GAP-303, describes it as 'performed by' while the SQL filters by owner-via-mapping. The drift is anchored at this file's `\"User\"` entry."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim WebFetch result 2026-05-26 (status 200): "**User** — show events
      performed by one or more selected users (multi-select). Useful for
      auditing a specific person's platform activity." The doc explicitly
      uses the phrasing "performed by" — confirming the LSN-020 drift: the
      doc reinforces the wrong promise. The label in THIS file is "User";
      the doc says "performed by"; the SQL filters by user-mapped-owner.
      The chain of misleads is complete from i18n key → UI label → doc copy.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "(no i18n section)"
    rationale: "The configuration/deployment surface for the platform — checked because operators who self-host might expect to see locale configuration documented here. The page does not mention i18n / multilingual UI / locale selection."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Per the i18n.ts sidecar's WebFetch on 2026-05-08 (status 200, same
      page): "No mention. The documentation page does not contain any
      references to multilingual UI, internationalization (i18n), language
      selection, locales, translations, supported languages, or UI
      language configuration options." Re-verified at this enrichment via
      reference to the i18n.ts sidecar; no fresh fetch this session.
- doc_drift_findings:
  - "The live Activity Feed doc page describes the User filter as filtering by who 'performed' the action (verbatim WebFetch 2026-05-26 status 200). The i18n key `\"User\"` (this file, line 347) labels the filter. The SQL at `ReactiveActivityRepositoryImpl.java:272-273` binds `userIds` to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. Three surfaces — doc copy, UI label, SQL semantic — disagree: doc + UI promise 'who performed', SQL filters 'owner of entity via mapping'. The i18n layer in THIS file does not cause the drift but is the channel through which the misleading label reaches every user (no locale corrects it — natural-keys pattern applies). This is the canonical LSN-020 instance at the i18n layer, anchored at DOC-GAP-303."
  - "RESOLVED 2026-05-28 (DOC-171): the multilingual UI feature is documented end-to-end at docs.opendatadiscovery.org/features/multilingual-ui — supported locales, switcher discovery, localStorage persistence model, missing-key fall-through caveat, new-locale contribution workflow (live-verified 2026-06-10, HTTP 200). Historical: undocumented as of 2026-05-08; surfaced as F-047."
  - "Code references keys that DO NOT exist in this file (en.json) — 73 measured 2026-06-10; the 3 top-level navigation labels (`ToolbarTabs.tsx:46,51,56`) are FIXED-1748 (added to all six catalogs; IT-102 case 4 pins the regression) and the remaining 70 are tracked PLT-215. Historically notable: `t('Data Quality')`, `t('Data Modelling')`, `t('Master Data')`, plus `t('Query Examples')`, `t('Add query example')`, `t('Save lookup table')`, `t('Table name')`, `t('Enter business name')`, `t('Link query')`, `t('query examples overall')`, `t('lookup table')`, `t('tab')`, `t('Delete query example')`, `t('Are you sure you want to delete this query example?')`. The natural-keys pattern means the rendered text falls through to the KEY STRING — so the English UI accidentally works. But every non-English locale ALSO renders the English key string for these missing entries (verified: the missing keys are absent across all six locales). The natural-keys fall-through contract is now documented on the multilingual-ui docs page (Known caveat section, since 2026-05-28)."

## implicit_adrs

- "The natural-keys pattern is the SPA's i18n contract: keys ARE the English source phrase, values mirror the key in the English file." — evidence: `odd-platform-ui/src/locales/translations/en.json:2-419` (417/418 entries have `key === value`) + `odd-platform-ui/src/locales/i18n.ts:30` (the fallbackLng chain implicitly assumes English-phrase keys). — intent_anchor: "the consistent shape `\"About\": \"About\"`, `\"Accept\": \"Accept\"`, `\"Add\": \"Add\"`, ... across 417 of 418 entries IS the convention — no documentation comment is needed because the pattern reads as obvious to anyone opening the file; the single deviation (`\"main search placeholder\"`) IS the explicit indirection where a longer placeholder text needed a short key" — confidence: HIGH
- "Single exception to the natural-keys pattern: the `\"main search placeholder\"` slug-key (line 381) carries the full placeholder text 'Search data tables, feature group, jobs and ML models via keywords' as its value. This is the one entry that uses opaque-key + descriptive-value (the i18next 'slug keys' pattern)." — evidence: `odd-platform-ui/src/locales/translations/en.json:381` + `odd-platform-ui/src/components/shared/elements/MainSearchInput/MainSearchInput.tsx:63` (`const mainSearchPlaceholder = t('main search placeholder');`). — intent_anchor: "the slug key 'main search placeholder' is grammatically a category-label, not a phrase the user reads; the value IS the phrase the user reads. Keeping the slug short means the t() call site stays readable while the actual placeholder text is one centralized string per locale" — confidence: HIGH
- "No i18next interpolation placeholders (`{{var}}`) are used; variable substitution happens via JSX composition outside the t() call." — evidence: `odd-platform-ui/src/locales/translations/en.json` (zero `{{...}}` patterns, verified by repo-wide grep) + `odd-platform-ui/src/components/Overview/OwnerAssociation/OwnerAssociationForm/OwnerAssociationForm.tsx:153` (the canonical example: `{t('Hi')} {identity?.username}.` — JSX children, not t-interpolation). — intent_anchor: "JSX composition is the consistent pattern across the entire SPA; the `{t('Hi')} {identity?.username}.` form deliberately avoids i18next interpolation, sidestepping the locale-divergence risk where a contributor adds `{{var}}` in one locale and forgets it in others. The natural-keys pattern + JSX composition is a coherent ADR even though no comment defends it" — confidence: HIGH
- "English-first fallbackLng ordering with all six locales chained, not the conventional single `'en'`." — evidence: `odd-platform-ui/src/locales/i18n.ts:30` (`fallbackLng: ['en', 'es', 'ch', 'fr', 'ua', 'hy']`). The chain order — English first, then Spanish, then Chinese, then French, then Ukrainian, then Armenian — is the order keys CAN fall through. — intent_anchor: "the order is deliberate (English first means the natural-keys English source is always the FIRST fallback), but the inclusion of the other five locales in the chain is non-conventional; the i18n.ts sidecar surfaces this as `bugs_limitations_corner_cases.[0]` because it produces unexpected fall-through (a French user with a missing key might see Spanish before English IF Spanish has the key and English does not — which CAN happen if a contributor adds a key in es.json first and forgets en.json). The natural-keys pattern in THIS file makes that scenario nearly impossible (en.json is the canonical source), but the chain order encodes a fall-through stance that a 'graceful degradation across all locales' is preferred over 'graceful degradation to English only'" — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**Missing-key drift (HIGH, structural LSN-019/020 class)**: The codebase references 12+ keys via `t('...')` that do not exist in this file (en.json). Confirmed missing keys: `\"Data Quality\"` (`ToolbarTabs.tsx:46`), `\"Data Modelling\"` (`ToolbarTabs.tsx:51`), `\"Master Data\"` (`ToolbarTabs.tsx:56`), `\"Query Examples\"` (`QueryExamples.tsx:23`), `\"query examples overall\"` (`QueryExamples.tsx:25`), `\"Add query example\"` (`AssignEntityQueryExampleForm.tsx:47,67` + `QueryExamples.tsx:42`), `\"lookup table\"` (`LookupTableForm.tsx:77`), `\"Table name\"` (`LookupTableForm.tsx:90`), `\"Save lookup table\"` (`LookupTableForm.tsx:129`), `\"Add lookup table\"` (`LookupTableForm.tsx:129`), `\"Enter business name\"` (`InternalNameFormDialog.tsx:69`), `\"Link query\"` (`DataEntityDetailsQueryExamples.tsx:40`), `\"tab\"` (`QueryExampleDetailsContainer.tsx:31` + `QueryExampleDetailsTabs.tsx:38`), `\"Delete query example\"` and `\"Are you sure you want to delete this query example?\"` (`QueryExampleDetailsContainerActions.tsx:68,69`). The natural-keys pattern makes the English UI accidentally work (i18next returns the KEY ITSELF on a complete fallback miss). But every non-English locale ALSO renders the English key string for these missing entries — verified by grep on the six locale files (none of them carry these keys either). A French user navigating to the Data Quality tab sees \"Data Quality\" in English; a Chinese user sees \"Data Quality\" in English. The drift is uniform across locales; the fix is to ADD the missing keys to en.json (and propagate to the other five). Probe P-170 verifies the runtime drift via DOM observation across all six locales." — evidence: `odd-platform-ui/src/locales/translations/en.json` (absence of the 14+ enumerated keys, verified by grep) + the cited call sites. — severity: HIGH

- "**Locale-set drift across the six files (HIGH)**: `wc -l` per locale: en=418, ch=415, fr=415, es=414, hy=414, ua=414. Three to four keys exist in en.json but NOT in the other five locales. The natural-keys pattern hides this — the missing entries fall through to English via the `fallbackLng` chain. A complete audit (out of scope for this sidecar — see P-170) would enumerate per-locale missing keys; the file-line counts alone surface that the locales have drifted. The structural risk: a contributor adding a new key to en.json today does NOT receive any signal that the other five locales need updating — the natural-keys + fallbackLng + no missingKey-handler combination silently ships a multilingual feature where non-English users see English text intermittently." — evidence: `wc -l` output on the six locale files (verified at commit 4ec2b20) + `odd-platform-ui/src/locales/i18n.ts:30` (the fallbackLng chain that hides the drift). — severity: HIGH

- "**Activity Feed User-filter label IS the LSN-020 drift, anchored at this file's line 347 (HIGH, DOC-GAP-303 instance)**: The `\"User\"` entry (line 347) is the value rendered as the Activity Feed multi-select filter label (`components/DataEntityDetails/DataEntityActivity/Filters/Filters.tsx:58`: `<MultipleFilter key='us' filterName='userIds' name={t('User')} />`). The label promises 'filter by user' — an operator (compliance reviewer, security auditor) reading the label, the doc copy ('events performed by one or more selected users' per WebFetch 2026-05-26), and the parameter name `userIds` infers the filter operates on the ACTOR who performed each action. But the SQL at `ReactiveActivityRepositoryImpl.java:272-273` binds `userIds` to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` — i.e. filters by the OWNER-of-the-affected-entity, accessed via the user_owner_mapping table. The available column `activity.created_by` (the actual actor) is read by the LEFT JOIN but is NEVER referenced in WHERE. This file does not cause the drift but is the channel that ships the misleading label to every user; no locale corrects it (natural-keys default). Probe P-171 verifies the runtime drift. The fix has two parts: (a) rename the i18n key to express the SQL semantic honestly (e.g. `\"User\"` → `\"Affected Entity Owner\"` or `\"Entity Owner (mapped from user)\"`), and (b) update the doc copy to match. The file-analyser cannot prescribe the choice; the layer-4 reducer composes this with DOC-GAP-303 and the ActivityController sidecar." — evidence: `odd-platform-ui/src/locales/translations/en.json:347` (the key + value `\"User\": \"User\"`) + `odd-platform-ui/src/components/DataEntityDetails/DataEntityActivity/Filters/Filters.tsx:58` (the call site) + cross-reference to `odd-platform__java__ActivityController__controller-method__getActivity.md` (SQL evidence). — severity: HIGH

- "**Dictionary label vs `/termsearch` URL drift (MEDIUM, DOC-GAP-300/301 instance at the i18n layer)**: The `\"Dictionary\"` entry (line 115) labels the top-level navigation tab via `ToolbarTabs.tsx:66` (`name: t('Dictionary'), link: termsSearchPath()`). The URL is `/termsearch` (`routes/termsRoutes.ts:5`). The label vocabulary ('Dictionary') and the URL vocabulary ('termsearch') disagree. Adding to the drift: `ToolbarTabs.tsx:111` does `if (tabs[idx].name === t('Dictionary'))` — a fragile string-equality check between localized strings that works only because the natural-keys pattern means `t('Dictionary') === 'Dictionary'` in every locale. If a locale ever translates the key (e.g. `fr.json: \"Dictionary\": \"Dictionnaire\"`), the equality check still works because both sides resolve through the same i18next instance — but a code-review reading the call site has no way to tell that without tracing the i18next semantics. Probe P-172 verifies the URL is `/termsearch` across all six locales (i.e. the URL never adopts the localized label). The fix is either renaming the URL to `/dictionary` (breaks deep-linked bookmarks) or renaming the i18n key from `\"Dictionary\"` to `\"Term Search\"` everywhere (a single grep across `t('Dictionary')` call sites — 2 in ToolbarTabs.tsx — and updating en.json + the five other locales)." — evidence: `odd-platform-ui/src/locales/translations/en.json:115` + `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:66,111` + `odd-platform-ui/src/routes/termsRoutes.ts:5`. — severity: MEDIUM

- "**The `Statuses` key is locale-divergent (LOW)**: en.json line 418 has `\"Statuses\": \"Statuses\"` (natural-keys); es.json line 410 has `\"Statuses\": \"Estado\"` — a Spanish singular noun ('Status', singular) translating a plural English noun ('Statuses', plural). The other four locales (ch, fr, hy, ua) carry `\"Statuses\": \"Statuses\"` — the English source. The Spanish translation is incomplete (plural→singular drift) and inconsistent with the other locales (which don't translate at all). This is a typical contributor-drift case: one locale's translator submitted a partial change, the others were never updated. The Search Filters component (`components/Search/Filters/Filters.tsx:65`) uses `name={t('Statuses')}` to label the multi-select status facet — a Spanish-locale user sees 'Estado' (singular, suggesting a single status to select), while the widget is in fact multi-select." — evidence: `odd-platform-ui/src/locales/translations/en.json:418`, `odd-platform-ui/src/locales/translations/es.json:410` (verbatim `\"Statuses\": \"Estado\"`), `odd-platform-ui/src/locales/translations/ch.json:414` / `fr.json:414` / `hy.json:411` / `ua.json:413` (all `\"Statuses\": \"Statuses\"`). — severity: LOW

- "**Capitalisation / whitespace key duplication (LOW)**: The file has 17 distinct entries where keys differ only in capitalisation or trailing whitespace, often as TWO keys for the same English noun used in different code contexts. Examples: `\"description\"` (line 369) + `\"Description\"` (line 113); `\"in\"` (line 377) + (no capitalised pair); `\"owner\"` (line 389) + `\"Owner\"` (line 236); `\"important\"` (line 376) + `\"Important\"` (line 176); `\"sources\"` (line 395) + `\"Sources\"` (line 308); `\"tags\"` (line 398) + `\"Tags\"` (line 322); `\"term\"` (line 401) + `\"Term\"` (line 324). The convention appears to be: lower-case key for inline noun ('5 tags'), upper-case key for label / heading / button ('Tags'). This works mechanically but doubles the translation surface (every contributor adding a new noun must decide which form to use, and the lower-case form is rarely localized — most are natural-keys identity entries). A future-cleanup item, not a defect." — evidence: `odd-platform-ui/src/locales/translations/en.json` (the 17 duplicated nouns enumerated by linear inspection of the alphabetical key list). — severity: LOW

- "**One key has a non-key value — and is the ONLY genuine localizable phrase in the entire file (MEDIUM)**: `\"main search placeholder\"` (line 381) has the value `\"Search data tables, feature group, jobs and ML models via keywords\"` — a complete sentence visible as the placeholder in the global search bar. The other six locales translate this sentence (e.g. `fr.json:377` carries 'espace de recherche principal' — note: a SHORTER, less informative placeholder than the English one). The drift here is content: the English placeholder enumerates four entity types ('data tables, feature group, jobs and ML models'); the French / Spanish / Chinese / Ukrainian / Armenian placeholders are much shorter generic strings (the French value translates as 'main search space'). A French user does not see the four-entity-type enumeration that an English user sees. This is a localization-quality drift, not a security or correctness defect — but it materially changes how the UI describes the search surface across locales." — evidence: `odd-platform-ui/src/locales/translations/en.json:381` + `odd-platform-ui/src/locales/translations/fr.json:377` (verbatim 'espace de recherche principal') + the other four locales (each carrying a short generic placeholder). — severity: MEDIUM

- "**No `missingKey` event handler is wired in `i18n.ts`; silent failures are the default**: Per the i18n.ts sidecar, `i18n.use(initReactI18next).init({ resources, lng, fallbackLng })` does not configure `missingKeyHandler`, `parseMissingKeyHandler`, or `saveMissing`. A typo in a t() call site, a deleted key, or a key added in code but never added to en.json all produce silent fall-through. The methodology to catch this is OUTSIDE the file — a CI step or a static analysis pass; the file itself cannot self-detect omissions. This is the i18next default, not a bug per se — but combined with the natural-keys pattern, it means the contract 'every t() call site has a matching en.json key' is enforced by NOTHING." — evidence: `odd-platform-ui/src/locales/i18n.ts:27-31` (the init call has only `resources`, `lng`, `fallbackLng` — no missing-key wiring). — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables: []  # JSON resource file — no numeric literals, no @Value, no constants
  name_behavior_pairs:
    - name: "key \"User\" (line 347)"
      promise: "Labels a multi-select filter on the Activity Feed; user infers 'filter by which user performed the action' (the natural reading of 'User' as actor)."
      implementation: "The key's value 'User' renders as the label for `<MultipleFilter filterName='userIds' name={t('User')} />` at `Filters.tsx:58`. The `userIds` query parameter routes through the controller, service, and repository chain (per the ActivityController sidecar) and binds at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (`ReactiveActivityRepositoryImpl.java:272-273`)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Compliance reviewer auditing 'what did Alice do last week' sets userIds=[alice_id], expects Alice's actions, receives activity on entities owned-via-mapping by Alice (which may include actions BY OTHER users) AND misses Alice's actions on entities owned by others. The label uniformly misleads across all six locales (no locale corrects it under the natural-keys pattern). Probe P-171 verifies the runtime drift; DOC-GAP-303 anchors the doc-side reinforcement."
      confidence: STATIC-INFERRED
      evidence: "odd-platform-ui/src/locales/translations/en.json:347 + odd-platform-ui/src/components/DataEntityDetails/DataEntityActivity/Filters/Filters.tsx:58 + REFERENCE to odd-platform__java__ActivityController__controller-method__getActivity for SQL trace"
    - name: "key \"Dictionary\" (line 115)"
      promise: "Labels a top-level navigation tab; user infers the tab navigates to a Dictionary feature (a glossary, a terms reference, a dictionary surface)."
      implementation: "The key's value 'Dictionary' renders as the tab label at `ToolbarTabs.tsx:66`. The tab's `link` is `termsSearchPath()` which resolves to `/termsearch` (`routes/termsRoutes.ts:5`). The URL vocabulary disagrees with the label vocabulary; the click handler at `ToolbarTabs.tsx:111-118` dispatches `createTermSearch` (not `createDictionarySearch`) and navigates to a term-search-id-bound URL."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Operator clicks 'Dictionary' tab, lands on a URL `/termsearch/<id>` — the label vocabulary is 'Dictionary', the URL is 'termsearch'. Bookmarks adopt the URL; deep links sent in Slack adopt the URL; tutorial documentation citing the URL must explain why the doc says 'Dictionary' but the URL says 'termsearch'. Probe P-172 verifies the URL is /termsearch across all six locales (i.e. the URL is locale-invariant; the label is locale-specific but natural-keys-pattern makes it 'Dictionary' uniformly). This is DOC-GAP-300/301 at the i18n surface."
      confidence: STATIC-INFERRED
      evidence: "odd-platform-ui/src/locales/translations/en.json:115 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:66,111 + odd-platform-ui/src/routes/termsRoutes.ts:5"
    - name: "key \"main search placeholder\" (line 381)"
      promise: "The KEY is a slug ('main search placeholder'); the VALUE is the actual phrase the user reads. The promise is that the slug names a single canonical search-bar placeholder string for the entire SPA."
      implementation: "Consumed at `MainSearchInput.tsx:63` (`const mainSearchPlaceholder = t('main search placeholder');`). The English value enumerates four entity types ('data tables, feature group, jobs and ML models'). Other locales (fr, es, hy, ua, ch) carry SHORTER generic placeholders that do NOT enumerate the entity types. Spanish: 'espacio para búsqueda principal' ('main search space'); French: 'espace de recherche principal' ('main search space'); Chinese: '主搜索占位符' ('main search placeholder', literal); Armenian / Ukrainian similar. The semantic content drifts across locales."
      drift: MINOR
      operator_visible_consequence: "An English-locale user sees a placeholder that DESCRIBES what they can search for (four entity types); a French / Spanish / Chinese / Ukrainian / Armenian user sees a generic 'main search' placeholder that does not. The localization drift is content-quality, not correctness — but it materially changes the discoverability of the search surface across locales."
      confidence: STATIC-INFERRED
      evidence: "odd-platform-ui/src/locales/translations/en.json:381 vs the same key in fr.json:377, es.json:376, ch.json:377, ua.json:376, hy.json:376"
  orderings: []  # JSON resource — no SQL, no JOOQ, no in-memory sort
  auth_gates: []  # JSON resource — no auth annotations, no programmatic checks (UI bootstrap, no HTTP surface)
  resource_boundaries: []  # JSON resource — no transactions, no caches, no locks; consumed once at module load via static import
  request_inputs:  # Category F applied at the i18n-key/code-reference boundary
    - location: "odd-platform-ui/src/locales/translations/en.json:347"
      input_kind: i18n-key-reference  # the t() call site is the request; the key is the named input
      input_name: "User"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The key 'User' resolves to the value 'User' (natural-keys pattern). When rendered as the label for a multi-select filter, the promise is 'filter by which user performed the action' — the standard reading of 'User' as actor in an activity-feed context."
          confidence: STATIC-INFERRED
          evidence: "odd-platform-ui/src/locales/translations/en.json:347"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced chain: `t('User')` at `Filters.tsx:58` returns 'User' → rendered as `<MultipleFilter filterName='userIds' name='User'>` label → user enters userIds → controller → service → repository → SQL: `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (`ReactiveActivityRepositoryImpl.java:272-273`)."
          confidence: REFERENCE
          evidence: "odd-platform__java__ActivityController__controller-method__getActivity (for the controller→repository→SQL trace; the i18n-resource sidecar owns only the en.json:347 anchor)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The label 'User' promises filtering by actor; the SQL filters by owner-of-entity-via-mapping. No comment, no tooltip, no doc copy explains the translation; the live doc page reinforces the wrong promise (per DOC-GAP-303 WebFetch 2026-05-26)."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "odd-platform-ui/src/locales/translations/en.json:347 + Filters.tsx:58 + ReactiveActivityRepositoryImpl.java:272-273 (via REFERENCE)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Three operator-visible failure modes (canonical LSN-020): (a) a user with no user-owner mapping returns empty results — reviewer assumes user was inactive; (b) reassigning a user-owner association retroactively rewrites which past activity rows the filter returns — same query a week apart gives different results, no audit warning; (c) multiple users mapped to the same owner all return the same rows when filtered by any of their user_ids — the filter collapses actor identity into mapped-owner identity."
          confidence: STATIC-INFERRED
          evidence: "DOC-GAP-303 evidence block + LSN-020 retrospective"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "Yes — `activity.created_by` (text column carrying the actual actor username) is READ in the LEFT JOIN at `ReactiveActivityRepositoryImpl.java:220-222` and SELECTED in the result mapping, but ABSENT from WHERE. The available-but-unused column is the canonical LSN-020 surface."
          confidence: REFERENCE
          evidence: "odd-platform__java__ActivityController__controller-method__getActivity (line 220-222 + 272-273 trace)"
      routes_to_finding: "bugs_limitations_corner_cases.[2] AND docs_link_semantic.doc_drift_findings.[0] AND cross-references DOC-GAP-303"
    - location: "odd-platform-ui/src/locales/translations/en.json:115"
      input_kind: i18n-key-reference
      input_name: "Dictionary"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The key 'Dictionary' resolves to the value 'Dictionary' (natural-keys). When rendered as a top-level navigation tab label, the promise is that the tab navigates to a Dictionary feature — a glossary, a terms reference page, a dictionary surface."
          confidence: STATIC-INFERRED
          evidence: "odd-platform-ui/src/locales/translations/en.json:115"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced chain: `t('Dictionary')` at `ToolbarTabs.tsx:66` returns 'Dictionary' → rendered as tab label, with `link: termsSearchPath()` → `routes/termsRoutes.ts:5` defines `TERMS_SEARCH_PATH = '/termsearch'`. The URL vocabulary is 'termsearch', not 'dictionary'."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:66 + termsRoutes.ts:5"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The label 'Dictionary' implies a /dictionary URL or a Dictionary feature surface; the URL is /termsearch and the implementation is a term-search dispatch. The two vocabularies coexist in the codebase but never reconcile."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "odd-platform-ui/src/locales/translations/en.json:115 + ToolbarTabs.tsx:66 + termsRoutes.ts:5"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Operator clicks 'Dictionary' tab, expects to land at /dictionary, lands at /termsearch/<id>. Bookmarks adopt the URL; deep links shared with colleagues say '/termsearch'; tutorial documentation cites the URL must explain the label-vs-URL drift. The user can navigate but the URL vocabulary disagrees with the label vocabulary — a recurring source of confusion (anchored as DOC-GAP-300/301 in ZH)."
          confidence: STATIC-INFERRED
          evidence: "DOC-GAP-300 evidence block + DOC-GAP-301 evidence block"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "No — there is no /dictionary URL anywhere in the routes module; the term-search surface is the only candidate. The fix is at the LABEL or URL level, not at finding an available-but-unused alternative."
          confidence: STATIC-INFERRED
          evidence: "routes/termsRoutes.ts (full file inspection — no /dictionary anywhere)"
      routes_to_finding: "bugs_limitations_corner_cases.[3] AND cross-references DOC-GAP-300/301"
    - location: "odd-platform-ui/src/locales/translations/en.json (absences — keys NOT in the file)"
      input_kind: i18n-key-reference
      input_name: "(14+ keys referenced by code but absent from en.json)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "For each missing key (e.g. 'Data Quality', 'Data Modelling', 'Master Data', 'Query Examples', 'Add query example', etc.), the t() call site at the code anchor PROMISES that the key resolves to a translated value in the active locale. The contributor's mental model is 'i18next looks up the key in the resource bundle and returns the value'."
          confidence: STATIC-INFERRED
          evidence: "the 14+ enumerated call sites in `bugs_limitations_corner_cases.[0]`"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "The i18next default `parseMissingKeyHandler: undefined` + `fallbackLng: ['en','es','ch','fr','ua','hy']` chain means: i18next walks the chain looking for the key. None of the six locales has the key. After exhausting the chain, i18next returns the KEY STRING itself (the i18next default `returnObjects: false` + no `parseMissingKeyHandler`). So `t('Data Quality')` returns the string 'Data Quality' — the English KEY rendered as the value."
          confidence: STATIC-INFERRED
          evidence: "odd-platform-ui/src/locales/i18n.ts:27-31 (no missingKey wiring) + i18next default behaviour for missing-key returns"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The contributor's promise is that the key resolves to a translation; the implementation delivers the key STRING itself when the key is absent across all six locales. The natural-keys pattern makes this 'work' for English (the rendered string IS the English text) but masks the drift for all five non-English locales: a French user sees 'Data Quality' in English on their UI, a Chinese user sees 'Data Quality' in English on theirs."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "bugs_limitations_corner_cases.[0] + verified via grep across all six locale files"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An English-locale user sees correct text and nothing reveals the bug. A non-English-locale user sees English text on key labels that EVERY OTHER part of the UI translates — a usability inconsistency that erodes trust in the localization. Probe P-170 verifies the runtime drift across all six locales."
          confidence: PROBE-NEEDED
          evidence: "P-170"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "No — the missing keys simply need to be ADDED to en.json (and the other five locales). There is no alternative resource to point to. The fix is mechanical: enumerate the 14+ missing keys, decide on the English value, add the entry to en.json, propagate to the other five locales."
          confidence: STATIC-INFERRED
          evidence: "bugs_limitations_corner_cases.[0]"
      routes_to_finding: "bugs_limitations_corner_cases.[0] AND docs_link_semantic.doc_drift_findings.[2]"
  probes_emitted:
    - probe_id: P-170
      question: "What does each non-English locale render for the 14+ keys absent from en.json (the missing-key drift at runtime)?"
      probe_path: lineage/odd-platform/probes/P-170.yaml
    - probe_id: P-171
      question: "What does the Activity Feed User filter actually return when set to a user_id, across all six locales — and does any locale correct the misleading label?"
      probe_path: lineage/odd-platform/probes/P-171.yaml
    - probe_id: P-172
      question: "Does the URL the Dictionary tab navigates to ever adopt the localized label vocabulary, or is it always /termsearch?"
      probe_path: lineage/odd-platform/probes/P-172.yaml
  stress_summary:
    triggers_total: 6
    questions_total: 18
    answers_static_inferred: 14
    answers_probe_needed: 1
    answers_reference: 3
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this file is a static JSON resource bundle; it has no HTTP surface, no authentication wiring, no `@ConditionalOnProperty` analogue. The four ODD auth modes (`DISABLED` / `LOGIN_FORM` / `OAUTH2` / `LDAP`) do not couple to its behaviour. The file is loaded at app boot via `import en from './translations/en.json'` (`i18n.ts:3`) regardless of `auth.type`.
- **ingestion_filter_relevance**: `N/A — not HTTP, not ingestion path`. The file participates in no request flow; the `auth.ingestion.filter.enabled` knob has no relationship.
- **authorization_assertions**: `[]` — no Spring Security expressions, no Permission / Role / Policy gates (this is a TS-bundled JSON resource, not a Java controller).
- **owner_scoping**: `N/A — code is not data-scoped`. The file is a static dictionary; it does not query, filter, or expose any data-entity, alert, owner, or other ODD domain object.
- **data_exposure**:
  - "The 418 entries in this file are bundled into the main JS chunk and shipped to every authenticated user under every auth mode. The strings are user-visible labels — they leak no PII, no credentials, no session identifiers. The leak surface is the CONCEPT NAMES the platform uses ('Owner', 'Policy', 'Permission', 'Term', 'Lookup table', 'Data Quality', etc.) — a competitor or attacker reverse-engineering the bundle learns the platform's domain vocabulary, but this is also visible from the public UI to any user." — evidence: `odd-platform-ui/src/locales/i18n.ts:3` (static import, included in main chunk).
- **known_security_gaps**:
  - "The `\"User\"` filter label (line 347) participates in the LSN-020 / DOC-GAP-303 drift cluster — the operator-misleading label is a security/compliance concern, not strictly a security defect in this file but a security CONSEQUENCE of the drift. A compliance reviewer following the doc + UI label to audit a user's actions gets WRONG audit results (per `bugs_limitations_corner_cases.[2]`). The fix is at the key-vocabulary layer (rename the key + update doc), not at the security-control layer (the SQL is doing what it is configured to do)." — evidence: `odd-platform-ui/src/locales/translations/en.json:347` + cross-reference to DOC-GAP-303 and `odd-platform__java__ActivityController__controller-method__getActivity.md`. — severity: HIGH
  - "i18next does not escape values; values are rendered as React children, and React's default JSX escaping handles the security boundary. No `dangerouslySetInnerHTML` is used anywhere in the platform UI's t() call sites (verified by repo-wide grep). Therefore the i18n layer does not introduce an XSS surface in this codebase — the boundary is enforced by React, not by the values in this file. Worth knowing: a future contributor introducing `dangerouslySetInnerHTML={{ __html: t('SomeKey') }}` would invert the boundary (the value in en.json or any locale would be executed as HTML). No defence in this file would prevent it; the rule lives at the consumer layer." — evidence: `odd-platform-ui/src/locales/translations/en.json` (no `<script>`, no `{{var}}`, no HTML in values) + repo-wide grep for `dangerouslySetInnerHTML` across `odd-platform-ui/src/` returning zero matches. — severity: LOW (not currently exploitable; an architectural-safety note)

## performance

- **hot_paths**:
  - "Module-load: the file is statically imported at `odd-platform-ui/src/locales/i18n.ts:3` and parsed as JSON into `resources.en.translation` at boot. Parse cost is one-time (~16-25 KB JSON, depending on locale). Bundled into the main JS chunk; included in first-paint critical path." — evidence: `odd-platform-ui/src/locales/i18n.ts:3,11`.
  - "Per-render lookups: every `useTranslation().t(key)` call across the SPA reads from the in-memory dictionary; a typical page (DataEntityDetails, Search, Alerts list) fires 50-200 lookups per render. Lookups are O(1) hash-map probes; aggregate cost is negligible." — evidence: 241 t() call sites across `odd-platform-ui/src/` per the audit grep + `i18n.ts:27-31` (the singleton).
- **throughput_characteristics**: `N/A — static JSON, no per-request work, no batching, no streaming.`
- **resource_allocation**:
  - "418 entries × ~25 bytes average key/value pair = ~21 KB raw JSON; gzipped in the main bundle ~5-8 KB. The six locales together total ~120 KB raw, ~30-50 KB gzipped." — evidence: `wc -l` and disk size of the six locale JSON files at commit 4ec2b20 + the i18n.ts sidecar's resource-allocation block.
- **scaling_characteristics**: `Stateless — file is read-once at module load; the in-memory dictionary is shared by all React components on the same SPA tab. No per-user, no per-request memory growth.`
- **known_performance_gaps**:
  - "The natural-keys pattern means every t() call carries the full English string as the lookup key; long keys (e.g. `\"Are you sure you want to delete this collector?\"` line 35 — 47 chars) are bigger lookup constants than slug keys would be. Per-lookup cost is identical (hash-map probe is O(1) regardless of key length) but the in-memory resource map carries more bytes than necessary. Bounded today (~21 KB en.json); not a defect." — evidence: `odd-platform-ui/src/locales/translations/en.json` (the 47 long-form 'Are you sure...' confirmation keys at lines 33-49). — severity: LOW
  - "Cross-references the i18n.ts sidecar's `performance.known_performance_gaps.[0]` — no code-splitting per locale, all six locale bundles ship together. The bottleneck is not this file's structure but the bootstrap's static imports." — evidence: `odd-platform-ui/src/locales/i18n.ts:3-8`. — severity: LOW

## upstream_callers

- entry_point: "ui_shell_bootstrap:i18n.ts"
  caller_node: "odd-platform ts locales ui-shell-bootstrap:i18n.ts"
  multiplicity_per_trigger: 1
  evidence: "odd-platform-ui/src/locales/i18n.ts:3 (`import en from './translations/en.json';`) — the en bundle is loaded once at module load and bound into `resources.en.translation` on line 11."
  observation_class: boot-eval
- entry_point: "ui_route:*"
  caller_node: "every React component invoking useTranslation()"
  multiplicity_per_trigger: "50-200 per page render"
  evidence: "241 t() call sites across odd-platform-ui/src/ verified by repo-wide grep at commit 4ec2b20; representative sites include Filters.tsx:47-58, ToolbarTabs.tsx:37-79, Alerts.tsx:25, OverviewAttachments.tsx:35, MainSearchInput.tsx:63. Each render reads from the in-memory resource map for the active locale; the en bundle is the canonical English source AND the first fallback for every non-English locale (i18n.ts:30 chain)."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders 418 distinct user-visible strings across every page of the platform UI. The strings are the button labels, table headers, modal titles, confirmation prompts, placeholders, empty-state texts, and inline nouns/verbs the user sees."
  evidence: "odd-platform-ui/src/locales/translations/en.json:2-419 (the 418 entries)"
  cardinality_per_call: "1 per t() lookup; 50-200 per page render aggregate"
  reachable_from_entry_points:
    - "ui_route:* (every authenticated and unauthenticated page reachable in the SPA)"
- side_effect_class: page-render
  description: "Renders the misleading `\"User\"` label on the Activity Feed filter (LSN-020 / DOC-GAP-303 channel)."
  evidence: "odd-platform-ui/src/locales/translations/en.json:347 + Filters.tsx:58"
  cardinality_per_call: "1 per render of the Activity Feed Filters panel"
  reachable_from_entry_points:
    - "ui_route:/activity"
    - "ui_route:/entity/{id}/activity"

## sources

- understanding ← `odd-platform-ui/src/locales/translations/en.json:1-420` (the entire file) + `odd-platform-ui/src/locales/i18n.ts:3,11` (the import + resource binding).
- concepts.entities.translation_key ← `odd-platform-ui/src/locales/translations/en.json:2-419` (the 418 entries).
- concepts.entities.translation_value ← `odd-platform-ui/src/locales/translations/en.json:381` (the only non-natural-keys entry).
- concepts.entities.i18n_resource_bundle ← `odd-platform-ui/src/locales/i18n.ts:3,11`.
- concepts.invariants.shape ← repo-wide JSON structural inspection of en.json.
- concepts.invariants.natural_keys_417_of_418 ← inspection of all 418 entries; one deviation at line 381.
- concepts.invariants.no_interpolation_placeholders ← repo-wide grep for `\\{\\{[a-zA-Z_]+\\}\\}` on en.json returning zero matches.
- concepts.invariants.locale_count_drift ← `wc -l` on the six locale files (en=418, ch=415, fr=415, es=414, hy=414, ua=414).
- concepts.invariants.case_whitespace_duplicates ← linear inspection of the alphabetical key list (17 enumerated pairs).
- dependencies_semantic.requires-feature.i18next_runtime ← `odd-platform-ui/src/locales/i18n.ts:1,2,27`.
- dependencies_semantic.requires-config.default_locale ← `odd-platform-ui/src/locales/i18n.ts:20`.
- dependencies_semantic.requires-config.fallbackLng_chain ← `odd-platform-ui/src/locales/i18n.ts:30`.
- dependencies_semantic.coupling-notes.user_label ← `odd-platform-ui/src/locales/translations/en.json:347` + `odd-platform-ui/src/components/DataEntityDetails/DataEntityActivity/Filters/Filters.tsx:58` + REFERENCE to `odd-platform__java__ActivityController__controller-method__getActivity` (for SQL).
- tests_coverage_semantic.gaps ← absence verified by repo-wide grep for test files referencing locale JSONs at commit 4ec2b20.
- docs_link_semantic.inferred_docs.[0] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` (2026-05-26, status 200).
- docs_link_semantic.inferred_docs.[1] ← REFERENCE to i18n.ts sidecar's WebFetch on the configuration page (2026-05-08, status 200).
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch 2026-05-26 + en.json:347 + Filters.tsx:58 + ReactiveActivityRepositoryImpl.java:272-273 (via REFERENCE).
- docs_link_semantic.doc_drift_findings.[1] ← cross-reference to F-047 finding via the i18n.ts sidecar.
- docs_link_semantic.doc_drift_findings.[2] ← `bugs_limitations_corner_cases.[0]` evidence block (14+ enumerated call sites + en.json absence + six-locale absence).
- implicit_adrs.[0] ← `odd-platform-ui/src/locales/translations/en.json:2-419` (417 of 418 natural-keys entries) + `odd-platform-ui/src/locales/i18n.ts:30`.
- implicit_adrs.[1] ← `odd-platform-ui/src/locales/translations/en.json:381` + `odd-platform-ui/src/components/shared/elements/MainSearchInput/MainSearchInput.tsx:63`.
- implicit_adrs.[2] ← repo-wide grep for `\\{\\{` on en.json (zero matches) + `odd-platform-ui/src/components/Overview/OwnerAssociation/OwnerAssociationForm/OwnerAssociationForm.tsx:153`.
- implicit_adrs.[3] ← `odd-platform-ui/src/locales/i18n.ts:30`.
- bugs_limitations_corner_cases.[0] ← `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:46,51,56` + `odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:23,25,42` + `odd-platform-ui/src/components/MasterData/LookupTableForm.tsx:77,90,129` + `odd-platform-ui/src/components/DataEntityDetails/InternalNameFormDialog/InternalNameFormDialog.tsx:69` + `odd-platform-ui/src/components/DataEntityDetails/DataEntityQueryExamples/DataEntityDetailsQueryExamples.tsx:40` + `odd-platform-ui/src/components/DataEntityDetails/DataEntityQueryExamples/AssignEntityQueryExampleForm.tsx:47,67` + `odd-platform-ui/src/components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:31` + `odd-platform-ui/src/components/DataModelling/QueryExampleDetails/QueryExampleDetailsTabs.tsx:38` + `odd-platform-ui/src/components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:68,69` + grep verification of absence in all six locale JSON files.
- bugs_limitations_corner_cases.[1] ← `wc -l` per-locale file output at commit 4ec2b20.
- bugs_limitations_corner_cases.[2] ← `odd-platform-ui/src/locales/translations/en.json:347` + `odd-platform-ui/src/components/DataEntityDetails/DataEntityActivity/Filters/Filters.tsx:58` + cross-reference to `odd-platform__java__ActivityController__controller-method__getActivity.md` and DOC-GAP-303.
- bugs_limitations_corner_cases.[3] ← `odd-platform-ui/src/locales/translations/en.json:115` + `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:66,111` + `odd-platform-ui/src/routes/termsRoutes.ts:5`.
- bugs_limitations_corner_cases.[4] ← `odd-platform-ui/src/locales/translations/en.json:418` (en `"Statuses": "Statuses"`) + `odd-platform-ui/src/locales/translations/es.json:410` (es `"Statuses": "Estado"`) + the four other locales' identity entries.
- bugs_limitations_corner_cases.[5] ← linear key-list inspection of `odd-platform-ui/src/locales/translations/en.json`.
- bugs_limitations_corner_cases.[6] ← `odd-platform-ui/src/locales/translations/en.json:381` + `odd-platform-ui/src/locales/translations/fr.json:377` (and the other four locales' shorter values).
- bugs_limitations_corner_cases.[7] ← `odd-platform-ui/src/locales/i18n.ts:27-31` (the init call with no missingKey wiring).
- stress_findings.name_behavior_pairs.[0] ← en.json:347 + Filters.tsx:58 + REFERENCE to ActivityController sidecar.
- stress_findings.name_behavior_pairs.[1] ← en.json:115 + ToolbarTabs.tsx:66,111 + termsRoutes.ts:5.
- stress_findings.name_behavior_pairs.[2] ← en.json:381 + fr.json:377 + es.json:376 + ch.json:377 + ua.json:376 + hy.json:376.
- stress_findings.request_inputs.[0] ← en.json:347 + Filters.tsx:58 + REFERENCE to ReactiveActivityRepositoryImpl.java:272-273 via ActivityController sidecar.
- stress_findings.request_inputs.[1] ← en.json:115 + ToolbarTabs.tsx:66 + termsRoutes.ts:5.
- stress_findings.request_inputs.[2] ← `bugs_limitations_corner_cases.[0]` evidence block (the 14+ enumerated absences) + `i18n.ts:27-31` (no missingKey wiring).
- stress_findings.probes_emitted ← `lineage/odd-platform/probes/P-170.yaml` + `P-171.yaml` + `P-172.yaml` (this session's emissions).
- security.auth_mode_relevance ← `odd-platform-ui/src/locales/translations/en.json` (no auth wiring in the file) + `odd-platform-ui/src/locales/i18n.ts:1-33` (no auth-mode-conditional behaviour in the consumer).
- security.data_exposure.[0] ← `odd-platform-ui/src/locales/i18n.ts:3` (static import places en.json in main JS chunk).
- security.known_security_gaps.[0] ← en.json:347 + DOC-GAP-303 + ActivityController sidecar.
- security.known_security_gaps.[1] ← repo-wide grep for `dangerouslySetInnerHTML` returning zero matches across `odd-platform-ui/src/` + the absence of `{{var}}` placeholders in en.json.
- performance.hot_paths.[0] ← `odd-platform-ui/src/locales/i18n.ts:3,11`.
- performance.hot_paths.[1] ← 241 t() call sites across `odd-platform-ui/src/` per repo-wide grep + `i18n.ts:27-31`.
- performance.resource_allocation ← `wc -l` and file sizes on the six locale JSON files at commit 4ec2b20 + the i18n.ts sidecar's resource-allocation block.
- performance.known_performance_gaps.[0] ← lines 33-49 of en.json (the long-form 'Are you sure...' confirmation keys).
- performance.known_performance_gaps.[1] ← REFERENCE to `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:performance.known_performance_gaps.[0]`.
- upstream_callers.[0] ← `odd-platform-ui/src/locales/i18n.ts:3`.
- upstream_callers.[1] ← repo-wide grep for `t\\(['"]` returning 241 call sites at commit 4ec2b20.
- downstream_side_effects.[0] ← `odd-platform-ui/src/locales/translations/en.json:2-419` (the 418 user-visible strings).
- downstream_side_effects.[1] ← en.json:347 + Filters.tsx:58.

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH

## Maintainer notes
