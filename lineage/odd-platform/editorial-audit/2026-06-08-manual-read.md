# Editorial audit — full-manual editorial + code-truth read (2026-06-08)

End-to-end owner read of the published ODD manual (`documentation/docs/**`), every claim spot-checked against odd-platform source. Point-in-time snapshot; line numbers and SHAs are as-of 2026-06-08 and re-verify before acting.

## Executive counts

- **Total findings: 76** (14 sections read; ~145 pages).
- **NOVEL: 42 · KNOWN (already in `doc-gaps.md` / backlog): 34.**
- **By severity:** critical 3 · high 11 · medium 14 · low 48.
- **By kind:** code-doc-drift 33 · internal-contradiction 6 · conceptual-drift 6 · cross-audience-gap 6 · parallel-surface-drift 4 · reader-flow 5 · half-finished 2 · dead-admonition 0. (Plus ~150 high-stakes claims verified ACCURATE & recorded as positive confirmations — not counted as findings.)
- **The headline:** the soft-delete TTL "persists forever" inversion is published on **THREE** surfaces (`statuses.md`, `de-deprecation.md`, `odd-platform.md`) AND its own tracked items (DOC-191/DOC-293/DOC-GAP-088) concluded the **inverted** truth — an LSN-001-class data-loss-inversion that the tracking system itself certified wrong.

---

## CRITICAL / HIGH code-doc-drift — wrong claim on a published page (LSN-001 / LSN-002 class)

These are the actively-misleading, operator-off-a-cliff findings. Listed in full first.

### [CRITICAL] Soft-delete TTL inversion — published on 3 surfaces; the TRACKING IS ALSO WRONG
**Pages:** `data-discovery/statuses.md` (DANGER block, lines ~32-39) · `use-cases/de-deprecation.md` (lines 13, 34) · `configuration-and-deployment/odd-platform.md` (line ~821).
**Wrong claim:** the 30-day hard-delete TTL "does not fire today / has no effect", DELETED rows "persist indefinitely / forever"; operators told DELETED is a safe indefinite parking state. Blamed on a `DataEntityMapperImpl.applyStatus` mapper defect.
**Code truth:** the DELETED transition does NOT go through `applyStatus`. Manual `updateStatus→DELETED` and the scheduled `DataEntityStatusSwitchJob` both route `changeStatusForDataEntities → softDeleteDataEntities → delete() → getDeleteChangedFields()`, which explicitly writes `STATUS_UPDATED_AT = now()` (`ReactiveDataEntityRepositoryImpl.java:113`). `DataEntityHousekeepingJob` then hard-deletes `WHERE STATUS=DELETED AND STATUS_UPDATED_AT <= now-30d` (`DataEntityHousekeepingJob.java:75-77`), cascading to lineage/metadata/alerts/group-relations **and S3/MinIO objects** via `fileUploadService.deleteFiles().block()` (line 142), with no restore path. The `applyStatus` ordering bug (lines 247-251) is real but ONLY on the non-delete **restore** branch — it never gates the purge. **The TTL works and irreversibly hard-deletes including object storage.**
**Fix:** Reopen DOC-191 / DOC-293 / DOC-GAP-088 (their tracked conclusion is itself inverted — DOC-293 even overrode a verification agent who correctly read "purge fires at 30 days"). Rewrite all three surfaces: the 30-day purge IS active and irreversible. Scope the `applyStatus` caveat narrowly to "`status_updated_at` is not refreshed on DRAFT/STABLE/DEPRECATED transitions; does NOT affect hard-delete retention." Cite `ReactiveDataEntityRepositoryImpl.getDeleteChangedFields():113`, `DataEntityHousekeepingJob:75-77`.

### [HIGH] `statuses.md` — manual-cleanup SQL keys on a column that is always NULL on delete
**Page:** `data-discovery/statuses.md` (the "Manual cleanup until the fix lands" SQL inside the same DANGER block).
**Wrong claim:** workaround SQL filters `WHERE status=5 AND status_switch_time IS NOT NULL AND status_switch_time < now()-interval '30 days'`; prose says "the platform always writes status_switch_time on a status change."
**Code truth:** `getDeleteChangedFields()` sets `STATUS_SWITCH_TIME = NULL` on every soft-delete (`ReactiveDataEntityRepositoryImpl.java:114`). For every DELETED row `status_switch_time IS NULL` → the recommended query matches ZERO rows. An operator runs it in a maintenance window and deletes nothing. The correct ageing column is `status_updated_at`.
**Fix:** drop the manual-cleanup section (the platform TTL works); if any SQL survives the rewrite, key the cut-off on `status_updated_at`, not `status_switch_time`.

### [HIGH] `oauth2-oidc.md` — GitHub `admin-groups` claimed SUBSTRING; code is FULL equality (security-relevant)
**Page:** `configuration-and-deployment/enable-security/authentication/oauth2-oidc.md` (admin matrix line ~64; DANGER admonition lines ~139-141).
**Wrong claim:** GitHub `admin-groups` is a "case-insensitive substring (groups)" match — `admins` matches `team-admins`/`admins-readonly`/`data-admins`; "a platform-side fix to use exact equality is tracked upstream."
**Code truth:** the OPPOSITE — `GithubUserHandler.java:119` calls `containsIgnoreCase(adminGroups, userTeam)`, and `OperationUtils.containsIgnoreCase = collection.stream().anyMatch(element::equalsIgnoreCase)` = FULL case-insensitive equality, NOT substring. `admins` does NOT match `team-admins`. The "exact-equality fix tracked upstream" already IS the shipped behaviour. Dual harm: operator either over-fears a non-existent escalation, or sets `admin-groups:[admins]` expecting it to promote `team-admins` members and silently grants nobody ADMIN. (Root: DOC-235's own title baked the substring claim in as intended, not as a defect.)
**Fix:** correct to "case-insensitive FULL team-name equality (no substring)"; remove the `team-admins`/`admins-readonly` example and the "fix tracked upstream" sentence; cite `GithubUserHandler.java:119` + `OperationUtils.containsIgnoreCase`. Re-verify live.

### [HIGH] `oauth2-oidc.md` ↔ `admin-promotion.md` — two security pages contradict on ADMIN promotion (code sides with admin-promotion)
**Pages:** `oauth2-oidc.md` (matrix rows; Okta/Keycloak warning lines ~417-419) vs `enable-security/admin-promotion.md` (rows 3, 7, gotchas).
**Wrong claim:** `oauth2-oidc.md` says Okta/Keycloak/Custom OIDC have "No admin path… CustomOIDCUserHandler does not consult admin-groups, admin-principals, or any claim." (And the GitHub substring discrepancy above.)
**Code truth:** `AbstractOIDCUserHandler.java:33-52` (parent of `CustomOIDCUserHandler`) confirms `admin-promotion.md`: `admin-principals` IS evaluated always; `admin-groups` when `groups-claim` is set. `oauth2-oidc.md` is wrong on both rows — and its own Okta/Keycloak YAML examples include `admin-principals` (which its matrix calls a no-op), an in-page contradiction too.
**Fix:** reconcile `oauth2-oidc.md` to `admin-promotion.md` (the code-correct SoT): GitHub `admin-groups`=full match; Okta/Keycloak/Custom OIDC = `admin-principals` always + `admin-groups` when `groups-claim` set. Cite `AbstractOIDCUserHandler.java:33-52` + `GithubUserHandler.java:119`.

### [HIGH] `alerting.md` — attributes Notifications' WAL mechanism to alerting + invents a resilience property
**Page:** `active-platform-features/alerting.md` (line 17, sentence under the second figure).
**Wrong claim:** "The platform uses PostgreSQL logical replication to deliver alerts even when the alerting pipeline is briefly partitioned from the primary database."
**Code truth:** alerts are created by a plain `INSERT` on the ingestion path (`ReactiveAlertRepositoryImpl.java:324-333`), independent of replication. Logical replication is consumed ONLY by the Notifications subsystem's WAL subscriber (`NotificationSubscriber.java` `PGReplicationStream`), which starts ONLY when `notifications.enabled=true` (`NotificationSubscriberStarter.java:17` `@ConditionalOnNotifications`, default false). The framing is backwards: the WAL subscriber READS FROM the primary, so a partition from the primary STOPS it; alert UI visibility never depends on replication. Also contradicts the page's own next sentence (which correctly defers delivery to Notifications).
**Fix:** delete/rewrite line 17. Replication is a prerequisite of the optional outbound Notifications subsystem, not of alerting. Move any replication-prerequisite mention to Notifications context; drop the "partitioned from the primary" resilience claim. Cite `ReactiveAlertRepositoryImpl.java:324-333`, `NotificationSubscriberStarter.java:17`, `NotificationSubscriber.java:24,55,60`.

### [HIGH] `data-lineage.md` intro — singular/combined lineage path that 404s
**Page:** `data-lineage.md` (subsections table line 17; intro line 11).
**Wrong claim:** per-entity lineage endpoint cited as `/api/dataentity/{id}/lineage` (singular, combined).
**Code truth:** the real API is plural and stream-SPLIT: `/api/dataentities/{data_entity_id}/lineage/upstream` + `/lineage/downstream` (`openapi.yaml:1253,1287`). No `/api/dataentity/` singular route exists → 404. The child api-reference page and `data-objects.md` use the correct form, so the intro contradicts its own section.
**Fix:** cite the two split plural endpoints on `data-lineage.md:17` (mirrors DOC-043/DOC-087/DOC-226 + `api-reference/lineage.md`).

### [HIGH] `build-and-run-odd-platform.md` — frontend prereqs stale by a major version; BLOCKS from-source build
**Page:** `developer-guides/build-and-run/build-and-run-odd-platform.md` (Prerequisites, line 33).
**Wrong claim:** "Node 18.16.0", "pnpm 8.4.0".
**Code truth:** `odd-platform-ui/.nvmrc` pins `v24.13.0`; `package.json` engines require `node >=24.8.0 <25.0.0` and `pnpm >=9.12.3 <10`. Installing the documented Node 18 / pnpm 8 fails the engines gate (pnpm refuses to run) — the onboarding path the page exists to enable does not work.
**Fix:** update pins to Node >=24.8.0 <25 (per `.nvmrc`) and pnpm >=9.12.3 <10 (per `package.json#engines`); point at `.nvmrc` as SoT to stop re-drift. Read `.nvmrc` + `package.json#engines` each refresh, not from memory.

### [HIGH] `.gitbook/includes/auth-type-oauth2-oa....md` — Okta example sets `PROVIDER=google` (mis-routes login)
**Page:** `docs/.gitbook/includes/auth-type-oauth2-oa....md` (env-vars tab line 29).
**Wrong claim:** `AUTH_OAUTH2_CLIENT_OKTA_PROVIDER=google` while the sibling YAML tab (line 13) sets `provider: okta`.
**Code truth:** `provider` is the runtime routing discriminator — `GoogleUserHandler.applies()` (`GoogleUserHandler.java:39` `provider.equalsIgnoreCase(Provider.GOOGLE.name())`) means `provider=google` routes an Okta-keyed client through the Google handler (Google email/`hd`-domain logic) instead of `CustomOIDCUserHandler` → broken/mis-routed Okta login. Identical to the bug DOC-036 fixed on canonical `oauth2-oidc.md` (now line 445 `=okta`, VERIFIED) — the fix never reached this orphaned duplicate.
**Fix:** delete the orphaned include outright (see NOVEL parallel-surface-drift below); it transcludes nowhere and is absent from SUMMARY. If kept, set line 29 `=okta`. Fold into DOC-036's converge-to-zero closure.

### [HIGH] `lookup-tables.md` — field type TIME → wrong PG type AND wrong semantics
**Page:** `master-data-management/lookup-tables.md` (Supported field types, TIME row).
**Wrong claim:** TIME maps to PostgreSQL `time`, "Time of day (no date component)".
**Code truth:** `LookupTableColumnTypes.java:44` `TYPE_TIME(TIMESTAMP, "TIME", …)` + `LookupTimestampValidator.java:9,28` uses `SQLDataType.TIMESTAMP` and `java.sql.Timestamp.valueOf(value)` — selecting TIME creates a `timestamp` (date+time) column, and a bare time-of-day value throws `BadUserRequestException` on insert. Both the PG type AND the "no date component" semantics are wrong on the page's own recommended direct-SQL path.
**Fix:** `TIME | timestamp | Date+time instant (NOT time-of-day; values must be full yyyy-mm-dd hh:mm:ss)`. Cite `LookupTableColumnTypes.java:44`, `LookupTimestampValidator.java:9,22-31`.

### [HIGH] `lookup-tables.md` — DANGER admonition warns against a DELETE endpoint + UI affordance that do not exist
**Page:** `master-data-management/lookup-tables.md` (Known operator caveats, "Deleting the parent DataEntity directly leaves orphan rows").
**Wrong claim:** deleting a Lookup Table via `DELETE /api/dataentities/{id}` ("generic catalog-side delete") / an entity-detail-page Delete affordance leaves orphan rows; prescribes recovery SQL.
**Code truth:** no such endpoint exists — `openapi.yaml` has NO whole-DataEntity delete operation (only scoped sub-deletes); `DataEntityController.java:130-451` has no entity hard-delete; `dataentities.thunks.ts` has no entity-delete thunk (removal is a soft status-change). The caveat fabricates an API endpoint + UI affordance and prescribes recovery SQL for an unreachable state. (The positive half — `/api/referencedata/table/{id}` DELETE drops registry row + backing table via `ReferenceDataServiceImpl.java:154-158` → `ReferenceDataRepositoryImpl.java:268-273` `DSL.dropTable` — IS correct.)
**Fix:** rewrite/remove the danger block — there is no generic DataEntity delete to warn against. If a real orphan vector exists it is a different mechanism (direct SQL on `data_entity`); re-derive before re-asserting.

### [HIGH] `data-modelling.md` — UI-entry-points table overstates RBAC (priority-1 actively-misleading)
**Page:** `data-modelling.md` (UI entry points table, lines 21-22).
**Wrong claim:** `/data-modelling/query-examples` "RBAC-gated by QUERY_EXAMPLE_CREATE"; `/data-modelling/query-examples/{id}` "RBAC-gated by QUERY_EXAMPLE_UPDATE + QUERY_EXAMPLE_DELETE".
**Code truth:** the route mount is NOT permission-guarded — list and details are read-open to any authenticated user; only the "Add query example" button (`QUERY_EXAMPLE_CREATE`) and per-example edit/delete actions are gated. `WithPermissionsProvider` seeds context but renders its child unconditionally. The child `query-examples.md` was corrected (DOC-160); the intro table still overstates. Overstating a restriction the code does not enforce → operator may assume per-permission read isolation that does not exist.
**Fix:** reword: list/details VIEW is read-open; `QUERY_EXAMPLE_CREATE` gates only Add; `QUERY_EXAMPLE_UPDATE/_DELETE` gate only edit/delete. (Known: DOC-GAP-160.)

---

## NOVEL front queue — every other NOVEL finding (by severity, then section)

### MEDIUM

- **[MED] `active-platform-features.md`#why-this-is-a-separate-pillar (internal-contradiction)** — fail-start warning (line 35) enumerates only `notifications.enabled`/`datacollaboration.enabled` as the no-default-aborts-startup hazard and states "the other subsystem flags do not share this hazard", but `notifications.message.downstream-entities-depth` has the identical hazard (`NotificationConfiguration.java:123`, `@Value` no `:default`) → omitting it from a mounted config aborts startup. -> broaden line 35: add `downstream-entities-depth` to the no-default keys, or soften the closing sentence (cite `NotificationConfiguration.java:123`, `FeatureResolverImpl.java:16-17`).
- **[MED] `data-discovery/statuses.md`#status-propagate-to-data-sources (code-doc-drift)** — claims flipping an entity back from DELETED reverts the parent DataSource row ("mirrors entity-level status changes back up the data-source row"); no such mirroring found — `restore()` touches lineage/group/parent-group relations, statistics, MANUALLY_CREATED flag, no DataSource write; `DataEntityStatusDto` has no DataSource coupling. -> cite the consumer that mirrors status to DataSource or remove the section; if intent is the soft-delete cascade, restate accurately.
- **[MED] `data-discovery/groups-domains.md`#what-a-deg-is (code-doc-drift)** — class/type taxonomy inverted: "DEG is a Data Entity of type DATA_ENTITY_GROUP" (it's a CLASS, `DataEntityClassDto` id 8) and "ML experiment is a DEG of class ML_EXPERIMENT" (ML_EXPERIMENT is a TYPE, `DataEntityTypeDto` id 6, within the DATA_ENTITY_GROUP class). Undercuts `entity-detail-page.md`'s "class is load-bearing, type is descriptive" framing. -> a DEG is CLASS DATA_ENTITY_GROUP; ML experiments are DEGs whose TYPE is ML_EXPERIMENT. Verify `DataEntityClassDto:43-51`, `DataEntityTypeDto`.
- **[MED] `data-glossary/business-glossary.md`#term-to-entity-associations (internal-contradiction)** — "Ownership and privileges" (lines 50, 92) says the owner "holds the authority to create, approve edits, and delete" (ownership-as-gate), but the page's own Security caveats (lines 141-167) establish term link/create/delete are NOT gated by ownership (any authenticated user mutates). No in-text reconciliation. -> clarify ownership = editorial responsibility, not an enforced gate; actual gating via TERM_* policy permissions (several link paths ungated). Remove/qualify the duplicated authority sentence.
- **[MED] `data-quality/test-run-history.md`#where-to-find-it (code-doc-drift)** — `/test-report` is not a real route; two history components conflated. Full-history surface (100/page, infinite-scroll, status filter) is the entity HISTORY tab `/dataentities/{id}/history` (`TestRunsHistory.tsx:27,90,60-73`); the size-10 no-pagination view is `TestReportDetailsHistory.tsx:31` at `/dataentities/{id}/test-reports/{testId}/history` (`dataEntitiesRoutes.ts:75-87`, `TestReportDetails.tsx:62`). "Paste `/test-report`" lands nowhere. -> replace `/test-report` with the real `test-reports/{testId}/…` path; distinguish the two surfaces. (Cross-ref DOC-185.)
- **[MED] `data-modelling/relationships.md`#where-to-next ↔ `collectors/odd-collector.md` (parallel-surface-drift)** — `relationships.md` correctly lists ERD adapters as PostgreSQL+Snowflake only, but cross-links `odd-collector.md` as the authoritative ERD matrix, and that page drifted: `odd-collector.md:1246,:358` add "cockroachdb (via PostgreSQL inheritance)" while `:1259` self-contradicts ("Foreign-key extraction is PostgreSQL/Snowflake only"). -> reconcile on `odd-collector.md` (verify against `../odd-collectors` whether CockroachDB emits ENTITY_RELATIONSHIP; either add to `relationships.md:58-63` too or remove the CockroachDB ERD claims + fix line 1259).
- **[MED] `integrations/README.md`#token-and-datasource-registration (internal-contradiction)** — universal claim "every integration authenticates with a collector token" and "every integration registers via POST /ingestion/datasources", but `odd-tracing-gateway` (listed as push, line 29) uses NO token and never calls `/ingestion/*` (Platform PULLs `GET /entities`); it's absent from the token table (lines 124-131); `odd-spark-adapter` is flagged "no static token". -> scope the universal claim to pull collectors + Ingress-API push adapters; add a tokenless gateway row/footnote; acknowledge spark identifies by oddrn.key only.
- **[MED] `management/namespaces.md`#auto-create-side-door (code-doc-drift)** — sister-service side-door table lists CREATE-only for Term/Collector/DEG, but the UPDATE paths ALSO call `namespaceService.getOrCreate` and bypass `NAMESPACE_CREATE`: `TermServiceImpl.java:138`, `CollectorServiceImpl.java:57`, `DataEntityGroupServiceImpl.java:84` (DataSource correctly lists both — table is asymmetric). Holders of TERM_UPDATE/COLLECTOR_UPDATE/DATA_ENTITY_GROUP_UPDATE can mint namespaces. -> add PUT/update endpoints + *_UPDATE permissions to the three rows + the mitigation paragraph (line 74). (Related: DOC-299/DOC-255/DOC-254; this specific gap untracked.)
- **[MED] `lookup-tables.md`#supported-field-types JSON row (code-doc-drift)** — JSON maps to PostgreSQL `json` per doc, but `LookupTableColumnTypes.java:48` `TYPE_JSON(JSONB, "JSON", …)` + `LookupJSONBValidator.java:10,15` returns `SQLDataType.JSONB` — distinct type (binary, key-reordered, whitespace/dup-key stripped), material for the page's direct-SQL/BI readers. -> change cell to `jsonb`; note keys normalised/reordered.
- **[MED] `Features.md`#multilingual-ui (code-doc-drift)** — locale switcher described as a "gear-icon picker on the toolbar" (L284, L286); it actually lives in the user-account/profile dropdown (`AppToolbar.tsx:72-117` `DropdownIcon` → AppMenu → `SelectLanguage.tsx`); no gear icon. Stale DOC-171 residue; canonical `multilingual-ui.md` was fixed under DOC-304 but these two cross-refs were not. -> replace with "language picker in the user-account menu"; grep the docs tree for "gear-icon"/"gear icon".

### LOW (novel)

- **[LOW] `active-platform-features/metrics-ingestion.md` line 7 (conceptual-drift)** — calls the five MetricType values "the OpenMetrics metric model" + links openmetrics.io, but GAUGE_HISTOGRAM is not an OpenMetrics type; the set is ODD's own enum. -> "ODD's metric model (OpenMetrics-inspired)" / attribute the list to ODD's ingestion contract.
- **[LOW] `enable-security/README.md` deployment matrix (code-doc-drift)** — `POST /ingestion/metrics` listed as a sibling ingestion endpoint, but it's not in odd-platform's `openapi.yaml`/any controller (ingestion endpoints are generated from external `ingestion-contract-server 0.1.40`, not checked out) — could not confirm against source; possible phantom row. -> verify the path exists in the ingestion-contract; drop the row if not. (Other rows sound.)
- **[LOW] `enable-security/authentication/ldap.md` final config example (cross-audience-gap)** — shipped `application.yml` LDAP template (lines 50-65) includes `auth.ldap.base:`, which `ldap.md` never documents. -> document `auth.ldap.base` (LDAP context base DN) or confirm vestigial + remove from the template (verify `LDAPSecurityConfiguration`/context-source builder).
- **[LOW] `data-discovery/search.md` + `entity-detail-page.md` class tables (conceptual-drift)** — both strip the canonical `DATA_` prefix from class enums: `SET`/`TRANSFORMER`/`CONSUMER`/`INPUT`/`ENTITY_GROUP`/`RELATIONSHIP` etc. vs real `DATA_SET`/`DATA_TRANSFORMER`/`DATA_ENTITY_GROUP`/`DATA_RELATIONSHIP`. Wrong on 8 of 9 rows; a published reference table. -> normalize to `DataEntityClassDto.java:43-51` values, or note the short-label convention + name the canonical enum.
- **[LOW] `data-glossary/business-glossary.md`#term-create-drain (code-doc-drift)** — "two staging tables for [[namespace:term]] mentions"; there are THREE: `data_entity_description_unhandled_term`, `dataset_field_description_unhandled_term` (`V0_0_78`:1,13) + `term_definition_unhandled_term` (`V0_0_91`:14). Page's own XSS hint already references the term-definition path. -> "three staging tables" / "a set of staging tables".
- **[LOW] `data-glossary/business-glossary.md`#visibility-cross-tab (code-doc-drift, unverified)** — "only the Query Examples tab is always visible" on a zero-link term is plausible but not proven against tab-visibility code. -> verify `TermDetailsTabs.tsx`/`TermDetailsRoutes.tsx` that Query Examples renders unconditionally while Linked* gate on counts; cite file:line or soften.
- **[LOW] `data-glossary/business-glossary.md`#known-operator-caveats (cross-audience-gap)** — every Security/RBAC caveat says "until the upstream fix lands" with no issue link / version gate; the audience (RBAC auditors) can't map a caveat to their version. PLT-012 pinning test (`SecurityRulesAuthzGapsKnownBugsTest.java`) never referenced. -> add per-hint upstream-issue link or "fixed-in vX.Y / open as of vX.Y"; cross-link Permissions page warnings (DOC-GAP-077).
- **[LOW] `data-glossary.md` / `business-glossary.md` SUMMARY vs live-URL (reader-flow)** — internal xrefs/anchors/assets all resolve; but `doc-gaps.md` historically WebFetched these at `/features/data-glossary/…` (200), a prefix no longer in SUMMARY. Not a defect in these files. -> optionally confirm GitBook publishes at `/data-glossary/business-glossary` and that prior `/features/data-glossary/*` deep-links 301-redirect.
- **[LOW] `data-lineage.md`#my-objects-triplet (reader-flow)** — deep API-contract + perf caveats (anchor-fetch owner scoping, O(anchor) pagination, 4-way-ambiguous empty response) sit on the top-level landing page; child `data-objects.md` Access-model omits the my/upstream-downstream triplet. Content-altitude drift. -> relocate the triplet deep-dive to `data-objects.md`/`api-reference/lineage.md`, leave a pointer; verify anchor-fetch claims current (`DataEntityServiceImpl.java:212-216`, `:219-225`) before moving.
- **[LOW] `data-modelling/query-examples.md`#known-operator-caveats stored-XSS (code-doc-drift)** — danger says a raw `<script>` "fires for every authenticated viewer"; sanitisation gap is real (no rehype-sanitize AND no rehype-raw; `@uiw/react-md-editor ^3.25.6`, `QueryExampleDetailsOverview.tsx:19,25`, `Markdown.tsx:113-124`), but without rehype-raw react-markdown escapes raw HTML — a literal `<script>` renders inert. Live vectors are `javascript:` hrefs / image `onerror`. -> keep the caveat, tighten the mechanism (literal `<script>` is escaped; the concrete vector is a residual `TermLink` raw-href code path at `Markdown.tsx:49-58` — precise mechanism held pre-disclosure under GHSA-mf43-2636-9289 / CTRIB-020).
- **[LOW] `data-quality/test-results-import.md` line 9 (internal-contradiction)** — "four canonical paths today, plus a custom-framework escape hatch", but the body has THREE (Great Expectations, dbt, odd-collector-profiler) + the escape hatch; `data-quality.md:15` and `dq-visibility.md:11` say three. -> "three canonical paths … plus a custom-framework escape hatch".
- **[LOW] `data-quality/sla-statuses.md` line 25 (code-doc-drift)** — `DataSetSLAReport` JSON described as carrying "a `sla_ref` self-link", but `SLACalculator.java:64` sets `slaRef` to `/api/datasets/{id}/sla` (the PNG-badge sibling), a cross-link not a self-link. (Content-Type table itself is accurate.) -> reword to "a `sla_ref` link to the matching PNG badge endpoint (`/api/datasets/{id}/sla`)".
- **[LOW] `integrations/auxiliary/odd-tracing-gateway.md` Docker Compose (internal-contradiction)** — narrative says `GET /entities` on :8080 (lines 29, 198) but the Compose example maps `8081:8080  # GET /entities` (host 8081). A Compose copier reaches :8081, not :8080. -> add a clause that with the example mapping the gateway is on host :8081 (container 8080), or change the example to `8080:8080`.
- **[LOW] `integrations/README.md`#pull-vs-push adapter count (conceptual-drift)** — exact "41" on README (line 19) + `odd-collector.md` vs "40+" on `main-concepts.md` line 23. Soft precise-vs-vague mismatch, not a contradiction. -> keep integrations at the code-cited 41; optionally tighten `main-concepts.md` to 41 (or keep "40+" as a deliberate approximation).
- **[LOW] `integrations/collectors/odd-collector.md`#apache-hive port (code-doc-drift)** — "Defaults to 10000 when scheme unset, 1000 when scheme: http/https"; `1000` is not an HS2 convention (HTTP transport is 10001). -> verify pyhive/HS2 default + HivePlugin model; correct `1000`→ likely `10001` (or cite the exact `plugin.py` line).
- **[LOW] `integrations/collectors/odd-collector-gcp.md` (reader-flow)** — body links the broken anchor `#googlecloudstoragedeltatables` (lines 107,164,166) then admits at line 205 the anchor is typo'd (`##` not `#`); readers hit the dead anchor before the caveat; the "parameters" reference is entirely offloaded to the external README. -> drop the broken-anchor links for the plain README root link, or inline a minimal parameters table to home the surface.
- **[LOW] `Architecture.md`#cross-cutting-concerns (cross-audience-gap)** — pointer list omits Metrics Ingestion, which `active-platform-features.md:20` presents as a first-class subsystem with an unauthenticated `POST /ingestion/metrics` ingress (`metrics.storage` default INTERNAL_POSTGRES `application.yml:159`). -> add a Metrics Ingestion bullet pointing at `active-platform-features/metrics-ingestion.md` + the perimeter-auth caveat.
- **[LOW] `Features.md`#dataset-quality-statuses-sla L146 (code-doc-drift)** — frames `/api/datasets/{id}/sla` as the colour/data-import endpoint, but `openapi.yaml:1884` `getSLA` returns image/png (badge); the JSON report is `getDatasetSLAReport` at `/sla_report` (`openapi.yaml:1898-1902`). Same PNG-vs-JSON imprecision DOC-169 fixed on the sub-page. -> distinguish the two BI-import paths on L146 (match `data-quality.md:17`).
- **[LOW] `.gitbook/includes/auth-type-oauth2-oa....md` (parallel-surface-drift)** — the entire file is an orphaned, drifted duplicate of the `oauth2-oidc.md` Okta block (lines 421-457): zero `{% include %}`/content-ref references it, absent from SUMMARY, carries the `PROVIDER=google` bug the canonical copy had fixed. DOC-277 mis-characterized it as "embedded into other pages" (false — verified un-transcluded). -> delete the file (Gate 1 duplicate / Gate 10 single-home); correct DOC-277's note. (Also internal-contradiction: issuer-uri placeholder `{okta_issuer_uri}` vs `{issuer_uri}` across tabs — resolved by deletion.)
- **[LOW] `use-cases/dc-data-compliance.md` step 6 (reader-flow)** — Solution (line 12) correctly states ODD does NOT classify sensitivity, but step 6 ("I find out that Dim_Customers… are PII") reads as system-derived. -> reword to "Reading the owner-applied tags/labels … I judge that…".

---

## KNOWN — already tracked in `doc-gaps.md` / backlog (34)

| Page (#anchor) | Kind | Known ref |
|---|---|---|
| `oauth2-oidc.md` toString-credential-leak (also `ldap.md`/`login-form.md`) | code-doc-drift | DOC-GAP-006/050/067 |
| `quick_launch_…_eks.md` Swagger UI URL (dead path) | code-doc-drift | DOC-111 + PLT-141 |
| `oauth2-oidc.md` `username-attribute` vs `user-name-attribute` | conceptual-drift | doc-gaps batch-D 2026-05-12 |
| `oauth2-oidc.md` ODD_IAM provider absent | cross-audience-gap | DOC-GAP-046 |
| `statuses.md` soft-delete TTL inversion | code-doc-drift | DOC-GAP-088 / DOC-191 (tracked conclusion INVERTED — reopen) |
| `entity-description.md`/`custom-metadata.md`/`per-column-annotation.md` security caveats | code-doc-drift (positive) | DOC-GAP-010/023/096/101, DOC-193, DOC-246 |
| `business-glossary.md` term-create TERM_CREATED fiction | code-doc-drift | DOC-230 |
| `business-glossary.md` [[ns:term]] syntax only in figures | conceptual-drift | DOC-GAP-100 |
| `api-reference/lineage.md` `expanded_entity_ids` type too narrow | parallel-surface-drift | DOC-GAP-132 / DOC-GAP-090 (OPEN) |
| `api-reference/lineage.md` silent on cycle handling | code-doc-drift | DOC-GAP-132 (OPEN) |
| `data-lineage.md` my-objects OpenAPI summary wrong shape | code-doc-drift | DOC-GAP-099 (OPEN — spec fix) |
| `data-objects.md`/`api-reference/lineage.md` lineage_depth NPE | code-doc-drift (positive) | DOC-GAP-089/021 (CLOSED) |
| `microservices.md` OTel fields dropped | cross-audience-gap | DOC-226 |
| `query-examples.md` "name" field that doesn't exist | code-doc-drift | DOC-GAP-125 |
| `relationships.md` Target-col shows Source | code-doc-drift (positive) | P-167 |
| `relationships.md` no-RBAC on /api/relationships* | code-doc-drift (positive) | doc-gaps:382 |
| `dashboard.md` "Unknown Category" casing | conceptual-drift | doc-gaps ~732-734 |
| `dashboard.md`/`test-run-history.md` run-status meaning legend | half-finished | doc-gaps ~182-183 |
| `api-reference/lineage.md` lineage_depth required-in-practice | code-doc-drift (positive) | DOC-GAP-089/021 (CLOSED) |
| `api-reference/data-collaboration.md` /api/slack/events unauth+unsigned | code-doc-drift (positive) | Slack collab cluster |
| `api-reference.md`/`custom-collectors.md` 200-vs-201 ingestion status | code-doc-drift (positive) | DOC-GAP-074/093 |
| ADR log (27 records) Evidence citations | code-doc-drift (positive) | backlog/adr/ADR-* |
| `push-adapters/*` Quality-Dashboard xref convergence | parallel-surface-drift | DOC-113 |
| `integration-wizard.md` GET /api/integrations no-RBAC | code-doc-drift (positive) | doc-understanding integrations__README.md |
| `integrations/README.md` ingestion 5xx error contract + row-lock | code-doc-drift (positive) | DOC-195 (+ PLT-045) |
| `push-adapters/*` replace-not-merge + unauth-ingestion admonitions | code-doc-drift (positive) | DOC-GAP-038 + DOC-GAP-143/F-008 |
| `lookup-tables.md` Administrator policy lacks LOOKUP_TABLE_* | code-doc-drift | DOC-GAP-078 |
| `de-deprecation.md` soft-delete TTL inversion | code-doc-drift | DOC-191/DOC-293, PLT-027 (INVERTED — reopen) |
| `de-deprecation.md` switch-job cadence/no-batch-cap xref | cross-audience-gap | DOC-191 |
| `dq-visibility.md` stats endpoint unauthenticated | code-doc-drift (positive) | DOC-GAP-038 |
| `odd-platform.md` soft-delete TTL "no effect" | code-doc-drift | DOC-191/DOC-293 (INVERTED — reopen) |
| `data-objects.md` group-lineage 404 / nested-DEG drop / both-endpoints filter | code-doc-drift (positive) | (LineageServiceImpl confirmations) |
| `data-objects.md` `?d=` param + click-through depth compounding | code-doc-drift (positive) | (Node.tsx/HierarchyLineage confirmations) |
| `build-and-run-odd-collectors.md`/`github-organization-overview.md` `collector-config.yaml` hyphen | code-doc-drift | DOC-044 (underscore convention) |

> Several "KNOWN (positive)" rows are code-truth CONFIRMATIONS recorded by the reader (claim verified accurate against source), not open defects — kept here for the doc↔code-fix provenance trail.

---

## By-section index

| Section | Novel / Known | Worst finding |
|---|---|---|
| active-platform-features | 3 / 0 | [HIGH] `alerting.md` invents replication-resilience for alerts (Notifications' WAL mechanism) |
| configuration-and-deployment | 4 / 4 | [HIGH] `oauth2-oidc.md` GitHub admin-groups substring vs code's full equality (security) + page contradicts `admin-promotion.md` |
| data-discovery | 4 / 2 | [CRITICAL] `statuses.md` soft-delete TTL inversion (TTL works + hard-deletes incl. object storage) |
| data-glossary | 4 / 3 | [MED] `business-glossary.md` ownership-as-gate prose contradicts the ungated-RBAC caveats |
| data-lineage | 4 / 5 | [HIGH] `data-lineage.md` singular `/api/dataentity/{id}/lineage` 404 path |
| data-modelling | 2 / 4 | [HIGH] `data-modelling.md` UI table overstates QUERY_EXAMPLE read-RBAC |
| data-quality | 3 / 2 | [MED] `test-run-history.md` `/test-report` non-existent route, two history surfaces conflated |
| developer-guides | 3 / 5 | [HIGH] `build-and-run-odd-platform.md` Node 18/pnpm 8 prereqs block the build (real: Node 24 / pnpm 9) |
| .gitbook | 2 / 1 | [HIGH] orphaned Okta include sets `PROVIDER=google` (mis-routes login) — delete the file |
| integrations | 5 / 4 | [MED] `README.md` universal collector-token claim contradicted by tokenless `odd-tracing-gateway` |
| management | 1 / 0 | [MED] `namespaces.md` side-door table omits Term/Collector/DEG UPDATE bypass paths |
| master-data-management | 3 / 1 | [HIGH] `lookup-tables.md` TIME→timestamp (wrong type+semantics) AND fabricated DataEntity-DELETE danger block |
| use-cases | 1 / 3 | [CRITICAL] `de-deprecation.md` soft-delete TTL inversion (3rd surface; reopen DOC-191/293) |
| root-pages | 3 / 0 | [MED] `Features.md` multilingual "gear-icon" affordance that doesn't exist (real: user-account menu) |
