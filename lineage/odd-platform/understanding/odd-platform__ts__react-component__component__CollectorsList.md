---
node_id: "odd-platform ts react-component component:CollectorsList"
node_kind: react-component
axis: ui_components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Q
---

# CollectorsList (Management → Collectors tab) — semantic understanding

## understanding

UI surface for the Collectors tab in Management (`/management/collectors`). Renders a search box + "Add collector" button (gated by `Permission.COLLECTOR_CREATE` via the `WithPermissions` wrapper) + an infinite-scroll list of `CollectorItem` rows. Each `CollectorItem` exposes an Edit dialog (`COLLECTOR_UPDATE`), a Delete dialog (`COLLECTOR_DELETE`), and — through the child `CollectorItemToken` component — the collector's **40-character plaintext bearer token** (visible only on the create / regenerate response; masked as `******{last6}` on subsequent reads), with a Copy button when visible and a Regenerate confirmation (`COLLECTOR_TOKEN_REGENERATE`) when masked. The component composes the entire create / read-token / rotate / delete lifecycle for the credential consumed by `IngestionDataSourceFilter` (always-on) AND `IngestionDataEntitiesFilter` (opt-in, default-off per `application.yml:48`). The token-visibility flip relies on a fragile substring sniff — `collector.token.value.substring(0, 6) === '******'` — to detect "this is a masked value, don't show Copy, show Regenerate instead."

## concepts

- entities:
  - "`Collector` (the generated API model with `id`, `name`, `description`, `namespace`, `token: { value: string }`, `createdAt`, `updatedAt` — `generated-sources/api.ts`)"
  - "`Token` (40-char alphanumeric shared secret rendered in `<Token>{collector.token.value}</Token>` at CollectorItemToken.tsx:34 — value is plaintext on regenerate/create response, `******{last6}` on read paths)"
  - "Redux state slice — `state.collectors.collectorsList` + `state.collectors.pageInfo` — populated by `fetchCollectorsList` thunk via `collectorApi.getCollectorsList({page, size, query})`"
  - "`CollectorFormData` (the form payload — `name`, `namespaceName`, `description`; **no `token` field** — token is server-issued, not operator-supplied; CollectorForm.tsx:38-44)"
  - "Selectors — `getCollectorsList`, `getCollectorsListPage`, `getCollectorsListFetchingStatuses`, `getCollectorDeletingStatuses` (CollectorsList.tsx:6-11)"
- operations:
  - "list-collectors-paginated (page size = 30; CollectorsList.tsx:40)"
  - "search-collectors-debounced (500ms; `useDebouncedCallback` at CollectorsList.tsx:52-57)"
  - "create-collector (CollectorForm + `registerCollector` thunk → `POST /api/collectors`)"
  - "update-collector (CollectorForm with existing collector + `updateCollector` thunk → `PUT /api/collectors/{id}`)"
  - "delete-collector (ConfirmationDialog + `deleteCollector` thunk → `DELETE /api/collectors/{id}`)"
  - "regenerate-token (ConfirmationDialog + `regenerateCollectorToken` thunk → `PUT /api/collectors/{id}/token`)"
  - "copy-token-to-clipboard (the `CopyButton` in CollectorItemToken.tsx:52, only visible while `isHidden === false`)"
  - "detect-masked-token-by-prefix (`substring(0, 6) === '******'`; CollectorItemToken.tsx:26)"
- invariants:
  - "Add-collector button is HIDDEN unless the current session has `Permission.COLLECTOR_CREATE` (CollectorsList.tsx:91-101 `<WithPermissions permissionTo={Permission.COLLECTOR_CREATE}>`). Same pattern applies to Edit (`COLLECTOR_UPDATE`), Delete (`COLLECTOR_DELETE`), and Regenerate (`COLLECTOR_TOKEN_REGENERATE`) at CollectorItem.tsx:39, :52 and CollectorItemToken.tsx:36."
  - "Token visibility is one-shot: a freshly created or regenerated collector arrives with `token.value` as the full 40-char plaintext; once the page reloads (refetch of the list), the API returns `******{last6}` and the UI flips into `isHidden === true` mode. There is no 'show token again' affordance — the operator MUST copy on first display or regenerate to see it again."
  - "Token discrimination logic is purely client-side and pattern-based: `setIsHidden(collector.token.value.substring(0, 6) === '******')` (CollectorItemToken.tsx:26). If a future backend change masked tokens with a different sentinel (e.g. `▒▒▒▒▒▒…` or `***…`), this check would silently false-negative and the UI would offer Copy on a masked value."
  - "Page-load fetch dependency array is `[isCollectorDeleting, query, size]` (CollectorsList.tsx:46). `isCollectorDeleting` is the redux deletion-status flag — when a delete completes (`true → false`), the effect re-fires and refetches page 1. `dispatch` is intentionally NOT in the deps array (React lint would flag it but it's stable). `size` is a constant (`30`) so its inclusion is functionally a no-op."
  - "No `useEffect` dependency includes a fetch RESULT (`collectorsList`, `pageInfo.page`, `pageInfo.total`) — therefore CollectorsList does NOT exhibit the LSN-017 `details.status?.status` +2 amplification shape (no fetch-response → dep-array → re-fetch loop)."
- audiences: [platform-operator, odd-platform-ui-end-user (operator persona only — the entire tab is permission-gated)]

## dependencies_semantic

- requires-feature:
  - "Backend `CollectorController` (5 endpoints: list/get, register, update, delete, regenerate-token) per `CollectorController.java:14-52` — each endpoint is independently authorized via `SecurityConstants.SECURITY_RULES` at lines 127-137."
  - "Generated SDK `collectorApi` (typed wrappers around the 5 endpoints) — `lib/api.ts`."
  - "Redux thunks chain — `fetchCollectorsList` / `registerCollector` / `updateCollector` / `deleteCollector` / `regenerateCollectorToken` (collectors.thunks.ts:14-91) each wrapping `collectorApi.*` via `handleResponseAsyncThunk`."
  - "`WithPermissions` context wrapper (`components/shared/contexts/Permission/WithPermissions.tsx:11-32`) — gates child rendering on `usePermissions().hasAccessTo(permissionTo)`. The PermissionProvider seeds `allowedPermissions: Permission[]` from `/api/identity` response per `WithPermissionsProvider.tsx:5-9`."
  - "MUI components (`Grid`, `Typography`), `use-debounce` for search debouncing, `react-infinite-scroll-component` for paginated rendering, `react-i18next` for translation."
  - "Sibling components — `CollectorForm` (modal create/edit dialog), `CollectorItem` (per-row card), `CollectorItemToken` (token display + copy / regenerate affordance), `CollectorSkeletonItem` (loading placeholder)."
- requires-config:
  - "Backend `auth.ingestion.filter.enabled` (default `false` per `application.yml:48`) — this UI hands out tokens whose ONLY consumer is `IngestionDataEntitiesFilter`, which is OFF in the default deployment. Tokens issued via this UI have ZERO security effect on the `/ingestion/entities` write path until the operator flips this flag. The UI gives NO indication of this fact."
  - "Backend `auth.type` (default `DISABLED` per `application.yml:32-34`) — under DISABLED the SecurityWebFilterChain bypasses every `SECURITY_RULES` entry including the four `COLLECTOR_*` permissions. The UI's WithPermissions wrapper STILL hides the Add / Edit / Delete / Regenerate buttons (because no SecurityContext means `allowedPermissions === []`), but the BACKEND endpoints accept anonymous mutations regardless. UI-vs-API asymmetry — see security.known_security_gaps."
- requires-runtime:
  - "React 18 (`useState`, `useEffect`, `useCallback`), Redux (`useAppDispatch` / `useAppSelector`), React Router (the route is mounted at `/management/collectors` per the management router; not shown in this file)."
  - "use-debounce 500ms debounce on the search input (CollectorsList.tsx:53)."
  - "react-infinite-scroll-component for cursor-style pagination (`hasNext` from server, `dataLength` from local list, `next` callback to `fetchNextPage`; CollectorsList.tsx:105-110)."
- coupling:
  - "The UI's permission-gated rendering depends on the platform's response to `/api/identity` (the source of `allowedPermissions`). Under `auth.type=DISABLED`, `/api/identity` returns empty `permissions` → `WithPermissions` hides every action → the UI looks read-only. BUT the underlying REST endpoints are NOT permission-gated under DISABLED (DisabledAuthSecurityConfiguration bypasses SECURITY_RULES). A direct `curl POST /api/collectors` succeeds anonymously."
  - "The token-display visibility flip (`isHidden`) is recomputed on every change of `collector.token.value` (CollectorItemToken.tsx:25-27). After a successful regenerate, the redux store's `collectorsList[i].token.value` is replaced with the plaintext from the regenerate response → `isHidden` flips to `false` → the warning admonition at CollectorItem.tsx:87-98 (`Save token in a secure location. You will not be able to retrieve it again.`) becomes visible."
  - "Search query (`query`) is debounced on input changes (CollectorsList.tsx:52-66) but ALSO triggers an immediate refetch on Enter key (`handleKeyDown`). The `useEffect` at :44-46 also refetches page 1 whenever `query` becomes empty (`if (!query) dispatch(fetchCollectorsList(...))`), which means clearing the search box silently rewinds pagination state."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Render test: 'Add collector' button is visible when `Permission.COLLECTOR_CREATE` is in `allowedPermissions` and HIDDEN otherwise."
  - "Render test: Edit / Delete / Regenerate buttons follow the same permission-gating pattern."
  - "Token-visibility test: a Collector with `token.value` starting with `******` flips `isHidden` to `true` and renders the Regenerate button rather than the Copy button."
  - "Token-visibility test: a Collector with `token.value` of a 40-char alphanumeric string flips `isHidden` to `false` and renders the warning admonition + Copy button."
  - "Regression test for the substring(0,6) sentinel — if the backend changes the mask format (e.g. drops to 4 stars `****{last6}`), the UI should NOT silently offer Copy on a masked value."
  - "Search-debounce test: typing into the search box fires `handleSearch` after 500ms; pressing Enter fires immediately; clearing the input refetches page 1."
  - "Pagination test: scrolling past the bottom triggers `fetchNextPage` only when `hasNext === true`."
  - "Delete-refetch test: after a successful delete, `isCollectorDeleting` flips true→false and the dep-array effect at :44-46 re-fires a page-1 fetch."
  - "Cross-layer test: under `auth.type=DISABLED`, `usePermissions` returns `hasAccessTo(*) === false` for every Permission, the UI renders no action buttons, BUT a direct `POST /api/collectors` from the same browser session succeeds (validates the UI-vs-API asymmetry surfaced in REFACTOR-185)."
- test_files: []
- gaps: |
    The CollectorsList component has NO test file in this codebase (verified by glob of
    `odd-platform-ui/src/components/Management/CollectorsList/**/*.test.{ts,tsx}` returning zero matches).
    Every behaviour — permission gating, token-visibility flip, search debouncing, pagination,
    delete-refetch — is asserted only by manual operator testing. The token-visibility substring
    sniff is the highest-risk untested invariant: a UI regression that silently offers Copy on
    a masked-but-not-prefixed-with-six-stars token would leak `******abc123`-style fragments to
    clipboards, and a backend change to the mask format would be invisible to maintainers until
    operators reported "the Copy button copies stars."

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: "#collectors"
    rationale: "The Management page documents the Collectors tab as 'Registered Collectors and their tokens. Issue new tokens, view existing token IDs, regenerate or revoke.' — this is the rendered UI surface for this component. WebFetched 2026-05-20."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "Registered Collectors and their tokens. Issue new tokens, view existing token IDs, regenerate or revoke."
      "Issue a token before deploying a Collector; rotate a leaked token; remove a Collector that's been retired."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "The four `COLLECTOR_*` permissions this UI gates on are documented verbatim on this page under Management permissions. WebFetched 2026-05-20."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "COLLECTOR_CREATE: Allows registering a new metadata collector."
      "COLLECTOR_DELETE: Allows deleting a collector."
      "COLLECTOR_UPDATE: Allows editing a collector's configuration."
      "COLLECTOR_TOKEN_REGENERATE: Allows regenerating the security token for a collector."
- doc_drift_findings:
  - "The Management → Collectors live doc page contains NO warning about `auth.ingestion.filter.enabled` defaulting to `false`. An operator reading 'rotate a leaked token' on the docs page can reasonably believe rotation has security effect — but on a default deployment, the `/ingestion/entities` write path is anonymously reachable regardless of token value (per REFACTOR-185 17-19 SIDECAR finding). The docs claim a security property the default deployment does not enforce. Verified by WebFetch 2026-05-20 of `https://docs.opendatadiscovery.org/features/management` — token-rotation guidance is present, the auth.ingestion.filter.enabled caveat is absent."
  - "The Management → Collectors live doc page contains NO warning about `auth.type=DISABLED` bypassing all four COLLECTOR_* permissions on the BACKEND. Operators interacting with the UI under DISABLED see no Add/Edit/Delete buttons (UI hides them when `/api/identity` returns empty permissions) and may infer 'this deployment is locked down' — but a direct `curl POST /api/collectors` succeeds anonymously. UI-vs-API asymmetry not documented. Verified by WebFetch 2026-05-20."
  - "The Management → Collectors live doc page does NOT document the one-shot token visibility: a freshly generated token is shown ONCE; a subsequent page reload returns `******{last6}` and the only recovery path is regeneration (which invalidates ANY in-flight ingestion using the prior token — see CollectorController.regenerateCollectorToken sidecar `bugs_limitations_corner_cases[0]` 'no rotation grace period'). Operators who fail to copy on first display lose access to the secret with no recovery."
  - "The Management → Collectors live doc page does NOT document the in-place token rotation semantic (no grace period; old token 401s immediately; ingestion fails until collector picks up new value). Operators rotating during active ingestion will see an ingestion-failure incident with no warning."

## implicit_adrs

- "Token visibility is detected client-side via a substring-prefix sniff, not via a backend-supplied flag" — evidence: CollectorItemToken.tsx:25-27 (`useEffect(() => { setIsHidden(collector.token.value.substring(0, 6) === '******'); }, [collector.token.value]);`) + TokenMapper.java:15-18 (backend masks as `"******" + value.substring(value.length() - 6)` — verified per existing `CollectorController.regenerateCollectorToken.md:implicit_adrs[2]`) — intent_anchor: "the design intent is the SAME `Collector` API shape on the visible and masked branches — no `tokenVisible: boolean` field in the contract. The UI infers visibility from the value itself, which makes the API surface narrower at the cost of UI-side fragility. The check is a string-prefix sniff rather than e.g. a regex (`/^\*{6}/`), which is conservatively literal — six exact stars, no whitespace, no Unicode dash."  — confidence: HIGH

- "Permission-gating in the Management UI is universally implemented via the `<WithPermissions permissionTo={Permission.X}>` wrapper, not via per-button programmatic checks" — evidence: CollectorsList.tsx:91-101 (`<WithPermissions permissionTo={Permission.COLLECTOR_CREATE}>...</WithPermissions>`) + CollectorItem.tsx:39, :52 + CollectorItemToken.tsx:36 (every mutating affordance is wrapped) + WithPermissions.tsx:11-32 (the single-implementation wrapper) — intent_anchor: "the entire Management surface uses the same wrapper pattern. The choice 'wrapper element returns null when permission absent' is consistent across all four COLLECTOR_* permissions AND across the per-row Edit/Delete buttons AND the create button — a deliberate convention applied without exception." — confidence: HIGH

- "Token-issuance is server-driven; the UI form does NOT collect a token field" — evidence: CollectorForm.tsx:38-44 (`name`, `namespaceName`, `description` — no `token` in `CollectorFormData`) + CollectorController.java:28-31 (`registerCollector` accepts `CollectorFormData`, returns a `Collector` whose `token` is server-generated per CollectorServiceImpl.create) — intent_anchor: "the form schema and the contract model are deliberately separated. `CollectorFormData` has 3 fields; `Collector` (the response) has 7 fields including the server-issued `token`. The maintainer chose not to allow operator-supplied tokens — a deliberate stance that the platform owns the secret-generation channel." — confidence: HIGH

## bugs_limitations_corner_cases

- "Token-visibility detection is a string-prefix sniff on `******` (six exact stars). A future backend change to the mask format (e.g. shortening to 4 stars, switching to a Unicode block character, prepending whitespace) would silently break the visibility detection — the UI would offer the Copy button on a masked value, leaking `******abc123`-style fragments to the operator's clipboard. No automated test guards against this." — evidence: CollectorItemToken.tsx:25-27 (the substring check) + TokenMapper.java:15-18 (the backend mask format that the substring sniffs for) — severity: MEDIUM

- "The 'Add collector' button + Edit / Delete / Regenerate buttons are hidden under `auth.type=DISABLED` because `/api/identity` returns empty `permissions`, but the underlying REST endpoints accept anonymous mutations regardless (DisabledAuthSecurityConfiguration bypasses all SECURITY_RULES). Operators clicking around the UI on a DISABLED deployment will see a READ-ONLY surface and may infer 'this is locked down'; an attacker bypassing the UI with `curl POST /api/collectors` succeeds with no auth. The UI is QUIETER than the API on this surface — security-critical UI-vs-API asymmetry. This is the **NEW 19th sidecar facet of REFACTOR-185** (the COLLECTOR_* permission family was not previously in the 18-sidecar enumeration)." — evidence: CollectorsList.tsx:91, :101 + CollectorItem.tsx:39, :52 + WithPermissions.tsx:11-32 (UI gating mechanism) + DisabledAuthSecurityConfiguration.java:11-19 (.anyExchange().permitAll()) + SecurityConstants.java:127-137 (the COLLECTOR_* SecurityRules that DISABLED bypasses) — severity: HIGH

- "The token displayed in `<Token>{collector.token.value}</Token>` (CollectorItemToken.tsx:34) is rendered DIRECTLY INTO THE DOM as plaintext when `isHidden === false`. Any browser extension, screenshot tool, accessibility screen reader, or DOM-inspection tool captures the credential. No `<input type='password'>`-style obfuscation; no Reveal-on-hover affordance; no auto-hide-after-N-seconds timer. The warning admonition (CollectorItem.tsx:87-98) is the only mitigation." — evidence: CollectorItemToken.tsx:34 (`<Token $isHidden={isHidden}>{collector.token.value}</Token>` — value is a direct child text node) — severity: MEDIUM

- "Token rotation has no UI-side warning about the no-grace-period semantic. The ConfirmationDialog at CollectorItemToken.tsx:37-50 reads `'Are you sure you want to regenerate token for this collector?' / 'Regenerate token for \"{collector.name}\"?'` — neither line warns that in-flight ingestion using the prior token will start 401-ing immediately, nor that the operator must redeploy the collector with the new token, nor that rotation invalidates the prior secret platform-wide. The existing backend sidecar `CollectorController.regenerateCollectorToken.md:bugs_limitations_corner_cases[0]` (severity HIGH) describes the operational consequence; the UI affordance does not surface it." — evidence: CollectorItemToken.tsx:38-49 (ConfirmationDialog text) — severity: MEDIUM

- "Token rotation has no UI-side warning about the `auth.ingestion.filter.enabled` default. An operator rotating a 'leaked' token on a default deployment (`auth.ingestion.filter.enabled=false`) has rotated a credential that has ZERO security effect on `POST /ingestion/entities` — the endpoint is anonymously reachable regardless of the token. The UI promises a security property the default deployment does not enforce. This is a Cornerstone-3 (configuration-as-separate-audience-surface) failure that compounds with REFACTOR-185." — evidence: CollectorItemToken.tsx:34 + the existing IngestionDataEntitiesFilter sidecar's `bugs_limitations_corner_cases[0]` (HIGH: default-OFF posture) + application.yml:48 — severity: HIGH

- "useEffect at CollectorsList.tsx:44-46 omits `dispatch` from its dependency array (ESLint react-hooks/exhaustive-deps rule). Functionally harmless (dispatch is referentially stable across renders) but the lint rule is suppressed without comment. A junior maintainer reading this file may copy-paste the pattern and miss a genuine missing dependency in another effect." — evidence: CollectorsList.tsx:44-46 (`React.useEffect(() => { if (!query) dispatch(fetchCollectorsList(...)); }, [isCollectorDeleting, query, size]);`) — severity: LOW

- "The `handleSearch` callback at CollectorsList.tsx:52-57 wraps `useDebouncedCallback` inside `useCallback`, and its `deps: [query, size]` list omits `dispatch`. Same lint-suppression concern as above; identical low severity." — evidence: CollectorsList.tsx:52-57 — severity: LOW

- "Clearing the search input (`setQuery('')` via X button or backspace) triggers the `useEffect` at :44-46 (`if (!query) dispatch(fetchCollectorsList({ page: 1, size }))`), silently rewinding pagination back to page 1. A user who has scrolled to page 5 and clears the search loses their scroll position with no warning toast. No undo." — evidence: CollectorsList.tsx:44-46 + :59-62 (handleInputChange) — severity: LOW

- "`size` is included in the dep arrays of BOTH `useEffect` blocks (:46, :50) and the `useCallback` (:57), but is a hardcoded constant (`const size = 30` at :40) — including it adds no behaviour. If `size` ever becomes a state value (e.g. user-configurable page size), the dep arrays are accidentally correct, but the current code obscures the design — a reader cannot tell from the dep array whether the value is dynamic or fixed." — evidence: CollectorsList.tsx:40, :46, :50, :57 — severity: LOW

- "The search debounce timer (500ms) is set per-callback invocation; `useDebouncedCallback` returns a stable reference, but the `useCallback` wrapper at :52-57 re-creates the debounce on `[query, size]` change. Each re-creation cancels the prior debounce timer; rapid typing while `query` changes effectively resets the timer each keystroke as intended. The interaction between `useCallback` and `useDebouncedCallback` is non-obvious — a refactor that simplifies to a single hook could change behaviour." — evidence: CollectorsList.tsx:52-57 — severity: LOW

- "The component does NOT exhibit the LSN-017 `useEffect dep includes fetch-result` double-fire amplification (verified — no dependency on `collectorsList`, `pageInfo.page`, `pageInfo.total`, `total` in the effect at :44-46; the effect's deps are `[isCollectorDeleting, query, size]`, none of which are derived from the fetch response that the effect itself initiates). This component is LSN-017-safe by structure. The neighbouring effect at :48-50 (`if (!query) setTotalCollectors(total)`) DOES depend on `total` (a fetch result), but it only calls `setTotalCollectors` (a setter that doesn't dispatch another fetch), so no amplification loop exists." — evidence: CollectorsList.tsx:44-46 + :48-50 — severity: N/A (this is a NEGATIVE finding — explicitly stating where LSN-017 does NOT apply, to spare a future maintainer from re-discovering)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these are the three modes that populate `/api/identity` with a real principal and therefore a real `allowedPermissions` array, enabling the `WithPermissions` wrapper to render mutating affordances. `DISABLED` makes the UI render no buttons (empty permissions) BUT the BACKEND endpoints accept anonymous mutations regardless — see `known_security_gaps` for the UI-vs-API asymmetry. `S2S` is NOT relevant (S2S is server-to-server only; no S2S caller would render this React component).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. CollectorsList lives at `/management/collectors` and calls `/api/collectors/*` endpoints — none of these are covered by the `IngestionDataEntitiesFilter` (which matches only `POST /ingestion/entities`) nor by the `IngestionDataSourceFilter` (which matches `POST /ingestion/datasources`). This component is the AUTHORING surface for the credential those filters consume, not a participant in the ingestion path itself.
- **authorization_assertions**:
  - "`<WithPermissions permissionTo={Permission.COLLECTOR_CREATE}>` wraps the Add collector button" — evidence: CollectorsList.tsx:91-101
  - "`<WithPermissions permissionTo={Permission.COLLECTOR_UPDATE}>` wraps the Edit button" — evidence: CollectorItem.tsx:39-51
  - "`<WithPermissions permissionTo={Permission.COLLECTOR_DELETE}>` wraps the Delete button" — evidence: CollectorItem.tsx:52-70
  - "`<WithPermissions permissionTo={Permission.COLLECTOR_TOKEN_REGENERATE}>` wraps the Regenerate button (only rendered when the token is masked)" — evidence: CollectorItemToken.tsx:36-50
  - "All four UI-side gates are MIRRORS of the backend SECURITY_RULES at SecurityConstants.java:127-137 — same permission names, same path/method coverage. Verified by direct read of both layers; matches the maintainer's "UI permission-gate parity with SECURITY_RULES" convention."
- **owner_scoping**: `N/A — Collector is a global resource, not data-scoped`. There is no per-collector Owner association in the data model; the four `COLLECTOR_*` permissions are MANAGEMENT-tier and gate the resource type globally. A user with `COLLECTOR_CREATE` can register collectors in any namespace; a user with `COLLECTOR_DELETE` can delete any collector.
- **data_exposure**:
  - "Full 40-char plaintext token rendered as a DOM text node → any caller with `COLLECTOR_CREATE` or `COLLECTOR_TOKEN_REGENERATE` permission immediately after a create/regenerate action, before the next page reload"
  - "Collector descriptive metadata (id, name, namespace.name, description, token mask `******{last6}`, createdAt, updatedAt) rendered into the list view → any caller able to load the `/management/collectors` route (the route mount itself is not permission-gated in this file; the LIST is visible regardless of COLLECTOR_* permissions, only the MUTATION actions are gated)"
  - "Under DISABLED, the list endpoint `GET /api/collectors/list` is anonymously reachable (no IngestionFilter, no SECURITY_RULES enforcement) → an anonymous network probe under DISABLED can enumerate every registered collector's `(id, name, namespace, ******{last6}, createdAt)`. The last-6-chars of the token are exposed even on the masked path; combined with knowledge of the prefix's character set (`RandomStringUtils.randomAlphanumeric`), this narrows the token search space by 6 chars but the remaining 34 chars are still computationally infeasible. Still — last-6-chars exposure on a masked-token render is an information leak worth surfacing."
- **known_security_gaps**:
  - "**UI-vs-API asymmetry under DISABLED**: the UI hides Add / Edit / Delete / Regenerate buttons (because `/api/identity` returns empty permissions under DISABLED) while the BACKEND endpoints accept anonymous mutations (DisabledAuthSecurityConfiguration bypasses SECURITY_RULES). Operators may infer 'this deployment is locked down' from the UI's read-only appearance and miss the fact that direct REST calls succeed. **This is the 19th sidecar contribution to REFACTOR-185** — the COLLECTOR_* permission family was not in the prior 18-sidecar enumeration." — evidence: CollectorsList.tsx:91-101 + CollectorItem.tsx:39, :52 + WithPermissions.tsx:11-32 + DisabledAuthSecurityConfiguration.java:11-19 + SecurityConstants.java:127-137 — severity: HIGH
  - "**Token plaintext rendered into DOM as text node** — no `<input type='password'>` obfuscation, no Reveal-on-hover affordance, no auto-hide timer. The visible warning admonition ('Save token in a secure location. You will not be able to retrieve it again.') is the sole operational mitigation. Browser extensions / screenshot tools / accessibility readers capture the credential by default." — evidence: CollectorItemToken.tsx:34 — severity: MEDIUM
  - "**Token-visibility detection is a literal substring prefix sniff (`'******'`)** — a backend mask-format change would silently break detection. No regex, no version negotiation with the backend, no automated test guarding the contract." — evidence: CollectorItemToken.tsx:25-27 + TokenMapper.java:15-18 — severity: MEDIUM
  - "**No UI warning that rotation has no grace period** — operators rotating during active ingestion lock themselves out until collectors pick up the new token. The ConfirmationDialog reads only 'Are you sure?' — does not surface the 401-on-old-token consequence." — evidence: CollectorItemToken.tsx:38-49 (dialog text) + the existing CollectorController.regenerateCollectorToken.md `bugs_limitations_corner_cases[0]` — severity: MEDIUM
  - "**No UI warning that token rotation has no security effect when `auth.ingestion.filter.enabled=false`** — the platform's default deployment. Rotating a leaked token on a default deployment is a no-op against `POST /ingestion/entities`, which is anonymously reachable regardless. The UI promises a security property the default does not enforce. Compounds with the IngestionDataEntitiesFilter default-OFF finding (16th-sidecar contribution to REFACTOR-185 per batch O)." — evidence: CollectorItemToken.tsx:34 + application.yml:48 + IngestionDataEntitiesFilter.md `bugs_limitations_corner_cases[0]` — severity: HIGH
  - "**Anonymous list-enumeration under DISABLED leaks last-6-chars of every token** — `GET /api/collectors/list` is not in SECURITY_RULES (read access is collaborative across the platform), and the response masks tokens as `******{last6}`. An anonymous probe under DISABLED enumerates every collector's name + namespace + last-6-token-chars. The last-6-chars exposure is small (≈ 36 bits weakened from the 40-char total) but is unnecessary information disclosure for a credential mask." — evidence: SecurityConstants.java (no /api/collectors GET rule — read-collaborative pattern; REFACTOR-024 family) + TokenMapper.java:15-18 (mask format includes last-6-chars) — severity: MEDIUM

## performance

- **hot_paths**:
  - "Initial mount fires `fetchCollectorsList({page: 1, size: 30})` (CollectorsList.tsx:44-46). One DB round-trip per mount." — evidence: CollectorsList.tsx:44-46
  - "Each delete causes the dep-array effect to re-fire and refetch page 1 (CollectorsList.tsx:46 includes `isCollectorDeleting` in deps). On a list with thousands of collectors, delete-of-page-5-collector silently rewinds to page-1 view. Operator UX: confusing." — evidence: CollectorsList.tsx:44-46
  - "Search input fires `handleSearch` debounced 500ms (CollectorsList.tsx:52-57); each invocation fires a new `fetchCollectorsList` thunk. No request cancellation — stale responses can resolve out-of-order if the user types fast then pauses." — evidence: CollectorsList.tsx:52-66
- **throughput_characteristics**:
  - "Page size hardcoded 30 (CollectorsList.tsx:40). No operator-configurable page size."
  - "Infinite scroll via react-infinite-scroll-component — appends pages, never collapses. A long browsing session can hold the entire collector list in browser memory."
- **resource_allocation**:
  - "DOM nodes scale linearly with `collectorsList.length` — each collector renders a `CollectorItem` card (header + 3 LabeledInfoItems + optional warning admonition). For platforms with hundreds of collectors browsed via infinite scroll, the DOM payload is non-trivial but bounded by operator scroll behaviour."
  - "Token strings are 40 chars (visible) or `******{last6}` = 12 chars (masked). Memory footprint negligible."
- **scaling_characteristics**:
  - "Stateless React component — no shared state across instances (each mount has its own `useState`). Multiple operators concurrently editing the same collector via the UI race on the optimistic-update path — last writer wins (no `If-Match` ETag on the PUT)."
  - "Pagination state lives in redux (`state.collectors.pageInfo`) and is reset on every empty-query effect re-fire (CollectorsList.tsx:44-46) — scroll position lost on search-clear."
- **known_performance_gaps**:
  - "No request cancellation on debounced search — fast typing followed by a pause can resolve responses out-of-order; the redux reducer wholesale-replaces the list with the most recently RESOLVED response, not the most recently DISPATCHED. Race window is the difference between two sequential debounced fetches' resolution times." — evidence: CollectorsList.tsx:52-57 + collectors.thunks.ts:14-29 (no AbortController) — severity: LOW
  - "Delete-of-collector-on-page-N silently rewinds to page-1 view because the effect at :44-46 re-runs on `isCollectorDeleting` flip. Operator loses scroll position with no UI signal." — evidence: CollectorsList.tsx:44-46 — severity: LOW

## sources

- understanding ← CollectorsList.tsx:1-128 + CollectorForm.tsx:1-152 + CollectorItem.tsx:1-104 + CollectorItemToken.tsx:1-58 + CollectorController.java:14-52 + SecurityConstants.java:127-137
- concepts.entities.Collector ← CollectorsList.tsx:5 (`type Collector` import via generated-sources) + Collector.java contract model
- concepts.entities.Token ← CollectorItemToken.tsx:34 (`<Token>{collector.token.value}</Token>`) + TokenMapper.java:15-18 (backend mask format)
- concepts.entities.Redux-state ← CollectorsList.tsx:6-11 (selectors)
- concepts.entities.CollectorFormData ← CollectorForm.tsx:38-44
- concepts.operations.list-collectors-paginated ← CollectorsList.tsx:40, :105-110
- concepts.operations.search-collectors-debounced ← CollectorsList.tsx:52-57
- concepts.operations.detect-masked-token-by-prefix ← CollectorItemToken.tsx:26
- concepts.invariants.[0] Permission-gating ← CollectorsList.tsx:91-101 + CollectorItem.tsx:39, :52 + CollectorItemToken.tsx:36
- concepts.invariants.[1] Token visibility one-shot ← CollectorItemToken.tsx:25-27 + CollectorItem.tsx:87-98 + TokenMapper.java:15-18
- concepts.invariants.[2] Substring-prefix sniff ← CollectorItemToken.tsx:26
- concepts.invariants.[3] Dep-array shape ← CollectorsList.tsx:44-46
- concepts.invariants.[4] LSN-017 negative finding ← CollectorsList.tsx:44-46 + :48-50 (negative result — no fetch-result→re-fetch loop)
- dependencies_semantic.requires-feature ← CollectorController.java:14-52 + collectors.thunks.ts:14-91 + WithPermissions.tsx:11-32 + sibling files in `CollectorsList/` directory
- dependencies_semantic.requires-config ← application.yml:48 (filter default false) + application.yml:32-34 (auth.type default DISABLED) + SecurityConstants.java:127-137
- dependencies_semantic.coupling.UI-vs-API-asymmetry ← WithPermissions.tsx:11-32 + DisabledAuthSecurityConfiguration.java:11-19 + SecurityConstants.java:127-137
- dependencies_semantic.coupling.token-visibility-flip ← CollectorItemToken.tsx:25-27 + CollectorItem.tsx:87-98
- dependencies_semantic.coupling.search-clear-rewinds ← CollectorsList.tsx:44-46 + :59-62
- tests_coverage_semantic.test_files ← glob result on `**/CollectorsList/**/*.test.{ts,tsx}` returned zero matches (verified 2026-05-20)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/features/management (status 200) — collectors-tab description
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200) — COLLECTOR_* permissions listed under Management tier
- docs_link_semantic.doc_drift_findings.[0,1,2,3] ← WebFetch results above + cross-reference against IngestionDataEntitiesFilter.md + CollectorController.regenerateCollectorToken.md + REFACTOR-185.md
- implicit_adrs[0] Token-visibility-by-substring ← CollectorItemToken.tsx:25-27 + TokenMapper.java:15-18
- implicit_adrs[1] WithPermissions-universal-wrapper ← CollectorsList.tsx:91-101 + CollectorItem.tsx:39, :52 + CollectorItemToken.tsx:36 + WithPermissions.tsx:11-32
- implicit_adrs[2] Server-driven-token-issuance ← CollectorForm.tsx:38-44 + CollectorController.java:28-31
- bugs_limitations_corner_cases[0] Substring-prefix-sniff fragility ← CollectorItemToken.tsx:25-27 + TokenMapper.java:15-18
- bugs_limitations_corner_cases[1] UI-vs-API asymmetry under DISABLED (REFACTOR-185 19th facet) ← CollectorsList.tsx:91, :101 + WithPermissions.tsx:11-32 + DisabledAuthSecurityConfiguration.java:11-19 + SecurityConstants.java:127-137
- bugs_limitations_corner_cases[2] Plaintext-in-DOM ← CollectorItemToken.tsx:34
- bugs_limitations_corner_cases[3] No-grace-period UI silence ← CollectorItemToken.tsx:38-49 + CollectorController.regenerateCollectorToken.md `bugs_limitations_corner_cases[0]`
- bugs_limitations_corner_cases[4] Rotation has no effect when filter disabled ← CollectorItemToken.tsx:34 + IngestionDataEntitiesFilter.md `bugs_limitations_corner_cases[0]` + application.yml:48
- bugs_limitations_corner_cases[5,6] dispatch-missing-from-deps ← CollectorsList.tsx:44-46, :52-57
- bugs_limitations_corner_cases[7] Search-clear rewinds pagination ← CollectorsList.tsx:44-46 + :59-62
- bugs_limitations_corner_cases[8] `size` in deps but constant ← CollectorsList.tsx:40, :46, :50, :57
- bugs_limitations_corner_cases[9] useCallback + useDebouncedCallback composition ← CollectorsList.tsx:52-57
- bugs_limitations_corner_cases[10] LSN-017 NEGATIVE finding ← CollectorsList.tsx:44-46, :48-50
- security.auth_mode_relevance ← WithPermissions.tsx:11-32 + DisabledAuthSecurityConfiguration.java:11-19 + SecurityConstants.java:127-137
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 + IngestionDataSourceFilter.java:15-20 (path matchers do not cover /api/collectors/*)
- security.authorization_assertions ← CollectorsList.tsx:91, :101 + CollectorItem.tsx:39, :52 + CollectorItemToken.tsx:36 + SecurityConstants.java:127-137
- security.owner_scoping ← SecurityConstants.java:127-137 (uses NO_CONTEXT, not entity-context) + COLLECTOR table schema (no owner_id FK)
- security.data_exposure ← CollectorItemToken.tsx:34 + TokenMapper.java:15-18 + read-collaborative posture (REFACTOR-024 family)
- security.known_security_gaps[0] UI-vs-API asymmetry (REFACTOR-185 19th facet) ← CollectorsList.tsx:91-101 + WithPermissions.tsx:11-32 + DisabledAuthSecurityConfiguration.java:11-19 + SecurityConstants.java:127-137
- security.known_security_gaps[1] Plaintext-in-DOM ← CollectorItemToken.tsx:34
- security.known_security_gaps[2] Substring-sniff fragility ← CollectorItemToken.tsx:25-27
- security.known_security_gaps[3] No-grace-period UI silence ← CollectorItemToken.tsx:38-49
- security.known_security_gaps[4] Rotation-no-effect-under-default ← CollectorItemToken.tsx:34 + application.yml:48
- security.known_security_gaps[5] Anonymous list-enumeration last-6-chars leak ← SecurityConstants.java + TokenMapper.java:15-18
- performance.hot_paths ← CollectorsList.tsx:44-46, :52-66
- performance.throughput_characteristics ← CollectorsList.tsx:40, :105-110
- performance.scaling_characteristics ← CollectorsList.tsx (stateless component)
- performance.known_performance_gaps ← CollectorsList.tsx:52-57 + collectors.thunks.ts:14-29

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## back_links

- pillar: P-08 (Management & Administration) — this component is the rendered UI for the "Collectors tab" sub-feature enumerated in system-mission.md P-08 sub-feature seed
- pillar: P-09 (Security & Access Control) — UI-side enforcement of COLLECTOR_* permissions; partner of the SECURITY_RULES backend gating
- pillar: P-10 (Integrations & Ingestion) — the issued tokens are the credentials consumed by IngestionDataSourceFilter (always-on) and IngestionDataEntitiesFilter (opt-in)
- feature: F-008 (P-10:F-001 Batch Ingestion) — this UI mints the credential the ingestion path validates; the token is the bridge between Management and Ingestion
- feature: F-019 (P-08:F-003 Owner Lifecycle Management) — sibling Management surface; same WithPermissions wrapper pattern, same UI-vs-API asymmetry concern under DISABLED
- refactoring-scope: REFACTOR-185 (DISABLED-mode bypass) — this sidecar adds the **19th supporting sidecar** to the catalog's strongest finding; the COLLECTOR_* permission family is a NEW facet (was not in the 16/17/18-sidecar enumerations). The compound surface under default `auth.type=DISABLED`: anyone on the network can `POST /api/collectors` (no UI signal), copy the response token, and (per ADR-CANDIDATE-141) `POST /ingestion/datasources` with that token to bootstrap a hostile collector identity — the DISABLED-mode bypass extends through the ENTIRE collector boot-of-self chain.
- implicit-adr: ADR-CANDIDATE-140 (asymmetric ingestion postures) — this UI is the authoring surface for the credential consumed by the always-on `IngestionDataSourceFilter` AND the opt-in `IngestionDataEntitiesFilter`. The UI gives no signal that the SAME token participates in TWO different auth postures — operators rotating a "leaked token" affect both paths simultaneously, but the docs and UI treat the token as a single thing.
- implicit-adr: ADR-CANDIDATE-141 (collector identity via WebSession attribute) — this UI mints the token that, when used at `POST /ingestion/datasources`, becomes the WebSession-attribute-keyed identity for that collector. The fragility of stringly-typed `COLLECTOR_ID_SESSION_KEY` is downstream of the credential this UI hands out.
- implicit-adr: ADR-CANDIDATE-142 (datasource registration partial-merge) — this UI is the FRONT END of the collector lifecycle; collectors issued here are the only entities that can use the partial-merge upsert semantic.
- sidecar (backend): CollectorController.regenerateCollectorToken (`odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md`) — the backend counterpart of the Regenerate button at CollectorItemToken.tsx:36-50
- sidecar (backend): IngestionDataEntitiesFilter (`odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md`) — the consumer of tokens minted via this UI
- sidecar (backend): IngestionController.createDataSourceEntity (`odd-platform__java__IngestionController__controller-method__createDataSourceEntity.md`) — the OTHER consumer (always-on filter path) of tokens minted via this UI
- doc-gap: DOC-GAP-NNN (NEW candidate) — Management → Collectors page is silent on: (a) one-shot token visibility / no-recover-without-rotate, (b) no-grace-period rotation semantic, (c) `auth.ingestion.filter.enabled=false` default neutralising token security on the `/ingestion/entities` path, (d) UI-vs-API asymmetry under DISABLED. To be filed via `follow-up-on-disk.md` after the maintainer's batch-Q review.
- retrospective: LSN-017 (per-node scans cannot see cross-layer effects) — this sidecar contains an EXPLICIT NEGATIVE FINDING (bugs_limitations_corner_cases[10]) stating the LSN-017 dep-array shape is ABSENT in this component, so future scans need not re-investigate.

## coherence_check

- **strengthens**: REFACTOR-185 (now 18→19 SIDECAR via the COLLECTOR_* UI-side permission family observation); ADR-CANDIDATE-140 (the asymmetric ingestion postures finding gains a UI-axis source — the UI hands out one credential that two different filters consume); IngestionDataEntitiesFilter sidecar's `bugs_limitations_corner_cases[0]` (the rotation-no-effect-on-default-deployment compound surface).
- **supersedes**: none.
- **conflicts_surfaced**: none material — the Management doc page's silence on operational caveats is a doc-gap, not a code-vs-code contradiction.
- **new findings authored**: (1) UI-vs-API asymmetry under DISABLED for COLLECTOR_* permissions (NEW facet of REFACTOR-185); (2) Token-visibility detection via fragile substring-prefix sniff (NEW implicit ADR + bug); (3) Token rotation has no UI-side warning about no-grace-period AND no security effect on default deployment (NEW HIGH-severity UX gap); (4) Explicit LSN-017 NEGATIVE finding for this dep-array shape.

## Maintainer notes

