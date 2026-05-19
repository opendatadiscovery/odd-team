---
artefact: doc-gaps
generated_at: "2026-05-19T00:00:00Z"
generated_at_commit: 80637ed
sidecar_count: 79
concepts_yaml_version: 9
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 155
findings_by_severity: { HIGH: 78, MEDIUM: 60, LOW: 17 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 135, missing-page: 8, stale-page: 0, coverage-gap: 4, meta: 9 }
reconciliation_note: |
  Batch M adds 9 NEW findings (4 HIGH + 5 MEDIUM + 0 LOW) — DOC-GAP-159..167.
  NEW HIGH: DOC-GAP-159 (DEG-anchored lineage cross-owner enumeration), DOC-GAP-160
  (search facets cross-owner cardinality enumeration), DOC-GAP-161 (search session
  UUIDs as bearer tokens), DOC-GAP-166 (to_tsquery operator-injection on persisted
  query_string — strengthens DOC-GAP-104/DOC-GAP-080 with persistence dimension).
  NEW MEDIUM: DOC-GAP-162 (LineageDepth.empty() sentinel encoding fragility),
  DOC-GAP-163 (DEG-lineage 404 conflation), DOC-GAP-164 (inner-DEG suppression
  deferred-feature debt), DOC-GAP-165 (DEG-lineage boundary-edge truncation),
  DOC-GAP-167 META (REV-3 LAYER-0 — pillar P-05 Data Lineage sub-feature
  overpromise; THIRD pillar-overpromise META after DOC-GAP-149 P-09 and
  DOC-GAP-158 P-01).
  NEW LOW: 0.
  STRENGTHENED: DOC-GAP-099 (4-angle controller-method primary source on BOTH
  /my/upstream and /my/downstream halves — OpenAPI inverse-semantic now confirmed
  at OpenAPI + service + repository + controller-method layers) + DOC-GAP-105 (now
  7-angle — DEG-anchored sibling uses simpler non-recursive overload + LineageDepth
  .empty() sentinel encoding fragility) + DOC-GAP-115 (controller-method-tier
  completeness — POSITIVE-CASE family 2/2 sidecared + NEGATIVE-CASE family 3/3
  sidecared) + DOC-GAP-104 (FTS-injection now 2-invocation-site — getHighlightedResult
  SQL-format-injection + facet-aggregator to_tsquery parser injection at 5 sites) +
  DOC-GAP-009 (api-reference 40 dataentity ops — adds 3 new operations covered;
  cumulative ~19/40; row template now needs 9 columns including Visibility model).
  Severity buckets: HIGH = 74 + 4 = 78; MEDIUM = 55 + 5 = 60; LOW = 17.
  Total 78 + 60 + 17 = 155 — matches actual sharded file count (146 + 9 new = 155).
  Strengthened entries (DOC-GAP-099, 105, 115, 104, 009) do NOT change severity
  buckets — only append batch-M evidence to existing entries.
  Note: DOC-GAP-099 has a detail/ shard but is not listed in this index (predates
  the sharding refactor); the batch-M strengthening updates the detail file but
  does not add a row to the index. This is a known historical state.
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041)."
  - "2026-05-12 (batch C): DOC-GAP-045..058 — refresh after batch 2026-05-12C (5 sidecars: 4 auth-mode SecurityConfiguration + NotificationsProperties). Auth-mode wiring-site blast-radius gaps surfaced (8 new HIGH); class-level DOC-GAP-058 captures GitBook legacy-route drift."
  - "2026-05-12 (batch D): DOC-GAP-059..071 — refresh after batch 2026-05-12D (5 config-properties-class sidecars). Primary-source POJO sidecars CONFIRM batch-C wiring-site findings AND surface 13 new findings."
  - "2026-05-12 (batch E): DOC-GAP-072..083 — refresh after batch 2026-05-12E (5 method-level RBAC sidecars). 4 new RBAC entity concepts + 1 new feature concept added."
  - "2026-05-12 (batch F): DOC-GAP-084..095 — refresh after batch 2026-05-12F (5 method-level sidecars on DataEntityController centerpiece + IngestionController)."
  - "2026-05-13 (batch G): DOC-GAP-096..103 — refresh after batch 2026-05-13-G (5 DataEntityController method-level sidecars)."
  - "2026-05-19 (batch H): DOC-GAP-104..112 — refresh after batch 2026-05-19-H (5 repository-layer sidecars). FIRST batch of repository-layer (SQL primary source) coverage in the catalog."
  - "2026-05-19 (batch I): DOC-GAP-113..127 — refresh after batch 2026-05-19-I (5 service-layer sidecars). FIRST batch of service-layer (business-invariant primary source) coverage in the catalog."
  - "2026-05-19 (batch J): DOC-GAP-128..138 — refresh after batch 2026-05-19-J (5 UI-axis sidecars). NEW HIGH: 2; MEDIUM: 6; LOW: 3. Strengthens DOC-GAP-101, 105, 096, 100, 117."
  - "2026-05-19 (batch K): DOC-GAP-139..149 — refresh after batch 2026-05-19-K (5 service-tier sidecars). NEW HIGH: 5; MEDIUM: 5; LOW: 1. Strengthens DOC-GAP-001, 054, 055, 057, 060, 062, 075, 100, 103, 108. First REV-3 LAYER-0 META (DOC-GAP-149)."
  - "2026-05-19 (batch L): DOC-GAP-150..158 — refresh after batch 2026-05-19-L (5 DataEntityController method-level sidecars). 9 NEW (4 HIGH + 5 MEDIUM + 0 LOW); 2 STRENGTHENED (DOC-GAP-001 + DOC-GAP-009). Second REV-3 LAYER-0 META (DOC-GAP-158 P-01 Data Entity Groups & Domains)."
  - "2026-05-19 (batch M): DOC-GAP-159..167 — refresh after batch 2026-05-19-M (4 sidecars: getMyObjectsWithUpstream + getMyObjectsWithDownstream + getDataEntityGroupsLineage + SearchController.facets). 9 NEW findings (4 HIGH + 5 MEDIUM + 0 LOW); 5 STRENGTHENED (DOC-GAP-099 to 4-angle; DOC-GAP-105 to 7-angle; DOC-GAP-115 to controller-method-tier completeness; DOC-GAP-104 to 2-invocation-site; DOC-GAP-009 with 3 more operations + 9th column 'Visibility model'). NEW HIGH: DOC-GAP-159 (DEG-anchored lineage cross-owner enumeration; THIRD member of the negative-case lineage family after the per-entity upstream/downstream variants), DOC-GAP-160 (search facets cross-owner cardinality enumeration; facet counts catalog-wide, myObjects toggle scopes results not counts), DOC-GAP-161 (search session UUIDs as bearer tokens; schema has no owner_id column; URL-leakage hands recipients full read+update access), DOC-GAP-166 (to_tsquery operator-injection on PERSISTED search_facets.query_string; strengthens DOC-GAP-104 + DOC-GAP-080 with persistence dimension; broken-session is DoS-shaped). NEW MEDIUM: DOC-GAP-162 (LineageDepth.empty() sentinel encoding fragility — magic -1 encoding silently disabled by future refactor), DOC-GAP-163 (DEG-lineage 404 conflates 3 distinct conditions — DEG-not-found vs DEG-empty vs wrong-entity-type), DOC-GAP-164 (inner-DEG suppression at LineageServiceImpl.java:71-75 is comment-marked deferred-feature but lacks backlog+ADR+test; STRENGTHENS DOC-GAP-124 to 2-sidecar), DOC-GAP-165 (DEG-lineage edges crossing DEG boundary silently filtered; operator sees no external context signal), DOC-GAP-167 META (REV-3 LAYER-0 — pillar P-05 Data Lineage sub-feature overpromise; 7 axes the live page is silent on; THIRD pillar-overpromise META after DOC-GAP-149 P-09 and DOC-GAP-158 P-01; cross-pillar pattern: system-mission's pillar pages systematically over-claim relative to live doc operations-coverage). WebFetch GRANTED in current session: 2 live URLs re-verified at status 200 (features/data-discovery/search; developer-guides/api-reference/lineage) + 4 inherited from sidecars (features/data-lineage; features/data-lineage/data-objects; developer-guides/api-reference; developer-guides/api-reference/data-entity 404). YAML-safe emit."
maintainer_curated: false
confidence_overall: HIGH
---

# Doc gaps — odd-platform — 2026-05-19 (batch M refresh)

## Summary

- **Findings**: 155 total (78 HIGH, 60 MEDIUM, 17 LOW)
- **By category**: broken-url 9, drift 135, missing-page 8, coverage-gap 4, meta 9
- **By feature** (top affected concepts): Auth Mode (15), Data Entity (22 — **batch M adds DOC-GAP-159 + DOC-GAP-162 + DOC-GAP-163 + DOC-GAP-164 + DOC-GAP-165; strengthens DOC-GAP-099 + DOC-GAP-105 + DOC-GAP-115 + DOC-GAP-009**), RBAC primary surface (Policy / Role / Owner / Permission) (13), Term/Business Glossary (5), Lineage (12 — **batch M adds 5 new findings on the lineage cluster + strengthens 3 existing; the lineage feature is now the deepest-covered single feature in the catalog**), Ingestion (8), Notifications (10), Search (6 — **batch M adds DOC-GAP-160 + DOC-GAP-161 + DOC-GAP-166; the search-page doc-coverage gap now spans 6 findings: original DOC-GAP-079 + DOC-GAP-080 + DOC-GAP-081 + the 3 batch-M additions**), Activity Feed (6), Attachment (5), Housekeeping TTL (5), DataCollaboration (4), Alert (9), AlertManager Webhook Receiver (5), GenAI Assistant (3), Slack collaboration app (3), Activity Table Partitioning (4), Multi-Tenant Configuration / Metrics Ingestion (1), Collector / Collector Token (2), Directory (2), Multilingual UI (1), Popular ranking surface (5), Data Entity Description cluster (5), UI Test Coverage (1 META), Catalog-overview live-page (2), User-owner association (5), Data Entity Groups & Domains (DEG) (6), Custom Metadata Fields (1), Audit-coverage methodology (1 META), **DEG-anchored Lineage (4 — batch M adds DOC-GAP-159 + DOC-GAP-163 + DOC-GAP-164 + DOC-GAP-165; first batch with DEG-lineage-specific coverage at depth)**, **Search facets & sessions (3 — batch M adds DOC-GAP-160 + DOC-GAP-161 + DOC-GAP-166; first batch with SearchController.facets coverage)**, **FTS-injection cluster (3 — batch M extends DOC-GAP-104 SQL-format-injection cluster with the to_tsquery parser-injection axis at DOC-GAP-166 + DOC-GAP-080)**
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). **Batch M adds 9 NEW findings (4 HIGH + 5 MEDIUM + 0 LOW) AND strengthens 5 existing findings (DOC-GAP-099 + DOC-GAP-105 + DOC-GAP-115 + DOC-GAP-104 + DOC-GAP-009) with FOUR controller-method-tier + SearchController-tier primary-source evidence — closing the lineage-cluster + search-facet-cluster coverage at the controller-method tier:
  - (aa) **NEW batch M: DOC-GAP-159 — DEG-anchored lineage cross-owner enumeration**: `GET /api/dataentitygroups/{id}/lineage` is the THIRD member of the negative-case lineage family (alongside per-entity upstream/downstream variants); service has NO `AuthIdentityProvider` field; `pathMatchers("/**").authenticated()` is the only gate; for multi-team DEGs (Domains), the per-connected-component partitioning surfaces graph-shaped CO-MEMBERSHIP leakage. HIGH.
  - (bb) **NEW batch M: DOC-GAP-160 — Search facets cross-owner cardinality enumeration**: facet drill-down on OWNERS / TAGS / GROUPS / NAMESPACES enumerates every owner-name + per-owner entity count catalog-wide; the `myObjects` toggle scopes the RESULT list, NOT the facet COUNTS; live search page is silent on facet-count scoping behaviour. HIGH.
  - (cc) **NEW batch M: DOC-GAP-161 — Search session UUIDs as bearer tokens**: `search_facets` schema has no `owner_id` / `created_by` / `user_id` column; any UUID-holder can READ, UPDATE, and DRIVE the session; URL-leakage via bug reports / chat messages hands recipients full session access; TODOs at V0_0_1__init.sql:206-207 acknowledge UUID/TTL gaps without defending the unscoped posture as intentional. HIGH.
  - (dd) **NEW batch M: DOC-GAP-162 — LineageDepth.empty() sentinel encoding fragility**: `(depth=-1, empty=true)` factory at `LineageDepth.java:16-18`; the CTE termination `tDepth < depth` short-circuits via the magic -1, NOT via the `boolean empty` flag; future refactor to `lessThanOrEqual` would silently extend single-hop endpoints to two hops without test signal. MEDIUM.
  - (ee) **NEW batch M: DOC-GAP-163 — DEG-lineage 404 conflation**: identical "Data entity group {id} doesn't exist" message for DEG-not-found vs DEG-empty vs wrong-entity-type; operator-debugging surprise; live api-reference page does not discriminate. MEDIUM.
  - (ff) **NEW batch M: DOC-GAP-164 — Inner-DEG suppression deferred-feature debt**: `// Remove this when we will support inner DEGs for DEG lineage` comment at LineageServiceImpl.java:71 lacks backlog + ADR + regression test; future lift will silently change API contract; STRENGTHENS DOC-GAP-124 (batch I) to 2-sidecar primary source. MEDIUM.
  - (gg) **NEW batch M: DOC-GAP-165 — DEG-lineage boundary-edge truncation**: `getLineageRelations(List<String>)` requires BOTH endpoints in member set; edges crossing DEG boundary silently filtered; operator viewing DEG-lineage sees member entity as graph leaf even when external context exists; design intent (DEG-lineage as inward-facing) is structural but undocumented operator-facing. MEDIUM.
  - (hh) **NEW batch M: DOC-GAP-166 — to_tsquery operator-injection on PERSISTED search_facets.query_string**: same JooqFTSHelper.tsQuery surface as DOC-GAP-104; persistence dimension makes the broken-session permanent; every facet aggregator at `ReactiveSearchFacetRepositoryImpl.java:182, 267, 469, 582` shares the surface; bearer-token UUIDs (DOC-GAP-161) make any UUID-holder a DoS vector. HIGH.
  - (ii) **NEW batch M: DOC-GAP-167 META — REV-3 LAYER-0 P-05 Data Lineage pillar overpromise**: `system-mission.md:163-180` declares P-05 with HIGH confidence; live page covers concept-at-depth but operations-at-shallow on 7 distinct axes (auth-posture, anchor-set asymmetry, inner-DEG suppression, boundary edges, recursive-CTE depth, OpenAPI summary correctness, 404 conflation); THIRD pillar-overpromise META after DOC-GAP-149 (P-09) and DOC-GAP-158 (P-01); cross-pillar pattern surfaced. MEDIUM.
  - (jj) **STRENGTHENED batch M: DOC-GAP-099 to 4-angle**: BOTH /my/upstream AND /my/downstream sidecars confirm the OpenAPI inverse-semantic claim at the controller-method tier; triangulation now spans OpenAPI spec + service-layer + repository-layer + controller-method primary source on BOTH halves; UI label "Upstream/Downstream dependents" at `OwnerEntitiesList.tsx:87` is semantically correct vs OpenAPI summary.
  - (kk) **STRENGTHENED batch M: DOC-GAP-105 to 7-angle**: DEG-anchored sibling uses simpler non-recursive overload at SAME repository class + LineageDepth.empty() sentinel encoding fragility (NEW axis: encoding-vs-test-coverage gap); architectural split (recursive at membership / non-recursive at edge) is deliberate optimisation but undocumented.
  - (ll) **STRENGTHENED batch M: DOC-GAP-115 to controller-method-tier completeness**: POSITIVE-CASE family 2/2 sidecared (getMyObjectsWithUpstream + getMyObjectsWithDownstream); NEGATIVE-CASE family 3/3 sidecared (getDataEntityDownstreamLineage + getDataEntityUpstreamLineage + getDataEntityGroupsLineage); the lineage cluster's asymmetry is now backed by the most complete cross-sidecar evidence in the catalog.
  - (mm) **STRENGTHENED batch M: DOC-GAP-104 to 2-invocation-site**: same JooqFTSHelper.tsQuery surface is invoked by EVERY facet aggregator at `ReactiveSearchFacetRepositoryImpl.java:182, 267, 469, 582` — five distinct facet aggregators share the FTS condition site; the two distinct injection vectors (SQL-format-injection at getHighlightedResult + tsquery-parser-injection at facets) have distinct severity profiles but share the source.
  - (nn) **STRENGTHENED batch M: DOC-GAP-009 with 3 more operations + 9th column**: api-reference data-entities row template now needs NINE columns (path, method, summary, permission, scope, idempotence, durability, audit-event, **Visibility model**); the new "Visibility model" column distinguishes POSITIVE-CASE anchor-scoped vs NEGATIVE-CASE cross-owner endpoints; cumulative coverage ~19/40 operations.

Batch L-and-prior meta-recommendations (preserved):
  - **batch L** — see prior frontmatter; DataEntityController-method-tier coverage on DEG-membership + custom-metadata + alert reads.

Batch K-and-prior meta-recommendations (preserved):
  - **batch K**: First REV-3 LAYER-0 pillar-overpromise META (DOC-GAP-149); cross-batch correction extends to 3-layer triangulation (DOC-GAP-108); 5 live URLs WebFetched.

Batch J-and-prior meta-recommendations (preserved):
  - **batch J** — see prior frontmatter; UI-axis primary-source coverage closes the consumer-facing loop.

Batch H-and-prior meta-recommendations (preserved):
  - (n) **batch H: DOC-GAP-082 META 13-sidecar (DISABLED-bypasses-RBAC-primary-surface)**.
  - (o) **batch H: DOC-GAP-083 META 4-layer (No-audit-log on RBAC mutations + ownership-binding-vs-directory-CRUD asymmetry)** — extended to PolicyServiceImpl service-layer in batch I.
  - (p) **batch H: DOC-GAP-105 supersedes DOC-GAP-021 with SQL primary-source** — extended to 6-angle in batch J + 7-angle in batch M.
  - (q) **batch H: CROSS-BATCH CORRECTION (DOC-GAP-108 — 5xx misclaim → 400 USR003)** — extended to 3-layer triangulation in batch K.
  - (r) **batch H: DOC-GAP-106 closes the AUTHORIZATION HOT PATH soft-delete leak**.
  - (s) **batch H: First SQL-injection finding (DOC-GAP-104)** — extended to 2-invocation-site in batch M with FTS-parser-injection axis at DOC-GAP-166.

Batch I-and-prior meta-recommendations (preserved):
  - (t) **batch I: DOC-GAP-113 + DOC-GAP-114 — Ingestion silent destruction LSN-001 family**.
  - (u) **batch I: DOC-GAP-115 — Lineage anchor-set asymmetry positive vs negative case** — extended to controller-method-tier completeness in batch M.
  - (v) **batch I: DOC-GAP-116 META — Service-tier transaction-boundary pattern is undocumented platform-wide ADR**.
  - (w) **batch I: DOC-GAP-117 — AlertManager webhook XSS via UI markdown render** — UI primary source confirmed at batch J (DOC-GAP-096 cluster).
  - (x) **batch I: DOC-GAP-105 strengthens to 5-angle** — extended to 6-angle in batch J + 7-angle in batch M.
  - (y) **batch I: DOC-GAP-122 — PolicyService lost-update race**.
  - (z) **batch I: DOC-GAP-097 + DOC-GAP-083 + DOC-GAP-107 + DOC-GAP-110 + DOC-GAP-073 strengthened with service-layer primary-source confirmation**.

Batch F-and-prior meta-recommendations (preserved): (i)-(s) — see prior frontmatter.
Batch E-and-prior meta-recommendations (preserved): (e)-(h) — see prior frontmatter.
Batch D-and-prior meta-recommendations (preserved): (a)-(d) — see prior frontmatter.
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages.
  - **Doc-text-vs-code audience drift** (2026-05-10A).
  - **Triangulated default-open posture** (2026-05-10B → batch I).
  - **Documentation-overstates-config-effect** (2026-05-10B + 2026-05-12D + batch F).
  - **GitBook legacy-route 404 cluster**.
  - **Auth-mode-wiring-site blast-radius gap** (2026-05-12C).
  - **Notifications subsystem under-documented for operations** (2026-05-12C + D + batch K dispatcher).
  - **2026-05-12D: Housekeeping subsystem doc completeness** — extended to orchestrator-tier in batch K.
  - **2026-05-12D: OAuth2 docs internal inconsistency**.
  - **2026-05-19 batch H: Repository-layer SQL primary-source confirms 8 existing findings AND surfaces 5 new HIGH**.
  - **2026-05-19 batch H: First SQL-injection in the catalog (DOC-GAP-104)** — extended to FTS-parser-injection axis at batch-M DOC-GAP-166.
  - **2026-05-19 batch H: First cross-batch correction propagated (DOC-GAP-108)** — extended to 3-layer in batch K.
  - **2026-05-19 batch I: Service-layer business-invariant primary-source confirms 6 existing findings AND surfaces 15 new (5 HIGH + 8 MEDIUM + 2 LOW)**.
  - **2026-05-19 batch I: First META on a platform-wide ADR-grade architectural pattern (DOC-GAP-116)**.
  - **2026-05-19 batch I: Ingestion silent-destruction LSN-001 family (DOC-GAP-113 + DOC-GAP-114)**.
  - **2026-05-19 batch J: UI-axis consumer-surface primary-source confirms 5 existing findings AND surfaces 11 new (2 HIGH + 6 MEDIUM + 3 LOW)**.
  - **2026-05-19 batch J: First META on UI test coverage absence (DOC-GAP-137)**.
  - **2026-05-19 batch J: Two NEW factual doc-vs-code mismatches on the catalog-overview live page (DOC-GAP-128 + DOC-GAP-129)**.
  - **2026-05-19 batch K: Service-tier (5 high-traffic services) primary-source confirms 10 existing findings AND surfaces 11 new (5 HIGH + 5 MEDIUM + 1 LOW)** — every service-tier finding ALSO surfaces a maintainer-intent (the implicit_adrs block) that anchors the doc-side action with a quotable design rationale.
  - **2026-05-19 batch K: First REV-3 LAYER-0 pillar-overpromise META (DOC-GAP-149)** — system-mission.md authored pillars without cross-validating against live doc coverage.
  - **2026-05-19 batch L: DataEntityController-method-tier (5 method-level sidecars) confirms 2 existing findings AND surfaces 9 new (4 HIGH + 5 MEDIUM + 0 LOW)** — every batch-L finding traces to user-visible operator-surprise. Strengthens DOC-GAP-001 to 6-sidecar + DOC-GAP-009 with 8-column row template.
  - **2026-05-19 batch L: Second REV-3 LAYER-0 pillar-overpromise META (DOC-GAP-158 P-01 Data Entity Groups & Domains)**.
  - **2026-05-19 batch L: First META on audit-coverage methodology gap (DOC-GAP-155)** — `ActivityAspect.@Profile('!integration-test')` carve-out.
  - **2026-05-19 batch L: First doc-CLAIMS-COVERAGE-code-DOESN'T-DELIVER drift on activity feed (DOC-GAP-153)**.
  - **2026-05-19 batch L: First DOC-GAP for the custom-metadata feature (DOC-GAP-156)**.
  - **NEW 2026-05-19 batch M: Lineage cluster controller-method-tier (3 method-level sidecars on the lineage entry points) closes the asymmetry coverage AND surfaces 4 new lineage findings** — POSITIVE-CASE family 2/2 sidecared + NEGATIVE-CASE family 3/3 sidecared; DOC-GAP-099 to 4-angle; DOC-GAP-105 to 7-angle; DOC-GAP-115 to controller-method-tier completeness. The lineage feature is now the deepest-covered single feature in the catalog (12 findings across 3 sub-clusters).
  - **NEW 2026-05-19 batch M: Third REV-3 LAYER-0 pillar-overpromise META (DOC-GAP-167)** — pillar P-05 (Data Lineage) sub-feature overpromise; 7 distinct axes the live page is silent on; cross-pillar pattern is now 3 instances (P-09 / P-01 / P-05). The pattern is structural; system-mission's pillar pages systematically over-claim relative to live doc operations-coverage. The methodology meta-recommendation in DOC-GAP-167 (item 3) proposes a reviewer-checklist gate to prevent recurrence on P-04 / P-06 / P-07 / P-08 / P-10 / P-11.
  - **NEW 2026-05-19 batch M: First SearchController-facets coverage (DOC-GAP-160 + DOC-GAP-161 + DOC-GAP-166)** — closes the SearchController.facets coverage gap; 3 new findings on a previously-unsidecared controller surface; search-page doc-coverage gap now spans 6 findings (search.md + facets.md combined).
  - **NEW 2026-05-19 batch M: FTS-injection cluster extends to PERSISTENCE dimension (DOC-GAP-166 + DOC-GAP-104 STRENGTHEN)** — the JooqFTSHelper.tsQuery surface is invoked at 6 distinct call sites (1 highlight + 5 facet aggregators); the persistence dimension (search_facets.query_string column) makes the broken-session permanent; DoS-shaped vector for any UUID-holder.
  - **NEW 2026-05-19 batch M: 2 live URLs re-verified in current session at status 200** — features/data-discovery/search + developer-guides/api-reference/lineage; both pages confirm the silence on cross-owner facet count scoping, session UUIDs, tsquery operator escaping, owner-scoping for DEG-lineage, inner-DEG suppression, and 404 conflation. YAML-safe emit.

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 155

---

## DOC-GAP-001 — DataEntity `/term` vs `/terms` path mismatch silently disables DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM gates — undocumented on Permissions page **(batch L: 6-sidecar — DELETE-term controller-method primary source confirms REFACTOR-217 at 4 independent sources for the symmetric DELETE half; also surfaces audit-noise complement to DOC-GAP-153's audit-silence)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-001.md`

---

## DOC-GAP-002 — Alerting feature page does not warn that `getAllAlerts` exposes every platform alert to any authenticated user; doc text names "stewards and admins" audience while code enforces any authenticated user

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-002.md`

---

## DOC-GAP-003 — AlertManager Webhook Receiver lacks rate-limit / payload-cap / dedup / spoofing caveats on operator-facing config page

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-003.md`

---

## DOC-GAP-004 — Attachment feature page does not warn about read-path authorization asymmetry (GET endpoints unprotected)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-004.md`

---

## DOC-GAP-005 — Attachment max-file-size cap is client-side-only; non-browser caller can submit arbitrary-size files — undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-005.md`

---

## DOC-GAP-006 — `/actuator/env` exposes S3/MinIO credentials by default — undocumented on Attachment Storage page (**REFINED batch D**: Spring Boot 3.4.10's `show-values: NEVER` default DOES mask values; the durable leak surface is Lombok-toString — see DOC-GAP-067)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-006.md`

---

## DOC-GAP-007 — GenAI feature page lacks prompt-injection / SSRF / DISABLED-anonymous-reachability caveats

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-007.md`

---

## DOC-GAP-008 — Directory feature page does not warn that the surface is platform-wide and bypasses owner-scoping (reconnaissance surface)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-008.md`

---

## DOC-GAP-009 — `developer-guides/api-reference` does not document the 40 dataEntity operations — punts to Swagger UI **(batch M: 3 more DataEntityController + facets sidecars surface 4 additional sub-finding classes; row template now needs 9 columns including 'Visibility model'; cumulative ~19/40 operations covered)**

**Severity**: HIGH
**Category**: coverage-gap

**Full detail**: `detail/DOC-GAP-009.md`

---

## DOC-GAP-010 — Attachment chunked-upload protocol (3-step state machine) undocumented anywhere; cross-entity uploadId hijack now confirmed at method level

**Severity**: HIGH
**Category**: coverage-gap

**Full detail**: `detail/DOC-GAP-010.md`

---

## DOC-GAP-025 — Activity Feed exposes cross-owner audit trail (`old_state`/`new_state` diffs) to any authenticated user — undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-025.md`

---

## DOC-GAP-029 — No `/developer-guides/api-reference/activity` page — global Activity feed has no first-party API reference

**Severity**: HIGH
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-029.md`

---

## DOC-GAP-032 — Slack Data Collaboration cross-tenant message injection + missing authorization gate undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-032.md`

---

## DOC-GAP-036 — `auth.type=DISABLED` is the application.yml-bundled default but live `enable-security/authentication` pages do NOT state this — operator following the docs ships an unauthenticated platform without explicit opt-in

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-036.md`

---

## DOC-GAP-037 — `/api/appInfo` discloses active `auth.type` + `projectVersion` to unauthenticated network callers under DISABLED-default — passive fingerprinting surface, undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-037.md`

---

## DOC-GAP-038 — `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-038.md`

---

## DOC-GAP-039 — `auth.type=LOGIN_FORM` runs WITHOUT the authorization framework (Policies / Permissions / Roles / Owners) — `Authorization` page describes the framework with no mention of which auth modes wire it

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-039.md`

---

## DOC-GAP-041 — Activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code never DROPs activity partitions AND housekeeping has no `activity*Days` field; the retention claim is materially incorrect (**2-angle CONFIRMED batch D**)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-041.md`

---

## DOC-GAP-045 — `disabled-authentication` page declares DISABLED "the default configuration" with a single production-warning, but omits the full blast radius (CSRF / CORS / actuator / S2S-ignored / audit-absence / no boot WARN)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-045.md`

---

## DOC-GAP-046 — OAuth2/OIDC docs list 7 supported providers (AWS Cognito, GitHub, Google, Azure AD, Okta, Keycloak, Custom OIDC) but `Provider` enum has only 5; Okta/Keycloak operators silently get no provider-specific user enrichment and no provider-specific logout (**2-angle CONFIRMED batch D from primary-source POJO sidecar**; see also DOC-GAP-069, DOC-GAP-070 for batch-D-surfaced refinements: ODD_IAM completely absent from docs, `adminUserInfoFlag` field undocumented)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-046.md`

---

## DOC-GAP-047 — OAuth2 docs reference `azure-tenant-id` config key + use `${auth.oauth2.client.azure.azure-tenant-id}` interpolation, but `ODDOAuth2Properties.OAuth2Provider` POJO has NO `azureTenantId` field — Azure YAML example is not deployable as-shown

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-047.md`

---

## DOC-GAP-048 — OAuth2 docs flag Azure `logout-uri` as REQUIRED ("unset value causes NullPointerException") but `ODDOAuth2Properties.validate()` only checks `clientId` and `provider` — operator boots successfully and fails at first logout

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-048.md`

---

## DOC-GAP-049 — OAuth2/OIDC docs do NOT mention `auth.s2s.enabled` or the S2S composition with OAUTH2 — operators deploying OAuth2 + S2S see an undocumented X-API-Key → ADMIN-across-all-paths surface

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-049.md`

---

## DOC-GAP-050 — LDAP `auth.ldap.password` leak surface — actuator-env value-mask is operator-overridable AND the **durable** leak vector is Lombok `@Data`-generated `toString()` (**REFINED batch D**)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-050.md`

---

## DOC-GAP-051 — LDAP setup page omits `ldap://` vs `ldaps://` scheme guidance, substring-match admin-groups collision risk, empty admin-groups → no admins, S2S composability, `management.health.ldap.enabled` default false, and timeout/pooling configuration — seven distinct caveats absent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-051.md`

---

## DOC-GAP-052 — LOGIN_FORM page omits `auth.login-form-redirect` config key (open-redirect surface), the absence of the authorization framework (DOC-GAP-039 sibling), session-cookie security flags, S2S composability, plain-text credential leak via `/actuator/env`, and CSRF posture — six distinct caveats absent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-052.md`

---

## DOC-GAP-053 — `auth.type=NOOP` is the legacy literal in `application-with-auth.yml` aside from being deprecated — operator copy/pasting from old configs gets cryptic boot error

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-053.md`

---

## DOC-GAP-054 — Notifications subsystem lacks an Operations/Architecture page — operator deploying webhooks has NO doc on WAL slot setup, the per-message no-PII-redaction posture, sender ordering, retries, or the partial-delivery contract **(batch K: 2-sidecar — dispatcher-tier primary source via NotificationsDispatcher confirms WAL replication-slot orphan risk + the cross-channel exception asymmetry)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-054.md`

---

## DOC-GAP-055 — `notifications.enabled` is a 5-key precondition (URL + advisory-lock-id + receivers + WAL + email config); page presents the toggle without surfacing the matrix — operator deploys with the flag flipped and silently gets no notifications **(batch K: 2-sidecar — dispatcher-tier confirms 3 of 5 preconditions; 2 additional dispatcher-side sub-caveats add to the matrix)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-055.md`

---

## DOC-GAP-073 — `/configuration-and-deployment/enable-security/authorization/policies` page is concept-only and omits the 7-permission-axis Policy authoring shape — operators read it as "introduction" but find nothing about how to author a Policy beyond a single example **(batch I STRENGTHENS — PolicyServiceImpl service-tier confirms the live-doc-vs-code gap is structural)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-073.md`

---

## DOC-GAP-082 — **META-FINDING** — `auth.type=DISABLED` BYPASSES the entire Authorization framework — Policies / Permissions / Roles / Owners / Owner-association requests all silently no-op; ALL admin operations are anonymously reachable on a network-exposed deployment; 13-sidecar triangulated cluster

**Severity**: HIGH
**Category**: meta

**Full detail**: `detail/DOC-GAP-082.md`

---

## DOC-GAP-083 — **META-FINDING** — No-audit-log on RBAC mutations + ownership-binding-vs-directory-CRUD audit asymmetry — entity-binding audited; directory-CRUD not — undocumented + cross-layer (batch I extends to service-tier via PolicyServiceImpl confirming the cross-layer audit absence)

**Severity**: HIGH
**Category**: meta

**Full detail**: `detail/DOC-GAP-083.md`

---

## DOC-GAP-084 — `LineageServiceImpl.getLineage` is read-collaborative (REFACTOR-203) — no per-owner filtering at the service tier; cross-owner lineage enumeration via per-entity lineage endpoints undocumented anywhere; pairs with batch H's repository-layer SQL primary source

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-084.md`

---

## DOC-GAP-085 — Owner-association request flow has NO authorization framework when `auth.type=LOGIN_FORM` (DOC-GAP-039 cross-cut); LDAP / OAUTH2 do route requests through Policy + Permission resolution, but `LOGIN_FORM` runs without the framework — operators using LOGIN_FORM in production with the association flow get an undocumented unenforced admin gate

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-085.md`

---

## DOC-GAP-087 — `IngestionDataEntitiesFilter` path-pattern matches `/ingestion/entities` POST ONLY — the documented "Ingestion filter" covers ONE of the platform's TEN `/ingestion/*` paths; the other 9 are unfiltered regardless of `auth.ingestion.filter.enabled` — undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-087.md`

---

## DOC-GAP-098 — `updateDataEntityStatus` API path is `PUT /api/dataentities/{id}/statuses/{status_id}` but live `dataEntityStatus` page documents `PUT /api/dataentities/{id}/status/{status_id}` — second `/term` vs `/terms` family path-mismatch (singular vs plural); affects Status update enforcement of `DATA_ENTITY_STATUS_UPDATE` permission

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-098.md`

---

## DOC-GAP-104 — `getHighlightedResult` SQL-format-injection AND `to_tsquery` operator-injection at every facet aggregator share the `JooqFTSHelper.tsQuery` surface (HIGH; SQL-injection-shaped + parser-DoS-shaped) **(batch M: 2-invocation-site — facet aggregators at 5 distinct sites; persistence dimension at DOC-GAP-166)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-104.md`

---

## DOC-GAP-105 — Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat (**SUPERSEDES DOC-GAP-021 via batch H SQL primary-source; extended to 5-angle in batch I; 6-angle in batch J with UI-layer evidence; 7-angle in batch M with DEG-anchored sibling + LineageDepth.empty() sentinel fragility**)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-105.md`

---

## DOC-GAP-106 — Authorization HOT PATH soft-delete leak — REFACTOR-201 confirms the AUTHORIZATION HOT PATH does NOT use `addSoftDeleteFilter` for permission resolution; soft-deleted entities are silently READABLE via permission lookups for unbounded duration; live Permissions page silent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-106.md`

---

## DOC-GAP-107 — `IngestionService` is the platform's largest single point of failure — all 14 IngestionRequestProcessors run inside ONE `@ReactiveTransactional` boundary on a 1000-entity payload; a single per-entity failure rolls back the other 999; operators get a Mono<Void> response with NO error-detail body; cross-batch coupling — pairs with DOC-GAP-120 (batch I) which strengthens with the same anti-pattern

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-107.md`

---

## DOC-GAP-108 — `POST /api/dataentities/{id}/ownership` USR003 error shape (HTTP 400) on duplicate; the live page (or any other operator-facing surface) does NOT document USR003 — cross-batch correction propagated from batch-F misclaim to repository-layer primary source AND batch-K service-tier independent confirmation; 3-LAYER TRIANGULATION

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-108.md`

---

## DOC-GAP-113 — `IngestionServiceImpl` is the silent-destruction surface — INGESTION REPLACES not MERGES; new collector runs OVERWRITE existing entity state without a "previous state" preserved unless soft-delete kicks in; LSN-001-family bug; cross-link DOC-GAP-118

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-113.md`

---

## DOC-GAP-114 — Ingestion `DELETED_ENTITIES_QUERY_PAGE_SIZE = 1000` is hardcoded; a soft-delete cascade-on-ingestion fires per 1000-entity slice; an inverted predicate (a refactor introducing `.where(STATUS.equal(DELETED))` instead of `.where(STATUS.notEqual(DELETED))` would silently soft-delete ACTIVE entities; LSN-class drift; live page silent on the magic constant

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-114.md`

---

## DOC-GAP-115 — Lineage anchor-set positive-vs-negative-case asymmetry — `/api/dataentity/{id}/lineage` returns DIFFERENT JSON shapes when the anchor entity is or isn't itself in the result set (positive case includes self; negative-case OMITS self); operators consuming the response cannot pre-test for anchor presence; undocumented at every API page **(batch M: controller-method-tier completeness — POSITIVE-CASE family 2/2 sidecared + NEGATIVE-CASE family 3/3 sidecared)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-115.md`

---

## DOC-GAP-116 — **META-FINDING** — Service-tier `@ReactiveTransactional` boundary pattern is a platform-wide ADR-grade architectural decision (every reactive service places txn boundaries at the service; every Reactive*RepositoryImpl is un-annotated) but is undocumented at any layer; within-service asymmetries (RoleServiceImpl IS transactional, PolicyServiceImpl is NOT; updateStatus delegates to a downstream-annotated method) are also undocumented

**Severity**: HIGH
**Category**: drift (meta — pattern-vs-doc divergence on a structural decision; affects every developer-guide page describing platform writes)

**Full detail**: `detail/DOC-GAP-116.md`

---

## DOC-GAP-117 — AlertManager webhook `generatorURL` field is embedded verbatim into chunk description via `String.format("Distribution Anomaly. URL: %s", queryUrl)`; combined with DOC-GAP-096 (UI markdown render without sanitisation) AND DOC-GAP-038 (unauthenticated webhook), any network-reachable caller can plant a wire-XSS chain that fires in any platform user's session viewing the alert; 4th attack vector on DOC-GAP-107's compound finding

**Severity**: HIGH
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` covers wiring without warning about untrusted-URL embedding; the cross-attack-surface chain is invisible)

**Full detail**: `detail/DOC-GAP-117.md`

---

## DOC-GAP-130 — LSN-017 +2 view_count per detail-page-open undocumented end-to-end — Popular ranking is twice as sensitive to legitimate browsing as the docs describe; mechanism (read-as-write detail-page; dep-array bug at `DataEntityDetails.tsx:63`) invisible across `catalog-overview` + `Popular` doc surfaces; empirically pinned by P-004

**Severity**: HIGH
**Category**: drift (live `catalog-overview` describes Popular as "most-viewed" without naming the per-page-open multiplicity, the read-as-write trigger, or the UI bug locus; 4 UI sidecars + 1 backend repository converge)

**Full detail**: `detail/DOC-GAP-130.md`

---

## DOC-GAP-137 — **META-FINDING** — ZERO UI test coverage across the entire `odd-platform-ui` SPA — Vitest + @testing-library/react + jsdom installed; `test`/`test:coverage` scripts declared; ZERO `.test.tsx`/`.spec.tsx` files exist anywhere; 57 named uncovered behaviours surface across 5 batch-J sidecars; the platform's hottest user-facing flows are enforced today by manual exercise and the probe-runs suite alone

**Severity**: HIGH
**Category**: meta (cross-cutting; pairs with the test-coverage-mapper reducer's TEST-GAP-NNN cluster)

**Full detail**: `detail/DOC-GAP-137.md`

---

## DOC-GAP-139 — Independent SecurityConstants bug — `PUT /api/alerts/{alert_id}/status` is wired to `DATASET_FIELD_ADD_TERM` (a Term permission applied to an Alert path); the intended `DATA_ENTITY_ALERT_RESOLVE` is never consulted; operators with `DATASET_FIELD_ADD_TERM` can change any alert's status while named-alert-resolve holders cannot — sibling to REFACTOR-217 / DOC-GAP-001 (different permission axis) — surfaced by TermServiceImpl primary source

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-139.md`

---

## DOC-GAP-140 — Term description-edit auto-link service-tier side-channel bypasses `DATA_ENTITY_ADD_TERM` — `handleDataEntityDescriptionTerms` inserts `data_entity_to_term` with `is_description_link=TRUE` without consulting the documented permission; lives at the service tier, persists even if REFACTOR-217 controller-tier is fixed; live Business Glossary + Permissions pages silent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-140.md`

---

## DOC-GAP-141 — S2sAuthenticationFilter hardcodes username `'ADMIN'` (uppercase, case-sensitive) into the S2S Authentication token; any S2S API-key call that invokes a service using `AuthIdentityProvider.fetchAssociatedOwner` looks up `WHERE oidc_username='ADMIN' AND provider IS NULL`; if an operator has named a real LOGIN_FORM/LDAP user `ADMIN`, the S2S caller inherits that user's owner-scoped reads/mutations — operator-naming-controllable but undocumented across security docs

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-141.md`

---

## DOC-GAP-142 — No auto-create-on-first-login under OAUTH2 / LDAP / LOGIN_FORM — new federated user authenticates successfully but has NO `USER_OWNER_MAPPING` row; `My Objects` / `My Alerts` / `MY_OBJECTS` activity all silently degrade to HTTP 200 with empty body; no UI banner directs the user to the OwnerAssociationRequest flow; combined with batch-E DOC-GAP-075 the full principal-to-Owner onboarding flow is invisible operator-facing

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-142.md`

---

## DOC-GAP-143 — NotificationsDispatcher poison-message WAL replay loop on translation failure — `RuntimeException` from `AlertNotificationMessageTranslator.translate()` bypasses the per-sender catch (which catches only `NotificationSenderException`); propagates to `NotificationSubscriber.run()`, releases the lock, sleeps 10s, re-acquires, replays SAME WAL LSN indefinitely, BLOCKING subsequent WAL messages; no metric, no health-check signal, no UI surface

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-143.md`

---

## DOC-GAP-150 — DEG membership writes are a write-collaborative surface — `DATA_ENTITY_ADD_TO_GROUP` is gated PER CHILD ENTITY (not per DEG); any authorized caller places their entity into ANY manually-created DEG; live `groups-domains` page describes Owner stewardship at the DEG level but implementation does NOT enforce DEG-side ownership on the membership-write path; combined with read-collaborative posture the polluted DEG is visible to every authenticated user

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-150.md`

---

## DOC-GAP-153 — DEG membership audit-feed absence + activity-feed page MISREPRESENTS coverage — live `activity-feed` page describes `CUSTOM_GROUP_UPDATED` as "members or metadata of a custom group were changed" implying membership flips ARE recorded; `addDataEntityToDEG`/`deleteDataEntityFromDEG` carry NO `@ActivityLog`; `DATA_ENTITY_RELATION_UPDATED` enum exists but unused — DOC-CLAIMS-COVERAGE-CODE-PROVIDES-SILENCE drift

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-153.md`

---

## DOC-GAP-156 — `PUT /api/dataentities/{id}/metadata/{metadata_field_id}` returns 200 OK SILENTLY on a `(dataEntityId, metadataFieldId)` pair with no existing row; UI's redux thunk hardcodes "Metadata successfully updated." on any non-error response; no `@ActivityLog` on the upsert path; no operator-facing doc page for the custom-metadata feature (FIRST DOC-GAP for the feature)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-156.md`

---

## DOC-GAP-157 — `GET /api/dataentities/{id}/alerts` cross-owner read posture on the doc-recommended audit-export workaround — any authenticated user reads any entity's complete alert history including alert chunks (raw AlertManager-derived URL text); F-006 shape applied to per-entity surface; live alerting page is silent on cross-owner reach AND pagination-truncation risks; SECOND DOC-GAP naming cross-owner alert read after DOC-GAP-002

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-157.md`

---

## DOC-GAP-159 — DEG-anchored lineage cross-owner enumeration — `GET /api/dataentitygroups/{id}/lineage` is the THIRD member of the negative-case lineage family (alongside per-entity upstream/downstream variants); `LineageServiceImpl.getDataEntityGroupLineage` has NO `AuthIdentityProvider` field; `pathMatchers("/**").authenticated()` is the only gate; for multi-team DEGs (Domains), the per-connected-component partitioning surfaces graph-shaped CO-MEMBERSHIP leakage wider than per-entity lineage REFACTOR-203

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-159.md`

---

## DOC-GAP-160 — Search facet drill-down on `/api/search/{search_id}/facet/{facet_type}` enumerates every OWNER NAME + per-owner entity count CATALOG-WIDE — `ReactiveSearchFacetRepositoryImpl.java:339-372` joins OWNER + OWNERSHIP + SEARCH_ENTRYPOINT + DATA_ENTITY with NO `OWNERSHIP.OWNER_ID = ?` predicate; the `myObjects` toggle scopes the RESULT list, NOT the facet COUNTS; an attacker who cannot read an entity directly can INFER its existence via the OWNERS / NAMESPACES / TAGS / GROUPS facet counts

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-160.md`

---

## DOC-GAP-161 — `search_facets` table (PK uuid, query_string varchar(255), filters jsonb) has NO `owner_id` / `created_by` / `user_id` column at the schema layer (`V0_0_1__init.sql:204-211`); any UUID-holder can READ, UPDATE, and DRIVE the session — the UUID is a BEARER TOKEN at the schema layer; copy-pasting a search URL into a bug report or chat message hands the recipient full read+update access; live page silent on UUID semantics

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-161.md`

---

## DOC-GAP-166 — `to_tsquery` operator-injection on PERSISTED `search_facets.query_string` — `JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) does NOT escape tsquery operators (`!`, `(`, `)`, `:`, `<->`, `&`, `|`, `'`, `\`); a caller who POSTs a search with `query='foo )('` PERSISTS the row; every subsequent facet aggregator that runs on that row's state fails at `to_tsquery` parse time; session is PERMANENTLY BROKEN; STRENGTHENS DOC-GAP-104 + DOC-GAP-080 with persistence dimension

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-166.md`

---

### MEDIUM severity

## DOC-GAP-011 — Legacy URL `/active-platform-features/alerting` returns 404 — canonical at `/features/active-platform-features/alerting`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-011.md`

---

## DOC-GAP-012 — Legacy URL `/active-platform-features/genai` returns 404 — canonical at `/features/active-platform-features/genai`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-012.md`

---

## DOC-GAP-013 — Legacy URL `/data-discovery/attachments` returns 404 — canonical at `/features/data-discovery/attachments`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-013.md`

---

## DOC-GAP-014 — Legacy URL `/data-discovery/directory` returns 404 — canonical at `/features/data-discovery/directory`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-014.md`

---

## DOC-GAP-015 — Legacy URL `/main-concepts` returns 404 — canonical at `/introduction/main-concepts.md`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-015.md`

---

## DOC-GAP-016 — Directory page wording: level 3 mixes "classes" and "types" — operator confusion

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-016.md`

---

## DOC-GAP-017 — GenAI feature page: OpenAPI spec declares only 200 OK — no documented 400/500 error contract for `/api/genai/ask`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-017.md`

---

## DOC-GAP-018 — API spec carries no `security:` block and no `components.securitySchemes` — invariant of contract-vs-runtime mismatch undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-018.md`

---

## DOC-GAP-019 — Concept "AlertManager Webhook Receiver" is a canonical_candidate but not a registered term in `main-concepts.md`

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-019.md`

---

## DOC-GAP-020 — Concept "Locale Bundle" / "Multilingual UI" — F-047 is filed; cross-referenced here

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-020.md`

---

## DOC-GAP-021 — Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat **(batch H: superseded by DOC-GAP-105 with SQL primary-source; cross-referenced here)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-021.md`

---

## DOC-GAP-022 — Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-022.md`

---

## DOC-GAP-023 — Cross-entity uploadId hijack (Attachment) — undocumented; method-level evidence confirms the attack shape

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-023.md`

---

## DOC-GAP-030 — Activity Feed feature page omits `type` parameter, visibility model, cursor pagination mechanics

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-030.md`

---

## DOC-GAP-033 — Slack Data Collaboration api-reference page omits authentication/authorization/validation/rate-limit

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-033.md`

---

## DOC-GAP-034 — Token Rotation operational mechanics (grace period, audit logging, plaintext-in-response, in-flight 401) absent from enable-security pages

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-034.md`

---

## DOC-GAP-035 — `/active-platform-features/data-collaboration` returns 404 on legacy URL — canonical at `/features/active-platform-features/data-collaboration`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-035.md`

---

## DOC-GAP-040 — `AuthorizationManagerCondition` is unwired dead code — Authorization page describes the framework as if a centralised condition gates it

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-040.md`

---

## DOC-GAP-042 — Activity-feed partition WIDTH is `2 × partition-period` (60 days at default) but docs say "a new partition every 30 days"

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-042.md`

---

## DOC-GAP-043 — Activity-feed partition CREATE failures are silently swallowed; operator has no metric / alert / health-check signal — undocumented; `partition.advisory-lock-id` undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-043.md`

---

## DOC-GAP-056 — Legacy URL `/active-platform-features/notifications` returns 404 — canonical at `/features/active-platform-features/notifications`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-056.md`

---

## DOC-GAP-057 — Notifications subsystem under-documents operational caveats — dead `notifications.webhookUrl` field, no per-channel filtering, no PII redaction, replication-slot orphan risk on rename, webhook unsigned delivery **(batch K: 2-sidecar — dispatcher-tier primary-source confirms 2 of 5 sub-caveats; cluster expands to 7 sub-caveats with DOC-GAP-143 + DOC-GAP-147)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-057.md`

---

## DOC-GAP-058 — **META-FINDING** — GitBook legacy-vs-canonical routing drift is a cross-cutting class (**now 3-sidecar triangulated after batch E: DataCollaboration + Notifications + Search**); recommend a doc-side audit of ALL legacy paths

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-058.md`

---

## DOC-GAP-060 — Housekeeping docs frame the subsystem as "three cleanup tasks" but code has 5 HousekeepingJob beans — `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` are undocumented **(batch K: 3-sidecar — orchestrator-tier primary-source via HousekeepingJobManager)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-060.md`

---

## DOC-GAP-062 — AlertHousekeepingJob jOOQ-precedence bug acknowledged in docs but unlinked to a tracking issue / no workaround documented **(batch K: 2-sidecar — orchestrator-tier primary-source + verbatim fix-shape)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-062.md`

---

## DOC-GAP-064 — DataCollaboration lock-id collision risk undocumented — operators tuning the four advisory-lock IDs (`partition.advisory-lock-id=90`, `notifications.wal.advisory-lock-id=100`, `datacollaboration.receive-event-advisory-lock-id=110`, `datacollaboration.sender-message-advisory-lock-id=120`) get no guardrails; operator who copies default 100 to data-collab silently breaks both subsystems

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-064.md`

---

## DOC-GAP-066 — Email channel config doc completeness — `port`=int default 0 cliff, boxed Boolean nullability, modern SMTP-AUTH OAUTH2 absent, no Reply-To / Cc / Bcc / DKIM support, sender no `@Email` validation, recipient list comma-split has no per-address trim

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-066.md`

---

## DOC-GAP-068 — **META-FINDING** — Partial-home pattern: `@ConfigurationProperties` POJOs bind only a subset of their config-prefix's keys; docs that enumerate the prefix don't surface the @Value-scattered remainder

**Severity**: MEDIUM
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-068.md`

---

## DOC-GAP-071 — DataCollab `datacollaboration.*` prefix is a partial-home — 3 of 7 keys bind to `DataCollaborationProperties`, 4 scattered across `@Value` in 4 files (specific instance of DOC-GAP-068 META)

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-071.md`

---

## DOC-GAP-074 — OpenAPI declares 201 Created for `POST /api/owners` (and sibling create endpoints) but `OwnerController.java:26` returns 200 OK via `ResponseEntity::ok` — third concrete instance of a class-wide 201-vs-200 OpenAPI/implementation drift on RBAC create operations

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-074.md`

---

## DOC-GAP-075 — Owners live doc page omits creation mechanics (`POST /api/owners`), `OWNER_CREATE` permission, audit-trail absence, association-request flow mechanics, name validation gaps, and soft-delete recovery semantics (6 doc-drift sub-findings) **(batch K: 3-sidecar — REFACTOR-199 service-tier confirmation + maintainer-intent capture; expands to 8 sub-findings)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-075.md`

---

## DOC-GAP-077 — Live `/authorization/permissions` page lists 5 permission categories (Data entity / Term / Query Example / Lookup table / Management) but the code's `PermissionResourceType` enum exposes 4 contextual values (DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT) — Lookup table is documented as a category but is NOT a contextual resource type; LOOKUP_TABLE_* permissions live as NO_CONTEXT MANAGEMENT-bucket entries

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-077.md`

---

## DOC-GAP-080 — Search live doc page silent on query syntax — `JooqFTSHelper.tsQuery` splits user input on a single space, appends `:*` to each token, joins with `&`, and passes verbatim to Postgres `to_tsquery(?)`; user queries with tsquery-meaningful metacharacters (`!`, `|`, `(`, `)`, `<->`, `:`) silently re-interpret or yield syntax-error 500s **(batch M: PERSISTENCE dimension at DOC-GAP-166)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-080.md`

---

## DOC-GAP-081 — Legacy URL `/features/active-platform-features/search` returns 404 — canonical at `/features/data-discovery/search`; 3rd corroborating instance of the legacy-vs-canonical routing-drift cross-cutting pattern (strengthens DOC-GAP-058 META from 2-sidecar to 3-sidecar)

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-081.md`

---

## DOC-GAP-100 — `[[namespace:term]]` description auto-linking syntax is platform-specific, undocumented in operator-facing pages, and quintuple-confirmed-missing (batch I + batch J + **batch K — service-tier primary source for the regex constant**)

**Severity**: MEDIUM
**Category**: missing-page (no operator-facing dictionary / glossary / business-glossary feature page exists; the description-side auto-linking syntax has no canonical home)

**Full detail**: `detail/DOC-GAP-100.md`

---

## DOC-GAP-101 — Popular ranking signal is undocumented externally — `catalog-overview` describes the surface, no page describes the `view_count DESC`-only mechanism, the inflation surface, or the `EXCLUDE_FROM_SEARCH` bypass **(batch H STRENGTHENS with SQL primary-source confirmation; batch J STRENGTHENS to 5-sidecar with UI-side F-001 loop closure)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-101.md`

---

## DOC-GAP-102 — `getMyObjects` empty-Flux degradation for unlinked users is documented at the wrong layer — `catalog-overview` mentions the Owner-link prerequisite but no page describes what the operator-facing failure mode looks like

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-102.md`

---

## DOC-GAP-109 — Alert `listByOwner` empty-result total uses platform-wide count (`countAlertsWithStatusOpen`) instead of owner-scoped count (`countAlertsWithStatusOpenByOwner`) — when caller has zero owned alerts, the UI's pagination badge displays a non-zero number while the visible list is empty

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-109.md`

---

## DOC-GAP-110 — Alert reopen-conflict guard `openAlertWithTheSameTypeExistsForDataEntity` is read-then-write without `SELECT FOR UPDATE` or DB-side partial-index — two concurrent reopens can both pass the EXISTS check and both proceed to UPDATE **(batch I STRENGTHENS to 3-layer with service-layer maintainer-intent capture)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-110.md`

---

## DOC-GAP-112 — Policy soft-delete + partial unique index `policy_name_unique ON policy(name) WHERE deleted_at IS NULL` + `PolicyServiceImpl.create` missing Administrator-name protection = compound risk under direct-DB

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-112.md`

---

## DOC-GAP-118 — Soft-deleted data entities are silently restored on re-ingestion — `IngestionServiceImpl.java:127-136` routes DELETED-status entities through `restoreDeletedDataEntityRelations`; activity-feed emits NO event on restore

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-118.md`

---

## DOC-GAP-119 — MICROSERVICE-typed existing entities are silently EXCLUDED from `specificAttributesDeltas` at `IngestionServiceImpl.java:103`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-119.md`

---

## DOC-GAP-120 — `POST /ingestion/entities` is all-or-nothing on batch failures — `@ReactiveTransactional` scopes the entire 14-processor chain; a single failed entity in a 1000-entity payload rolls back the other 999

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-120.md`

---

## DOC-GAP-121 — Activity-feed integration in the ingestion path emits ONLY for NEW entities, NOT for ingestion-driven UPDATEs

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-121.md`

---

## DOC-GAP-122 — PolicyService lost-update race on `PUT /api/policies/{id}` — `PolicyServiceImpl.update` is NOT `@ReactiveTransactional`; the read-then-write composition outside any transaction can lose updates silently

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-122.md`

---

## DOC-GAP-123 — PolicyService schema-validation failures surface as HTTP 500 (Internal Server Error) rather than HTTP 400 — `PolicyJSONValidator` throws `IllegalArgumentException`; ControllerAdvice has NO dedicated handler

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-123.md`

---

## DOC-GAP-124 — Inner-DEG suppression in `LineageServiceImpl.getDataEntityGroupLineage` is a deliberate deferred-feature carve-out **(batch M STRENGTHENS — controller-method primary source confirms the comment-marked deferred-feature debt; cross-link DOC-GAP-164)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-124.md`

---

## DOC-GAP-125 — AlertManager webhook `ExternalAlert.startsAt` is `LocalDateTime` (timezone-naive); embedded Prometheus query-window URL keyed to SERVER local time

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-125.md`

---

## DOC-GAP-128 — Live `/features/data-discovery/catalog-overview` says "Clicking a tile opens that entity's **Structure** page" but the UI navigates to the **Overview** tab

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-128.md`

---

## DOC-GAP-129 — Live `/features/data-discovery/catalog-overview` says under DISABLED auth "the panel is visible but the per-user filtering does not apply" — code HIDES the entire Recommended panel under DISABLED

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-129.md`

---

## DOC-GAP-131 — UI Lineage canvas hardcodes a depth-1 default + caps the visible depth slider at 20 + accepts unbounded `?d=` URL param

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-131.md`

---

## DOC-GAP-132 — UI Lineage canvas amplifies diamond DAGs into duplicate visual nodes AND silently drops crossEdges that reference missing nodes

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-132.md`

---

## DOC-GAP-134 — F-004 entity-description rendering surface — Permission docs name `DATA_ENTITY_DESCRIPTION_UPDATE` but do NOT say content render is unconditional for any `DATA_ENTITY_VIEW` holder

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-134.md`

---

## DOC-GAP-136 — `AppError` banner reflects `error.status` / `error.statusText` / `error.url` / `error.message` verbatim — backend stack traces and internal API paths render into the UI banner

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-136.md`

---

## DOC-GAP-144 — Term `updateTerm` and `delete` BLOCKED with HTTP 400 if any active description mentions the term via `[[ns:term]]`; live Business Glossary page silent

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-144.md`

---

## DOC-GAP-145 — Term unhandled-mention staging tables (`*_unhandled_term`) with forward-resolution on term-create; feature undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-145.md`

---

## DOC-GAP-146 — Title directory auto-grows via `OwnershipServiceImpl.titleService.getOrCreate(formData.titleName)`; no `TITLE_CREATE` permission, no allowlist, no validation; REFACTOR-206 anchor

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-146.md`

---

## DOC-GAP-147 — NotificationsDispatcher Email vs Slack/Webhook exception asymmetry — `EmailNotificationSender` wraps as RAW `RuntimeException`; Email failures BYPASS the dispatcher's per-sender catch and ABORT fan-out

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-147.md`

---

## DOC-GAP-149 — **META-FINDING** — REV-3 LAYER-0 pillar-overpromise: `system-mission.md` P-09 (Security & Access Control) sub-feature "User-owner association" Confidence: HIGH; live page contains one one-sentence runtime-semantic claim; five distinct runtime semantics have ZERO operator-facing presence

**Severity**: MEDIUM
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-149.md`

---

## DOC-GAP-151 — DEG membership ADD/DELETE permission asymmetry undocumented — `DATA_ENTITY_ADD_TO_GROUP` and `DATA_ENTITY_DELETE_FROM_GROUP` are TWO DISTINCT permissions; Policy authors granting half-pair receive surprise 403; compound-capability framing missing on the Permissions page

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-151.md`

---

## DOC-GAP-152 — DEG membership ADD-vs-DELETE CRUD idempotence asymmetry — POST raises 400 on duplicate; DELETE returns 204 SILENTLY on no-op; API consumers writing reconciliation scripts cannot predict no-op behaviour; combined with audit-feed absence (DOC-GAP-153) silent-204 has zero forensic trail

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-152.md`

---

## DOC-GAP-154 — HARD-DELETE on relationship edges undocumented — DEG-membership unlink + term-unlink are physical `DELETE FROM` (V0_0_76 affirmative migration); no API restore path; recovery-surface asymmetry — DEG-membership has NO audit (DOC-GAP-153), term-unlink emits `TERM_ASSIGNMENT_UPDATED` BEFORE/AFTER state; sibling to DOC-GAP-111

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-154.md`

---

## DOC-GAP-155 — **META-FINDING** — `@ActivityLog` AOP aspect `ActivityAspect` carries `@Profile("!integration-test")`; integration-test runs DISABLE the aspect; absent `@ActivityLog` annotations on DEG-membership / term-delete / metadata-write paths CANNOT be detected by the integration-test harness; sister-META to DOC-GAP-137

**Severity**: MEDIUM
**Category**: meta

**Full detail**: `detail/DOC-GAP-155.md`

---

## DOC-GAP-158 — **META-FINDING** — REV-3 LAYER-0 pillar P-01 (Data Discovery) sub-feature overpromise — `system-mission.md:99` declares "Data Entity Groups & Domains" with Confidence: HIGH; live `groups-domains` page documents the CONCEPT at depth but is operationally silent; 5 batch-L sub-findings demonstrate the operations-coverage gap; same shape as DOC-GAP-149 META for P-09

**Severity**: MEDIUM
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-158.md`

---

## DOC-GAP-162 — `LineageDepth.empty()` sentinel encoding fragility — `(depth=-1, empty=true)` factory at `LineageDepth.java:16-18`; the CTE termination `tDepth < depth` short-circuits via the magic -1, NOT via the `boolean empty` flag; future refactor to `lessThanOrEqual` would silently extend single-hop endpoints to two hops without test signal

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-162.md`

---

## DOC-GAP-163 — `getDataEntityGroupsLineage` 404 conflates THREE semantically distinct conditions — DEG ID does not exist + non-DEG-typed entity + DEG-has-no-members — all raise identical "Data entity group {id} doesn't exist"; operator-debugging surprise; live api-reference page does not discriminate

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-163.md`

---

## DOC-GAP-164 — Inner-DEG suppression at `LineageServiceImpl.java:71-75` is comment-marked deferred-feature but lacks backlog + ADR + regression test; future lift will silently change API contract; STRENGTHENS DOC-GAP-124 to 2-sidecar primary source

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-164.md`

---

## DOC-GAP-165 — DEG-lineage edges crossing DEG boundary silently filtered — `getLineageRelations(List<String>)` requires BOTH endpoints in member set; operator viewing DEG-lineage sees member entity as graph leaf even when external context exists; design intent (DEG-lineage as inward-facing) is structural but undocumented operator-facing

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-165.md`

---

## DOC-GAP-167 — **META-FINDING** — REV-3 LAYER-0 pillar P-05 (Data Lineage) sub-feature overpromise — `system-mission.md:163-180` declares P-05 with HIGH confidence; live `/features/data-lineage` covers concept-at-depth but operations-at-shallow on 7 distinct axes (auth-posture, anchor-set asymmetry, inner-DEG suppression, boundary edges, recursive-CTE depth, OpenAPI summary correctness, 404 conflation); THIRD pillar-overpromise META after DOC-GAP-149 (P-09) and DOC-GAP-158 (P-01); cross-pillar pattern surfaced

**Severity**: MEDIUM
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-167.md`

---

### LOW severity

## DOC-GAP-024 — OpenAPI tag `alert` has no `description:` field and no `externalDocs.url`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-024.md`

---

## DOC-GAP-026 — AlertManager DTO drops `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`; cannot honour `status: resolved`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-026.md`

---

## DOC-GAP-027 — Locale-bundle CSP / localStorage caveat absent on (eventual) i18n doc page

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-027.md`

---

## DOC-GAP-028 — Activity Feed counts endpoint (`/api/activity/counts`) issues 4 parallel aggregation queries per call

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-028.md`

---

## DOC-GAP-031 — `lasEventId` typo on Java controller signature persists into generated client SDKs

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-031.md`

---

## DOC-GAP-044 — Activity-feed partition advisory-lock-id has no doc + no per-feature collision matrix in the housekeeping page

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-044.md`

---

## DOC-GAP-063 — `housekeeping.cron` has 2 fewer config-tunable retention switches than its conceptual scope suggests (collector_partition + statistics-table not retained-via-cron) — undocumented gap

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-063.md`

---

## DOC-GAP-067 — `@Data`-generated `toString()` is the DURABLE secret-leak surface — Lombok auto-generates a getter-driven `toString()` on every `@ConfigurationProperties` POJO; logging a `properties` object writes ALL fields to logs verbatim

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-067.md`

---

## DOC-GAP-069 — `ODD_IAM` provider is completely absent from docs — `Provider` enum at `ODDOAuth2Properties.OAuth2Provider:24` exists with `ODD_IAM` value; ODD-IAM is the platform's own OIDC provider but no doc page mentions its existence

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-069.md`

---

## DOC-GAP-070 — `ODDOAuth2Properties.OAuth2Provider.adminUserInfoFlag` field is undocumented — operator deploying OAuth2 with admin-claim wiring cannot find the config key in any page

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-070.md`

---

## DOC-GAP-088 — `IngestionDataEntitiesFilter.isValid` is silent-noop on validation failures — collector pushes invalid `DataEntityList`, gets HTTP 401, retries forever; no log; no metric

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-088.md`

---

## DOC-GAP-111 — Ownership is HARD-DELETE at the SQL layer — no `deleted_at` column on the `ownership` table; recovery depends on the activity-feed audit trail being intact; the irreversibility is not surfaced on the operator-facing pages

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-111.md`

---

## DOC-GAP-126 — Backwards-Incompatible Schema (BIS) detection is silent on the consumer-collector authoring side — collectors emit a `DatasetSchema` per ingestion; the BIS diff is platform-internal; collector authors cannot author a "no, this isn't a BIS, suppress this" hint anywhere

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-126.md`

---

## DOC-GAP-127 — Alert reopen race: open-reopened-in-flight-resolved is a 3-state machine; the spec models only 2 states (OPEN, RESOLVED); the third state (RESOLVED_AUTOMATICALLY) and the per-state-transition matrix are undocumented anywhere

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-127.md`

---

## DOC-GAP-133 — Microservices lineage and data-entity lineage share the same React canvas component (`LineageGraph.tsx`); no toggle, no entity-class-specific rendering

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-133.md`

---

## DOC-GAP-135 — Shift+Enter save shortcut on description edit is keyboard-shortcut convention but undocumented at the page level

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-135.md`

---

## DOC-GAP-138 — `dataEntityId` URL parameter on `/dataentities/{id}` is unguarded against NaN / invalid numeric values; operator entering `/dataentities/foo` hits a UI route with `Number('foo')` → NaN; the screen displays partial state

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-138.md`

---

## DOC-GAP-148 — Per-job transaction-handling asymmetry across the 5 HousekeepingJob beans — `AlertHousekeepingJob` and `DataEntityHousekeepingJob` wrap in `DSL.transaction(...)`; `SearchFacetsHousekeepingJob` runs in auto-commit on the shared connection

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-148.md`

---
