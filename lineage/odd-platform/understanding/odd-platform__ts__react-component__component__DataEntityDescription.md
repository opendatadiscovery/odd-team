---
node_id: "odd-platform ts react-component component:DataEntityDescription"
node_kind: react-component
axis: ui_components
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-J-DataEntityDescription
node_path_discrepancy: |
  The orchestrator's input named the target as
  `odd-platform-ui/src/components/DataEntityDetails/DataEntityOverview/Description/Description.tsx`
  but no such path exists. Glob over the actual UI tree shows the canonical
  description-rendering cluster lives at
  `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewDescription/`
  with six TSX files (OverviewDescription.tsx, ExternalDescription.tsx,
  InternalDescription.tsx, InternalDescriptionPreview.tsx,
  InternalDescriptionEdit.tsx, InternalDescriptionHeader.tsx). This sidecar
  treats the F-004 / P-009 entity-description rendering surface as a cluster
  centred on `InternalDescription` (the read+edit toggle), `Markdown`
  (the shared rehype-raw renderer at `components/shared/elements/Markdown/`),
  and `useTermWiki` (the `[[ns:term]]` parser + thunk dispatcher). The
  external/ExternalDescription branch is recorded but not the XSS surface —
  it renders the SOURCE-PROVIDED description (ingested via collectors),
  not the operator-edited Markdown body.
---

# DataEntityDescription (Overview > Description cluster) — semantic understanding

## understanding

The DataEntityDescription cluster is the **UI half of F-004 (entity description editing) — the React surface where the operator-authored Markdown body stored in `data_entity.internal_description` is rendered to every reader's browser and is mutated back to the platform via `PUT /api/dataentities/{id}/description`** (batch G sidecar `upsertDataEntityInternalDescription.md:understanding`). Six TSX files compose: `OverviewDescription` is the section shell with the collapse-on-overflow control (`OverviewDescription.tsx:15-41`); `InternalDescription` owns the read/edit toggle + the `useTermWiki` hook wiring (`InternalDescription.tsx:19-67`); `InternalDescriptionHeader` carries the Edit button + the `[[Namespace:TermName]]` syntax tooltip (`InternalDescriptionHeader.tsx:30-52`); `InternalDescriptionPreview` calls `<Markdown value={value} />` for the read path (`InternalDescriptionPreview.tsx:19-22`); `InternalDescriptionEdit` calls `<Markdown editor value={value} onChange={...} />` for the write path (`InternalDescriptionEdit.tsx:22-37`); the `Markdown` shared element (`components/shared/elements/Markdown/Markdown.tsx:84-127`) is a **thin wrapper around `@uiw/react-md-editor`'s `MDEditor.Markdown` (read) and `MDEditor` (edit)** — passing only `source`, `wrapperElement`, `disableCopy`, and three custom `components` overrides (`a`, `div`, `p`); **NO `rehypePlugins` override is supplied**, leaving the library's defaults (`rehype-raw`, `rehype-attr`, `rehype-autolink-headings`, `rehype-rewrite`, `rehype-slug`, `rehype-ignore`, `rehype-prism-plus` per `pnpm-lock.yaml:5911-5938` — but critically **NO `rehype-sanitize` anywhere in the dep tree**, grep-verified 0 matches across `odd-platform-ui/`). The `useTermWiki` hook (`useTermWiki.ts:30-228`) is the platform-specific parser for the `[[Namespace:TermName]]` term-mention syntax — it scans both the persisted description and the in-progress editor value (`TERM_PATTERN = /\[\[([^:\]]+):([^\]]+)\]\]/g` at `lib/constants.ts:177`), resolves each match against `GET /api/terms/namespaces/{namespaceName}/names/{termName}` (`useGetTermByNamespaceAndName`), and on render replaces the `[[ns:term]]` token with a real Markdown link `[name](termPath "definition")` (`useTermWiki.ts:186-201`). Permission gating is **partial: only the Edit button is gated by `WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}`** (`InternalDescriptionHeader.tsx:40-50` + `InternalDescriptionPreview.tsx:32-40`); the description CONTENT itself is rendered to every authenticated user with `DATA_ENTITY_VIEW` on the entity. P-009 slice-5 empirically pinned the F-004 UI half on commit `ede5d277` (`probes/P-009.yaml:147-150` assertions): script + img-id + iframe-id substrings DO reach the rendered DOM (`dom_has_script_tag == True`, `dom_has_xss_img_id == True`, `dom_has_xss_iframe_id == True`) BUT event-handler attributes are stripped (`dom_has_onerror_attr == False`) and EXECUTION is blocked by Chromium's HTML-parser policy + React's attribute filtering (`xss_dialog_fired == 0`, `xss_leak_count == 0`).

## concepts

- entities: [
    "`InternalDescription` (response payload — `internal_description: String` + `terms: List<LinkedTerm>`, both required per `components.yaml:2184-2186`; consumed via the `updateDataEntityInternalDescription` thunk at `redux/thunks/dataentities.thunks.ts:104-127`)",
    "`InternalDescriptionFormData` (request body — single `internal_description: String` field; constructed at `useTermWiki.ts:152-156`)",
    "`TermRef` (parsed term-mentions; the previously-resolved server-side terms list seeded into `fetchedTerms` at `useTermWiki.ts:51-58` from `dataEntityDetails.terms.map(t => t.term)` at `Overview.tsx:45-48`; since #1746 the initializer FILTERS entries lacking `namespace?.name` — a contract-violating `namespace: null` payload degrades to an unresolved mention instead of a first-render TypeError that white-screened the whole app)",
    "`Markdown` (shared UI element at `components/shared/elements/Markdown/Markdown.tsx:84-127`; wraps `@uiw/react-md-editor@3.25.6`'s `MDEditor` and `MDEditor.Markdown`)",
    "`TERM_PATTERN` (regex at `lib/constants.ts:177` — `/\\[\\[([^:\\]]+):([^\\]]+)\\]\\]/g` — the UI-side term-mention parser, intentionally distinct from the backend regex at `TermServiceImpl.java:67` which uses `\\[\\[([^:]*?):([^\\]]*?)\\]\\]` (non-greedy + permits empty groups vs the UI's character-class allowlist that excludes `:` and `]`))",
    "`Permission.DATA_ENTITY_DESCRIPTION_UPDATE` (enum value from `generated-sources`; the only permission the cluster references)",
    "`useCollapse` (hook governing the overflow-collapse behaviour at `OverviewDescription.tsx:16-17`; opaque to this cluster's semantics)"
  ]
- operations: [
    "`render-internal-description` — `InternalDescriptionPreview` calls `transformDescriptionToMarkdown(description)` (`useTermWiki.ts:186-201`) to substitute `[[ns:term]]` mentions with `[name](termPath \"definition\")` Markdown links, then renders via `<Markdown value={value} />` which invokes `MDEditor.Markdown source={value} components={{ a: TermLink, ... }}` (`Markdown.tsx:112-124`). The `TermLink` custom anchor component (`Markdown.tsx:49-69`) inspects `href` — if it includes `'terms'` it wraps in a tooltip-showing-definition; otherwise it renders a plain `<a>`",
    "`enter-edit-mode` — `InternalDescriptionHeader` 'Edit info' / 'Add info' button calls `toggleEditMode` from `useTermWiki` (`InternalDescriptionHeader.tsx:42-49` + `useTermWiki.ts:46-49`); also fires from the empty-state 'Add Description' button at `InternalDescriptionPreview.tsx:33-39`. `toggleEditMode` flips `editMode` state AND re-syncs `internalDescription` to the latest `description` (`useTermWiki.ts:47-48`) — cancel-then-reopen reverts in-progress edits",
    "`edit-markdown-realtime` — `InternalDescriptionEdit` mounts `<Markdown editor value={value} onChange={handleMarkdownChange} height={200} />` (`InternalDescriptionEdit.tsx:27`); `onChange` is wired to `handleRealtimeMarkdownChange` (`useTermWiki.ts:203-216`) which deduplicates against the previous value, schedules `handleMarkdownChange` (the term-resolving validator at `useTermWiki.ts:98-149`), and updates local state",
    "`resolve-term-mentions-on-change` — for each `TERM_PATTERN` match in the current editor value, `handleMarkdownChange` (`useTermWiki.ts:103-130`) calls `useGetTermByNamespaceAndName` ONCE per unique term (cached in `fetchedTerms` / `unsuccessfulTerms`); a failed lookup sets `error = 'Term {termName} not found in namespace {namespaceName}'` (`useTermWiki.ts:126`)",
    "`save-description` — Save button (`InternalDescriptionEdit.tsx:29-33`) fires `handleUpdateDescription` (`useTermWiki.ts:151-177`) which builds the `DataEntityApiUpsertDataEntityInternalDescriptionRequest` from `entityId` + `internalDescription` and dispatches `updateDataEntityInternalDescription` (the redux thunk at `dataentities.thunks.ts:104-127`) which calls `dataEntityApi.upsertDataEntityInternalDescription(...)`. On success: `setError('')` + `setEditMode(false)`. On error: `setError(response.statusText || 'Unable to update description')`",
    "`save-via-shift-enter` — `Box onKeyDown={handlePressEnter}` at `InternalDescriptionEdit.tsx:23` calls `handleSaveMarkdownOnEnter` which fires `handleUpdateDescription` ONLY when `e.key === 'Enter' && e.shiftKey` (`useTermWiki.ts:179-184`) — a quiet, undocumented shortcut",
    "`cancel-edit` — Cancel button (`InternalDescriptionEdit.tsx:35`) fires `toggleEditMode` which flips state AND re-syncs from the redux-stored description, discarding the in-flight edit",
    "`collapse-on-overflow` — `useCollapse({ initialMaxHeight: 304 })` at `OverviewDescription.tsx:16-17` clamps the rendered description to a max-height; the collapsing UI sits OUTSIDE the gating — long descriptions still partially render to readers with `DATA_ENTITY_VIEW`"
  ]
- invariants: [
    "**No `rehype-sanitize` is configured anywhere in the UI** — verified by `grep -rln 'rehype-sanitize' <odd-platform-ui>/src` → 0 matches AND `grep 'rehype-sanitize' <odd-platform-ui>/pnpm-lock.yaml` → 0 matches. The `Markdown` wrapper passes ONLY `components`, `source`, `wrapperElement`, `disableCopy` to `MDEditor.Markdown` (`Markdown.tsx:112-123`); no `rehypePlugins` override is supplied, leaving `@uiw/react-markdown-preview@4.2.2`'s defaults active. Those defaults include `rehype-raw@6.1.1` (`pnpm-lock.yaml:5911-5926`) — which parses raw HTML embedded in Markdown into AST nodes that `react-markdown` then renders. The combined backend-no-sanitisation + UI-render-raw-HTML produces the stored-XSS surface F-004 documents.",
    "**Permission gating is partial — only the Edit affordance is gated, NEVER the rendered content.** `InternalDescriptionHeader.tsx:40-50` wraps the Edit/Add button in `<WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}>`; `InternalDescriptionPreview.tsx:32-40` wraps the empty-state 'Add Description' button identically. The `<Markdown value={value} />` render at `InternalDescriptionPreview.tsx:21` runs unconditionally for ANY caller with `DATA_ENTITY_VIEW`. The description CONTENT (and any embedded HTML) reaches every reader's browser regardless of whether they can edit it.",
    "**Response echo is NEVER read back from the redux store after save** — `handleUpdateDescription` (`useTermWiki.ts:151-177`) dispatches the thunk and on success only resets `error` + `editMode`. It does NOT re-read the rendered Markdown from the server; the thunk's success payload updates the redux slice (`dataentities.slice.ts` reduces on `updateDataEntityInternalDescriptionActionType.fulfilled`), and the `InternalDescriptionPreview` re-renders via `useAppSelector(getDataEntityInternalDescription(dataEntityId))` (`InternalDescription.tsx:22`). The backend echo-back is the request payload (per batch-I sidecar `DataEntityServiceImpl.md:concepts.invariants[3]`) — so if the operator submits `'   '` (whitespace) the UI displays back `'   '` even though the DB column stores NULL (batch-H finding).",
    "**Term-mention regex is STRICTER than the backend regex** — UI `TERM_PATTERN = /\\[\\[([^:\\]]+):([^\\]]+)\\]\\]/g` (`lib/constants.ts:177`) REQUIRES non-empty namespace AND non-empty term-name (character class `[^:\\]]+` forces ≥1 char excluding `:` and `]`); backend `Pattern.compile(\"\\\\[\\\\[([^:]*?):([^\\\\]]*?)\\\\]\\\\]\")` (`TermServiceImpl.java:67`) allows empty groups (non-greedy `*?` matches zero chars). A description containing `[[:foo]]` or `[[foo:]]` is auto-linked in the UI as a non-match (raw text passes through), while the backend's `findTermsInDescription` will still parse it (though with empty group it short-circuits in `handleDataEntityDescriptionTerms`). The asymmetry is a latent inconsistency.",
    "**Cancel-and-reopen discards in-flight edits via state re-sync** — `toggleEditMode` (`useTermWiki.ts:46-49`) re-assigns `internalDescription = description` (the redux-stored value). A user who cancels then re-edits sees the LAST SAVED description, not their cancelled work — there is NO autosave-on-blur, no draft-preservation, no warn-on-navigate.",
    "**Term-resolution lookup is best-effort and ASYNC** — `useEffect` at `useTermWiki.ts:58-96` fires on every `description` change; each unknown term hits `GET /api/terms/namespaces/{ns}/names/{name}` ONCE (memoised in `fetchedTerms` / `unsuccessfulTerms`). The render-time `transformDescriptionToMarkdown` (`useTermWiki.ts:186-201`) substitutes only terms ALREADY in `fetchedTerms` — terms still being resolved render as the raw `[[ns:term]]` text. A description with 100 unique unresolved mentions issues 100 parallel HTTP requests on first render.",
    "**The `<Markdown>` wrapper auto-enables spell-check on the textarea via DOM mutation** — `useEffect` at `Markdown.tsx:96-101` queries `document.getElementById('md-editor')?.querySelector('textarea')?.setAttribute('spellcheck', 'true')` on mount. This works only when `editor=true` (the textarea exists); the imperative DOM mutation bypasses React's state model and assumes a single editor instance (`id='md-editor'` is HARD-CODED at `Markdown.tsx:105`) — multiple concurrent editors would race for the same DOM id."
  ]
- audiences: [
    "odd-platform-ui-end-user — every authenticated user with `DATA_ENTITY_VIEW` on a data entity reads the description rendered as Markdown+HTML through this cluster",
    "platform-operator authoring entity metadata — uses the Edit flow with `DATA_ENTITY_DESCRIPTION_UPDATE` granted via Policy (typically scoped to `dataEntity:owner`)",
    "data-engineer-analyst — primary writer audience per F-004 contributing-feature-id mapping",
    "data-quality-engineer / data-scientist-ml-engineer — readers of descriptions on their owned entities; not gated for writes by default Policy"
  ]

## dependencies_semantic

- requires-feature: [
    "`@uiw/react-md-editor@3.25.6` — the shared `Markdown` element wraps both `MDEditor` (edit mode) and `MDEditor.Markdown` (preview). The library transitively pulls in `@uiw/react-markdown-preview@4.2.2` which in turn pulls in `rehype-raw@6.1.1`, `rehype-attr`, `rehype-autolink-headings`, `rehype-rewrite`, `rehype-slug`, `rehype-ignore`, `rehype-prism-plus`, `remark-gfm` (per `pnpm-lock.yaml:5911-5938`). A future bump can broaden the dangerous-HTML allowlist invisibly.",
    "`useTermWiki` hook (`useTermWiki.ts:30-228`) — owns editMode state, internalDescription state, term resolution, error state, save dispatch, transform-for-render. Reused by `DatasetFieldDescription` (the sibling field-level surface, not in this cluster's scope but sharing the same hook).",
    "`updateDataEntityInternalDescription` redux thunk (`redux/thunks/dataentities.thunks.ts:104-127`) — wraps `dataEntityApi.upsertDataEntityInternalDescription` (the OpenAPI-generated client). On success dispatches `updateDataEntityInternalDescriptionActionType.fulfilled` with `{dataEntityId, internalDescription, terms}`; the reducer updates the entity's redux slice.",
    "`useGetTermByNamespaceAndName` (`lib/hooks/api/useGetTermByNamespaceAndName.ts`) — issues `GET /api/terms/namespaces/{ns}/names/{name}` to resolve `[[ns:term]]` mentions",
    "`getDataEntityInternalDescription` selector (`redux/selectors`) — read-side projection of the entity's description; the source of truth for the preview render",
    "`getIsEntityStatusDeleted` selector — gates whether the Edit button is shown at all (deleted entities are immutable; per `InternalDescriptionHeader.tsx:41` + `InternalDescriptionPreview.tsx:33`)",
    "`WithPermissions` context component (`components/shared/contexts/Permission/WithPermissions.tsx:11-32`) — consumes the resource-permission set populated by the parent `WithPermissionsProvider` at `Overview.tsx:67-71`; `usePermissions().hasAccessTo(permissionTo)` gates children rendering",
    "`useCollapse` (`lib/hooks/useCollapse`) — overflow-collapse hook at `OverviewDescription.tsx:16-17`",
    "OpenAPI-generated `DataEntityApi.upsertDataEntityInternalDescription` — produces the `PUT /api/dataentities/{data_entity_id}/description` HTTP call; see batch-G sidecar `upsertDataEntityInternalDescription.md` for the backend surface"
  ]
- requires-config: [
    "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — under DISABLED, ALL users see the Edit button because `usePermissions().hasAccessTo(...)` returns true unconditionally (per the `Permission`-gating semantics established in earlier batches). Under LOGIN_FORM / OAUTH2 / LDAP the Edit button is gated by the resource-scoped `DATA_ENTITY_DESCRIPTION_UPDATE` Policy condition."
  ]
- requires-runtime: [
    "React 18.2.0 (`package.json:74`) — concurrent rendering compatible (no `dangerouslySetInnerHTML` on this path; `<Markdown>` returns React elements via `MDEditor.Markdown`)",
    "Redux 8.1.2 + RTK 1.9.7 — state store for the entity-detail slice; thunk pipeline for save",
    "Vite-bundled production build — `vite.config.ts` does NOT add any rehype plugins (verified: no plugin config; `vite-plugin-checker` only runs TS / ESLint)",
    "Browser runtime — Chromium-family per the empirical P-009 slice-6 finding that the script-tag-via-innerHTML mitigation closes the attack surface; behaviour on Firefox / Safari NOT empirically verified"
  ]
- coupling: [
    "Backend coupling — the cluster is the ONLY UI write path to `data_entity.internal_description` (per `dataEntityApi.upsertDataEntityInternalDescription` usage grep: 4 files in `redux/thunks`, `slices`, `actions`, and this hook; no direct UI calls bypass the thunk). A backend regression that changes the response shape (e.g. adds a server-sanitised description field) breaks the slice reducer.",
    "Hook reuse — `useTermWiki` is shared with the sibling `DatasetFieldDescription` cluster (`DatasetStructure/.../DatasetFieldDescription/`); a change to the hook's contract affects both surfaces.",
    "Markdown component reuse — `<Markdown>` is the SOLE Markdown renderer on the platform; sub-paths that use it include alert messages, query examples, term definitions, dataset-field descriptions, owner descriptions. A rehype-pipeline change (e.g. adding `rehype-sanitize`) here affects every Markdown surface in the UI.",
    "Permission-context coupling — `OverviewDescription` relies on `WithPermissionsProvider` SEEDED by the parent `Overview.tsx:67-71` with `Permission.DATA_ENTITY_DESCRIPTION_UPDATE`. If the parent stops seeding this permission, the Edit button silently disappears (no error, no warning).",
    "Redux state coupling — the cluster reads `getDataEntityInternalDescription(dataEntityId)` which is populated by `fetchDataEntityDetails`; a failure of the entity-detail fetch leaves `description = undefined` and the cluster shows 'Not created.' with the Add button (per `InternalDescriptionPreview.tsx:31-41`)."
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "{behaviour: 'XSS payload (script tag + img onerror + iframe) round-trips backend → UI render: tags reach DOM, onerror attribute stripped, no execution observed', test_class: 'integration', pinned_by_probe_run: 'R-20260519T020610Z-P-009', cell_evidence: 'lineage/odd-platform/probe-runs/2026-05-19-P-009.yaml'} — probe P-009 slice-5/-6 asserts `dom_has_script_tag == True`, `dom_has_xss_img_id == True`, `dom_has_xss_iframe_id == True`, `dom_has_onerror_attr == False`, `xss_dialog_fired == 0`, `xss_leak_count == 0` (per `probes/P-009.yaml:147-167`). This is empirical defence-in-depth verification, not a unit test of the React components."
  ]
- uncovered_behaviours: [
    "{behaviour: 'InternalDescriptionPreview renders <Markdown value> for non-empty description (the read path that produces the XSS-surface DOM)', test_class: 'unit'} — no `@testing-library/react` test mounts `InternalDescriptionPreview` and asserts the rendered Markdown HTML; the empty-state 'Not created.' branch is also untested.",
    "{behaviour: 'InternalDescriptionEdit Save button invokes handleUpdateDescription which dispatches the updateDataEntityInternalDescription thunk', test_class: 'unit'} — no test mocks the dispatch and asserts the thunk fires.",
    "{behaviour: 'InternalDescriptionEdit Cancel button restores the prior description (toggleEditMode re-sync invariant)', test_class: 'unit'} — no test asserts in-flight edits are discarded.",
    "{behaviour: 'useTermWiki.toggleEditMode flips editMode AND re-syncs internalDescription from the latest description prop', test_class: 'unit'} — no test isolates the hook and asserts the re-sync.",
    "{behaviour: 'useTermWiki.handleMarkdownChange resolves [[ns:term]] mentions on every keystroke and memoises in fetchedTerms', test_class: 'unit'} — no test isolates the hook to assert the memoisation; rapid typing on a description with 10 unresolved mentions issues 10 parallel HTTP calls per keystroke. The N+1 risk is unverified.",
    "{behaviour: 'useTermWiki.handleSaveMarkdownOnEnter fires on Shift+Enter only (NOT plain Enter)', test_class: 'unit'} — the keyboard-shortcut semantics is undocumented in the operator-facing tooltip and unverified.",
    "{behaviour: 'useTermWiki.handleUpdateDescription on error response sets the inline error to response.statusText OR \"Unable to update description\"', test_class: 'unit'} — the error path is unverified; the catch handler (`useTermWiki.ts:172-176`) treats ANY rejected promise as a Response with statusText (incorrect for network errors / promise rejections raised from inside the thunk).",
    "{behaviour: 'transformDescriptionToMarkdown substitutes [[ns:term]] only for terms already in fetchedTerms; unresolved mentions render verbatim', test_class: 'unit'} — no test asserts the partial-render behaviour.",
    "{behaviour: 'TermLink in Markdown.tsx renders tooltip-anchored variant when href.includes(\"terms\") else plain anchor', test_class: 'unit'} — no test exercises the branch.",
    "{behaviour: 'XSS payload via tag injection produces SCRIPT execution under a CSP relaxation OR a different browser (the slice-6 mitigation depends on Chromium HTML-parser policy)', test_class: 'security'} — empirically verified only against Chromium-headless on commit `ede5d277`; Firefox / Safari / future Chromium policy changes are not pinned. A regression scenario (CSP relaxation, switching the renderer to `dangerouslySetInnerHTML`, an attacker payload using SVG `onload` or CSS `expression()`) would silently re-open the surface.",
    "{behaviour: 'spellcheck DOM-mutation effect handles multiple concurrent <Markdown editor> instances correctly', test_class: 'unit'} — `Markdown.tsx:96-101` hard-codes `id=\"md-editor\"` and queries `document.getElementById`; two simultaneous editors on the same page race on the same id. No test verifies this; the OverviewDescription page is single-editor today so the bug is dormant but the contract is fragile.",
    "{behaviour: 'permission-gated Edit button rendering: shows Add/Edit when caller has DATA_ENTITY_DESCRIPTION_UPDATE on the entity, hides when not', test_class: 'unit'} — no test mounts the cluster with mocked `usePermissions` and asserts the visibility.",
    "{behaviour: 'description content rendering for callers WITHOUT edit permission: preview still renders, including any embedded HTML payload', test_class: 'unit'} — the partial-gating invariant (Edit button gated, content NOT gated) is unverified. Tests should pin this explicitly to surface the gap at every regression.",
    "{behaviour: 'collapse-on-overflow truncates over-long descriptions to 304px max-height with a Show hidden / Hide toggle', test_class: 'unit'} — `OverviewDescription.tsx:16-38` uses `useCollapse({initialMaxHeight: 304})` but the threshold + the toggle are not test-verified.",
    "{behaviour: 'UI submits empty body and observes \"\" echo while DB stores NULL (the F-004 storage-decoupled-from-display invariant)', test_class: 'integration'} — the empty-string echo behaviour is documented in F-004 (`feature-flows/detail/F-004.yaml:161-178`) but no test asserts the UI's behaviour against it: a user clears the description, the UI shows it as cleared, the DB stores NULL, a subsequent refresh shows the cleared state — all unverified."
  ]
- test_files: [
    "None — `find <odd-platform-ui>/src -name '*.test.{ts,tsx}'` returns 0 results AND `find <odd-platform-ui>/src -name '*.spec.{ts,tsx}'` returns 0 results. The `package.json:5-11` declares `test: vitest` and `test:coverage` scripts but there are NO test files anywhere in the UI tree. The `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` dev dependencies (`package.json:97-99`) are installed but unused for component tests. The `vitest`, `vite-plugin-checker`, `jsdom` dev deps similarly. ZERO UI component test coverage on the platform — the description cluster shares this state with every other UI component."
  ]
- gaps: |
    The XSS surface is empirically pinned at the SYSTEM level by P-009 (probe run R-20260519T020610Z-P-009 on commit ede5d277) — but ZERO unit-level coverage exists for ANY of the components, hooks, or shared elements in this cluster. The probe verifies the LIVE end-to-end behaviour through a real browser; a developer modifying `Markdown.tsx` to add `rehype-sanitize` (the F-004 expected fix) cannot run a unit test to verify the dangerous-tag stripping happens — they must run the full probe suite via docker-compose. The combination of:

    (a) **zero UI tests across the entire SPA** (the whole repo has no `.test.tsx` / `.spec.tsx` files even though the test harness is fully configured) — a developer regression in the rendering pipeline or the permission gating ships invisibly until system-level probe catches it;
    (b) **partial permission gating** (Edit button gated, content render NOT gated) — the gating semantics are subtle enough that a refactor 'simplifying' WithPermissions to wrap the entire cluster would silently break read access for non-editors AND would be undetectable by the probe (which exercises authenticated-writer flows, not authenticated-reader-without-write flows);
    (c) **Markdown-shared coupling** — `<Markdown>` is the platform's SOLE Markdown renderer; changing rehype-pipeline behaviour to fix THIS feature affects every other surface (alerts, queries, term definitions, owner descriptions, dataset-field descriptions). No test isolates the Markdown wrapper's contract — a fix here can subtly break the rendering of an unrelated surface;
    (d) **Term-mention semantic drift between UI and backend regex** — UI regex requires non-empty groups, backend allows empty. A description like `[[:foo]]` renders verbatim in UI but is parsed by backend with empty namespace group — the auto-link surface diverges across layers;
    (e) **Spellcheck DOM-mutation by `document.getElementById('md-editor')`** — hard-coded id assumes a single editor instance; a multi-editor refactor races on the same id.

    The highest-likelihood regression sites are:
    - **rehype-sanitize fix introduces a different render pipeline for the AUTOLINK-substituted form vs the original Markdown** — `transformDescriptionToMarkdown` produces `[name](termPath "definition")` Markdown links from raw `[[ns:term]]` mentions; if rehype-sanitize strips the `title` attribute (used to carry the term definition for the tooltip-on-hover) the tooltip silently disappears.
    - **A future bump of `@uiw/react-md-editor` or `@uiw/react-markdown-preview`** changes the bundled rehype-plugin list. `rehype-raw` could be removed (fixing the XSS surface accidentally) OR a new rehype plugin could broaden behaviour. There is no version-pin verification test.
    - **A future minor refactor of `WithPermissions`** that adds extraCheck logic could silently re-enable the Edit button for callers without the underlying permission if the gating logic is mis-applied.
    - **The async term-resolution race** — typing fast in the editor can produce parallel HTTP requests that race; the last-write-wins error state in `useTermWiki.handleMarkdownChange` (`useTermWiki.ts:122-128`) does not coordinate across in-flight requests.

## docs_link_semantic

- declared_docs: [] — N/A. The source files carry no `@docs` annotation; the UI repo uses no `@docs:` comment convention.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "Per system-mission.md, F-004 maps to pillar P-01 Data Discovery sub-feature P-01:F-002 'Entity Description Editing' (per F-004.yaml:2-4). The pillar's landing page is the primary doc anchor. Local doc read at `documentation/docs/data-discovery.md` lines 5-53 shows the section enumerates 11 sub-features but does NOT explicitly call out 'Entity Description Editing' as a sub-feature — descriptions are an implicit affordance of every entity rendered."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "200 (local docs read; live-URL verification pending WebFetch session per system-mission.md)"
    confidence: MEDIUM
    fetched_excerpts: |
      From `documentation/docs/data-discovery.md` line 7: "The Data Discovery section of ODD Platform is the home for finding entities in the catalog. The role is durable: anything that helps a user **locate** existing data — by typing a term, by walking a known structure, or by landing on the home page — belongs here."
      The page enumerates sub-features but does NOT mention description editing, Markdown rendering, or term-mention syntax.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `DATA_ENTITY_DESCRIPTION_UPDATE` permission this cluster's Edit button gates on. Per batch-G sidecar `upsertDataEntityInternalDescription.md:docs_link_semantic.inferred_docs[0]` the live page was fetched in batch 2026-05-12F and contains the verbatim text: `DATA_ENTITY_DESCRIPTION_UPDATE: \"Allows editing and deleting a data entity's custom description.\"` Not re-fetched in this session — WebFetch permission was not granted."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: "200 (cross-batch verified; not re-verified in this session)"
    confidence: HIGH
    fetched_excerpts: |
      From batch 2026-05-12F controller-level sidecar verbatim quote: `DATA_ENTITY_DESCRIPTION_UPDATE: "Allows editing and deleting a data entity's custom description."`
  - url: "https://docs.opendatadiscovery.org/features/data-glossary"
    anchor: ""
    rationale: "The `[[Namespace:TermName]]` term-mention syntax that this cluster parses is platform-specific and likely belongs documented on the Data Glossary page (P-06). The tooltip text at `InternalDescriptionHeader.tsx:22-28` is the ONLY operator-facing documentation of the syntax: 'You can link an existing term by entering information about the term according to the pattern [[NamespaceName:TermName]]'. Local doc at `documentation/docs/data-glossary.md` reads as the pillar landing page; whether sub-pages cover this syntax is unverified."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "not-verified — local read only; live-URL fetch pending"
    confidence: LOW
    fetched_excerpts: |
      N/A — could not verify in this session.
- doc_drift_findings:
  - "**DOC-GAP candidate**: the `[[Namespace:TermName]]` term-mention syntax is platform-specific and the ONLY operator-facing documentation of it is the InformationIcon tooltip at `InternalDescriptionHeader.tsx:22-28`. No public doc page covers the syntax, its precedence rules, what happens on lookup failure (the inline 'Term {termName} not found in namespace {namespaceName}' error), or the side effect that mentioning a term auto-creates a `term_relations` row regardless of `DATA_ENTITY_ADD_TERM` permission (per F-004 + batch-G `upsertDataEntityInternalDescription.md:bugs_limitations_corner_cases[3]`)."
  - "**DOC-GAP candidate**: the Markdown rendering pipeline (using `@uiw/react-md-editor` / `@uiw/react-markdown-preview` + `rehype-raw` without `rehype-sanitize`) is undocumented for operators. An operator evaluating ODD for a multi-tenant deployment where untrusted users can write descriptions has no documented surface to learn the XSS-defence posture. The F-004 finding is empirically pinned by P-009 but the operator-facing implications (defence-in-depth currently relies on Chromium HTML-parser policy + React attribute filtering) are not surfaced anywhere readable."
  - "**DOC-GAP candidate**: the partial-gating behaviour (Edit button gated by `DATA_ENTITY_DESCRIPTION_UPDATE`, but description CONTENT rendered to every `DATA_ENTITY_VIEW` caller) is undocumented. The Permissions page describes `DATA_ENTITY_DESCRIPTION_UPDATE` as 'editing and deleting' but does NOT explain that the view side has no separate permission — the description is effectively cross-owner-readable through the rendered Markdown."
  - "**DOC-GAP candidate**: the Shift+Enter save-shortcut (`useTermWiki.ts:179-184`) is undocumented in the operator tooltip OR any keyboard-shortcut reference page."

## implicit_adrs

- "The platform uses `[[Namespace:TermName]]` syntax to link Glossary terms from description bodies — terms are assigned BY THE DESCRIPTION TEXT, not via a separate term-attach control on the UI." — evidence: `InternalDescriptionHeader.tsx:20-28` (the InformationIcon tooltip exposing the syntax as a user-facing contract) + `useTermWiki.ts:30-228` (the hook is named `useTermWiki` and is the cluster's central abstraction) + `lib/constants.ts:177` (`TERM_PATTERN` is a top-level constant). — intent_anchor: the verbatim tooltip text "You can link an existing term by entering information about the term according to the pattern [[NamespaceName:TermName]]" at `InternalDescriptionHeader.tsx:22-25` — this is the operator-facing contract documented in the UI itself. — confidence: HIGH

- "Description editing is a per-entity-scoped permission distinct from description VIEWING — the Edit affordance is gated, but the rendered content is universally visible to every `DATA_ENTITY_VIEW` holder." — evidence: `InternalDescriptionHeader.tsx:40-50` + `InternalDescriptionPreview.tsx:32-40` (both wrap ONLY the buttons in `<WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}>`) + `InternalDescriptionPreview.tsx:21` (`<Markdown value={value} />` is unconditional). — intent_anchor: the `WithPermissions` wrappers are positioned around the button JSX, NOT around the parent `Markdown` element — a deliberate decision (a `WithPermissions` wrapping the whole component would have hidden the description from non-editors; placing it only on the button preserves cross-owner read visibility). — confidence: HIGH

- "Cancel-edit semantics intentionally DISCARD in-flight edits — no draft preservation, no confirm-discard prompt, no autosave." — evidence: `useTermWiki.ts:46-49` (`toggleEditMode` re-syncs `internalDescription` to `description` on every flip) + `InternalDescriptionEdit.tsx:35` (Cancel button maps directly to `toggleEditMode`). — intent_anchor: the `setInternalDescription(description)` line in `toggleEditMode` IS the explicit reset — it would have been trivial to omit that line and preserve the draft; the maintainer chose to discard. — confidence: HIGH

- "Save-failure error display is INLINE within the editor — the editor stays open with the error visible at the top, allowing the user to fix and retry without losing their draft." — evidence: `useTermWiki.ts:170-176` (success path sets `error=''` AND `editMode=false`; failure path sets `error` but does NOT flip `editMode`) + `InternalDescriptionEdit.tsx:24-26` (the error Typography renders above the Markdown editor). — intent_anchor: the asymmetric handling of success vs failure within the same `dispatch(...).then(success, failure)` chain — the maintainer deliberately couples success with edit-mode-exit and failure with edit-mode-retention. — confidence: HIGH

- "Shift+Enter is a save shortcut intentionally hidden from the operator-facing tooltip — power-user convenience layered atop the explicit Save button." — evidence: `useTermWiki.ts:179-184` (`handleSaveMarkdownOnEnter` requires `e.key === 'Enter' && e.shiftKey`) + `InternalDescriptionEdit.tsx:23` (`Box onKeyDown={handlePressEnter}`) — but the InformationIcon tooltip at `InternalDescriptionHeader.tsx:20-28` documents ONLY the term-mention syntax, not the keyboard shortcut. — intent_anchor: the implementation explicitly excludes plain Enter (which would conflict with newline insertion in a multi-line editor) and requires the modifier — this is a careful choice, not an accident. — confidence: MEDIUM (the choice is visible, but whether the omission from the tooltip is intentional or oversight is not signalled in the code)

- "Term resolution is fetched on every editor keystroke AND on every description-prop change — the UI prefers correctness (every mention immediately validated) over network thrift." — evidence: `useTermWiki.ts:58-96` (the `useEffect` fires on every `description` change) + `useTermWiki.ts:98-149` (`handleMarkdownChange` fires on every editor keystroke, debounced only by React's component reconciliation, not explicitly throttled). The `fetchedTerms` / `unsuccessfulTerms` caches deduplicate but do NOT batch. — intent_anchor: the explicit choice to call `fetchTerm({namespaceName, termName})` synchronously inside the matcher loop, paired with the inline error state that surfaces unresolved mentions immediately to the writer. — confidence: HIGH

- "Term resolution failures show INLINE errors in the editor without blocking save — the user can still save a description containing unresolved mentions; the saved description will simply have NO term-relation row for the unresolved mention." — evidence: `useTermWiki.ts:126` (`setError(...)`) is non-blocking — `handleUpdateDescription` (lines 151-177) does NOT check `error` before dispatching. — intent_anchor: the absence of an `if (error) return;` guard in the save handler — the writer can save broken term mentions intentionally. — confidence: MEDIUM (could be a gap rather than an intent; no comment or test pins the intent)

## bugs_limitations_corner_cases

- "**The full Markdown rendering pipeline has NO `rehype-sanitize`.** The shared `<Markdown>` element at `Markdown.tsx:112-124` invokes `MDEditor.Markdown` with `components`, `source`, `wrapperElement`, `disableCopy` props ONLY — no `rehypePlugins` override. `@uiw/react-md-editor@3.25.6` → `@uiw/react-markdown-preview@4.2.2` → `rehype-raw@6.1.1` (per `pnpm-lock.yaml:5911-5926`); `grep -rln 'rehype-sanitize' <odd-platform-ui>` returns ZERO matches. P-009 slice-5 empirically confirmed that dangerous TAGS (script, img, iframe) reach the rendered DOM (`probe-run R-20260519T020610Z-P-009`, assertions `dom_has_script_tag == True`, `dom_has_xss_img_id == True`, `dom_has_xss_iframe_id == True`). Event-handler ATTRIBUTES are stripped by React's attribute filtering (`dom_has_onerror_attr == False`); script execution is closed by Chromium HTML-parser policy (`xss_dialog_fired == 0`, `xss_leak_count == 0`) — but these are DEFENCE-IN-DEPTH mitigations, not application-layer defences. A future code change (switching to `dangerouslySetInnerHTML`, adopting a client-side template renderer, relaxing CSP, or adopting an SVG payload that uses `onload` instead of script-via-innerHTML) re-opens the surface invisibly. Defence-in-depth: every Markdown surface in the UI is affected — alerts, queries, term definitions, owner descriptions, dataset-field descriptions, attachments — not just internal descriptions." — evidence: `Markdown.tsx:112-124` + `pnpm-lock.yaml:5911-5938` + `grep -rln 'rehype-sanitize' <odd-platform-ui>` → 0 + `probes/P-009.yaml:147-167`. — severity: HIGH

- "**Permission gating is PARTIAL — only the Edit button is gated, NEVER the rendered content.** A caller with `DATA_ENTITY_VIEW` but NO `DATA_ENTITY_DESCRIPTION_UPDATE` still receives the full Markdown render (including any embedded HTML from a malicious writer). This is the read-collaborative posture documented at the system level (REFACTOR-024 family per concepts catalog) — but the specific gating semantic is subtle enough that a refactor 'simplifying' the cluster by wrapping `OverviewDescription` in a `<WithPermissions>` would silently break legitimate read access for non-editors. A reviewer reading the source easily mistakes the `WithPermissions` placement as 'description gating' rather than 'edit-button gating'." — evidence: `InternalDescriptionHeader.tsx:40-50` (button-wrap) + `InternalDescriptionPreview.tsx:21,32-40` (content unconditional, button wrapped) + `Overview.tsx:67-71` (`WithPermissionsProvider` seeds the permission set but does NOT gate the cluster). — severity: MEDIUM

- "**Term-resolution N+1 issue on rapid typing** — `handleMarkdownChange` (`useTermWiki.ts:98-149`) is invoked on every editor keystroke and iterates over all `[[ns:term]]` matches in the current value; each unique unresolved match issues a single HTTP `GET /api/terms/namespaces/{ns}/names/{name}` (memoised after first response). A description with 10 unresolved mentions, typed character-by-character, can produce 10 parallel inflight requests per keystroke during the initial typing window. The `fetchedTerms` cache deduplicates AFTER responses arrive, but during the in-flight window concurrent calls for the same `termKey` are not prevented. Throttling / debouncing is absent. The UI works fine for small descriptions but degrades on long descriptions with many term mentions on slow networks." — evidence: `useTermWiki.ts:98-149` (no throttle / debounce; no in-flight dedupe) + `useTermWiki.ts:51-55` (initial cache seeded from server-side resolved terms — alleviates the cold-start case but doesn't help during editing). — severity: LOW

- "**Spellcheck DOM-mutation effect hard-codes `id='md-editor'`** — `Markdown.tsx:96-101` uses `document.getElementById('md-editor')?.querySelector('textarea')?.setAttribute('spellcheck', 'true')` on mount. The id is set at `Markdown.tsx:105` (`<MDEditor id='md-editor' ... />`) — a hard-coded singleton id. A future page that mounts two `<Markdown editor>` instances simultaneously (e.g. a side-by-side comparison view, or a dialog opening over a page that already has an editor) races on the same DOM id; the second instance loses the spellcheck attribute or the first does. The bug is dormant on the current page (only one editor at a time) but the contract is fragile." — evidence: `Markdown.tsx:96-105`. — severity: LOW

- "**UI term-mention regex diverges from backend term-mention regex** — UI `TERM_PATTERN = /\\[\\[([^:\\]]+):([^\\]]+)\\]\\]/g` (`lib/constants.ts:177`) requires non-empty namespace AND non-empty term-name (character class `[^:\\]]+` is one-or-more); backend `Pattern.compile(\"\\\\[\\\\[([^:]*?):([^\\\\]]*?)\\\\]\\\\]\")` (`TermServiceImpl.java:67`) is non-greedy and ALLOWS empty groups. A description containing `[[:foo]]` or `[[foo:]]` is invisible to the UI parser (renders verbatim, no error, no auto-link) but the backend parses it and short-circuits inside `findTermsInDescription`. The asymmetry can produce surprises if a programmatic caller (script / odd-cli / collector) writes descriptions with empty groups — the UI silently ignores them, the backend silently no-ops on them, no error surfaces anywhere." — evidence: `lib/constants.ts:177` (UI regex) + `TermServiceImpl.java:67` (backend regex). — severity: LOW

- "**Save-on-error retry semantics are coupled to the `error` state, but the UI does NOT clear `error` before re-dispatching on subsequent saves** — `handleUpdateDescription` (`useTermWiki.ts:151-177`) does NOT call `setError('')` before `dispatch(...)`. If a second save succeeds, `setError('')` is called in the success branch. If the second save fails, `setError(...)` overrides. But during the in-flight window of a retry, the user sees the PREVIOUS error message + the now-disabled-if-error save state — the perceived feedback lags behind the user's actual operation." — evidence: `useTermWiki.ts:151-177` (no `setError('')` pre-dispatch). — severity: LOW

- "**Empty-string echo from backend silently overwrites the local edit** — after a successful save, the redux slice is updated with `{internalDescription: <request value>}` (the backend echoes the request payload per batch-I sidecar `DataEntityServiceImpl.md:concepts.invariants[3]`). The UI re-reads via `useAppSelector(getDataEntityInternalDescription)` and updates the preview. For an empty submission (`{internal_description: ''}`), the response echoes `''`, the UI shows `''` → the preview falls back to the 'Not created.' empty-state branch (per `InternalDescription.tsx:44` + `InternalDescriptionPreview.tsx:20`). The DB column stores NULL. A subsequent refresh of the page re-fetches via `GET /api/dataentities/{id}` which serialises NULL as either missing field or empty string depending on the response shape — there's a hidden coupling between the UI's display logic and the backend's null-to-empty-string conversion behaviour at the data-entity-mapper layer." — evidence: `InternalDescription.tsx:44` (`!description` empty-check) + batch-I sidecar invariants. — severity: LOW (the UI behaviour is consistent; the coupling is documented in F-004)

- "**`<Markdown>` component's `MDEditor.Markdown` invocation is the SOLE Markdown renderer for the platform** — any rehype-pipeline change at `Markdown.tsx` affects every Markdown-rendering surface, not just descriptions. Surfaces include: this description cluster, the dataset-field description cluster, the alert message renderer, the query-example renderer, the term definition renderer, the owner description, the in-app discussion message renderer. A rehype-sanitize introduction here is the right fix for the XSS surface, but the maintainer must verify every dependent surface still renders correctly — e.g. the term-definition tooltip uses `MDEditor.Markdown source={title}` at `Markdown.tsx:64` (the TermLink anchor's tooltip body) — if rehype-sanitize strips a tag from a curated term-definition body, the tooltip silently changes." — evidence: `grep -rln '<Markdown' <odd-platform-ui>/src` returns multiple surfaces; the wrapper is shared. — severity: MEDIUM

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP
  - "Edit-button visibility is gated by `usePermissions().hasAccessTo(Permission.DATA_ENTITY_DESCRIPTION_UPDATE)` which consults the resource-permission set seeded by the parent `WithPermissionsProvider` (`Overview.tsx:67-71`). Under DISABLED, `usePermissions` returns true unconditionally per the platform-wide convention; the Edit button is visible to anyone able to load the page. Description CONTENT renders regardless of auth mode."
  - evidence: "`InternalDescriptionHeader.tsx:40-50` + `InternalDescriptionPreview.tsx:32-40` (the WithPermissions wrappers) + `Overview.tsx:67-71` (the provider seeding)."
- ingestion_filter_relevance: "N/A — UI component; not on the HTTP ingestion path. The save action posts to `/api/dataentities/{id}/description`, which is governed by the centralized `SecurityConstants.SECURITY_RULES` and the resource-scoped `DATA_ENTITY_DESCRIPTION_UPDATE` permission (per batch-G sidecar `upsertDataEntityInternalDescription.md:security.authorization_assertions`)."
- authorization_assertions:
  - "Single client-side gate: `<WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}>` around the Edit / Add buttons. The gate is RESOURCE-SCOPED via `Overview.tsx:67-71` (`WithPermissionsProvider` consumes `resourcePermissions = getResourcePermissions(PermissionResourceType.DATA_ENTITY, dataEntityId)` — the permission set the backend resolved for the current user against this specific entity)." — evidence: `InternalDescriptionHeader.tsx:40-50` + `InternalDescriptionPreview.tsx:32-40` + `Overview.tsx:37-39, 67-71`.
- owner_scoping:
  - "N/A at the UI layer — the cluster receives the description string from redux state populated by the backend's `GET /api/dataentities/{id}` (which does NOT apply owner scoping per the REFACTOR-024 read-collaborative posture). The Edit button's resource-permission set IS owner-scoped via the backend's Policy resolution (per batch-G `upsertDataEntityInternalDescription.md:security.authorization_assertions[0]` — `DataEntityConditionResolver` includes `dataEntity:owner`). But the UI itself applies no further scoping."
- data_exposure:
  - "Rendered Markdown body → any authenticated user with `DATA_ENTITY_VIEW` on the entity (and any unauthenticated user when `auth.type=DISABLED`). The body is rendered through `<Markdown>` → `MDEditor.Markdown` → react-markdown + rehype-raw — embedded `<script>` and `<iframe>` reach the DOM (per P-009). The reader's browser is the ATTACK SURFACE TARGET if a writer with `DATA_ENTITY_DESCRIPTION_UPDATE` (or any caller under DISABLED) injects payloads." — evidence: `InternalDescriptionPreview.tsx:19-22` + `Markdown.tsx:112-124` + `probes/P-009.yaml:147-150`.
  - "Inline editor value → only the editing user's own browser (in-memory state in `useTermWiki.internalDescription`). NOT persisted to redux until Save is fired. NOT echoed to anywhere else during editing." — evidence: `useTermWiki.ts:44` (local state).
  - "Inline error message → only the editing user's own browser. The error string is `response.statusText` or 'Term {termName} not found in namespace {namespaceName}' — neither contains user-supplied content beyond the term identifiers being looked up. Low PII risk." — evidence: `useTermWiki.ts:43,126,174-176`.
  - "Term-lookup HTTP requests → the platform's term service via `GET /api/terms/namespaces/{ns}/names/{name}`. Each fired during typing reveals which `[[ns:term]]` mentions the editor is composing — minor write-time-side-channel information leak (a network observer sees the term identifiers the operator is referencing before the description is saved)."
- known_security_gaps:
  - "**Stored content-injection / potential stored-XSS via Markdown body** — same root cause as the backend gap (no sanitisation at either layer). The UI half is the renderer; even if the backend introduced sanitisation, the UI would still need its own defence-in-depth fix to handle malformed payloads that bypass server-side checks AND to protect the OTHER `<Markdown>` surfaces (alerts, queries, etc.) that may have different write paths. — severity: HIGH" — evidence: `Markdown.tsx:112-124` (no `rehypePlugins`) + `pnpm-lock.yaml:5911-5938` (no `rehype-sanitize`) + `probes/P-009.yaml:147-167` (empirical DOM-presence confirmation).
  - "**Defence-in-depth currently relies on Chromium HTML-parser policy + React attribute filtering — both are external to the application** — P-009 slice-6 measured `xss_dialog_fired == 0` and `xss_leak_count == 0`, but the mitigation is Chromium's policy of NOT executing `<script>` tags inserted via innerHTML, plus React's attribute-handling stripping `onerror=` / `onclick=` from the rehype-raw render path. Neither is the platform's own defence; neither is documented as such for operators evaluating the deployment for hostile-writer scenarios. A platform that deploys with a CSP relaxation, OR migrates to a non-React renderer, OR adopts a payload using SVG `onload` / CSS `expression()`, instantly re-opens the surface. — severity: MEDIUM (effective protection now but extremely fragile)" — evidence: `feature-flows/detail/F-004.yaml:82-119` (slice-6 measurement) + `probes/P-009.yaml:151-167` (assertions).
  - "**Permission-gating placement is fragile** — `<WithPermissions>` wraps ONLY the Edit button, not the Markdown render. A junior developer 'cleaning up' the cluster by hoisting the wrapper to the parent could silently hide descriptions from non-editors (breaking cross-owner read collaboration) OR drop the gate entirely (exposing the Edit button to non-editors who could then hit the backend and receive a 403). Neither failure mode is caught by a test (zero UI tests exist). — severity: MEDIUM" — evidence: `InternalDescriptionHeader.tsx:40-50` + `InternalDescriptionPreview.tsx:32-40` + `find <odd-platform-ui>/src -name '*.test.{ts,tsx}' -o -name '*.spec.{ts,tsx}'` → 0 results.
  - "**Term-mention auto-link gives effectively-anonymous-writer (under DISABLED) implicit `term_relations` write access** — UI half is unable to prevent this; the backend grants the term-relation row on every description write regardless of `DATA_ENTITY_ADD_TERM` (per batch-G sidecar `upsertDataEntityInternalDescription.md:security.known_security_gaps[3]`). The UI surfaces the lookup result inline but does NOT validate the writer's permission to add terms BEFORE allowing the save. The UI is a passive participant; the actual gap is at the backend. — severity: MEDIUM (file-local: passive — the backend is where the fix lands)" — evidence: `useTermWiki.ts:103-149` (no permission check around the mention parse + lookup) + backend cross-ref.

## performance

- hot_paths:
  - "Render-path: every entity-detail page load triggers `InternalDescriptionPreview` rendering — single `<Markdown value={value} />` invocation. For an entity with no description, the empty-state Add button renders instead (very cheap). For entities WITH descriptions, the per-render cost is the rehype-raw HTML parse + the react-markdown rendering. A description with deeply-nested HTML or many heading-anchor levels triggers `rehype-autolink-headings` + `rehype-slug` + `rehype-prism-plus` on every render — these are NOT memoised across re-renders." — evidence: `InternalDescriptionPreview.tsx:19-22` + `Markdown.tsx:112-124` + `pnpm-lock.yaml:5911-5938` (the rehype plugin chain).
  - "Edit-path: `useEffect` at `useTermWiki.ts:58-96` fires on every `description` change AND `handleMarkdownChange` (lines 98-149) fires on every editor keystroke. Each scans the value for `TERM_PATTERN` matches and issues an HTTP request per unique unresolved mention. For a description with 20 unique unresolved mentions, the initial editor mount fires 20 parallel requests; subsequent keystrokes fire 0 if the cache is warm." — evidence: `useTermWiki.ts:58-96, 98-149`.
- throughput_characteristics:
  - "Single-user single-write path — there is no batch operation; an operator edits one description at a time. No write concurrency at the UI layer."
  - "Read-path is per-page-load — every entity-detail page renders the description once per visit. SPA navigation may cache the redux state across navigations, so re-visiting the same entity within a session does not re-render unless the slice updates."
- resource_allocation:
  - "Heap: a description is held in `internalDescription` state (local), the redux slice (global), the `MDEditor` internal state (when in edit mode), and the rendered DOM tree. For a 1 MiB description, ~4 copies × 2 MiB UTF-16 = ~8 MiB per page session — not negligible. The OpenAPI form has NO maxLength (per batch-G sidecar) so the UI accepts arbitrarily large input until the WebFlux 256 KB request-size limit at the backend.",
  - "Network: per-keystroke term-resolution requests bursting for unresolved mentions (see hot_paths). The save dispatch is a single PUT.",
  - "DOM: rehype-raw expands raw HTML into AST nodes that react-markdown then renders — for a description with 100 markdown headings, the DOM grows by ~100 anchor nodes (rehype-slug + rehype-autolink-headings) + the heading content. No virtualisation.",
- scaling_characteristics:
  - "Stateless component — re-renders on prop / state change; no global state aside from the redux slice."
  - "No locking, no race condition at the UI layer beyond the term-resolution N+1 race; the save dispatch is a single fire-and-forget thunk."
  - "No pagination concerns (single description)."
- known_performance_gaps:
  - "**No throttling / debouncing on `handleMarkdownChange`** — every editor keystroke fires the full `TERM_PATTERN` scan + term lookups. For a description with many term mentions, fast typing produces many redundant calls (memoised after first response but in-flight duplicates exist). A 100ms throttle would eliminate ~95% of these without affecting perceived responsiveness. — evidence: `useTermWiki.ts:98-149` (no throttle). — severity: LOW"
  - "**No memoisation of `transformDescriptionToMarkdown` result** — `useTermWiki.ts:186-201` is `useCallback`-wrapped but the underlying string operations (substring split + join, one per term) run on every render even if the description hasn't changed. For long descriptions with many terms, this is wasted work. — evidence: `useTermWiki.ts:186-201` (no `useMemo`). — severity: LOW"
  - "**rehype-raw parse cost grows with embedded HTML complexity** — descriptions containing deeply-nested HTML pay an unbounded parse cost on every render. For descriptions populated by collectors or by programmatic callers (which may include source-system HTML — per the ExternalDescription branch), the per-render cost is non-trivial. — evidence: `Markdown.tsx:112-124` + the rehype-raw transitive dep at `pnpm-lock.yaml:5922`. — severity: LOW"

## upstream_callers

(Per Rule 6 — the cluster's mount points and component-wiring upstream callers + the contributing feature ids.)

- caller_node: "odd-platform ts react-component component:Overview"
  caller_path: "odd-platform-ui/src/components/DataEntityDetails/Overview/Overview.tsx:22, 67-71"
  via_method: "OverviewDescription rendered inside <WithPermissionsProvider allowedPermissions={[Permission.DATA_ENTITY_DESCRIPTION_UPDATE]} resourcePermissions={resourcePermissions} render={() => <OverviewDescription termRefs={termRefs} />} />"
  feature_id: F-004
  sidecar: "(not yet enriched — Overview.tsx is upstream of this cluster but does not yet have a sidecar)"

- caller_node: "odd-platform ts redux-thunk thunk:updateDataEntityInternalDescription"
  caller_path: "odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:104-127"
  via_method: "useTermWiki.handleUpdateDescription dispatches the thunk; the thunk wraps dataEntityApi.upsertDataEntityInternalDescription (the OpenAPI-generated client). Reciprocal coupling: the thunk's success payload updates the redux slice that the cluster reads via getDataEntityInternalDescription selector."
  feature_id: F-004
  sidecar: "(thunk is the bridge to the backend; backend side at lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__upsertDataEntityInternalDescription.md)"

- caller_node: "odd-platform ts react-component component:DatasetFieldDescription (sibling — same useTermWiki hook)"
  caller_path: "odd-platform-ui/src/components/DataEntityDetails/DatasetStructure/DatasetStructureOverview/DatasetStructureView/DatasetFieldOverview/DatasetFieldDescription/DatasetFieldDescription.tsx"
  via_method: "useTermWiki hook shared between dataset-field-level descriptions and entity-level descriptions; changes to the hook propagate to both surfaces. The dataset-field cluster uses the `isDatasetField=true` branch to dispatch DatasetFieldApi.updateDatasetFieldDescription instead."
  feature_id: F-004 (description-editing affordance applies to both granularities)
  sidecar: "(not yet enriched)"

## downstream_side_effects

(Per Rule 6 — every write path's side-effect surface and observable downstream behaviour.)

- side_effect: "PUT /api/dataentities/{dataEntityId}/description (Markdown body) → DB UPDATE data_entity.internal_description (stored verbatim, no sanitisation) + term_relations upsert via [[ns:term]] parser + FTS vector refresh + data_entity_filled flag toggle + DESCRIPTION_UPDATED activity event + TERM_ASSIGNMENT_UPDATED activity event"
  location: "InternalDescriptionEdit.tsx:30-33 (Save button) → useTermWiki.ts:151-177 (handleUpdateDescription) → redux/thunks/dataentities.thunks.ts:104-127 (thunk) → DataEntityController.upsertDataEntityInternalDescription (HTTP boundary)"
  feature_id: F-004
  txn_scope: "Backend: @ReactiveTransactional on DataEntityServiceImpl.upsertDescription (lines 323-333 per batch-I sidecar). UI: no transactional boundary; the dispatch is fire-and-forget with success/failure callbacks updating local state."
  empirically_proven: "P-007 + P-009 (per probes/P-009.yaml:175-178 cross_references.refactoring_scopes: REFACTOR-218 + retrospectives: LSN-017). Backend round-trip pinned by P-007 (R-20260519T012123Z-P-007); UI render-side pinned by P-009 slice-5/-6 (R-20260519T020610Z-P-009 on commit ede5d277)."
  notes: "The save action is the entire F-004 write-amplification surface: 1 HTTP request fans out into 5 DB writes + 2 activity events + 1 FTS rebuild. The UI is the producer; everything downstream lives in the backend sidecars."

- side_effect: "GET /api/terms/namespaces/{namespaceName}/names/{termName} (term resolution; ZERO data mutation server-side — pure READ)"
  location: "useTermWiki.ts:58-96 (useEffect on description change) + useTermWiki.ts:98-149 (handleMarkdownChange on every keystroke) → lib/hooks/api/useGetTermByNamespaceAndName (the actual fetch)"
  feature_id: F-004 (the [[ns:term]] auto-link is part of the description-editing affordance)
  txn_scope: "READ-only; no transactional boundary. Each lookup is an independent HTTP call."
  notes: "Performance-relevant: fires per-keystroke; cached in fetchedTerms / unsuccessfulTerms maps. A description with N unresolved unique mentions issues N parallel HTTP calls on first edit; subsequent keystrokes hit 0 unless new mentions are added. No batching at the UI layer (the backend has a batched endpoint but the UI hook doesn't use it)."

- side_effect: "Local redux state update on successful save (entity slice's internal_description field) — drives re-render of every component subscribing to getDataEntityInternalDescription selector"
  location: "redux/thunks/dataentities.thunks.ts:104-127 (success path) → redux/slices/dataentities.slice.ts (reducer)"
  feature_id: F-004
  txn_scope: "Redux dispatch — synchronous reducer call after the thunk resolves. The slice update is the OBSERVABLE downstream effect of a successful save from the UI's perspective."
  notes: "Components reading the slice (this cluster's preview, plus any other entity-detail tab that surfaces description content) re-render with the new value. NO components currently re-read from the server after the slice update — the server's empty-string-to-NULL normalisation is invisible to the UI."

- side_effect: "DOM mutation: `document.getElementById('md-editor')?.querySelector('textarea')?.setAttribute('spellcheck', 'true')` on Markdown editor mount"
  location: "Markdown.tsx:96-101 (useEffect)"
  feature_id: F-004 (cosmetic part of the edit affordance)
  txn_scope: "Imperative DOM mutation; bypasses React's state model."
  notes: "Side effect of mounting the editor. The hard-coded singleton id is a known fragility (see bugs_limitations_corner_cases). Not observable downstream beyond the spellcheck-indicator UX."

## sources

- understanding ← OverviewDescription.tsx:15-41 + InternalDescription.tsx:19-67 + InternalDescriptionHeader.tsx:30-52 + InternalDescriptionPreview.tsx:19-22 + InternalDescriptionEdit.tsx:22-37 + Markdown.tsx:84-127 + useTermWiki.ts:30-228 + lib/constants.ts:177 + pnpm-lock.yaml:5911-5938 + probes/P-009.yaml:147-167
- concepts.entities.InternalDescription ← redux/thunks/dataentities.thunks.ts:104-127 (the thunk's response type)
- concepts.entities.InternalDescriptionFormData ← useTermWiki.ts:152-156 (the request shape)
- concepts.entities.TermRef ← useTermWiki.ts:51-55 (initial-cache shape) + InternalDescription.tsx:15-17 (prop shape)
- concepts.entities.Markdown ← Markdown.tsx:84-127
- concepts.entities.TERM_PATTERN ← lib/constants.ts:177 + TermServiceImpl.java:67 (backend regex — for the comparison)
- concepts.invariants.[0] ← Markdown.tsx:112-124 (no rehypePlugins override) + pnpm-lock.yaml:5911-5938 + grep `rehype-sanitize` 0 matches
- concepts.invariants.[1] ← InternalDescriptionHeader.tsx:40-50 + InternalDescriptionPreview.tsx:21,32-40 + Overview.tsx:67-71
- concepts.invariants.[2] ← useTermWiki.ts:151-177 (no server re-read) + redux/slices/dataentities.slice.ts (the reducer) + batch-I sidecar `DataEntityServiceImpl.md:concepts.invariants[3]` (request-echo behaviour)
- concepts.invariants.[3] ← lib/constants.ts:177 (UI regex) + TermServiceImpl.java:67 (backend regex)
- concepts.invariants.[4] ← useTermWiki.ts:46-49 (toggleEditMode re-sync) + InternalDescriptionEdit.tsx:35 (Cancel mapping)
- concepts.invariants.[5] ← useTermWiki.ts:58-96 (effect) + 98-149 (handler) + 186-201 (render-time substitute)
- concepts.invariants.[6] ← Markdown.tsx:96-105 (the imperative DOM mutation with hard-coded id)
- dependencies_semantic.requires-feature.[0] ← Markdown.tsx:1-5 (imports) + pnpm-lock.yaml:5911-5938
- dependencies_semantic.requires-feature.[1] ← useTermWiki.ts:30-228 + DatasetFieldDescription.tsx (sibling-use; not directly read this session but confirmed via grep)
- dependencies_semantic.requires-feature.[2] ← redux/thunks/dataentities.thunks.ts:104-127
- dependencies_semantic.requires-feature.[3] ← useTermWiki.ts:39 + lib/hooks/api/useGetTermByNamespaceAndName (import)
- dependencies_semantic.requires-feature.[4-6] ← InternalDescription.tsx:3-12, 22-23 + Overview.tsx:8,37-39,67-71 + components/shared/contexts/Permission/WithPermissions.tsx:1-32
- dependencies_semantic.requires-feature.[7] ← OverviewDescription.tsx:5
- dependencies_semantic.requires-feature.[8] ← redux/thunks/dataentities.thunks.ts:104-127 + batch-G sidecar
- dependencies_semantic.requires-config.[0] ← (cross-batch) DisabledAuthSecurityConfiguration.java + LoginFormSecurityConfiguration.java + auth.type chain
- dependencies_semantic.requires-runtime.[0..3] ← package.json:41-89 + vite/build setup + probes/P-009.yaml:90-167 (Chromium-headless empirical verification)
- dependencies_semantic.coupling.[0..4] ← grep on `<Markdown` usage + redux/slices integration + Overview.tsx:67-71 + WithPermissions wiring
- tests_coverage_semantic.covered_behaviours ← probes/P-009.yaml:90-167 (full probe definition) + feature-flows/detail/F-004.yaml:212-219 (probe-pinning record)
- tests_coverage_semantic.uncovered_behaviours ← exhaustive file enumeration: find <odd-platform-ui>/src -name '*.test.{ts,tsx}' -o -name '*.spec.{ts,tsx}' → 0 results; combined with the per-component file reads above
- tests_coverage_semantic.test_files ← package.json:5-11 (test scripts present) + find on test files (0 results) + grep `@testing-library` to confirm deps installed but unused
- docs_link_semantic.inferred_docs.[0] ← documentation/docs/data-discovery.md lines 5-53 (local read) + system-mission.md (pillar mapping)
- docs_link_semantic.inferred_docs.[1] ← batch-G sidecar cross-ref (carrying forward 2026-05-12F verified URL)
- docs_link_semantic.inferred_docs.[2] ← InternalDescriptionHeader.tsx:20-28 (the in-UI tooltip — the only existing docs of [[ns:term]] syntax)
- implicit_adrs.[0] ← InternalDescriptionHeader.tsx:20-28 + useTermWiki.ts (the hook name + structure) + lib/constants.ts:177
- implicit_adrs.[1] ← InternalDescriptionHeader.tsx:40-50 + InternalDescriptionPreview.tsx:21,32-40 + Overview.tsx:67-71 (the deliberate gating placement)
- implicit_adrs.[2] ← useTermWiki.ts:46-49 + InternalDescriptionEdit.tsx:35
- implicit_adrs.[3] ← useTermWiki.ts:170-176 + InternalDescriptionEdit.tsx:24-26
- implicit_adrs.[4] ← useTermWiki.ts:179-184 + InternalDescriptionEdit.tsx:23
- implicit_adrs.[5] ← useTermWiki.ts:58-96, 98-149
- implicit_adrs.[6] ← useTermWiki.ts:126,151-177 (no error-blocking guard)
- bugs_limitations_corner_cases.[0] ← Markdown.tsx:112-124 + pnpm-lock.yaml:5911-5938 + grep `rehype-sanitize` 0 matches + probes/P-009.yaml:147-167
- bugs_limitations_corner_cases.[1] ← InternalDescriptionHeader.tsx:40-50 + InternalDescriptionPreview.tsx:21,32-40 + Overview.tsx:67-71
- bugs_limitations_corner_cases.[2] ← useTermWiki.ts:98-149 (per-keystroke + no dedupe on in-flight)
- bugs_limitations_corner_cases.[3] ← Markdown.tsx:96-105 (the hard-coded id)
- bugs_limitations_corner_cases.[4] ← lib/constants.ts:177 + TermServiceImpl.java:67 (regex comparison)
- bugs_limitations_corner_cases.[5] ← useTermWiki.ts:151-177 (no pre-dispatch error clear)
- bugs_limitations_corner_cases.[6] ← InternalDescription.tsx:44 + InternalDescriptionPreview.tsx:20 (empty-state branch on truthy check)
- bugs_limitations_corner_cases.[7] ← Markdown.tsx (the shared wrapper consumed by every Markdown surface) + grep `<Markdown` over <odd-platform-ui>/src
- security.auth_mode_relevance ← InternalDescriptionHeader.tsx:40-50 + InternalDescriptionPreview.tsx:32-40 + Overview.tsx:67-71
- security.ingestion_filter_relevance ← (path-based: /api/dataentities/{id}/description is NOT /ingestion/entities)
- security.authorization_assertions.[0] ← InternalDescriptionHeader.tsx:40-50 + InternalDescriptionPreview.tsx:32-40 + Overview.tsx:37-39,67-71
- security.owner_scoping ← Overview.tsx:37-39 (resourcePermissions sourced from backend's Policy-resolved permission set)
- security.data_exposure.[0-3] ← InternalDescriptionPreview.tsx:19-22 + Markdown.tsx:112-124 + useTermWiki.ts (the network surface) + probes/P-009.yaml:147-167
- security.known_security_gaps.[0] ← Markdown.tsx:112-124 + pnpm-lock.yaml:5911-5938 + probes/P-009.yaml:147-167
- security.known_security_gaps.[1] ← feature-flows/detail/F-004.yaml:82-119 (slice-6 measurement)
- security.known_security_gaps.[2] ← InternalDescriptionHeader.tsx:40-50 + the absence of UI tests
- security.known_security_gaps.[3] ← useTermWiki.ts:103-149 + batch-G sidecar cross-ref
- performance.hot_paths.[0-1] ← InternalDescriptionPreview.tsx:19-22 + Markdown.tsx:112-124 + useTermWiki.ts:58-96, 98-149
- performance.throughput_characteristics ← OverviewDescription mount semantics + single-user-single-write nature
- performance.resource_allocation ← state-shape analysis across useTermWiki + redux slice + DOM
- performance.scaling_characteristics ← absence of pagination / locking concerns at the UI layer
- performance.known_performance_gaps.[0-2] ← useTermWiki.ts:98-149 (no throttle) + useTermWiki.ts:186-201 (no useMemo) + Markdown.tsx:112-124 (rehype-raw cost)
- upstream_callers.[0] ← Overview.tsx:22,67-71
- upstream_callers.[1] ← redux/thunks/dataentities.thunks.ts:104-127
- upstream_callers.[2] ← DatasetFieldDescription.tsx (grep-confirmed) + useTermWiki.ts:18 (`isDatasetField` parameter)
- downstream_side_effects.[0] ← useTermWiki.ts:151-177 + redux/thunks/dataentities.thunks.ts:104-127 + batch-G sidecar
- downstream_side_effects.[1] ← useTermWiki.ts:58-96, 98-149
- downstream_side_effects.[2] ← redux/thunks/dataentities.thunks.ts:104-127 (success path) + InternalDescription.tsx:22 (selector consumption)
- downstream_side_effects.[3] ← Markdown.tsx:96-105

## confidence_per_field

- understanding: HIGH (six TSX files read end-to-end + the shared Markdown wrapper + the useTermWiki hook + the redux thunk + the constants file; the rehype-sanitize absence is exhaustively verified)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero UI tests is a high-confidence factual finding — exhaustive find returned no test files; the empirical coverage is the P-009 probe pinning)
- docs_link_semantic: MEDIUM (one cross-batch verified URL; two local-only or unverified; live-URL verification pending per system-mission.md frontmatter)
- implicit_adrs: HIGH (each ADR cites a deliberate-choice anchor: a tooltip, a state-reset line, an asymmetric success/failure handler, a shortcut-key gate)
- bugs_limitations_corner_cases: HIGH (each finding cites file:line and rooted in empirical evidence where applicable — P-009 for the XSS surface, code-only for the rest)
- security: HIGH (file-local scope; aggregate posture is concept-merger's job)
- performance: MEDIUM (the per-render rehype-raw cost is statically describable but the absolute magnitude depends on description size + content shape, not statically resolvable; the N+1 term-resolution is HIGH)
- upstream_callers: HIGH (mount points enumerated; sibling DatasetFieldDescription confirmed via the useTermWiki hook's `isDatasetField` parameter)
- downstream_side_effects: HIGH (4 distinct side effects traced; backend cross-ref via batch-G + batch-I sidecars)

## Maintainer notes

(empty — preserved for future maintainer prose)

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — appended after each layer-5 probe-run that touches this node's contributing-features. Each entry cites a probe-run artefact under lineage/{repo}/probe-runs/. Per dynamic-verification ADR Rule 4. -->

(none yet for this specific component-cluster node_id; P-009 currently records its probe-verification entries on the backend node `upsertDataEntityInternalDescription.md`. The probe's act-phase navigates `/dataentities/1009/overview` and asserts DOM-presence — which exercises this cluster's render path — but the probe is wired to the backend feature-flow's `contributing_nodes`, not yet to the UI cluster. Maintainer follow-up: extend probe-runner to record probe_verifications on UI-side cluster nodes when the act-phase includes a browser observe.)
