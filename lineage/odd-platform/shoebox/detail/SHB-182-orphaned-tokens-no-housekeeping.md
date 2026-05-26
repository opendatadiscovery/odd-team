# SHB-182 — Orphaned ingestion credentials persist forever; TOKEN table has no housekeeping

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators rotating collector tokens (`POST /api/collectors/{id}/token` regenerate) and deleting collectors (`DELETE /api/collectors/{id}` soft-delete) accumulate ORPHANED rows in the `token` PostgreSQL table that contain the OLD plaintext credentials, persist forever, are reachable by any DB-side reader (replica / pg_dump / backup / actuator-leaked SQL query / log leak), and are never cleaned up by ANY housekeeping job. The token table has NO `deleted_at` column (V0_0_28); the regenerate-token path UPDATES the row in place (so the prior token value is LOST — no grace period), but the soft-delete-collector path leaves the FK reference dangling — the TOKEN row remains, the COLLECTOR.deleted_at is set, and there's no `WHERE id NOT IN (SELECT token_id FROM collector WHERE deleted_at IS NULL)` cleanup. Combined with the plaintext-at-rest storage of `token.value VARCHAR(40)` and the absence of any audit trail on rotation/delete events, a deployment that has been running for a year has accumulated every historical credential of every long-gone collector in a single PG table.

## Evidence

- `odd-platform-api/src/main/resources/db/migration/V0_0_28__add_token.sql:1-9` — `token` table: `id, value VARCHAR(40), created_at, created_by, updated_at, updated_by` — NO `deleted_at`, NO `is_deleted`, NO STATUS column. Tokens are never soft-deletable.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/TokenGeneratorImpl.java:34-42` — `RandomStringUtils.randomAlphanumeric(40)` written verbatim into `token.value`; no hash, no encryption, no separate plaintext-display column.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTokenRepositoryImpl.java:33-36` — `regenerateToken` UPDATE: `UPDATE token SET value = ?, updated_at = ? WHERE id = ?` — the PRIOR value is overwritten; no grace period, no second-table history.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/CollectorServiceImpl.java:71-90` — `delete(id)` soft-deletes the Collector via `ReactiveAbstractSoftDeleteCRUDRepository.delete` (UPDATE SET deleted_at = NOW()); the TOKEN row is NOT touched in this flow.
- `odd-platform-api/src/main/resources/db/migration/V0_0_33__add_token_constraints.sql:1` — partial unique index `collector_token_unique ON collector(token_id) WHERE deleted_at IS NULL` — enforces "one TOKEN per LIVE collector" but EXCLUDES soft-deleted rows; so a NEW collector cannot accidentally reuse a soft-deleted-collector's token_id, but the soft-deleted-collector's TOKEN row STAYS in the table.
- `bash grep -r 'DELETE FROM token\|housekeeping.*token' <odd-platform-repo>` returns ZERO matches — no housekeeping job, no cleanup query, no admin endpoint enumerates or purges orphan tokens.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/HousekeepingJobManager.java` — the 15-minute housekeeping job covers DataEntity / Activity / Message / Owner-Association-Request / Notification cleanup; TOKEN cleanup is NOT in the cascade.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveCollectorRepositoryImpl.java:89-97` (`getByToken`) — runs on EVERY `POST /ingestion/datasources` regardless of `auth.type` (always-on `IngestionDataSourceFilter`); plaintext `TOKEN.VALUE.eq(token)` equality match; no UNIQUE constraint on `TOKEN.value` so two tokens COULD collide (astronomically improbable for 40-char alphanumeric — keyspace 62^40 — but no schema-level defence).

## Notes

- **Threat model: any DB-side reader recovers every historical credential.** The plaintext-at-rest invariant (sidecar primary source: ReactiveCollectorRepositoryImpl) combined with the no-cleanup invariant means: an attacker who reaches a Postgres replica / nightly backup / pg_dump output / accidentally-leaked SQL log line walks away with EVERY collector token the platform has ever minted. The deployment's threat surface grows monotonically over time; rotation does NOT reduce it (rotation overwrites the row IN PLACE, but only for ACTIVE collectors — soft-deleted collectors' tokens are frozen in time).
- **No grace period on rotation = operational bug, not security bug.** A collector's token is rotated; the OLD token immediately starts 401-ing at every `POST /ingestion/datasources` and `POST /ingestion/entities`. The collector deployed on the operator's infrastructure must be restarted with the new token AT THE MOMENT OF ROTATION; if not, ingestion stops. There's no "old + new both valid for 24 hours" pattern. Operationally fragile.
- **No audit trail for rotation OR delete.** The `regenerateToken` path emits NO Activity Event, writes NO audit-log row. The `TOKEN.updated_at` + `TOKEN.updated_by` (which CAN be `null` in `auth.type=DISABLED` deployments per TokenGeneratorImpl.java:27-32 fallback) is the ONLY forensic trace. An incident reviewer asking "who rotated this collector's token at 02:13 last Tuesday" has minimal information.
- **The fix is a housekeeping cascade.** Add to `HousekeepingJobManager` (or to `PostgreSQLSessionHousekeepingJobHandler`) a query: `DELETE FROM token WHERE id NOT IN (SELECT token_id FROM collector WHERE deleted_at IS NULL) AND id NOT IN (SELECT token_id FROM data_source WHERE deleted_at IS NULL) AND id NOT IN (...)` — every table that has a `token_id` FK needs to be in the NOT IN clause. The DataSource regenerateToken (DataSourceServiceImpl.regenerateDataSourceToken) has the SAME shape — orphan tokens accumulate equally on the DataSource side.
- **`data_source.token_id` accumulates orphans the same way.** Per the ReactiveDataSourceRepositoryImpl sidecar: token rotation UPDATEs in place, data_source soft-delete leaves the token row dangling. Cross-cutting failure across BOTH ingestion-credential surfaces (Collector tokens + DataSource tokens).
- **The data-loss cousin: regenerateToken with no UI confirmation.** The UI's "Regenerate Token" button (CollectorController.regenerateCollectorToken / DataSourceController.regenerateDataSourceToken) is one click; there's no "are you sure?" modal warning about the immediate invalidation of the old token. Operators who click expecting a draft / preview flow lose ingestion.
- This thread is `open` — feature candidate name: `F-NNN — Ingestion Credential Lifecycle (Collector + DataSource Tokens)`. Subsumes F-020 (Collector Lifecycle) and a piece of F-031 (DataSource Lifecycle).
- Related: F-020 (Collector Lifecycle Management — already names token one-shot visibility); F-031 (DataSource Lifecycle); concept catalog references to ingestion-credential auth path.

## Next

1. **Graduate** — `F-NNN — Ingestion Credential Lifecycle Across Collector and DataSource Surfaces`. Pillar P-09 (security) + P-08 (admin). Pull facets from F-020 + F-031; this thread is the storage-layer + housekeeping-gap feature.
2. **Open follow-ups**:
   - SEC-NNN (HIGH) — add a housekeeping query to `HousekeepingJobManager` that deletes orphan TOKEN rows: `DELETE FROM token WHERE id NOT IN (...)`. Schedule cadence: daily.
   - SEC-NNN (HIGH) — encrypt-at-rest the `token.value` column (Postgres-native column encryption via pgcrypto, OR application-layer with key from `attachment.remote.access-key`-style operator config). Migrate via a new column + dual-write + read-only-from-new + drop-old over multiple releases.
   - SEC-NNN — add a 24-hour grace period on token rotation: insert a NEW token row, mark the OLD as `superseded_at`, accept both during the grace window, then delete the OLD. Requires schema migration (drop the partial unique index `collector_token_unique`, add `superseded_at` column).
   - REFACTOR-NNN — add ActivityEvent emission on token rotation + collector delete + datasource delete (currently silent per ReactiveCollectorRepositoryImpl sidecar's "no-audit-log-on-RBAC-mutations" cross-batch concept).
   - DOC-NNN — operator security page should add an admonition: "Collector and DataSource tokens are stored as plaintext in the PostgreSQL `token` table; secure your Postgres backups and replicas accordingly. Soft-deleted collectors leave token rows in the table indefinitely until a future housekeeping migration."
3. **Probe** — boot platform, create 100 collectors, delete 50, count `SELECT count(*) FROM token` vs `SELECT count(*) FROM collector WHERE deleted_at IS NULL` — confirm the orphan count grows monotonically.
4. **Cross-link to LSN-001 / LSN-002 retrospectives** — this thread is the SHAPE that LSN-001 and LSN-002 were FOR (silent-default footguns shipping operator-trust failures); the maintainer should consider whether this constitutes an LSN-NNN candidate in its own right.

## Links

- cluster_with: [F-020, F-031]
- merged_into: F-125
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — SECURITY load-bearing. Evidence: 6 file:line citations across migrations + TokenGeneratorImpl + repository + service + HousekeepingJobManager absence-of-cleanup. Minted F-125 (P-08:F-017 Ingestion Credential Storage & Lifecycle). Cluster_with [F-020, F-031] preserved as related lifecycle cross-references — F-125 is the storage-layer + housekeeping-gap; F-020/F-031 are the WHAT-it-does of token creation. Cross-pillar with F-010 (housekeeping fix-location) acknowledged via related_features without modifying F-010 (Slice E).
