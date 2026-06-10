---
node_id: "odd-platform ts locales ui-shell-bootstrap:i18n.ts"
node_kind: ui-shell-bootstrap
axis: ui_shell
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-01
---

# i18n.ts — UI shell bootstrap for multilingual platform UI — semantic understanding

## understanding

This module is the application-wide initialiser for the platform UI's
internationalisation layer. At app startup it eagerly imports six locale JSON
bundles (`en`, `es`, `ch`, `fr`, `ua`, `hy`), wires them into a single
`i18next` instance via `initReactI18next`, restores the user's previously
chosen language from `localStorage('i18nextLng')` (falling back to `en` on
first visit or unrecognised value), and exports the configured singleton.
The file is loaded for side-effects only — `src/index.tsx:23` does
`import 'locales/i18n';` before `<App />` renders, so by the time any React
component calls `useTranslation()` the resource bundles and active language
are already in memory. There is no lazy-load, no async resource backend, and
no language detector; everything ships in the main JS bundle.

## concepts

- entities: ["locale resource bundle", "language code", "i18n singleton",
  "persisted language preference (localStorage `i18nextLng` key)"]
- operations: ["bootstrap i18next at module load", "register six locale
  resources", "restore saved language from localStorage with whitelist
  guard", "fall back to English on unknown stored value", "expose the
  configured i18n instance as a default export"]
- invariants:
  - "Default language is `'en'` (line 20)."
  - "Stored language is accepted only if it matches one of the six imported
    locale keys; any other value is replaced by the default (lines 22-25)."
  - "Resource bundles are imported statically — every locale's JSON is in
    the main bundle regardless of which one the user picks (lines 3-8, 10-17)."
  - "`fallbackLng` is the literal six-element array `['en','es','ch','fr','ua','hy']`
    (line 30) — i18next will walk this list when a key is missing from the
    active language."
- audiences: ["platform UI end-users (the language switcher in the user menu
  reads `i18n.languages` from this instance — see `SelectLanguage.tsx:48`)",
  "contributors adding a new locale (must edit three places: this file's
  imports + `resources` map, `lib/constants.ts:LANGUAGES_MAP`,
  `lib/constants.ts:LANG_TO_COUNTRY_CODE_MAP`)",
  "operators (documented since 2026-05-28 at docs.opendatadiscovery.org/features/multilingual-ui — DOC-171)"]

## dependencies_semantic

- requires-feature:
  - "react-i18next provider chain — `initReactI18next` plugin on line 27
    binds the instance to React context so `useTranslation()` works."
- requires-config:
  - "Browser `localStorage` access — line 22 reads `i18nextLng`. SSR or
    cookie-disabled environments would throw at module load (no try/catch)."
- requires-runtime:
  - "Six JSON files under `odd-platform-ui/src/locales/translations/` —
    `en.json`, `es.json`, `ch.json`, `fr.json`, `ua.json`, `hy.json`
    (verified to exist on disk at the enriched commit)."
  - "`react-i18next` and `i18next` npm packages (imported lines 1-2)."
- coupling-notes:
  - "Adding a locale is a three-file change: this file (import + resources +
    fallbackLng), `lib/constants.ts` (LANGUAGES_MAP + LANG_TO_COUNTRY_CODE_MAP).
    None of these are linked by tooling — a contributor who edits one and
    forgets the others produces a runtime cast-error in `SelectLanguage.tsx:50`
    (`LANGUAGES_MAP[lang as Lang]` would return undefined)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "localStorage read with unknown locale → falls back to `'en'` (lines 22-25)."
  - "localStorage read with empty string `''` → falsy, falls back via the
    `||` short-circuit on line 22, treated as `defaultLanguage`."
  - "Missing-key behaviour with the six-locale fallback chain (line 30) —
    when a Spanish key is missing, does i18next walk through Chinese,
    French, Ukrainian, Armenian before reaching English? (Per i18next
    semantics it walks the array in order, but this is not asserted by any
    test in this repo.)"
  - "Module-load behaviour when `localStorage` is unavailable (private
    browsing, SSR-style harness)."
- test_files: []
- gaps: |
    No test file under `odd-platform-ui/src/` references `i18n`,
    `useTranslation`, `fallbackLng`, or the `i18nextLng` localStorage key
    (verified via `grep -rln` on test files at the enriched commit; only
    seven test files exist in the UI tree and none touch the i18n layer).
    A regression where a contributor (a) adds a seventh locale to
    `resources` but forgets `LANGUAGES_MAP`, (b) renames `i18nextLng`
    storage key, or (c) drops a locale from `fallbackLng` would ship
    silently — no unit test asserts the bootstrap shape, no integration
    test exercises the language switcher.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "(none — feature absent)"
    rationale: "Primary candidate home — the configuration / deployment
      surface — checked first because the platform's runtime knobs live there."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim WebFetch verdict: "No mention. The documentation page does
      not contain any references to multilingual UI, internationalization
      (i18n), language selection, locales, translations, supported
      languages, or UI language configuration options."
  - url: "https://docs.opendatadiscovery.org/active-platform-features"
    anchor: "(none — feature absent)"
    rationale: "Secondary candidate home — the Features hub. Lists
      Activity Feed, GenAI assistant, Alerting, Notifications — no i18n entry."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim WebFetch verdict: "No mention of a multilingual /
      internationalization / language-selection feature for the ODD
      Platform UI is present in the provided content. The page lists five
      feature categories: Activity Feed, GenAI assistant, Alerting,
      Notifications, Active platform features (main). None reference
      internationalization or language selection capabilities."
  - url: "https://docs.opendatadiscovery.org/"
    anchor: "(site index — searched globally)"
    rationale: "Final sanity check across the published site index."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim WebFetch verdict: "No mention of multilingual UI,
      internationalization, i18n, language picker, locales, translations,
      or supported languages in the provided documentation content."
- doc_drift_findings:
  - "The platform UI ships six end-user-visible locales (`en`/`es`/`ch`/
    `fr`/`ua`/`hy`) and a language-switcher widget in the toolbar, yet
    `docs.opendatadiscovery.org` documents none of it. Three live fetches
    on 2026-05-08 (the platform configuration page, the Features hub, the
    site index) all returned 200 with zero references to i18n,
    internationalisation, language selection, locales, translations, or
    supported languages. This is the canonical F-047 finding (see
    `findings/docs-coverage-undocumented-features/2026-05-08.md#F-047`)
    and the original case for `retrospectives/LSN-013-research-punted-on-substrate-draft.md`.
    A DOC-NNN backlog item is the expected next step."

## implicit_adrs

- "i18n is loaded eagerly at app start as a side-effect import, not lazily
  per-locale; every locale's JSON ships in the main bundle." — evidence:
  `odd-platform-ui/src/index.tsx:23` (`import 'locales/i18n';` with no
  module specifier guard) + `odd-platform-ui/src/locales/i18n.ts:3-8`
  (six static `import` declarations for each locale's JSON, not dynamic
  `import()`). — confidence: HIGH
- "Language preference is persisted client-side only, in `localStorage`
  under the key `i18nextLng`, with no server-side user-profile binding." —
  evidence: `odd-platform-ui/src/locales/i18n.ts:22` (read) +
  `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:30`
  (write — `localStorage.setItem('i18nextLng', lang)`). No backend API
  call accompanies the language change; no user record stores it. —
  confidence: HIGH
- "Translation keys are the literal English source phrases (the
  natural-keys i18next pattern), so a missing key in a non-English locale
  silently renders the English phrase rather than a placeholder or error." —
  evidence: `odd-platform-ui/src/locales/translations/en.json` (first
  entries: `\"About\": \"About\"`, `\"Accept\": \"Accept\"`, …) +
  `odd-platform-ui/src/locales/i18n.ts:30` (`fallbackLng` chain ending in
  `'en'`). — confidence: HIGH
- "Locale set is a three-file change (this file + LANGUAGES_MAP +
  LANG_TO_COUNTRY_CODE_MAP); no registry/auto-discovery pattern." —
  evidence: `odd-platform-ui/src/locales/i18n.ts:3-8,10-17,30` +
  `odd-platform-ui/src/lib/constants.ts:158-174`. — confidence: HIGH

## bugs_limitations_corner_cases

- "`fallbackLng` is set to the full six-element array `['en','es','ch','fr','ua','hy']`
  rather than the conventional `'en'`. Per i18next semantics, when a key is
  missing in the active language i18next walks the array in order; the
  practical effect is that a French user with a missing key will, before
  reaching English, attempt Spanish and Chinese first. Because translation
  keys ARE the English phrases (e.g. `\"About\": \"About\"`), the user
  most often sees English regardless — but for any key present in
  Spanish/Chinese but missing in French, the user would see Spanish or
  Chinese unexpectedly. This is almost certainly not the intended UX." —
  evidence: `odd-platform-ui/src/locales/i18n.ts:30` + the natural-keys
  pattern visible in `translations/en.json`. — severity: MEDIUM
- "Language preference is stored only in `localStorage('i18nextLng')`, not
  on the user's account. Clearing browser data, switching browsers, using
  a private window, or signing in on a new device resets the user to the
  default English. There is no server-side persistence." — evidence:
  `odd-platform-ui/src/locales/i18n.ts:22` (read) +
  `SelectLanguage.tsx:30` (write — local-only). — severity: LOW
- "Stored-value validation is a strict whitelist (line 23-25), so if a
  locale is removed in a future release any user who had selected that
  locale silently reverts to English on next load. No deprecation message,
  no migration mapping." — evidence:
  `odd-platform-ui/src/locales/i18n.ts:22-25`. — severity: LOW
- "If `localStorage` access throws (privacy mode in some browsers, certain
  iframe sandboxes), the bootstrap module raises at app load with no
  fallback path — the entire UI fails to render. There is no try/catch
  around the `localStorage.getItem` call on line 22." — evidence:
  `odd-platform-ui/src/locales/i18n.ts:22` (unguarded `localStorage`
  access). — severity: LOW
- "The six locales are bundled regardless of which the user selects — no
  code-splitting on locale. Bundle-size impact is bounded (JSON files
  16-25 KB each per `ls -la` at the enriched commit, ~120 KB total
  uncompressed for the locale layer); not a defect, but worth knowing
  before adding a seventh locale." — evidence: static `import` syntax on
  `odd-platform-ui/src/locales/i18n.ts:3-8`. — severity: LOW
- "RESOLVED 2026-05-28 (DOC-171): the multilingual UI feature is now
  documented end-to-end at docs.opendatadiscovery.org/features/multilingual-ui
  (supported locales, switching, local-only persistence, new-locale
  contribution; live-verified 2026-06-10 HTTP 200). Historical: undocumented
  as of 2026-05-08 — three live WebFetch attempts (configuration page,
  Features hub, site index) returned 200 with zero references." — evidence:
  the live page + the original F-047 finding
  in `findings/docs-coverage-undocumented-features/2026-05-08.md#F-047`. —
  severity: MEDIUM (resolved)

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this module is client-side
  bootstrap code that runs in the browser and is not on the HTTP surface;
  none of `DISABLED` / `LOGIN_FORM` / `OAUTH2` / `LDAP` couple to its
  behaviour. The `localStorage('i18nextLng')` read on line 22 and the
  `i18next.init({...})` call on lines 27-31 execute identically regardless
  of the platform's active `auth.type`. There is no `@ConditionalOnProperty`
  analogue, no auth-aware branch, no token check. Auth-mode-name vocabulary
  verified verbatim against the live ODD docs (WebFetch
  `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`,
  2026-05-08, status 200) — the page lists exactly
  `auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)`.
- **ingestion_filter_relevance**: `N/A — not HTTP, not ingestion path`. This
  module never participates in the `POST /ingestion/entities` flow; the
  `auth.ingestion.filter.enabled` knob has no relationship to any code in
  this file.
- **authorization_assertions**: `[]` — no Spring Security expressions, no
  Permission / Role / Policy gates, no programmatic `permissionService.hasPermission(...)`
  calls. This is a UI bootstrap module; authorization is irrelevant by design.
- **owner_scoping**: `N/A — code is not data-scoped`. The module operates
  on a six-element static locale list; it does not query, filter, or
  expose any data-entity, alert, owner, or other ODD domain object.
- **data_exposure**:
  - "`localStorage('i18nextLng')` value (a 2-letter locale code from the
    closed set `{en, es, ch, fr, ua, hy}`) → any JavaScript executing on
    the same browser origin (extensions, XSS payloads, devtools), under
    every auth mode (`DISABLED` / `LOGIN_FORM` / `OAUTH2` / `LDAP`)." —
    evidence: `odd-platform-ui/src/locales/i18n.ts:22` (read) +
    `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:30`
    (write). The persisted value is a UI preference — not a credential,
    not PII, not a session identifier.
- **known_security_gaps**:
  - "Bootstrap calls `localStorage.getItem('i18nextLng')` unguarded on line
    22; in browser configurations where `localStorage` access throws
    (privacy mode in some Safari/Firefox builds, certain iframe sandboxes),
    the import-for-side-effects at `src/index.tsx:23` raises before
    `<App />` renders, denying the entire UI to the user. This is an
    availability concern, not a confidentiality one — but it means the
    `auth.type=LOGIN_FORM` login screen itself becomes unreachable in
    those browsers." — evidence: `odd-platform-ui/src/locales/i18n.ts:22`
    (no try/catch around the `localStorage` access) +
    `odd-platform-ui/src/index.tsx:23` (side-effect import order). —
    severity: LOW
  - "`localStorage('i18nextLng')` is plain-text and origin-scoped, so any
    JS on the origin (browser extensions, an XSS payload elsewhere in the
    SPA) can read or overwrite it. Reading it leaks only the user's UI
    language preference; overwriting it forces the next page-load to
    bootstrap the chosen locale (or fall back to `'en'` via the line
    23-25 whitelist if the injected value is outside the six-element set).
    No security boundary is crossed — but the value is not encrypted,
    not signed, and not tied to the authenticated session." — evidence:
    `odd-platform-ui/src/locales/i18n.ts:22-25` (whitelist guard bounds
    the impact of an attacker-controlled value to the six valid locales)
    + `SelectLanguage.tsx:30` (write side, also unsigned). — severity: LOW

## performance

- **hot_paths**:
  - "Module-load runs once per app boot — synchronously imports six locale
    JSON bundles (lines 3-8), constructs the `resources` map (lines 10-17),
    reads `localStorage` once (line 22), and calls `i18n.use(initReactI18next).init({...})`
    once (lines 27-31). Because `src/index.tsx:23` does
    `import 'locales/i18n';` before `<App />` mounts, this work is on
    the critical path of first paint." — evidence:
    `odd-platform-ui/src/locales/i18n.ts:1-33` + `odd-platform-ui/src/index.tsx:23`.
  - "Every React component that calls `useTranslation()` reads from this
    module's exported i18next singleton on each render, walking the
    in-memory `resources` map for the active language and (on cache miss)
    the six-element `fallbackLng` chain (line 30). On a typical platform
    page — DataEntityDetails, Search, Alerts list — this fires hundreds
    of times per render cycle." — evidence:
    `odd-platform-ui/src/locales/i18n.ts:27-31,33` (the singleton export)
    + the `useTranslation` import in `SelectLanguage.tsx:2,19` as the
    representative consumer.
- **throughput_characteristics**: `N/A — not a request-handling, batching,
  or streaming path`. The module is a one-shot module-scope singleton
  initialiser; there is no per-request work, no queue, no batch boundary.
- **resource_allocation**:
  - "All six locale JSON files are bundled into the main JS chunk via
    static `import` declarations (lines 3-8), regardless of which locale
    the user actually selects. Total payload bounded at ~120 KB
    uncompressed for the locale layer (per the bundle-size note in
    `bugs_limitations_corner_cases.[4]` above)." — evidence:
    `odd-platform-ui/src/locales/i18n.ts:3-8`.
  - "A single `i18next` instance is held in module-scope memory after
    `init({...})` returns (line 33's `export default i18n;`). Memory
    footprint is the `resources` map (six locale dictionaries) plus
    i18next's internal caches — bounded, not per-user, not per-render." —
    evidence: `odd-platform-ui/src/locales/i18n.ts:10-17,27-31,33`.
- **scaling_characteristics**:
  - "Stateful at module level — the `i18next` singleton on line 33 holds
    the active language and resource map in process memory for the
    lifetime of the SPA tab." — evidence: `odd-platform-ui/src/locales/i18n.ts:27-33`.
  - "Stateless across the platform backend — no API call, no per-user
    server record, no DB row is touched by the language preference; it
    lives entirely in the browser's `localStorage`. Switching browsers,
    devices, or clearing site data resets the user to `'en'`." —
    evidence: `odd-platform-ui/src/locales/i18n.ts:22` (browser-only
    persistence) + `SelectLanguage.tsx:30` (write side, also browser-only).
- **known_performance_gaps**:
  - "No code-splitting on locale — every user pays the full ~120 KB
    locale payload in the main JS bundle even though only one locale is
    active at a time. The conventional i18next pattern is dynamic
    `import()` per-locale or `i18next-http-backend` lazy loading; neither
    is used here. Bounded today, but adding a seventh locale grows the
    main bundle linearly." — evidence:
    `odd-platform-ui/src/locales/i18n.ts:3-8` (static imports, not
    `import()`). Already surfaced as
    `bugs_limitations_corner_cases.[4]` above. — severity: LOW
  - "`fallbackLng` is the full six-element array `['en','es','ch','fr','ua','hy']`
    on line 30 rather than the conventional `'en'`. On a missing key,
    i18next walks all six locales in order before giving up. Per-render
    cost is small (in-memory map lookups), but for a key genuinely
    missing across all locales, the lookup does six failed map probes
    instead of one. Already surfaced as
    `bugs_limitations_corner_cases.[0]` above as a UX concern; the
    secondary effect is a marginal performance one." — evidence:
    `odd-platform-ui/src/locales/i18n.ts:30`. — severity: LOW

## sources

- understanding ← `odd-platform-ui/src/locales/i18n.ts:1-33` +
  `odd-platform-ui/src/index.tsx:23` (the side-effect importer).
- concepts.entities.locale_resource_bundle ← `odd-platform-ui/src/locales/i18n.ts:10-17`
- concepts.entities.persisted_language_preference ← `odd-platform-ui/src/locales/i18n.ts:22`
- concepts.operations.bootstrap_i18next_at_module_load ← `odd-platform-ui/src/locales/i18n.ts:27-31`
- concepts.operations.restore_saved_language ← `odd-platform-ui/src/locales/i18n.ts:22-25,29`
- concepts.invariants.default_en ← `odd-platform-ui/src/locales/i18n.ts:20`
- concepts.invariants.whitelist_guard ← `odd-platform-ui/src/locales/i18n.ts:22-25`
- concepts.invariants.fallback_chain ← `odd-platform-ui/src/locales/i18n.ts:30`
- concepts.audiences.contributors ← `odd-platform-ui/src/locales/i18n.ts:3-8,10-17`
  + `odd-platform-ui/src/lib/constants.ts:158-174`
- dependencies_semantic.requires-feature ← `odd-platform-ui/src/locales/i18n.ts:2,27`
- dependencies_semantic.requires-config.localstorage ← `odd-platform-ui/src/locales/i18n.ts:22`
- dependencies_semantic.requires-runtime.locale_jsons ← directory listing of
  `odd-platform-ui/src/locales/translations/` at commit ede5d277 (six files:
  `en.json`, `es.json`, `ch.json`, `fr.json`, `ua.json`, `hy.json`)
- tests_coverage_semantic.gaps ← absence verified by repo-wide grep for
  `i18n|fallbackLng|useTranslation` across `*.test.ts(x)` and `*.spec.ts(x)`
  files in `odd-platform-ui/src/` — zero matches at commit ede5d277.
- docs_link_semantic.inferred_docs.[0] ← WebFetch
  `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform`
  (2026-05-08, status 200)
- docs_link_semantic.inferred_docs.[1] ← WebFetch
  `https://docs.opendatadiscovery.org/active-platform-features` (2026-05-08,
  status 200)
- docs_link_semantic.inferred_docs.[2] ← WebFetch
  `https://docs.opendatadiscovery.org/` (2026-05-08, status 200)
- docs_link_semantic.doc_drift_findings.[0] ←
  `findings/docs-coverage-undocumented-features/2026-05-08.md#F-047` +
  the three WebFetch results above.
- implicit_adrs.[0] ← `odd-platform-ui/src/index.tsx:23` +
  `odd-platform-ui/src/locales/i18n.ts:3-8`
- implicit_adrs.[1] ← `odd-platform-ui/src/locales/i18n.ts:22` +
  `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:30`
- implicit_adrs.[2] ← `odd-platform-ui/src/locales/translations/en.json:1-10`
  + `odd-platform-ui/src/locales/i18n.ts:30`
- implicit_adrs.[3] ← `odd-platform-ui/src/locales/i18n.ts:3-8,10-17,30` +
  `odd-platform-ui/src/lib/constants.ts:158-174`
- bugs_limitations_corner_cases.[0] ← `odd-platform-ui/src/locales/i18n.ts:30`
  + `odd-platform-ui/src/locales/translations/en.json` (natural-keys pattern)
- bugs_limitations_corner_cases.[1] ← `odd-platform-ui/src/locales/i18n.ts:22`
  + `SelectLanguage.tsx:30`
- bugs_limitations_corner_cases.[2] ← `odd-platform-ui/src/locales/i18n.ts:22-25`
- bugs_limitations_corner_cases.[3] ← `odd-platform-ui/src/locales/i18n.ts:22`
- bugs_limitations_corner_cases.[4] ← `odd-platform-ui/src/locales/i18n.ts:3-8`
  + directory listing of `translations/`
- bugs_limitations_corner_cases.[5] ← three WebFetch results (2026-05-08) +
  `findings/docs-coverage-undocumented-features/2026-05-08.md#F-047`
- security.auth_mode_relevance ← `odd-platform-ui/src/locales/i18n.ts:1-33`
  (no auth-mode-coupling code present in the entire file) +
  `odd-platform-ui/src/index.tsx:23` (side-effect import unconditional on
  any auth wiring) + WebFetch
  `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`
  (2026-05-08, status 200) for the verbatim auth-mode names
  `DISABLED / LOGIN_FORM / OAUTH2 / LDAP`.
- security.ingestion_filter_relevance ← `odd-platform-ui/src/locales/i18n.ts:1-33`
  (no HTTP request handling, no `/ingestion/**` path matcher, no filter chain).
- security.authorization_assertions ← `odd-platform-ui/src/locales/i18n.ts:1-33`
  (no `@PreAuthorize`, no `permissionService` call, no Spring Security
  expression — this is a TS module, not a Java controller).
- security.owner_scoping ← `odd-platform-ui/src/locales/i18n.ts:1-33`
  (the file's six-element static locale list and `i18nextLng` localStorage
  read have no relationship to the ownership model).
- security.data_exposure.[0] ← `odd-platform-ui/src/locales/i18n.ts:22`
  (read) + `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:30`
  (write — `localStorage.setItem('i18nextLng', lang)`) + the closed-set
  whitelist on `odd-platform-ui/src/locales/i18n.ts:23-25`.
- security.known_security_gaps.[0] ← `odd-platform-ui/src/locales/i18n.ts:22`
  (unguarded `localStorage.getItem` call) +
  `odd-platform-ui/src/index.tsx:23` (side-effect import order — module
  load happens before `<App />` mounts, so a throw here denies the entire
  UI including the login screen).
- security.known_security_gaps.[1] ← `odd-platform-ui/src/locales/i18n.ts:22-25`
  (whitelist guard bounds attacker-controlled values to the six valid
  locales) + `SelectLanguage.tsx:30` (write side, also unsigned and
  origin-scoped).
- performance.hot_paths.[0] ← `odd-platform-ui/src/locales/i18n.ts:1-33`
  (the bootstrap body) + `odd-platform-ui/src/index.tsx:23` (the
  side-effect importer that places this work on the critical path of
  first paint).
- performance.hot_paths.[1] ← `odd-platform-ui/src/locales/i18n.ts:27-31,33`
  (the singleton export) +
  `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:2,19`
  (representative `useTranslation()` consumer).
- performance.resource_allocation.[0] ← `odd-platform-ui/src/locales/i18n.ts:3-8`
  (six static `import` declarations — no dynamic `import()`).
- performance.resource_allocation.[1] ← `odd-platform-ui/src/locales/i18n.ts:10-17,27-31,33`
  (the `resources` map + `init({...})` call + default-export of the
  configured singleton).
- performance.scaling_characteristics.[0] ← `odd-platform-ui/src/locales/i18n.ts:27-33`
  (the singleton lives in module-scope memory for the SPA tab's lifetime).
- performance.scaling_characteristics.[1] ← `odd-platform-ui/src/locales/i18n.ts:22`
  (browser-only `localStorage` persistence) + `SelectLanguage.tsx:30`
  (write side — also browser-only, no API call).
- performance.known_performance_gaps.[0] ← `odd-platform-ui/src/locales/i18n.ts:3-8`
  (static imports, not dynamic `import()`); cross-references
  `bugs_limitations_corner_cases.[4]` above.
- performance.known_performance_gaps.[1] ← `odd-platform-ui/src/locales/i18n.ts:30`
  (the six-element `fallbackLng` array); cross-references
  `bugs_limitations_corner_cases.[0]` above.

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

## Maintainer notes
