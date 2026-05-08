---
node_id: "odd-platform ts routes route:alerts"
node_kind: route
axis: ui_routes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-01
---

# alertsRoutes — semantic understanding

## understanding

This module is the URL-shape contract for the Alerts feature in the platform UI. It declares a private `BASE_PATH = '/alerts'` and exports a builder `alertsPath(path?)` plus a frozen `AlertsRoutes` object with three sub-route literals (`all`, `my`, `dependents`). Consumers (`App.tsx` mounts the parent `<Route path="${alertsPath()}/*">`, `AlertsTabs.tsx` builds the in-page tab links, `ToolbarTabs.tsx` builds the global navigation entry) call `alertsPath('all' | 'my' | 'dependents')` rather than hard-coding strings, so the URL surface is changeable in one place. The route module owns no rendering, no auth-gating, and no data-fetch — those live in the consumer components and the inner `<AlertsRoutes>` React component (`components/Alerts/AlertsRoutes/AlertsRoutes.tsx`).

## concepts

- entities: [Alert, AlertTab (`all` / `my` / `dependents`)]
- operations: [build base alerts URL, build sub-tab URL, type-narrow the sub-tab argument via `AlertsRoutesType`]
- invariants: [`BASE_PATH` is `/alerts` and is the single canonical prefix for every alerts URL in the UI; sub-paths are restricted at compile time to the three literal values declared in `AlertsRoutes`; `alertsPath()` with no argument returns the bare base path used by the React Router parent route]
- audiences: [signed-in platform users browsing alerts via the AppToolbar `Alerts` tab and the in-page tab strip; the `My Objects` and `Dependents` sub-tabs are only surfaced to users linked to an Owner record (gating logic lives in the consumer `AlertsTabs.tsx:30,36`, not here)]

## dependencies_semantic

- requires-feature: [Alerts feature in the platform UI — the route only makes sense when the parent `<Alerts>` component tree is mounted in `App.tsx:64`]
- requires-config: []
- requires-runtime: [react-router-dom — the consumers pass the strings into React Router's `<Route path>` and link `to`; this module itself imports nothing from react-router-dom (cf. the sibling `searchRoutes.ts:1` which does)]
- additional_coupling:
  - exposed via `routes/index.ts:1` (`export * from './alertsRoutes'`), so consumers import from `'routes'` rather than the file directly — refactoring the file path is safe; renaming the exports breaks every consumer

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: ["`alertsPath()` returns the bare base when called with no argument", "`alertsPath('all' | 'my' | 'dependents')` concatenates the sub-path with a single slash", "the type system rejects sub-paths outside the three literals at the call site"]
- test_files: []
- gaps: |
    No unit tests target this module. A regression that would slip through:
    accidentally changing `BASE_PATH` (e.g. to `/alert` or `/alerts/`) would
    silently break every link in the AppToolbar and the AlertsTabs without a
    failing test — the failure surfaces only when a human navigates. A test
    that pins `alertsPath()` and `alertsPath('all')` to literal strings would
    catch that. (No tests exist for the sibling routes modules either; this is
    a directory-wide gap, not specific to alerts — surface as a follow-up if
    test coverage is in scope, otherwise note in `bugs_limitations_corner_cases`.)

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
    anchor: ""
    rationale: "The Alerting feature page is the canonical user-facing doc for what this UI route surfaces. The page's `Alert views — All, My Objects, Dependents` H2 explicitly names the three tabs that map 1:1 to the three sub-paths declared by `AlertsRoutes` (`all`, `my`, `dependents`)."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      H1: "Alerting"
      H2 list: "Alert types", "Alert views — All, My Objects, Dependents",
      "Alert lifecycle: statuses, resolution, cleanup",
      "Backwards-incompatible schema change — what triggers it",
      "Halt notifications per entity", "API surface", "Where to next".
      Tab descriptions:
        - All: "Every open and resolved alert across the whole platform"
        - My Objects: "Alerts raised on data entities where the signed-in
          user is a registered owner"
        - Dependents: "Alerts raised on data entities that are downstream of
          entities the signed-in user owns (via lineage)"
      Visibility note: "The `My Objects` and `Dependents` tabs are hidden
      unless the signed-in user is linked to an Owner."
- doc_drift_findings:
  - "The doc page does not state the URL `/alerts` or the sub-paths `/alerts/all|my|dependents` — this is **not** a drift finding; route URLs are an internal UI concern and the user navigates via the Alerts tab in the AppToolbar (built from `alertsPath('all')` at ToolbarTabs.tsx:72). The user never types `/alerts` directly."
  - "The orchestrator's prompt referenced `https://docs.opendatadiscovery.org/active-platform-features/alerting` which returns 404 (verified 2026-05-08). The canonical live URL is `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` (status 200). Surface back to the orchestrator so the substrate / prompt template is corrected — this is not a code/doc drift, it is a stale reference inside the workspace."

## implicit_adrs

- "Route modules under `odd-platform-ui/src/routes/` declare `BASE_PATH` as a file-private inline `const` rather than importing from a shared routes module." — evidence: alertsRoutes.ts:1 + activityRoutes.ts:1 + dataEntitiesRoutes.ts:4 + directoryRoutes.ts:4 + managementRoutes.ts:3 + masterDataRoutes.ts:1 + searchRoutes.ts:3 + termsRoutes.ts:4 (all eight non-index modules in the directory follow the same pattern; verified via grep) — confidence: HIGH
- "The Alerts feature exposes a fixed three-view taxonomy (`all` / `my` / `dependents`) and the type system enforces that callers cannot request a fourth view at compile time — adding a new tab is a deliberate, three-file change (this module + `AlertsRoutes.tsx` + `AlertsTabs.tsx`)." — evidence: alertsRoutes.ts:2-6 (`AlertsRoutes as const` + `AlertsRoutesType = typeof AlertsRoutes`) + components/Alerts/AlertsRoutes/AlertsRoutes.tsx:11-19 + components/Alerts/AlertsTabs/AlertsTabs.tsx:21-37 — confidence: HIGH
- "Auth/visibility gating of `My Objects` and `Dependents` is a consumer-side concern (the tabs hide via `hidden: !showMyAndDepends`), NOT a route-module concern — the route module exposes the URLs unconditionally." — evidence: alertsRoutes.ts (whole file — no auth predicates) + components/Alerts/AlertsTabs/AlertsTabs.tsx:30,36 (`hidden: !showMyAndDepends`) — confidence: HIGH
- "The bare `/alerts` URL is not itself a renderable view — the inner `<AlertsRoutes>` redirects `/` to `all` (`<Route path='/' element={<Navigate to='all' replace />} />`). Visiting `/alerts` always lands on `/alerts/all`." — evidence: components/Alerts/AlertsRoutes/AlertsRoutes.tsx:18 — confidence: HIGH

## bugs_limitations_corner_cases

- "The substrate-extracted `NODE_METADATA` for this node reports `sub_routes: {}` and `inline_paths: []`, but the source file declares three sub-paths (`all`, `my`, `dependents`) via the `AlertsRoutes` object literal at alertsRoutes.ts:2-6. The substrate's TS-route extractor appears to extract only the `BASE_PATH` constant assignment and to miss `as const` object literals that declare sub-route fragments. Surface as a substrate-extractor follow-up." — evidence: alertsRoutes.ts:2-6 vs. NODE_METADATA in the orchestrator prompt — severity: MEDIUM
- "Renaming any of the three string literals (`all`, `my`, `dependents`) in this module silently breaks the inner `<AlertsRoutes>` component's `<Route path='all|my|dependents'>` declarations because the inner component hard-codes the same strings instead of importing them from this module. The `AlertsRoutes` object is therefore a single source of truth for *callers* but not for the route definitions." — evidence: alertsRoutes.ts:2-6 (declares the literals) + components/Alerts/AlertsRoutes/AlertsRoutes.tsx:12,13,15 (re-hardcodes the same literals) — severity: LOW
- "No unit tests target this module or any other module under `odd-platform-ui/src/routes/`. A typo in `BASE_PATH` (e.g. `/alert`) would not be caught by the build or by tests; it would surface only when a human user clicks an alerts link." — evidence: `find odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep alertsPath` returned no matches — severity: LOW

## sources

- understanding ← odd-platform-ui/src/routes/alertsRoutes.ts:1-13 + odd-platform-ui/src/components/App.tsx:64 + odd-platform-ui/src/components/Alerts/AlertsTabs/AlertsTabs.tsx:1-58 + odd-platform-ui/src/components/Alerts/AlertsRoutes/AlertsRoutes.tsx:10-22 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:71-74
- concepts.entities.AlertTab ← odd-platform-ui/src/routes/alertsRoutes.ts:2-6
- concepts.operations.[build base/sub-tab URL] ← odd-platform-ui/src/routes/alertsRoutes.ts:10-13
- concepts.invariants.[BASE_PATH canonical] ← odd-platform-ui/src/routes/alertsRoutes.ts:1
- concepts.invariants.[sub-paths compile-time-restricted] ← odd-platform-ui/src/routes/alertsRoutes.ts:8 (`AlertsRoutesType = typeof AlertsRoutes`)
- concepts.audiences.[Owner-gated tabs] ← odd-platform-ui/src/components/Alerts/AlertsTabs/AlertsTabs.tsx:30,36 + WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/alerting (2026-05-08, 200, "hidden unless the signed-in user is linked to an Owner")
- dependencies_semantic.requires-feature ← odd-platform-ui/src/components/App.tsx:64
- dependencies_semantic.requires-runtime.[react-router-dom in consumers, not here] ← odd-platform-ui/src/routes/alertsRoutes.ts:1-13 (no imports) vs. odd-platform-ui/src/routes/searchRoutes.ts:1 (imports from react-router-dom)
- dependencies_semantic.additional_coupling.[exposed via routes/index] ← odd-platform-ui/src/routes/index.ts:1
- tests_coverage_semantic.test_files ← shell: `find odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep alertsPath` returned no matches at commit ede5d277
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/alerting (2026-05-08, status 200)
- docs_link_semantic.doc_drift_findings.[stale prompt URL] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/alerting (2026-05-08, status 404) + WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/alerting (2026-05-08, status 200)
- implicit_adrs.[BASE_PATH inline pattern] ← grep `BASE_PATH` across odd-platform-ui/src/routes/*.ts (8 modules, all use private inline const)
- implicit_adrs.[fixed three-view taxonomy] ← odd-platform-ui/src/routes/alertsRoutes.ts:2-6 + odd-platform-ui/src/components/Alerts/AlertsRoutes/AlertsRoutes.tsx:11-19 + odd-platform-ui/src/components/Alerts/AlertsTabs/AlertsTabs.tsx:21-37
- implicit_adrs.[auth gating is consumer-side] ← odd-platform-ui/src/routes/alertsRoutes.ts (no auth predicates) + odd-platform-ui/src/components/Alerts/AlertsTabs/AlertsTabs.tsx:30,36
- implicit_adrs.[/ redirects to /all] ← odd-platform-ui/src/components/Alerts/AlertsRoutes/AlertsRoutes.tsx:18
- bugs_limitations_corner_cases.[substrate metadata gap] ← odd-platform-ui/src/routes/alertsRoutes.ts:2-6 vs. NODE_METADATA from orchestrator prompt
- bugs_limitations_corner_cases.[hard-coded literals re-declared in AlertsRoutes.tsx] ← odd-platform-ui/src/routes/alertsRoutes.ts:2-6 + odd-platform-ui/src/components/Alerts/AlertsRoutes/AlertsRoutes.tsx:12,13,15
- bugs_limitations_corner_cases.[no test coverage for routes/] ← shell: `find odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep alertsPath` returned no matches

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH

## Maintainer notes
