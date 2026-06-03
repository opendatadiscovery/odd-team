# Alignment scorecard — odd-platform

_generated 2026-06-03 · `lineage-extractor alignment odd-platform` · deterministic roll-up, no LLM_

## Contract-test readiness: 🟡 PILOT-READY

**Blockers:**
- [E] reflection 23/112 → alignment unverified at scale
- [A] substrate scan behind code HEAD

**Ready-now subset** (contract-testable today — reflected + bridged): F-001, F-005, F-006, F-007, F-008, F-009, F-010, F-011, F-014, F-017, F-018, F-019, F-020, F-021, F-022, F-024, F-027, F-029, F-031, F-032, F-038, F-039, F-044

## Trust gate

> Is this scorecard itself trustworthy? Every alignment metric below is discounted by reflection coverage.

- `RED` substrate scan == code HEAD — scan ede5d277 @ 2026-05-26 · HEAD a26e47f6 @ 2026-06-03
- `GREEN` graph embeddings present — built 2026-06-03 · vectors 7688
- `AMBER` latest /panel verdict — changes-needed
- `AMBER` reflection coverage (alignment discount) — 23/112 features reflected → alignment UNKNOWN over 79% of features
- `AMBER` intent↔impl contradictions surfaced — 176 contradictions across 23 reflected features — the deepest alignment-drift findings; triage feature-reflections/detail/ (HIGH → bug-fix or operator caveat)

## Dimensions

| Dim | Grade | Title |
|---|---|---|
| A | AMBER | Ontology ↔ Code fidelity |
| B | RED | Ontology ↔ Doc (bi-directional) |
| C | RED | Ontology ↔ ADR |
| D | RED | Test-Traceability Ledger |

### A — Ontology ↔ Code fidelity  (AMBER)

- `AMBER` **code nodes enriched (selective)** — 208/928 · 208/928 nodes have a sidecar — enrichment is entry-point-selective, not a defect on its own
- `AMBER` **sidecar axis ∈ substrate axes** — 147/211 · 24 informal axis labels not declared in substrate (e.g. auth-handlers, auth_handlers, auth_logout_handlers, components)

### B — Ontology ↔ Doc (bi-directional)  (RED)

- `AMBER` **doc claims resolving to real code (fwd)** — 273/324 · DESCRIBES→CodeNode landing on a real (non-stub) node — 'if docs claim it, code exists'
- `AMBER` **features documented (reverse)** — 82/112 · features with an inbound DESCRIBES — 'if implemented, it is documented'
- `RED` **open doc gaps (lower better)** — 313 · 313 open DocGap (135 critical/high)
- `AMBER` **doc nodes not drifted** — 968/971 · 3 drifted · SUMMARY completeness=complete

### C — Ontology ↔ ADR  (RED)

- `GREEN` **published ADRs ingested as nodes** — 27/27 · 27 ADR nodes vs 27 published pages — re-run adrs-ingest + graph-build
- `RED` **ADRs with a REALISES code link** — 1/27 · 1 of 27 ingested have REALISES; effective 1/27 vs published; join broken: 73/74 backlog realises entries are prose citations not substrate node-ids → not projected as edges
- `AMBER` **ImplicitADR candidates (disposition)** — 223 · 223 candidates · 21 promoted (1:1 promotion NOT required — wisdom test governs)

### D — Test-Traceability Ledger  (RED)

- `GREEN` **Test nodes ingested (+ COVERS to code)** — 4/111 · 111 existing tests ingested · 4 COVERS edges resolved to substrate code
- `GREEN` **known-bug pins (characterization tripwires)** — 12 · GREEN while the documented bug exists, RED the instant behaviour changes (unplanned fix or deeper regression) — never a dead @Disabled; navigate via status=pins-known-bug. odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/auth/SecurityRulesAuthzGapsKnownBugsTest.java::SecurityRulesAuthzGapsKnownBugsTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/auth/filter/S2sPrincipalKnownBugTest.java::S2sPrincipalKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/config/MinioConfigRegionTest.java::MinioConfigRegionTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/config/NotificationFailSoftContractTest.java::NotificationFailSoftContractTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/datacollaboration/DataCollabEventDedupKnownBugTest.java::DataCollabEventDedupKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/housekeeping/HousekeepingTtlKnownBugsTest.java::HousekeepingTtlKnownBugsTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/DataEntityStatusKnownBugTest.java::DataEntityStatusKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ActivityActorFilterKnownBugTest.java::ActivityActorFilterKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/CollectorTokenStorageKnownBugTest.java::CollectorTokenStorageKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/OwnerRoleStripKnownBugTest.java::OwnerRoleStripKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/TokenEntropyKnownBugTest.java::TokenEntropyKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/attachment/AttachmentLinkSchemeKnownBugTest.java::AttachmentLinkSchemeKnownBugTest (LSN-029)
- `AMBER` **tests/gaps carrying a typed gate (why)** — 567/1149 · 0/111 EXISTING tests are ORPHAN (no typed gate → add @enforces/@validates/@regresses); 582/1038 gaps orphan (lenient match)
- `AMBER` **ADRs with an enforcing test/gap** — 26/27 · are we checking ADR ALIGNMENT? 26/27 ADRs gated (26 via real ENFORCES edge, rest via gated gaps)
- `AMBER` **features with a validating test/gap** — 41/112 · are we checking FUNCTIONALITY? 41/112 features gated (32 via real VALIDATES edge)
- `AMBER` **bugs/scopes with a regress/guard test** — 41/1355 · are we checking REGRESSION? 41/1355 findings/scopes gated · LSN-001/002 landmines captured as 24 gated TestGaps but NO regression test authored yet
- `RED` **probes executed / defined** — 9/186 · 9/186 run · 6 probe-stack(s) · named-integration keyword hits 2/4 (great-expectations, ✗airflow-lineage, ✗postgres-ingestion, webhook-notifications) — KEYWORD scan, NOT verified e2e

## Top actionable items

1. Author the landmine regression tests WITH @regresses gates (TEST-GAP-024, TEST-GAP-047, TEST-GAP-049, TEST-GAP-051, TEST-GAP-052…) — LSN-001/002 pins, project as REGRESSES edges [CRITICAL]
2. Raise reflection coverage on ADR-bearing features (23/112) — the layer that proves alignment
3. Backfill typed gates on 582 orphan TestGaps (the test-coverage-mapper should emit a `gates:` block)

---
_Machine metrics + trend: `alignment-scorecard.yaml`. Deep contract audit (sampled, agentic): `lineage-extractor alignment odd-platform --deep` (phase 2)._
