# SHB-061 — Alert reopen-conflict guard is application-only — two concurrent reopens of the same type on the same entity both succeed

**Category**: open
**Severity**: MEDIUM

## Hypothesis

The ODD alerting feature enforces "one OPEN alert of the same type per data entity" as a server-side rule: a PUT `/api/alerts/{alert_id}/status` with status=OPEN against an alert whose data entity already has another OPEN alert of the same type is rejected with HTTP 400 + the literal message "Cannot reopen alert since the system already has an open alert of the same type." This guard is enforced at the SERVICE layer ONLY (read-then-write composition in `AlertServiceImpl.updateStatus` lines 124-131) with NO database-level constraint, NO `SELECT ... FOR UPDATE` lock, NO advisory lock. Two concurrent reopen requests for two SIBLING alerts of the same type on the same data entity can BOTH pass the existence check (each sees the other in RESOLVED state) and BOTH proceed to UPDATE, briefly violating the platform's own invariant. The UI surfaces a momentary "two OPEN alerts of type X on entity Y" state that operators may use to determine triage; the data-integrity contract the platform promises is unfenced.

## Evidence

- `odd-platform-api/src/main/java/.../service/AlertServiceImpl.java:124-131` — the read-then-write guard:
  ```
  if (AlertStatusEnum.OPEN == status) {
      sink.next(alertRepository.openAlertWithTheSameTypeExistsForDataEntity(alertId));
  }
  // ... if exists, error with BadUserRequestException(...)
  ```
  No `FOR UPDATE` lock at the read, no advisory lock, no DB unique partial-index `WHERE status = 'OPEN'`.
- `AlertServiceImpl.java:111-113` — `updateStatus` is NOT annotated with `@ReactiveTransactional`; the entire transaction wrapping is supplied by `ActivityAspect`'s synthetic AOP transaction at `ActivityAspect.java:42`. The aspect's transaction is at READ COMMITTED isolation (R2DBC default); concurrent transactions can both observe the other's not-yet-committed RESOLVED state.
- AlertController sidecar `bugs_limitations_corner_cases.[2]` MEDIUM severity: "No row-level lock or advisory lock — updateAlertStatus is a regular UPDATE; concurrent status changes to the same alertId race on last-writer-wins. The reopen-conflict check (when status=OPEN) is not transactionally fenced against a concurrent OPEN of a sibling alert."
- AlertServiceImpl sidecar `invariants.[2]` HIGH confidence: "Reopen-conflict guard is server-enforced application logic, not a DB constraint" + `tests_coverage_semantic.uncovered_behaviours.[1]` HIGH severity: "no test asserts the reopen-conflict race window."
- Live alerts API-reference page (verified 2026-05-08 status 200): documents the reopen guard verbatim — "Setting the status back to OPEN is rejected with 400 Bad Request and the message 'Cannot reopen alert since the system already has an open alert of the same type'" — operator-visible contract.
- Schema: per `ReactiveAlertRepositoryImpl` (referenced) — no `CREATE UNIQUE INDEX ... WHERE status = 'OPEN'` exists on the ALERT table.

## Notes

- This is an ENRICHER for **F-014 (Per-Entity Alert View)** AND a candidate cross-cut with F-007 (AlertManager external integration). The reopen-conflict is the operator-visible CONTRACT; the race window violates it.
- The race window is small (~ms) but not zero — operators triaging during incident-storm conditions where many alerts of the same type land simultaneously CAN trigger it via concurrent UI clicks.
- The fix is small: either (a) add `SELECT ... FOR UPDATE` to `openAlertWithTheSameTypeExistsForDataEntity`'s SQL (which already takes a `FOR UPDATE` lock in `getOpenAlertsForEntities` per the AlertServiceImpl sidecar) but ONLY when called from `updateStatus`'s OPEN branch; OR (b) add a Postgres `CREATE UNIQUE INDEX alert_one_open_per_type_per_entity ON alert(data_entity_oddrn, type) WHERE status = 'OPEN'` partial unique index, which closes the window cleanly at the DB layer.
- Option (b) is preferable: declarative, observed at INSERT time too (currently the alert-creation path also doesn't enforce this — see the F-007 `no_idempotency_no_audit` cluster), no application-side coupling. A migration tool can backfill conflicts before applying the constraint.
- The race window EXISTS for ALL state-mutation paths on the alert: user-driven `updateStatus`, ingestion-driven `applyAlertActions` (which has `@ReactiveTransactional` but no inter-transaction lock), AlertManager-driven `handleExternalAlerts` (no de-dup at all). The DB constraint fixes all three.
- Cross-product hazard with auto-resolve: an ingestion event RESOLVED_AUTOMATICALLY firing on alert A in transaction T1 + a user reopen of sibling alert B in transaction T2, where T1 commits first → T2's guard sees A as RESOLVED → T2 commits OPEN → for ~ms two OPEN alerts of the same type exist before T1's RESOLVED_AUTOMATICALLY is visible.

## Next

1. **Probe**: scripted concurrent reopens of two sibling alerts via `httpx`; observe the briefly-double-OPEN state via `/api/alerts/{alert_id}`. Cross-check with `applyAlertActions` ingestion timing.
2. **Graduate** as a load-bearing facet of F-014 OR a net-new F-NNN "Alert reopen integrity contract — application vs database enforcement". MEDIUM.
3. **REFACTOR-NNN MEDIUM** — add Postgres `CREATE UNIQUE INDEX ... WHERE status = 'OPEN'` partial unique index. Migration. Closes the window at all three mutation sites simultaneously.
4. **TEST-NNN MEDIUM** — add concurrency test (Testcontainers + ReactivePostgres) that exercises two concurrent reopen requests; pin the rejection path.
5. **DOC-NNN LOW** — the alerts API-reference page should clarify that the guard is "best-effort under concurrent load" until the DB constraint lands.

## Links

- cluster_with: [F-007, F-014]
- merged_into: (open)
- supersedes: []
