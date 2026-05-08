---
node_id: "odd-platform ts components/shared/elements/AppToolbar ui-shell-widget:SelectLanguage"
node_kind: ui-shell-widget
axis: ui_shell
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-02
---

# SelectLanguage — language-switcher widget in the AppToolbar user menu — semantic understanding

## understanding

`SelectLanguage` is the user-facing widget that lets a logged-in operator
change the platform UI's active locale. It renders a `DialogWrapper`-backed
modal opened from a menu item inside the user-account dropdown of
`AppToolbar`; the modal lists every locale registered in the i18n bootstrap
(read live from `i18n.languages`), filtered by a search input that matches
on the friendly language name from `LANGUAGES_MAP`. Picking a row calls
`i18n.changeLanguage(lang)` to swap the active resource bundle in memory and
then writes the chosen code to `localStorage('i18nextLng')` — the
write-side counterpart to the read in `locales/i18n.ts:22`. There is no
backend call, no user-record update, no cookie, no event dispatched: the
component owns the entire persistence path for language preference.

## concepts

- entities: ["language code (`Lang` = key of `LANGUAGES_MAP`)",
  "friendly language name (`LANGUAGES_MAP[lang]`)",
  "country flag code (`LANG_TO_COUNTRY_CODE_MAP[lang]`)",
  "persisted language preference (`localStorage` key `i18nextLng`)",
  "i18next runtime instance (`i18n` from `useTranslation()`)",
  "language-selection dialog (`DialogWrapper` modal)"]
- operations: ["render the language-switcher dialog from a toolbar menu
  trigger", "list all locales currently registered with i18next",
  "filter the locale list by a case-insensitive substring on the friendly
  name", "swap the active i18next language at runtime",
  "persist the chosen language to `localStorage('i18nextLng')`",
  "close the dialog and the parent toolbar menu after a selection"]
- invariants:
  - "The locale list is read from `i18n.languages` (line 48), not from a
    hard-coded array — so the widget displays whatever locales the bootstrap
    registered. If `locales/i18n.ts` adds or removes a `resources` entry,
    this widget reflects the change without code edits."
  - "The friendly-name filter (line 50) calls `LANGUAGES_MAP[lang as Lang]`
    with no guard. If `i18n.languages` ever contains a code missing from
    `LANGUAGES_MAP`, the `.toLowerCase()` call dereferences `undefined` and
    throws at filter time."
  - "Language change is fire-and-forget client-side: line 29 `await
    i18n.changeLanguage(lang)` then line 30 `localStorage.setItem(...)` —
    no error handling; no rollback if the storage write throws."
  - "The widget closes both modals on success (lines 31-32: `handleClose()`
    for the dialog, then `handleMenuClose()` for the toolbar dropdown). On
    a thrown await it would close neither — the user would be left in
    whichever locale `changeLanguage` partially applied."
- audiences: ["platform UI end-users (the only place in the UI to change
  language; entry point is the user-account menu in the top-right toolbar)",
  "operators (today: undocumented per F-047 — no operator-facing page
  describes that this menu exists, where to find it, or that the choice is
  browser-local)",
  "contributors adding a new locale (must edit `locales/i18n.ts` resources +
  `LANGUAGES_MAP` + `LANG_TO_COUNTRY_CODE_MAP`; this widget needs no edits
  because it iterates `i18n.languages` and looks up by code)"]

## dependencies_semantic

- requires-feature:
  - "i18next runtime initialised before render — the `useTranslation()` hook
    on line 19 returns `{ t, i18n }` from the React context provided by
    `initReactI18next` in `locales/i18n.ts:27`. If the bootstrap import is
    removed from `index.tsx`, this widget renders with `i18n.languages = []`
    and the dialog body is empty."
  - "`DialogWrapper` modal-open contract — line 73 calls `cloneElement(openBtn,
    { onClick: handleOpen })` to inject the open handler into the parent's
    trigger element. Any `openBtn` that already declares `onClick` will have
    it overwritten."
- requires-config:
  - "Browser `localStorage` write access — line 30 `localStorage.setItem(
    'i18nextLng', lang)`. In private-browsing modes that throw on writes
    (Safari with site data disabled, certain iframe sandboxes), the language
    DOES change in memory (line 29 already awaited) but the persistence step
    raises and `handleClose` / `handleMenuClose` never fire — the dialogs
    stay open and the user perceives the click as broken."
- requires-runtime:
  - "`LANGUAGES_MAP` and `LANG_TO_COUNTRY_CODE_MAP` from `lib/constants.ts`
    must contain an entry for every code that `i18n.languages` returns. If
    a locale is added to the i18n bootstrap but missed in constants, both
    the filter (line 50) and the country-flag lookup (line 60) deref
    `undefined`."
  - "`react-country-flag` package — renders the flag SVG from a 2-letter
    country code on line 59-62. Note the indirection: the locale code (`hy`,
    `ch`, etc.) is not a country code; `LANG_TO_COUNTRY_CODE_MAP` does the
    translation (`hy → am` Armenia, `ch → cn` China, `en → gb` United
    Kingdom)."
- coupling-notes:
  - "Write-side counterpart to `locales/i18n.ts:22`. Together they form a
    closed-loop client-only persistence model: this widget writes
    `i18nextLng`, the bootstrap reads it on next page-load. No third party
    (backend, cookie, server-rendered preference) is in the loop."
  - "Mounted by `AppToolbar.tsx:97` inside an `AppMenu`, with the trigger
    `AppMenuItem` passed in as `openBtn` (lines 99-115 of `AppToolbar.tsx`).
    The trigger node displays the *currently active* language name via
    `LANGUAGES_MAP[i18n.language as Lang]` on `AppToolbar.tsx:48` — that
    label is computed in `AppToolbar`, not in this widget."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Clicking a language row calls `i18n.changeLanguage(lang)` then writes
    `localStorage('i18nextLng', lang)` (lines 28-32) — neither side asserted
    by any test."
  - "Search filter is case-insensitive substring match on the friendly name
    (line 50) — boundary cases (whitespace-only query, empty string,
    diacritics in the friendly name) untested."
  - "Behaviour when `i18n.languages` contains a code missing from
    `LANGUAGES_MAP` (line 50 throws) — no defensive test."
  - "Behaviour when `localStorage.setItem` throws (private mode) — line 30
    is unguarded; the dialogs stay open. Untested."
- test_files: []
- gaps: |
    Repo-wide grep for `SelectLanguage`, `select.language`, and `i18nextLng`
    across `*.test.*` and `*.spec.*` files in
    `odd-platform-ui/src/` returns zero matches at commit ede5d277
    (verified). The widget has no unit, integration, or end-to-end test
    coverage. A regression where (a) `localStorage.setItem` is replaced by
    a backend POST without dialog-close handling, (b) `i18n.languages`
    ordering changes and rows disappear, or (c) a contributor renames the
    storage key would ship silently. The widget's coupling to
    `locales/i18n.ts` (read side) means a single rename or key change in
    one of those two files would silently desync the read/write sides —
    and no test exists to catch it.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "(none — feature absent)"
    rationale: "Primary candidate home — operator-facing configuration page
      where deployment knobs live; checked first because the persistence
      caveat (browser-local only) is operator-relevant."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim WebFetch verdict (2026-05-08): "**No mention** of language
      selection, multilingual support, internationalization (i18n), locale
      settings, translation, supported languages, language picker, language
      switcher, SelectLanguage, or UI language configuration. The
      documentation covers deployment, database connections, security,
      sessions, metrics, alerts, notifications, data collaboration,
      attachments, logging, and GenAI configuration — but contains no
      references to language or localization features for the ODD Platform
      interface."
  - url: "https://docs.opendatadiscovery.org/active-platform-features"
    anchor: "(none — feature absent)"
    rationale: "Secondary candidate home — the Features hub where the
      multilingual UI would be a discoverable feature."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim WebFetch verdict (2026-05-08): "**No mention** of any of the
      following terms appears on this page: language selection, multilingual,
      internationalization, i18n, locale, translation, supported languages,
      language picker, language switcher, SelectLanguage, UI language
      configuration. This page is a 'Page Not Found' error message for the
      Open Data Discovery documentation, containing only navigation
      suggestions and instructions for finding documentation content."
      (Note: at the i18n.ts sidecar's fetch on the same date the page returned
      a populated Features hub. The body shape returned today differs; the
      verdict — feature absent — is unchanged.)
  - url: "https://docs.opendatadiscovery.org/"
    anchor: "(site index — searched globally)"
    rationale: "Final sanity check across the published site index."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim WebFetch verdict (2026-05-08): "language selection: No
      mention; multilingual: No mention; internationalization: No mention;
      i18n: No mention; locale: No mention; translation: No mention;
      supported languages: No mention; language picker: No mention;
      language switcher: No mention; SelectLanguage: No mention; UI language
      configuration: No mention. Overall result: No mention."
- doc_drift_findings:
  - "The platform UI's only language-switcher widget is undocumented:
    `docs.opendatadiscovery.org` does not describe its existence, its
    location in the user-account menu, or the browser-local persistence
    model it embodies. An operator with a Spanish-, French-, Ukrainian-,
    Armenian-, or Chinese-speaking user base has no way to learn from the
    docs that the UI supports those languages or where the switcher lives.
    This is the WRITE-side companion to the i18n.ts sidecar's READ-side
    drift finding; both feed the canonical F-047 case in
    `findings/docs-coverage-undocumented-features/2026-05-08.md#F-047`. A
    DOC-NNN backlog item titled 'Localization (i18n)' under
    Configuration-and-Deployment or Features is the expected next step."

## implicit_adrs

- "Language preference is persisted **client-side only**, in `localStorage`
  under the key `i18nextLng`, with no server-side user-profile binding.
  Switching browsers / private mode / clearing site data resets the choice
  to default English." — evidence:
  `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:30`
  (write — `localStorage.setItem('i18nextLng', lang)`) +
  `odd-platform-ui/src/locales/i18n.ts:22` (read — same key) + grep for
  `i18nextLng` across `odd-platform-api/src/main/java/` returns zero
  matches at commit ede5d277. — confidence: HIGH
- "Locale persistence is fire-and-forget with no error handling. After
  `i18n.changeLanguage` resolves, `localStorage.setItem` runs unguarded; if
  the storage write throws, the in-memory language change has already
  applied but neither dialog closes." — evidence:
  `SelectLanguage.tsx:28-33` (no try/catch around the setItem; lines 31-32
  only run if line 30 succeeds). — confidence: HIGH
- "The language-switcher is locale-discovery-driven from the i18n runtime,
  not from a hard-coded list. The widget iterates `i18n.languages` (line 48)
  rather than `Object.keys(LANGUAGES_MAP)` — adding a locale to the i18n
  bootstrap automatically surfaces it here." — evidence:
  `SelectLanguage.tsx:48` + `locales/i18n.ts:10-17,30`. — confidence: HIGH
- "Country-flag display uses an indirect locale-to-country mapping
  (`LANG_TO_COUNTRY_CODE_MAP`), accepting that the spoken language and the
  flag's country are different concepts (e.g. English → UK flag, Armenian →
  Armenia not the locale `hy`, Chinese → China). The choice trades political
  ambiguity (English isn't only spoken in the UK; Spanish flag is Spain not
  Latin America) for a more recognisable visual cue than a 2-letter code." —
  evidence: `SelectLanguage.tsx:60-62` + `lib/constants.ts:167-174`. —
  confidence: HIGH
- "Search-by-friendly-name only. The filter on line 50 matches against
  `LANGUAGES_MAP[lang]` (English-locale name, e.g. `'Spanish'`); a user
  typing the native form (`'Español'`, `'Українська'`) gets no results.
  Decision is implicit — no native-name lookup table exists in the
  codebase." — evidence: `SelectLanguage.tsx:48-50` + `lib/constants.ts:158-165`.
  — confidence: HIGH

## bugs_limitations_corner_cases

- "The friendly-name lookup on line 50 (`LANGUAGES_MAP[lang as Lang]`) and
  the country-code lookup on line 60 (`LANG_TO_COUNTRY_CODE_MAP[lang as Lang]`)
  use a TypeScript cast — at runtime there is no guard. If a contributor
  adds a locale to `locales/i18n.ts:resources` but forgets to update the
  two maps in `lib/constants.ts`, the filter dereferences `undefined` and
  throws a `TypeError: Cannot read properties of undefined (reading
  'toLowerCase')` the moment the user opens the dialog. The dialog crashes
  rather than gracefully omitting the unmapped locale." — evidence:
  `SelectLanguage.tsx:48-50,60` (no `if (LANGUAGES_MAP[lang])` guard) +
  `lib/constants.ts:158-174` (manual maps). — severity: MEDIUM
- "If `localStorage.setItem` throws (Safari private mode, sandboxed iframe,
  storage-quota exceeded), line 30 raises after line 29 has already
  swapped the active i18next language in memory. The dialogs (lines 31-32)
  do NOT close; the user sees the UI translate but the modal stays open
  and the toolbar dropdown stays open — a confusing half-applied state.
  No try/catch wraps the setItem." — evidence: `SelectLanguage.tsx:28-33`. —
  severity: LOW
- "Language preference is browser-local. A user signing in on a new device,
  in a new browser, or after clearing site data lands on default English
  regardless of how many times they previously chose another locale on
  another machine. There is no server-side preference, no cookie, no API
  to set a profile-level default. Operators deploying ODD for a non-English
  user base must rely on every user finding the toolbar menu and choosing
  themselves on every device they use." — evidence: `SelectLanguage.tsx:30`
  (write — local-only; no fetch, no Redux dispatch) + grep for
  `i18nextLng` across `odd-platform-api/` returns zero matches at commit
  ede5d277. — severity: LOW
- "The search box filters by English-locale friendly name only. A user who
  reads only Spanish and types `'Español'` to find their language sees an
  empty list. Native-language names (the conventional self-naming UX in
  language pickers) are not implemented." — evidence: `SelectLanguage.tsx:50`
  + `lib/constants.ts:158-165`. — severity: LOW
- "The trigger element passed in as `openBtn` has its `onClick` overwritten
  by `cloneElement(openBtn, { onClick: handleOpen })` (line 73). A caller
  who attaches an analytics or tracking handler to the trigger's `onClick`
  will see it silently replaced. `AppToolbar.tsx:99-115` does not currently
  rely on this — but the contract is undocumented at the prop boundary." —
  evidence: `SelectLanguage.tsx:73`. — severity: LOW
- "The multilingual UI feature — including this widget's existence and
  location — is undocumented on the public site as of 2026-05-08.
  Operators have no way to learn the menu exists, that preference is
  browser-local, or that six locales are bundled. Three live WebFetch
  attempts on 2026-05-08 (configuration page, Features hub, site index)
  returned 200 with zero references." — evidence: the three
  `documents.inferred_docs` entries above + the canonical F-047 finding
  in `findings/docs-coverage-undocumented-features/2026-05-08.md#F-047`. —
  severity: MEDIUM

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a client-side React UI
  widget, not an HTTP endpoint. The four documented auth modes
  (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`, per the live security page
  WebFetched 2026-05-08, status 200) gate the surrounding application
  shell, but the language-switcher's behaviour is mode-agnostic: under any
  active `auth.type`, opening the dialog, picking a locale, and persisting
  to `localStorage` work identically. There is no code path in
  `SelectLanguage.tsx` that branches on the active auth mode.
- **ingestion_filter_relevance**: `N/A — not on the ingestion path`. This
  widget is part of the platform UI shell mounted via `AppToolbar`; the
  S2S ingestion filter (`auth.ingestion.filter.enabled` per the live
  security docs) gates `POST /ingestion/entities` and unrelated server-side
  request flows.
- **authorization_assertions**: `[]` — the widget enforces no
  permission, role, or policy gate. Language switching is available to
  every user who has reached the toolbar (i.e. anyone past the active
  authentication mode). This is not a finding: locale preference is not
  data-scoped and has no authorization model in ODD's vocabulary
  (Permission / Role / Policy / Owner — none apply).
- **owner_scoping**: `N/A — code is not data-scoped`. The widget reads
  the static locale list from `i18n.languages` and writes a 2-letter code
  to `localStorage`; no DataEntity, Owner, or other ODD domain object is
  read or written.
- **data_exposure**:
  - `"chosen locale code (2-letter ISO, e.g. 'en', 'es', 'uk', 'hy', 'fr', 'ch') → localStorage key 'i18nextLng', readable by any same-origin JavaScript including XSS payloads"` — evidence:
    `SelectLanguage.tsx:30` (`localStorage.setItem('i18nextLng', lang)`).
- **known_security_gaps**:
  - `"localStorage value 'i18nextLng' is unsigned, unencrypted, and same-origin-readable — but it carries only a 2-letter locale code drawn from a fixed whitelist (the keys of LANGUAGES_MAP / LANG_TO_COUNTRY_CODE_MAP). An XSS attacker reading or writing this key gains nothing operationally beyond changing the victim's UI language; no session token, user identity, or authorization claim is stored under this key."` —
    evidence: `SelectLanguage.tsx:30` (write site) +
    `odd-platform-ui/src/locales/i18n.ts:22` (read site, same key) +
    `odd-platform-ui/src/lib/constants.ts:158-165` (`LANGUAGES_MAP` —
    fixed whitelist of 6 entries: `en | es | uk | hy | fr | ch`). —
    severity: LOW
  - `"the security configuration documentation (live, WebFetched 2026-05-08, status 200) does not mention browser-side preference persistence at all. Operators reviewing the auth posture have no doc-side cue that the platform writes to localStorage; an operator implementing a CSP that disables localStorage (e.g. via storage-access partitioning policy) would silently break this widget's persistence path with no docs warning."` —
    evidence: WebFetch
    `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`
    (2026-05-08, status 200, verbatim verdict: "No mention of localStorage,
    browser storage, language preferences, or client-side data persistence
    appears in this documentation page"). —
    severity: LOW

## performance

- **hot_paths**:
  - `"render path: dialog body iterates i18n.languages, applies a substring filter (line 50), and emits one AppMenuItem + ReactCountryFlag per match (lines 52-66). N is bounded by the number of registered locales (currently 6 per locales/i18n.ts:10-17), so the filter+map runs in well-under-a-millisecond on any browser."` —
    evidence: `SelectLanguage.tsx:48-66`.
  - `"click handler: handleLangChange awaits i18n.changeLanguage(lang) (line 29) — i18next swaps the active resource bundle in memory, which triggers the React i18next provider to broadcast a change event and rerender every <Trans> / t()-consuming component in the tree. Then localStorage.setItem (line 30) writes synchronously."` —
    evidence: `SelectLanguage.tsx:28-33`.
- **throughput_characteristics**:
  - `"user-event-driven, very low frequency — a typical session opens the dialog 0-1 times. No batching or queuing concern."` —
    evidence: `SelectLanguage.tsx:18-77` (entire widget is event-driven; no
    polling, no scheduled tasks).
  - `"single-await change: line 29 awaits i18n.changeLanguage which resolves once the bundle swap is complete; line 30 then runs synchronously. No retry, no debounce, no concurrency control — the widget assumes the user clicks once."` —
    evidence: `SelectLanguage.tsx:28-33`.
- **resource_allocation**:
  - `"minimal — JSX-only rendering, no useMemo / useCallback / refs / effects. The only state is the search query (line 20: useState('')) which holds a string typically <30 characters."` —
    evidence: `SelectLanguage.tsx:18-77`.
  - `"no network I/O on the click path — no fetch, no Redux thunk, no WebSocket message. Persistence is purely localStorage.setItem (line 30)."` —
    evidence: `SelectLanguage.tsx:28-33`.
- **scaling_characteristics**:
  - `"client-side, stateless across HTTP requests — no server-side session state, no shared backend resource, no DB connection. Horizontal scaling of odd-platform-api instances is unaffected by this widget."` —
    evidence: `SelectLanguage.tsx:30` (write only to localStorage; no
    server call) + grep for `i18nextLng` across `odd-platform-api/`
    returns zero matches at commit ede5d277.
- **known_performance_gaps**:
  - `"i18n.changeLanguage triggers a full app rerender via the react-i18next provider — every component subscribed to t() / useTranslation() rerenders on language change. For the platform UI's component count (the AppToolbar alone mounts AppMenu + AppMenuItem + DialogWrapper + Input + multiple Typography children, and the rest of the app tree adds search results, lineage graphs, alert lists, etc.), this is a single broadcast rather than incremental segment swapping. The cost is amortised over a one-time user action, but on a deeply-mounted page (e.g. lineage graph with 100+ entity nodes rendered) the perceived latency to the first paint after the language click is noticeable. No incremental / lazy-bundle / suspense-boundary strategy is in place."` —
    evidence: `SelectLanguage.tsx:29` (single `i18n.changeLanguage` call —
    no scoping, no segment-level updates) +
    `odd-platform-ui/src/locales/i18n.ts:27` (`initReactI18next` provider
    wires the global rerender). —
    severity: LOW
  - `"no debounce on the search input — every keystroke runs the filter on lines 49-51 and re-emits the AppMenuItem list. Acceptable today (N=6 locales) but a contributor adding 50+ locales would push every keystroke to a 50-element re-render with no input throttle."` —
    evidence: `SelectLanguage.tsx:35-36, 48-51`. —
    severity: LOW

## sources

- understanding ← `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx:1-80`
  + `odd-platform-ui/src/components/shared/elements/AppToolbar/AppToolbar.tsx:97-116` (mount site).
- concepts.entities.persisted_language_preference ← `SelectLanguage.tsx:30`
- concepts.entities.country_flag_code ← `SelectLanguage.tsx:60` +
  `odd-platform-ui/src/lib/constants.ts:167-174`
- concepts.entities.language_selection_dialog ← `SelectLanguage.tsx:71-77`
- concepts.operations.swap_active_i18next_language ← `SelectLanguage.tsx:29`
- concepts.operations.persist_chosen_language ← `SelectLanguage.tsx:30`
- concepts.operations.list_all_locales ← `SelectLanguage.tsx:48`
- concepts.operations.filter_locales ← `SelectLanguage.tsx:48-51`
- concepts.invariants.locale_list_from_runtime ← `SelectLanguage.tsx:48`
- concepts.invariants.no_runtime_guard ← `SelectLanguage.tsx:50,60`
- concepts.invariants.fire_and_forget ← `SelectLanguage.tsx:28-33`
- concepts.audiences.contributors ← `SelectLanguage.tsx:48` (locale list
  is dynamic) + `odd-platform-ui/src/locales/i18n.ts:10-17` +
  `odd-platform-ui/src/lib/constants.ts:158-174`
- dependencies_semantic.requires-feature.i18next_runtime ← `SelectLanguage.tsx:2,19`
  + `odd-platform-ui/src/locales/i18n.ts:27`
- dependencies_semantic.requires-feature.dialogwrapper_contract ←
  `SelectLanguage.tsx:73`
- dependencies_semantic.requires-config.localstorage ← `SelectLanguage.tsx:30`
- dependencies_semantic.requires-runtime.languages_maps ←
  `SelectLanguage.tsx:48-51,60` +
  `odd-platform-ui/src/lib/constants.ts:158-174`
- dependencies_semantic.requires-runtime.react_country_flag ←
  `SelectLanguage.tsx:4,59-62`
- dependencies_semantic.coupling-notes.write_side_of_i18n_persistence ←
  `SelectLanguage.tsx:30` + `odd-platform-ui/src/locales/i18n.ts:22`
- dependencies_semantic.coupling-notes.mount_site ←
  `odd-platform-ui/src/components/shared/elements/AppToolbar/AppToolbar.tsx:97-116`
- tests_coverage_semantic.gaps ← absence verified by repo-wide grep for
  `SelectLanguage`, `select.language`, `i18nextLng` across `*.test.ts(x)`
  and `*.spec.ts(x)` files in `odd-platform-ui/src/` — zero matches at
  commit ede5d277.
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
  the three WebFetch results above + the i18n.ts sidecar's read-side drift
  finding (`lineage/odd-platform/understanding/odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md`).
- implicit_adrs.[0] ← `SelectLanguage.tsx:30` +
  `odd-platform-ui/src/locales/i18n.ts:22` + grep for `i18nextLng` across
  `odd-platform-api/src/main/java/` (zero matches at commit ede5d277)
- implicit_adrs.[1] ← `SelectLanguage.tsx:28-33`
- implicit_adrs.[2] ← `SelectLanguage.tsx:48` +
  `odd-platform-ui/src/locales/i18n.ts:10-17,30`
- implicit_adrs.[3] ← `SelectLanguage.tsx:60-62` +
  `odd-platform-ui/src/lib/constants.ts:167-174`
- implicit_adrs.[4] ← `SelectLanguage.tsx:48-50` +
  `odd-platform-ui/src/lib/constants.ts:158-165`
- bugs_limitations_corner_cases.[0] ← `SelectLanguage.tsx:48-50,60` +
  `odd-platform-ui/src/lib/constants.ts:158-174`
- bugs_limitations_corner_cases.[1] ← `SelectLanguage.tsx:28-33`
- bugs_limitations_corner_cases.[2] ← `SelectLanguage.tsx:30` + grep for
  `i18nextLng` across `odd-platform-api/` (zero matches at commit ede5d277)
- bugs_limitations_corner_cases.[3] ← `SelectLanguage.tsx:50` +
  `odd-platform-ui/src/lib/constants.ts:158-165`
- bugs_limitations_corner_cases.[4] ← `SelectLanguage.tsx:73`
- bugs_limitations_corner_cases.[5] ← three WebFetch results (2026-05-08) +
  `findings/docs-coverage-undocumented-features/2026-05-08.md#F-047`
- security.auth_mode_relevance ← `SelectLanguage.tsx:1-80` (no
  `auth.type`-coupled branching anywhere in the file) + WebFetch
  `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`
  (2026-05-08, status 200) for the canonical mode list.
- security.ingestion_filter_relevance ← `SelectLanguage.tsx:1-80` (UI
  widget, no controller / endpoint / filter wiring) + WebFetch
  `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`
  (2026-05-08, status 200) for the S2S/ingestion-filter scope.
- security.authorization_assertions ← `SelectLanguage.tsx:1-80` (no
  `@PreAuthorize`, no programmatic permission/role/policy check;
  TypeScript file with no Spring Security at the call site).
- security.owner_scoping ← `SelectLanguage.tsx:1-80` (no DataEntity /
  Owner read or write).
- security.data_exposure.[0] ← `SelectLanguage.tsx:30`
- security.known_security_gaps.[0] ← `SelectLanguage.tsx:30` +
  `odd-platform-ui/src/locales/i18n.ts:22` +
  `odd-platform-ui/src/lib/constants.ts:158-165`
- security.known_security_gaps.[1] ← WebFetch
  `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`
  (2026-05-08, status 200, verbatim verdict re: localStorage absence)
- performance.hot_paths.[0] ← `SelectLanguage.tsx:48-66`
- performance.hot_paths.[1] ← `SelectLanguage.tsx:28-33`
- performance.throughput_characteristics.[0] ← `SelectLanguage.tsx:18-77`
- performance.throughput_characteristics.[1] ← `SelectLanguage.tsx:28-33`
- performance.resource_allocation.[0] ← `SelectLanguage.tsx:18-77`
- performance.resource_allocation.[1] ← `SelectLanguage.tsx:28-33`
- performance.scaling_characteristics.[0] ← `SelectLanguage.tsx:30` +
  grep for `i18nextLng` across `odd-platform-api/` (zero matches at
  commit ede5d277)
- performance.known_performance_gaps.[0] ← `SelectLanguage.tsx:29` +
  `odd-platform-ui/src/locales/i18n.ts:27`
- performance.known_performance_gaps.[1] ← `SelectLanguage.tsx:35-36,48-51`

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
