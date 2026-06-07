---
id: IT-096
title: "R2DBC pool sizing — framework-default per-replica ceiling, lazy second pool, no metrics"
gates:
  validates: [F-120]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:r2dbc-pool-sizing.spec.ts"
plan_ref: I8
status: ready
---

# IT-096 — R2DBC connection-pool sizing

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` probe (if any) is a convenience rail
> that runs the same steps and writes the same result; it never replaces the
> protocol. Reproducible by construction: same preparation + same run = same check.

## 1. What this checks
`R2DBCConfiguration` builds two `io.r2dbc.pool.ConnectionPool` beans (primary + `customConnectionPool`)
from the same `R2dbcProperties.Pool`. `application.yml` ships ZERO `spring.r2dbc.pool.*` keys, so the
Spring Boot 3.4 framework defaults apply (bytecode-verified `R2dbcProperties$Pool`: initialSize=10,
maxSize=10, minIdle=0). Falsifiable claims:
- **F-120-UC-2 (success)**: the deployed per-replica primary-pool ceiling is the framework default
  maxSize=10 — the live `application_name='r2dbc-postgresql'` connection count in `pg_stat_activity`
  sits at 10 (+1 for r2dbc-postgresql's background connection), proving the ceiling is the un-tuned
  framework value the operator must know to size PG `max_connections`.
- **F-120-UC-4 (pin)**: a Lookup-Tables-free deployment pays for only the primary pool — the custom
  pool is built unconditionally (`R2DBCConfiguration.java:54`) but r2dbc-pool warms `initialSize`
  lazily via `warmup()` on first acquire (and the manual `new ConnectionPool(...)` never warms it), so
  the total r2dbc footprint is strictly below 2×maxSize=20.
- **F-120-UC-8 (pin)**: pool utilisation is NOT observable — no Micrometer R2DBC binder; `/actuator`
  exposes only health+info on odd-minimal, so `/actuator/prometheus` and
  `/actuator/metrics/r2dbc.pool.acquired` do not return 200.

If the success claim FAILS, the deployed ceiling differs from the documented framework default. The
UC-8 pin is GREEN today and FLIPS RED when a metrics binder is added.

**Refinement of the drift's "20/replica"**: that is the both-pools-warm worst case; the observed
baseline on a Lookup-Tables-free stack is the primary pool alone (~10).

## 2. Preparation — build the test stand
- **Stack**: bring up `odd-minimal` (single replica). `spring.custom-datasource.url` is unset (commented
  in application.yml) → custom pool stays cold. No seeds; read-only. ids 20960-20969 reserved, unused.
- **Auth/config**: odd-minimal defaults (DISABLED).
- **Warm-up**: drive a few UI page loads so the primary pool fills toward maxSize (every authorized
  request hits the primary pool via `getCurrentUserRoles`).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Live r2dbc connections present:
  `SELECT count(*) FROM pg_stat_activity WHERE application_name='r2dbc-postgresql' AND datname='odd-platform'`
  → ~10-11.

## 4. Run protocol — what to run
1. Read the live r2dbc-postgresql connection count; assert it ∈ [maxSize-2, maxSize+1].
2. Read total app connections vs `max_connections`; assert single-replica footprint < server ceiling.
3. Assert the r2dbc count < 2×maxSize (custom pool not warm).
4. GET `/actuator/prometheus`, `/actuator/metrics/r2dbc.pool.acquired`, `/actuator/metrics`; assert none
   returns 200.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/r2dbc-pool-sizing.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: r2dbc-postgresql count ≤ maxSize+1 and ≥ maxSize-2 (at the framework-default ceiling);
  total app conns < `max_connections`; r2dbc count < 20; the three actuator metrics paths are not 200.
- **FAIL** when: the r2dbc count exceeds maxSize+1 (ceiling raised, or both pools warm) or sits far below
  10 on a warm stack; OR an actuator metrics path returns 200 (pool metrics became observable — move the
  UC-8 pin to the observability promise).

## 6. Result log
Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-120 UC-2 / UC-3 / UC-4 / UC-8 (`lineage/odd-platform/feature-flows/detail/F-120.yaml`)
- Code: `R2DBCConfiguration.java:38-87`, `application.yml:1-15`; Spring Boot
  `R2dbcProperties$Pool` defaults (maxSize=10, bytecode-verified); r2dbc-pool 1.0.0 `ConnectionPool.warmup()`.
- Follow-ups (noted in F-120): DOC publish `spring.r2dbc.pool.max-size`; PERF add R2DBC Micrometer binder;
  REFACTOR gate `customConnectionPool` with `@ConditionalOnProperty`.
- Plan: `lineage/odd-platform/test-plan.md` batch I8
