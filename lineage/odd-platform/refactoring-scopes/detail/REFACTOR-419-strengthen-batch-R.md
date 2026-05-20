## REFACTOR-419 — STRENGTHENED BATCH R — Cross-cluster session-key fragility now has SQL-substrate primary source for the COLLECTOR_ID_SESSION_KEY bridge from `getByToken`

**Severity unchanged**: HIGH
**Updated support count**: now **2 sidecars triangulated** (batch Q CollectorController.regenerateCollectorToken → batch R ReactiveCollectorRepositoryImpl)
**Batch**: R (2026-05-20)

**New surfaced_by**:
- `ReactiveCollectorRepositoryImpl.md:bugs_limitations_corner_cases.[5]` (MEDIUM): "No `@ReactiveTransactional` on `getByToken` — the method is a single-statement SELECT, so transactionality is moot at THIS layer. But the FILTER's downstream wiring (IngestionDataSourceFilter.java:33-39: `collectorRepository.getByToken(token)... .doOnNext(t -> session.getAttributes().put(COLLECTOR_ID_SESSION_KEY, t.getT1().getId()))`) performs a SQL read + a WebSession-attribute write without a transaction boundary. If the session attribute write fails (cluster + non-sticky session per batch-Q REFACTOR-419), the SQL read is already committed and the filter has registered a Collector-id authentication that may not survive across nodes. Surface as REFACTOR-NNN (cluster-fragility)."
- `ReactiveCollectorRepositoryImpl.md:scaling_characteristics.[1]`: "The COLLECTOR_ID_SESSION_KEY bridge is NOT stateless: `IngestionDataSourceFilter.java:33-43` writes the matched Collector's id into `exchange.getSession().getAttributes()` AFTER `getByToken` returns. Sessions are HTTP-Session-bound; in a multi-node deployment without sticky sessions OR a distributed session store, the COLLECTOR_ID_SESSION_KEY may not survive across nodes. Cross-reference: batch-Q REFACTOR-419 cluster-fragility finding. This is NOT a repository-layer concern but is a downstream consequence of the `getByToken` SQL outcome."

**Cross-batch insight**: The cluster-fragility was previously surfaced at the controller-tier (batch Q from `regenerateCollectorToken`). Batch R adds the REPOSITORY-tier confirmation that:

1. The SQL-side `getByToken` commits atomically (single SELECT) — innocent of the cross-cluster problem
2. The bridge to the WebSession-attribute write happens at the FILTER tier (`IngestionDataSourceFilter.java:33-43`) — AFTER the SQL commits, BEFORE the request completes
3. The boundary is stateless-to-stateful: the SQL layer is stateless and replicates across nodes; the WebSession is process-local unless backed by sticky sessions or a distributed session store

The fragility manifests as: a multi-node deployment processing `POST /ingestion/datasources` on node A (where the WebSession attribute was written) followed by a subsequent ingestion request on node B (which expects the session to carry COLLECTOR_ID_SESSION_KEY but the session-store doesn't replicate) — the second request fails the auth check on node B even though the first request succeeded on node A.

The SQL-substrate primary source confirms:
- The repository layer has NO knowledge of the session-replication problem — it returns the correct Collector pojo every time
- The bridge problem lives EXCLUSIVELY at the filter tier
- The fix prescription must address the filter tier, not the repository tier

**Operator-side consequences** (already established at batch Q, re-confirmed here):
- Multi-node deployments observe sporadic 401s on second-leg requests
- The error is non-deterministic (depends on which node receives the second leg)
- Sticky sessions mitigate but force a load-balancer policy constraint
- Distributed session stores (Redis-backed Spring Session) fully fix but add an operational dependency

**Fix prescription** (consolidated from batches Q + R):
1. **Path A — Sticky sessions**: Document the requirement on `configuration-and-deployment` (operator-side load-balancer must use sticky sessions for `/ingestion/datasources`). Add a deployment-warning section.
2. **Path B — Distributed session store**: Wire Spring Session with Redis backend; add to `application.yml` an opt-in `spring.session.store-type: redis` profile.
3. **Path C — Eliminate the session-attribute bridge entirely**: Refactor `IngestionDataSourceFilter` to NOT use WebSession; instead, pass the resolved `CollectorPojo` (or its id) through a request-scoped attribute or reactor-context, which travels with the request across the filter chain without persisting state.

Path C is the cleanest; the bridge-via-session is a legacy of the synchronous filter pattern not yet refactored to reactive context.

**Updated full triangulation enumeration**:
- Batch Q: `CollectorController.regenerateCollectorToken` — controller-side primary source (rotation timing concern + cluster session-store concern)
- Batch R: `ReactiveCollectorRepositoryImpl` — SQL-substrate primary source (NEW; confirms the bridge is at the filter tier, not the repository tier)

**Cross-references with batch-R sibling findings**:
- REFACTOR-437 NEW (TOKEN.value plaintext-at-rest) — same authentication subsystem; pairs with this for "Token credential hardening sprint" backlog grouping
- ADR-CANDIDATE-146 (audit table is schema-rooted) — the IngestionDataSourceFilter's session-write is silent in the activity feed (no audit trail of who-authenticated-when on the ingestion path)

**Severity unchanged at HIGH**. The cross-tier consolidation strengthens the case for the cluster-fragility fix (Path A / B / C above); the underlying severity is unchanged.

---
