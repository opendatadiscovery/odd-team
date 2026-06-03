# Phase 3 — Integration e2e build-out (ACTIVE, started 2026-06-03)

Cross-context brain for the integration-suite build-out. The /loop reads this first (with README.md + TEMPLATE.md + suites.yaml). Memory: `project_phase3_integration_e2e_buildout`.

## Mandate (maintainer, 2026-06-03)
Build the **integration (e2e) suite in THIS repo** (odd-team, `integration-tests/`) that verifies **real end-to-end feature behaviour (UI→backend→DB)** for the ontology's features. Grounded in the **feature-flows** (113 features) + the **documentation** (../documentation feature descriptions) + the **refined test-gaps** (1038 gaps; 253 `missing-integration` is the prime pool). **Success path + ≥1 negative path** per feature. Follow the **IT-NNN protocol**. Target **~200 tests** across 120+ features (north star; phased + prioritised by criticality). NEVER add integration tests to odd-platform; NEVER touch odd-platform src/main.

## Pipeline — VALIDATED 2026-06-03 ✅
`run-suite.sh smoke` ran end-to-end: stack-up → P-001 probe **PASS** → wrote probe-runs/ artefact + merged probe-verification into 2 sidecars + stamped feature-flows.yaml + logged run-log/2026-06-03-smoke.md; stack torn down clean. Docker 29.5.2 (client+server). e2e deps installed (e2e/node_modules + playwright). The agent CAN run the suite = the RED gate.
- **6 stacks** in `lineage/_extractor/probe-stacks/`: odd-minimal (core platform), odd-loginform, odd-ldap, odd-minio (REMOTE attachments), odd-notifications (+ -ha). Collector-integration features (GE/Airflow/webhook collectors) have NO stack yet → stack-blocked (build a stack = maintainer's call).
- **Two rails** (per protocol `automation:`): `e2e:specs/{slug}.spec.ts` (Playwright real browser — for user-facing features) · `P-NNN` (API probe via lineage/_extractor/probe-runtime — backend/DB sub-checks). A UI feature's integration test IS the e2e; the probe is a backend sub-check under it.
- **Pace reality:** each IT = stack-up (~2-3 min) + run + teardown; e2e (browser) longer. ~200 ITs is many hours of run time + authoring → long phased build-out; ping at milestones, not per-test.

## e2e spec pattern (from view-count-overview.spec.ts)
`import {test,expect} from '@playwright/test'` + helpers from `../helpers/db` (seedEntity, readViewCount, ENTITY_ID) and per-stack helpers (`../helpers/stack`, ldap-stack, minio-stack, …). Header javadoc: IT-NNN — F-NNN, the user scenario; protocol path; gates (validates F-NNN / regresses|pins); why-e2e-not-probe; EXPECTED RESULT. `test.describe('F-NNN feature — scenario', …) → test('assertion', async ({page}) => { arrange: seed via DB helper → act: page.goto(route)+waits → assert: read state (DB helper or UI) + expect })`. Gotchas (memory reference_odd_platform_e2e_route_interception): snake_case wire vs camelCase client; react-query initialData masks early assertions (waitForResponse first); response-interception needs an applied-guard. Seed via DB (helpers/db.ts), not API, for deterministic preconditions.

## Existing coverage (12 ITs — do NOT duplicate)
IT-001 F-001 view_count probe (smoke) · IT-002 F-001 view_count UI (pins PLT-104) · IT-003 search tsquery poison (PLT-090/127) · IT-004 DQ unknown-status (PLT-052) · IT-005 Top Tags ordering (PLT-026) · IT-006 SPA error boundary (TEST-GAP-1013) · IT-007 LOCAL attachment durability (LSN-001/PLT-086) · IT-008 REMOTE attachment round-trip (minio) · IT-009 auth-mode boundary · IT-010 LDAP RBAC · IT-011 notifications WAL lifecycle · IT-012 WAL failover. Suites in suites.yaml: smoke / feature-complete (green) / known-bugs (red pins) / ui-e2e.

## Per-IT pipeline (each loop iteration)
1. Pick next highest-criticality feature NOT yet IT-covered (cross-check this file + suites.yaml + protocols/). Core-platform → odd-minimal; defer stack-blocked.
2. Read feature-flow detail + its doc (../documentation) + its missing-integration test-gaps. REFINE the gaps (rescope/merge/drop).
3. Author protocols/IT-NNN-{slug}.md (copy TEMPLATE.md) + e2e spec (or probe). Success + ≥1 negative. Reuse helpers; add db.ts seed/read helpers as needed.
4. RUN via run-suite.sh (RED gate; run-to-resolve — a real failure is a found bug → pin in known-bugs, or a spec bug → fix). Never register a pass without a run.
5. Register in suites.yaml + run-log/; commit (heredoc, IT-NNN id); mark the test-gap covered.
6. Every ~5 ITs: re-ingest the ontology + record the count here.

## Progress log (one line per new IT)
- 2026-06-03 — PHASE 3 kickoff + pipeline VALIDATED (smoke green; harness operational; 6 stacks; Docker 29.5.2). Existing baseline: 12 ITs (IT-001..012). Next: author the first NEW IT for a high-criticality uncovered core-platform feature on odd-minimal (success + negative).

## Stack-blocked (needs a docker stack that doesn't exist yet — maintainer's call to build)
- (none logged yet — collector-integration features GE/Airflow/webhook will land here when reached)
