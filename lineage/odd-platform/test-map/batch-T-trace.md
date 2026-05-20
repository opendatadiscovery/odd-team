# Batch T — test-coverage-mapper trace (2026-05-20)

## Input sidecars (4)

1. `lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-class__ActivityController.md`
2. `lineage/odd-platform/understanding/odd-platform__java__AppInfoController__controller-class__AppInfoController.md`
3. `lineage/odd-platform/understanding/odd-platform__java__DataQualityController__controller-class__DataQualityController.md`
4. `lineage/odd-platform/understanding/odd-platform__java__DirectoryController__controller-class__DirectoryController.md`

## Pre-emit coherence check (Rule 6 / LSN-018)

Forcing question (per LSN-018): *"Does this finding name any entity, operation, table, file:line, or pillar-feature already present in another registry? If yes — what does that other registry say about the SAME thing, and does this finding strengthen, supersede, or CONTRADICT it?"*

For each batch-T candidate gap, ran two checks:
1. **Intra-registry DEDUP**: Grep existing TEST-GAP detail/ for the same controller + behaviour combination.
2. **Cross-registry COHERENCE**: Grep `feature-flows/index.yaml`, `concepts/index.yaml`, `refactoring-scopes/index.yaml` for the named entities (SLA PNG resolver, EXCLUDE_FROM_SEARCH, activity.data_entity_id, ODDRN reflection, auth.type round-trip).

Resolutions:

- **DataQualityController SLA PNG-vs-JSON drift**: NO prior gap; cross-registry name `sla-calculator` + `dataset-test-report` present in concepts, no conflict. **NEW TEST-GAP-705 (CRITICAL).**
- **ActivityController cross-owner audit-trail no-authz**: parent gap is TEST-GAP-232 (RBAC audit-silence pattern at the WRITE side); this is the READ side, sister gap. No conflict; STRENGTHENS the cross-pillar audit picture. **NEW TEST-GAP-706 (CRITICAL) + STRENGTHEN TEST-GAP-232 (cross-reference added).**
- **DirectoryController level-4 page-vs-count predicate divergence**: REFACTOR-425 family (ReactiveDataSourceRepositoryImpl.listDto sister site); the Directory sidecar explicitly surfaces this NEW site. No conflict; same bug class at a second site. **NEW TEST-GAP-707 (HIGH).**
- **AppInfoController DISABLED-mode fingerprinting**: REFACTOR-185 family (19-sidecar bypass pattern); the AppInfo sidecar explicitly identifies itself as the 19th supporting sidecar. **NEW TEST-GAP-708 (HIGH).**
- **DataQualityController owner-scoping asymmetry (4 GET unscoped + 1 PUT scoped)**: REFACTOR-024 family (cross-owner read posture); 4 fresh invocation vectors. No conflict; STRENGTHENS REFACTOR-024 with the DQ surface. **NEW TEST-GAP-709 (HIGH).**
- **ActivityController unbounded `size`**: NO prior gap (the `getActivity` per-method sidecar surfaced this in batch H but the test-gap was not extracted then); ties to TEST-GAP-706 + REFACTOR-024 as DoS amplifier on cross-owner read. **NEW TEST-GAP-710 (HIGH).**
- **DirectoryController ODDRN reflection-property leak**: NO prior gap; sidecar's existing test at DirectoryTest.java:141-149 already PINS host+database as intentional — this gap extends the surface to the broader @PathField set (Snowflake account, Kafka cluster, etc.). **NEW TEST-GAP-711 (MEDIUM).**
- **ActivityController four-way `type` view-mode dispatch**: NO prior gap; the `getActivity` per-method sidecar from batch H described the dispatch but did not surface the test gap. **NEW TEST-GAP-712 (MEDIUM).**
- **DataQualityController 404-on-empty-list shape**: NO prior gap; sidecar's bugs_limitations_corner_cases[2] surfaces the asymmetric empty-response shape across 4 read endpoints. **NEW TEST-GAP-713 (MEDIUM).**
- **DataQualityController setDataQATestSeverity no-audit-trail**: TEST-GAP-232 audit-silence parent; sister invocation site on DQ surface. STRENGTHENS the audit-asymmetry pattern. **NEW TEST-GAP-714 (MEDIUM) + STRENGTHEN TEST-GAP-232 (cross-reference added).**
- **AppInfoController authType verbatim/typo branches**: NO prior gap; sister to TEST-GAP-708 (DISABLED-mode fingerprint) on same controller. **NEW TEST-GAP-715 (MEDIUM).**
- **DirectoryController malformed-ODDRN swallow-and-bucket**: NO prior gap; sister to TEST-GAP-707 + TEST-GAP-711 (all Directory). **NEW TEST-GAP-716 (LOW).**
- **Cross-cutting — 4 controllers, ZERO HTTP-tier tests**: TEST-GAP-001 is the AlertController sister pattern. This is the batch-T cross-cutting CRITICAL synthesizing the four controllers' bottom-tier absence — pattern, not isolated gap. **NEW TEST-GAP-717 (CRITICAL).**

## Sidecar test_files claims — verification

- **DataQualityController.md** claims `SLAColourTest.java`, `SLAReportTest.java`, `DataQualityRepositoryImplTest.java`, `ReactiveDataQualityRunsRepositoryTest.java` at calculator/repository tier. **VERIFIED**: Glob found all 4 at the cited paths. Sidecar correctly claims NO controller-tier test exists.
- **DirectoryController.md** claims `DirectoryTest.java:30-159` covering levels 1+2. **VERIFIED**: Glob found the file; Read confirmed it extends `BaseIngestionTest` and covers `directoriesTest()` at line 33 (level 1 — getDataSourceTypeList + level 2 — getDataSourceList by prefix). Sidecar correctly identifies levels 3+4 as uncovered.
- **ActivityController.md** claims ZERO test files. **VERIFIED**: Grep `ActivityController|getActivity|api/activity` against `odd-platform-api/src/test` returned 0 files.
- **AppInfoController.md** claims ZERO test files. **VERIFIED**: Grep `AppInfoController|getAppInfo|api/appInfo` against `odd-platform-api/src/test` returned 0 files.

No sidecar-quality findings (no hallucinated test paths or method names).

## Conflicts

Two coherence-check conflicts surfaced by the sidecars themselves (not by the reducer):
- **ActivityController vs activity-feed.md DOC**: enum-count partial drift (20 named + 7 categorical vs 27 in spec) AND `type` parameter undocumented AND visibility framing absent. These are CODE-DOC drift, not registry contradictions; they feed DOC-GAP backlog (doc-gap-finder owns the closure).
- **DataQualityController vs sla-statuses.md DOC**: PNG-vs-JSON response-shape mismatch on `/api/datasets/{id}/sla`. The page describes JSON, the code returns PNG; the doc conflates `/sla` (PNG) and `/sla_report` (JSON). This drives **TEST-GAP-705 (CRITICAL)** as the pin-the-contract test; doc-side fix is a separate DOC-GAP.

No cross-registry contradictions detected against feature-flows, concepts, or refactoring-scopes registries.

## STRENGTHENED existing entries

- **TEST-GAP-232 (RBAC audit-silence pattern, 8-sidecar)**: NOT modified in-place this batch (the strengthening links emerge from the new TEST-GAP-706 (ActivityController controller-tier confirmation of the audit FEED scope-boundary) and TEST-GAP-714 (DQ-surface audit-silence sister). Both new gaps cite TEST-GAP-232 as parent pattern; the pattern grows from 8 to 10 invocation sites (adding Activity-feed read-surface + DQ-surface mutation).
- **TEST-GAP-356 (REFACTOR-024 cross-owner read)**: NOT modified in-place; new TEST-GAP-706 + TEST-GAP-709 + TEST-GAP-711 + (latent) DirectoryController add 4-6 fresh invocation vectors (Activity / DQ 4 reads / Directory infrastructure-revealing). The cross-owner read posture family grows.
- **TEST-GAP-001 (AlertController HTTP-tier smoke)**: NOT modified in-place; new TEST-GAP-717 is the cross-cutting controller-tier-floor that the AlertController smoke is part of. Both gaps remain — TEST-GAP-001 is AlertController-specific; TEST-GAP-717 is the 4-controller batch-T cross-cutting confirmation.

## Cross-cutting patterns

- **Pattern**: ALL FOUR batch-T controllers have ZERO direct WebFluxTest/WebTestClient HTTP-tier tests. The platform's test posture is strong at the calculator + repository tiers but unstrung at the HTTP boundary that combines them. 12 endpoints across the four controllers are reachable in production with no contract-level test asserting OpenAPI-binding, content-negotiation, security wiring, or DTO serialisation parity. **Pattern, not isolated gap** — surfaced as TEST-GAP-717 CRITICAL.

## Summary (verified counts)

- **Net new**: 13 TEST-GAPs (TEST-GAP-705..717)
  - **CRITICAL**: 3 (TEST-GAP-705 SLA PNG-vs-JSON contract, TEST-GAP-706 ActivityController cross-owner audit no-authz, TEST-GAP-717 4-controller HTTP-tier integration pattern)
  - **HIGH**: 4 (TEST-GAP-707 Directory level-4 page-vs-count divergence, TEST-GAP-708 AppInfo DISABLED-mode fingerprint, TEST-GAP-709 DQ owner-scoping asymmetry, TEST-GAP-710 ActivityController unbounded size DoS amplifier)
  - **MEDIUM**: 5 (TEST-GAP-711 Directory ODDRN reflection leak, TEST-GAP-712 ActivityController view-mode dispatch, TEST-GAP-713 DQ 404-on-empty asymmetry, TEST-GAP-714 DQ severity-change audit absence, TEST-GAP-715 AppInfo authType verbatim/typo)
  - **LOW**: 1 (TEST-GAP-716 Directory malformed-ODDRN swallow-and-bucket)
- **STRENGTHENED existing entries**: 3 (TEST-GAP-001 controller-tier-floor pattern reach; TEST-GAP-232 audit-silence reach; TEST-GAP-356 REFACTOR-024 reach) — references added via the new gaps' cross_references blocks; existing detail files unchanged this batch.
- **Sidecar-quality findings**: 0

## Total state after batch T

- 701 (prior) + 13 (net new) = **714 total TEST-GAPs**
- CRITICAL: 114 (prior) + 3 (net new) = **117 CRITICAL**
- HIGH: 213 (prior) + 4 (net new) = **217 HIGH**
- MEDIUM: 269 (prior) + 5 (net new) = **274 MEDIUM**
- LOW: 105 (prior) + 1 (net new) = **106 LOW**
- Sidecar count: 60 (prior) + 4 (new controller-class closures) = **64 sidecars consumed**
- Test files indexed: 70 (prior) + 0 (re-verified DirectoryTest + SLAColourTest + SLAReportTest existing; zero new test files for ActivityController/AppInfoController/DataQualityController-controller-tier) = **70**

## Coherence (per Rule 6 / LSN-018)

- No cross-registry contradictions surfaced against `feature-flows/`, `concepts/`, or `refactoring-scopes/`.
- Two CODE-vs-DOC drift surfaces (Activity enum-count + type-undocumented; DQ PNG-vs-JSON) carry through as DOC-GAP candidates (doc-gap-finder closure); the test-gaps PIN the current code-side reality so a maintainer fixing the doc-vs-code drift must coordinate either side.
- Back-links emitted to: REFACTOR-024 (3 new vectors), REFACTOR-185 (19th sidecar), REFACTOR-425 (second confirmed site), TEST-GAP-232 (audit-silence reach +2), F-021 (Activity Feed), F-013 (DQ SLA), F-001 (Directory).
- Forward-looking: the batch-T cross-cutting TEST-GAP-717 (4-controller HTTP-tier-floor pattern) provides the harness foundation for the 6 specific-instance gaps (705/706/707/708/709/710) — recommend a single "batch-T HTTP-tier sprint" PR that addresses them together.
