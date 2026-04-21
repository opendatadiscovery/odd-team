# Progress Dashboard

Last updated: 2026-04-21 (triage: docs/accuracy/config-options)

## Audit Phase

| Scanner Category | Total Scanners | Completed | In Progress | Pending |
|-----------------|---------------|-----------|-------------|---------|
| docs/accuracy | 5 | 2 | 0 | 3 |
| docs/completeness | 2 | 0 | 0 | 2 |
| docs/coverage | 4 | 1 | 0 | 3 |
| tests | 7 | 0 | 0 | 7 |
| navigation | 3 | 0 | 0 | 3 |
| spec | 2 | 0 | 0 | 2 |
| adrs | 2 | 0 | 0 | 2 |
| **Total** | **25** | **3** | **0** | **22** |

## Backlog Phase

| Category | Pending | In Progress | Done | Blocked | Total |
|----------|---------|-------------|------|---------|-------|
| DOC | 17 | 0 | 0 | 0 | 17 |
| TST | 0 | 0 | 0 | 0 | 0 |
| NAV | 0 | 0 | 0 | 0 | 0 |
| SPC | 0 | 0 | 0 | 0 | 0 |
| **Total** | **17** | **0** | **0** | **0** | **17** |

### DOC Backlog (from docs/accuracy/config-options triage — 2026-04-21)

Priority breakdown: **6 critical, 5 high, 6 medium**

**Critical (6):**
- DOC-001 — document Azure AD OAuth2 provider
- DOC-003 — document S2S API key authentication
- DOC-005 — fix email notifications config (wrong key + missing keys)
- DOC-006 — fix SESSION_PROVIDER env-var default in docs
- DOC-008 — document attachment storage + warn about ephemeral default (user-reported data loss)
- DOC-013 — document collector secrets backend (AWS SSM)

**High (5):**
- DOC-004 — document ingestion auth filter (security-critical default)
- DOC-007 — complete metrics config documentation
- DOC-009 — document housekeeping TTL configuration
- DOC-014 — document full CollectorConfig fields (verify_ssl, chunk_size, etc.)
- DOC-016 — create adapter configuration reference (60 adapters, large)

**Medium (6):**
- DOC-002 — document Keycloak PKCE option
- DOC-010 — document odd.* top-level config (tenant-id, stale-period, activity.partition-period)
- DOC-011 — document spring.session.timeout and spring.codec.max-in-memory-size
- DOC-012 — warn about default login-form credentials
- DOC-015 — update collector repo references to monorepo (add Azure)
- DOC-017 — fix Python version requirement for collectors

**Pending triage of other scanners:**
- `docs-accuracy-feature-behavior` (35 findings) — **note**: F-001, F-002, F-024, F-025 are already covered by DOC-005, DOC-006, DOC-007; skip them during triage
- `docs-coverage-undocumented-features` (8 new + 3 enrichments) — **note**: F-036 is already covered by DOC-008; skip during triage

## Current Status

Phase: **Audit In Progress** — 3 scanners complete, 0 in progress, 22 remaining. First triage batch landed (17 DOC items).

### Completed Scans
- `docs/accuracy/feature-behavior`: **100%** (18/18 domains) — **35 findings** (8 critical, 11 high, 16 medium)
  - Findings: `findings/docs-accuracy-feature-behavior/2026-04-20-alerting.md`, `2026-04-20-batch-2.md`, `2026-04-20-batch-3.md`
  - Status: **Ready for triage** → run `/triage findings/docs-accuracy-feature-behavior/`
- `docs/coverage/undocumented-features`: **100%** (20/20 features) — **8 new findings + 3 enrichments** (3 high, 8 medium)
  - Findings: `findings/docs-coverage-undocumented-features/2026-04-21.md`
  - Key: Attachments (user-reported!), GenAI, Query Examples, Directory, Data Modelling, Links, Integration Wizard, DQ Dashboard
  - Status: **Ready for triage** → run `/triage findings/docs-coverage-undocumented-features/`

### Active Scans
None — all started scanners are complete.

### Recently Completed
- `docs/accuracy/config-options`: **100%** (2/2 targets) — **14 new findings + 6 enrichments** (3 critical, 5 high, 6 medium)
  - Findings: `findings/docs-accuracy-config-options/2026-04-21-platform.md`, `2026-04-21-collectors.md`
  - Key: Azure AD undocumented, S2S API key undocumented, secrets backend undocumented, 60 adapters with no config reference
  - Status: **Ready for triage** → run `/triage findings/docs-accuracy-config-options/`

## Next Actions

1. Run scanner: `scanners/navigation/ecosystem-map.md` (maps all repos, dependencies, versions)
2. Run scanner: `scanners/navigation/feature-entry-points.md` (populates navigation index)
3. Run scanner: `scanners/tests/collectors-sdk.md` (bounded scope, one session)
4. Run scanner: `scanners/tests/core-packages.md` (shared libraries — high blast radius)
5. Clone odd-docs repo for documentation scanners
6. Clone/fetch remote repos: odd-dbt, odd-spark-adapter, odd-airflow-2, odd-cli
