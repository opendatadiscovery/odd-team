---
node_id: "odd-platform ts react-component component:DataSourceItemToken"
node_kind: react-component
axis: ui-components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-22-batch-datasource-ui-reanalysis-DataSourceItemToken
---

# DataSourceItemToken — semantic understanding

## understanding

`DataSourceItemToken` (`DataSourceItemToken.tsx:17-58`) is the connection-token
control inside one data-source row of the Management → Datasources tab — the
collector ingestion credential as the operator sees and acts on it. From the
operator's seat it is a single inline string plus exactly one button. The
string is `dataSource.token.value` rendered verbatim (`DataSourceItemToken.tsx:34`);
the button is EITHER a **"Regenerate"** action (when the value is the masked
`******`+last-6 form the list endpoint returns) OR a **"Copy"** action (when the
value is the full 40-char plaintext a register/regenerate response returns). The
component decides which by a `useEffect` (`DataSourceItemToken.tsx:25-27`) that
sets the parent-owned `isHidden` flag to `true` when `token.value.substring(0,6)
=== '******'` — i.e. the masked/plaintext distinction is inferred from the string
prefix, not from a typed field. "Regenerate" is permission-gated
(`Permission.DATA_SOURCE_TOKEN_REGENERATE`, `DataSourceItemToken.tsx:36`) and
wrapped in a `ConfirmationDialog` that asks "Are you sure you want to regenerate
token for this datasource?" before dispatching the `regenerateDataSourceToken`
redux thunk (`DataSourceItemToken.tsx:29-30`) → `PUT /api/datasources/{id}/token`.
On success the thunk's slice handler `upsertOne`s the response (carrying the new
**plaintext** token) into the store; the row re-renders, `isHidden` recomputes to
`false`, and the operator sees the new plaintext token with a Copy button — the
one and only time the plaintext is visible, until the next list fetch re-masks it.

## concepts

- entities:
  - "DataSource (the generated-sources model passed in as the `dataSource` prop; `DataSourceItemToken.tsx:4,12` — this component reads only `dataSource.token.value`, `dataSource.id`, `dataSource.name`)"
  - "token.value (the string the component renders verbatim; `DataSourceItemToken.tsx:34` — its first 6 chars `'******'` is the masked/plaintext discriminator)"
  - "isHidden (a boolean LIFTED to the parent `DataSourceItem` via `useState`; this component receives `isHidden` + `setIsHidden` as props and both READS and WRITES it — `DataSourceItemToken.tsx:13-14,19-20,26`)"
  - "Permission.DATA_SOURCE_TOKEN_REGENERATE (the RBAC capability gating the Regenerate affordance; `DataSourceItemToken.tsx:4,36`)"
  - "regenerateDataSourceToken thunk (the redux action dispatched on confirm; `DataSourceItemToken.tsx:5,30`)"
- operations:
  - "render-token-string (`DataSourceItemToken.tsx:34` — show `token.value` in a styled `<Token>` box; background colour switches on `$isHidden` — transparent when masked, `entityClass.DATA_INPUT` tint when plaintext, per `DataSourceItemTokenStyles.ts:8-18`)"
  - "infer-masked-state (`DataSourceItemToken.tsx:25-27` — `useEffect` keyed on `token.value`; sets `isHidden` from the `'******'` prefix test)"
  - "regenerate-token (masked branch — `DataSourceItemToken.tsx:35-50`: a `ConfirmationDialog` whose confirm callback dispatches `regenerateDataSourceToken({ dataSourceId })`)"
  - "copy-token (plaintext branch — `DataSourceItemToken.tsx:51-53`: a `CopyButton` whose `stringToCopy` is the plaintext `token.value`)"
- invariants:
  - "Exactly one of {Regenerate, Copy} is shown at a time — the `isHidden` ternary (`DataSourceItemToken.tsx:35-53`) is mutually exclusive. There is no show/hide toggle and no simultaneous reveal+copy."
  - "Regenerate is only reachable when the token is MASKED (`isHidden === true`). Once the token is plaintext (just regenerated, or registered) the Regenerate button is GONE — the operator can only Copy. To regenerate again the operator must reload the list (which re-masks the value)."
  - "Copy is only reachable when the token is PLAINTEXT. A masked `******`+last6 string is never offered for copy — which is correct, copying a masked value would be useless."
  - "The Regenerate affordance is hidden entirely (not disabled) for a user lacking `DATA_SOURCE_TOKEN_REGENERATE` — `WithPermissions` renders `null` when `hasAccessTo` is false (`WithPermissions.tsx:27-29`). Such a user sees the masked token and NO button at all in that branch."
  - "The confirmation dialog's body text names the datasource (`Regenerate token for \"{name}\"?`, `DataSourceItemToken.tsx:42-46`) but states NOTHING about consequences — no mention that the old token stops working, that ingestion breaks, or that there is no grace period."
- audiences:
  - "platform-operator — rotates a leaked or scheduled-rotation collector credential from the Management → Datasources tab; reads the new plaintext token off the screen once and copies it into the collector's config"
  - "odd-platform-ui-end-user — any authenticated user who can reach the Datasources tab sees every data source's masked token; only a `DATA_SOURCE_TOKEN_REGENERATE` holder sees the Regenerate button"

## dependencies_semantic

- requires-feature:
  - "`regenerateDataSourceToken` redux thunk (`redux/thunks` barrel → `datasources.thunks.ts:64-77`) — a `handleResponseAsyncThunk` wrapping `dataSourceApi.regenerateDataSourceToken({ dataSourceId })`; on success it fires a success toast `Datasource's token successfully regenerated.` (`datasources.thunks.ts:72-75` + `handleResponseThunk.ts:28-31`)."
  - "`ConfirmationDialog` shared element (`components/shared/elements` barrel → `ConfirmationDialog/ConfirmationDialog.tsx`) — renders the action button as the dialog's open-trigger and runs `onConfirm` with a loading spinner; swallows rejection (`ConfirmationDialog.tsx:33` — `.catch(() => {})`)."
  - "`CopyButton` shared element (`CopyButton/CopyButton.tsx`) — writes `stringToCopy` to `navigator.clipboard`; shows a transient `Copied!` / `Copy error` state for `msDelay` (default 3000ms)."
  - "`WithPermissions` context component (`components/shared/contexts` barrel → `Permission/WithPermissions.tsx`) — renders children only if `usePermissions().hasAccessTo(permissionTo)` is true; otherwise `null`."
  - "`Button` shared element + `Token`/`TokenContainer` styled-components (`DataSourceItemTokenStyles.ts:4-18`)."
  - "`useAppDispatch` (`redux/lib/hooks`) and `useTranslation` (`react-i18next`) — store dispatch and i18n string resolution."
- requires-config:
  - "auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — INDIRECT: under the 3 authenticated modes `usePermissions()` resolves the signed-in user's policy; under DISABLED there is no user, so whether `hasAccessTo(DATA_SOURCE_TOKEN_REGENERATE)` returns true is determined by the DISABLED-mode permission stance (the backend `regenerateDataSourceToken` sidecar records that under DISABLED the SecurityConstants gate is bypassed entirely)."
- requires-runtime:
  - "React 18 + redux-toolkit store — the component is a function component using `useEffect`, `useAppDispatch`; the thunk result flows back through `datasources.slice.ts:41-43` (`upsertOne`)."
  - "`navigator.clipboard` — the Copy branch needs the Clipboard API; `CopyButton.tsx:41-49` has a non-clipboard fallback that surfaces `Copy error`."
- coupling:
  - "STRING-PREFIX coupling to the backend mask format: this component's entire masked/plaintext decision is `token.value.substring(0,6) === '******'` (`DataSourceItemToken.tsx:26`). It is hard-coupled to the backend `TokenMapper.mapValue` producing a literal 6-asterisk prefix (`TokenMapper.java:15-18`, per the `getDataSourceList` backend sidecar). If the backend mask string ever changes (5 or 7 asterisks, a different placeholder), this component silently mis-classifies the token and shows the wrong button."
  - "STATE-LIFT coupling to the parent `DataSourceItem`: `isHidden` is owned by `DataSourceItem` (`DataSourceItem.tsx:29` `useState(true)`); this child both reads it and sets it. The parent uses the SAME flag to render the destructive warning banner `Save token in a secure location. You will not be able to retrieve it again.` (`DataSourceItem.tsx:110-121`). The warning is a SIBLING render, not part of this component."
  - "THUNK-to-SLICE coupling: `regenerateDataSourceToken.fulfilled` → `datasourceAdapter.upsertOne(state, payload)` (`datasources.slice.ts:41-42`). The payload carries the new PLAINTEXT token; the upsert replaces the row, the prop flows back in, the `useEffect` recomputes `isHidden=false` — this is the mechanism that flips the UI from Regenerate to Copy after a successful rotation."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Masked-state render: given a `token.value` starting with `******`, the component shows the Regenerate button (permission present) and NOT the Copy button."
    test_class: unit
    criticality: HIGH
    note: "No test file exists for this component (Glob-verified — `**/DataSourceItemToken*` returns only the component + its Styles)."
  - behaviour: "Plaintext-state render: given a 40-char `token.value` with no `******` prefix, the component shows the Copy button and NOT the Regenerate button."
    test_class: unit
    criticality: HIGH
    note: "The post-rotation operator state — verifying the Regenerate affordance disappears once the token is plaintext."
  - behaviour: "Permission gating: a user WITHOUT `DATA_SOURCE_TOKEN_REGENERATE` sees the masked token and NO button (WithPermissions renders null); a user WITH it sees the Regenerate button."
    test_class: security
    criticality: HIGH
    note: "WithPermissions.tsx:27-29 returns null when hasAccessTo is false; no test asserts the UI honours this for the token control."
  - behaviour: "Confirm-flow: clicking Regenerate opens the ConfirmationDialog; confirming dispatches regenerateDataSourceToken with the correct dataSourceId; cancelling/closing dispatches nothing."
    test_class: integration
    criticality: HIGH
    note: "The dialog is the only thing standing between an accidental click and a destructive in-place token rotation — pinned by probe P-082."
  - behaviour: "Post-rotation transition: after the thunk fulfils, the row's token.value becomes plaintext, isHidden recomputes to false, the UI swaps Regenerate→Copy, and DataSourceItem renders the 'save it, you cannot retrieve it again' warning."
    test_class: integration
    criticality: HIGH
    note: "The full UI cutover across component + parent + slice — pinned by probe P-083."
  - behaviour: "useEffect dependency-array correctness: the effect at DataSourceItemToken.tsx:25-27 lists `[dataSource.token.value]` but reads `setIsHidden` (a stable prop). Confirm the masked-state recompute fires on every token.value change and does not stale."
    test_class: unit
    criticality: MEDIUM
    note: "react-hooks/exhaustive-deps would flag setIsHidden as a missing dep; setIsHidden from useState is referentially stable so it is harmless — but unverified."
  - behaviour: "Copy action: clicking Copy in the plaintext branch writes the full 40-char plaintext token to the clipboard and shows the transient 'Copied!' state."
    test_class: integration
    criticality: MEDIUM
    note: "CopyButton.tsx:30-50 — the clipboard write and the 3000ms revert."
- test_files:
  - "NO file named DataSourceItemToken.test.* / .spec.* exists (Glob-verified at commit 80637ed — the directory holds only DataSourceItemToken.tsx + DataSourceItemTokenStyles.ts)."
  - "NO test for the parent DataSourceItem.tsx (Grep `DataSourceItem` returns only the two source files)."
- gaps: |
    The token control has ZERO test coverage at every class. The worst-covered
    and highest-leverage class is `security`/`integration` jointly: there is no
    test that (a) the Regenerate button is hidden for a user without the
    permission, and (b) the ConfirmationDialog actually intercepts the click
    before the destructive thunk fires. Because the masked/plaintext branch is
    decided by a fragile string-prefix test (`substring(0,6) === '******'`), a
    unit test pinning both render branches is the cheapest regression guard —
    a backend mask-format change would otherwise silently flip the UI to offer
    Copy on a useless masked string, or Regenerate on a live plaintext token.
    The single most operationally important uncovered behaviour is the
    confirm-flow integration test (P-082): it protects the only barrier between
    a mis-click and an irreversible credential rotation that locks out a running
    collector.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Management → Datasources tab this component lives in. WebFetched 2026-05-22 status 200. The page mentions a 'partially-redacted Collector token with a Regenerate action' but is SILENT on the regeneration interaction model — no confirmation dialog, no warning, no copy affordance, no 'save it once' message."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-22 (status 200). On token display, verbatim figure caption:
      "each card showing the source's ODDRN, description, namespace, and a
      partially-redacted Collector token with a Regenerate action."
      On the Regenerate action: the fetch reports verbatim "The page does not
      mention any confirmation dialog, warning about immediate token invalidation,
      grace period, or message indicating the token cannot be retrieved again."
      On copy-to-clipboard: "The page makes no mention of a copy-to-clipboard
      feature for the token."
- doc_drift_findings:
  - "The management doc page (WebFetched 2026-05-22, status 200) shows the Regenerate affordance but documents NONE of the actual UI behaviour this component implements: (a) there IS a confirmation dialog ('Are you sure you want to regenerate token for this datasource?', DataSourceItemToken.tsx:38-40) — an undocumented safety affordance; (b) after regeneration the new token is shown in PLAINTEXT with a Copy button and a one-time 'Save token in a secure location. You will not be able to retrieve it again.' warning (DataSourceItem.tsx:110-121) — an undocumented one-time-reveal model; (c) the confirmation dialog text gives the operator NO warning that the old token stops working immediately and breaks any running collector. The doc should describe the one-time-reveal + copy flow and the destructive consequence."
  - "The confirmation dialog itself is an in-product doc gap: it asks 'Are you sure?' but the body text (DataSourceItemToken.tsx:42-46) names only the datasource — it does not say 'this immediately invalidates the current token; any collector still using it will stop ingesting until reconfigured.' The destructive consequence the batch-ZB backend sidecar flagged (in-place rotation, no grace period) is not surfaced to the operator at the point of decision."

## implicit_adrs

- "Token visibility is inferred from the rendered string's prefix, not carried as a typed field — `isHidden = token.value.substring(0,6) === '******'`" — evidence: DataSourceItemToken.tsx:25-27 — intent_anchor: "setIsHidden(dataSource.token.value.substring(0, 6) === '******')" — the component deliberately derives state from the masked-string sentinel the backend emits rather than reading a `showToken`-style boolean; the `DataSource` generated model exposes only `token.value`, so the UI has no typed signal and the prefix test is the chosen contract — confidence: MEDIUM (the code shows the choice; whether a typed field was considered and rejected is not evidenced in the file)
- "The Regenerate affordance is HIDDEN, not disabled, for unauthorized users — consistent `WithPermissions`-wraps-the-control pattern" — evidence: DataSourceItemToken.tsx:35-50 (the `ConfirmationDialog`+`Button` is inside `<WithPermissions permissionTo={Permission.DATA_SOURCE_TOKEN_REGENERATE}>`) + DataSourceItem.tsx:44,57 (the sibling Edit and Delete actions use the identical `WithPermissions`-wrap pattern) — intent_anchor: the same `WithPermissions` wrapper encloses Edit (DATA_SOURCE_UPDATE), Delete (DATA_SOURCE_DELETE) and Regenerate (DATA_SOURCE_TOKEN_REGENERATE) across DataSourceItem + DataSourceItemToken — a consistently-applied convention that capability-gated buttons vanish rather than grey out — confidence: HIGH
- "Token regeneration is confirmed via a dialog before dispatch — destructive mutations on the Datasources surface route through ConfirmationDialog" — evidence: DataSourceItemToken.tsx:37-49 (Regenerate wrapped in `ConfirmationDialog`) + DataSourceItem.tsx:58-74 (Delete wrapped in the identical `ConfirmationDialog`) — intent_anchor: both destructive datasource actions (Delete, Regenerate-token) use `ConfirmationDialog` while the non-destructive Copy and the Edit-form do not — the pattern encodes "irreversible action ⇒ confirm step"; this is the UX mitigation of the backend's no-grace-period rotation — confidence: HIGH

## bugs_limitations_corner_cases

- "The confirmation dialog warns 'Are you sure?' but does NOT warn about the consequence. Its body text (DataSourceItemToken.tsx:42-46) is `Regenerate token for \"{name}\"?` — it never tells the operator that regeneration is a destructive in-place rotation that immediately kills the old token and that any collector still presenting the old token will start failing ingestion with no grace period (the backend behaviour confirmed in the regenerateDataSourceToken batch-ZB sidecar). The dialog MITIGATES an accidental click but does NOT inform an intentional one — an operator who knowingly clicks Regenerate gets no warning that they are about to break a running pipeline." — evidence: DataSourceItemToken.tsx:37-49 (dialog content) — severity: HIGH
- "Masked/plaintext detection is a fragile string-prefix heuristic: `token.value.substring(0,6) === '******'` (DataSourceItemToken.tsx:26). It is hard-coupled to the backend `TokenMapper.mapValue` emitting EXACTLY 6 asterisks. (a) If the backend mask format changes, the UI mis-classifies — offering Copy on a useless masked string, or Regenerate on a live plaintext token. (b) A pathological real token whose first 6 plaintext chars are literally `******` would be mis-detected as masked (negligible probability with a 40-char alphanumeric token — `RandomStringUtils.randomAlphanumeric` per the backend sidecar — asterisk is not in the alphabet, so this sub-case cannot actually occur; the format-coupling in (a) is the live risk)." — evidence: DataSourceItemToken.tsx:26 + TokenMapper.java:15-18 (cited via the getDataSourceList backend sidecar) — severity: MEDIUM
- "The new plaintext token is one-time-reveal with no explicit copy prompt at the moment it appears. After a successful regeneration the row swaps to the plaintext token + a Copy button, and the PARENT renders the warning 'Save token in a secure location. You will not be able to retrieve it again.' (DataSourceItem.tsx:110-121). But if the operator navigates away or the list refetches before copying, the value re-masks and is unrecoverable — they must regenerate AGAIN (another destructive rotation) to get a usable token. The UI does not auto-copy, does not focus the Copy button, and does not block navigation." — evidence: DataSourceItemToken.tsx:25-27,51-53 + DataSourceItem.tsx:110-121 + datasources.slice.ts:41-42 (upsertOne replaces the row) — severity: MEDIUM
- "No optimistic-UI or in-flight disabling on the token control itself. The `ConfirmationDialog` shows a loading spinner while `onConfirm` is pending (ConfirmationDialog.tsx:24-35), which blocks a double-confirm WITHIN one open dialog. But nothing prevents the operator from closing the dialog and immediately re-opening it, or the masked Regenerate button from being clicked again before the store updates. The backend PUT is not idempotent (regenerateDataSourceToken backend sidecar) — a rapid second rotation invalidates the token the first response returned before the operator copies it." — evidence: DataSourceItemToken.tsx:29-30 (bare dispatch, no pending guard) + ConfirmationDialog.tsx:24-35 (spinner is dialog-scoped) — severity: MEDIUM
- "Thunk rejection is partly swallowed at the dialog layer. `ConfirmationDialog.onClose` does `action().then(...).catch(() => {})` (ConfirmationDialog.tsx:28-33) — on a failed regeneration the dialog simply does NOT close and clears its spinner via the unmount effect. The user-facing error DOES still surface, because `handleResponseAsyncThunk` calls `showServerErrorToast` on catch (handleResponseThunk.ts:34-39) before the thunk's promise rejects — so the operator sees an error toast. But the dialog staying open with no inline error is a mild UX rough edge: the operator may not connect the toast to the still-open dialog." — evidence: ConfirmationDialog.tsx:28-33 + handleResponseThunk.ts:34-42 — severity: LOW
- "`isHidden` is initialised to `true` by the parent (DataSourceItem.tsx:29) and corrected by this child's `useEffect` only AFTER first paint. For one render frame a freshly-registered datasource whose token is plaintext is treated as `isHidden=true` (Regenerate branch) before the effect runs and flips it. In practice the registration flow renders the token via this path and the flicker is sub-frame, but the initial-state assumption (every token starts masked) is not always true." — evidence: DataSourceItem.tsx:29 (`useState(true)`) + DataSourceItemToken.tsx:25-27 (post-mount effect) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "DataSourceItemToken.tsx:26"
      name: "masked-token sentinel prefix length (substring(0, 6))"
      value: "6 (the count of leading characters compared against '******')"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "N is not operator-controllable — `6` is a hardcoded literal matching the backend's 6-asterisk mask. It is recorded as a tunable-shaped magic number, not a runtime quantity. At a hypothetical N=0 the substring is empty, never equals '******', so every token would be classed plaintext (Copy always shown, Regenerate never reachable)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:26"
        - q: "What at N = tunable? At N = tunable + 1?"
          a: "At N=6 (current) the test matches the backend's exact mask. If the backend mask changed to 5 or 7 asterisks, the substring(0,6) test would never equal '******' (5-asterisk case) or compare a too-short slice (7-asterisk case) — either way every token classes plaintext and Regenerate becomes unreachable. The literal must stay in lockstep with TokenMapper.mapValue."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:26 + TokenMapper.java:15-18 (via getDataSourceList backend sidecar)"
        - q: "What does the operator see at each boundary?"
          a: "No operator-visible boundary today — 6 is invariant and matches the backend. The operator-relevant fragility is the cross-repo coupling (recorded as a MEDIUM bug), not a tunable the operator can push."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:26"
    - location: "CopyButton.tsx:24 (msDelay default, reached via DataSourceItemToken.tsx:52 which does not pass msDelay)"
      name: "Copy-confirmation revert delay (msDelay)"
      value: "3000 (ms — the 'Copied!' state duration)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "DataSourceItemToken does not pass msDelay, so the default 3000ms applies; the operator cannot set it. At a hypothetical 0ms the 'Copied!' confirmation would vanish instantly."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:52 (no msDelay prop) + CopyButton.tsx:24 (default 3000)"
        - q: "What at tunable x 100?"
          a: "Not operator-reachable from this component. Recorded for completeness — the Copy affordance is on the non-destructive branch and the delay only governs a transient label."
          confidence: STATIC-INFERRED
          evidence: "CopyButton.tsx:30-38"
        - q: "What does the operator see at each boundary?"
          a: "After clicking Copy the button shows 'Copied!' (or 'Copy error') for 3000ms then reverts to 'Copy'. No operator-controllable boundary."
          confidence: STATIC-INFERRED
          evidence: "CopyButton.tsx:34-38,54-60"
  name_behavior_pairs:
    - name: "Regenerate (button label, DataSourceItemToken.tsx:48)"
      promise: "From the operator's seat: 'Regenerate' promises issuing a fresh token. A typical operator reads it as additive/safe — get a new token — and does not necessarily expect the OLD token to die instantly."
      implementation: "onClick → ConfirmationDialog opens → on confirm dispatches regenerateDataSourceToken({ dataSourceId }) → PUT /api/datasources/{id}/token. The backend (regenerateDataSourceToken batch-ZB sidecar) does a DESTRUCTIVE in-place UPDATE of the single token row — the old token is irrecoverably overwritten with NO grace window. A collector still presenting the old token starts failing POST /ingestion/entities immediately."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator who clicks Regenerate (even after confirming the 'Are you sure?' dialog) is given no indication that they have just broken every running collector bound to this data source until the collector is reconfigured. The label + dialog under-state the destructiveness."
      confidence: STATIC-INFERRED
      evidence: "DataSourceItemToken.tsx:29-49 + the regenerateDataSourceToken batch-ZB backend sidecar (no grace period, in-place UPDATE)"
    - name: "isHidden (prop name + useEffect, DataSourceItemToken.tsx:13,25-27)"
      promise: "The name 'isHidden' implies the token VALUE is hidden/obscured by the UI — a show/hide visibility toggle."
      implementation: "`isHidden` is NOT a UI-controlled visibility toggle. It is true exactly when the BACKEND already sent a masked value (the `******` prefix). The component never hides or reveals the value itself — it always renders `token.value` verbatim (DataSourceItemToken.tsx:34). `isHidden` is really 'the value the server gave me is the masked form' — a backend-state mirror, not a hide control. There is no operator affordance to reveal a masked token (the only way to see plaintext is to Regenerate)."
      drift: MINOR
      operator_visible_consequence: "No operator-visible bug — but a maintainer reading `isHidden`/`setIsHidden` could reasonably expect a show/hide toggle and be surprised there is none. The masked token is permanently masked from the UI's side."
      confidence: STATIC-INFERRED
      evidence: "DataSourceItemToken.tsx:25-27,34"
  orderings: []
  auth_gates:
    - location: "DataSourceItemToken.tsx:36 (WithPermissions permissionTo={Permission.DATA_SOURCE_TOKEN_REGENERATE})"
      endpoint: "client-side gate on the Regenerate affordance (the network call is PUT /api/datasources/{id}/token)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "This is a UI render gate, not an HTTP endpoint. LOGIN_FORM/OAUTH2/LDAP: `usePermissions().hasAccessTo(DATA_SOURCE_TOKEN_REGENERATE)` resolves the signed-in user's policy — a holder sees the Regenerate button, a non-holder sees the masked token with no button. DISABLED: there is no signed-in user; whether the Regenerate button renders depends on what `usePermissions` returns in DISABLED mode — the WithPermissionsProvider's DISABLED behaviour is not in this file. The authoritative gate is the BACKEND SecurityConstants rule (regenerateDataSourceToken sidecar) which under DISABLED is bypassed entirely — so even if the UI hid the button, a crafted PUT would still rotate the token."
          confidence: REFERENCE
          evidence: "odd-platform ts react-component component:WithPermissionsProvider (not yet enriched) + odd-platform java DataSourceController controller-method:regenerateDataSourceToken (DISABLED-bypass finding)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP an unauthenticated user never reaches the Datasources tab — the route is behind the app's auth shell. So the question does not arise for this component. Under DISABLED 'unauthenticated' is the normal state (see above)."
          confidence: REFERENCE
          evidence: "odd-platform ts ui-shell (app auth shell — not enriched in this sidecar's scope)"
        - q: "What does a wrong-role caller see?"
          a: "A user authenticated but lacking DATA_SOURCE_TOKEN_REGENERATE sees the data source row, the masked `******`+last6 token string, and NO button in the `isHidden` branch — `WithPermissions` returns null (WithPermissions.tsx:27-29). They can still SEE the masked token (the masked value is in the list response for every authenticated user — getDataSourceList backend sidecar). They cannot regenerate."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:35-50 + WithPermissions.tsx:27-29"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Client-side: the gate is `WithPermissions` wrapping the Regenerate ConfirmationDialog (DataSourceItemToken.tsx:36). This is a UX gate ONLY — it hides the affordance. It is NOT a security boundary: the authoritative gate is the backend SecurityConstants DATA_SOURCE_TOKEN_REGENERATE rule (regenerateDataSourceToken backend sidecar). A user without the permission who crafted the PUT directly is stopped by the backend (under LOGIN_FORM/OAUTH2/LDAP) — the UI gate just prevents the button from showing."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:36 + the regenerateDataSourceToken backend sidecar (SecurityConstants.java:124-126 is the real gate)"
  resource_boundaries:
    - location: "DataSourceItemToken.tsx:29-30 (onTokenRegenerate dispatch) + ConfirmationDialog.tsx:24-35"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "From the UI: the ConfirmationDialog spinner (isLoading, ConfirmationDialog.tsx:24-35) disables a second confirm WITHIN one open dialog while onConfirm is pending. But the component places no pending-guard on the dispatch itself, and nothing stops the operator closing the dialog and re-opening it, or — once the row re-renders masked again — clicking Regenerate twice in quick succession. The backend rotation is last-write-wins with no corruption (regenerateDataSourceToken backend sidecar), so no corrupted state; the observable defect is the operator copying a token (from response 1) that response 2 has already invalidated. Exact behaviour under a fast double-confirm-across-reopen needs runtime."
          confidence: PROBE-NEEDED
          evidence: "P-082"
        - q: "Is the call replay-safe?"
          a: "No — each Regenerate is a fresh destructive rotation. Re-confirming (re-opening the dialog and confirming again) issues a NEW token and invalidates the previous one. There is no idempotency key in the thunk (datasources.thunks.ts:64-77 passes only dataSourceId) and no client-side de-bounce on this component. Recorded as a MEDIUM bug."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:29-30 + datasources.thunks.ts:64-77"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. The thunk result flows straight into the redux store via datasources.slice.ts:41-42 (upsertOne). The store IS the only client-side state; after a successful rotation the regenerated row (plaintext token) replaces the previous row immediately — no stale-cache window on the success path. The staleness risk is the opposite direction: if the list is REFETCHED after a rotation, the row re-masks and the plaintext is lost (recorded as a MEDIUM one-time-reveal bug)."
          confidence: STATIC-INFERRED
          evidence: "datasources.slice.ts:41-42 + DataSourceItemToken.tsx:25-27"
  request_inputs:
    - location: "DataSourceItemToken.tsx:11-15 (DataSourceItemProps) — prop `dataSource`"
      input_kind: body-field
      input_name: "dataSource"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`dataSource` promises the full DataSource record for the row being rendered — its token, id, and name."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:12 (typed `DataSource` from generated-sources)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Three reads: `dataSource.token.value` (rendered verbatim + the masked-prefix test, lines 26,34,52); `dataSource.id` (passed as `dataSourceId` to the regenerate thunk, line 30); `dataSource.name` (shown in the confirmation dialog body, line 44). No other field of DataSource is touched."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:26,30,34,44,52"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `dataSource` is used as exactly the data-source record it names; the three fields read are all genuine fields of that record."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:26,30,34,44,52"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — not a silent translation. The parent guards `dataSource.token?.value` truthiness before mounting this component (DataSourceItem.tsx:95), so this component can assume `token` is present; it does not itself null-check `token` (DataSourceItemToken.tsx:26 reads `dataSource.token.value` directly) — a contract it relies on the parent to uphold."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:95 (`dataSource.token?.value &&` guard) + DataSourceItemToken.tsx:26"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE relevant — `dataSource` also carries `oddrn`, `namespace`, `description` but those are not this component's concern (the parent DataSourceItem renders them). No closer-aligned-but-ignored field."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:17-21"
      routes_to_finding: ""
    - location: "DataSourceItemToken.tsx:13-14,19-20 (props `isHidden` / `setIsHidden`)"
      input_kind: body-field
      input_name: "isHidden / setIsHidden"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`isHidden` names a boolean that says whether something — the operator would assume the token value — is hidden; `setIsHidden` promises a setter to change that hidden-ness."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:13-14"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`setIsHidden` is called once in a useEffect to record whether the backend-supplied token is the masked form (DataSourceItemToken.tsx:25-27). `isHidden` is read to pick the render branch: true ⇒ Regenerate (masked), false ⇒ Copy (plaintext), and to drive the `<Token>` background tint (DataSourceItemTokenStyles.ts:16-17). The flag is OWNED by the parent DataSourceItem (useState, DataSourceItem.tsx:29) and the parent uses the SAME flag to render its destructive-token warning banner (DataSourceItem.tsx:110)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:25-27,34-35 + DataSourceItem.tsx:29,110"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the name `isHidden` implies a UI hide/show state, but the flag actually means 'the backend sent the masked token form'. The component never hides/reveals the value (it always renders it verbatim); `isHidden` is a mirror of backend masking, not a UI visibility control. Cross-referenced with the name_behavior_pairs `isHidden` entry (drift: MINOR there)."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:25-27,34"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "No operator-visible failure — the consequence is purely maintainer-facing. A developer expecting `setIsHidden(true)` to obscure the token, or expecting an operator-facing reveal toggle, finds neither: a masked token stays masked with no way to reveal it short of a destructive Regenerate. The naming invites a wrong mental model but produces no runtime bug."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:25-27,34"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — there is no separate visibility field. A more honest name would be `isMasked` / `tokenIsMasked`. The backend DataSource model has no `showToken` field exposed to the UI (the backend `TokenDto.showToken` is server-side only, per the getDataSourceList backend sidecar), so the UI legitimately has nothing typed to bind to — but the prop could still be RENAMED."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItemToken.tsx:13-14 + getDataSourceList backend sidecar (TokenDto.showToken is server-side)"
      routes_to_finding: "bugs_limitations_corner_cases (fragile string-prefix detection) — the misleading prop name compounds the heuristic's opacity"
  probes_emitted:
    - probe_id: P-082
      question: "Does clicking Regenerate open a confirmation dialog that must be confirmed before the destructive PUT /api/datasources/{id}/token fires — and does cancelling the dialog dispatch nothing? Plus: can a fast double-confirm (close+reopen) issue two rotations?"
      probe_path: "lineage/odd-platform/probes/P-082.yaml"
    - probe_id: P-083
      question: "After a successful regeneration, does the UI swap Regenerate→Copy, show the new token in plaintext, and render the 'save it, you cannot retrieve it again' warning — and is the plaintext lost (re-masked) on a subsequent list refetch?"
      probe_path: "lineage/odd-platform/probes/P-083.yaml"
    - probe_id: P-084
      question: "Is the Regenerate affordance fully absent (not disabled) for a signed-in user WITHOUT DATA_SOURCE_TOKEN_REGENERATE, while a holder sees it — across LOGIN_FORM and OAUTH2?"
      probe_path: "lineage/odd-platform/probes/P-084.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 24
    answers_static_inferred: 19
    answers_probe_needed: 2
    answers_reference: 3
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these modes resolve a signed-in user whose policy `usePermissions().hasAccessTo(DATA_SOURCE_TOKEN_REGENERATE)` reads to decide whether the Regenerate button renders (`DataSourceItemToken.tsx:36`). `DISABLED` — the WithPermissionsProvider's DISABLED behaviour is not in this file (REFERENCE); the authoritative gate is the backend (the `regenerateDataSourceToken` sidecar records the backend SecurityConstants rule is BYPASSED under DISABLED). `INTERNAL_ONLY` does not apply — this is a UI component. `S2S` does not apply — S2S is an ingestion-API concern, not a UI render path.
- **ingestion_filter_relevance**: `NO — UI component, not ingestion`. This component renders/regenerates the credential; it does not participate in `POST /ingestion/entities`. The credential it regenerates is the one `IngestionDataEntitiesFilter` later validates (per the backend sidecars).
- **authorization_assertions**:
  - "Client-side render gate: `<WithPermissions permissionTo={Permission.DATA_SOURCE_TOKEN_REGENERATE}>` wraps the Regenerate ConfirmationDialog — the button renders only if `usePermissions().hasAccessTo` is true" — evidence: DataSourceItemToken.tsx:36 + WithPermissions.tsx:17,27-29
  - "No client-side gate on the Copy affordance — any user who can see a plaintext token (i.e. who just regenerated it, which itself required the permission, or who registered the data source) can copy it" — evidence: DataSourceItemToken.tsx:51-53 (CopyButton outside any WithPermissions)
- **owner_scoping**: `N/A — the component renders whatever data source row the parent passes`. There is no owner filter at the UI; data-source visibility is decided by the backend `getDataSourceList` (which the backend sidecar records as NOT owner-scoped — every authenticated user sees every data source).
- **data_exposure**:
  - "Masked token string (`******`+real last 6 plaintext chars) → rendered on screen for every authenticated user who can view the Datasources tab (DataSourceItemToken.tsx:34). The visible 6 trailing characters are REAL token material, not a placeholder — per the getDataSourceList backend sidecar."
  - "Full 40-char plaintext token → rendered on screen in the `!isHidden` branch immediately after a regeneration (or registration). Visible to anyone shoulder-surfing the operator's screen; the value also sits in the redux store (datasources.slice.ts:41-42 upserts the plaintext-token row) for the lifetime of that store entry."
  - "Copy-to-clipboard writes the full 40-char plaintext token to the OS clipboard (CopyButton.tsx:43 `navigator.clipboard.writeText`) — the credential then lives in the system clipboard, readable by any app with clipboard access, until overwritten."
- **known_security_gaps**:
  - "The plaintext token persists in the redux store after regeneration. `datasources.slice.ts:41-42` upserts the regeneration response (plaintext `token.value`) into the datasource entity adapter; it stays there until the list is refetched (which re-masks it) or the store is torn down. Any code path / devtools / error reporter that serialises redux state captures the live plaintext credential." — evidence: datasources.slice.ts:41-42 + DataSourceItemToken.tsx:34 — severity: MEDIUM
  - "The confirmation dialog does not warn that regeneration breaks running ingestion. An operator with the permission is given a yes/no prompt with no statement of the destructive, no-grace-period consequence (cross-referenced to the batch-ZB backend finding)." — evidence: DataSourceItemToken.tsx:37-49 — severity: HIGH (operator-facing — a security/availability footgun, not a code vulnerability)
  - "The client-side WithPermissions gate is a UX affordance only — it is NOT a security boundary. Hiding the button does not stop a crafted PUT. The real boundary is the backend SecurityConstants rule (regenerateDataSourceToken sidecar). This is correct layering, recorded so a reviewer does not mistake the UI gate for the enforcement point." — evidence: DataSourceItemToken.tsx:36 — severity: LOW (informational — the backend IS the boundary)

## performance

- **hot_paths**:
  - "Not on any hot path — this component renders once per data-source row on the Management → Datasources tab, a low-traffic admin surface. The `useEffect` (DataSourceItemToken.tsx:25-27) runs on mount and on each `token.value` change; the work is one `substring` + one `setState` — negligible." — evidence: DataSourceItemToken.tsx:25-27
- **throughput_characteristics**:
  - "One regeneration = one PUT per click; there is no bulk-regenerate affordance in this component (consistent with the backend having no bulk-rotate endpoint — getDataSourceList/regenerateDataSourceToken backend sidecars)." — evidence: DataSourceItemToken.tsx:29-30
- **resource_allocation**:
  - "Negligible — no large data structures, no list rendering, no outbound calls except the single regenerate thunk. The Copy path allocates nothing beyond the clipboard write." — evidence: DataSourceItemToken.tsx:17-56
- **scaling_characteristics**:
  - "The parent `DataSourcesList` renders one `DataSourceItem` (hence one `DataSourceItemToken`) per data source; a catalog with many data sources renders many token controls, each with its own `useEffect` and its own lifted `isHidden` state. Linear in catalog size; each instance is cheap. No virtualisation observed in this component's scope (the list's virtualisation, if any, is the `DataSourcesList` sidecar's concern)." — evidence: DataSourceItem.tsx:103-107 (one token component per row)
- **known_performance_gaps**: `[]` — no file-local performance concern for this component.

## upstream_callers

- entry_point: "ui_route:/management/datasources (Management → Datasources tab — one row per data source)"
  caller_node: "odd-platform ts react-component component:DataSourceItem"
  multiplicity_per_trigger: 1
  evidence: "DataSourceItem.tsx:103-107 renders `<DataSourceItemToken dataSource={dataSource} isHidden={isHidden} setIsHidden={setIsHidden} />` once per row, inside a `dataSource.token?.value` truthiness guard (DataSourceItem.tsx:95). One DataSourceItemToken instance per data source displayed."
  observation_class: ui-call
- entry_point: "ui-button-onclick:Regenerate (the Regenerate button inside this component)"
  caller_node: "odd-platform ts react-component component:DataSourceItemToken (self — the onConfirm callback)"
  multiplicity_per_trigger: 1
  evidence: "DataSourceItemToken.tsx:29-30,47 — the ConfirmationDialog's `onConfirm` is `onTokenRegenerate`, which dispatches `regenerateDataSourceToken({ dataSourceId })` exactly once per confirmed dialog. The dialog's loading-spinner (ConfirmationDialog.tsx:24-35) prevents a repeat confirm within one open dialog instance."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: external-call
  description: "Dispatches the `regenerateDataSourceToken` redux thunk → `dataSourceApi.regenerateDataSourceToken({ dataSourceId })` → HTTP PUT /api/datasources/{id}/token. This is the destructive in-place token rotation; the operator-observable backend consequences (old token dies, ingestion locked out) are documented in the regenerateDataSourceToken backend sidecar."
  evidence: "DataSourceItemToken.tsx:29-30 + datasources.thunks.ts:64-77 + datasources.slice.ts:41-42"
  cardinality_per_call: "1 per confirmed ConfirmationDialog (0 if the operator cancels/closes the dialog)"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "ui-button-onclick:Regenerate"
  unresolved: true   # the HTTP call's backend half is the regenerateDataSourceToken controller-method node — REFERENCE; the destructive-rotation chain is fully traced in that sidecar
- side_effect_class: page-render
  description: "On thunk success: `datasources.slice.ts:41-42` upserts the response (plaintext-token DataSource) into the store; this component's row re-renders, the `useEffect` recomputes `isHidden=false`, the UI swaps Regenerate→Copy, and the parent DataSourceItem renders the warning banner 'Save token in a secure location. You will not be able to retrieve it again.'"
  evidence: "datasources.slice.ts:41-42 + DataSourceItemToken.tsx:25-27,34-53 + DataSourceItem.tsx:110-121"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "ui-button-onclick:Regenerate"
- side_effect_class: log-emit
  description: "On thunk success a global success toast 'Datasource's token successfully regenerated.' is shown (via showSuccessToast); on failure a server-error toast is shown. The toasts are fired by handleResponseAsyncThunk, not by this component directly."
  evidence: "datasources.thunks.ts:72-75 (setSuccessOptions) + handleResponseThunk.ts:28-31 (showSuccessToast) + handleResponseThunk.ts:34-39 (showServerErrorToast)"
  cardinality_per_call: "1 toast per terminal thunk outcome (1 success toast OR 1 error toast)"
  reachable_from_entry_points:
    - "ui-button-onclick:Regenerate"
- side_effect_class: cache-mutate
  description: "Writes the full 40-char plaintext token to the OS clipboard (Copy branch only). Reachable only after the token is already plaintext."
  evidence: "DataSourceItemToken.tsx:52 (CopyButton stringToCopy=token.value) + CopyButton.tsx:43 (navigator.clipboard.writeText)"
  cardinality_per_call: "1 clipboard write per Copy click"
  reachable_from_entry_points:
    - "ui-button-onclick:Copy (the Copy button in this component's plaintext branch)"

## coherence_notes

- kind: complements
  target: "odd-platform java DataSourceController controller-method:regenerateDataSourceToken"
  note: |
    This is the UI half of the destructive token-rotation flow whose backend half
    the batch-ZB sidecar enriched. The backend sidecar flagged two operator-facing
    risks: (1) "no rotation grace period — rotation is a destructive in-place UPDATE
    ... an operator rotating a data-source token during active ingestion locks out
    ingestion" (HIGH); (2) "the new token is returned in the response body in
    plaintext" (MEDIUM). This UI sidecar records how the UI handles each:
    RISK 1 — the UI MITIGATES the accidental-click case with a ConfirmationDialog
    (DataSourceItemToken.tsx:37-49) — a real safety affordance the backend sidecar's
    "the docs do not document it" finding did not know existed. BUT the UI does NOT
    mitigate the informed-click case: the dialog body (DataSourceItemToken.tsx:42-46)
    says nothing about ingestion lockout or the absence of a grace period. Net: the
    UI partially mitigates and partially compounds — a confirm step exists, but it
    does not carry the warning. Recorded as a HIGH bug + a HIGH doc-drift finding.
    RISK 2 — the UI surfaces the plaintext token in the `!isHidden` branch with a
    Copy button and the parent's one-time 'save it, you cannot retrieve it again'
    warning (DataSourceItem.tsx:110-121); it also keeps the plaintext in the redux
    store (datasources.slice.ts:41-42) — recorded as a MEDIUM security gap.
- kind: complements
  target: "odd-platform java DataSourceController controller-method:getDataSourceList"
  note: |
    The getDataSourceList backend sidecar established that the LIST endpoint returns
    the MASKED token form ('******'+real last 6 plaintext chars) and that the
    masking is API-side (TokenMapper.mapValue), not UI-side. This UI sidecar confirms
    the consumer side: DataSourceItemToken renders `token.value` VERBATIM
    (DataSourceItemToken.tsx:34) — it performs NO masking of its own. The masked form
    the operator sees on the Datasources tab is exactly what the API sent. The UI's
    only use of the mask is the prefix sentinel test (substring(0,6) === '******')
    to decide which button to show — a hard string-coupling to the backend mask
    format recorded as a MEDIUM bug here and worth a cross-repo note in any future
    change to TokenMapper.mapValue.
- kind: refines
  target: "odd-platform java DataSourceController controller-method:regenerateDataSourceToken"
  note: |
    The backend regenerateDataSourceToken sidecar's `upstream_callers` recorded the
    UI caller as `unresolved: true` — "the exact UI thunk + onClick handler is not
    enriched yet — REFERENCE to a future UI-side sidecar". This sidecar RESOLVES that
    reference: the UI caller chain is DataSourceItem (renders the row) → DataSourceItemToken
    (the Regenerate button) → ConfirmationDialog onConfirm → `regenerateDataSourceToken`
    thunk (datasources.thunks.ts:64-77) → `dataSourceApi.regenerateDataSourceToken`.
    multiplicity_per_trigger is 1 (one PUT per confirmed dialog; the dialog spinner
    blocks a repeat confirm within one open instance). A future refresh of the
    backend sidecar can flip its upstream_callers[0].unresolved to false and cite
    this node.

## sources

- understanding ← DataSourceItemToken.tsx:17-58 + DataSourceItemTokenStyles.ts:8-18 + datasources.thunks.ts:64-77 + datasources.slice.ts:41-42 + DataSourceItem.tsx:110-121
- concepts.entities ← DataSourceItemToken.tsx:4,12-14,34,36 + DataSourceItem.tsx:29
- concepts.operations ← DataSourceItemToken.tsx:25-27,34-53 + DataSourceItemTokenStyles.ts:8-18
- concepts.invariants ← DataSourceItemToken.tsx:35-53 + WithPermissions.tsx:27-29 + DataSourceItemToken.tsx:42-46
- dependencies_semantic.requires-feature ← datasources.thunks.ts:64-77 + ConfirmationDialog.tsx:16-79 + CopyButton.tsx:18-74 + WithPermissions.tsx:11-32
- dependencies_semantic.coupling ← DataSourceItemToken.tsx:26 + DataSourceItem.tsx:29,110-121 + datasources.slice.ts:41-42 + TokenMapper.java:15-18 (via getDataSourceList backend sidecar)
- tests_coverage_semantic ← Glob `**/DataSourceItemToken*` (only the component + Styles) + Grep `DataSourceItem` (only the two source files)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-22 of https://docs.opendatadiscovery.org/features/management (status 200)
- implicit_adrs[0] ← DataSourceItemToken.tsx:25-27
- implicit_adrs[1] ← DataSourceItemToken.tsx:35-50 + DataSourceItem.tsx:44,57
- implicit_adrs[2] ← DataSourceItemToken.tsx:37-49 + DataSourceItem.tsx:58-74
- bugs_limitations_corner_cases[0] ← DataSourceItemToken.tsx:37-49 + regenerateDataSourceToken backend sidecar
- bugs_limitations_corner_cases[1] ← DataSourceItemToken.tsx:26 + TokenMapper.java:15-18 (via getDataSourceList backend sidecar)
- bugs_limitations_corner_cases[2] ← DataSourceItemToken.tsx:25-27,51-53 + DataSourceItem.tsx:110-121 + datasources.slice.ts:41-42
- bugs_limitations_corner_cases[3] ← DataSourceItemToken.tsx:29-30 + ConfirmationDialog.tsx:24-35
- bugs_limitations_corner_cases[4] ← ConfirmationDialog.tsx:28-33 + handleResponseThunk.ts:34-42
- bugs_limitations_corner_cases[5] ← DataSourceItem.tsx:29 + DataSourceItemToken.tsx:25-27
- stress_findings.tunables ← DataSourceItemToken.tsx:26,52 + CopyButton.tsx:24
- stress_findings.name_behavior_pairs ← DataSourceItemToken.tsx:25-49 + regenerateDataSourceToken backend sidecar
- stress_findings.auth_gates ← DataSourceItemToken.tsx:36 + WithPermissions.tsx:27-29 + regenerateDataSourceToken backend sidecar
- stress_findings.resource_boundaries ← DataSourceItemToken.tsx:29-30 + ConfirmationDialog.tsx:24-35 + datasources.slice.ts:41-42
- stress_findings.request_inputs ← DataSourceItemToken.tsx:11-15,19-20,25-30,34,44,52 + DataSourceItem.tsx:95
- security.authorization_assertions ← DataSourceItemToken.tsx:36,51-53 + WithPermissions.tsx:17,27-29
- security.data_exposure ← DataSourceItemToken.tsx:34,52 + CopyButton.tsx:43 + datasources.slice.ts:41-42
- security.known_security_gaps ← datasources.slice.ts:41-42 + DataSourceItemToken.tsx:34,37-49,36
- performance ← DataSourceItemToken.tsx:25-27,29-30 + DataSourceItem.tsx:103-107
- upstream_callers ← DataSourceItem.tsx:95,103-107 + DataSourceItemToken.tsx:29-30,47
- downstream_side_effects ← DataSourceItemToken.tsx:29-30,52 + datasources.thunks.ts:64-77 + datasources.slice.ts:41-42 + handleResponseThunk.ts:28-39 + DataSourceItem.tsx:110-121 + CopyButton.tsx:43
- coherence_notes ← the regenerateDataSourceToken + getDataSourceList backend sidecars (both read this session)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (management page WebFetched live this session, status 200)
- implicit_adrs: HIGH (HIGH for the two convention-anchored ADRs; the prefix-detection ADR is MEDIUM as noted inline)
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH (the immediate caller DataSourceItem is read primary-source this session)
- downstream_side_effects: HIGH (the backend-call half is a deliberate REFERENCE to the enriched regenerateDataSourceToken sidecar)
- stress_findings: MEDIUM (19 of 24 questions STATIC-INFERRED; 2 PROBE-NEEDED (P-082 confirm-flow, the load-bearing one) and 3 REFERENCE (DISABLED-mode WithPermissions behaviour lives outside this file); the load-bearing operator claims — confirm dialog exists, no consequence warning, Regenerate hidden for non-holders — are STATIC-INFERRED with strong evidence)

## Maintainer notes

(empty — no prior sidecar existed at this path; this is the first enrichment of this node)
