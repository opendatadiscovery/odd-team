# Alignment scorecard — odd-platform

_generated 2026-06-01 · `lineage-extractor alignment odd-platform` · deterministic roll-up, no LLM_

## Contract-test readiness: 🟡 PILOT-READY

**Blockers:**
- [E] reflection 6/112 → alignment unverified at scale
- [A] substrate scan behind code HEAD

**Ready-now subset** (contract-testable today — reflected + bridged): F-006, F-009, F-021, F-022, F-027, F-039

## Trust gate

> Is this scorecard itself trustworthy? Every alignment metric below is discounted by reflection coverage.

- `RED` substrate scan == code HEAD — scan ede5d277 @ 2026-05-26 · HEAD b5ae7a00 @ 2026-06-01
- `GREEN` graph embeddings present — built 2026-06-01 · vectors 7623
- `AMBER` latest /panel verdict — changes-needed
- `RED` reflection coverage (alignment discount) — 6/112 features reflected → alignment UNKNOWN over 95% of features
- `AMBER` intent↔impl contradictions surfaced — 51 contradictions across 6 reflected features — the deepest alignment-drift findings; triage feature-reflections/detail/ (HIGH → bug-fix or operator caveat)

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

- `AMBER` **Test nodes ingested (+ COVERS to code)** — 0/68 · 68 existing tests ingested · 0 COVERS edges resolved to substrate code — 0 resolve: substrate is axis-selective (services/repos aren't code nodes) and test names don't all map to a descriptor
- `AMBER` **tests/gaps carrying a typed gate (why)** — 458/1106 · 66/68 EXISTING tests are ORPHAN (no typed gate → add @enforces/@validates/@regresses); 582/1038 gaps orphan (lenient match)
- `AMBER` **ADRs with an enforcing test/gap** — 1/27 · are we checking ADR ALIGNMENT? 1/27 ADRs gated (1 via real ENFORCES edge, rest via gated gaps)
- `AMBER` **features with a validating test/gap** — 23/112 · are we checking FUNCTIONALITY? 23/112 features gated (0 via real VALIDATES edge)
- `AMBER` **bugs/scopes with a regress/guard test** — 41/1355 · are we checking REGRESSION? 41/1355 findings/scopes gated · LSN-001/002 landmines captured as 24 gated TestGaps but NO regression test authored yet
- `RED` **probes executed / defined** — 9/162 · 9/162 run · 1 probe-stack(s) · named-integration keyword hits 2/4 (great-expectations, ✗airflow-lineage, ✗postgres-ingestion, webhook-notifications) — KEYWORD scan, NOT verified e2e

## Top actionable items

1. Annotate the 66/68 ORPHAN existing tests with @enforces/@validates/@regresses gates — the Test layer is built but no test is yet wired to a decision/feature/bug
2. Author the landmine regression tests WITH @regresses gates (TEST-GAP-024, TEST-GAP-047, TEST-GAP-049, TEST-GAP-051, TEST-GAP-052…) — LSN-001/002 pins, project as REGRESSES edges [CRITICAL]
3. Raise reflection coverage on ADR-bearing features (6/112) — the layer that proves alignment
4. GE / Airflow / Postgres-ingestion / webhooks have no dedicated probe stack (only odd-minimal: postgres+platform) → add multi-service stacks + regresses/validates-gated TestGaps
5. Backfill typed gates on 582 orphan TestGaps (the test-coverage-mapper should emit a `gates:` block)

---
_Machine metrics + trend: `alignment-scorecard.yaml`. Deep contract audit (sampled, agentic): `lineage-extractor alignment odd-platform --deep` (phase 2)._
