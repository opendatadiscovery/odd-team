# ADR (draft): Ingestion-grade e2e stands — integration tests arrange the REAL product pipeline

- Status: draft (maintainer-directed 2026-06-12; first stand shipped same day)
- Deciders: maintainer (directive), odd-team session (design + build)
- Date: 2026-06-12

## Context

Until now every IT-NNN e2e seeded the platform's own PostgreSQL directly (SQL `INSERT INTO
data_entity…` from the spec) and asserted the UI/API over those rows. That verifies the
platform's read path and rendering, but **bypasses the actual product pipeline**: the
collector adapters' mapping, oddrn generation and resolution, the ingestion API, and the
source/target direction semantics — exactly the layers where a data catalog earns or loses
operator trust.

The maintainer built a throwaway rig (odd-platform `docker/relationships-test/`,
2026-06-12) — Neo4j → odd-collector → platform-from-branch — and set the bar:

> "That's the real end-to-end from my point of view: neo4j database → collector → odd
> platform, then we assert what we know is stored in neo4j with what is stored in ODD.
> … if the stand requires not only odd-platform we do it — we do not mock the components,
> we just arrange the integration stand."

## Decision

1. **A new test class: the ingestion-grade stand.** When a feature's semantics depend on
   the collector mapping (relationships, lineage, dataset structure, metadata, stats), its
   integration test arranges the REAL pipeline: real source-system containers + the real
   `ghcr.io/opendatadiscovery/odd-collector` + the platform (SUT image per LSN-033). No
   mocks, no direct platform-DB seeding on that path.
2. **The assertion model is source-truth comparison.** The stand seeds a KNOWN truth into
   the source system (cypher / SQL DDL); assertions state what ODD must show *derived from
   that seed plus the adapter mapping code* (cited file-level in the protocol), never from
   a copy of platform rows. The protocol documents the full stand so a human can rebuild
   and inspect it (e.g. the Neo4j browser port is published).
3. **The collector bootstrap is the real flow.** The spec registers the collector via
   `POST /api/collectors` and passes the ONE-SHOT token to the collector container
   (compose profile + `$COLLECTOR_TOKEN`). Because the token cannot be re-read, the stand
   is ephemeral: fresh `up`, `down -v` per suite run — which also guarantees zero
   cross-run residue (the IT-068 lesson by construction).
4. **Stand home + shape.** Compose file in `lineage/_extractor/probe-stacks/` (the
   established stack home), aux files (seeds, collector config) in a sibling directory
   named after the stack; per-spec lifecycle helper in `integration-tests/e2e/helpers/`
   (the multi-stack pattern); distinct host ports and compose project per stand.
5. **A dedicated suite lane (`ingestion-e2e`).** Slow by nature (source images, collector
   pull, ≤3-min ingestion wait) — never folded into `feature-complete`. It JOINS the
   full-set regression definition: full set = `feature-complete` + `multi-stack` +
   `known-bugs` + `ingestion-e2e` (G-C2 / tests pillar updated).
6. **Direct platform-DB seeding remains valid** for the fast lane — UI rendering, list
   mechanics, error states, visibility predicates over crafted edge rows (states a real
   adapter cannot emit on demand, e.g. soft-DELETED + hollow + excluded). The two tiers
   are complementary: the fast tier guards the read path per-commit; the ingestion tier
   guards the pipeline semantics.
7. **Source images follow the operator posture**: `neo4j:latest`, `postgres:latest`,
   `odd-collector:latest` (the directive). Every run-log records the digests actually
   resolved, so a moving-tag breakage is attributable; pin only when a major proves
   incompatible (then record why).

## First instance (shipped with this ADR)

`IT-128` (`integration-tests/protocols/IT-128-relationships-ingestion-pipeline.md`,
`e2e/specs/relationships-ingestion-pipeline.spec.ts`, stack `odd-ingestion`): the
relationships surface — GRAPH truth from `neo4j:latest` (5 typed directed edges; direction
= the cypher edge; `{Source}_{TYPE}_{Target}` names; `is_directed`; UNKNOWN-typed attribute
names) and ERD truth from postgres FK constraints (constraint-named; source = child /
target = parent; `cardinality` + `is_identifying` per the adapter checkers — both checker
paths seeded). Reuses the maintainer's rig shape; asserts the #1752 contract through the
real pipeline (the UI direction tests go RED on a pre-fix SUT — verified, see the run-log).

## Consequences

- **Pro:** defects in adapter mapping, ingestion resolution, or cross-layer direction
  semantics become catchable locally before an operator hits them; the e2e bar now matches
  what operators actually run; UI assertions (D1/label classes) get a pipeline-grade guard.
- **Con / accepted:** slower (one stand ≈ 2-4 min warm, more on first pull); moving tags
  can break a run for upstream reasons (mitigated by digest-recording + the dedicated lane
  isolating the noise); the collectors repo becomes a read dependency of the workspace
  (cloned at `../odd-collectors`; CLAUDE.md repo table already listed it).
- **Follow-on candidates (not this ADR's scope):** lineage ingestion stand (transformer
  inputs/outputs), dataset-structure stand (column types per adapter), a collector-version
  matrix if upstream publishes breaking adapter changes.

## Sources

- Maintainer directive + throwaway rig: conversation 2026-06-12; `docker/relationships-test/`
  (odd-platform, untracked) — compose/seed/config shapes reused.
- Adapter truth: `odd-collectors/odd-collector/odd_collector/adapters/neo4j/{adapter.py,
  mappers/relationships.py}`; `…/adapters/postgresql/mappers/relationships/{mapper.py,
  relationship_mapper.py,cardinality_checker.py,identifying_checker.py}`; `domain/plugin.py`
  (`WithPort.port: str` — the neo4j quoted-port gotcha; `PostgreSQLPlugin.port: int`).
- Wire contracts: `odd-platform-specification/openapi.yaml` (`POST /api/collectors`),
  `components.yaml` (`CollectorFormData`, `Collector.token.value`, `DataEntityRelationship`,
  `ERDRelationshipDetails`, `GraphRelationshipDetails`); `odd_models` `CardinalityType`
  literal values (pip-resolved 2026-06-12: `ONE_TO_ZERO_ONE_OR_MORE`, `ONE_TO_ZERO_OR_ONE`, …).
- Harness shape: `integration-tests/e2e/helpers/{stack.ts,ldap-stack.ts}` (the
  self-managed-stack pattern); `lineage/_extractor/probe-stacks/` conventions.
