---
id: IT-093
title: "Housekeeping TTL purge — search-facets retention contract + alert/session TTL footguns"
gates:
  validates: [F-010]
  enforces: []
  regresses: [PLT-005, PLT-074]
test_class: integration
stack: odd-minimal
automation: "e2e:housekeeping-ttl-purge.spec.ts"
plan_ref: I8
status: ready
---

# IT-093 — Housekeeping TTL purge characterization

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` probe (if any) is a convenience rail
> that runs the same steps and writes the same result; it never replaces the
> protocol. Reproducible by construction: same preparation + same run = same check.

## 1. What this checks
The scheduled housekeeping cycle (`HousekeepingJobManager`, `@Scheduled(fixedRate=15m)`) purges
rows past a 30-day TTL and the contract is verifiable through the exact SELECT predicates each job
runs. Three falsifiable claims:
- **F-010 H-006 (success)**: `SearchFacetsHousekeepingJob` (`SearchFacetsHousekeepingJob.java:23-27`)
  selects a search-facets row last accessed > 30 days ago for purge, and spares a fresh one — the
  user-facing "retained data lives 30 days" promise (H-002).
- **PLT-005 / H-001 (pin)**: `AlertHousekeepingJob.java:28-34` chains
  `.where(RESOLVED).or(RESOLVED_AUTOMATICALLY).and(<=cutoff)`; jOOQ binds `.and` to the nearest
  `.or`, emitting `status=2 OR (status=3 AND aged)` — so a FRESH manual RESOLVED alert is hard-deleted
  on the next cycle regardless of the TTL.
- **PLT-074 / H-012 (pin)**: with the shipped `spring.session.timeout: -1` (`application.yml:2-3`) a
  session never expires, so the reaper's `WHERE expiry_time < now()` (`PostgreSQLSessionHousekeepingJob.java:30`)
  never matches → `SPRING_SESSION` grows monotonically.

If the success claim FAILS, retention is broken (operator data deleted early, or never). The two pins
are GREEN today and FLIP RED when the bugs are fixed — that flip is the regression-closure signal.

## 2. Preparation — build the test stand
- **Stack**: bring up `odd-minimal` (platform :18080 + Postgres :15432). Ships `housekeeping.enabled: true`
  and `housekeeping.ttl.{resolved_alerts,search_facets,data_entity_delete}_days: 30` (`application.yml:165-170`).
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default). No credential needed.
- **Seed data** (in id/oddrn namespace `//e2e-it093`, ids 20930-20939; all idempotent — the spec
  reseeds via DELETE-then-INSERT):
  - two `search_facets` rows: one `last_accessed_at = now() - 60d`, one `= now()`.
  - one `alert` (status=2 RESOLVED, `status_updated_at = now()`) under a seeded source+entity
    (FK `alert.data_entity_oddrn → data_entity(oddrn)`).
  - two `spring_session` rows: one never-expire (`expiry_time = epoch(now()+100y)`), one expired
    (`expiry_time = epoch(now()-1h)`).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- ShedLock present (proves the cycle runs): `SELECT name FROM shedlock WHERE name='housekeepingJob'` → 1 row.
- Schemas: `search_facets(id uuid, query_string, filters jsonb, last_accessed_at timestamptz)`,
  `alert(... status smallint, status_updated_at timestamp)`, `spring_session(primary_id char(36), expiry_time bigint, ...)`.

## 4. Run protocol — what to run
1. Run the search-facets purge predicate `... WHERE last_accessed_at <= now() - interval '30 days'`
   scoped to the two seeded ids; collect the selected ids.
2. Run the BUGGY alert predicate `status=2 OR (status=3 AND status_updated_at <= now_utc - 30d)` and the
   FIXED predicate `(status=2 OR status=3) AND aged` against the seeded alert id.
3. Run the session reaper predicate `expiry_time < epoch(now())` against the two seeded sessions.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/housekeeping-ttl-purge.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: the 60-day search-facets row is selected and the fresh one is NOT (and the
  `housekeepingJob` shedlock window = 840s); the buggy alert predicate selects the fresh manual RESOLVED
  alert while the fixed predicate does not; the never-expire session is NOT reaped while the expired one is.
- **FAIL** when: the fresh search-facets row is selected (over-deletion) or the old one is spared
  (retention broken); OR the alert/session pins stop reproducing — meaning the bug was fixed (move the
  pin assertion to the promise) or the predicate drifted.

## 6. Result log
Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-010 H-001 / H-002 / H-006 / H-012 (`lineage/odd-platform/feature-flows/detail/F-010.yaml`)
- Bugs: PLT-005 (alert jOOQ precedence), PLT-074 (session timeout=-1), PLT-083 (TTL=0 silent-wipe, sibling)
- Code: `SearchFacetsHousekeepingJob.java:23-27`, `AlertHousekeepingJob.java:28-34`,
  `PostgreSQLSessionHousekeepingJob.java:30`, `HousekeepingTTLProperties.java:9-11`, `application.yml:2-3,165-170`
- Plan: `lineage/odd-platform/test-plan.md` batch I8
