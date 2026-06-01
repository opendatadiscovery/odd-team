# Alignment scorecard — odd-platform

_generated 2026-06-01 · `lineage-extractor alignment odd-platform` · deterministic roll-up, no LLM_

## Contract-test readiness: ⛔ NOT-READY

**Blockers:**
- [D] Phase-4 Test layer unbuilt (0 Test nodes / 0 enforces+validates edges)
- [E] reflection 1/112 → alignment unverified at scale
- [C] 26 published ADRs not ingested

**Ready-now subset** (contract-testable today — reflected + bridged): F-021

## Trust gate

> Is this scorecard itself trustworthy? Every alignment metric below is discounted by reflection coverage.

- `GREEN` substrate scan == code HEAD — scan ede5d277 @ 2026-05-26 · HEAD ede5d277 @ 2026-04-03
- `AMBER` graph embeddings present — built 2026-05-30 · vectors 0 — semantic queries degraded; rebuild without --no-embeddings
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

- `RED` **published ADRs ingested as nodes** — 1/27 · 1 ADR nodes vs 27 published pages — re-run adrs-ingest + graph-build
- `RED` **ADRs with a REALISES code link** — 1/27 · 1 of 1 ingested have REALISES; effective 1/27 vs published
- `AMBER` **ImplicitADR candidates (disposition)** — 223 · 223 candidates · 1 promoted (1:1 promotion NOT required — wisdom test governs)

### D — Test-Traceability Ledger  (RED)

- `AMBER` **TestGaps carrying a typed gate (why)** — 456/1038 · 582 orphan gaps have no gate keyword+target (each is a finding); lenient match — a strict typed `gates:` block is the target schema
- `RED` **ADRs with an enforcing test/gap** — 0/27 · are we checking ADR ALIGNMENT? 0/27 ADRs gated (enforces→ADR)
- `AMBER` **features with a validating test/gap** — 23/112 · are we checking FUNCTIONALITY? 23/112 features gated (validates→Feature)
- `AMBER` **bugs/scopes with a regress/guard test** — 41/1355 · are we checking REGRESSION? 41/1355 findings/scopes gated · LSN-001/002 landmines captured as gated TestGaps (24) but NO test yet (Test layer unbuilt)
- `RED` **probes executed / defined** — 9/148 · 9/148 run · 1 probe-stack(s) · named-integration keyword hits 1/4 (great-expectations, ✗airflow-lineage, ✗postgres-ingestion, ✗webhook-notifications) — KEYWORD scan, NOT verified e2e

## Top actionable items

1. Build Phase-4 Test layer (Test node + enforces/validates/regresses/guards) — unblocks dimension D entirely
2. Convert the landmine gated-gaps to tests FIRST (TEST-GAP-024, TEST-GAP-047, TEST-GAP-049, TEST-GAP-051, TEST-GAP-052…) — LSN-001/002 regression pins [CRITICAL]
3. Re-run adrs-ingest + graph-build — 26 published ADRs are not yet graph nodes (unblocks C2 enforcement)
4. Raise reflection coverage on ADR-bearing features (1/112) — the layer that proves alignment
5. GE / Airflow / Postgres-ingestion / webhooks have no dedicated probe stack (only odd-minimal: postgres+platform) → add multi-service stacks + regresses/validates-gated TestGaps
6. Backfill typed gates on 582 orphan TestGaps (the test-coverage-mapper should emit a `gates:` block)
7. Rebuild graph WITH embeddings (currently off) — restores semantic retrieval for /retrieve + deep mode

---
_Machine metrics + trend: `alignment-scorecard.yaml`. Deep contract audit (sampled, agentic): `lineage-extractor alignment odd-platform --deep` (phase 2)._
