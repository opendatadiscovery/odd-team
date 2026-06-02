---
id: IT-NNN                      # integration-test id, sequential
title: ""                      # imperative — what this test confirms, <=80 chars
gates:                         # the regression contract — what a red result tells you broke
  validates: []                # [F-NNN]    — feature behaviour this confirms
  enforces: []                 # [ADR-NNNN] — architectural invariant this pins
  regresses: []                # [PLT-NNN]  — filed bug this guards against recurrence
test_class: integration
stack: odd-minimal             # the docker-compose stack profile (probe-stacks/) this needs
automation: ""                 # P-NNN probe id that automates this, OR "manual" if human-only
plan_ref: ""                   # test-plan.md batch id (e.g. I2)
status: draft                  # draft | ready | needs-fix
---

# IT-NNN — <title>

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` probe (if any) is a convenience rail
> that runs the same steps and writes the same result; it never replaces the
> protocol. Reproducible by construction: same preparation + same run = same check.

## 1. What this checks
<The single falsifiable claim, in one sentence. Then the operator-facing
consequence if it FAILS — why this regression matters. Cite the source finding/ADR.>

## 2. Preparation — build the test stand
<Everything needed BEFORE running. Each item: the human-readable intent + the exact
command. Anyone (or the probe) can reproduce this state.>

- **Stack**: bring up `<stack>` — `scripts/run-platform-tests.sh` is for unit; for
  the integration stack use the probe runtime, e.g.
  `cd lineage/_extractor && uv run python probe-runtime/runner.py <P-NNN> --dry-run`
  (the runner brings the stack up during a real run).
- **Auth/config**: <e.g. AUTH_TYPE=DISABLED (odd-minimal default) / LOGIN_FORM via a stack variant>.
- **Seed data**: <the SQL/ingestion payload to insert — the arrange step>.

## 3. Readiness check — is the stand ready?
<How to confirm the stand is UP and in the expected starting state before you run.
Do NOT start the run until these pass.>

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `<SQL SELECT confirming the seed row exists>`

## 4. Run protocol — what to run
<The explicit ordered steps (the act). Human-executable; the probe automates the same.>

1. <step 1 — the exact request/command>
2. <step 2 …>

**Automated rail**: `cd lineage/_extractor && uv run python probe-runtime/runner.py <P-NNN>`
(or via the suite: `integration-tests/run-suite.sh <suite>`).

## 5. What it checks — assertions
<The observe + assert. State PASS and FAIL conditions explicitly so a human and the
probe reach the same verdict.>

- **PASS** when: <the measurable expected outcome>.
- **FAIL** when: <the regression signature — what the bug looks like>.

## 6. Result log
Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`
(the probe runtime also writes its machine trace to `lineage/odd-platform/probe-runs/`).
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: <F-NNN H-NNN / ADR-NNNN / PLT-NNN / TEST-GAP-NNN>
- Plan: `lineage/odd-platform/test-plan.md` batch <I-N>
- Automation probe: `lineage/odd-platform/probes/<P-NNN>.yaml`
