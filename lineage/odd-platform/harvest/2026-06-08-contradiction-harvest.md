# Contradiction Harvest — 2026-06-08

A point-in-time triage of the **contradicted / partial / probe-needed** verdicts across the reflected ODD-platform features (the deepest alignment-drift seam), routed into backlog candidates for the first time. This is the single ranked, deduplicated harvest of per-feature drift-triage findings.

> **POINT-IN-TIME.** Regenerate from `lineage/odd-platform/feature-reflections/detail/*.yaml`; this is **not** a maintained mirror. IDs and `file:line` carried verbatim from the reflections — none invented.

---

## Executive counts

| Metric | Count |
|---|---|
| **Total findings harvested** (non-confirmed verdicts, across all features) | 612 |
| — by route: **bug** | 168 |
| — by route: **caveat** | 246 |
| — by route: **test** | 116 |
| — by route: **dismiss** | 82 |
| **NOVEL** (known=false, route≠dismiss) | 158 |
| **KNOWN** (already tracked, route≠dismiss) | 290 |
| Dismissed (all) | 82 (38 known, 44 novel-but-not-actionable) |

Severity of the actionable (non-dismiss) findings:

| Severity | Count |
|---|---|
| high | 86 |
| medium | 232 |
| low | 212 |

The **NOVEL front queue** below is the actionable output: 158 findings deduplicated to ~95 distinct work-items (cross-feature roots collapsed). Known findings are confirmed convergence (no new action); dismissed are sanity-checked drop reasons.

---

## NOVEL front queue

Every NOVEL finding (known=false, route≠dismiss), grouped by route, ranked by severity then feature. Cross-feature root drifts are collapsed to ONE entry listing all features. Maintainer assigns the actual PLT/DOC/TST number.

### route = bug (code fix — NOVEL)

**HIGH**

- `[high]` **F-006 H-001 cluster — RBAC name-guard holes (create-side + case-mismatch).** `create()` has NO reserved-name guard on Policy **and** Role (re-mint a trusted 'Administrator' after out-of-band soft-delete); update is case-SENSITIVE, delete case-INSENSITIVE, create absent → lowercase 'administrator' is creatable+editable+UNDELETABLE. Fold H-009+H-010 into one name-guard cluster (all 3 verbs uniformly case-insensitive). → bug → **new PLT/SEC-** · cite `RoleServiceImpl.java:51-57` + `PolicyServiceImpl.java:63` + `RoleServiceImpl.java:68` vs `:82`. (PLT-062 narrates the attack but proposes only the audit fix.)
- `[high]` **F-006 H-008 — anonymous RBAC-write under DISABLED.** Shipped `auth.type=DISABLED` lets ANY unauthenticated caller POST a MANAGEMENT/ALL policy+role (full takeover). DOC-239/PLT-020 cover other DISABLED surfaces but not RBAC-write. → bug (caveat-routed in source; deliverable a DOC caveat, enforcing-half IT-009-verified) · cite `DisabledAuthSecurityConfiguration.java:16`.
- `[high]` **F-009 H-008 — notification subscriber thread death undetected.** `NotificationSubscriberStarter` discards the `submit()` Future, no supervisor/liveness — in-process thread death silently kills ALL alerting (JVM holds the lock, no standby promotes). Distinct from PLT-139 (create-order wedge); IT-012 covers only CRASH failover. → bug → **new PLT-** · cite `NotificationSubscriberStarter.java:33`.
- `[high]` **F-009 H-006 — Slack 429 Retry-After ignored.** 1:1 sync POSTs, no batching/rate-limit; Slack 429 undifferentiated from 4xx/5xx, `Retry-After` never read → most burst alerts silently dropped. REFACTOR-129 is lineage-scope only (0 backlog hits). → bug → **new PLT-** · cite `AbstractNotificationSender.java:26`.
- `[high]` **F-009 H-009 — SMTP protocol case-sensitive trap.** `protocol: SMTP` (uppercase, JavaMail convention) falls through `.equals("smtp")`, silently disabling STARTTLS+AUTH (credentials may go plaintext, no boot warning). → bug → **new PLT-** · cite `NotificationConfiguration.java:63`.
- `[high]` **F-021 H-007 — soft-deleting a user-owner mapping orphans/rewrites actor display.** `DELETED_AT IS NULL` on the actor JOIN drops the actor on all that user's past rows; reassignment rewrites attribution. Distinct from PLT-065 (cross-mode bleed) and PLT-031. → bug → **new PLT-** · cite `ReactiveActivityRepositoryImpl.java:220-222`.
- `[high]` **F-021 H-011 — hard-deleting a data entity erases its audit history from reads.** INNER JOIN to DATA_ENTITY drops surviving activity rows from every read path. → bug → **new PLT-** (LEFT JOIN + nullable ref, or mandate soft-delete) · cite `ReactiveActivityRepositoryImpl.java:219`.
- `[high]` **F-022 H-005 / F-057 H-001 / F-059 H-009 — DQ-severity / lookup-rename audit-silence (NOVEL halves).** F-022 H-005: `setDataQATestSeverity` emits no Activity/last_modified_by — a severity flip of a BI-embedded SLA colour is unattributable (PLT-055 draft + DOC-205 done already track — this is KNOWN, see table). The NOVEL bug surfaces are the DESTRUCTIVE-write controls below.
- `[high]` **F-027 H-002 — attachment max-file-size is UI-hint only.** Chunk path enforces no size → direct API callers exceed 20 MB freely (storage-fill DoS + heap pressure). REFACTOR-013 is lineage-only, no PLT. → bug → **new PLT-** · cite `DataEntityAttachmentController.java:54-62` + `FileServiceImpl.java:58-67`.
- `[high]` **F-027 H-004 — attachment GET endpoints ungated.** 3 GET endpoints (list/upload-options/download) have NO SecurityRule → any authed (or DISABLED-anon) user lists+downloads any entity's files by id. PLT-086 explicitly scopes reads OUT; DOC-253 documents, code fix untracked. → bug → **new PLT-** · cite `SecurityConstants.java:249-275`.
- `[high]` **F-027 H-006 — attachment link scheme not allow-listed.** `saveLinks/updateLink` store `url` raw → `javascript:`/`data:` URIs persist (stored-XSS, F-004 family). 'tracked under PLT-086' is STALE/WRONG; `AttachmentLinkSchemeKnownBugTest` pins it but no code-fix item. → bug → **new PLT-** · cite `LinkServiceImpl.java:41-45`.
- `[high]` **F-027 H-007 — attachment fileName path-traversal + CRLF.** `fileName` flows raw into `resolve(fileName)` (LOCAL path escape) and into unquoted `Content-Disposition` (header injection); no sanitisation. TST-003 pins broken behaviour; code-fix PLT explicitly unfiled. → bug → **new PLT-** · cite `FileMapper.java:31` + `LocalFilePathConstructor.java:31-32`.
- `[high]` **F-028 H-006 — namespace name-overflow → 500 not 400.** varchar(64) overflow throws untranslated DatabaseException; `ExceptionUtils` translates only C23 (integrity), not C22 (value-too-long). On combo-box forms it also aborts the parent-entity save. → bug → **new PLT-** (add maxLength:64 + translate value-too-long) · cite `ExceptionUtils.java:30-36` + `V0_0_1__init.sql:13`.
- `[high]` **F-031 H-005 / F-076 H-003 — ConfirmationDialog swallows rejection → stuck spinner-locked modal.** Delete of an actively-ingested DataSource 400s; the shared `ConfirmationDialog` `.catch(()=>{})` leaves the modal open, confirm spinning, no recovery. Shared dialog used by all 3 cascade arms. → bug → **new PLT-** · cite `ConfirmationDialog.tsx:28-34` (`:33` .catch). (PLT-128 is adjacent; F-076 H-003 verdict says known PLT-128 — confirm scope.)
- `[high]` **F-036 H-004 — Title-directory side-door mint.** Typing a novel title on the ownership form mints a permanent platform-wide authz-vocabulary row with NO `TITLE_CREATE` perm, allowlist, or audit. OWNER/TERM/NS side-doors all have PLTs; TITLE does not (DOC-258 doc-only, defers code fix; REFACTOR-206 is substrate-only). → bug → **new PLT/SEC-** · cite `TitleServiceImpl.java:19-22` + `OwnershipServiceImpl.java:53`.
- `[high]` **F-040 H-005 — per-entity run-history size unbounded.** `size` flows bare to SQL LIMIT (size=10000000 honoured) → single-request DoS, amplified by cross-owner read. Same class as PLT-134 (alert read) but DISTINCT endpoint; SHB-011 staged but never promoted. → bug → **new PLT-** · cite `DataEntityRunController.java:21` + `components.yaml:4222-4229`.
- `[high]` **F-090 → see test queue; F-105 H-006 — bare integrations route ships dead control.** `/management/integrations` inherits the chrome's `OWNER_ASSOCIATION_MANAGE` context; a future `hasAccessTo(<integration perm>)` deny-by-defaults. DOC-174 doc-caveat done, code fix deliberately NOT filed. → bug → **new PLT-** (or deliberate no-op) · cite `ManagementRoutes.tsx:150` + `PermissionProvider.tsx:27-32`. **DEDUP: same root as F-161 H-003** (`ManagementRoutes.tsx:150`).
- `[high]` **F-126 H-005 — My-Objects alert tab reports platform-wide count.** Empty owned-alert list but `Page.total` = platform-wide open count (unscoped counter passed to `pageifyResult`). Distinct from PLT-067 (F-015 lineage). → bug → **new PLT-** (`countAlertsWithStatusOpenByOwner`) · cite `ReactiveAlertRepositoryImpl.java:178`.
- `[high]` **F-141 H-001 — IA gap on the home page** *(routed test in source — see test queue).*
- `[high]` **F-141 H-002 — see KNOWN (PLT-077).**
- `[high]` **F-141 H-003 — catalog-overview unbounded CLS.** Skeleton waits only on identity+tags; 4 of 6 widgets pop late and the hero placeholder reflows when MainSearch mounts → unbounded CLS on the platform's first surface. No skeleton/CLS item exists. → bug → **new PLT-** · cite `Overview.tsx:29-32`.
- `[high]` **F-178 H-010 — header status-flip defeats F-044 TTL → see KNOWN (PLT-027).**

**MEDIUM**

- `[medium]` **F-004 H-005 — silent write on missing entity (PUT description 200 no-op).** PUT to a typo'd entity id returns 200 OK empty body, emits no activity event — both blind. Sibling dataset-field path DOES 404. NO tracker ('DOC-GAP-097' ≠ backlog DOC-097). → bug (caveat-vs-404 is a maintainer call) · cite `ReactiveDataEntityRepositoryImpl.java:432-435`.
- `[medium]` **F-006 H-007 / H-011 — PolicyServiceImpl non-transactional + cascade-delete TOCTOU.** `update` is non-transactional read-then-write → silent lost-update (Role side IS `@ReactiveTransactional`, Policy is not); cascade-delete defence is two non-transactional R2DBC calls (race policy into soft-deleted-but-bound). PLT-087 is DataSource-tier, not PolicyServiceImpl. Shares one `@ReactiveTransactional` fix. → bug → **new PLT-** · cite `PolicyServiceImpl.java:72-83` + `:89` vs `:93`.
- `[medium]` **F-009 H-005 — webhook accepts only HTTP 200.** Sender checks `statusCode()!=200` exactly, so any 2xx-non-200 (201/202/204) from an async-accept receiver is treated as failed delivery and the alert is dropped. Not in PLT-016's 6 defects. → bug (accept full 2xx for webhook) · cite `AbstractNotificationSender.java:26`.
- `[medium]` **F-010 H-009 — S3 `deleteFiles().block()` inside jOOQ txn, no timeout.** Reached from inside `transaction(ctx)` on the shared Connection → a hung S3 wedges the whole housekeeping cycle. PLT-118/PLT-083 are distinct. → bug (probe P-310) · cite `DataEntityHousekeepingJob.java:142`.
- `[medium]` **F-011 H-001 — Principal→Owner cross-mode collapse (resolver root).** Keys on `(username, provider)` and collapses ALL non-OAUTH2 modes to `provider=null` → two different people sharing a username across LOGIN_FORM/LDAP resolve to the SAME Owner (silent cross-mode takeover). PLT-065/DOC-245 cover only the READ-SIDE JOIN. **DEDUP: F-011 H-002 (S2S 'ADMIN' literal) is KNOWN PLT-072; this is the resolver root.** → bug → **new PLT-** · cite `AuthIdentityProviderImpl.java:29-33`.
- `[medium]` **F-021 H-004 / F-064 H-008 — `ownerIds` silently dropped for MY_OBJECTS/UPSTREAM/DOWNSTREAM.** Only `fetchAllActivities` receives `ownerIds`; OpenAPI exposes `owner_ids` unconditionally → the owner filter has no effect for 3 of 4 view modes. (F-064 H-008 = same finding, tracked DOC-GAP-141 lineage-only.) → bug (thread it through or drop from spec) · cite `ActivityServiceImpl.java:108-113`.
- `[medium]` **F-021 H-012 — `size` has no clamp on /api/activity.** `size=null` returns the whole table, `size=MAX` a wide scan — DoS for any authed caller. Same CLASS as PLT-134/PLT-042 but novel for activity. → bug (clamp at service `:85`) · cite `ReactiveActivityRepositoryImpl.java:292` + Controller `:26`.
- `[medium]` **F-021 H-014 — multi-facet filter inflation (no DISTINCT).** `tagIds + ownerIds` LEFT JOIN multiplicity surfaces one event N×M times, identical timestamp/payload/actor. e2e tests single-filter only. → bug (DISTINCT or pre-aggregate) · cite `ReactiveActivityRepositoryImpl.java:237-241,290-292`.
- `[medium]` **F-022 H-007 — DQ severity AppSelect mutates on every onChange.** No submit/confirm/pending → reading the value risks an accidental, unaudited reclassification (compounds H-005 audit-silence + H-013 cross-origin colour flip). **DEDUP: same control as F-057 H-010** (`TestReportDetailsOverview.tsx:42-52`). → bug → **new PLT-** · cite `TestReportDetailsOverview.tsx:42-52`.
- `[medium]` **F-022 H-012 — DQ tests endpoint has no pagination.** No page/size in spec/controller/query; thousands of tests = one unbounded payload; UI renders all rows. → bug → **new PLT-** · cite `DataQualityController.java:25-31` + `openapi.yaml:1932-1947`.
- `[medium]` **F-023 H-011 (and F-148/F-040/F-037/F-152 siblings) — see per-feature lines; not collapsed (distinct loci).**
- `[medium]` **F-032 H-005 — DQ Title filter mislabel (binds OWNERSHIP.TITLE_ID).** UI 'Title' filter reads as dataset name; binds to an ownership ROLE ('Data Steward') — confidently-wrong rings, no qualifier (LSN-020). DOC-GAP-264/272 are phantom; DOC-258 is a different finding. Relabel + openapi-desc not in PLT-052. → bug → **new PLT-/DOC-** · cite `ReactiveDataQualityRunsRepositoryImpl.java:301,309` + `TitleFilter.tsx:29`.
- `[medium]` **F-032 H-009 — DQ dashboard never reads isError.** `isError` never read + all-zeros `initialData` → a 4xx/5xx renders three grey 'No data' donuts, pixel-identical to an empty catalog. DOC-334 explicitly EXCLUDES the DQ dashboard. → bug → **new PLT-** · cite `DataQualityContent.tsx:24` + `dataQuality.ts:77-81`.
- `[medium]` **F-038 H-006 — message-url endpoint returns 200/empty (not 404).** Non-existent/non-UUIDv1 id → dead button + authenticated message-existence-by-id oracle (no RBAC). PLT-149 is the same class but DIFFERENT endpoint. → bug → **new PLT-** · cite `DataCollaborationController.java:43-48`.
- `[medium]` **F-058 H-008 / F-026 H-005 / F-059 H-005 — lookup edit-form sends disabled `namespace_name` on the wire.** Edit reuses CREATE-shape `LookupTableFormData`; UPDATE schema is name+description only (server silently discards, behaviour honest). NOVEL (distinct from PLT-087/DOC-255 DataSource side-door, and the phantom 'PLT-191'). Probe PENDING-F-058-1/PENDING-F-026-1 gates discard-vs-reject severity. → bug (discard-vs-reject) / DOC caveat · cite `LookupTableForm.tsx:49,60-66` + `components.yaml:3853-3862`.
- `[medium]` **F-029 H-008 — QueryExample OpenAPI lacks a `name` field.** `QueryExampleFormData/Ref/QueryExample` have no name → the programmatic surface is strictly weaker than the UI. **DEDUP: same root as the F-025/F-131 `name`-field doc-drift (caveat queue).** → bug (cross-tier spec+controller+col) · cite `components.yaml:2729-2776,2799-2808`.
- `[medium]` **F-029 H-009 — `createDataEntityTagsRelations` is replace-all, not additive.** operationId says 'create' but the controller replaces all internal tags → a direct API consumer adding one tag silently deletes every other. Same class as PLT-029 createEnumValue, different locus; UI shields users. → bug → **new PLT-** · cite `openapi.yaml:867-925` + `createDataEntityTagsRelations.md` (DOC-GAP-098).
- `[medium]` **F-031 H-008 — DataSource form discards typed input on backend reject.** `.then(clearState)` runs on failure; thunk never re-throws → modal closes, everything typed lost, only a transient toast. DOC-334 tracks the SYMPTOM doc-side but declines the code fix. → bug (gate clearState on success + errorText) · cite `DataSourceForm.tsx:78-80` + `handleResponseThunk.ts:34-42`.
- `[medium]` **F-040 H-010 — runs-history status filter not in URL.** Lives in `useState` not URL → shared/refreshed links silently lose it (Activity tab uses `useQueryParams`). → bug → **new PLT-** · cite `TestRunsHistory.tsx:29-31`.
- `[medium]` **F-040 H-011 — test-report preview hardcodes 10, no '+N more'.** Older runs silently truncated, no count cue. → bug → **new PLT-** · cite `TestReportDetailsHistory.tsx:30-32`.
- `[medium]` **F-041 H-002 — toolbar renders literal 'admin' under DISABLED, no banner.** Synthetic admin with ALL permissions shown to any anonymous caller; chrome gives no signal the auth wall is off. NOVEL UI-symptom slice (backend root DOC-239/PLT-072). → bug → **new PLT-** · cite `AppToolbar.tsx:74` + `IdentityController.java:30-33`.
- `[medium]` **F-041 H-003 — logout 404s under DISABLED.** Logout item shown in every mode hard-codes GET `/logout`; under DISABLED no Spring logout chain exists. No backlog/issues item names it. **DEDUP: same as F-086 H-010, F-089 (logout-under-DISABLED), F-011 H-008.** → bug → **new PLT-** · cite `AppToolbar.tsx:36` + `DisabledAuthSecurityConfiguration.java:16`.
- `[medium]` **F-041 H-006 / F-043 H-005 / F-148 H-007 — 3 toolbar tab labels (Data Quality / Data Modelling / Master Data) have NO i18n key in any locale.** `t()` returns the raw English literal. PLT-092 is SearchResultsTabs (different site); PLT-011 is fallbackLng order. (F-148 H-007 `SearchResultsTabs.tsx` IS PLT-092 — KNOWN; this is the ToolbarTabs locus.) → bug → **new PLT-** · cite `ToolbarTabs.tsx:46,51,56` + `en.json`/`ua.json`.
- `[medium]` **F-057 H-010 — DQ severity zero-friction destructive write.** AppSelect onChange dispatches immediately, no Save/confirm, dispatch unawaited → UI optimistically shows a severity the backend never stored; flips cross-tenant SLA RED. → bug → **new PLT-** · cite `TestReportDetailsOverview.tsx:42-52,81-85`. (Same control family as F-022 H-007.)
- `[medium]` **F-074 H-006 — owner-association activity-log (forensic) endpoint ungated.** GET `/owner_association_request/activity` is ungated while its less-sensitive pending-list sibling requires `OWNER_ASSOCIATION_MANAGE`. Reflection's PLT-054 dedup is WRONG (Slack HMAC). Fix conflicts with ADR-0003's exactly-one-GET-rule contract test. **DEDUP: same finding as F-174 H-007.** → bug → **new PLT-** · cite `SecurityConstants.java:148-150`.
- `[medium]` **F-075 H-002/H-003 — DIRECT_OWNER_SYNC self-mint + self-bind privilege chain.** A `DIRECT_OWNER_SYNC` holder mints an arbitrary Owner (no `OWNER_CREATE`) and self-binds in one POST; auto-approve keys on the permission alone with no OIDC group cross-check. PLT-125 fixes the mint half only; the `createRelation`-under-permission branch is unowned. → bug → **new PLT-** · cite `OwnerAssociationRequestServiceImpl.java:57,60-67`.
- `[medium]` **F-084 H-003 — GitHub admin-detection token-scope failure.** Missing `read:org`: org-name-set propagates the 403 (no `onErrorResume`) → whole login fails; org-name-unset → admin-groups silent no-op. No boot validation. Net-new under PLT-082/PLT-069 boot-validation theme. **DEDUP: same as F-124 H-003.** → bug → **new PLT-** · cite `GithubUserHandler.java:76-91,68`.
- `[medium]` **F-086 H-004 / F-089 H-006 — Cognito empty logout-uri returns before session invalidate.** `Mono.empty()` at L33-35 precedes `WebSession::invalidate` at L49 → user clicks logout, stays signed in, no error. Distinct from PLT-073 (no-revoke) & PLT-130 (Azure NPE). → bug → **new PLT-** · cite `CognitoLogoutSuccessHandler.java:33-35`.
- `[medium]` **F-098 H-007 — Slack-events malformed JSON may surface 5xx.** Unguarded `deserializeJson` + unchecked cast over the global WebFlux handler → Slack reads 5xx as 'retry', amplifying load (probe PENDING-F-098-1). → bug (confirm 4xx vs 5xx) · cite `SlackEventParser.java:22-23,:45`.
- `[medium]` **F-098 H-008 — Slack-events no body-size cap / no rate limit.** Unauthenticated; a forged flood fills the JSONB event table and starves the single-leader processor (probe PENDING-F-098-2). → bug (load probe) · cite `EventApiController.java:23-24` + `V0_0_59:32`.
- `[medium]` **F-104 H-004 — OwnerAssociations tab switch wipes the username search.** `setQuery('') + invalidateQueries` on an in-feature tab click, no URL cushion — privileged triage flow. Distinct from PLT-058 (Term Detail tabs). → bug → **new PLT-** · cite `OwnerAssociationsTabs.tsx:44-47`.
- `[medium]` **F-119 H-010 — see KNOWN (PLT-088 WCAG).**
- `[medium]` **F-120 H-008 — no R2DBC pool Micrometer gauge.** `R2DBCConfiguration` registers no MeterBinder → no acquired/allocated/pending gauge on /actuator/prometheus. (DOC-335 Micrometer ref is the F-121 scheduler, unrelated.) → bug/PERF → **new PLT-** · cite `R2DBCConfiguration.java` (full file) + `application.yml:226-257`.
- `[medium]` **F-120 H-004 — Lookup custom connection-pool instantiated unconditionally.** `customConnectionPool` has no `@ConditionalOnProperty` (contrast `HousekeepingJobManager.java:18`) → holds connections perpetually even when Lookup Tables unused. → bug (gate the bean) · cite `R2DBCConfiguration.java:54`.
- `[medium]` **F-126 H-011 (and F-040 H-012, F-021 H-008, F-174 H-010) — OFFSET pagination skip/dup on non-unique order key (probe).** Single-key `ORDER BY ...DESC` with no id tiebreaker; concurrent create/resolve mid-scroll. → see test queue (probe-gated).
- `[medium]` **F-131 H-006 / F-025 H-008 / F-155 H-008 — see test/caveat queues (cache-invalidation + per-parent hasNext).**
- `[medium]` **F-148 H-005 — see KNOWN (Search.tsx debouncer is F-017/probe P-187, NOT PLT-017).**
- `[medium]` **F-148 H-006 — class-tab click is a facet PUT with no URL push.** Browser Back leaves /search entirely; tab state not URL-addressable. Distinct from DOC-260 Caveat-1 and PLT-150. → bug (URL-push per tab or relabel) · cite `Results.tsx:83-100`.
- `[medium]` **F-161 H-003 — bare integrations route ships dead control.** *(DEDUP: collapsed into F-105 H-006 above; same `ManagementRoutes.tsx:150` root.)*
- `[medium]` **F-162 H-004 — wizard INTEGER field unvalidated.** `validate` runs only on the string branch → negatives/decimals/NaN-on-paste pass Configure into `collector_config.yaml`. Tracked only as Queued scanner finding F-162a. → bug → **new PLT-** · cite `IntegrationCodeSnippetWithForm.tsx:86-90,:101`.
- `[medium]` **F-163 H-004/H-005/H-007/H-008 — token-reveal UI cluster (4 NOVEL halves).** (a) Regenerate dialog body names only the entity, no no-grace/break-running-collector warning [H-004, high]; (b) one-shot plaintext banner vanishes on ANY list refetch, forcing destructive re-rotation to recover [H-005]; (c) masked/plaintext detection is a duplicated `substring(0,6)==='******'` bet, no shared const/server flag — a future mask change breaks both tabs at once [H-007]; (d) plaintext rendered into a plain DOM text node (no `type=password`/reveal-on-hover), held in redux [H-008 — Cache-Control half is KNOWN PLT-087]. PLT-108=backend no-grace; PLT-038=different dialog grammar. → bug → **new PLT-** (consolidate) · cite `DataSourceItemToken.tsx:25-49` + `CollectorItemToken.tsx:25-49`.
- `[medium]` **F-171 H-006 — per-row Accept auto-declines every other PENDING for the same Owner.** No dialog/UI/doc disclosure. Doc-side DOC-327 (pending); code/dialog-side PLT absent (PLT-148 unrelated). → bug → **new PLT-** · cite `OwnerAssociationRequestServiceImpl.java:192-203`.
- `[medium]` **F-172 H-006 — admin manual-bind no success toast / no redirect.** Only signal is the modal closing → operator may re-submit, polluting History with a duplicate audit row. PLT-122 is the consumer surface, not this admin form. → bug → **new PLT-** (UI-polish) · cite `OwnerAssociationForm.tsx:108`.
- `[medium]` **F-173 H-002 — see KNOWN (PLT-040).**
- `[medium]` **F-173 H-006 — see KNOWN (DOC-328 doc + PLT-062 code).**
- `[medium]` **F-192 H-004/H-007 — see KNOWN (PLT-029).**
- `[medium]` **F-197 H-007 — Discussions empty-state hardcoded English.** `'No messages'` not `t()`-wrapped (sibling `LinkedItemsList` is). → bug (one-line i18n) · cite `MessagesList.tsx:70`.

**LOW**

- `[low]` **F-008 H-001 (regression-pin), F-035 H-010 (React key collision), F-122 H-011 (actuator cross-link) — see respective per-feature lines.**
- `[low]` **F-035 H-010 — operator-links React key collision.** `key={link.url}` → console warning always + one label silently de-duplicated for two links sharing a URL. REFACTOR-629 is lineage-only (not filed); PLT-088 doesn't cover this render-drop. → bug (fold into the PLT-088 UI PR) · cite `AppInfoMenu.tsx:61`.
- `[low]` **F-035 H-012 — AppInfoMenu silent absence on failed `/api/links`.** Destructures only `{data}` (no `isError`/`isLoading`) → query failure indistinguishable from empty config. DOC-334 covers the doc-side CLASS; the AppInfoMenu code fix is in neither PLT-088 nor DOC-334. → bug · cite `AppInfoMenu.tsx:17-18`.
- `[low]` **F-039 H-009 — GenAI unwrap leaks raw JSON.** `unescapeJava(trim('"'))` assumes a bare JSON-quoted string → `{"answer":"x"}` leaks raw JSON to the caller at 200. Not in PLT-020/PLT-008/DOC-080 (probe PENDING-F-039-1). → bug (parse JsonNode + doc the contract) · cite `GenAIServiceImpl.java:46-47`.
- `[low]` **F-039 H-010 — GenAI outbound 256KB codec cap.** OUTBOUND response codec uses the WebFlux 256KB default (no `.codecs` override) → long answers >256KB fail 500; 80x doc-vs-code gap. DOC-080 documents the 500 exists, not the cause (probe PENDING-F-039-2). → bug (`.codecs` override + paired doc) · cite `WebClientConfiguration.java:26-29`.
- `[low]` **F-043 H-004 — language-switcher filters only the English friendly-name.** A non-English user typing 'Español'/'Українська' gets an empty list — the one control to escape English is navigable only in English. → bug (extend filter w/ native-name map) · cite `SelectLanguage.tsx:48-50`.
- `[low]` **F-074 H-008 — see test queue (LDAP hidden-tab IT runs wrong posture).**
- `[low]` **F-110 — (no F-110 in input).**
- `[low]` **F-122 H-011 — actuator exposure not cross-linked from LOGIN_FORM/OAUTH2/LDAP auth pages.** DISABLED page (DOC-239) + deployment-config (DOC-242) covered; no item cross-links the other auth-mode pages → `/actuator/env` reachability. → DOC caveat (routed caveat; novel) · cite `concept-invariant:217-222` + `SecurityConstants.java:96`.

### route = caveat (documentation-pillar work — NOVEL)

**HIGH**

- `[high]` **F-018 H-007 — no server-side tag-name validation (any of 4 write paths).** No length cap/charset/trim → directory is a pollution/DoS surface; `' tag '`/`'tag'` mint distinct rows. PLT-142 is stats-ingestion (different endpoint). → caveat + server-side cap/trim + DB CHECK · cite `components.yaml:337-345` + `TagServiceImpl.java:144-159`.
- `[high]` **F-090 H-008 — remediation docs name a NAMESPACE contextual perm the enum lacks (and drop QUERY_EXAMPLE).** DOC-243 (done+live), DOC-240:33, SPC-002:43 all say DATA_ENTITY/NAMESPACE/TERM; code is DATA_ENTITY/TERM/QUERY_EXAMPLE. Implementing verbatim adds a non-dispatchable NAMESPACE + drops the real QUERY_EXAMPLE = 2 new drifts for 1 closed. **May be a LIVE published-doc error.** → caveat (gate SPC-002 Facet 2; correct the live page) · cite `PolicyTypeDto.java:9-12` vs `DOC-243:32` + `DOC-240:33` + `SPC-002:43`.
- `[high]` **F-120 H-002/H-003/H-005 — R2DBC default pool ceiling undocumented + replica×2 doubling.** Ships an undocumented framework default (maxSize=10 × 2 pools = 20/replica); 5 replicas × 20 = 100 exhausts PG `max_connections=100`; one `R2dbcProperties.Pool` feeds BOTH pools so a `max-size` override yields 2N. DOC-249 names the key + auth sizing but NOT the default value/×2/replica-sizing-table. → caveat (extend DOC-249 + a replica→max_connections table) · cite `application.yml:251-252` + `R2DBCConfiguration.java:38,46,72,80`.

**MEDIUM**

- `[medium]` **F-001 H-009 / F-141 H-008 — 'Recommended' implies personalisation; Popular is catalog-wide.** Every user sees an identical strip; other teams' entity names/alert-state surface on the home page. DOC-260 is the SEARCH page; DOC-186 reframes Popular structurally but omits the cross-owner-on-home caveat. (F-141 H-008 partly homed at DOC-323.) → caveat (catalog-overview personalisation note) · cite `DataEntityController.java:307-313` + `ReactiveDataEntityRepositoryImpl.java:629-649`.
- `[medium]` **F-008 H-008 — sync-no-202 ingestion + timeout-sizing.** *(see F-096 H-008 dedup below.)*
- `[medium]` **F-009 H-010 — email channel omits owners + downstream.** `email.ftlh` template omits both (only Slack renders them) → an email-only on-call runbook is misled during an incident. DOC-180 covers PII-passthrough, not this parity over-promise. → caveat (state email omits) or add to template · cite `EmailNotificationSender.java:64-78` + `templates/email.ftlh`.
- `[medium]` **F-009 H-013 — notification recipient list immutable until restart.** `@Value` constructor binding; Actuator `/refresh` doesn't cover it → rotating a leaked Slack/webhook URL needs a restart. PLT-068 unrelated. → caveat (config-and-deployment notifications section) · cite `NotificationConfiguration.java:104`.
- `[medium]` **F-010 H-010 — housekeeping observability absence.** A subsystem that permanently deletes data exposes no metric/audit/backlog gauge (debug-only logs, 0 Micrometer) → operators can't observe deletions or detect a stuck cycle; compliance 'deletions logged' unmet. → caveat + `housekeeping_deleted_total` + structured audit event · cite `HousekeepingJobManager.java:30,45`.
- `[medium]` **F-011 H-012 — no cross-auth-mode migration runbook.** `(alice,null)` under LOGIN_FORM ≠ `(alice,github)` under OAUTH2 → a LOGIN_FORM→OAUTH2 migration silently orphans every mapping; no runbook. DOC-312 is GitHub-rename-only; DOC-245/272 are activity-feed bleed. **DEDUP: F-124 H-010 (LDAP migration) is the same class (probe-routed).** → caveat (provider-column backfill runbook) · cite `AuthIdentityProviderImpl.java:29-33` + `RUOMRepoImpl.java:116-127`.
- `[medium]` **F-021 H-013 — `/api/activity/counts` non-transactional 4-way zip.** Overlapping sets → total ≠ my+upstream+downstream, undocumented. → caveat (activity-feed.md + OpenAPI counts desc) · cite `ActivityServiceImpl.java:149-165`.
- `[medium]` **F-022 H-009 — SLA PNG badge sets no ETag/Cache-Control.** A BI dashboard with N auto-refreshing tiles re-runs N SQL aggregations every render, no 304 path. Body is state-derived (ETag computable). → caveat (sla-statuses BI-embed) + perf bug-candidate · cite `CachingByteArraySLAResourceResolver.java:18-25` + `DataQualityController.java:25-68`.
- `[medium]` **F-022 H-014 — DQ expectation params dumped unredacted.** `JSON.stringify(expectation)` → GE/dbt expectations can embed failed-row samples (PII) shown verbatim to any cross-owner viewer. DOC-185 is the sibling runs-history `status_reason` leak (different channel). → caveat + redact · cite `TestReportDetailsOverview.tsx:54`.
- `[medium]` **F-032 H-002/H-003 — DQ dashboard doc silent on who-can-view + DISABLED-anon reach.** Every live DQ doc page is silent on access control; under DISABLED an anon caller reaches `/data-quality` + the full aggregate + every owner/namespace/tag autocomplete. DOC-GAP-263/082 are phantom/META; no backlog item edits `dashboard.md` for this surface. → caveat (dashboard.md who-can-view + DISABLED note) · cite `DataQualityRunsController.java:13-34` + `DisabledAuthSecurityConfiguration`.
- `[medium]` **F-035 H-009 — operator-links DISABLED-anon exposure + no per-role scope.** `/api/links` absent from WHITELIST → default authenticated(); DISABLED short-circuits to anonymous; no per-role visibility. DOC-257 ships global-visibility but not these two angles (DOC-GAP-285 is lineage-only). → caveat · cite `DisabledAuthSecurityConfiguration.java:16`.
- `[medium]` **F-040 H-008 — per-test soft-deleted run history 404s (diverges from F-022).** Bare `get()` excludes soft-deleted; the sibling F-022 surface uses `existsIncludingSoftDeleted`. → caveat (document or align) · cite `DataEntityRunServiceImpl.java:32`.
- `[medium]` **F-041 H-010 — UI language browser-local only, no server/profile binding.** localStorage `i18nextLng`, resets to English on a new device; `navigator.language` never consulted on first visit. DOC-278 flags only the missing 'Multilingual UI' page (coverage), not the no-persistence behaviour. **DEDUP: F-043 H-002 is the same (but KNOWN DOC-171); this is the persistence-axis novel angle on the toolbar.** → caveat · cite `SelectLanguage.tsx:30` + `locales/i18n.ts:22`.
- `[medium]` **F-064 H-009 — no platform-wide 'you are not bound to an Owner' signal.** Every My view (Activity/Alerts/Overview) degrades independently to a generic empty-state; REFACTOR-224 covers only the DataEntity `/my` locus. → caveat / shared `<EmptyStateAffordance>` (highest-leverage cross-feature) · cite `AuthIdentityProviderImpl.java:49-53`.
- `[medium]` **F-074 H-008 — see test queue (Owner.name PII is KNOWN DOC-251).**
- `[medium]` **F-085 H-008 — DISABLED dummy stuffs the ENTIRE Permission enum (incl. resource-contextual).** The authenticated MANAGEMENT extractor never does this — asymmetric mechanism behind the symmetric 'everything unlocks'. Untracked vs DOC-239/240/SPC-002. → caveat (disabled-authentication.md global-vs-resource perm asymmetry) · cite `IdentityController.java:32` vs `IdentityServiceImpl.java:42`.
- `[medium]` **F-086 H-009 / F-089 H-007 — logout end-session redirect carries no state/nonce (CSRF).** No handler emits state/nonce (OIDC RP-Initiated Logout §5) → logout-CSRF feasible; compounds with the open-redirect (PLT-075). Zero backlog hits. → caveat (oauth2-oidc.md) or fold a LOW note into PLT-075 · cite `AzureLogoutSuccessHandler.java:38-44` + `CognitoLogoutSuccessHandler.java:40-46`.
- `[medium]` **F-087 H-010 — REDIS session health not wired.** `management.health.redis.enabled` ships `false` and the REDIS branch wires no health → 5xx storm while /actuator/health stays green. PLT-078/PLT-089 are different families. → caveat (odd-platform REDIS subsection) · cite `application.yml:245` + `SessionConfiguration.java:61-65`.
- `[medium]` **F-088 H-009 — S2S token is one static shared secret (per-caller enhancement).** No per-caller token/scope/expiry/live-reload; rotation needs a restart; one leak compromises every caller. Rotation LIMITATION is doc-disclosed (DOC-003/172); the per-caller/rotatable-token CODE enhancement is untracked. → caveat (+ REFACTOR candidate) · cite `S2sTokenProvider.java:10,15-21`.
- `[medium]` **F-095 H-012 — stats-ingestion FTS recompute on a lying parent (DoS amplifier).** Fires on the payload's declared parent even when ZERO fields resolve. PLT-044/DOC-194 mention FTS-on-parent only as a side-effect, not a standalone no-early-exit amplifier. → caveat + fold early-exit into PLT-044 · cite `DatasetFieldServiceImpl.java:179`.
- `[medium]` **F-096 H-008 — sync ingestion, no 202/queue/status endpoint.** Caller must size client read-timeout to the platform worst-case per-batch time. DOC-195 doesn't cover sync-no-202/timeout; SPC-003 names it only for the spec error-schema. **DEDUP: F-008 H-008 is the same finding.** → caveat (DOC item) · cite `IngestionController.java:44` + `IngestionServiceImpl.java:67-73`.
- `[medium]` **F-105 H-008 — non-admin Policy search shows frozen unfiltered total.** 'N policies overall' beside fewer rows, no caption distinguishing overall-vs-matching. Narrowing itself is correct. → caveat (UI-copy/doc) · cite `PolicyList.tsx:43-44,:78`.
- `[medium]` **F-123 cluster — platform-wide deletion-semantics gaps (NOVEL halves).** (a) `collector.name` is FULL UNIQUE → delete-then-recreate by name permanently blocked [H-002, high — bug]; (b) INTERNAL `metadata_field` name re-create fails post-soft-delete (partial indexes filter origin only) [H-003, high — bug; **DEDUP with F-046 H-010**]; (c) `getDtosByDataEntityId` lacks the deleted_at filter → ghost custom-metadata fields render on entity pages [H-008, medium — bug; **DEDUP with F-046 H-008**]; (d) ownership hard-delete recoverable only via the activity feed (TTL-bounded) [H-005, caveat]; (e) no per-resource deletion-contract table in any DOC item [H-011, caveat]. → mixed bug+caveat → **new PLT-/DOC-** · cite `V0_0_29__add_collector.sql:4`, `V0_0_1__init.sql:242-244`, `ReactiveMetadataFieldRepositoryImpl.java:116-117`, `ReactiveOwnershipRepositoryImpl.java:85-91`.
- `[medium]` **F-146 H-009 / F-040 H-013 / F-176 H-010 / F-191 H-010 / F-208 H-011 — see per-feature lines (UX/perf/probe).**
- `[medium]` **F-176 H-008 — Overview metadata conflates collector vs operator fields.** Predefined (collector) + custom (operator) shown in one undifferentiated list, no origin cue; only the custom side is edit-gated. DOC-189/190 cover custom metadata but not the audience-conflation/origin-cue facet. → caveat · cite `OverviewMetadata.tsx:26`.
- `[medium]` **F-178 H-011 — header concentrates up to 8 affordances, no progressive disclosure.** Coarse lg=7/lg=5 split only; no overflow menu/categorisation; `flexWrap='nowrap'` truncation risk on narrow viewports. DOC-263 covers only F-177c CLASS-badge overflow. → caveat/REFACTOR · cite `DataEntityDetailsHeader.tsx:73-148`.
- `[medium]` **F-206 H-009 — class-chip palette non-bijective.** 6 of 9 classes collapse to 3 colours (GROUP=RELATIONSHIP=lightGreen5; also purple5/orange5 pairs). `*_RUN` collisions defensible; GROUP/RELATIONSHIP is not. Distinct from PLT-094 D5 (TYPE-badge has-no-colour). Not in shipped DOC-263. → caveat (or palette fix) · cite `theme/palette.ts:111-112`.
- `[medium]` **F-207 H-007/H-008 — UI affordance-visibility diverges from backend grant (DISABLED + LOGIN_FORM).** Under DISABLED the UI hides every mutation button (empty perms) while writes are permitAll → empty-button UI says 'locked down', API is wide open; under LOGIN_FORM every credential is static ADMIN so the UI shows every button and policy-revocation is a no-op. Reflection's PLT-031 dedup is WRONG. Backend posture tracked (DOC-239/237); the UI-DECEPTION angle is novel. → caveat · cite `DisabledAuthSecurityConfiguration.java:13-17` + `WithPermissions.tsx:28` + `LoginFormSecurityConfiguration.java:74-82`.
- `[medium]` **F-208 H-012 / H-011 — staleness signal forgeable + per-request compute may cache.** Predicate reads `lastIngestedAt` only, no source-provenance check → any `INGESTION_WRITE` principal marks any entity fresh (DOC-264 Caveat 5 covers this — KNOWN); whether an HTTP/CDN cache freezes `is_stale` is unverified (probe PENDING-F-208-1). → see test queue for H-011.

**LOW**

- `[low]` **F-004 H-002 — PUT echo reflects the REQUEST payload, not stored value.** Whitespace echoes `'   '` while the column stores NULL (UI reconciles on GET). DOC-187 notes the empty→NULL collapse but not the response-echoes-request decoupling. → caveat (programmatic-client) · cite `DataEntityServiceImpl.java:329-331` + `ReactiveDataEntityRepositoryImpl.java:431`.
- `[low]` **F-004 H-011 — entity-description editor: no draft/autosave/confirm on Cancel.** Silently re-syncs to last-saved. DOC-193/232 cover SIBLING per-column/Query-Example dirty-forms, not this editor. → caveat (confirm-discard prompt) · cite `useTermWiki.ts:46-49` + `InternalDescriptionEdit.tsx:35`.
- `[low]` **F-004 H-010 — UI/backend [[ns:term]] regex divergence.** UI requires non-empty groups, backend allows empty → `[[:foo]]` invisible to UI, parsed by backend. → caveat (programmatic-caller) · cite `TermServiceImpl.java:67` vs `lib/constants.ts:177`.
- `[low]` **F-004 H-012 — description length: only implicit 256KB codec + FTS-rebuild + 2× activity-row store.** No `@Size`/maxLength; unbounded text column; generic 413/500. DOC-187 notes the bare 'no length cap' fact, not the operational caveat. → caveat · cite `components.yaml:2188-2194` + `V0_0_1__init.sql:80`.
- `[low]` **F-005 H-004 — `expanded_entity_ids` accepts ANY entity id.** API-ref says 'Data Entity Group ids only'; code joins `DATA_ENTITY.ID.in(rootIds)` with no class filter. DOC-087 only moved the prose; DOC-225/320 don't cover this wrong-id wording. → caveat (accuracy fix) · cite `ReactiveLineageRepositoryImpl.java:134-148`.
- `[low]` **F-015 H-010 / H-011 — see test queue (unstable pagination) + caveat (hollow/soft-delete silent exclusion).** H-011: hollow stubs + soft-deleted neighbours silently elided with NO tombstone signal, UNDOCUMENTED (4/5 triplet caveats documented, this one missing). → caveat (5th hint on data-lineage.md) · cite `ReactiveDataEntityRepositoryImpl.java:237-245` + `DataEntityServiceImpl.java:223`.
- `[low]` **F-016 H-005 — DEG-lineage 404 conflates 3 conditions** *(KNOWN DOC-225)* — skip.
- `[low]` **F-018 H-002 — `getPopularTagList ids` reuses shared IdsParam ('Entity ids').** A spec consumer supplying entity ids gets empty results. Absent from SPC-001/002/003. → caveat (TagIdsParam or op-level desc) · cite `components.yaml:4239-4248` vs `ReactiveTagRepositoryImpl.java:141-142`.
- `[low]` **F-018 H-012 — PUT /api/tags/{id} returns Tag with external/usedCount null.** Bare-pojo overload; the sibling GET populates them — response-shape inconsistency on the same type. → caveat (api-reference) or small re-read-TagDto fix · cite `TagServiceImpl.java:54` + `TagMapper.java:26` vs `:24`.
- `[low]` **F-024 H-007 — Dictionary facet-click then Enter can drop the just-clicked facet.** Text PUT ships `filters:{}`, client slice last-write-wins; server merges (loss is client round-trip). → caveat or fix text-submit to preserve filters · cite `TermSearchServiceImpl.java:84-86`.
- `[low]` **F-024 H-013 — single 'No matches found' for both fresh-empty-catalog and filtered-zero.** Day-one operator can't tell 'add your first term' from 'my search missed'. → caveat / small UI fix · cite `TermSearchResults.tsx:105-107`.
- `[low]` **F-025 H-009 — see KNOWN (SPC-001 201-vs-200).**
- `[low]` **F-025 H-011 / F-029 H-008 / F-131 H-011 — QueryExample has no `name` field (doc-drift + spec gap).** Live `query-examples.md:13` says snippets have 'a name, description, and the query body'; the form has only Definition + Query (id-titled). DOC-232 added caveats but didn't fix this claim. **DEDUP across F-025/F-029/F-131** (F-029 H-008 is the spec/code half — bug queue). → caveat (correct the live page) · cite `query-examples.md:13` vs `QueryExampleForm.tsx:79-113`.
- `[low]` **F-027 H-008 — token plaintext at rest (Collector orphan half)** *(KNOWN PLT-085/087)* — skip.
- `[low]` **F-031 H-004 — disabled ODDRN field, no inline help** *(KNOWN DOC-324)* — skip.
- `[low]` **F-035 H-011 — 4 hardcoded English menu labels bypass i18n.** Owned by F-043's i18n set; no standalone PLT/DOC. Cosmetic. → route to F-043 i18n test set · cite `AppInfoMenu.tsx:48,100,108,117`.
- `[low]` **F-036 H-002 / H-008 — Title autocomplete id-ASC window clipping.** Server hardcodes id-ASC (oldest first); UI `size=30` against id-ASC makes any title past the 30 oldest unreachable by autocomplete regardless of query (feeds duplicate creation, H-004/H-005). → caveat (+ server-side query echo >30) / test · cite `OwnerTitleAutocomplete.tsx:43` + `ReactiveAbstractCRUDRepository.java:90-91`.
- `[low]` **F-036 H-009 — Title read-then-insert race → opaque 400 USR003.** Concurrent first-create of a brand-new title rolls back the WHOLE ownership grant; no ON CONFLICT. → caveat · cite `TitleServiceImpl.java:19-22`.
- `[low]` **F-036 H-011 — DEG-propagated title change emits no per-child Activity event.** Only the parent OWNERSHIP_* fires; `propagateOwnership` (private) has no `@ActivityLog`. DOC-181 covers a different gap. → caveat (cross-ref F-006) · cite `OwnershipServiceImpl.java:48` + `:121-149`.
- `[low]` **F-046 H-008 / F-013 H-005 — OpenAPI `origin` field silently dropped on metadata upsert.** Impl reads only `getValue()`; `origin` in the request schema is dropped. DOC-189 mentions origin only as a schema field. → caveat (custom-metadata.md API) · cite `DataEntityServiceImpl.java:292-294`.
- `[low]` **F-046 H-008 (TOCTOU) / F-013 H-013 — UI getOrCreate metadata-field bulkCreate no ON CONFLICT.** Concurrent same-name save: loser's ENTIRE @Transactional save rolls back (ingestData path tolerates it). → caveat (DOC-189) or PLT-025 Defect 6; probe PENDING-F-013-1 · cite `MetadataFieldServiceImpl.java:46-57` vs `:98-104`.
- `[low]` **F-046 H-010 / F-013 H-012 / F-123 H-003+H-008 — soft-deleted INTERNAL field name is a permanent create-blocker + ghost render.** `ix_unique_internal_name` predicate is origin-only (V0_0_64 added the column but not the index predicate; Tag was fixed, metadata_field was not); `getDtosByDataEntityId` lacks the deleted_at filter. **DEDUP: this is the same root as F-123 H-003+H-008.** → bug (add `WHERE deleted_at IS NULL` to index + read filter) · cite `V0_0_1__init.sql:242-244` + `ReactiveMetadataFieldRepositoryImpl.java:112-121,116-117`.
- `[low]` **F-046 H-011 / F-013 H-011 / F-018 H-003 — metadata/tag field case-sensitivity asymmetry.** Search case-INSENSITIVE, create/store case-SENSITIVE → `cost_centre`/`Cost_centre` coexist; no merge path. DOC-189 warns names are case-sensitive but NOT that search disagrees with store. → caveat (extend) + normalise-on-create candidate · cite `ReactiveMetadataFieldRepositoryImpl.java:48` vs `:65`.
- `[low]` **F-054 — (all KNOWN; no novel non-dismiss).**
- `[low]` **F-064 H-007 — admin first-login self-association trap.** No auth-mode auto-creates `user_owner_mapping`; no setup-wizard prompt → admin onboarding dead-end. Doc-side closed by the activity-feed pre-flight checklist; residual is the in-product self-association affordance. → caveat (SME-consult flagged) · cite `AuthIdentityProviderImpl.java:49-53`.
- `[low]` **F-065 H-011 — `acquire(id, boolean)` 2nd arg is replicationConnection, not a blocking flag.** Always blocking; callsites `acquire(id,false)/(id,true)` misread as a wedge-safety toggle. Maintainer-facing clarity only. → caveat (javadoc on `acquire()`, fold into PLT-089) · cite `PostgreSQLLeaderElectionManagerImpl.java:18-23`.
- `[low]` **F-074 H-010 — OpenAPI titles GET declares only 200 (no 403).** Accidentally consistent with no-read-gate intent but never states it; integrator may add dead 403-handling. → caveat (optional, thin) · cite `openapi.yaml:332-338`.
- `[low]` **F-076 H-002 — Owner/Namespace delete dialogs say 'deleted permanently' but it's a blockable soft-delete.** DataSourceItem dialog does NOT say 'permanently' (reflection's 'all three' imprecise). Dialog-COPY fix untracked (PLT-038 is a different dialog; DOC-211/255 doc-side only). → bug (dialog copy) · cite `EditableOwnerItem.tsx:61` + `EditableNamespaceItem.tsx:53`.
- `[low]` **F-076 H-011 — Owner delete no switchIfEmpty(NotFound) → silent 204 on missing owner.** Data layer idempotent; contract-clarity gap. Untracked (distinct from PLT-087). → caveat (api-reference) · cite `OwnerServiceImpl.java:89-100`.
- `[low]` **F-085 H-009 — whoami response shape is a wrapper, docs show it flattened.** Actual `{identity:{username,permissions},owner,associationRequest}`; a client coding `response.username` reads undefined. BROADER than reflection: shipped on BOTH disabled-authentication.md (DOC-239) AND api-reference.md (DOC-240). → caveat (fix both) · cite `IdentityController.java:31`.
- `[low]` **F-087 H-011 — misspelled `session.provider` no fail-fast.** Exact-literal condition → no repository bean, no WARN (unset→IN_MEMORY, typo silently breaks via downstream failure). PLT-089 is a different config family. → caveat · cite `SessionConfiguration.java:55-57,62`.
- `[low]` **F-088 H-006 — cookie-vs-key precedence under LOGIN_FORM undocumented.** Both session cookie + X-API-Key → resolves to ADMIN (key wins). DOC-172:40 explicitly lists this as NOT-folded. → caveat (s2s.md) · cite `LoginFormSecurityConfiguration.java:61-63` + `S2sAuthenticationFilter.java:36-39`.
- `[low]` **F-090 H-007/H-010 — no unified 'all my permissions' call (N+1) + LOGIN_FORM static-admin short-circuits per-resource read.** Orchestration doc-disclosed (DOC-243); the N+1 batch-endpoint REFACTOR and the LOGIN_FORM revoked-policies-ignored consequence are untracked. → caveat (+ REFACTOR) · cite `PermissionController.java:20-25` + `getResourcePermissions` sidecar.
- `[low]` **F-105 H-008 — see medium above.**
- `[low]` **F-119 H-002/H-009/H-011 — `/api/appInfo` pre-auth discovery + SDK posture + SPA staleness.** Not whitelisted → under LOGIN_FORM/OAUTH2/LDAP the auth-mode discovery endpoint is itself behind the login wall (probe PENDING-F-119-1); the operation has no `security:` element (SPC-002 Facet 3 pending); `keepMounted`+no-staleTime lags auth-mode UI within a live session. → caveat/test · cite `SecurityConstants.java:96` + `openapi.yaml:2704-2717` + `appInfo.ts:4-8`.
- `[low]` **F-120 H-010 — custom-datasource URL gets `?schema=lookup_tables_schema` injected (non-configurable).** Only the separate-DB pre-created-public-tables case; DOC-038 reviewed internally but no operator caveat published. → caveat · cite `R2DBCConfiguration.java:25,116-117`.
- `[low]` **F-131 H-008/H-009 — QueryExample query field is a Markdown PROSE editor (not code) + DialogWrapper no dirty-form warning.** H-005 affordance mismatch; H-008 Escape/back drops the typed query (DOC-232 Caveat 6 covers H-008 — KNOWN). → caveat (SME-comparative) · cite `QueryExampleForm.tsx:105-110`.
- `[low]` **F-132 H-011 — see test queue (stale on tab switch).**
- `[low]` **F-146 H-005 / F-208 H-005 — stale-clock tooltip never names 'stale' or the threshold.** Bare relative timestamp ('Ingested at <X> ago'). DOC-264/263 don't cover the tooltip wording. → caveat (UI-string + doc) · cite `MetadataStale.tsx:15-18`.
- `[low]` **F-146 H-007 — see test queue (scroll loss on collapse).**
- `[low]` **F-153 H-003 — Linked-Columns search explicit-trigger-only.** Type-to-search doesn't filter; nothing says so. PLT-058 Defect 7 is the sibling LinkedTermsList, not this tab. → caveat · cite `terms.ts:37-42`.
- `[low]` **F-153 H-010 — Linked-Columns no description-mention badge + possible dup row.** dataset-field path skips the Term-side dedup collapse (`removeDuplicateNonDescriptionTerms` is Term-side only). DOC-230/231 cover the Term-side tab. (dup-row probe PENDING-F-153-2.) → caveat · cite `DatasetFieldServiceImpl.java:184-187`.
- `[low]` **F-155 H-008 — Term query-example list no pagination (hasNext hardcoded false).** `mapListToQueryExampleList` hard-codes hasNext=false. DOC-232/233 cover OTHER paging; the by-term list is untracked. → caveat · cite `QueryExampleMapper.java:72-74`.
- `[low]` **F-155 H-009 — Term query-example label inconsistency.** CTA 'Link query' vs dialog title/submit 'Add query example' → misreads as authoring new. Trivial copy fix. → caveat · cite `TermQueryExamples.tsx:40` vs `AssignTermQueryExampleForm.tsx:45,65`.
- `[low]` **F-156 H-009 — see test queue (TagsEditForm no .catch).**
- `[low]` **F-161 H-004/H-009/H-010 — Management chrome desktop-only + frozen 9-tab set.** Fixed xs=3/xs=9, `wrap='nowrap'`, no breakpoint → cramped on phone/tablet, live doc silent; tab set is a frozen literal (no pin/reorder/per-user-hide). No responsive caveat in backlog. → caveat (desktop-optimised note) · cite `Management.tsx:13-19` + `ManagementTabs.tsx:19-50`.
- `[low]` **F-176 H-011 — Overview grid 9/3 split at all widths.** `xs={9}`/`xs={3}`, no md/sm overrides → sidebar crushed to 25%, undocumented, inconsistent with Search/Catalog (probe PENDING-F-176-2). → caveat / REFACTOR · cite `Overview.tsx:54,93`.
- `[low]` **F-191 H-008/H-009 — Compare 'Show changes only' is paint-only; 'Close' lands on LATEST not browser-back.** Full diff always fetched + full tree built before filtering (no transfer/parse saving); Close drops compare state. Distinct from PLT-028/DOC-192 (security/error). → caveat (schema-diff doc) · cite `datasetApi.ts:20-32` + `DatasetStructureCompareHeader.tsx:31-33`.
- `[low]` **F-196 H-006 — per-entity Activity third anonymous-DISABLED actor state renders UserIcon + blank name.** DOC-181/206 cover the GLOBAL doc caveat, not this per-entity render state. → caveat (fold into that family) · cite `ActivityItem.tsx:178-184`.
- `[low]` **F-208 H-008 — staleness fresh-state render inconsistent (list vs detail).** List renders nothing; detail header renders neutral `TimeGapIcon` + relative label — two visual grammars. Not the F-024 H-008. → caveat · cite `DataEntityDetailsHeader.tsx:50-61`.

### route = test (test-pillar / promise-verification — NOVEL)

**HIGH**

- `[high]` **F-141 H-001 — no composition smoke test for the home page.** 6 self-headed launcher bands, no IA wrapper. → test (F-141-UC-01) · cite `Overview/Overview.tsx:44-60`.
- `[high]` **F-141 H-010 — see KNOWN (TEST-GAP-1013, no ErrorBoundary anywhere).**
- `[high]` **F-014 H-010 — measured pin of the audit-export compound (cross-owner + soft-deleted + large size).** Statically contradicted, never measured; PENDING-F-014-1 has no P-NNN/characterization artefact on disk. → test (genuinely novel pin) · cite `F-014.yaml H-010`.
- `[high]` **F-086 H-011 — zero logout tests exist.** The 5-branch + fall-through logout matrix has no guard; any provider can silently regress. LSN-030 missing-functional. → test (one WireMock+dispatch suite) · cite `find src/test -iname '*Logout*' = empty`.

**MEDIUM**

- `[medium]` **F-013 H-013 / F-046 H-008 — UI getOrCreate TOCTOU regression pin** *(see caveat queue; probe-gated).*
- `[medium]` **F-015 H-010 — `/my/{upstream,downstream}` unstable pagination (no orderBy).** Postgres undefined order → dup/skip across pages; top-5 usually but not reliably stable. `listByOwner:528` already orders. PLT-144/021 are a different path; PLT-067 doesn't add orderBy. → test pin + small `.orderBy(DATA_ENTITY.ID.asc())` · cite `ReactiveDataEntityRepositoryImpl.java:247-250`.
- `[medium]` **F-021 H-008 — cursor truncates to SECOND while ORDER BY uses microsecond.** Out-of-order across page boundary under sustained write (ADR-0021 SHAPE is contract-tested; BEHAVIOUR under load is not; PENDING-F-021-1). → test (probe) · cite `ReactiveActivityRepositoryImpl.java:285-291`.
- `[medium]` **F-029 H-012 — see KNOWN (TST-002 contract conformance).**
- `[medium]` **F-038 H-012 — just-sent Discussions message off-by-one refetch.** Post-create refetch keyed on `isMessageCreating` may start AFTER the new message (probe PENDING-F-038-1; redux slice not in chain). → test · cite `DataCollaboration.tsx:37,43`.
- `[medium]` **F-074 H-011 / F-105 H-005 — LDAP non-admin hidden-tab-vs-reachable not pinned.** IT-104/management-chrome runs DISABLED (all 9 tabs visible) — wrong posture; doesn't pin the LDAP non-admin hidden-tab case (PENDING-F-074-1; authoritative UI in F-161). → test · cite `ManagementTabs.tsx:19-50` + `SecurityConstants.java:148-150`.
- `[medium]` **F-094 H-011 — ingestion filter matcher-scope regression pin.** Hard-coded exact-literal `/ingestion/entities` → a future sibling path silently bypasses the filter; no compile/test signal. REFACTOR-073 is a different facet. → test (RED on widened matcher) · cite `IngestionDataEntitiesFilter.java:28`.
- `[medium]` **F-095 H-008 — concurrent stats-ingestion tag reconcile last-writer-wins.** Per-request RMW, not atomic across POSTs (probe PENDING-F-095-1, single-caller replay safe). → test · cite `DatasetFieldServiceImpl.java:217-228`.
- `[medium]` **F-098 — see bug queue (H-007/H-008 probes).**
- `[medium]` **F-105 H-005 — DISABLED anon Policy-list read not pinned.** IT-104 runs DISABLED but the dummy principal HAS the perm, so it never pins the no-perm/anon read (PENDING-F-105-1). → test · cite `ManagementRoutes.tsx:150` + `App.tsx:48`.
- `[medium]` **F-126 H-011 / F-040 H-012 / F-174 H-010 — OFFSET pagination skip/dup on non-unique order key.** Single-key `ORDER BY ...DESC`, no id tiebreaker, concurrent create/resolve mid-scroll (PENDING-F-126-1 / F-040-2 / F-174-2; realistic tie source = same-instant cascade-decline). → test (probes) · cite `ReactiveAlertRepositoryImpl.java:474-507`, `ReactiveDataEntityTaskRunRepositoryImpl.java:178`, `ReactiveOwnerAssociationRequestRepositoryImpl.java:104,131`.
- `[medium]` **F-148 H-005 — class-tab rapid switching debouncer (probe).** Inherits the F-017 `Search.tsx` recreated-debouncer; rapid tab switch fires N PUTs (PENDING / P-187). NOTE: Search.tsx site is NOT PLT-017 (that's TermSearch.tsx) — F-017 facet only. → test (pin tab cardinality, then promote) · cite `Search.tsx:50-65`.
- `[medium]` **F-153 H-008 — listByTerm asMaterialized full-table read (probe).** CTE materialises full `dataset_field` before the termId join narrows; planner may elide (PENDING-F-153-1, EXPLAIN ANALYZE). → test/bug · cite `ReactiveDatasetFieldRepositoryImpl.java:192,196`.
- `[medium]` **F-156 H-009 — TagsEditForm save dispatch no .catch → silent failure.** Rejected tag save leaves the dialog open, no error. DOC-199 C15/PLT-059 D4 cover TermsForm; PLT-060 D2 covers AssignTermQueryExampleForm; TagsEditForm is untracked. LSN-024 class. → test/bug (fold into PLT-060) · cite `TagsEditForm.tsx:138-149`.
- `[medium]` **F-162 H-011 — wizard template render sanitiser unverified.** Compiled Handlebars → MDEditor.Markdown; whether a careless manifest template can inject script depends on the renderer schema (PENDING-F-162-1). → test (security regression) · cite `IntegrationCodeSnippetWithForm.tsx:130` + `Markdown.tsx:113-124`.
- `[medium]` **F-176 H-010 — Overview transient half-loaded frame (probe).** Composer skeleton covers only the top-level fetch; Attachments + DQ/SLA own independent async → body paints while panels spin/error (PENDING-F-176-1, slow-3G). → test · cite `Overview/Overview.tsx:151`.
- `[medium]` **F-177 H-010 / F-191 H-010 / F-161 H-009 / F-151 H-013 / F-176 H-011 — responsive/narrow-viewport probes.** Header/Compare/Management/Term-detail/Overview degrade at 360–768px, unobservable from static source (PENDING-F-177-1 / F-191-2 / etc.). → test (responsive ITs) · cite per feature.
- `[medium]` **F-191 H-011 — Compare empty-vs-error branch (probe).** A version-id that silently fails to resolve may render 'no changes' instead of an error (PENDING-F-191-1; overlaps F-045). → test · cite `DatasetStructureCompare.tsx:40,47-56`.
- `[medium]` **F-192 H-005/H-006 — see KNOWN (PLT-029 D4/D4b; probes PENDING-F-192-1/2).**
- `[medium]` **F-196 H-005 — per-entity Activity filter-change race (no debounce/Abort).** Slow superseded response may overwrite current-filter results (PENDING-F-196-1; reducer not in chain). → test · cite `ActivityResults.tsx:43-45`.
- `[medium]` **F-197 H-006/H-011 — Discussions list refetch on isMessageCreating + ERROR_SENDING UI surfacing.** H-006 just-posted message may be hidden until reload (ui_unverified); H-011 whether the failed-send state renders is unknown (PENDING-F-197-1, force ERROR_SENDING). → test · cite `DataCollaboration.tsx:27,37,43` + `DataCollaborationMessageSenderJob.java:58-63`.
- `[medium]` **F-198 H-008 — alert-item showHistory state loss on remount (probe).** Local `useState(false)`; survival across InfiniteScroll/redux remount unverified (PENDING-F-198-1). → test (fold into PLT-050) · cite `DataEntityAlertItem.tsx:36` + `DataEntityAlerts.tsx:31-35`.
- `[medium]` **F-206 H-007 / H-011 — class-badge consistency across 6 consumer surfaces + enum/palette lockstep.** No e2e exercises the badge on a Search/Directory row; missing-key palette guard unreachable until enum drift (PENDING-F-206-1). → test (TST item) · cite `F-206.yaml contributing_nodes` + `EntityClassItem.styles.ts:16`.
- `[medium]` **F-022 H-013 — SLA PNG cross-origin read (probe).** No `@CrossOrigin`/X-Frame/Cache-Control:private; under cookie auth an embedding page may cross-origin-read the SLA colour (PENDING-F-022-4, auth-mode+CORS dependent). → test/bug · cite `DataQualityController.java:42-48`.

**LOW**

- `[low]` **F-001 H-012 — concurrent-read lost-update + pagination skip/dup pin.** Asserted by SQL semantics not by test; P-301 the obligation, not yet run. → test · cite `lineage/.../probes/P-301.yaml`.
- `[low]` **F-008 H-001 — anonymous-write regression-pin.** Headline security finding (DOC-004 done) but no anonymous-write regression-pin exists (LSN-030 demand). → test · cite `IngestionDataEntitiesFilter.java:20` + `application.yml:48`.
- `[low]` **F-025 H-003 (DialogWrapper double-submit), F-131 H-002/H-010, F-132 H-011, F-146 H-007, F-179 H-007, F-186 H-010/H-011, F-208 H-011 — small probe/pin items.** Each is a probe-gated regression pin (re-submit guard / Markdown render / stale-on-tab-switch / scroll-loss-on-collapse / stale-nodeSize-context / cache-freezes-is_stale). → test (probes PENDING-F-…) · cites per feature: `QueryExampleForm.tsx:124,138`; `QueryExampleDetailsContainer.tsx:26-31`; `OverviewTags.tsx:68`; `LineageProvider.tsx:58-68` + `DEGLineageLayouter.tsx:39,56`; `DataEntityStaleDetector.java:16`.
- `[low]` **F-036 H-006 (server-side id-ASC ordering pin), F-040 H-007/H-009 (message-quality + start-vs-end-time UI), F-057 H-011 (uncontrolled select never re-syncs) — small UX/characterization pins.** → test · cites `ReactiveAbstractCRUDRepository.java:90-91`; `DataEntityRunServiceImpl.java:36-37` + `ReactiveDataEntityTaskRunRepositoryImpl.java:178`; `TestReportDetailsOverview.tsx:84`.
- `[low]` **F-022 H-003 (404 on zero-test dataset REST/empty-state), H-010 (TestReport no error boundary), H-011 (auto-expand <5 hardcoded) — novel TestReport pins.** → test/bug · cites `DataQualityServiceImpl.java:38-42`; `TestReportDetails.tsx:24-29`; `TestReportItem.tsx:27-30`.
- `[low]` **F-034 H-006 (features/active anon block 302-vs-401 pin), H-007 (cross-repo enum lockstep), H-009 (disabled-affordance no placeholder).** → test/caveat · cites `SecurityConstants.java:95`; `components.yaml:117-119` vs `Feature.ts:20-23`; `WithFeature.tsx:31-32`.
- `[low]` **F-037 H-011 — relationships detail multi-row branch (probe).** Schema admits >1 relationships row per data_entity (no UNIQUE); `mono()` errors or silently returns row 1 (PENDING-F-037-1). → test · cite `ReactiveRelationshipsRepositoryImpl.java:197` + `V0_0_87`.
- `[low]` **F-038 H-013 (server-side non-blank validation), F-095 H-008 — see above.**
- `[low]` **F-042 H-007 (3 Owner-Association callers omit error prop → 'Unknown Error'), H-008 (Integration-preview `error as ErrorState` cast).** Novel; AppErrorPage degrades to empty status-code column (PENDING-F-042-1). → test (pin degraded contract) · cites `OwnerAssociationsActive.tsx:99`; `IntegrationPreviewList.tsx:70`.
- `[low]` **F-043 H-009/H-010 — i18n parity-gate (no missingKeyHandler, locale bundle drift) + es-only 'Estado'.** Systemic root: PLT-011/092/DOC-304 each fix one instance, none adds the code↔resource + locale↔locale parity gate. Highest-leverage i18n item. → test (CI parity gate) · cite `i18n.ts:27-31`.
- `[low]` **F-104 H-009 (independent Clear buttons pin), F-127/F-… misc — small RTL/jotai guards.** → test · cite `DataQualityStore.ts:44-54`.
- `[low]` **F-039 H-012 — GenAi latent→live structural pin.** Assert zero hand-written `GenaiApi` imports in odd-platform-ui so the API-only→UI flip is a conscious reviewed edit (LSN-029). → test · cite `F-039.yaml H-012`.
- `[low]` **F-029 H-012 — see KNOWN (TST-002).**
- `[low]` **F-147 H-004 (new-tab/middle-click anchor pin — fold into PLT-091), H-005 (inner-child bubble probe), H-008 (repeat-look dedup — KNOWN PLT-104).** → test/bug · cites `ResultItem.tsx:72-76,87-90`.
- `[low]` **F-148 H-010 — saved-class tab not highlighted (selectedTab -1) pin.** `findIndex` -1 when the saved class's tab value is undefined; no fallback. → test (mint regression-pin; could fold the fallback into the H-006 fix) · cite `SearchResultsTabs.tsx:68-70`.
- `[low]` **F-179 H-009 — see KNOWN (resolved: WithPermissions is a true gate; render-gate guard test F-179-UC-9).**

---

## Known (already tracked)

Compact convergence table — these re-derive items already on disk; **no new action**, they confirm the methodology is finding what it already filed.

| Feature·Hyp | Drift (short) | Known ref |
|---|---|---|
| F-001 H-002/H-003/H-006 | view_count +2 / unthrottled increment / browse-as-write loop | PLT-104 |
| F-001 H-004 | exclude_from_search omitted from Popular | DOC-186 / PLT-022 |
| F-001 H-008 | /popular reachable under DISABLED | DOC-166 |
| F-001 H-010 | id-DESC tiebreaker shows newest on empty | DOC-323 |
| F-001 H-011 / F-119 H-006 / F-141 H-002 / F-142 H-011 / F-178 H-010-root | auth.type no enum validation (Overview gate / NPE→500 root) | PLT-077 |
| F-001 H-013 | unindexed ORDER BY view_count | REFACTOR-221 |
| F-003 H-002 / F-040 H-012 | listPopular non-transactional pagination | TEST-GAP-259 |
| F-003 H-004 | exclude_from_search leak (critical) | PLT-022 / TEST-GAP-310 |
| F-003 H-005/H-010 / F-126 H-003 | view_count pumpable / Popular STATUS=OPEN | PLT-104 / TEST-GAP-309 / PLT-121 |
| F-003 H-006/H-007/H-012 | Popular catalog-wide / no view_count projection / DISABLED reach | DOC-186 / DOC-297 |
| F-003 H-008/H-009 | Popular tile→Overview / panel hidden under DISABLED | DOC-166 |
| F-004 H-003 | description-edit DESCRIPTION_UPDATE auto-links terms | PLT-013 |
| F-004 H-007 | XSS closed only by browser (rehype-raw) | PLT-023 / DOC-187 |
| F-004 H-004 | dual activity events on description edit | DOC-328 |
| F-004 H-008 | last-writer-wins on description | DOC-329 |
| F-005 H-001/H-002 / F-054 H-004/H-005 | lineage_depth NPE→500 / no owner scoping | PLT-100 / DOC-293 |
| F-005 H-003/H-009 / F-054 H-006 / F-055 H-002/H-003/H-005 | no @Max on depth / no cycle guard | PLT-042 / PLT-100 |
| F-005 H-005..H-010 / F-055 H-004..H-010 | DEG boundary-drop / depth override / diamond dup / LoadMore | DOC-320 / DOC-167 |
| F-005 H-007 / F-054 H-002/H-003 | microservices = generic canvas, OTel fields dropped | DOC-226 |
| F-005 H-012 / F-045 H-001/H-002/H-011 / F-191 H-004/H-005 | cross-dataset structure/diff leak + undifferentiated error | PLT-028 / DOC-192 |
| F-006 H-001/H-012 / F-019 H-001 / F-021 H-010 / F-027 H-013 / F-028 H-011 / F-030 H-008 / F-031 H-011 / F-044(audit) / F-055(audit) / F-075 H-006 / F-095 H-004 / F-125 H-006 | RBAC/Owner/Namespace/Collector/metric/attachment audit-silence (data_entity_id NOT NULL root) | PLT-062 / DOC-181 / DOC-246 |
| F-006 H-002/H-003 / F-019 H-007 | soft-deleted policy ghost-grant / role chip leak | PLT-110 / PLT-131 |
| F-006 H-006 | malformed policy JSON → 500 | PLT-076 |
| F-006 H-013 | permission mis-wiring (terms/alerts) | PLT-029 / DOC-193 |
| F-006 H-014 / F-084 H-002 (Google) | LDAP admin-groups substring (NB: F-124 H-001 says this is a NO-OP — see Dismissed) | PLT-081 / PLT-069 |
| F-007 H-001 | /ingestion/alert/alertmanager unauthenticated | DOC-179 / PLT-014 |
| F-007 H-002/H-003/H-004 | forged alert / dup rows / generatorURL XSS | PLT-014 |
| F-007 H-005/H-009/H-010 | resolved dropped / unaudited ingress / orphan inflates totals | DOC-321 |
| F-007 H-006 | 'All' tab STATUS=OPEN | PLT-121 |
| F-007 H-007 / F-014 H-007 / F-126 H-008 / F-198 H-006 | post-click Resolve permission (global AlertItem) | PLT-033 / PLT-034 |
| F-007 H-008 / F-126 H-009 | alert tab badge stale | DOC-330 |
| F-007 H-012 / F-014 H-006 / F-126 H-007 | Alerts list no filter/sort/export, size-30 | PLT-050 / DOC-201 |
| F-008 H-001/H-007/H-009 / F-020 H-005 | anon-writable ingestion / leaked-token / no-grace | DOC-004 / DOC-252 / PLT-108 |
| F-008 H-002 | filter gates one endpoint | PLT-003 / PLT-044 / PLT-051 |
| F-008 H-003/H-004/H-005 / F-031 H-003 | datasource update narrows / collector wins / namespace dropped | DOC-322 / PLT-135 |
| F-008 H-006 | batch all-or-nothing / dup-ODDRN 5xx | PLT-045 / DOC-195 |
| F-008 H-008 / F-020 H-007/H-008 / F-125 H-005 | plaintext token at rest | PLT-085 |
| F-008 H-010 / F-020 H-002 / F-035 H-009(DISABLED) | Collectors UI hides while API accepts anon | DOC-252 |
| F-008 H-011 / F-010 H-012 / F-087 H-002/H-004 | session.timeout=-1 / IN_MEMORY cluster bridge | PLT-074 |
| F-008 H-013 | ingestion is REPLACE not merge | DOC-195 |
| F-009 H-002/H-004/H-007/H-012 | email RuntimeException abort / webhook no HMAC / poison loop / no audit | PLT-016 |
| F-009 H-003 | unconditional broadcast no routing | DOC-180 |
| F-009 H-011 | Slack mrkdwn injection | PLT-015 |
| F-010 H-001 | resolved_alerts precedence delete | PLT-005 |
| F-010 H-002/H-011/H-013 / F-121 H-011 | TTL int=0 / session reaper no @SchedulerLock / no @Validated | PLT-083 / DOC-250 |
| F-010 H-003/H-006 / F-121 H-005 | housekeeping.enabled no matchIfMissing / no activityDays TTL | DOC-250 |
| F-010 H-005 / F-044 H-002/H-003/H-007/H-008 / F-123 H-009 / F-178 H-010 | STATUS_UPDATED_AT never bumped → TTL never fires | PLT-027 |
| F-010 H-007 | empty-partition drop non-transactional | PLT-123 |
| F-011 H-002 / F-085 H-005 / F-088 H-005 | S2S 'ADMIN' literal collision | PLT-072 |
| F-011 H-003 | LOGIN_FORM RBAC inert (no AuthorizationCustomizer) | PLT-064 |
| F-011 H-004 / F-019 H-002/H-003 / F-171 H-007(approve onto dead owner) | PUT owners omitting roles strips bindings | PLT-066 |
| F-011 H-005 / F-015 H-007 | first-login silent-empty, no Owner | PLT-122 / PLT-066 |
| F-011 H-006 / F-124 H-009 | GitHub login-rename orphan | PLT-111 / DOC-312 |
| F-011 H-007 / F-084 H-009 / F-086 H-005 / F-089 H-005 | Azure logout-uri NPE→500 | PLT-130 |
| F-011 H-008 | logout 404 under DISABLED (also F-041 H-003 — see novel) | PLT-072 |
| F-011 H-010 / F-015 H-013 | identity-resolution no cache (auth hot path) | PLT-063 |
| F-011 H-011 / F-013 H-… / F-041 H-004 / F-105 H-001/H-003 / F-161 H-001 | Management tab renders for non-admins | DOC-324 / DOC-174 |
| F-011 H-013 | owner rename no audit + global OWNER_UPDATE | DOC-324 / PLT-062 |
| F-012 H-004/H-005 | DEG-side authz / no @ActivityLog | PLT-024 / DOC-188 |
| F-012 H-006/H-007/H-008/H-010/H-011 | half-capability / idempotent delete / 3 modes one 400 / hard-vs-soft / DISABLED | DOC-188 |
| F-013 H-001/H-002 | upsert is pure UPDATE / silent 200 on missing | PLT-025 / DOC-189 |
| F-013 H-003/H-004 | no type validation / EXTERNAL writable | DOC-189 |
| F-013 H-006/H-007/H-008/H-009 | active→NULL / no @ActivityLog / unscoped read / pageinfo theatre | PLT-025 |
| F-014 H-001/H-002/H-004 | per-entity alert read unscoped | DOC-GAP-157 / DOC-200 |
| F-014 H-003 | no page/size bounds | PLT-134 |
| F-014 H-005/H-008 | soft-delete tab divergence / WithPermissions context | PLT-031 / PLT-034 |
| F-014 H-009 / F-007 H-011 / F-126 H-010-root | statusUpdatedBy username PII | DOC-GAP-082 |
| F-015 H-002 / F-029 H-005 | /my/upstream inverse semantic | SPC-002 / DOC-244 |
| F-015 H-006/H-009/H-012 | anchor-set single point of failure / unbounded IN / no defence-in-depth | PLT-067 |
| F-015 H-007 / F-064 H-006 | recommended empty tile no affordance | REFACTOR-224 / PLT-066 |
| F-016 H-002/H-003/H-004/H-005/H-008 / F-023 (DEG) | DEG read posture / inner-DEG suppression / boundary drop / 404 conflate | DOC-225 |
| F-016 H-009/H-011 | DEG recursion StackOverflow / sibling 404 disagreement | PLT-036 |
| F-017 H-001/H-002/H-005/H-007 | facet counts catalog-wide / search_facets no owner / tsquery DoS | DOC-260 / PLT-090 |
| F-017 H-004/H-008/H-009 / F-024 H-004 / F-018 H-006 | facet substring vs FTS / shared session row mutability | DOC-323 / DOC-260 |
| F-017 H-006 / F-024 H-005 / F-148 H-005(site=TermSearch) | facet debouncer recreated (TermSearch locus) | PLT-017 |
| F-017 H-011 / F-036 H-007/H-012 / F-037 H-010 / F-040(size) / F-028 H-010 | unbounded pagination (no @Min/@Max) | PLT-134 / DOC-326 |
| F-018 H-001/H-005/H-013 | Top Tags oldest-by-id / TAG_CREATE side-channels / audit asymmetry | PLT-026 / DOC-190 |
| F-018 H-004/H-009/H-010/H-011 | datasetfield tag origin / orphan tag rows / external-origin guard / spec gaps | PLT-124 / PLT-133 / PLT-137 / SPC-001 |
| F-018 H-008 | TagsEditForm no-signpost mint | PLT-060 / DOC-199 |
| F-019 H-004/H-005/H-006/H-009/H-011/H-012 | owner getOrCreate / GET ungated / 201-vs-200 / cascade leg / 400-vs-409 / FTS asymmetry | PLT-125 / DOC-251 / SPC-001 / PLT-132 / DOC-333 / PLT-136 |
| F-020 H-004/H-006/H-009/H-011/H-012/H-013 | token no-grace / audit-silence / PUT replace / GET ungated / no-UNIQUE / weak CSPRNG | PLT-108 / PLT-062 / DOC-329 / DOC-252 / PLT-085 / PLT-126 |
| F-021 H-001/H-002/H-005 | User-filter binds OWNER_ID / MY_OBJECTS axis / created_by username | PLT-030 / DOC-206 / PLT-065 |
| F-021 H-009/H-010 | anon DISABLED actor / data-entity-only audit log | DOC-181 |
| F-022 H-001/H-004/H-006 | SLA png content-type / unset→MAJOR / per-RUN miscount | DOC-169 / DOC-170 / PLT-052 / DOC-203 |
| F-022 H-005 | DQ severity no audit | PLT-055 / DOC-205 |
| F-022 H-006 / F-040 H-002 | soft-delete tab→Overview redirect / RUNNING 500 | PLT-117 / PLT-144 / DOC-185 |
| F-023 H-006/H-008/H-010 | level-4 count vs page / ODDRN reflection leak / NaN deep-link | PLT-093 / DOC-261 |
| F-023 H-007 / F-104 H-001/H-005/H-006 | directory stale until reload / jotai filter reset | DOC-330 / DOC-332 |
| F-024 H-004/H-008/H-009/H-011/H-012 | Dictionary empty-first / evicted bookmark / tsquery DoS / no namespace scope / frozen page | DOC-178 / P-361 / PLT-127 / PLT-013 / PLT-138 |
| F-025 H-006/H-007/H-009 / F-029 H-003 | QueryExample no @ActivityLog / XSS / 201-vs-200 | DOC-183 / PLT-018 / SPC-001 |
| F-026 H-002/H-003/H-004/H-008/H-009/H-010/H-012 / F-058 H-001/H-005/H-007 / F-059 H-001/H-004/H-006/H-007/H-009 | lookup NO_CONTEXT / ungated reads / scroll cap / orphan cleanup / ALTER TABLE RENAME / collision 500 / XSS | PLT-019 / PLT-098 / PLT-057 / PLT-145 / PLT-146 / DOC-182 / DOC-294 |
| F-027 H-005/H-009/H-010 | attachment cross-entity / S3 no region / chunk node-local | PLT-086 / PLT-118 |
| F-027 H-008/H-013/H-003/H-011 | token plaintext / no @ActivityLog / chunk corruption / boot-time S3 check | PLT-085 / DOC-328 / TST-003 / DOC-255 |
| F-028 H-007/H-008/H-013 | namespace side-door / soft-delete reincarnation / TOCTOU | PLT-101 / DOC-254 / PLT-037 |
| F-029 H-001..H-013 | OpenAPI: no securitySchemes / no error model / 201-vs-200 / inverse my-objects / terms-vs-term path / swagger reach / branding / no conformance test / ingestion scope | SPC-001 / SPC-002 / SPC-003 / DOC-244 / PLT-012 / PLT-046 / TST-002 / PLT-044 |
| F-030 H-002..H-011 | metrics anon-writable / tenant co-mingle / phantom-series / one-way migration | DOC-202 / DOC-228 / PLT-051 / DOC-064 |
| F-031 H-003/H-006/H-007/H-009/H-011/H-012 | PUT replace / regenerate no-warning / last-6 leak / FTS asymmetry / audit-silence / DISABLED | DOC-255 / DOC-329 / PLT-038 / PLT-087 / DOC-GAP-082 |
| F-032 H-004/H-006/H-008/H-010/H-011/H-012 | palette TypeError / per-RUN miscount / AND-on-one-row / alpha-sort / Table-Health undercount / filter reset | PLT-052 / DOC-203 / DOC-325 / DOC-173 / DOC-332 |
| F-033 H-003/H-004/H-007/H-008/H-011 | platform_url default / 404-on-unknown / open-read / DISABLED-anon / copy-button | DOC-050 / PLT-149 / DOC-256 / PLT-007 / IT-099 |
| F-034 H-002/H-003/H-010 | tab persists when feature off / not runtime-current / SpEL no :false | PLT-068 / DOC-248 / PLT-105 |
| F-035 H-006/H-007/H-008 / F-041 H-007/H-008 / F-119 H-010 | menu WCAG keyboard / target=_blank no rel / boot-immutable links | PLT-088 / DOC-257 |
| F-036 H-005/H-006/H-010 | Title case-sensitive denial / curation absence / pagination | DOC-258 / DOC-326 |
| F-037 H-002/H-004/H-005/H-006/H-007/H-009/H-010 | Target=Source copy-paste / search scope / routing overstate / relationship_id / no authz / NaN / page=0 | PLT-056 / PLT-102 / DOC-229 / DOC-300 / DOC-326 |
| F-038 H-002/H-003/H-004/H-005/H-007/H-009/H-010/H-011 | Slack events no HMAC / cross-owner post / open-redirect / dup / send-feedback / DISABLED / tab pre-flight / channel filter | PLT-054 / PLT-119 / PLT-129 / DOC-325 / REFACTOR-185 / F-197 |
| F-039 H-001/H-002/H-005/H-011/H-006/H-008 | GenAI no authz / no fail-fast / no audit / no rate-limit / no scrub / no body cap | PLT-020 / PLT-008 / DOC-184 |
| F-040 H-002/H-003 | RUNNING 500 / 500-not-400 | PLT-144 / PLT-143 |
| F-040 H-003/H-013 | cross-owner read / wire-boundary unit | DOC-185 / PLT-144 |
| F-041 H-007/H-008 | menu WCAG / target=_blank | PLT-088 / DOC-257 |
| F-042 H-002/H-003/H-006 | no ErrorBoundary / no catch-all route / no retry | TEST-GAP-1013 / TEST-GAP-1022 / DOC-334 |
| F-043 H-005/H-006/H-008 | i18n keys absent / User-filter bind / fallbackLng array | DOC-304 / PLT-030 / PLT-011 |
| F-044 H-010/H-011 | DISABLED status-write / scheduled no attribution | PLT-072 / DOC-325 |
| F-044 H-004/H-005 | scheduler window / propagate single-hop | DOC-191 / DOC-325 |
| F-045 H-003/H-005/H-010/H-011 | latest=max(VERSION) / no authz / URL-rewrite / compare error | DOC-192 / ADR-0003 / PLT-028 |
| F-054 (all) | microservices canvas / depth NPE / no @Max / cycle / owner-scope | DOC-226 / PLT-100 / PLT-042 / DOC-320 |
| F-055 H-006/H-007 | depth doesn't bound cross-owner / unset→default | PLT-100 / DOC-293 / DOC-167 |
| F-057 H-001/H-006 | DQ severity audit-silence / no version history | PLT-055 / DOC-205 |
| F-058 H-001/H-005/H-007 | lookup scroll cap / counter leak / read-collaborative | PLT-057 / PLT-098 / DOC-294 |
| F-059 H-001/H-004/H-006/H-007/H-009 | lookup rename / collision 500 / footgun unfenced / no alias / no audit | PLT-145 / PLT-146 / PLT-057 |
| F-064 H-003/H-008 | doc prereq closed / owner_ids dropped | DOC-GAP-025 / DOC-GAP-141 |
| F-065 H-002/H-004/H-005/H-009 | advisory-lock wedge / no registry / no gauge / DC lock equality | PLT-089 |
| F-065 H-010 | poison WAL replay loop | PLT-016 |
| F-074 H-002 / F-105 H-001/H-003 | Management reads ungated | DOC-207 / DOC-174 |
| F-074 H-008 | Owner.name PII on person-named | DOC-251 |
| F-075 H-005 | owner-mint side-door | PLT-125 |
| F-076 H-003/H-005/H-006/H-007/H-009 | stuck modal / TOCTOU / no @ReactiveTransactional / cascade leg / orphan token | PLT-128 / PLT-037 / PLT-132 / PLT-087 |
| F-084 H-002/H-003/H-004/H-006/H-008 | Google admin-groups ignored / GitHub early-ADMIN / GHES hard-coded / typo'd provider / org-bypass | PLT-069 / PLT-070 / PLT-082 |
| F-084 H-005/H-010 | allowed-domain no-op / additive algebra | DOC-235 / DOC-237 |
| F-085 H-002/H-004 | whoami synthetic admin / fingerprint | PLT-072 |
| F-086 H-002/H-003/H-006/H-008 / F-089 H-002/H-009 | Cognito no revoke / Azure protocol limit / no UI signal / Host-derived redirect | PLT-073 / DOC-236 / PLT-075 |
| F-087 H-005/H-006/H-009 | session no @SchedulerLock / CSRF disabled / Serialization gadget | PLT-083 / PLT-064 / PLT-074 |
| F-088 H-002/H-005/H-007/H-010 | S2S global ADMIN / 'ADMIN' literal / inert under DISABLED / no attribution | REFACTOR-108 / PLT-072 / DOC-172 |
| F-089 H-002 | post-logout open-redirect | PLT-075 |
| F-090 H-001/H-004/H-005 | no securitySchemes / MANAGEMENT 400 / lookup global | DOC-243 / SPC-002 / PLT-076 |
| F-094 H-001/H-004/H-005/H-006/H-007/H-008/H-010 | ingestion auth matrix / sibling endpoints / alertmanager / ordering / S2S / 5xx-enum / matrix doc | DOC-228 / PLT-051 / PLT-106 / PLT-014 / PLT-045 |
| F-095 H-002/H-003/H-004/H-005/H-006/H-007/H-009/H-010/H-011 | cross-dataset stats / anon / no audit / invalid stats / tag side-channel / replace-not-merge / silent-drop / 500-empty | PLT-044 / PLT-106 / PLT-026 / PLT-142 |
| F-096 H-001/H-002/H-005/H-006/H-007/H-009 | batch atomicity / dup 5xx / 413→500 / 201-vs-200 / lock-no-signal / silent rollback | PLT-045 / SPC-001 / DOC-195 |
| F-097 H-003/H-003b/H-004/H-005/H-006/H-008/H-009/H-010/H-011 | branding / personal contact / dev stub server / no securitySchemes / swapped paths / no swagger toggle / 404 page / DISABLED boot / inert s2s | PLT-112 / SPC-001 / PLT-141 / PLT-046 / DOC-088 / REFACTOR-073 / DOC-172 |
| F-098 H-001/H-003/H-004 | Slack events no HMAC / DISABLED whitelist / dup | PLT-054 / PLT-099 |
| F-104 H-007/H-003 | jotai-vs-Redux ADR / DEGLineage cursor | ADR-0076 / DOC-332 |
| F-119 H-006/H-010 | auth.type no enum / DISABLED silent-insecure | PLT-077 / REFACTOR-073 |
| F-121 H-001/H-002/H-008 | single-thread executor / 14m/15m lock / dead defaultLockAtMostFor | DOC-335 |
| F-122 H-002/H-007/H-008 | actuator show-values / shares app port / Slack URL leak | DOC-308 / DOC-242 / PLT-103 |
| F-123 H-006/H-009 | orphan token / DataEntity TTL | PLT-087 / PLT-027 |
| F-124 H-002/H-005/H-006/H-008/H-009/H-010 | LDAP exact-CN / Okta-Keycloak absent / typo'd provider / org-bypass / login-rename / cross-mode | DOC-238 / PLT-071 / PLT-082 / PLT-070 / PLT-111 / PLT-120 |
| F-125 H-002/H-005/H-006/H-008/H-009 | no grace / plaintext / audit-silence / UI hides while API accepts / rotation no-op | DOC-252 / PLT-085 / DOC-181 / DOC-255 |
| F-126 H-003/H-007/H-008/H-009 | All-tab OPEN / no filter / post-click Resolve / badge stale | PLT-121 / PLT-050 / PLT-033 / DOC-330 |
| F-131 H-003/H-007/H-009 | post-create no invalidate / Escape drops query / DISABLED | DOC-330 / DOC-232 / DOC-183 |
| F-132 H-003/H-007/H-008/H-009 | badge count asymmetry / XSS / breadcrumb / read-only tables | DOC-232 / PLT-018 |
| F-141 H-005/H-008/H-009/H-010/H-011 | Top Tags ordering / Popular cross-owner / +2 / no ErrorBoundary / DISABLED fingerprint | PLT-026 / PLT-104 / DOC-297 / TEST-GAP-1013 / DOC-GAP-252 |
| F-142 H-006/H-010/H-011 | owner free-text no validation / no revoke / auth.type predicate | DOC-214 / DOC-216 / PLT-077 |
| F-146 H-003/H-004/H-008 | stale-period silent-disable / never-ingested / single global window | PLT-097 / DOC-264 |
| F-147 H-002/H-003/H-005/H-008/H-009 | +2 view_count / WCAG row / inner-child bubble / repeat-look / DISABLED | PLT-091 / PLT-104 / DOC-260 |
| F-148 H-007 | SearchResultsTabs i18n | PLT-092 |
| F-151 H-002/H-003/H-006/H-008/H-009/H-012 | Overview double-fetch / tab auto-hide / term XSS / dual-surface / RBAC / [[ns:term]] syntax | PLT-058 / DOC-233 / PLT-023 / PLT-018 / DOC-187 |
| F-152 H-002/H-003/H-004/H-005/H-006/H-008/H-009/H-011 | linked-terms endpoint overload / bogus error / no debounce / wrong label / hasNext false / dual-surface / state pattern / audit | PLT-140 / PLT-058 / DOC-233 / DOC-328 / PLT-101 |
| F-153 H-004/H-005/H-007 | linked-columns scroll cap / wrong doc caveat / pageInfo total | PLT-058 / DOC-233 |
| F-154 H-003/H-005/H-006/H-007/H-008/H-010/H-011 | dup-check blind / no .catch / cache no-op / XSS / ns side-door / audit-silence / 201-vs-200 | PLT-059 / DOC-199 / PLT-023 / PLT-101 / DOC-181 / SPC-001 |
| F-155 H-003/H-006/H-007 | no .catch / no @ActivityLog / XSS | PLT-060 / PLT-018 / DOC-183 |
| F-156 H-001/H-003/H-005/H-010/H-011 | slice-before-sort / TAG_CREATE bypass / owner side-door / tag audit-silence / namespace scope | PLT-060 / PLT-125 / DOC-190 / DOC-177 |
| F-161 H-001/H-004/H-005 | Management reads bypass / bare integrations route / Management tab | DOC-174 |
| F-162 H-006/H-009/H-010/H-012 | static-value invisible / copy button / boolean isValid / rhf timing | DOC-050 / PENDING-F-162-1 |
| F-163 H-003/H-008/H-010 (Cache-Control) | last-6 leak / Cache-Control / no-store | DOC-252 / PLT-087 / PLT-108 |
| F-171 H-006/H-007/H-008/H-010/H-012 | cascade auto-decline / approve dead owner / blind triage / grammar / tab reset | DOC-327 / PLT-132 / DOC-219 / PLT-038 |
| F-172 H-003/H-005/H-010 | manual-bind IS audited / orphan binding / cascade-block leg | PLT-039 / DOC-220 / REFACTOR-427 |
| F-173 H-002/H-006 | UI/backend gate disjoint on Remove / unbind audit-silent | PLT-040 / DOC-328 |
| F-174 H-002/H-008/H-009 | unbind audit conditional / resolved-by drift / status fallback | DOC-224 / PLT-065 / PLT-041 |
| F-176 H-004/H-006/H-007/H-009 | class-silent stats absence / zero-vs-loading / per-panel gate / +2 view_count | DOC-266 / DOC-263 / PLT-104 |
| F-177 H-002/H-003/H-004/H-005/H-006/H-008/H-009 | badge code-only / vocab drift / overflow / unclassified silent / class-vs-type / DCT magic / cross-link | PLT-094 / DOC-263 |
| F-178 H-006/H-007/H-008/H-009 | DELETED hides affordances / read-only badge / Slack gated / global stale-period | DOC-262 / PLT-095 / DOC-264 |
| F-179 H-001/H-004/H-005/H-006 | slice-before-sort / no-op sort / dead-code sort / signal-only-on-overflow | PLT-096 / DOC-263 |
| F-186 H-005/H-006 | Compact hides DEG-Items / no re-layout | DOC-198 |
| F-191 H-004/H-005 | cross-dataset diff / undifferentiated error | PLT-028 / DOC-192 |
| F-192 H-004/H-005/H-007/H-011 | term-path RBAC mis-gate / column-switch corruption / createEnumValue replace / double-event | PLT-029 / DOC-328 |
| F-196 H-002/H-003/H-004 | User-filter bind / ungated / only-no-hidden tab | PLT-030 / PLT-031 / DOC-206 |
| F-197 H-001/H-002/H-005 | tab pre-flight / thread error nav / RBAC | PLT-032 / PLT-099 |
| F-198 H-002/H-004/H-005/H-006/H-009 | halt-config last-writer-wins / silent open-fail / no confirm / post-click / i18n | PLT-053 / PLT-033 |
| F-206 H-006/H-008 | unclassified silent chip / header overflow | PLT-094 |
| F-207 H-005/H-006 | hide-not-disable / provider doesn't gate routes | DOC-176 / DOC-174 |
| F-208 H-002/H-003/H-004/H-009/H-012 | stale-period silent-disable / never-ingested / widget dies silently / single global / forgeable | PLT-097 / DOC-264 |

---

## Dismissed

Short list with the drop reason — sanity-check that nothing real was dropped.

| Feature·Hyp | Reason |
|---|---|
| F-010 H-013 | Dismiss-as-duplicate: validator gap = PLT-083 Defect 1 Option B (same fix/file). |
| F-022 H-000 | Substrate-enrichment gap (TestReport family unenriched), not operator-routable. |
| F-030 H-000-UI-GAP | Methodology coverage gap (read-side Metrics tab unenriched), no operator defect. |
| F-040 H-006 | Confirmed (empty-list 200, mapper-tested) — reviewed, correctly excluded. |
| F-044 H-007 (dup) | Accidental restatement of the H-007 bug already harvested. |
| F-045 H-000 | Rule-9 reflection-confidence meta-hypothesis → ontology validation_gap. |
| F-058 H-010 | Accepted navigation scaffolding asymmetry, documented as the pillar's narrow scope. |
| F-064 H-003/H-010/H-011 | doc closed / speculative DB-load probe / unbounded-count path HTTP-unreachable (required params). |
| F-074 — | (no dismiss). |
| F-075 H-008/H-009 | DOC-208 shipped (auto-approve branch) / DOC-209 shipped (composition caveat) — STALE WebFetch. |
| F-085 H-010 | DOC-240 already added whoami to api-reference — gap CLOSED. |
| F-088 H-011 | Naming drift (two faces of H-002) routed via REFACTOR-108; no-UI correct for M2M. |
| F-089 H-001 | Confirmed happy-path (return-to-origin), not drift; guard subsumed by PLT-075 test-cluster. |
| F-090 H-009 (TOCTOU low) | Data-safe, UX-only under load — fold into DOC-189/PLT-025. |
| F-096 H-003 | REFUTED: NotFoundException IS globally mapped to 404; trim PLT-045's over-scoped 404 bullet. |
| F-096 H-011 | Failure-mode REFUTED: listByOddrns short-circuits empty set — behaviour OK, cheap pin only. |
| F-104 H-002/H-003/H-007/H-010 | IT-103 partly resolves / substrate-coverage gap / ADR-0076 already drafted / speculative mobile probe. |
| F-105 H-011 | Resolves via SME comparative consultation, not a PLT/DOC/TST. |
| F-119 — | (no standalone dismiss). |
| F-122 H-002 | Doc+code RESOLVED (DOC-308/310); residual = internal-artefact fix. |
| F-123 H-004 | REFUTED: owner.name IS partial-scoped (V0_0_64:70) — owner recreate succeeds; do NOT file. |
| F-124 H-001 | LDAP/GitHub admin-groups is full-string equalsIgnoreCase — NO over-promotion; **PLT-081 instructs a NO-OP fix and DOC-235/238 carry a FALSE 'substring' critical admonition that is LIVE — RETRACT.** |
| F-126 — | (no dismiss). |
| F-131 H-… | none dismissed beyond known. |
| F-132 H-… | none. |
| F-141 H-011 | (caveat, not dismiss). |
| F-146 — | (no dismiss). |
| F-147 H-007/H-011 | Affordance/discoverability + virtualisation — fold into PLT-091 / speculative perf probe. |
| F-148 H-009 | Class id 0 unreachable (auto-PK from 1 + searchClass>0 guard) — dead defensive code. |
| F-153 H-000 | Internal coverage-gap (sidecar refresh), not operator-facing. |
| F-155 H-010 | DOWNGRADED: WithPermissions dual-mode gating correct on read — route to a guard test, not a probe. |
| F-156 H-006 | RESOLVED by source: per-row delete is single-row by id, not delete-then-recreate. |
| F-161 — | (no dismiss). |
| F-162 H-012 | rhf-version timing nuance, no operator harm — resolved by H-010's probe. |
| F-171 H-000-UI-GAP | Rule-9 validation-gap (enrich OwnerAssociations UI). |
| F-172 H-000-UI-GAP | Methodology task (run ui-review + mint UI sidecars), not a backlog item. |
| F-176 H-012 | Roll-up UX-polish over H-004/H-006/H-007; no independent novel drift. |
| F-179 H-010/H-011 | RESOLVED from source: context default DENIES (fail-safe) / combinator is && (AND) — no leak, no probe. |
| F-186 H-005/H-006 | KNOWN DOC-198 (caveat) — not dismiss; listed for completeness. |
| F-191 H-000 | Rule-9 reflection-confidence meta (Compare components unenriched). |
| F-196 H-000 | Methodology enrichment debt (UI hops unenriched). |
| F-197 — | (no dismiss). |
| F-198 H-001/H-011 | STALE: WithPermissions now render-gates & fails closed (PLT-034 premise gone) / UI-shell validation-gap. |
| F-205 — | (no F-205 in input). |
| F-206 — | (no dismiss). |
| F-207 H-009/H-010/H-011 | RESOLVED from source: redux profile slice / fail-safe deny / && combinator — confirmed safe, no probe. |
| F-208 — | (no dismiss). |

> **Sanity flag for the maintainer:** F-124 H-001 is the one finding where a tracked item (PLT-081) AND two *done* docs (DOC-235, DOC-238) carry a **factually wrong** "substring over-promotion" critical admonition — the helper is `equalsIgnoreCase` (full-string). This is a LIVE published-doc error that should be **retracted/re-framed**, not merely closed. (F-090 H-008 is the second live-doc-error candidate: NAMESPACE-vs-QUERY_EXAMPLE in DOC-243's shipped table.)

---

## Cross-pillar tally

| Pillar | NOVEL count (deduped) | Next step |
|---|---|---|
| **documentation** (route=caveat, novel) | ~58 | Triage into DOC-NNN backlog. Two are LIVE published-doc errors (F-124 H-001 substring; F-090 H-008 NAMESPACE) — fix first. The rest are missing caveats: deletion-semantics table (F-123), R2DBC pool sizing (F-120), DISABLED-mode UI-vs-API deception (F-207), cross-owner/personalisation notes (F-001/F-022/F-032/F-035). |
| **code** (route=bug, novel) | ~52 | Log into `issues/odd-platform/PLT-NNN`. Highest-leverage roots: RBAC name-guard cluster (F-006), notification reliability (F-009 thread-death/429/SMTP/2xx), audit-attribution loss (F-021 H-007/H-011), attachment security cluster (F-027), token-reveal UI cluster (F-163), DQ destructive-write controls (F-022/F-057). |
| **test** (route=test, novel) | ~48 | Mint TEST-GAP / IT-NNN + run the PENDING-F-* probes locally. Highest-value: zero logout tests (F-086), audit-export compound pin (F-014), ingestion-matcher regression (F-094), responsive-viewport ITs (F-161/F-176/F-177/F-191), i18n CI parity gate (F-043 H-009 — the systemic root). |

**Net:** ~158 NOVEL findings → ~95 distinct work-items after cross-feature dedup. The largest single root is **DISABLED-mode read-collaborative posture** (touches F-001/F-003/F-014/F-027/F-032/F-035/F-074/F-085/F-094/F-105/F-122/F-141/F-207) — most are already ADR-0003/REFACTOR-024 posture decisions; the *novel* slices are the per-surface UI-vs-API deception caveats and the few genuinely-ungated endpoints (F-027 attachments, F-074/F-174 owner-association activity log).
