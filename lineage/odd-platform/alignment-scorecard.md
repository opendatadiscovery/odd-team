# Alignment scorecard — odd-platform

_generated 2026-06-01 · `lineage-extractor alignment odd-platform` · deterministic roll-up, no LLM_

## Contract-test readiness: 🟡 PILOT-READY

**Blockers:**
- [D] Test layer built (66 nodes) but every test is ORPHAN + 0 ADRs enforced — gates not yet authored
- [E] reflection 1/112 → alignment unverified at scale

**Ready-now subset** (contract-testable today — reflected + bridged): F-021

## Trust gate

> Is this scorecard itself trustworthy? Every alignment metric below is discounted by reflection coverage.

- `GREEN` substrate scan == code HEAD — scan ede5d277 @ 2026-05-26 · HEAD ede5d277 @ 2026-04-03
- `GREEN` graph embeddings present — built 2026-06-01 · vectors 7555
- `AMBER` latest /panel verdict — changes-needed
- `RED` reflection coverage (alignment discount) — 1/112 features reflected → alignment UNKNOWN over 99% of features

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

- `AMBER` **Test nodes ingested (+ COVERS to code)** — 0/66 · 66 existing tests ingested · 0 COVERS edges resolved to substrate code — 0 resolve: substrate is axis-selective (services/repos aren't code nodes) and test names don't all map to a descriptor
- `AMBER` **tests/gaps carrying a typed gate (why)** — 456/1104 · 66/66 EXISTING tests are ORPHAN (no typed gate → add @enforces/@validates/@regresses); 582/1038 gaps orphan (lenient match)
- `RED` **ADRs with an enforcing test/gap** — 0/27 · are we checking ADR ALIGNMENT? 0/27 ADRs gated (0 via real ENFORCES edge, rest via gated gaps)
- `AMBER` **features with a validating test/gap** — 23/112 · are we checking FUNCTIONALITY? 23/112 features gated (0 via real VALIDATES edge)
- `AMBER` **bugs/scopes with a regress/guard test** — 41/1355 · are we checking REGRESSION? 41/1355 findings/scopes gated · LSN-001/002 landmines captured as 24 gated TestGaps but NO regression test authored yet
- `RED` **probes executed / defined** — 9/148 · 9/148 run · 1 probe-stack(s) · named-integration keyword hits 1/4 (great-expectations, ✗airflow-lineage, ✗postgres-ingestion, ✗webhook-notifications) — KEYWORD scan, NOT verified e2e

## Top actionable items

1. Annotate the 66/66 ORPHAN existing tests with @enforces/@validates/@regresses gates — the Test layer is built but no test is yet wired to a decision/feature/bug
2. Author the landmine regression tests WITH @regresses gates (TEST-GAP-024, TEST-GAP-047, TEST-GAP-049, TEST-GAP-051, TEST-GAP-052…) — LSN-001/002 pins, project as REGRESSES edges [CRITICAL]
3. Raise reflection coverage on ADR-bearing features (1/112) — the layer that proves alignment
4. GE / Airflow / Postgres-ingestion / webhooks have no dedicated probe stack (only odd-minimal: postgres+platform) → add multi-service stacks + regresses/validates-gated TestGaps
5. Backfill typed gates on 582 orphan TestGaps (the test-coverage-mapper should emit a `gates:` block)

---
_Machine metrics + trend: `alignment-scorecard.yaml`. Deep contract audit (sampled, agentic): `lineage-extractor alignment odd-platform --deep` (phase 2)._
