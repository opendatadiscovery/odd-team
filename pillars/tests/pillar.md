---
pillar: tests
status: active
since: 2026-06-04
---

# Tests Pillar — the bar

## Why this pillar exists

The ODD platform's behaviour was reverse-engineered into an ontology of **features** (user-observable promises) plus **ADRs** (backbone decisions) plus **caveats / bugs / known limitations** (where the code drifts from intent). None of that is trustworthy until it is **pinned by a test that fails the instant reality changes.** This pillar turns the ontology's promises into a verification fabric: every feature pinned, every documented caveat/bug/limitation pinned, every ADR guarded against silent violation.

A test that does not trace back to a promise, an ADR, or a bug is noise. A promise with no test is an unverified claim. This pillar exists to keep both halves honest and to keep the **count** honest — because the failure mode that created this pillar (2026-06-04) was not bad tests, it was *four different numbers for "how many tests are missing"* depending on which file you opened.

## The bar: every user-observable promise is pinned, and the number never lies

World-class for this pillar is a single, regenerable scoreboard where:

- **Every feature's promises are verified** by a real test, or explicitly deferred with a written reason — never silently uncounted.
- **Every test carries a typed gate** naming what it protects (`validates` a feature / `enforces` an ADR / `pins` or `regresses` a bug). No orphan tests.
- **The number is derived, not asserted.** "How many features are unverified" is a query over the source of truth, not a hand-maintained tally that drifts the moment a session forgets to update it.
- **A red→green flip is a measured event** — closing a known-bug pin *is* the regression-closure metric, not a vibe.

There is no middle ground. Either the scoreboard is the truth and every change moves it, or it is decoration and the pillar has failed.

## The taxonomy — two buckets, settled (stop re-litigating it)

ODD distinguishes tests **functionally**, by what boundary they cross — not by tooling fashion.

| Kind | Functional definition | Canonical home | Runs in |
|---|---|---|---|
| **Unit** | Stays inside **one** framework / language / process. Collaborators are mocked. No real boundary is crossed. | `odd-platform/*/src/test/` | **odd-platform CI/CD** — Gradle `build` + JaCoCo coverage gate, on every PR |
| **Integration** | Crosses **≥1 real boundary**: the DB, another process/service, a 3rd party (Slack, S3/MinIO, LDAP, OAuth IdP), a collector, or the browser. | **odd-team `integration-tests/`** | maintainer-run `integration-tests/run-suite.sh` with documented docker-compose prep |

**The e2e-vs-integration argument is dissolved.** A browser UI→backend→DB flow is the *user-observable subset* of integration; adding a collector or a 3rd-party webhook is the *cross-system subset*. Both are **integration**, both live in odd-team. "e2e" is a sub-label, **not a third bucket**. We do not argue about it again.

**The home rule (the practical discriminator).** The deciding question is *not* "does it touch a DB?" — it is **"does it need external orchestration (a docker-compose stack, a browser, a real 3rd party) plus a written run protocol?"**
- **No → odd-platform CI.** Anything that runs inside `./gradlew build` belongs here: pure unit (Mockito/StepVerifier), WebFlux slice (`@WebFluxTest` / `WebTestClient`), and **in-process Testcontainers DB tests** (`BaseIntegrationTest`). Crossing the DB via Testcontainers is still CI-resident — it needs no separate protocol.
- **Yes → odd-team `integration-tests/`.** Browser e2e (Playwright), collectors, Slack/S3-MinIO/LDAP/OAuth, multi-replica failover — anything requiring `run-suite.sh` + a docker-compose `IT-NNN` protocol with documented preparation.

### Probes are not a bucket

A **probe** (`P-NNN`) is a one-shot measurement run against an ephemeral local stack to turn an *inferred* hypothesis into a *measured* fact cheaply — its job is to de-risk authoring the durable test. A `PROBED` test-matrix cell is **not coverage**. Every probe worth keeping **graduates** into a unit or integration test that lives in CI/the suite and carries a gate; the rest are discarded. Probes are scaffolding, never a deliverable.

## The closure unit — the promise

A feature is **verified** when every falsifiable promise in its `use_cases` block (the LSN-030 promise layer) has `coverage: verified`, where *verified* means a real test (unit **or** integration) exists, runs in its CI/suite, **and** carries a typed gate linking it back.

- **Confirmed** promise → a **GREEN lock** test that fails if the working behaviour regresses.
- **Contradicted** promise (= a bug / caveat / known limitation) → a **RED characterization pin** (`pins:`, LSN-029) asserting the *current incorrect* behaviour; it flips green the instant the real fix lands, at which point it is inverted to `regresses:`. Never `@Disabled` — a disabled test is blind. **This is how caveats/bugs/limitations get pinned.**
- **ADR** → an `enforces` test (the `AdrXxxScanTest` structural-contract pattern, e.g. `AdrSecurityRulesContractTest`).

This single definition dissolves the recurring questions: *is it a test or a finding?* (a finding is a promise without coverage); *unit or integration?* (a per-promise routing decision); *what's left?* (total promises − verified, routed by layer).

## The System Under Test is a run parameter (default: the working tree)

**What a test verifies and which build it runs against are orthogonal.** A test is the question; the SUT is the *subject*. The subject is chosen at RUN time — never baked into the test, the protocol, or the compose stack. Welding a fixed artifact into a test turns regression into a museum exhibit: it re-verifies one frozen moment and goes green no matter what later code breaks (`retrospectives/LSN-033`, completing `LSN-032`). Unit tests are already SUT-agnostic — `./gradlew build` compiles whatever is checked out. Integration tests reach the same property via `integration-tests/build-sut.sh`, which re-materialises the stable tag `odd-platform:odd-team-sut` from `$ODD_SUT` on every `run-suite.sh` run:

| `ODD_SUT` | Subject | Mechanism |
|---|---|---|
| **`working`** (default) | the checked-out working tree, **uncommitted included** | gradle (unit) / Jib (image) from the working tree |
| `main` | HEAD of `origin/main` | throwaway worktree → build |
| `ref:<tag\|sha>` | a release candidate / a bisect point | throwaway worktree → build |
| `published` / `published:<version>` | the shipped ghcr image — `:latest` is the **moving** current release (not reproducible over time); a pinned `:<version>` (semver, e.g. `0.27.13`) is reproducible | `docker pull` + retag |

The default is the working tree because the most common question an odd-team member asks is **"did I just break something, here, now?"** — run the full suite (unit + integration) against what you are building, then against `main` / a `ref` / `published` when you need a different subject. No `IT-*` protocol or test names a frozen image; the contributor RED→GREEN uses `working` (GREEN) vs `ref:main` / `published` (RED), not a per-fix tag.

## The traceability ledger — no orphan tests

Every test maps to what it protects via `lineage/odd-platform/test-gates.yaml` (retrofit, ontology-inferred) **or** an in-source declaration on new tests:

```
validates: [F-NNN]      # a feature promise
enforces:  [ADR-NNNN]   # a backbone decision
pins:      [PLT-NNN]    # a known, unfixed bug (current behaviour)
regresses: [PLT-NNN]    # a fixed bug (must not return)
covers:    [<node-id>]  # the code under test
```

The roll-up of this ledger is the **Test-Traceability Ledger** dimension of the alignment scorecard. An orphan test (no gate) and an unguarded promise (no test) are **both** findings.

## The single source of truth + the dashboard (where the numbers come from)

| Role | Artefact | Note |
|---|---|---|
| **Source of truth — per feature** | `lineage/odd-platform/feature-flows/detail/F-NNN.yaml` → `use_cases[].coverage` + `use_case_coverage` | the spine; 113 features |
| **Narrative source** | `lineage/odd-platform/feature-reflections/detail/F-NNN.yaml` | generates the promises |
| **Ledger — per test** | `lineage/odd-platform/test-gates.yaml` + in-source gates | who validates/enforces/pins what |
| **Dashboard — roll-up** | `lineage/odd-platform/alignment-scorecard.{md,yaml}` (`lineage-extractor alignment odd-platform`) | deterministic; **regenerate, never hand-edit** |
| **Driver — risk-ranked worklist** | `lineage/odd-platform/promise-test-worklist.md` | derived from the promise layer; point-in-time, not a maintained mirror |
| **Evidence (demoted)** | `lineage/odd-platform/test-map/detail/*.yaml` (TEST-GAP findings) | the older drift catalogue; citations, **not** the work driver |
| **RETIRED — stale mirrors** | flat `feature-flows.yaml` (5-feature May-19 seed), flat `test-map.yaml` (May-20 dump) | superseded by the detail dirs; retirement per ADR-0077 (contracts that read/write them must be repointed first) |

**Read order for "what's the state?":** the scorecard (dashboard) → the worklist (what to do next) → the per-feature detail (ground truth). Never the flat mirrors.

## The four lifecycle stages (the confusion this pillar ends)

"Test" was being used for four different things. They are distinct stages, not synonyms:

1. **Finding** — `TEST-GAP-NNN` (a note: "this behaviour is untested"). Evidence layer. No status.
2. **Promise** — `use_case` on a feature (a falsifiable user expectation). The unit of work. `coverage: unverified | verified`.
3. **Ready item** — `backlog/tests/TST-NNN` (an analyzed, acceptance-criteria'd work item) — used only when a test needs spec-ahead-of-code; most work flows promise→code directly.
4. **Implemented test** — a real `*Test.java` (unit, in CI) or `IT-NNN` (integration, in odd-team) carrying a gate.

"How many are missing" depends on the stage you mean — and the pillar's answer is always stated against stage 2 (promises), because that is the user-observable truth.

## The flip-on-fix checklist (red→green closure)

When a pinned bug's fix ships, the flip is COMPLETE only when **every surface encoding the
pin's red-state flips in the same commit**. The converge rule applies: `grep -rn IT-NNN`
across the workspace and classify EVERY hit — the primary feature's artefacts are never
the whole list. Surfaces:

1. **`integration-tests/suites.yaml` — the lane move** `known-bugs` → `feature-complete`
   (per the lane's own description, *that move IS the measurable regression closure*) +
   both lane comments + any I-batch comment naming the IT.
2. The protocol's `expected_result` (green-state wording, regression framing preserved).
3. The spec's header comment (`EXPECTED RESULT` line) — spec and protocol must agree.
4. `integration-tests/e2e/README.md` spec-index line.
5. **Every** `feature-flows/detail/*.yaml` referencing the IT — sibling features too, not
   only the primary: flip each `use_cases` entry (`coverage` / `test_ref` / `test_demand`)
   and the `use_case_coverage` count + note.
6. Probe asserts that pinned the old behaviour (`probes/P-NNN.yaml`, pre-authored flip).
7. Living index docs (`PHASE3-BUILDOUT.md` existing-coverage line; `test-plan.md`
   present-tense claims — bracket-annotate dated narratives, never rewrite them).
8. Graph re-embed (flows changed).

Dated artefacts (run-log entries, `feature-reflections/`, findings) keep their
point-in-time truth — never retro-edit those. Case-law: the IT-002 flip (#1764/CTRIB-004,
2026-06-11) shipped the protocol/probe/F-001 surfaces but missed the lane move, the spec
header, the README line, and the sibling flows F-141/F-176 — both `/contribute` and
`/review` missed the residue because neither ran the grep; the maintainer caught it
([[feedback-converge-claim-complete-not-instance-loop]] class, repeat instance).

## Success signals

- `scripts/run-platform-tests.sh` green in odd-platform CI on every PR (unit + JaCoCo gate).
- `integration-tests/run-suite.sh feature-complete` green; `known-bugs` red-by-design; every red→green move recorded as a regression closure **via the flip-on-fix checklist above**.
- Every `/contribute` implement AND every `/review` of a code change measures **FULL-set regression, both buckets** (full unit build on the exact commit + `feature-complete`/`multi-stack`/`known-bugs`) — the impacted tests are the inner loop, never the gate (maintainer directive 2026-06-11).
- The scorecard's promise-coverage frontier and Test-Traceability dimension climb batch over batch and **never silently regress**.
- A maintainer can ask "is F-NNN verified?" and get one answer from one place.

## Failure signals (any one means the bar slipped)

- Two artefacts report different counts for the same question (the original disease).
- A `PROBED` cell or a probe count is presented as "coverage".
- A test with no typed gate, or a CRITICAL/HIGH promise/caveat with no pin.
- A known bug pinned with `@Disabled` instead of a green characterization test (LSN-029).
- Tests written but stranded on an unmerged branch and counted as "done" (implemented ≠ in CI).
- Work driven from the TEST-GAP catalogue instead of the promise layer.

## What authoring sessions in this pillar load

`CLAUDE.md` (universal framework) + this file. The execution loop, gate annotations, and known-bug-pin protocol are case-lawed in `retrospectives/` — primarily **LSN-029** (characterization pins), **LSN-030** (the promise layer), and **ADR-0077** (mirror retirement). The risk-ranked worklist (`promise-test-worklist.md`) is the per-session driver.

## Scope

This pillar governs the **verification fabric** for the platform: unit tests in `odd-platform`, integration tests in `odd-team/integration-tests/`, the promise-coverage source of truth, the traceability ledger, and the scorecard. It does **not** author the promises (that is the feature-reflector's contract) nor decide architecture (that is the ADR pillar). Security-exploit reproductions follow the responsible-disclosure flow, never a public bug-pin that hands an attacker a recipe.
