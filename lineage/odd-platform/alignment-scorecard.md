# Alignment scorecard — odd-platform

_generated 2026-06-26 · `lineage-extractor alignment odd-platform` · deterministic roll-up, no LLM_

## Contract-test readiness: 🟡 PILOT-READY

**Ready-now subset** (contract-testable today — reflected + bridged): F-001, F-003, F-004, F-005, F-006, F-007, F-008, F-009, F-010, F-011, F-012, F-013, F-014, F-015, F-016, F-017, F-018, F-019, F-020, F-021, F-022, F-024, F-025, F-026, F-027, F-028, F-029, F-030, F-031, F-032, F-033, F-034, F-035, F-036, F-037, F-038, F-039, F-040, F-041, F-042, F-043, F-044, F-045, F-046, F-054, F-055, F-057, F-058, F-059, F-064, F-065, F-074, F-075, F-076, F-084, F-085, F-086, F-087, F-088, F-089, F-090, F-094, F-095, F-096, F-097, F-098, F-104, F-105, F-119, F-120, F-121, F-122, F-123, F-124, F-125, F-126, F-131, F-132, F-141, F-142, F-146, F-147, F-148, F-151, F-152, F-153, F-154, F-155, F-156, F-161, F-162, F-163, F-171, F-172, F-173, F-174, F-176, F-177, F-178, F-179, F-186, F-191, F-192, F-196, F-197, F-198, F-206, F-207, F-208

## Trust gate

> Is this scorecard itself trustworthy? Every alignment metric below is discounted by reflection coverage.

- `GREEN` substrate scan == code HEAD — scan f12b8fbc @ 2026-06-26 · HEAD f12b8fbc @ 2026-06-25
- `AMBER` graph embeddings present — built ? · vectors 0 — semantic queries degraded; rebuild without --no-embeddings
- `AMBER` latest /panel verdict — changes-needed
- `GREEN` reflection coverage (alignment discount) — 110/112 features reflected → alignment UNKNOWN over 2% of features
- `AMBER` intent↔impl contradictions surfaced — 555 contradictions across 110 reflected features — the deepest alignment-drift findings; triage feature-reflections/detail/ (HIGH → bug-fix or operator caveat)

## Dimensions

| Dim | Grade | Title |
|---|---|---|
| A | AMBER | Ontology ↔ Code fidelity |
| B | RED | Ontology ↔ Doc (bi-directional) |
| C | RED | Ontology ↔ ADR |
| D | RED | Test-Traceability Ledger |

### A — Ontology ↔ Code fidelity  (AMBER)

- `AMBER` **code nodes enriched (selective)** — 209/3724 · 209/3724 nodes have a sidecar — enrichment is entry-point-selective, not a defect on its own
- `AMBER` **sidecar axis ∈ substrate axes** — 148/212 · 24 informal axis labels not declared in substrate (e.g. auth-handlers, auth_handlers, auth_logout_handlers, components)

### B — Ontology ↔ Doc (bi-directional)  (RED)

- `GREEN` **doc claims resolving to real code (fwd)** — 269/325 · DESCRIBES→CodeNode landing on a real (non-stub) node — 'if docs claim it, code exists'
- `AMBER` **features documented (reverse)** — 83/112 · features with an inbound DESCRIBES — 'if implemented, it is documented'
- `RED` **open doc gaps (lower better)** — 313 · 313 open DocGap (135 critical/high)
- `AMBER` **doc nodes not drifted** — 1143/1178 · 35 drifted · SUMMARY completeness=complete

### C — Ontology ↔ ADR  (RED)

- `GREEN` **published ADRs ingested as nodes** — 29/30 · 29 ADR nodes vs 30 published pages — re-run adrs-ingest + graph-build
- `RED` **ADRs with a REALISES code link** — 1/30 · 1 of 29 ingested have REALISES; effective 1/30 vs published; join broken: 75/76 backlog realises entries are prose citations not substrate node-ids → not projected as edges
- `AMBER` **ImplicitADR candidates (disposition)** — 223 · 223 candidates · 21 promoted (1:1 promotion NOT required — wisdom test governs)

### D — Test-Traceability Ledger  (RED)

- `GREEN` **Test nodes ingested (+ COVERS to code)** — 4/157 · 157 existing tests ingested · 4 COVERS edges resolved to substrate code
- `GREEN` **known-bug pins (characterization tripwires)** — 12 · GREEN while the documented bug exists, RED the instant behaviour changes (unplanned fix or deeper regression) — never a dead @Disabled; navigate via status=pins-known-bug. odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/auth/SecurityRulesAuthzGapsKnownBugsTest.java::SecurityRulesAuthzGapsKnownBugsTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/auth/filter/S2sPrincipalKnownBugTest.java::S2sPrincipalKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/config/MinioConfigRegionTest.java::MinioConfigRegionTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/config/NotificationFailSoftContractTest.java::NotificationFailSoftContractTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/datacollaboration/DataCollabEventDedupKnownBugTest.java::DataCollabEventDedupKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/housekeeping/HousekeepingTtlKnownBugsTest.java::HousekeepingTtlKnownBugsTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/DataEntityStatusKnownBugTest.java::DataEntityStatusKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ActivityActorFilterKnownBugTest.java::ActivityActorFilterKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/CollectorTokenStorageKnownBugTest.java::CollectorTokenStorageKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/OwnerRoleStripKnownBugTest.java::OwnerRoleStripKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/TokenEntropyKnownBugTest.java::TokenEntropyKnownBugTest; odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/attachment/AttachmentLinkSchemeKnownBugTest.java::AttachmentLinkSchemeKnownBugTest (LSN-029)
- `AMBER` **tests/gaps carrying a typed gate (why)** — 616/1204 · 0/157 EXISTING tests are ORPHAN (no typed gate → add @enforces/@validates/@regresses); 588/1047 gaps orphan (lenient match)
- `AMBER` **ADRs with an enforcing test/gap** — 26/30 · are we checking ADR ALIGNMENT? 26/30 ADRs gated (26 via real ENFORCES edge, rest via gated gaps)
- `AMBER` **features with a validating test/gap** — 49/112 · are we checking FUNCTIONALITY? 49/112 features gated (42 via real VALIDATES edge)
- `AMBER` **bugs/scopes with a regress/guard test** — 41/1361 · are we checking REGRESSION? 41/1361 findings/scopes gated · LSN-001/002 landmines captured as 24 gated TestGaps but NO regression test authored yet
- `RED` **probes executed / defined** — 9/192 · 9/192 run · 8 probe-stack(s) · named-integration keyword hits 2/4 (great-expectations, ✗airflow-lineage, ✗postgres-ingestion, webhook-notifications) — KEYWORD scan, NOT verified e2e

## Top actionable items

1. Author the landmine regression tests WITH @regresses gates (TEST-GAP-024, TEST-GAP-047, TEST-GAP-049, TEST-GAP-051, TEST-GAP-052…) — LSN-001/002 pins, project as REGRESSES edges [CRITICAL]
2. Re-run adrs-ingest + graph-build — 1 published ADRs are not yet graph nodes (unblocks C2 enforcement)
3. Backfill typed gates on 588 orphan TestGaps (the test-coverage-mapper should emit a `gates:` block)
4. Rebuild graph WITH embeddings (currently off) — restores semantic retrieval for /retrieve + deep mode

---
_Machine metrics + trend: `alignment-scorecard.yaml`. Deep contract audit (sampled, agentic): `lineage-extractor alignment odd-platform --deep` (phase 2)._
