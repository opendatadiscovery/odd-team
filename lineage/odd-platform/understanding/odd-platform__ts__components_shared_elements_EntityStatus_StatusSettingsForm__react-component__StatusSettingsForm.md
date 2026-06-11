---
node_id: "odd-platform ts components/shared/elements/EntityStatus/StatusSettingsForm react-component:StatusSettingsForm"
node_kind: react-component
axis: ui_components
extracted_at_commit: ede5d277  # substrate manifest last_scan_commit (lineage/odd-platform/manifest.yaml:2)
enriched_at_commit: "contrib/CTRIB-004-view-count-double-fetch (base main @ 8c142e15) — working tree read; the #1764 onSubmit refetch is present in the source read"
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-11-01
---

# StatusSettingsForm — semantic understanding

## understanding

StatusSettingsForm is the modal dialog through which an operator changes a data entity's lifecycle status (UNASSIGNED / DRAFT / STABLE / DEPRECATED / DELETED); it is the ONLY status-change path in the UI — the sole consumer of `useUpdateDataEntityStatus` (grep over `odd-platform-ui/src` returns exactly the hook file and this component). For switch-to DRAFT/DEPRECATED it collects a deletion timer (preset interval `1 day…1 month` or an explicit datetime) sent as `statusSwitchTime`; for Data Entity Groups it offers a "Propagate status to the whole group" checkbox. On Apply it awaits `PUT /api/dataentities/{id}/statuses`, patches the Redux entity store with the echoed status, then dispatches an explicit `fetchDataEntityDetails({ dataEntityId })` refetch — the load-bearing replacement (issue #1764 / CTRIB-004) for the removed `details.status?.status` useEffect dependency in DataEntityDetails.tsx that double-fired the detail fetch (+2 view_count per page-open, LSN-017). The refetch is required because a status change has server-side effects beyond the status field: DELETED soft-deletes lineage + group relations (and restore reverses them), so the page must re-read the entity.

## concepts

- entities: [DataEntity, DataEntityStatus, DataEntityStatusEnum (5 values), statusSwitchTime (deletion timer), DataEntityGroup (propagation target), Permission.DATA_ENTITY_STATUS_UPDATE]
- operations: [open-status-change-dialog, pick-switch-interval-or-datetime, toggle-propagate-to-group, submit-status-update, optimistic-store-patch, explicit-detail-refetch, close-menu-and-dialog-on-success]
- invariants:
  - "switchTime is attached ONLY for newStatus DRAFT or DEPRECATED (StatusSettingsForm.tsx:83-84); identical to the backend's switchable set (DataEntityStatusDto.java:13,15 — DRAFT(2,true), DEPRECATED(4,true)) — the backend 400 'must have status switch time' is unreachable from the happy path of this UI."
  - "The propagate checkbox renders only when isPropagatable=true, which the sole mount chain sets to isDEG (DataEntityDetailsHeader.tsx:119); the backend honours propagate only for DATA_ENTITY_GROUP entities (DataEntityServiceImpl.java:680-684) — UI offer and backend honour coincide."
  - "Store patch (line 95) precedes the refetch dispatch (line 100); the patch applies the ECHOED REQUEST status — the backend returns `statusFormData.getStatus()` verbatim, not a DB re-read (DataEntityServiceImpl.java:480)."
  - "Dialog closes on mutation success via handleCloseSubmittedForm={isStatusUpdated} (line 215) → DialogWrapper effect on that boolean (DialogWrapper.tsx:81-83); clearState resets to the '1 day' default (lines 71-75)."
  - "One StatusSettingsForm instance is mounted PER status enum value — SelectableEntityStatus maps all 5 (SelectableEntityStatus.tsx:39,66-80), current status included, so a same-status 'change' is offerable and submittable."
- audiences: [operators with DATA_ENTITY_STATUS_UPDATE permission curating entity lifecycle (the only writers), all catalog readers (status badge + entity visibility downstream of the change), Activity-feed consumers (each submit emits DATA_ENTITY_STATUS_UPDATED), housekeeping/TTL behaviour (DELETED transition starts the purge clock)]

## dependencies_semantic

- requires-feature:
  - "useUpdateDataEntityStatus — react-query mutation wrapping dataEntityApi.updateStatus, success toast 'Status successfully updated!', no per-hook onError (lib/hooks/api/dataEntity.ts:147-153); error toast comes from the global mutation default (index.tsx:44-46)."
  - "redux/slices/dataentities.slice.ts `updateEntityStatus` reducer — patches byId[dataEntityId].status (dataentities.slice.ts:73-83)."
  - "redux/thunks `fetchDataEntityDetails` — GET /api/dataentities/{id} (dataentities.thunks.ts:35-42); the refetch contract."
  - "DialogWrapper — open/close lifecycle, isLoading progress + pointer-events lock, close-on-submit, clearState (DialogWrapper.tsx:32-104; DialogWrapperStyles.ts:34)."
  - "useDataEntityRouteParams — dataEntityId = parseInt(route param) (routes/dataEntitiesRoutes.ts:47-57); the form is only meaningful under /dataentities/{id}/* routes."
  - "useAppDateTime().add — date-fns `add` re-export (lib/hooks/useAppDateTime.ts:9,37,89); '1 month' is calendar-aware, not 30 fixed days."
- requires-config: "None directly. Rendering is gated upstream by resource permissions (see security); no env/feature flag read in this file."
- requires-runtime: "react-hook-form (mode onChange), @tanstack/react-query v5 (isPending naming), Redux store, MUI dialog stack; backend PUT /api/dataentities/{data_entity_id}/statuses (generated-sources/apis/DataEntityApi.ts:1780-1786)."

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "One Overview page-open registers exactly +1 view (the regression pin for the dep-array double-fetch this component's explicit refetch replaced)"
    test_class: integration
    test_files: ["integration-tests/protocols/IT-002-view-count-ui-overview.md (odd-team; e2e:specs/view-count-overview.spec.ts; run-log 2026-06-11: pre-fix 'Received: 2', post-fix '1 passed')"]
  - behaviour: "GET /api/dataentities/{id} increments view_count by exactly +1 per call (the unchanged backend contract each refetch from this form pays)"
    test_class: integration
    test_files: ["integration-tests/protocols/IT-001-view-count-backend-delta.md (odd-team; backend sub-check per IT-002 §intro)"]
  - behaviour: "Downstream known-bug pin: DataEntityMapperImpl.applyStatus mutates status BEFORE its change-guard, so status_updated_at is never set on non-DELETED transitions (PLT-027 characterization pin — GREEN while broken)"
    test_class: unit
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/DataEntityStatusKnownBugTest.java:38-54 (@pins PLT-027)"]
- uncovered_behaviours:
  - behaviour: "onSubmit chain order: await mutation → store patch → explicit refetch dispatch → menu close (the #1764 contract of THIS component — currently only pinned indirectly via IT-002's page-open count)"
    test_class: integration
    criticality: HIGH
    note: "No e2e drives the status dialog: tests/ grep for status finds only login/api-base helpers; under AUTH_TYPE=DISABLED (the e2e stack's mode) the control does not render at all (permissions resolve empty), so an e2e needs an LDAP/LOGIN_FORM stack or seeded policy."
  - behaviour: "Preset-interval mapping: '1 day'/'3 days'/'1 week'/'2 weeks'/'1 month' → correct Date via date-fns add, and Date-vs-string discrimination in onSubmit (lines 77-84)"
    test_class: unit
    criticality: MEDIUM
    note: "No component/unit test exists for the form (no *test*/*spec* file references StatusSettingsForm/SelectableEntityStatus/EntityStatus in odd-platform-ui/src — grep with glob *{test,spec}* returns zero files)."
  - behaviour: "Cleared date-picker submits switchTime=null for DRAFT/DEPRECATED → backend 400 surfaced as raw server-error toast (reachable UI-validation gap, see bugs[2])"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "propagate=true on a DEG cascades status to every member (and DELETED cascade soft-deletes member relations)"
    test_class: integration
    criticality: MEDIUM
    note: "Backend-owned logic, but no test drives it through the UI checkbox; the backend sidecar tracks its own coverage."
- test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/DataEntityStatusKnownBugTest.java", "integration-tests/protocols/IT-001-view-count-backend-delta.md", "integration-tests/protocols/IT-002-view-count-ui-overview.md"]
- gaps: |
    The worst-covered class on this node is integration: the dialog's own submit flow (mutation → patch → refetch) has no direct test in any auth mode — IT-002 pins only the page-OPEN fetch count, so a regression that, e.g., dropped the refetch dispatch (stale lineage/relations after delete/restore) or re-introduced a second fetch on the SUBMIT path would pass IT-002. Highest-leverage addition: an LDAP-mode (or policy-seeded) e2e that changes status STABLE→DELETED and asserts (a) exactly one extra GET, (b) DELETED badge + read-only affordances after refetch, (c) view_count delta exactly +1 for the submit. Unit-level, the preset-map and null-switchTime branches are cheap react-hook-form tests nobody has written.

## docs_link_semantic

- declared_docs: []  # no @docs / // @docs: annotation anywhere in StatusSettingsForm.tsx (full read, lines 1-223)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/statuses"
    anchor: ""
    rationale: "Canonical page for the status feature this form drives; orchestrator-suggested candidate, verified live this session."
    last_verified_at: "2026-06-11"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "The UI lets operators set a time period after which the status auto-transitions to `DELETED`" (DRAFT + DEPRECATED);
      "every entity whose `status_switch_time` is in the past...flips it" (10-minute background job);
      "apply the change to the group as a whole or to cascade it to every member entity";
      "Operators need the `DATA_ENTITY_STATUS_UPDATE` permission to change a data entity's status."
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page"
    anchor: ""
    rationale: "Documents the detail-page header hosting the status control, the DELETED read-only posture, and the view-count behaviour the refetch interacts with."
    last_verified_at: "2026-06-11"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "The page header above the tabs shows the entity name, the class badges, the type badge, the stale indicator, the status...";
      "Status change" requires `DATA_ENTITY_STATUS_UPDATE`;
      DELETED entities: "several Overview-tab and header edit affordances are hidden regardless of the operator's permissions — soft-deleted entities are read-only in the UI until the status is reverted";
      "Opening a detail page registers as +2, not +1. Each page-open fetches the entity detail twice, and each fetch bumps the view count by one."
- doc_drift_findings:
  - "entity-detail-page's '+2, not +1' view-count paragraph documents the PRE-FIX behaviour. It is accurate for the latest published release (<=0.27.x — the live manual's contract) but inverts at 0.28.0: with the #1764 fix in this branch, a page-open is +1 (DataEntityDetails.tsx:56-68 removed the status dep) and a status-change SUBMIT adds a further +1 via this form's explicit refetch (StatusSettingsForm.tsx:100). The doc correction must ride documentation release/0.28.0 per the release-train rule — flag for the 0.28.0 doc sweep; do not 'fix' the live page before the release gate."
    pending_release: "0.28.0"
    train_ref: "release/0.28.0 — view-count + status-change refetch paragraphs of features/data-discovery/entity-detail-page (exact docs-repo path to be pinned by the doc batch)"
  - "statuses page documents 'set a time period' for auto-deletion; the UI equally accepts an exact datetime via AppDateTimePicker (StatusSettingsForm.tsx:143-153) — the period presets are one of two input modes. Cosmetic under-description, not a contradiction."

## implicit_adrs

- "Side-effect-bearing mutations are followed by an EXPLICIT re-read dispatched at the mutation site, never by a reactive useEffect dependency on response-derived state — the refetch lives next to the mutation it trues up." — evidence: StatusSettingsForm.tsx:96-100 + DataEntityDetails.tsx:56-60 — intent_anchor: "Status changes have server-side effects beyond the status field (DELETED/restore soft-delete/restore lineage and group relations), so re-read the entity. This refetch used to be triggered reactively by details.status?.status sitting in the DataEntityDetails effect deps — the mechanism that double-counted views (#1764)." — confidence: HIGH
- "Status-change UX is patch-then-true-up: the store is updated immediately with the echoed request status for instant badge feedback, and the full entity is refetched for everything the echo cannot carry (lineage/group/read-only state)." — evidence: StatusSettingsForm.tsx:94-100 (ordering) + dataentities.slice.ts:73-83 — intent_anchor: "the same comment block at lines 96-99 frames the refetch as the carrier of 'server-side effects beyond the status field'" — confidence: HIGH
- "Form dialogs share one lifecycle contract: DialogWrapper's renderOpenBtn/cloneElement trigger, handleCloseSubmittedForm close-on-success boolean, isLoading pointer-lock, clearState reset — applied here exactly as in the other entity-edit dialogs mounted by the same header (InternalNameFormDialog, DataEntityGroupForm)." — evidence: StatusSettingsForm.tsx:208-219 + DataEntityDetailsHeader.tsx:88-100,124-131 — intent_anchor: "convention applied consistently across the header's three dialog-backed edit affordances" — confidence: MEDIUM

## bugs_limitations_corner_cases

- "Relative presets are anchored at the component's last RENDER, not at Apply: settingsMap computes `add(new Date(), …)` in the render body (lines 51-57), and onSubmit resolves the selected preset from the closure (lines 78-81). The anchor refreshes when the status menu opens (anchorEl state re-renders SelectableEntityStatus and its 5 child forms) — so '1 day' means '1 day from menu-open', and dialog dwell time shifts the real switch moment earlier than the label suggests by the dwell amount." — evidence: StatusSettingsForm.tsx:51-57,77-84 + SelectableEntityStatus.tsx:24-28 — severity: LOW
- "Same-status 'change' is a real write: the menu lists all 5 statuses including the current one (SelectableEntityStatus.tsx:39,66-80), and submitting it fires the PUT, logs a DATA_ENTITY_STATUS_UPDATED activity event (the backend logs unconditionally — DataEntityInternalStateServiceImpl.java:79-96), and pays the refetch (+1 view_count). No client- or server-side no-op guard." — evidence: StatusSettingsForm.tsx:77-102 — severity: LOW
- "Clearing the date picker then submitting sends statusSwitchTime=null for DRAFT/DEPRECATED: the picker's onChange forwards null into the form (`field.onChange(date)` at line 149 runs even when handleDateChange ignored it at lines 104-110), typeof null !== 'string' bypasses the preset lookup (lines 78-81), and the backend rejects with 400 'Status X must have status switch time' (DataEntityServiceImpl.java:462-465) surfaced only as a raw server-error toast. No client-side required-validation on switchTime (Controller has no rules, lines 139-153)." — evidence: StatusSettingsForm.tsx:104-110,139-153,77-84 — severity: MEDIUM
- "Re-submit guard is pointer-only: during isPending the dialog sets pointer-events:none (DialogWrapperStyles.ts:34), but keyboard-driven implicit form submission (Enter in the date-picker input; the external Apply button is the form's default submit via form={formId}) is not blocked and the Apply button is never disabled (line 205). A repeated Enter can fire multiple PUTs: terminal status is the same, but each call logs a duplicate activity event and each completed submit path pays its refetch (+1 view_count each)." — evidence: StatusSettingsForm.tsx:125,204-206 + DialogWrapper.tsx:85-90 (formSubmitHandler undefined → no preventDefault) + DialogWrapperStyles.ts:34 — severity: LOW
- "The refetch dispatch is fire-and-forget: `dispatch(fetchDataEntityDetails(...))` is not awaited and its failure is not handled (line 100; the thunk is created with switchOffErrorMessage: true — dataentities.thunks.ts:41). If the refetch fails, the store keeps the optimistic status patch while lineage/group/read-only side effects of the change stay invisible until the next page load." — evidence: StatusSettingsForm.tsx:94-101 + dataentities.thunks.ts:35-42 — severity: LOW
- "mutateAsync rejection propagates uncaught through onSubmit: on a failed PUT the global mutation onError toast fires (index.tsx:44-46), but the awaited `updateStatus(params)` rejection (line 94) is not try/caught, leaving an unhandled promise rejection from react-hook-form's handleSubmit in the console. Dialog correctly stays open; store patch and refetch correctly do not run." — evidence: StatusSettingsForm.tsx:77-102 + lib/hooks/api/dataEntity.ts:147-153 — severity: LOW
- "Form copy bypasses i18n and misattributes the subject: every string is hardcoded English ('Status change settings', 'You are changing your status from', 'Propagate status to the whole group') in a codebase where the hosting header uses react-i18next (DataEntityDetailsHeader.tsx:3,45); and 'YOUR status' is wrong — it is the ENTITY's status." — evidence: StatusSettingsForm.tsx:118-122,126-128,195 — severity: LOW
- "Downstream (neighbour-owned, tracked PLT-027, pinned): non-DELETED transitions submitted by this form never refresh data_entity.status_updated_at — DataEntityMapperImpl.applyStatus sets the pojo's status BEFORE comparing it (`pojo.setStatus(statusDto.getId()); … if (statusDto.getId() != pojo.getStatus())` is always false). DELETED transitions are unaffected (repository delete path sets STATUS_UPDATED_AT — ReactiveDataEntityRepositoryImpl.java:110-116). Cited here because this form is the sole UI producer of those transitions; do not re-file." — evidence: odd-platform-api DataEntityMapperImpl.java:242-253 + DataEntityStatusKnownBugTest.java:38-54 — severity: MEDIUM
- "Neighbour display branch unreachable from platform writes: SelectableEntityStatus renders 'N left' for DELETED+statusSwitchTime (SelectableEntityStatus.tsx:32-37), but every DELETED write path NULLs the switch time (getDeleteChangedFields — ReactiveDataEntityRepositoryImpl.java:114) and this form never sends one for DELETED (line 84). Owned by the SelectableEntityStatus node; one-line note here for the chain audit." — evidence: SelectableEntityStatus.tsx:32-37 + ReactiveDataEntityRepositoryImpl.java:110-116 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "StatusSettingsForm.tsx:51-57,62,68"
      name: "settingsMap presets + default '1 day'"
      value: "{1 day, 3 days, 1 week, 2 weeks, 1 month}; default selection '1 day'"
      questions:
        - q: "What does each preset resolve to, and at which time anchor?"
          a: "date-fns add() from `new Date()` AT RENDER TIME of this component — calendar-aware ('1 month' = same day next month). Anchor refreshes on menu open (parent re-render) and on any in-dialog interaction; an untouched default submit uses the menu-open anchor (see bugs[0])."
          confidence: STATIC-INFERRED
          evidence: "StatusSettingsForm.tsx:51-57,77-84; lib/hooks/useAppDateTime.ts:9,37,89"
        - q: "What at the unset/null boundary?"
          a: "switchTime can become null only via the picker-clear path (field.onChange(null) at line 149); preset path cannot produce null. Null reaches the backend and 400s (bugs[2])."
          confidence: STATIC-INFERRED
          evidence: "StatusSettingsForm.tsx:104-110,147-150; DataEntityServiceImpl.java:462-465"
        - q: "What does the operator see at each boundary?"
          a: "Happy path: dialog closes + success toast. Null boundary: raw server-error toast, dialog stays open, no state change. No silent truncation anywhere."
          confidence: STATIC-INFERRED
          evidence: "index.tsx:44-46; DialogWrapper.tsx:81-83"
    - location: "StatusSettingsForm.tsx:146"
      name: "minDateTime={new Date()}"
      value: "now-at-render"
      questions:
        - q: "What at a past datetime?"
          a: "Picker UI blocks past selection; the API does not — DataEntityServiceImpl validates only non-null for switchable statuses, so a past switchTime submitted out-of-band is accepted and the switch job flips the entity to DELETED within its next 10-minute tick. Unreachable via this form's controls."
          confidence: STATIC-INFERRED
          evidence: "StatusSettingsForm.tsx:146; DataEntityServiceImpl.java:462-465; ReactiveDataEntityRepositoryImpl.java:256-262"
    - location: "odd-platform-api .../service/job/DataEntityStatusSwitchJob.java:21-22 (1-hop, semantics of the timer this form sets)"
      name: "@Scheduled(fixedRate = 10 MINUTES) + ShedLock 9m"
      value: "10-minute sweep"
      questions:
        - q: "What is the real resolution of the user's chosen switch time?"
          a: "Up to ~10 minutes late: the job selects entities with STATUS_SWITCH_TIME <= now each tick and flips them to DELETED. The dialog's minute-precision picker over-promises precision by up to one tick."
          confidence: STATIC-INFERRED
          evidence: "DataEntityStatusSwitchJob.java:21-31; ReactiveDataEntityRepositoryImpl.java:256-262"
  name_behavior_pairs:
    - name: "StatusSettingsForm / dialog title 'Status change settings'"
      promise: "Configure and apply a status change to the viewed entity."
      implementation: "PUT /statuses with status(+switchTime)(+propagate) → store patch → detail refetch → close. Matches."
      drift: NONE
      confidence: STATIC-INFERRED
      evidence: "StatusSettingsForm.tsx:77-102,118-122"
    - name: "Label 'Change to status \"Deleted\" after' (shown for DRAFT and DEPRECATED targets)"
      promise: "After the chosen time, the entity becomes DELETED."
      implementation: "statusSwitchTime → DATA_ENTITY.STATUS_SWITCH_TIME; DataEntityStatusSwitchJob hardcodes target DELETED and sweeps past-due rows every 10 min. The label is truthful including its hardcoding for both DRAFT and DEPRECATED."
      drift: MINOR
      operator_visible_consequence: "Switch lands up to ~10 min after the chosen moment, and relative presets are anchored at menu-open render, not at Apply (bugs[0]) — both shift timing, neither changes the outcome."
      confidence: STATIC-INFERRED
      evidence: "StatusSettingsForm.tsx:134-138,83-84; DataEntityStatusSwitchJob.java:25-30"
    - name: "Checkbox 'Propagate status to the whole group'"
      promise: "Every member of the group receives the same status change."
      implementation: "Backend loads getDEGEntitiesOddrns(groupId) members and applies the change to members + the group itself; honoured only when the entity is a DEG — and this UI only renders the checkbox for DEGs (isPropagatable=isDEG). Whether 'whole group' includes members of NESTED sub-groups is owned by the repository query — not resolved in this node's 1-hop budget."
      drift: NONE
      confidence: REFERENCE
      evidence: "DataEntityServiceImpl.java:468-477,680-684; nested-group scope → understanding/odd-platform__java__service__service__DataEntityServiceImpl.md"
    - name: "Success toast 'Status successfully updated!'"
      promise: "The change is persisted."
      implementation: "Toast fires on mutation success; the 200 body is the echoed request status (thenReturn(statusFormData.getStatus())), but the response only resolves after changeStatusForDataEntities completes inside @ReactiveTransactional — success does imply commit."
      drift: NONE
      confidence: STATIC-INFERRED
      evidence: "lib/hooks/api/dataEntity.ts:151; DataEntityServiceImpl.java:478-480; DataEntityInternalStateServiceImpl.java:73-75"
  orderings:
    - location: "StatusSettingsForm.tsx:162 (Object.keys(settingsMap).map)"
      questions:
        - q: "What order do the preset options render in?"
          a: "Object-literal insertion order — '1 day', '3 days', '1 week', '2 weeks', '1 month' (JS string-key insertion order is spec-deterministic). No re-sort upstream."
          confidence: STATIC-INFERRED
          evidence: "StatusSettingsForm.tsx:51-57,160-172"
    - location: "SelectableEntityStatus.tsx:39 (Object.values(DataEntityStatusEnum)) — 1-hop, drives which form instance the user reaches"
      questions:
        - q: "What order does the status menu list, and is the current status excluded?"
          a: "Generated-enum declaration order: UNASSIGNED, DRAFT, STABLE, DEPRECATED, DELETED (DataEntityStatusEnum.ts:20-26). Current status is NOT excluded — same-status submit is reachable (bugs[1])."
          confidence: STATIC-INFERRED
          evidence: "SelectableEntityStatus.tsx:39,66-80; generated-sources/models/DataEntityStatusEnum.ts:20-26"
  auth_gates:
    - location: "DataEntityDetailsHeader.tsx:113-122 (render gate) + SecurityConstants.java:277-281 (API gate)"
      endpoint: "render of the selectable status control; PUT /api/dataentities/{data_entity_id}/statuses"
      questions:
        - q: "What does this surface do for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "UI: WithPermissions renderContent always shows the status BADGE; `selectable` (menu + this form) requires DATA_ENTITY_STATUS_UPDATE in the resource permissions fetched per entity. Under AUTH_TYPE=DISABLED resource permissions resolve empty (runtime-verified 2026-06-11 per orchestrator input) — the control is hidden on default deployments. Under LOGIN_FORM/OAUTH2/LDAP it appears for users whose policies grant the permission. API: the SecurityRule binds the same permission to the PUT when a non-DISABLED chain wires AuthorizationCustomizer; under DISABLED the PUT is open — the UI is STRICTER than the API there (documented posture, not a fresh gap; backend ownership)."
          confidence: STATIC-INFERRED
          evidence: "WithPermissions.tsx:19-21; DataEntityDetails.tsx:74-79,86-92; SecurityConstants.java:277-281; AuthorizationCustomizer.java:24-30; DISABLED posture → understanding/odd-platform__java__DataEntityController__controller-method__updateStatus.md"
        - q: "What does an unauthenticated caller see?"
          a: "Cannot reach the form: all non-whitelisted paths require authentication in non-DISABLED chains (AuthorizationCustomizer spec.pathMatchers(\"/**\").authenticated()); the hosting page itself is behind login."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see?"
          a: "UI: non-selectable badge (isAllowedTo=false → DefaultEntityStatus branch, EntityStatus.tsx:20-23) — the dialog is unreachable. Direct API call without the permission → access denied by the per-rule ReactiveAuthorizationManager (shape owned by the backend sidecar)."
          confidence: REFERENCE
          evidence: "EntityStatus.tsx:20-23; 403 shape → understanding/odd-platform__java__DataEntityController__controller-method__updateStatus.md"
        - q: "Where does the gate live?"
          a: "Twice, by the same Permission name: UI render gate (WithPermissions + resource-permission fetch) and API route gate (SecurityRule). No gate inside this component itself — it trusts its mount context; any future second mount point must re-apply WithPermissions."
          confidence: STATIC-INFERRED
          evidence: "DataEntityDetailsHeader.tsx:113-122; SecurityConstants.java:277-281; StatusSettingsForm.tsx:1-223 (no permission check present)"
  resource_boundaries:
    - location: "StatusSettingsForm.tsx:77-102 + DialogWrapperStyles.ts:34"
      kind: idempotency
      questions:
        - q: "Can two simultaneous submits produce corrupted state?"
          a: "Not corrupted, duplicated: mouse re-click is blocked once isPending renders pointer-events:none; keyboard implicit submission is not blocked and the submit button is never disabled, so Enter-repeat can fire N PUTs → N activity events and N×(+1 view_count) refetches; terminal entity status identical (bugs[3])."
          confidence: STATIC-INFERRED
          evidence: "DialogWrapperStyles.ts:34; StatusSettingsForm.tsx:125,204-206; DataEntityInternalStateServiceImpl.java:79-96"
        - q: "Is the call replay-safe?"
          a: "Value-idempotent (same payload → same terminal status; DELETED re-delete and restore paths are branch-guarded server-side) but NOT side-effect-idempotent: every accepted PUT emits a DATA_ENTITY_STATUS_UPDATED activity event unconditionally, and every refetch increments view_count."
          confidence: STATIC-INFERRED
          evidence: "DataEntityInternalStateServiceImpl.java:73-98; DataEntityServiceImpl.java:198-208 (getDetails → incrementViewCount at 207)"
        - q: "If a cache fronts this, what is the staleness window?"
          a: "No react-query cache invalidation is wired (the mutation has no onSuccess invalidation; the redux store is the page's source of truth). Staleness window = one refetch round-trip between the optimistic patch (line 95) and the fulfilled refetch (line 100); on refetch failure the optimistic patch persists until next page load (bugs[4]). Note useDataEntityDetails ('dataEntityDetails' query key, lib/hooks/api/dataEntity.ts:95-104) is a PARALLEL cache not touched by this form — any consumer of that hook keeps pre-change data until its own refetch."
          confidence: STATIC-INFERRED
          evidence: "StatusSettingsForm.tsx:94-100; lib/hooks/api/dataEntity.ts:95-104,147-153"
    - location: "StatusSettingsForm.tsx:94-101 (two-dispatch sequence)"
      kind: concurrency
      questions:
        - q: "Two operators change the same entity's status concurrently — what wins?"
          a: "Last-write-wins at the DB (bulkUpdate carries no optimistic-version guard — backend-owned); each operator's UI shows their own echoed patch until their refetch lands, after which both converge on the later write. No conflict surfaced to either operator."
          confidence: REFERENCE
          evidence: "ordering trace StatusSettingsForm.tsx:94-100; write semantics → understanding/odd-platform__java__service__service__DataEntityServiceImpl.md"
  request_inputs:
    - location: "StatusSettingsForm.tsx:86-92 (request assembly)"
      input_kind: body-field
      input_name: "dataEntityId (path) / status.status / status.statusSwitchTime / propagate"
      questions:
        - q: "What does each input NAME promise the caller?"
          a: "dataEntityId: the entity being viewed; status.status: the exact status clicked in the menu; statusSwitchTime: per the UI label, the moment the entity auto-becomes DELETED; propagate: per the label, cascade to the whole group."
          confidence: STATIC-INFERRED
          evidence: "StatusSettingsForm.tsx:43,86-92,134-138,195"
        - q: "When supplied, what does the implementation USE each for?"
          a: "dataEntityId → route param parseInt → PUT path → repository.get(id) (MATCHES). status.status → applyStatus / soft-delete branch on exactly that enum (MATCHES). statusSwitchTime → DATA_ENTITY.STATUS_SWITCH_TIME → 10-min job flips past-due rows to DELETED, target hardcoded DELETED (MATCHES the label; the bare field name 'switch time' under-states that the destination is always DELETED — the label carries the real contract). propagate → honoured only for DEG entities, exactly the only case the UI offers it (MATCHES at this call-site)."
          confidence: STATIC-INFERRED
          evidence: "routes/dataEntitiesRoutes.ts:53; DataEntityApi.ts:1780-1786; DataEntityServiceImpl.java:466-481,680-684; DataEntityMapperImpl.java:242-253; DataEntityStatusSwitchJob.java:25-30"
        - q: "Does the implementation's scope MATCH each name's promise?"
          a: "All four MATCH from this producer. One guard-rail observation: getPojosForStatusSwitch selects on switch-time alone with NO status filter (any non-null past switch time → DELETED); the invariant 'only DRAFT/DEPRECATED carry switch times' holds because this form is the only UI producer (line 84) and the DELETED write path nulls the column — out-of-band API writers can violate it."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:256-262,110-116; StatusSettingsForm.tsx:83-84"
        - q: "Available-but-unused field matching an input's name?"
          a: "NONE — every assembled field is consumed; inversely, the response consumed by the store patch is the request echo, and the fields the echo CANNOT carry (lineage/group/read-only effects) are exactly what the refetch re-reads."
          confidence: STATIC-INFERRED
          evidence: "DataEntityServiceImpl.java:480; StatusSettingsForm.tsx:94-100"
      routes_to_finding: "bugs_limitations_corner_cases[2] (null switchTime 400), docs_link_semantic.doc_drift_findings[0] (view-count contract around the refetch)"
  probes_emitted: []
  stress_summary:
    triggers_total: 13
    questions_total: 23
    answers_static_inferred: 20
    answers_probe_needed: 0
    answers_reference: 3
    drift_flags: 1
```

## security

- auth_mode_relevance: "LOGIN_FORM | OAUTH2 | LDAP — the control renders only when the per-entity resource-permission fetch grants DATA_ENTITY_STATUS_UPDATE (DataEntityDetails.tsx:74-79,86-92 → WithPermissions.tsx:19-21 → DataEntityDetailsHeader.tsx:113-122). Under DISABLED, permissions resolve empty (runtime-verified 2026-06-11, orchestrator-supplied) → the form is unreachable in the UI even though the PUT itself is open in that mode (backend-owned posture)."
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion."
- authorization_assertions:
  - "UI render gate: `WithPermissions permissionTo={Permission.DATA_ENTITY_STATUS_UPDATE} renderContent={({isAllowedTo}) => <EntityStatus selectable={isAllowedTo} …/>}` — evidence: DataEntityDetailsHeader.tsx:113-122"
  - "API route gate: SecurityRule(DATA_ENTITY, PUT /api/dataentities/{data_entity_id}/statuses, DATA_ENTITY_STATUS_UPDATE) — evidence: SecurityConstants.java:277-281 wired by AuthorizationCustomizer.java:24-28"
  - "No check inside this component — it trusts the mount context (StatusSettingsForm.tsx:1-223 contains no permission read); a second mount point would need to re-apply WithPermissions."
- owner_scoping: "N/A — permission is policy-resolved per resource by the backend permission fetch; this node neither filters nor widens data by owner."
- data_exposure: "Status change parameters only (target status, switch time, propagate flag) → backend; no PII, no free text. Activity feed exposes who changed what status (backend-emitted DATA_ENTITY_STATUS_UPDATED events) — an audit feature, not a leak."
- known_security_gaps:
  - "UI-vs-API asymmetry under DISABLED: control hidden in UI while PUT /statuses is unauthenticated-open (no chain enforces the SecurityRule). Documented platform posture (DISABLED is dev-only per the enable-security docs); recorded for the feature-level merge, owned by the backend endpoint sidecar — not re-filed from this node." — evidence: SecurityConstants.java:277-281 + AuthorizationCustomizer.java:24-30 — severity: LOW

## performance

- hot_paths:
  - "Submit path costs TWO HTTP round-trips by design: PUT /statuses then GET /dataentities/{id} (full detail payload re-read). The GET also pays the server-side view_count UPDATE (DataEntityServiceImpl.java:207). Per-interaction, not per-render — acceptable." — evidence: StatusSettingsForm.tsx:94-100
- throughput_characteristics:
  - "Single-entity dialog; bulk status change exists only via propagate-to-group (one PUT, backend fan-out to members in one transaction)." — evidence: StatusSettingsForm.tsx:86-92; DataEntityServiceImpl.java:468-479
- resource_allocation:
  - "Five instances mounted per details header (one per enum value, menu keepMounted) — five useForm + five react-query mutation states resident while the page is open; settingsMap (5 Date objects) recomputed on each of their renders. Negligible absolute weight; noted because the count is structural, not data-driven." — evidence: SelectableEntityStatus.tsx:57-80; StatusSettingsForm.tsx:51-57
- scaling_characteristics:
  - "Stateless beyond local form state; per-entity scope. The deferred-switch backlog is bounded by the backend job's 10-minute full-table sweep of past-due switch times (backend-owned)." — evidence: DataEntityStatusSwitchJob.java:21-31
- known_performance_gaps:
  - "Each status submit inflates view_count by +1 through the refetch — curation activity is counted as viewing popularity (Popular ranking input). Pre-existing contract (the pre-fix dep-array refetch paid the same +1), unchanged by #1764; flagged for the feature-level view-count semantics discussion." — evidence: StatusSettingsForm.tsx:100 + DataEntityServiceImpl.java:198-208 — severity: LOW

## upstream_callers

- entry_point: "ui_route:/dataentities/{id}/* (details header)"
  caller_node: "odd-platform ts components/shared/elements/EntityStatus/SelectableEntityStatus react-component:SelectableEntityStatus"
  multiplicity_per_trigger: "5 instances mounted per header render (one per DataEntityStatusEnum value, current status included); 1 dialog opened per menu-item click; 1 onSubmit per Apply"
  evidence: "SelectableEntityStatus.tsx:39,66-80 (statusList.map → one StatusSettingsForm per status); DialogWrapper.tsx:94 (open button = cloned menu item)"
  observation_class: ui-call
- entry_point: "ui_route:/dataentities/{id}/* (page mount chain)"
  caller_node: "REFERENCE — understanding/odd-platform__ts__react-component__component__DataEntityDetails.md (page) → DataEntityDetailsHeader (not yet enriched, unresolved: true) → EntityStatus.tsx:20-21 (selectable branch) → SelectableEntityStatus"
  multiplicity_per_trigger: "header renders once per page mount + once per details-store update"
  evidence: "DataEntityDetails.tsx:86-106 (WithPermissionsProvider wraps the header); DataEntityDetailsHeader.tsx:113-122; EntityStatus.tsx:14-26"
  observation_class: ui-call

No other mount points: grep for StatusSettingsForm across odd-platform-ui/src returns SelectableEntityStatus.tsx (mount), DataEntityDetails.tsx (comment reference only), and the component itself.

## downstream_side_effects

- side_effect_class: external-call
  description: "PUT /api/dataentities/{data_entity_id}/statuses with {status, statusSwitchTime?, propagate} — triggers the backend transaction: bulk status update OR soft-delete cascade (lineage + group-entity + group-parent relations + statistics + filled-flag) OR restore of the same, plus unconditional DATA_ENTITY_STATUS_UPDATED activity emission (one event per affected entity — N+1 under propagate)."
  evidence: "StatusSettingsForm.tsx:94; DataEntityApi.ts:1780-1786; DataEntityController.java:193-200; DataEntityInternalStateServiceImpl.java:73-98,106-153"
  cardinality_per_call: "1 PUT; backend events = 1, or (group members + 1) when propagate=true on a DEG"
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (details header)"]
- side_effect_class: cache-mutate
  description: "Redux store patch: byId[dataEntityId].status ← echoed request status (immediate badge update; read-only-affordance selectors like getIsEntityStatusDeleted flip on it)."
  evidence: "StatusSettingsForm.tsx:95; dataentities.slice.ts:73-83; DataEntityDetailsHeader.tsx:48"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (details header)"]
- side_effect_class: external-call
  description: "Explicit GET /api/dataentities/{id} refetch (the #1764 contract) — re-reads the full entity including post-cascade truth; the endpoint includes DELETED entities (includeDeleted(true)), so the page stays rendered after a delete; server-side each call increments view_count by +1 (IT-001 contract, unchanged)."
  evidence: "StatusSettingsForm.tsx:96-100; dataentities.thunks.ts:35-42; ReactiveDataEntityRepositoryImpl.java:217-225; DataEntityServiceImpl.java:198-208"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (details header)"]
- side_effect_class: db-write
  description: "Indirect: +1 data_entity.view_count per submit, paid by the refetch above (curation counted as a view — Popular ranking input)."
  evidence: "DataEntityServiceImpl.java:207,488-494 (incrementViewCount on every getDetails)"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (details header)"]
- side_effect_class: page-render
  description: "Success toast 'Status successfully updated!' (hook onSuccess); dialog auto-close + form reset to '1 day' default; status menu close (handleMenuClose). On failure: global server-error toast, dialog stays open."
  evidence: "lib/hooks/api/dataEntity.ts:151; StatusSettingsForm.tsx:215-217,101; DialogWrapper.tsx:81-83; index.tsx:44-46"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (details header)"]
- side_effect_class: db-write
  description: "Deferred: for DRAFT/DEPRECATED submits, DATA_ENTITY.STATUS_SWITCH_TIME is set; the backend sweep flips the entity to DELETED (full soft-delete cascade) within ~10 minutes after the chosen moment — a user-scheduled future side effect of this form."
  evidence: "StatusSettingsForm.tsx:83-89; DataEntityMapperImpl.java:248; DataEntityStatusSwitchJob.java:21-31"
  cardinality_per_call: "0 or 1 scheduled flip (only DRAFT/DEPRECATED submits)"
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (details header)", "scheduled:DataEntityStatusSwitchJob (executor of the deferred effect)"]

## sources

- understanding ← StatusSettingsForm.tsx:1-223 (full read); StatusSettingsForm.tsx:94-101 (onSubmit chain); StatusSettingsForm.tsx:96-99 (intent comment); DataEntityDetails.tsx:56-68 (removed dep + ownership comment); DataEntityInternalStateServiceImpl.java:73-153 (cascade); grep `useUpdateDataEntityStatus` over odd-platform-ui/src → 2 files (hook + this component)
- concepts.invariants ← StatusSettingsForm.tsx:83-84; DataEntityStatusDto.java:11-16; DataEntityDetailsHeader.tsx:119; DataEntityServiceImpl.java:480,680-684; DialogWrapper.tsx:81-83; SelectableEntityStatus.tsx:39,66-80
- dependencies_semantic ← lib/hooks/api/dataEntity.ts:147-153; dataentities.slice.ts:73-83; dataentities.thunks.ts:35-42; DialogWrapper.tsx:32-104; DialogWrapperStyles.ts:34; routes/dataEntitiesRoutes.ts:47-57; lib/hooks/useAppDateTime.ts:9,37,89; index.tsx:30-48; DataEntityApi.ts:1780-1786
- tests_coverage_semantic ← integration-tests/protocols/IT-002-view-count-ui-overview.md:1-60; integration-tests/protocols/IT-001-view-count-backend-delta.md (path); DataEntityStatusKnownBugTest.java:9-54; grep `*{test,spec}*` for EntityStatus components over odd-platform-ui/src → zero files; grep `status` over odd-platform tests/ → 5 helper files, no status-dialog spec
- docs_link_semantic ← WebFetch 2026-06-11 https://docs.opendatadiscovery.org/features/data-discovery/statuses (200) + https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page (200); drift[0] code side: DataEntityDetails.tsx:56-68 + StatusSettingsForm.tsx:100
- implicit_adrs.[0] ← StatusSettingsForm.tsx:96-100 + DataEntityDetails.tsx:56-60
- implicit_adrs.[1] ← StatusSettingsForm.tsx:94-100 + dataentities.slice.ts:73-83
- implicit_adrs.[2] ← StatusSettingsForm.tsx:208-219 + DataEntityDetailsHeader.tsx:88-100,124-131
- bugs_limitations_corner_cases.[0] ← StatusSettingsForm.tsx:51-57,77-84 + SelectableEntityStatus.tsx:24-28
- bugs_limitations_corner_cases.[1] ← SelectableEntityStatus.tsx:39,66-80 + DataEntityInternalStateServiceImpl.java:79-96
- bugs_limitations_corner_cases.[2] ← StatusSettingsForm.tsx:104-110,139-153 + DataEntityServiceImpl.java:462-465
- bugs_limitations_corner_cases.[3] ← StatusSettingsForm.tsx:125,204-206 + DialogWrapper.tsx:85-90 + DialogWrapperStyles.ts:34
- bugs_limitations_corner_cases.[4] ← StatusSettingsForm.tsx:94-101 + dataentities.thunks.ts:35-42
- bugs_limitations_corner_cases.[5] ← StatusSettingsForm.tsx:77-102 + lib/hooks/api/dataEntity.ts:147-153 + index.tsx:44-46
- bugs_limitations_corner_cases.[6] ← StatusSettingsForm.tsx:118-128,195 + DataEntityDetailsHeader.tsx:3,45
- bugs_limitations_corner_cases.[7] ← DataEntityMapperImpl.java:242-253 + DataEntityStatusKnownBugTest.java:38-54 + ReactiveDataEntityRepositoryImpl.java:110-116
- bugs_limitations_corner_cases.[8] ← SelectableEntityStatus.tsx:32-37 + ReactiveDataEntityRepositoryImpl.java:110-116 + StatusSettingsForm.tsx:84
- security ← DataEntityDetailsHeader.tsx:113-122; WithPermissions.tsx:19-21; usePermissions.ts:10-14; DataEntityDetails.tsx:74-79,86-92; SecurityConstants.java:277-281; AuthorizationCustomizer.java:20-31; orchestrator-supplied runtime verification of DISABLED-mode empty permissions (2026-06-11)
- performance ← StatusSettingsForm.tsx:51-57,94-100; SelectableEntityStatus.tsx:57-80; DataEntityServiceImpl.java:198-208,488-494; DataEntityStatusSwitchJob.java:21-31
- upstream_callers ← SelectableEntityStatus.tsx:39,66-80; EntityStatus.tsx:14-26; DataEntityDetailsHeader.tsx:113-122; DataEntityDetails.tsx:86-106; grep `StatusSettingsForm` over odd-platform-ui/src → 3 files
- downstream_side_effects ← StatusSettingsForm.tsx:94-101; DataEntityApi.ts:1780-1786; DataEntityController.java:193-200; DataEntityServiceImpl.java:458-481,198-208; DataEntityInternalStateServiceImpl.java:73-153; ReactiveDataEntityRepositoryImpl.java:217-225; DataEntityMapperImpl.java:248; DataEntityStatusSwitchJob.java:21-31
- stress_findings ← per-entry evidence inline above

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM  # both pages verified live this session, but WebFetch returns digests; exact on-page sentence boundaries for the drift entry to be re-quoted by the 0.28.0 doc batch
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH  # DISABLED-mode empty-permission claim rests on orchestrator-supplied runtime verification (2026-06-11) + static chain; UI-side chain fully traced
- performance: HIGH
- upstream_callers: MEDIUM  # DataEntityDetailsHeader has no sidecar yet — one unresolved reference in the mount chain
- downstream_side_effects: HIGH
- stress_findings: HIGH  # 20/23 STATIC-INFERRED, 3 REFERENCE to existing backend sidecars, 0 PROBE-NEEDED

## Maintainer notes

