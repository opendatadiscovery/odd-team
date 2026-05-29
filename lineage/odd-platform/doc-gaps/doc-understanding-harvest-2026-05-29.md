---
artefact: doc-understanding-harvest
generated_at: "2026-05-29T00:00:00Z"
generated_at_commit: ede5d277
source: doc-understanding layer (102 per-page sidecars, doc_claim_vs_code blocks; doc-analyser/0.1.0)
doc_head_analysed_commit: 30795b4
pages_scanned: 102
dcvc_entries_total: 298
total_candidates: 170
by_severity: { HIGH: 63, MEDIUM: 70, LOW: 37 }
by_category: { drift: 166, coverage-gap: 2, broken-url: 1, missing-page: 1 }
dedup: { new_or_distinct: 99, strengthens_existing_docgap: 71 }
substrate_refinement_signals: 19
mechanical_live_url_signals: 9
aligned_confirmed_dropped: 100
existing_registry: lineage/odd-platform/doc-gaps/ (318 detail shards; index entries through DOC-GAP-318)
prompt_version: "doc-gap-finder/0.1.0 (scoped: doc-understanding harvest)"
maintainer_curated: false
---

# Doc-understanding harvest — odd-platform — 2026-05-29

Scoped reduction over the **doc-side drift harvest** produced by the ground-truth-lineage enrichment (`adrs/drafts/ground-truth-lineage.md`). Input: 102 per-page `doc-understanding/*.md` sidecars, each carrying a `doc_claim_vs_code:` block of CODE-CITED, doc-side drift findings the doc-analyser confirmed against odd-platform source this session (doc HEAD `30795b4`; substrate `ede5d277`). Every page's live URL was WebFetched by the doc-analyser on **2026-05-29** (recorded as `live_url_verified_status` in each sidecar frontmatter — all 102 returned 200, within the freshness window); this reducer re-fetched **1** page (LDAP) to anchor the highest-impact NEW finding cluster. No code or doc pages were modified.

This is a **maintainer triage list**, not a sharded registry write. Each entry carries a provisional `HARVEST-NNN` id; the maintainer assigns final DOC-NNN (or folds it into the cross-referenced existing DOC-GAP-NNN).

## Summary

- **170 drift candidates** harvested from 298 `doc_claim_vs_code` entries across 102 pages: **63 HIGH, 70 MEDIUM, 37 LOW**.
  - By category: drift 166, coverage-gap 2, broken-url 1, missing-page 1.
- **Dedup against the existing DocGap registry** (semantic graph-search, `--label DocGap`, run per HIGH/MEDIUM candidate): **71 STRENGTHEN an existing DOC-GAP-NNN** (cross-referenced, NOT re-filed) and **99 are net-new or a distinct angle** worth a fresh DOC-NNN.
  - HIGH: 22 new / 41 strengthen · MEDIUM: 41 new / 29 strengthen · LOW: 36 new / 1 strengthen.
- **100 entries were ALIGNED / CONFIRMED-ACCURATE / "no drift"** and dropped (the doc-analyser verified the page matches code — these are provenance anchors, not gaps).
- **19 substrate-refinement signals** (un-enriched code, stale concepts.yaml v8, F-172/F-075 stale claims) routed to the `/enrich` appendix below — NOT DOC-NNN.
- **9 mechanical live_url slug-rewrite signals** (GitBook flattens `integrations/<subfolder>/` and doubles `use-cases/`; mechanical doc-nodes.jsonl guesses 404) — these are doc-nodes regeneration tasks, not content gaps; collected separately.

### Headline pattern classes (what the harvest keeps re-surfacing)

1. **Default-unauthenticated ingestion, restated per surface.** `auth.ingestion.filter.enabled` defaults `false`, so `POST /ingestion/entities` and `POST /ingestion/entities/datasets/stats` accept any caller on the HTTP port. Every push-adapter page (airflow / dbt / spark / GE / cli), the profiler page, the DQ use-case pages, and `integrations/README` imply the collector token authenticates the push when on the default posture it does not. (Strengthens DOC-GAP-038 / 178 / 239.)
2. **Lineage REPLACE-not-merge silent edge deletion.** Every push-adapter that emits lineage (airflow / dbt / spark) frames it as additive; the platform's `replaceLineagePaths` deletes prior edges absent from the new payload — silent lineage loss on partial re-emit. (Strengthens DOC-GAP-114.)
3. **Collector token rotation has no grace window + plaintext at rest.** Restated on the deployment, EKS, build-and-run, odd-cli, main-concepts, and collector pages. (Strengthens DOC-GAP-189.)
4. **`/actuator/env` leaks credentials by default over the demo/quick-launch HTTP-only posture.** Deployment + EKS + LDAP-password surfaces. (Strengthens DOC-GAP-223.)
5. **LDAP/admin-group "case-insensitive SUBSTRING" claim is LIVE-VERBATIM-WRONG.** The live LDAP page (re-fetched 2026-05-29) literally says `ops` promotes `devops/noops/appops/dataops`; the code is full-string `equalsIgnoreCase`. The same false belief is restated on admin-promotion for GitHub. (Strengthens DOC-GAP-051; the substring claim is also entrenched in ADR-CANDIDATE-038 / REFACTOR-119 — reconcile together.)
6. **Lineage-depth `unset → NPE → HTTP 500`, not "undefined default".** api-reference/lineage, data-objects, microservices, and the de-deprecation use-case all soften (or inherit) a hard crash. (Strengthens DOC-GAP-105 / 131.)
7. **Activity-Feed audit blind spots restated per feature.** business-name vs field-rename event mislabel, description content-diff IS captured (page says it isn't), second TERM_ASSIGNMENT event on description edits, DEG owner-propagation per-child silence, namespace audit second-root, unaudited stats write.
8. **Net-new HIGH operator traps not previously in the registry** include: the wrong-endpoint-and-payload for custom DQ test push (HARVEST), the Architecture-page wrong attachment-path string, the entity-description content-diff inversion, the statuses-page SQL enum-id transposition, the lookup-tables cross-table column-jump + ungated reads, the reference-data per-table-RBAC overclaim, the relationships catalog-visibility asymmetry, the ingestion-filters HOMONYM collision, and the multilingual gear-icon / contribute-locale UI drift.

## HIGH severity

- **HARVEST-001** — Architecture page states LOCAL attachment default ./attachments/ but shipped default is /tmp/odd/attachments (LSN-001 ephemeral path) — wrong string understates the data-loss hazard
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/Architecture.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/introduction/architecture` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-214** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-002** — Features boot-immutable caveat silent on FeatureResolverImpl bare-SpEL boot-failure: ${datacollaboration.enabled}/${notifications.enabled} have no :false default — omitting key bricks startup (REFACTOR-625)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/Features.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/features` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-284** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-003** — Hub Alerting bullet claims Alerts shows 'open and resolved' across All/My/Dependents; All-tab SQL filters STATUS=OPEN only — resolved never appear (Category B)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-312** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-004** — Hub points to activity-feed sub-page claiming odd.activity.partition-period controls 'retention and partitioning'; controls partition WIDTH only, no DROP/retention path — monotonic growth (LSN-001)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-041** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-005** — Activity-feed Configuration section claims odd.activity.partition-period controls 'retention and partitioning'; controls partition WIDTH only — no retention/DROP path, monotonic growth (LSN-001)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__activity-feed.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-041** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-006** — Alerting page All-tab described as 'open and resolved' (L60, L191) but listAllWithStatusOpen filters STATUS=OPEN only — resolved never surface on any global tab (Category B, code-confirmed)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__alerting.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-312** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-007** — Data-collaboration page omits that NONE of the four DC endpoints carry an RBAC gate and under auth.type=DISABLED all four are anonymously reachable; framing implies the flag is the gate (LSN-001 class)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__data-collaboration.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-032** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-008** — Notifications poison-message caveat attributes WAL-replay loop to dispatch call; the dispatch HAS try/catch — the real uncaught failure is the TRANSLATION step (AlertNotificationMessageTranslator) before fan-out; loop is real+HIGH but wrong stage
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__notifications.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-143** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-009** — Notifications SMTP protocol is case-sensitive lowercase 'smtp' (.equals); Gmail example writes 'SMTP' uppercase — copy verbatim hits ELSE branch, STARTTLS+AUTH never engage, no boot warning
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__notifications.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-220** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-010** — Notifications downstream-entities-depth has NO @Value default (NotificationConfiguration.java:123); page says default 1 but that lives only in shipped application.yml — omitting key in override = startup failure
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__notifications.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-226** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-011** — Deployment page frames Collector token regeneration as benign recovery; it's an in-place UPDATE with NO grace period — running Collector 401s immediately, ingestion stops until redeploy
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__deployment.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/deployment` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-189** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-012** — Deployment HTTP-only caveat stops at transport; omits /actuator/env exposed by default leaking JDBC URL (host/port/db) + Slack/webhook URLs verbatim under quick-launch auth posture
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__deployment.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/deployment` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-223** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-013** — enable-security Statistics-endpoint danger hint documents cross-dataset write but omits that the write is UNAUDITED (updateStatistics no @ActivityLog unlike audited siblings) — forensic invisibility (LSN-001)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__README.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-025** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-014** — auth README enumerates 4 mechanisms as flat menu but omits DISABLED is the application.yml-shipped DEFAULT — operator doesn't learn out-of-box posture is permit-all no-auth (LSN-001/002 default-with-consequence)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authentication__README.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-045** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-015** — ldap page silent on ldap:// vs ldaps://; code accepts any scheme verbatim — page's own example ldap://localhost:389 sends bind password + every login credential in cleartext, no boot warning (LSN-002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authentication__ldap.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-051** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-016** — ldap page documents auth.ldap.password with no exposure caveat; bound as plain String, /actuator/env exposed by default + whitelisted — resolved bind password reachable by any caller on the HTTP port
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authentication__ldap.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-223** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-017** — policies page Title-caveat mitigation recommends condition operator 'in' which is NOT valid (schema allows all|any|eq|...; additionalProperties:false); page's own operator list omits 'in' — and validation failure surfaces as HTTP 500. Operator authors a policy the platform rejects
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authorization__policies.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-123** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-018** — roles page claims Owner-role override is UNCONDITIONAL ('binds to Owner -> loses ADMIN'); code makes it CONDITIONAL on non-empty owner role set — user bound to a zero-role Owner RETAINS auth-chain ADMIN via fallback
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authorization__roles.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-181** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-019** — roles page omits that precedence/permission resolution is silently bypassed under auth.type=DISABLED — synthesised anonymous-admin maps to Administrator, every callsite runs full ADMIN regardless of Owner-role binding
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authorization__roles.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-082** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-020** — odd-platform config page presents attachment.max-file-size as 'max per uploaded file' (server guard); code reads it ONLY into UI client-side filter — no server-side re-validation; non-UI caller exceeds it up to codec ceiling
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__odd-platform.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-005** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-021** — EKS quick-launch deploys with no mention of auth.type; shipped default DISABLED ships a fully unauthenticated UI/API on a public LoadBalancer (only mitigated by source-ranges) — only security caveat is HTTP-vs-HTTPS
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__quick_launch_on_amazon_elastic_kubernetes_service.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-037** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-022** — EKS page sets DB password via helm --set, never warns it's reachable post-deploy via /actuator/env exposed by default (compound credential-reachability, LSN-001/002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__quick_launch_on_amazon_elastic_kubernetes_service.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-223** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-023** — business-names page claims BOTH entity AND field renames recorded as BUSINESS_NAME_UPDATED; FALSE for field side — field rename emits DATASET_FIELD_INTERNAL_NAME_UPDATED. Filtering Activity Feed by BUSINESS_NAME_UPDATED silently misses every column rename
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__business-names.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/business-names` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-024** — catalog-overview Popular column 'most-viewed' omits that ranking is view_count DESC ALONE and the loop is self-reinforcing/trivially inflatable: detail-read UPDATEs view_count with no rate-limit/auth/idempotency (F-001 loop, anonymous under DISABLED)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__catalog-overview.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-101** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-025** — entity-description claims before/after description text NOT in DESCRIPTION_UPDATED payload, steering to data_entity_history; code captures FULL old AND new description in the event — the feed IS a content diff, contradicting the page
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__entity-description.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/entity-description` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-026** — entity-detail-page lists view count as neutral identity field; omits opening detail registers +2 not +1 (double fetch via useEffect dep on status, LSN-017) — self-inflating counter
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__entity-detail-page.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-246** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-027** — entity-detail-page presents view_count as display metadata, no caveat it's the SOLE trivially-inflatable ranking signal for Popular strip (no rate-limit/idempotency/auth; scripted loop anonymous under DISABLED)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__entity-detail-page.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-101** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-028** — statuses page SQL legend transposes enum ids: states 2=STABLE 3=DEPRECATED 4=DRAFT; code is DRAFT(2) STABLE(3) DEPRECATED(4). Operator adapting legend to target STABLE/DRAFT/DEPRECATED hits wrong rows
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__statuses.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/statuses` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-294** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-029** — business-glossary says direct term-to-term Add term is 'gated by TERM_UPDATE'; code: term-to-term link/unlink endpoints have NO SecurityRule, fall through to authenticated() — any authenticated user can link/unlink regardless of TERM_UPDATE (LSN-002 RBAC bypass)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-glossary__business-glossary.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-203** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-030** — data-objects says unset lineage_depth is 'undefined behaviour, treat as required'; code: primitive int, missing autoboxes null → NPE → HTTP 500. Page softens a hard crash; api-reference 'unset returns default depth' is unimplementable
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__data-objects.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/data-objects` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-105** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-031** — data-objects never mentions authorization on any lineage endpoint; all three (downstream/upstream/DEG) have no SECURITY_RULES, fall through to authenticated(), no owner check — any authenticated user reads full cross-owner subgraph; DEG path wider
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__data-objects.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/data-objects` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-159** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-032** — microservices page does NOT carry a DISABLED-mode caveat; warning frames exposure as 'authenticated catalog user' but under DISABLED the cross-owner microservice-topology read is reachable by any unauthenticated probe (HIGH — service-call data more sensitive)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__microservices.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/microservices` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-159** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-033** — data-quality hub says Dataset Quality Statuses use /api/datasets/{id}/sla for BI-report import; /sla returns image/png (hardcoded sla_red/yellow/green.png), the JSON is the sibling /sla_report — BI client gets a PNG and fails to parse
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-198** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-034** — dashboard lists 'Title' filter with no caveat; SQL binds Title to OWNERSHIP.TITLE_ID (the ownership role/title e.g. 'Data Steward'), NOT dataset name — wrong and wider slice; Owner+Title AND-compose into one join (LSN-020)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__dashboard.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-264** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-035** — dashboard page never states authorization posture; route mounted with NO client-side permission guard (unlike /lookup-tables WithPermissionsProvider) — any authenticated user (anonymous under DISABLED) opens catalog-wide aggregate health (F-032 ungated route)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__dashboard.md` `doc_claim_vs_code[4]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[4]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-263** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-036** — test-results-import says push custom test results through POST /ingestion/entities/datasets/stats mapping onto DataEntityList w/ DataQualityTest; that endpoint accepts DatasetStatisticsList (per-column stats), NOT DataEntityList — wrong endpoint AND payload, results never land (NPE/no-op)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__test-results-import.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/test-results-import` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-239** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-037** — test-results-import conflates two ingestion contracts: profiler genuinely uses /datasets/stats (DatasetStatisticsList), but framework test-results (GE/dbt) push DataEntityList to /ingestion/entities — page presents /datasets/stats as the single route for both
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__test-results-import.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/test-results-import` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-239** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-038** — api-reference/alerts calls global listings 'every alert across the platform' with no open-only qualifier; all three backend queries hard-filter STATUS=OPEN — RESOLVED never returned (same Category-B drift as feature page)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__alerts.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-312** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-039** — api-reference/data-collaboration documents POST /api/slack/events in detail but OMITS that the webhook performs NO Slack request-signature verification (HMAC X-Slack-Signature) — Events-API contract mandates it (LSN-002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__data-collaboration.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-290** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-040** — api-reference/data-collaboration lists 4 endpoints' gating but OMITS none carry an RBAC gate (zero SECURITY_RULES for /datacollaboration, /messages, /slack/events) and under DISABLED all four anonymously reachable
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__data-collaboration.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-032** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-041** — api-reference/glossary documents POST/PUT /api/terms as plain term writes; both invoke namespaceService.getOrCreate — caller with only TERM_CREATE/TERM_UPDATE creates a platform-wide namespace WITHOUT NAMESPACE_CREATE (RBAC side-door)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__glossary.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/glossary` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-208** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-042** — api-reference/glossary presents addDataEntityTerm gated by DATA_ENTITY_ADD_TERM at PLURAL /terms; permission registered at SINGULAR /term — path-matcher never matches, gate never fires (the /term vs /terms family)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__glossary.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/glossary` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-001** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-043** — api-reference/lineage says unset lineage_depth 'undefined today'; code makes it OPERATOR-CRITICAL — boxed Integer to primitive int → NPE → HTTP 500; OpenAPI declares required:false so spec-compliant caller gets 500
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__lineage.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-105** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-044** — api-reference/lineage omits that none of the three endpoints carry an RBAC gate and all anonymously reachable under DISABLED; group endpoint strictly wider (cross-owner co-membership)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__lineage.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-159** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-045** — api-reference/reference-data opening claims 'All endpoints require auth and respect per-table RBAC'; reads have NO per-table RBAC — 9 LOOKUP_TABLE_* rules cover only mutating endpoints, no _READ permission, 6 read + 4 search fall through to authenticated()
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__reference-data.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/reference-data` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-076** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-046** — api-reference/reference-data implies per-table/per-owner scoping; code uses NO_CONTEXT resolver for all 9 LOOKUP_TABLE_* rules — LOOKUP_TABLE_UPDATE permits modifying ANY table, not per-owner-scoped
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__reference-data.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/reference-data` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-076** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-047** — api-reference/reference-data documents PATCH .../columns/{column_id} as scoped to {lookup_table_id}; code drops the path param (updateLookupTableField(columnId,item) only) — caller authorized on table A PATCHes a column in table B by spoofing the URL
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__reference-data.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/reference-data` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-314** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-048** — api-reference/reference-data silent on column PATCH/DELETE security-rule path mismatch: spec serves .../columns/{id} (plural) but SecurityConstants registers .../column/{id} (singular) — gates don't fire, fall through to authenticated()
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__reference-data.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/reference-data` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-049** — api-reference/relationships presents GET /erd/{relationship_id} + /graph/{relationship_id} with no caveat that the param is NOT the relationships PK — code translates to data_entity.id; supplying actual relationships.id → 404 (Category-F silent translate, LSN-002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__relationships.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-286** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-050** — api-reference/relationships presents GET /api/relationships as a plain list with NO caveat it applies NONE of the catalog-visibility predicates /dataentities applies — relationships whose entity is exclude_from_search/HOLLOW/soft-DELETED/cross-tenant ARE returned
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__relationships.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-051** — build-and-run-odd-collectors tells operator to copy collector token but never warns regenerating it is an in-place UPDATE with NO grace window — in-flight ingestion 401s immediately, collector must be reconfigured+restarted (LSN-002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__build-and-run__build-and-run-odd-collectors.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/build-and-run/build-and-run-odd-collectors` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-189** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-052** — custom-collectors claims skeleton 'sends an empty DataEntityList every 10 minutes and starts cleanly'; platform REJECTS empty payload (isNotEmpty → BadUserRequestException 'Ingestion payload is empty' → 400) — reader sees a 400 per cycle
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__build-and-run__custom-collectors.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-053** — integrations README cross-links the ingestion security posture but does NOT state the LSN-001/002 severity: under auth.ingestion.filter.enabled=false default, /ingestion/** whitelisted — ANY caller registers/ingests into ANY datasource by writing its ODDRN
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__README.md` `doc_claim_vs_code[7]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[7]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-038** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-054** — collector-profiler omits security caveat: POST /ingestion/entities/datasets/stats has NO auth gate and NO parent-child validation — any caller knowing a field ODDRN overwrites that field's dataset_field.stats JSONB (LSN-002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__collectors__odd-collector-profiler.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-collector-profiler` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-239** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-055** — ingestion-filters HOMONYM/naming-collision: odd-platform owns a Concept 'Ingestion Filter' that is a token-AUTH WebFilter (IngestionDataEntitiesFilter); this page's 'ingestion filters' are collector-side REGEX content filters — share the phrase, nothing else; disambiguation needed
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__ingestion-filters.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/ingestion-filters` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-056** — odd-airflow-2 presents lineage as additive; platform endpoint is REPLACE-not-merge — a tick omitting a prior edge SILENTLY DELETES it (replaceLineagePaths). Silent lineage loss on partial re-emit (LSN-001/002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-airflow-2.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-airflow-2` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-114** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-057** — odd-cli tells operator to create/use ODD_PLATFORM_TOKEN but omits the platform token contract: stored PLAINTEXT in TOKEN table + returned PLAINTEXT in body, rotation in-place no grace (401s instant), not audit-logged — cross-link needed (LSN-002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-cli.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-cli` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-189** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-058** — odd-dbt presents dbt lineage as additive; platform is REPLACE-not-merge — re-ingesting after a manifest.json removed upstream refs SILENTLY DELETES previously-recorded edges for that establisher (LSN-001/002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-dbt.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-dbt` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-114** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-059** — odd-spark-adapter presents Spark lineage as additive; platform REPLACE-not-merge — re-run with changed plan (dropped source/join) SILENTLY DELETES prior edges for that establisher; especially acute since per-job re-emission is normal (LSN-001/002)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-spark-adapter.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-spark-adapter` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-114** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-060** — lookup-tables RBAC frames surface as '9 permissions on three surfaces' but there's NO LOOKUP_TABLE_*_READ — READ ungated end-to-end (6 of 14 endpoints no SecurityRule); operator assumes read is gated, it's not (anonymous under DISABLED)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/master-data-management__lookup-tables.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-301** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-061** — lookup-tables silent on cross-table column-jump: updateLookupTableField discards {lookup_table_id} (passes only columnId) — with global LOOKUP_TABLE_DEFINITION_UPDATE a user PATCHes a column in a different table by spoofing the URL
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/master-data-management__lookup-tables.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-314** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-062** — multilingual-ui 'missing translations fall through to English' framed as 'small number of strings' affecting non-English users; code: 14+ keys absent from ALL six locales incl. all 3 top-level nav tabs (Data Quality/Data Modelling/Master Data) rendered as the English key — ALSO hits English users
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/multilingual-ui.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/multilingual-ui` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-309** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-063** — de-deprecation pivotal decision depends on downstream lineage for an old/legacy object but gives no caveat for HIGH-severity lineage defects: null-depth NPE, no depth cap, no owner-scoping (cross-owner edges enumerable)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__de-deprecation.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/de-deprecation` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-105** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

## MEDIUM severity

- **HARVEST-064** — Features page lists genai.enabled as a boot-immutable @Value feature flag; code re-reads genAIProperties.isEnabled() per call, not boot-snapshotted, not a Feature enum value
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/Features.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/features` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-284** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-065** — GitBook IA: bare /active-platform-features/notifications and /data-collaboration slugs 404; canonical live paths are under /features/
  - **Category**: broken-url
  - **Surfaced by**: `doc-understanding/active-platform-features.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-056** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-066** — Activity-feed page omits: emit-failure rolls back the user's business mutation (whole snapshot-diff-emit runs inside ActivityAspect @ReactiveTransactional) — transient activity-write failure reverts the originating mutation, 500 with no indication
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__activity-feed.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-257** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-067** — Activity-feed page omits Owner-propagation cascade audit asymmetry: DEG owner-propagation emits ONE parent OWNERSHIP event and zero per-child events (propagateOwnership writes N child rows with no event)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__activity-feed.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-150** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-068** — Metrics page frames over-cap body as 'rejected before controller'; code throws DataBufferLimitException → HTTP 500 (not 413); the 20MB budget also bounds outbound Prometheus remote-write
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__metrics-ingestion.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/metrics-ingestion` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-069** — Metrics page omits empty MetricSetList returns 201 (no-op) — asymmetric with /ingestion/entities which 400s; liveness ping can't tell real write from no-op on unauthenticated surface
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__metrics-ingestion.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/metrics-ingestion` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-070** — Metrics page omits NO validation that MetricSet.oddrn belongs to a registered entity — caller mints arbitrary metric_entity rows / Prometheus series (cardinality DoS)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__metrics-ingestion.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/metrics-ingestion` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-071** — Notifications page omits Slack-channel rate-limit data-loss: on 429 the sender reads neither status class nor Retry-After (only != 200) — alert burst silently drops most Slack messages
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__notifications.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-054** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-072** — Notifications page omits AlertManager webhook inbound idempotency gap: handleExternalAlerts bypasses AlertActionResolver, createAlerts no ON CONFLICT — two POSTs = two duplicate OPEN alerts (distinct from outbound delivery caveat)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/active-platform-features__notifications.md` `doc_claim_vs_code[5]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[5]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-107** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-073** — admin-promotion claims LDAP admin-groups is case-insensitive SUBSTRING; code is full-string equalsIgnoreCase — overstates collision; [ops] matches only literal ops not devops/team-ops
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__admin-promotion.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/admin-promotion` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-051** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-074** — admin-promotion claims GitHub admin-groups (team-slug) is case-insensitive SUBSTRING; code is full-string equalsIgnoreCase — [admins] matches only literal admins not team-admins
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__admin-promotion.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/admin-promotion` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-051** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-075** — admin-promotion claims Custom OIDC has NO admin-detection; code DOES run admin-detection (CustomOIDCUserHandler extends AbstractOIDCUserHandler) — admin-principals promotes at login without manual binding
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__admin-promotion.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/admin-promotion` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-076** — auth README frames S2S as 'complements any of the above'; understates blast radius — single X-API-Key forces synthetic ADMIN-everywhere across all /** paths, cross-mode ADMIN collision
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authentication__README.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-141** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-077** — ldap page (CRITICAL) claims admin-group matching is case-insensitive substring (ops promotes devops/noops/dataops); code is full-string equalsIgnoreCase — entire overpromotion table + mitigation describe behaviour code lacks
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authentication__ldap.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-051** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-078** — ldap page claims auth.ldap.active-directory.domain required when AD enabled; code does NOT enforce — no @NotNull, no cross-field check; enabled:true with no domain boots with silently-degraded AD bind
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authentication__ldap.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-051** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-079** — login-form open-redirect on auth.login-form-redirect CONFIRMED accurate (not page drift); substrate gap — login-form-redirect open-redirect instance has no dedicated invariant node (substrate signal)
  - **Category**: missing-page
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authentication__login-form.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-224** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-080** — authorization README carries the DIRECT_OWNER_SYNC self-mint-then-self-bind caveat but the leaf user-owner-association.md page omits it (F-075 Branch B undocumented on leaf) — cross-page consistency gap
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authorization__README.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-075** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-081** — owners page caveat #3 writes ownership side-door endpoints as PLURAL /ownerships; canonical spec is SINGULAR /ownership (createOwnership / createTermOwnership) — copy-paste-fatal 404 for the deployment-script audience
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authorization__owners.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-082** — user-owner-association 'Known incompleteness' hint OVERSELLS a gap: claims direct-bind/remove use a different controller + may not surface on History; code contradicts — same controller, both write audit rows (REQUEST_MANUALLY_APPROVED/DECLINED), History reads same table (substrate F-172/F-075 carry same stale claim)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authorization__user-owner-association.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-083** — user-owner-association page treats Provider as meaningful per-binding discriminator but never warns provider-null modes (LOGIN_FORM+LDAP) share an identity namespace — a mapping under one is honoured under the other (PLT-065 cross-mode bleed)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__enable-security__authorization__user-owner-association.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-219** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-084** — EKS page omits Collector token rotation contract: in-place UPDATE, no overlap window — running collector must pick up new token (config + restart) or ingestion breaks
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__quick_launch_on_amazon_elastic_kubernetes_service.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-189** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-085** — trylocally Step 2 implies the Collector token gates ingestion; demo ships ingestion UNAUTHENTICATED (auth.ingestion.filter.enabled default false) — pasted token is decorative, any caller can POST (page-scoped to demo)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/configuration-and-deployment__trylocally.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/trylocally` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-038** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-086** — custom-metadata omits no-type-validation: value written verbatim regardless of declared type (STRING '42' on INTEGER field accepted) — UI editor enforces shape but API does not; SDK writers persist type-violating values
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__custom-metadata.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/custom-metadata` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-087** — custom-metadata omits EXTERNAL-origin values writable via per-entity PUT/POST (upsert doesn't check getOrigin) — operator with _UPDATE overwrites collector-ingested value until next ingestion; page says UI can't but API doesn't gate origin
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__custom-metadata.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/custom-metadata` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-088** — entity-description omits a description edit emits a SECOND event TERM_ASSIGNMENT_UPDATED when body has [[ns:term]] mentions (term-linking runs unconditionally); Activity-trail section names only DESCRIPTION_UPDATED
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__entity-description.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/entity-description` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-089** — vector-stores claims a distinct Vector-Store icon; badge is class-driven (DATA_SET), VECTOR_STORE is a TYPE under DATA_SET — same DATA_SET badge as a table; distinction is the type label + Type facet, not an icon
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-discovery__vector-stores.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-discovery/vector-stores` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-090** — business-glossary doesn't warn term-link RBAC bypass also exists at SERVICE tier independent of the controller path-rename fix — service consumers carry ZERO permission checks, so a SecurityRule-path fix alone doesn't close the bypass
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-glossary__business-glossary.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-203** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-091** — data-objects frames 404-on-empty-DEG as single condition; code raises same NotFoundException for THREE conditions (id missing / zero members / id is a non-DEG entity) — operators can't discriminate the 404
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__data-objects.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/data-objects` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-163** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-092** — data-objects group-lineage omits two carve-outs: inner DEGs silently suppressed (// Remove this when we will support inner DEGs) + edge filter requires BOTH endpoints in member set (external upstream/downstream dropped)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__data-objects.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/data-objects` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-165** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-093** — data-objects lineage depth: correctly says no @Max but omits the recursive CTE has NO cycle guard + full graph .collectList()-materialised in heap — memory+CPU amplification on branchy/diamond graphs
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__data-objects.md` `doc_claim_vs_code[4]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/data-objects` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[4]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-105** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-094** — microservices page claims OTel fields (operation_name/span_kind/error_rate/p95/callsPerMinute) 'silently dropped at the DTO mapper' — CONFIRMED by code (class-agnostic DataEntityLineage shape, no class param)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__microservices.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/microservices` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-095** — microservices 'Where to next' inherits the unimplemented documented default (lineage_depth unset → NPE → 500) via the shared-surface claim
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-lineage__microservices.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-lineage/microservices` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-131** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-096** — data-quality hub describes Quality Dashboard as 'six anomaly-class metrics'; the 6 is the per-run-status tile count (DataEntityRunStatus), NOT anomaly classes (5 named + Unknown, dynamic) — number attached to wrong dimension
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-297** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-097** — dashboard lists Test Results Breakdown as passed/failed/skipped (3); code renders a tile for all six DataEntityRunStatus (SUCCESS/FAILED/SKIPPED/BROKEN/ABORTED/UNKNOWN) — three undocumented states
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__dashboard.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-294** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-098** — dashboard labels Table Health slices 'success/failed/broken'; code renders Healthy/Warning/Error (tablesHealth DTO has no failed/broken field) — vocabulary mismatch, operator won't find 'broken tables'
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__dashboard.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-266** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-099** — dashboard 'Namespace' filter silent on widening: SQL matches entity's own namespace OR its datasource's namespace — counts wider than 'entities in namespace X' implies, unexplained inflation
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__dashboard.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-272** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-100** — sla-statuses caveat block mis-cites 2 of 4 read-endpoint paths: /dataentities/{id}/datasetstests and /datasets/{id}/test_reports; canonical are /datasets/{id}/dataqatests and /datasets/{id}/test_report — copy from the caveat = 404
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__sla-statuses.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/sla-statuses` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-198** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-101** — test-results-import omits security caveat on the endpoint it tells operators to call: POST /ingestion/entities/datasets/stats is unauthenticated under every auth.type (WHITELIST_PATHS /ingestion/**, filter binds exact-literal /ingestion/entities only)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/data-quality__test-results-import.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/data-quality/test-results-import` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-239** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-102** — api-reference hub enumerates PermissionResourceType as DATA_ENTITY/NAMESPACE/TERM/MANAGEMENT; actual enum is DATA_ENTITY/TERM/QUERY_EXAMPLE/MANAGEMENT — no NAMESPACE, omits QUERY_EXAMPLE; SDK author builds switch over non-existent arm
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-077** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-103** — api-reference hub lists 10 feature sub-pages; OpenAPI has 34 operation tags — many (dataSet, dataSource, activity, collector, namespace, owner, policy, role, search, tag...) have ZERO sub-page; page doesn't say so for dataSet/dataSource families
  - **Category**: coverage-gap
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-244** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-104** — api-reference/glossary says PUT /api/terms/{id}/tags creates missing tags but doesn't warn it bypasses TAG_CREATE — caller with only TERM_TAGS_UPDATE mints platform-wide tags (getOrCreateTagsByName)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__glossary.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/glossary` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-098** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-105** — api-reference/integrations documents endpoints with NO status codes; GET /api/integrations/{id} returns 204 (not 404) on unknown id (Mono.empty → WebFlux 204); OpenAPI declares only 200 — uncontracted response
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__integrations.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-278** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-106** — api-reference/integrations silent on authorization; both endpoints no INTEGRATION_* permission, fall through to authenticated() (LOGIN_FORM/OAUTH2/LDAP) and permitAll under DISABLED; under DISABLED+internal base-url the hostname leaks via rendered snippet
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__integrations.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-279** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-107** — api-reference/integrations frames installed flag as benign placeholder; it's a structurally-dead REQUIRED field hardcoded @Mapping(constant=false) on both mappers — UI 'Integrated' badge NEVER renders; consumer builds tooling on a never-meaningful value
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__integrations.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-277** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-108** — api-reference/integrations doesn't warn the wizard registry is EMPTY on a default checkout (zero META-INF/wizard/*.yaml; manifests arrive only via external overlays) — GET /api/integrations on stock build returns {items:[]}
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__integrations.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-281** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-109** — api-reference/integrations documents platform_url staticValue 'resolved server-side' without the default; when odd.platform-base-url unset, value is placeholder http://your.odd.platform — operators point collector at non-existent host
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__integrations.md` `doc_claim_vs_code[4]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[4]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-279** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-110** — api-reference/lineage group-lineage description omits inner-DEG suppression carve-out (edges touching nested DEG silently dropped, '// Remove this when we will support inner DEGs')
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__lineage.md` `doc_claim_vs_code[4]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[4]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-124** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-111** — api-reference/lineage documents only the three non-/my endpoints; doesn't document /my/upstream + /my/downstream where DOC-GAP-099 lives (inverse semantic) — natural home for the /my variants
  - **Category**: coverage-gap
  - **Surfaced by**: `doc-understanding/developer-guides__api-reference__lineage.md` `doc_claim_vs_code[5]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[5]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-099** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-112** — build-and-run-odd-platform instructs APP_PATH=./docker/injector python docker/injector/inject.py; injector ships at repo-root injector/inject.py — documented command fails file-not-found (demo.yaml mounts ../injector:/injector)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__build-and-run__build-and-run-odd-platform.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/build-and-run/build-and-run-odd-platform` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

- **HARVEST-113** — custom-collectors frames datasource registration as auto-on-startup + 'starts cleanly' but never states POST /ingestion/datasources requires the token to resolve a Collector session — IllegalStateException('Collector id is null') → 5xx on wrong token / non-sticky cluster
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__build-and-run__custom-collectors.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-179** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-114** — custom-collectors troubleshooting lists PlatformApiError generically; distinct CLIENT errors on /ingestion/entities all surface as opaque 5xx (duplicate ODDRN, unknown data_source_oddrn, oversized) — author can't tell 'malformed data' from 'platform crashed'
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/developer-guides__build-and-run__custom-collectors.md` `doc_claim_vs_code[3]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[3]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-120** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-115** — ingestion-filters: platform substrate flags operators conflate the regex filter with the auth filter (main-concepts Terms&Aliases 'Ingestion authentication filter'); page claims bare 'Ingestion filters' with no disambiguation pointer — reader debugging unauthenticated /ingestion lands on wrong page
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__ingestion-filters.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/ingestion-filters` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-038** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-116** — odd-airflow-2 directs token to Airflow Connection Password (collector-token Bearer path via IngestionDataEntitiesFilter, default OFF); page states no platform prerequisite — on default deployment ingestion accepts any caller, token not validated
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-airflow-2.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-airflow-2` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-038** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-117** — odd-dbt implies token authenticates every push; asymmetric — create-datasource filter always-on, but ingest-test/ingest-lineage ride /ingestion/entities whose filter defaults OFF; on default platform those pushes UNAUTHENTICATED regardless of token
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-dbt.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-dbt` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-178** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-118** — odd-great-expectations implies push is authenticated via platform_token; receiving /ingestion/entities gated ONLY by IngestionDataEntitiesFilter (default OFF) — bundled deployment ingests GE results unauthenticated, wrong/blank token silently accepted
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-great-expectations.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-great-expectations` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-038** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-119** — odd-spark-adapter (softer than siblings — links security page) but doesn't surface the filter on /ingestion/entities defaults OFF — on default deployment Spark push accepted UNAUTHENTICATED regardless of spark.odd.oddrn.key; 'configure platform to accept' implies a step not enforced
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/integrations__push-adapters__odd-spark-adapter.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/integrations/integrations/odd-spark-adapter` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-178** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-120** — main-concepts frames ODDRN purely as producer-side identity; omits the consumer-side unparseable case has user-visible fallout (Directory 'Other' bucket, entity_oddrn trusted verbatim as AlertManager webhook routing key)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/main-concepts.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/introduction/main-concepts` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-008** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-121** — main-concepts architecture chain describes collector auth only implicitly; never states the collector→platform leg is a 40-char plaintext shared-secret bearer compared by .equals, rotated in-place with NO overlap window
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/main-concepts.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/introduction/main-concepts` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-189** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-122** — namespaces page claims cascade-on-delete guard cleanly blocks; code shows TOCTOU race — Namespace delete not @ReactiveTransactional, existence-check+soft-delete non-atomic (READ COMMITTED, no lock); referent inserted between check+delete silently orphaned
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/management__namespaces.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/management/namespaces` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-076** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-123** — namespaces attributes audit-silence solely to data_entity_id NOT NULL; code confirms that root but the silence has a SECOND independent root — ActivityEventTypeDto has no NAMESPACE_CREATED value (no type to emit) — correct-but-incomplete
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/management__namespaces.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/management/namespaces` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-206** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-124** — MDM landing claims '9 LOOKUP_TABLE_* permissions on three surfaces'; code wires them through NO_CONTEXT resolver — LOOKUP_TABLE_UPDATE permits ANY table not per-owner; landing framing doesn't surface global scope
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/master-data-management.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/master-data-management` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-301** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-125** — multilingual-ui says locale switcher is a 'gear icon top-right of toolbar' opening 'Select language'; code: switcher is a menu item INSIDE the user-account dropdown of AppToolbar — operator looks for a gear icon code doesn't place
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/multilingual-ui.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/multilingual-ui` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-020** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-126** — multilingual-ui 'contribute a new locale' says edit i18n.ts + SelectLanguage.tsx; code: SelectLanguage needs NO edits (iterates i18n.languages), the required files are lib/constants.ts LANGUAGES_MAP + LANG_TO_COUNTRY_CODE_MAP — contributor edits wrong file, omits the two maps
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/multilingual-ui.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/features/multilingual-ui` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-020** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-127** — dc-data-compliance Solution claims platform 'provides a PII-sensitive search mechanism'; code has NO PII/sensitivity-aware search (7 facets, none a PII dimension) — PII id is manual reading of tags/metadata; a tag named 'PII' is ordinary free-text (case-sensitive)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__dc-data-compliance.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/dc-data-compliance.md` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-017** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-128** — de-deprecation narrates deprecation as a manual human/email process; never tells operator ODD HAS a native DEPRECATED status with scheduled-delete date (DataEntityStatusSwitchJob auto-flips to DELETED) — under-sells the platform's own tool
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__de-deprecation.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/de-deprecation` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-261** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-129** — de-deprecation treats 'we delete the object' as terminal/irreversible; code: DELETED is SOFT-delete with cascade + 30-day retention (itself broken by status_updated_at-never-bumped bug) — page should set soft-delete-then-retention expectation
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__de-deprecation.md` `doc_claim_vs_code[2]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/de-deprecation` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[2]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-261** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-130** — dq-visibility step 4 says push custom DQ KPIs through POST /ingestion/entities/datasets/stats with no security/scoping caveat; endpoint unauthenticated under every auth.type (WHITELIST /ingestion/**, not matched by filter) (F-095)
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__dq-visibility.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/dq-visibility` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: STRENGTHENS existing **DOC-GAP-239** (same drift — cross-reference, do NOT re-file as a new DOC-NNN).

- **HARVEST-131** — dq-visibility: same endpoint resolves writes by FIELD ODDRN from statistics.keySet() and never validates the resolved field's parent against the payload datasetOddrn — cross-dataset write surface presented as a benign self-service channel
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__dq-visibility.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/dq-visibility` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-239** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-132** — viz-preparation frames tagging+metadata as a way to 'set row-level security based on user group'; ODD Tag directory is GLOBAL cross-tenant with NO per-tag ACL and NO group binding — ODD provides no RLS/group-scoped access; RLS must be DWH/BI-side
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__viz-preparation.md` `doc_claim_vs_code[0]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/viz-preparation` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[0]` for file:line).
  - **Dedup**: NEW (net-new drift); related to **DOC-GAP-018** (adjacent angle / same surface — file as distinct DOC-NNN).

- **HARVEST-133** — viz-preparation relies on stored custom-metadata as authoritative; values carry NO type validation, EXTERNAL-origin can be silently overwritten until next ingestion, upsert silently flips active to NULL — not a guarded source of truth
  - **Category**: drift
  - **Surfaced by**: `doc-understanding/use-cases__viz-preparation.md` `doc_claim_vs_code[1]`
  - **Evidence**: live `https://docs.opendatadiscovery.org/use-cases/use-cases/viz-preparation` (WebFetched 2026-05-29 by doc-analyser, status 200); code-cited in the sidecar (see `doc_claim_vs_code[1]` for file:line).
  - **Dedup**: NEW (no existing DocGap covers this drift).

## LOW severity

- **HARVEST-134** [drift; NEW] Features chrome-invariant caveat says GenAI tab governed by feature-flag mechanism; GenAI not driven by WithFeature wrapper — stated mechanism does not apply — `doc-understanding/Features.md:doc_claim_vs_code[1]`; live `https://docs.opendatadiscovery.org/features/features` (200, 2026-05-29).
- **HARVEST-135** [drift; NEW] README claims ODD 'auto-generated ML experiment lineage' as top-line value prop; platform only renders ML entity types, auto-generation is collector-side — `doc-understanding/README.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/introduction` (200, 2026-05-29).
- **HARVEST-136** [drift; NEW] Data-collaboration page under-states channel-autocomplete: startsWith not contains, only public channels bot added to (existing DOC-GAP-290 family) — `doc-understanding/active-platform-features__data-collaboration.md:doc_claim_vs_code[3]`; live `https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration` (200, 2026-05-29).
- **HARVEST-137** [drift; NEW] GenAI page says 'no request-body size cap, unbounded'; there IS a 20MB spring.codec.max-in-memory-size ceiling — 'unbounded' overstates — `doc-understanding/active-platform-features__genai.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/features/active-platform-features/genai` (200, 2026-05-29).
- **HARVEST-138** [drift; NEW] GenAI page states request_timeout is in minutes but omits name-vs-behavior drift: it's the response/reply-wait timeout not request/send budget (correction lives on canonical config page) — `doc-understanding/active-platform-features__genai.md:doc_claim_vs_code[1]`; live `https://docs.opendatadiscovery.org/features/active-platform-features/genai` (200, 2026-05-29).
- **HARVEST-139** [drift; NEW] Notifications page omits AlertManager alerts hard-coded to DISTRIBUTION_ANOMALY (AlertServiceImpl:177) — alertname/severity labels ignored, type fixed — `doc-understanding/active-platform-features__notifications.md:doc_claim_vs_code[4]`; live `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (200, 2026-05-29).
- **HARVEST-140** [drift; NEW] admin-promotion matrix labels Cognito/Google/Azure admin-groups as 'exact match' without flagging case-insensitivity; code is full-string case-INSENSITIVE — 'exact' reads as case-sensitive — `doc-understanding/configuration-and-deployment__enable-security__admin-promotion.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/admin-promotion` (200, 2026-05-29).
- **HARVEST-141** [drift; NEW] disabled-authentication claims actuator env masking governed by show-values: WHEN_AUTHORIZED; no such key set — effective default is NEVER. Conclusion holds (URL still leaks) but cited literal wrong — `doc-understanding/configuration-and-deployment__enable-security__authentication__disabled-authentication.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication` (200, 2026-05-29).
- **HARVEST-142** [drift; NEW] ldap page documents groups.filter default (member={0}) as if platform supplies it; it comes from Spring's DefaultLdapAuthoritiesPopulator when unset — value correct, owner misattributed — `doc-understanding/configuration-and-deployment__enable-security__authentication__ldap.md:doc_claim_vs_code[4]`; live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (200, 2026-05-29).
- **HARVEST-143** [drift; NEW] s2s page curl example POSTs X-API-Key to /ingestion/entities; two independent auth paths (global S2S filter vs collector Bearer filter) not disambiguated — operator with only ingestion-filter finds X-API-Key does nothing — `doc-understanding/configuration-and-deployment__enable-security__authentication__s2s.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s` (200, 2026-05-29).
- **HARVEST-144** [drift; NEW] business-names says original technical name 'always persists below'; code renders Original footer ONLY when both internalName && externalName present — manually-created entity has no Original line — `doc-understanding/data-discovery__business-names.md:doc_claim_vs_code[1]`; live `https://docs.opendatadiscovery.org/features/data-discovery/business-names` (200, 2026-05-29).
- **HARVEST-145** [drift; NEW] business-names omits that edit affordances disappear when entity is DELETED status (!isStatusDeleted gate), no banner explains missing button — `doc-understanding/data-discovery__business-names.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/features/data-discovery/business-names` (200, 2026-05-29).
- **HARVEST-146** [drift; NEW] custom-metadata lists 7 API field types; code enum has 8 (UNKNOWN omitted) — 'accepts seven types' literally inexact (UNKNOWN is defensive fallback) — `doc-understanding/data-discovery__custom-metadata.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/features/data-discovery/custom-metadata` (200, 2026-05-29).
- **HARVEST-147** [drift; NEW] directory level-3 row labels third level 'Data Entity CLASSES' but backing getDatasourceEntityTypes returns the TYPE dimension (TABLE/FILE/STREAM...) — class-vs-type mislabel — `doc-understanding/data-discovery__directory.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/features/data-discovery/directory` (200, 2026-05-29).
- **HARVEST-148** [drift; NEW] entity-description security table frames md-editor XSS vectors as 'unmeasured'; probe P-009 EMPIRICALLY measured onerror stripped by React (mitigated, not unmeasured) — core no-write-time-sanitisation claim still correct — `doc-understanding/data-discovery__entity-description.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/features/data-discovery/entity-description` (200, 2026-05-29).
- **HARVEST-149** [drift; NEW] per-column-annotation createEnumValue bulk-replace caveat correct for all-INTERNAL; omits that EXTERNAL-present branch errors instead of silent soft-delete (under-specification) — `doc-understanding/data-discovery__per-column-annotation.md:doc_claim_vs_code[1]`; live `https://docs.opendatadiscovery.org/features/data-discovery/per-column-annotation` (200, 2026-05-29).
- **HARVEST-150** [drift; NEW] schema-diff omits that a PARENT-field rename on nested-struct dataset amplifies the diff: every descendant emitted as DELETED+CREATED (getParentOddrnChangedPojos) — large all-changed diff for one rename, no explanation — `doc-understanding/data-discovery__schema-diff.md:doc_claim_vs_code[3]`; live `https://docs.opendatadiscovery.org/features/data-discovery/schema-diff` (200, 2026-05-29).
- **HARVEST-151** [drift; NEW] search page links FTSConstants.java as 'constants used by the search engine' but the special-char-breaking operators live in JooqFTSHelper.tsQuery — link one file away from the caveat code (correct-but-incomplete) — `doc-understanding/data-discovery__search.md:doc_claim_vs_code[1]`; live `https://docs.opendatadiscovery.org/features/data-discovery/search` (200, 2026-05-29).
- **HARVEST-152** [drift; NEW] search exclude_from_search caveat says 'a shared SQL helper that does not apply the predicate'; code shows distinct per-query CTEs (listPopular cteDataEntitySelect) not one shared helper — directionally right, mechanism imprecise — `doc-understanding/data-discovery__search.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/features/data-discovery/search` (200, 2026-05-29).
- **HARVEST-153** [drift; NEW] data-lineage hub does not surface null-lineage_depth NPE + no-depth-cap DoS (belong on data-objects + api-reference/lineage) — routing note, LOW out-of-page scope — `doc-understanding/data-lineage.md:doc_claim_vs_code[4]`; live `https://docs.opendatadiscovery.org/features/data-lineage` (200, 2026-05-29).
- **HARVEST-154** [drift; NEW] data-objects documents expanded_entity_ids with no size caveat; no maxItems/@Size — large id list silently exceeds Postgres ~32K bound-parameter limit — `doc-understanding/data-lineage__data-objects.md:doc_claim_vs_code[5]`; live `https://docs.opendatadiscovery.org/features/data-lineage/data-objects` (200, 2026-05-29).
- **HARVEST-155** [drift; NEW] query-examples (data-modelling) states '16 endpoints across three groups'; concept node says true total is 17 (13 QueryExampleController + 2 DataEntity + 2 Term) — off-by-one (verify api-reference page count) — `doc-understanding/data-modelling__query-examples.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/features/data-modelling/query-examples` (200, 2026-05-29).
- **HARVEST-156** [drift; NEW] api-reference whoami lists S2S as a peer auth.type mode; auth.type accepts only DISABLED/LOGIN_FORM/OAUTH2/LDAP — S2S is a separate token mechanism layered on top; appInfo authType list is correct — `doc-understanding/developer-guides__api-reference.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/developer-guides/api-reference` (200, 2026-05-29).
- **HARVEST-157** [drift; NEW] api-reference/data-collaboration getSlackChannels omits 1-minute Caffeine cache stale window + startsWith (not contains) match — `doc-understanding/developer-guides__api-reference__data-collaboration.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` (200, 2026-05-29).
- **HARVEST-158** [drift; NEW] api-reference/directory (LSN-002 silent fallback) tells level-1 names derived from ODDRN parse but omits parse failure is swallowed → 'Other'/UNKNOWN sentinel; feature page also omits the silent 'Other' bucket — `doc-understanding/developer-guides__api-reference__directory.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/developer-guides/api-reference/directory` (200, 2026-05-29).
- **HARVEST-159** [drift; NEW] api-reference/genai describes request_timeout only as {minutes} without naming it an OUTBOUND RESPONSE timeout; request_timeout=0 → zero-timeout footgun lives only on config page — `doc-understanding/developer-guides__api-reference__genai.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/developer-guides/api-reference/genai` (200, 2026-05-29).
- **HARVEST-160** [drift; NEW] api-reference/query-examples gives operationIds for the two TERM link endpoints but NONE for the two DATASET link endpoints (whose ids carry a 'New' suffix) — asymmetric operationId coverage — `doc-understanding/developer-guides__api-reference__query-examples.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/developer-guides/api-reference/query-examples` (200, 2026-05-29).
- **HARVEST-161** [drift; NEW] api-reference/query-examples (endpoint index) surfaces no read-collaborative posture: 10 endpoints no SecurityRule (any authenticated user reads every snippet), no Activity audit — decide whether index should cross-note — `doc-understanding/developer-guides__api-reference__query-examples.md:doc_claim_vs_code[3]`; live `https://docs.opendatadiscovery.org/developer-guides/api-reference/query-examples` (200, 2026-05-29).
- **HARVEST-162** [drift; NEW] api-reference/relationships free-text query has no scope note; matches case-insensitive containment on the relationship-row external_name ONLY, not source/target entity names — `doc-understanding/developer-guides__api-reference__relationships.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships` (200, 2026-05-29).
- **HARVEST-163** [drift; NEW] custom-collectors never states success status for ingestion POSTs; impl returns 200 but ingestion contract declares 201 (spec-vs-impl drift F-096) — author coding to 201 treats 200 as anomaly — `doc-understanding/developer-guides__build-and-run__custom-collectors.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors` (200, 2026-05-29).
- **HARVEST-164** [drift; NEW] collector-profiler calls rendered stats 'the Statistics view shown on detail page'; platform renders it on the dataset Structure tab — no separate 'Statistics view' surface (UI-name terminology drift) — `doc-understanding/integrations__collectors__odd-collector-profiler.md:doc_claim_vs_code[1]`; live `https://docs.opendatadiscovery.org/integrations/integrations/odd-collector-profiler` (200, 2026-05-29).
- **HARVEST-165** [drift; STRENGTHENS DOC-GAP-189] odd-collector page introduces token field with no caveat rotation has NO grace window (regenerate rewrites in-place, .equals compare) — every running collector auth-fails the instant admin regenerates; belongs on hub/config-reference target — `doc-understanding/integrations__collectors__odd-collector.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/integrations/integrations/odd-collector` (200, 2026-05-29).
- **HARVEST-166** [drift; NEW] main-concepts AI aspects lists GenAI config narratively but omits genai.request_timeout naming hazard — baked at startup, governs RESPONSE timeout not request — `doc-understanding/main-concepts.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/introduction/main-concepts` (200, 2026-05-29).
- **HARVEST-167** [drift; NEW] management page warns plaintext token at rest but omits the generator uses ThreadLocalRandom (RandomStringUtils.randomAlphanumeric, non-CSPRNG; CSPRNG call is .secure().nextAlphanumeric) — weak-RNG provenance undocumented — `doc-understanding/management.md:doc_claim_vs_code[7]`; live `https://docs.opendatadiscovery.org/features/management` (200, 2026-05-29).
- **HARVEST-168** [drift; NEW] MDM landing claims Lookup Tables have 'Schema (9 PostgreSQL field types)'; code has 9 enum constants but 8 DISTINCT SQL types (TYPE_INTEGER+TYPE_SERIAL→INTEGER) — landing-page echo, fix at child — `doc-understanding/master-data-management.md:doc_claim_vs_code[0]`; live `https://docs.opendatadiscovery.org/features/master-data-management` (200, 2026-05-29).
- **HARVEST-169** [drift; NEW] lookup-tables supported field types lists 9 as if 9 distinct PostgreSQL types; 9 enum constants but 8 distinct SQL (SERIAL+INTEGER→integer) — minor, SERIAL row already notes auto-increment — `doc-understanding/master-data-management__lookup-tables.md:doc_claim_vs_code[2]`; live `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` (200, 2026-05-29).
- **HARVEST-170** [drift; NEW] service-presales sells Microservices as a first-class discovery surface; Microservices Lineage is doc-promised as a distinct pillar but rendered by the class-agnostic dataset-lineage canvas with NO class-aware affordances — no microservice-specific capability — `doc-understanding/use-cases__service-presales.md:doc_claim_vs_code[1]`; live `https://docs.opendatadiscovery.org/use-cases/use-cases/service-presales` (200, 2026-05-29).

## Substrate-refinement signals (for /enrich, not DOC-NNN)

These `doc_claim_vs_code` entries are NOT doc gaps — they are signals that the substrate is stale or un-enriched relative to the live docs/code. Route to `/enrich` / `/concepts`, not to DOC-NNN triage. (Per prompt step 4: F-172 / F-075 / concepts.yaml v8 staleness, un-enriched code paths, publication-lag artefacts.)

- `doc-understanding/README.md:doc_claim_vs_code[1]` — ML entity-class type system has no concept in concepts.yaml — ontology coverage gap
- `doc-understanding/active-platform-features__alerting.md:doc_claim_vs_code[1]` — coverage/un-enriched — for /enrich, not DOC-NNN
- `doc-understanding/active-platform-features__data-collaboration.md:doc_claim_vs_code[0]` — data-collaboration page live-404 in substrate now 200 (publication-lag artefact) — substrate doc-link status out of date
- `doc-understanding/configuration-and-deployment__enable-security__authentication__disabled-authentication.md:doc_claim_vs_code[1]` — all-auth-modes actuator whitelist not independently confirmed against code node — flag to pin or soften 'every auth mode' wording
- `doc-understanding/configuration-and-deployment__enable-security__authentication__oauth2-oidc.md:doc_claim_vs_code[0]` — GHES api.github.com hard-coding claim not confirmable — no GithubUserHandler CodeNode (substrate-coverage gap)
- `doc-understanding/configuration-and-deployment__enable-security__authentication__oauth2-oidc.md:doc_claim_vs_code[3]` — OAuth logout host-header open-redirect not bound to a confirmed node — substrate-coverage gap
- `doc-understanding/data-discovery.md:doc_claim_vs_code[0]` — Catalog Overview home-page composition surface has no enriched concept — substrate-coverage gap
- `doc-understanding/data-discovery__groups-domains.md:doc_claim_vs_code[4]` — concepts.yaml v8 has no DEG/Domain/DEG-membership/ML concept — /concepts refresh due (substrate-coherence)
- `doc-understanding/data-discovery__statuses.md:doc_claim_vs_code[1]` — ~25-table cascade + data-source mirror not enumerated by a single enriched node — substrate-coverage gap
- `doc-understanding/data-discovery__vector-stores.md:doc_claim_vs_code[1]` — pgvector recognition is collector-side (odd-collectors) — not verifiable in odd-platform substrate (cross-repo)
- `doc-understanding/data-glossary__business-glossary.md:doc_claim_vs_code[2]` — coverage/un-enriched — for /enrich, not DOC-NNN
- `doc-understanding/data-quality__test-run-history.md:doc_claim_vs_code[4]` — coverage/un-enriched — for /enrich, not DOC-NNN
- `doc-understanding/developer-guides__api-reference__alerts.md:doc_claim_vs_code[1]` — distribution_anomaly_halt_until 'currently unenforced' caveat not independently confirmable — halt-enforcement node descriptor-only (substrate enrichment)
- `doc-understanding/developer-guides__api-reference__query-examples.md:doc_claim_vs_code[1]` — concepts.yaml / F-025 headline '13-endpoint' but substrate holds 12 — ontology-internal drift, fix concept/feature title not doc
- `doc-understanding/developer-guides__build-and-run__build-and-run-odd-collectors.md:doc_claim_vs_code[1]` — CollectorConfig field-table defaults are odd-collectors SDK code — not verifiable in odd-platform substrate (cross-repo)
- `doc-understanding/integrations__auxiliary__odd-tracing-gateway.md:doc_claim_vs_code[1]` — odd-tracing-gateway is a separate repo — not in odd-platform substrate (cross-repo)
- `doc-understanding/integrations__collectors__odd-collector-aws.md:doc_claim_vs_code[1]` — AWS adapter plugin claims live in odd-collectors — cross-repo, not verifiable
- `doc-understanding/integrations__ingestion-filters.md:doc_claim_vs_code[0]` — ingestion-filters page documents collector-side regex filters — no implementing code in odd-platform (cross-repo); no DESCRIBES edge justified
- `doc-understanding/use-cases.md:doc_claim_vs_code[0]` — 4 of 5 use-case roles have no audience concept in substrate — substrate-coverage signal

Additional substrate signal embedded in a doc-gap entry: **HARVEST (user-owner-association `doc_claim_vs_code[0]`)** — the page's "Known incompleteness" hint is wrong (the audit rows ARE written), AND Feature sidecars **F-172 + F-075 carry the same stale "no audit trail / UNDOCUMENTED" claim** — re-enrich those features so the substrate stops asserting a gap the code closed.

## Mechanical live_url slug-rewrite signals (doc-nodes regeneration, not content gaps)

GitBook systematically rewrites slugs: it flattens `docs/integrations/<subfolder>/<page>` → `integrations/integrations/<page>`, doubles `docs/use-cases/<page>` → `use-cases/use-cases/<page>`, and serves section `README.md` at the section root (the mechanical `/readme` guess 404s). The pages render correctly at their resolved slugs (recorded in each sidecar's `live_url_resolved_slug`); only the mechanically-derived `doc-nodes.jsonl` `live_url` guesses are wrong. Fix = correct the live_url derivation for all `docs/integrations/**`, `docs/use-cases/**`, and section-`README` rows (regenerate, not hand-edit).

- `doc-understanding/configuration-and-deployment__enable-security__README.md:doc_claim_vs_code[0]` — enable-security/readme slug 404; resolves at section root /enable-security
- `doc-understanding/data-discovery__groups-domains.md:doc_claim_vs_code[5]` — doc-nodes.jsonl holds one stale short node for groups-domains — needs docs-ingest re-run
- `doc-understanding/developer-guides__build-and-run__README.md:doc_claim_vs_code[0]` — build-and-run/readme slug 404; serves at section root (mechanical)
- `doc-understanding/integrations__auxiliary__odd-tracing-gateway.md:doc_claim_vs_code[0]` — tracing-gateway live_url slug — GitBook flattens auxiliary/ to integrations/integrations/ (systemic across all integrations pages)
- `doc-understanding/integrations__collectors__odd-collector-aws.md:doc_claim_vs_code[0]` — collector-aws live_url 307 → integrations/integrations/ (systemic)
- `doc-understanding/integrations__ingestion-filters.md:doc_claim_vs_code[3]` — ingestion-filters live_url 404; serves at integrations/integrations/ingestion-filters (systemic)
- `doc-understanding/integrations__push-adapters__odd-cli.md:doc_claim_vs_code[0]` — odd-cli live_url 404; serves at integrations/integrations/odd-cli (systemic slug-rewrite)
- `doc-understanding/use-cases.md:doc_claim_vs_code[1]` — use-cases sibling links served at doubled /use-cases/use-cases/ slug (systemic GitBook pattern)
- `doc-understanding/use-cases__service-presales.md:doc_claim_vs_code[0]` — service-presales live_url doubled /use-cases/use-cases/ slug (systemic)

## Maintainer notes

<!-- preserved across refreshes; empty on first run -->
