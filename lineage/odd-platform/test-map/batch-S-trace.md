# Batch S — test-coverage-mapper trace (2026-05-20)

## Input sidecars (5)

1. `lineage/odd-platform/understanding/odd-platform__java__service__service__OwnerServiceImpl.md`
2. `lineage/odd-platform/understanding/odd-platform__java__service__service__PolicyServiceImpl.md`
3. `lineage/odd-platform/understanding/odd-platform__java__service__service__RoleServiceImpl.md`
4. `lineage/odd-platform/understanding/odd-platform__java__service__service__DataSourceIngestionServiceImpl.md`
5. `lineage/odd-platform/understanding/odd-platform__java__service__service__AlertServiceImpl.md`

## Pre-emit coherence check (Rule 6 / LSN-018)

For each new test-gap, scanned existing test-map index for shared anchors and named entities:

- `OwnerServiceImpl` destructive-empty-roles: existing TEST-GAP-622 covers controller-tier surface. **Decision**: NEW TEST-GAP-680 (service-tier algorithm-pin sister) + STRENGTHEN TEST-GAP-622.
- `OwnerServiceImpl` cascade-block leg independence: NO prior gap; existing TEST-GAP-627 covers race-window only. **Decision**: NEW TEST-GAP-681.
- `OwnerServiceImpl` create-no-FTS-refresh asymmetry: existing TEST-GAP-625 covers update-yes/delete-no axis. **Decision**: NEW TEST-GAP-682 (the third axis).
- `OwnerServiceImpl` getOrCreate permission-bypass: documented in concepts catalog but no test-gap. **Decision**: NEW TEST-GAP-683.
- `OwnerServiceImpl` transactional rollback: NO prior gap. **Decision**: NEW TEST-GAP-684.
- `PolicyServiceImpl + RoleServiceImpl` @ReactiveTransactional asymmetry: NO prior gap. **Decision**: NEW TEST-GAP-685.
- `PolicyServiceImpl + RoleServiceImpl` AUTHORIZATION HOT PATH no-cache: NO prior gap. **Decision**: NEW TEST-GAP-686.
- `PolicyServiceImpl` getPolicyDetails no role-scoping: NO prior gap. **Decision**: NEW TEST-GAP-687.
- `PolicyServiceImpl` schema-validation HTTP 500 mapping: NO prior gap. **Decision**: NEW TEST-GAP-688.
- `RoleServiceImpl` Administrator/User create-side asymmetry: STRENGTHEN target TEST-GAP-220 (Role parallel) cited by existing TEST-GAP-231; **NEW** TEST-GAP-689 as the Role-side primary-source pin.
- `RoleServiceImpl` case-sensitivity 3-policy mismatch: NO prior gap. **Decision**: NEW TEST-GAP-690.
- `AlertServiceImpl` handleExternalAlerts no idempotency: existing TEST-GAP-015 covers cross-tenant attribution; sister gap. **Decision**: NEW TEST-GAP-691 + STRENGTHEN TEST-GAP-015.
- `AlertServiceImpl` updateStatus anonymous-fallback: NO prior gap. **Decision**: NEW TEST-GAP-692.
- `AlertServiceImpl` generatorURL XSS: NO prior gap. **Decision**: NEW TEST-GAP-693.
- `AlertServiceImpl` startsAt timezone-strip: NO prior gap. **Decision**: NEW TEST-GAP-694.
- `AlertServiceImpl` getTotals.zipDelayError partial-failure: NO prior gap. **Decision**: NEW TEST-GAP-695.
- `AlertServiceImpl` @ActivityLog AOP profile gap: NO prior gap. **Decision**: NEW TEST-GAP-696.
- `DataSourceIngestionServiceImpl` namespace inheritance: NO prior gap. **Decision**: NEW TEST-GAP-697.
- `DataSourceIngestionServiceImpl` partial-merge / cross-collector ownership: NO prior gap. **Decision**: NEW TEST-GAP-698.
- `DataSourceIngestionServiceImpl` @ReactiveTransactional rollback: NO prior gap. **Decision**: NEW TEST-GAP-699.
- `DataSourceIngestionServiceImpl` defense-in-depth ODDRN validation: NO prior gap. **Decision**: NEW TEST-GAP-700.
- `DataSourceIngestionServiceImpl` FTS absence: NO prior gap. **Decision**: NEW TEST-GAP-701.
- `OwnerServiceImpl` visibility asymmetry service-tier: existing TEST-GAP-628 covers controller-tier. **Decision**: NEW TEST-GAP-702 (service-tier explicit pin) + STRENGTHEN TEST-GAP-628.
- `PolicyServiceImpl` no anti-elevation guard: NO prior gap. **Decision**: NEW TEST-GAP-703.
- `RoleServiceImpl` empty-roles vacuous-noneMatch invariant: NO prior gap. **Decision**: NEW TEST-GAP-704.

## Sidecar test_files claims — verification

- `DataSourceIngestionServiceImpl.md` claims `DataSourceIngestionServiceTest.java:60-93` with method names `createDataSourcesForEmptyCollectorTest`, `createDataSourcesTest`, `dataSourcesProvider`. **VERIFIED**: Glob found the file at the cited path; Grep confirmed all three method names at lines 61, 75, 95.
- `AlertServiceImpl.md` claims `AlertIngestionTest.java:54-577+` with seven `@DisplayName`-tagged methods. **VERIFIED**: Glob found the file at the cited path; Grep confirmed all seven test method names + display names at lines 55-579.
- `OwnerServiceImpl.md`, `PolicyServiceImpl.md`, `RoleServiceImpl.md` claim ZERO tests. **VERIFIED**: Glob for `**/OwnerService*.java`, `**/PolicyServiceImpl*.java`, `**/RoleService*.java` under odd-platform-api/src/test all returned NO FILES.

No sidecar-quality findings (no hallucinated test paths or method names).

## Conflicts

Forcing question (per LSN-018): *"Does this finding name any entity, operation, table, file:line, or pillar-feature already present in another registry? If yes — what does that other registry say about the SAME thing, and does this finding strengthen, supersede, or CONTRADICT it?"*

No contradictions surfaced. All cross-registry matches STRENGTHEN existing claims:

- TEST-GAP-622 (destructive empty-roles) → STRENGTHENED by OwnerServiceImpl service-tier primary-source confirmation of the 3-line cascade.
- TEST-GAP-625 (search-vector update-vs-delete) → batch-S adds the third axis (create-no-refresh) at NEW TEST-GAP-682 — sister gap, not contradiction.
- TEST-GAP-628 (visibility asymmetry) → STRENGTHENED by service-tier primary-source confirmation + NEW TEST-GAP-702 service-tier explicit pin.
- TEST-GAP-007 (reopen-conflict) → STRENGTHENED with implicit_adrs[2] design choice from batch S sidecar (the trade-off is documented as official, not oversight).
- TEST-GAP-015 (cross-tenant attribution) → STRENGTHENED at three tiers (controller + service + repository) → forge-and-display compound fully traced.
- TEST-GAP-231 (Policy Administrator-name create-asymmetry) → STRENGTHENED + paired with NEW TEST-GAP-689 (Role-side primary-source pin) → cross-RBAC asymmetric guard pattern now primary-source-confirmed on BOTH halves.
- TEST-GAP-232 (RBAC audit-silence) → STRENGTHENED to 8-sidecar cross-batch pattern (E + H + I + N + P + Q + R + S) with schema-root-cause from batch R.
- TEST-GAP-356 (REFACTOR-024 SQL cross-owner) → STRENGTHENED with service-tier `listAll` three-line pass-through primary-source.

## Summary (verified counts)

- **Net new**: 25 TEST-GAPs (TEST-GAP-680..704)
  - **CRITICAL**: 2 (TEST-GAP-680 destructive-empty-roles service-tier composition test; TEST-GAP-691 AlertManager webhook idempotency)
  - **HIGH**: 6 (TEST-GAP-685 transactional asymmetry, 686 hot-path no-cache, 689 RoleServiceImpl Admin-name create-asymmetry, 697 namespace inheritance, 698 cross-collector ownership, 703 anti-elevation guard)
  - **MEDIUM**: 12 (TEST-GAP-681, 683, 684, 687, 688, 690, 692, 693, 694, 699, 700, 702)
  - **LOW**: 5 (TEST-GAP-682 create-no-FTS-refresh, 695 getTotals.zipDelayError, 696 @ActivityLog AOP, 701 DataSource FTS absence, 704 empty-roles invariant)
- **STRENGTHENED existing entries**: 7 (TEST-GAP-007, 015, 231, 232, 356, 622, 628)
- **Sidecar-quality findings**: 0

## Total state after batch S

- 677 (prior) + 25 (new) = **702 total TEST-GAPs**
- CRITICAL: 112 (prior) + 2 (net new) = **114 CRITICAL**
- HIGH: 207 (prior) + 6 (net new) = **213 HIGH**
- MEDIUM: 258 (prior) + 12 (net new) = **270 MEDIUM**
- LOW: 100 (prior) + 5 (net new) = **105 LOW**
- Sidecar count: 55 (prior) + 5 (new service-tier closures) = **60 sidecars consumed**
- Test files indexed: 70 (prior) + 0 (re-verified DataSourceIngestionServiceTest + AlertIngestionTest existing) = **70**
