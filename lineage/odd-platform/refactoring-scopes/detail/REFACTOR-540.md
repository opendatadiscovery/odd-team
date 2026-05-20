## REFACTOR-540 — `ingestMetrics` INTERNAL_POSTGRES backend has NO `tenant_id` column — multi-tenant isolation on the platform's DEFAULT metrics-storage backend is structurally nonexistent; `odd.tenant-id` is silently a Prometheus-only feature

**Severity**: HIGH
**Category**: missing-tenant-isolation + buggy-default + doc-vs-code-drift
**Batch**: Z (2026-05-20)
**Pillars affected**: [P-09-security-access-control (tenant isolation is a security architecture concern), P-07-active-platform-features (the per-DataEntity Metrics tab consumes this data), P-10-integrations-ingestion (the metrics ingestion path)]

**Surfaced by**:
- `ingestMetrics.md:bugs_limitations_corner_cases.[2]` (HIGH) — "No per-tenant scoping at the controller layer. The `odd.tenant-id` configuration is consumed at the EXTRACTOR layer (CounterTimeSeriesExtractor.java:23 etc.) and appended only as a Prometheus label on the PROMETHEUS path. The INTERNAL_POSTGRES path stores no tenant_id column on the `metric_series` / `metric_point` tables — multi-tenant isolation on the Postgres backend is NONEXISTENT (a deployment configured with `odd.tenant-id` running in INTERNAL_POSTGRES mode does NOT scope its writes by tenant_id at all)."
- `ingestMetrics.md:security.known_security_gaps.[3]` (MEDIUM) — "Tenant isolation BYPASSED on INTERNAL_POSTGRES storage. The `odd.tenant-id` mechanism applies ONLY to the PROMETHEUS path (as a label append at extractor construction). The INTERNAL_POSTGRES path has no `tenant_id` column on `metric_series` / `metric_point` tables. A deployment that configures `odd.tenant-id=tenantA` AND `metrics.storage=INTERNAL_POSTGRES` STILL writes all metrics into one untyped Postgres namespace — there is NO multi-tenant isolation on the default storage backend."

**Statement**: ODD's `odd.tenant-id` configuration is documented (live `configuration-and-deployment/odd-platform` page, WebFetched 2026-05-20 status 200) as the mechanism that "appends `tenant_id={value}` as a label on every Prometheus instant query it issues. This lets a single shared Prometheus instance serve metric data for multiple ODD Platform deployments." But the property is structurally a PROMETHEUS-ONLY feature:

1. **PROMETHEUS path**: `odd.tenant-id` is consumed at the extractor layer (CounterTimeSeriesExtractor.java:22-25 — `@Value("${odd.tenant-id}")` at bean construction) and appended as a `tenant_id={value}` label on every TimeSeries write via the Prometheus remote-write protocol. Tenant isolation works as documented.

2. **INTERNAL_POSTGRES path (the DEFAULT — `matchIfMissing=true`)**: No tenant-id consumption at any layer. `InternalIngestionMetricsServiceImpl.java:1-295` makes NO `@Value("${odd.tenant-id}")` injection. The `metric_series`, `metric_point`, `metric_family`, `metric_label`, `metric_label_value`, `metric_entity` tables (per JOOQ POJO imports at InternalIngestionMetricsServiceImpl.java:39-44) have ZERO tenant-id columns. A deployment with `odd.tenant-id=tenantA` AND the default `metrics.storage=INTERNAL_POSTGRES` writes all metrics into ONE untyped namespace — operators believe they have multi-tenant isolation; they don't.

**The deployment trap**:
- Operator reads live docs, sees `odd.tenant-id` documented as the tenant-isolation mechanism
- Operator deploys ODD with `odd.tenant-id=tenantA` AND no explicit `metrics.storage` (so INTERNAL_POSTGRES wires via `matchIfMissing=true`)
- Operator expects: metrics for this deployment isolated by `tenantA` label
- Reality: metrics written to the platform's PostgreSQL with NO tenant tracking; the property has no effect; the deployment is one untyped tenant

**Compounded with REFACTOR-539** (the 3 unauthenticated `/ingestion/**` endpoints): under the bundled default `auth.type=DISABLED + metrics.storage=INTERNAL_POSTGRES + odd.tenant-id=tenantA`, ANY caller able to reach the platform's HTTP port can write metrics for ANY ODDRN with NO tenant scoping. The "single shared Prometheus" multi-tenant model doesn't even theoretically apply because there's no Prometheus.

**Primary source citations**:
- `IngestionController.java:89-95` (controller-side; no tenant check)
- `InternalIngestionMetricsServiceImpl.java:1-295` (no `tenant_id` injection or persistence)
- `metric_series`, `metric_point`, `metric_family`, `metric_label`, `metric_label_value`, `metric_entity` JOOQ POJOs (no tenant column)
- `CounterTimeSeriesExtractor.java:22-25` (`@Value("${odd.tenant-id}")` — Prometheus-side only)
- Live docs WebFetch 2026-05-20 of `configuration-and-deployment/odd-platform` (status 200) — documents `odd.tenant-id` as the tenant-isolation mechanism with no PROMETHEUS-only caveat
- Live docs WebFetch 2026-05-20 of `configuration-and-deployment/odd-platform` quotes verbatim: "the platform appends `tenant_id={value}` as a label on every Prometheus instant query it issues. This lets a single shared Prometheus instance serve metric data for multiple ODD Platform deployments" — implicitly Prometheus-only, but does NOT explicitly state INTERNAL_POSTGRES ignores the property

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-026 STRENGTHENED batch Z (mirrored-bean `@ConditionalOnProperty` storage backend selection — the architectural opinion is "INTERNAL_POSTGRES is the default-on backend"; the gap is that the default-on backend does NOT implement the documented tenant-isolation contract). The `metrics-ingestion` concept catalog entry already names this as a known weakness; this REFACTOR consolidates it as actionable scope.

**Proposed remedy** (multi-option):

**Option A — Add tenant-id schema (HIGH effort, HIGH operator value)**:
- Migration: add `tenant_id` column to `metric_series` / `metric_point` / `metric_entity` tables
- Repository writes: stamp `tenant_id` from `odd.tenant-id` on every insert
- Repository reads: filter by `tenant_id` on every select (cross-tenant isolation enforced at SQL)
- Backwards-compat: existing rows without `tenant_id` → migration script + per-deployment opt-in

**Option B — Document INTERNAL_POSTGRES as single-tenant (LOW effort, MEDIUM operator value)**:
- Live docs `configuration-and-deployment/odd-platform` page MUST add explicit caveat: "`odd.tenant-id` is a PROMETHEUS-only feature. Under INTERNAL_POSTGRES (the default), all metrics are written to a single un-tenanted namespace; multi-tenant deployments MUST use `metrics.storage=PROMETHEUS` with a shared Prometheus instance."
- Add fail-fast at boot: if `odd.tenant-id` is set AND `metrics.storage=INTERNAL_POSTGRES`, emit fail-loud WARN
- Cross-link from the Security page (which already documents the `/ingestion/**` unauth compound — natural co-location)

**Option C — Fail-closed when tenant-id is configured but storage is INTERNAL_POSTGRES**:
- Boot-time validator: refuse to start if `odd.tenant-id` is set AND `metrics.storage=INTERNAL_POSTGRES` (force operator to choose PROMETHEUS for multi-tenant)
- Trade-off: operators with `odd.tenant-id` set for documentation purposes only (not for true tenant isolation) cannot start the platform without unsetting it

Recommend: **Option B (immediate)** + **Option A (medium-term)** + **Option C (boot-time validator, low risk)**. The doc-fix is single-PR; the schema-migration is a sprint-themed item.

**Severity rationale**: HIGH — silent multi-tenant isolation failure on the DEFAULT storage backend; operators reading docs believe the property protects them when it doesn't; the LSN-001 attachment-storage shape (silent data-loss-from-default) reapplied to tenant isolation. Compounded with the unauthenticated POST surface, the gap is enumerable and exploitable.

**Suggested backlog grouping**: `Multi-tenant configuration audit` co-batched with the per-tenant concern in concepts.yaml `multi-tenant-configuration-odd-tenant-id`. Doc-fix grouping with `Documentation / metrics-storage page hardening`.

---
