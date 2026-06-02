# Integration tests — the local, reproducible, human-carryable suite

This is the **integration** half of the testing framework (the unit half is
JUnit-in-CI under `../odd-platform`, run via `scripts/run-platform-tests.sh`).
Integration tests are **managed here, run only locally**, and exist so that when a
feature is implemented or a bug fixed, you can run an integration suite alongside
the unit suite and get **measurable regression coverage**.

## Principles (why this shape)

1. **Protocol-first, not ad-hoc.** Every integration test is a **protocol document**
   (`protocols/IT-NNN-*.md`) with a fixed structure: *what it checks · preparation ·
   readiness check · run protocol · assertions · result log*. The document is the
   source of truth.
2. **Human-carryable.** A person can execute every step from the protocol alone, with
   no tooling. AI assistance runs it first, but the methodology is the human's to repeat.
3. **Automation lives inside the protocol.** A protocol's run + check steps may be
   automated by a probe (`lineage/odd-platform/probes/P-NNN.yaml`, executed by the
   probe runtime) — that's the convenience rail, never a replacement for the documented
   steps. Same preparation + same run ⇒ same verdict.
4. **Local-only.** Stacks are ephemeral docker-compose mirrors (`lineage/_extractor/probe-stacks/`).
   No remote infrastructure, no daemon (APPROACH.md Rule 12).
5. **Logged + reproducible.** Every run appends a dated entry to `run-log/` recording
   the stack commit, who/what ran it, the outcome, and the captured evidence — so a
   result is auditable and re-runnable.

## Layout

```
integration-tests/
  README.md          this file
  TEMPLATE.md        the protocol template (copy to author a new IT-NNN)
  suites.yaml        named suites — which protocols run together (maps to test-plan I-batches)
  run-suite.sh       run a suite locally: prepare → readiness → run (probe) → log
  protocols/
    IT-NNN-{slug}.md one protocol per integration test
  run-log/
    {date}-{suite}.md appended run records (the reproducible evidence trail)
```

## Each test is gated (the regression contract)

Every protocol declares `gates:` — `validates: [F-NNN]` / `enforces: [ADR-NNNN]` /
`regresses: [PLT-NNN]`. That is *what a red result tells you broke*. The gates are the
same vocabulary as the unit gate-map (`lineage/odd-platform/test-gates.yaml`) and the
`/align` Test-Traceability Ledger — so unit + integration coverage roll up into one
regression picture. No protocol is an orphan.

## How to run a suite (local)

```bash
# prerequisites: Docker running; uv installed; platform image cached (odd-platform:latest)
integration-tests/run-suite.sh feature-complete       # run a named suite from suites.yaml
integration-tests/run-suite.sh --list                 # list suites + their protocols
integration-tests/run-suite.sh IT-001                 # run a single protocol by id
```

The runner brings up each protocol's stack, runs its automation probe, and appends a
result to `run-log/`. For a **manual** protocol (`automation: manual`), the runner prints
the protocol's steps for a human to execute and prompts for the PASS/FAIL + evidence to log.

## How to add an integration test

1. `cp TEMPLATE.md protocols/IT-NNN-{slug}.md`; fill every section; set `gates:` + `stack:` + `automation:`.
2. If automated: author/define the probe (`/probe-define` → `lineage/odd-platform/probes/P-NNN.yaml`),
   set `automation: P-NNN`. The probe's arrange/act/observe/assert mirrors the protocol's
   preparation/run/check.
3. Add the protocol id to the relevant suite in `suites.yaml`.
4. Run it (`run-suite.sh IT-NNN`); confirm the run-log entry; commit the protocol + log.

## Relationship to the test plan

`lineage/odd-platform/test-plan.md` (Step 1, "define") lists the integration batches
**I1–I10**. Each batch becomes a suite here; each batch entry becomes an `IT-NNN` protocol.
Implementing batch I-N (Step 3) = authoring its protocols + probes here; running it (Step 4)
= `run-suite.sh I-N` with the result logged.
