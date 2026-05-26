# SHB-090 — Collector + Datasource token rotation has no grace window — in-flight ingestion 401s on the UPDATE commit

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators rotating a collector or datasource token (Management → Collectors / Datasources tab → Regenerate button) expect a grace period during which both old and new tokens validate, giving the collector time to pick up the new secret on its next config-file reload. The actual semantics: the rotation is an IN-PLACE `UPDATE token SET value = ? WHERE id = ?` (no `previous_token` column, no `valid_until` window, no overlap); the moment the UPDATE commits, every in-flight `POST /ingestion/entities` using the old token starts 401-ing with `"Token is not correct"` from `IngestionDataEntitiesFilter.java:55-58`'s plain `String.equals()` check. There is no operator-visible warning at the UI confirm step, no `Last-Used-At` timestamp on the token, and no notification fires to the affected collector.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTokenRepositoryImpl.java:30-39` — `updateToken` issues `DSL.update(TOKEN).set(...).where(TOKEN.ID.eq(...))` — single-row UPDATE.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/util/TokenGeneratorImpl.java:44-52` — `regenerate(tokenPojo, user)` mutates the passed-in pojo's `value` field in-place via setter.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:55-58` — `if (!dto.tokenPojo().getValue().equals(token)) throw new AccessDeniedException("Token is not correct");` — plain equality, no historical-token lookup.
- `odd-platform-api/src/main/resources/db/migration/V0_0_29__add_collector.sql:14` (estimated; collector schema migration) + `V0_0_11__add_namespace_support.sql:1-2` (datasource schema) — the `token` table has columns `(id, value, created_at, updated_at, updated_by)` only; NO `previous_value`, NO `valid_until`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/CollectorController.java:47-51` + `DataSourceController.java:53-59` — controllers return the response immediately on the UPDATE commit; no UI-visible grace-period field on the response.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/CollectorServiceImpl.java:82-90` — `regenerateToken` is NOT `@ReactiveTransactional` (cross-confirmed at DataSourceServiceImpl too — see SHB-097 sibling), so the rotation is a single-statement UPDATE → in-flight ingestion fails immediately on commit.
- Live `/configuration-and-deployment/enable-security/authentication` (WebFetched 2026-05-10, status 200) — enumerates S2S as an auth mode without explaining how its credential is rotated, the grace semantic, or operator-recovery guidance.
- Live `/integrations/integrations/odd-collector` page — references `token: <COLLECTOR_TOKEN>` in the minimal config without warning that rotation is destructive.

## Notes

- Operator-visible failure mode: the operator clicks "Regenerate" in the UI, copies the new token to clipboard, opens a terminal to update the collector's `collector_config.yaml`, SSH-bounces the collector. Between the UI click and the collector restart, every ongoing ingestion call 401s — datasets ingested in that window are silently dropped (no retry queue at the collector level by default for auth failures).
- Token entropy is non-CSPRNG (`RandomStringUtils.randomAlphanumeric(40)` → `ThreadLocalRandom` in commons-lang 3.16+, not `SecureRandom`) — SHB-091 sibling. Combined with the no-rotation-grace-window finding here and the plaintext-at-rest storage (`ReactiveTokenRepositoryImpl` stores raw value), the token-credential surface is a 3-axis defect.
- Operator pattern for safe rotation REQUIRES: (a) pre-stage the new token to the collector's config file via the platform's pre-rotation UI hook (does not exist), OR (b) accept ingestion downtime during the rotation window.
- Compounds with no audit log on rotation (`CollectorController` Grep `log.(info|warn|debug|error)` returns zero matches across the F-020 surface) — operators can rotate but cannot afterward answer "who rotated which collector when."
- TOKEN row is leaked plaintext-in-response on POST (register) and PUT-token (rotate) — any reverse proxy / API gateway / browser cache / response-body logger captures the secret on the wire (CollectorController bugs[3]).
- Cross-link to F-020 (Collector Lifecycle).

## Next

1. **ENRICH F-020** with this drift facet (`token_rotation_no_grace_window_in_flight_ingestion_401`). F-020 notes the one-shot plaintext visibility but does NOT name the in-flight-401 operational hazard.
2. **REFACTOR-NNN**: introduce a `previous_value` + `previous_valid_until` column pair on TOKEN; `IngestionDataEntitiesFilter` accepts either; the previous becomes invalid after a configurable window (operator-tunable, e.g. 24h default).
3. **DOC-NNN**: document the destructive-rotation semantic on `/configuration-and-deployment/enable-security/authentication`; add explicit operator workflow: pre-update collector config, then rotate.
4. **REFACTOR-NNN**: add `@Slf4j` log statement at INFO/AUDIT level on `regenerateToken` paths (collector + datasource), naming the operator + the collector_id; structured event format for log-aggregation alerting.

## Links

- cluster_with: [F-020, SHB-091, SHB-097]
- merged_into: (open)
- supersedes: []
