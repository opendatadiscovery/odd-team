# SHB-132 — Collector tokens have no DB-level uniqueness; soft-deleting a Collector does not revoke its token; both shapes allow cross-collector identity confusion that operators cannot recover from runtime state

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators managing the Management → Collectors tab assume each Collector's bearer token is a unique identity credential and that "deleting" a Collector revokes its token. The implementation does neither cleanly:

1. **No DB-level uniqueness on TOKEN.value.** `collectorRepository.getByToken(token)` issues `TOKEN.VALUE.eq(token)` and returns the FIRST match; the schema's TOKEN table has no visible `UNIQUE(value)` constraint at the repository code level. If (by misconfiguration OR malicious mint OR token-generator collision) two Collectors share the same TOKEN.value, the session attribute `COLLECTOR_ID_SESSION_KEY` gets set to the first-matched collector id non-deterministically. Datasources registered under one Collector silently appear under the other in the Datasources tab + Catalog drill-down.
2. **Soft-deleted Collectors retain working tokens.** `addSoftDeleteFilter` on `getByToken` (per `ReactiveCollectorRepositoryImpl.java:94`) applies to TOKEN.deleted_at, NOT to COLLECTOR.deleted_at. A soft-deleted Collector with a not-soft-deleted TOKEN row STILL returns from `getByToken` — the controller's `IngestionDataSourceFilter` accepts the token, sets the session attribute; downstream `DataSourceIngestionServiceImpl.getDto(collectorId)` (which DOES filter by COLLECTOR.deleted_at) fails with NotFoundException → 5xx. The failure mode is correct but the path is convoluted: 401 would be the right answer, 5xx is what the operator gets.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveCollectorRepositoryImpl.java:89-97` — `getByToken` joins TOKEN on COLLECTOR.TOKEN_ID; filters by `TOKEN.VALUE.eq(token)` with `addSoftDeleteFilter` applied to TOKEN.deleted_at; returns single result without uniqueness assertion at code level.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveCollectorRepositoryImpl.java:46-57` — `getDto(collectorId)` DOES filter by `COLLECTOR.DELETED_AT.isNull()` (line 54). The asymmetric soft-delete filtering between `getByToken` (filters TOKEN only) and `getDto` (filters COLLECTOR) is the bug shape.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataSourceFilter.java:33-38` (per createDataSourceEntity sidecar) — on token-match, writes COLLECTOR_ID_SESSION_KEY into the WebSession. No fail-loud on uniqueness violation.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/DataSourceIngestionServiceImpl.java:42-43` — `reactiveCollectorRepository.getDto(collectorId).switchIfEmpty(Mono.error(new NotFoundException("Couldn't find collector with id %s", collectorId)))`. The downstream check that catches the soft-deleted-but-token-valid case; surfaces as 5xx (not 401).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/DataSourceIngestionServiceImpl.java:86-88` — the cross-collector preservation invariant: existing `data_source.collector_id` is preserved through the copy-construct at line 86 (`new DataSourcePojo(a)`); the explicit setters at lines 87-88 do NOT touch `collector_id`. So if Collector A originally registered ODDRN X, and Collector B's payload contains ODDRN X (e.g. token sharing), the existing `collector_id = A` is preserved — but the `mapDataSources` mapper output at line 107 sets `collector_id = B` for the CREATE path. The asymmetry means the UPDATE path preserves; the CREATE path overwrites. Operationally: a Collector B with a shared token CANNOT take over Collector A's existing datasources via re-registration (good), but CAN register NEW datasources stamped with B's collector_id (which is what the misconfiguration would surface as).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/AbstractIngestionFilter.java:40` (per createDataSourceEntity sidecar) — parent filter only catches `AccessDeniedException`, not `IllegalStateException` or `NotFoundException` from downstream. So the soft-deleted-collector path surfaces with the default reactive error-handler shape (5xx generic) instead of 401 (which would have correctly told the operator their auth identity is invalid).

## Notes

- The token-generation code (`TokenGeneratorImpl.java:39` per IngestionController sidecar) uses `RandomStringUtils.randomAlphanumeric(40)` — 40-char alphanumeric gives ~10^60 combinations, so accidental collision is statistically impossible. The realistic uniqueness-failure shapes are:
  - **Operator misconfiguration** — manually setting two Collectors' tokens to the same value via direct DB edit OR via a buggy admin tooling. Operationally rare but unguarded.
  - **Token-rotation race** — if a future "rotate token" feature replaces a token by INSERTING a new TOKEN row before DELETING the old one, both may exist transiently with the same value. The schema does not prevent it.
  - **DB restoration / backup-restore conflicts** — two regions of operators independently created Collectors with the same auto-generated token (cosmically improbable for 40-char alphanumeric, but possible if the random source is misconfigured to use a low-entropy seed).
- The soft-deleted-collector path is the more realistic operator-visible bug:
  - Operator deletes Collector A via Management → Collectors UI. The UI confirms "Collector deleted."
  - Collector A's process is still running somewhere (operator forgot to shut it down OR it's in a CI pipeline OR a long-running batch job).
  - Collector A's next ingestion tick hits `POST /ingestion/datasources` with its still-valid token.
  - `IngestionDataSourceFilter` accepts the token (filter only checks TOKEN.deleted_at), writes COLLECTOR_ID_SESSION_KEY to session.
  - Controller reads session, calls `DataSourceIngestionServiceImpl.createDataSources(collectorId, ...)`.
  - Downstream `getDto(collectorId)` filters by COLLECTOR.deleted_at, returns empty → NotFoundException → HTTP 500.
  - Operator-facing symptoms: Collector A's logs show "ingest failed: HTTP 500." Operator looks at the platform, can't reconstruct why; might re-create the Collector entity ASSUMING the deletion was the wrong action.
- The fix shape is small but precise:
  1. Change `getByToken` to apply soft-delete filter to BOTH TOKEN and COLLECTOR — a 1-line addition (`addSoftDeleteFilter(COLLECTOR.DELETED_AT.isNull())`). Net effect: the filter returns empty immediately → AccessDeniedException → 401 (correct operator-facing message).
  2. Add `UNIQUE(value)` constraint on the TOKEN table via a new Flyway migration. Net effect: the operator-misconfiguration class becomes impossible.
  3. Optionally: when an operator deletes a Collector, also soft-delete the associated TOKEN row in the same transaction. Net effect: explicit revocation rather than the convoluted downstream-NotFoundException path.
- Cross-link to F-020 (Collector Lifecycle Management — token one-shot visibility; no rotation grace period). F-020 already anchors the LIFECYCLE shape; this thread adds the SECURITY-PATH facets (token uniqueness + soft-deleted-still-valid).
- This is `open` because both findings are mechanism-verified but neither has a probe confirming the operator-facing symptom shape (5xx-vs-401 + the silent overwrite under token sharing).
- The OPERATIONAL-IMPACT framing matters here: in the rare token-sharing case the consequence is severe (cross-collector ownership confusion); in the soft-deleted-still-valid case the consequence is operator-experience pain (misleading 5xx). The two findings are different severities; the maintainer may choose to address them as separate REFACTOR-NNN items.

## Next

1. Treat as ENRICHER for F-020 (Collector Lifecycle Management). Add the drift facets `token_uniqueness_not_enforced_at_schema` and `soft_deleted_collector_token_still_valid`.
2. Probe-NNN (soft-delete path): against a local docker-compose mirror, create a Collector, ingest one datasource (works), soft-delete the Collector via UI, then re-attempt ingestion with the still-valid token. Confirm 5xx-vs-401 shape; capture operator-visible error message.
3. SEC-NNN: change `ReactiveCollectorRepositoryImpl.getByToken` to apply soft-delete filter to BOTH TOKEN and COLLECTOR. 1-line fix; surfaces as 401 instead of 5xx.
4. SEC-NNN: add `UNIQUE(value)` Flyway migration on the TOKEN table. Backfill check: scan for existing collisions before applying.
5. REFACTOR-NNN: on Collector soft-delete, also soft-delete the associated TOKEN row in the same transaction. Explicit revocation.

## Links

- cluster_with: [F-020, SHB-124]
- merged_into: (open — likely enriches F-020)
- supersedes: []
