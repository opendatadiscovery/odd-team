---
id: LSN-029
title: A disabled test is blind — pin a known bug by characterizing its current incorrect behaviour, never @Disabled
date: 2026-06-02
domain: tests
severity: high
gates_informed:
  - tests-axis @pins / status=pins-known-bug convention (lineage/_extractor/.../extractors/tests.py)
  - feedback_tests_as_deterministic_gates
status: closed
---

# LSN-029: A disabled test is blind — pin a known bug by characterizing its current incorrect behaviour, never @Disabled

## What happened

On 2026-06-02, building the odd-platform unit-test branch, the structural regression pin for
the still-open LSN-002 MinIO-region bug (`MinioConfigRegionTest`) was authored as a RED
**aspiration** test — it asserted the *fix* was present (`src.contains(".region(")`). Because
that fix is not in the code, the test failed; and because a failing test fails the gradle
build, it would have blocked merging the branch's three GREEN ADR/feature pins. The reflex
fix was to quarantine it with `@Disabled`, mirroring the integration suite's known-bugs
quarantine. The maintainer rejected this: **a disabled test runs nothing, so it is blind.**
If `MinioConfig`'s region handling later changed — someone adds `.region(...)` as a side
effect, refactors the builder, or deepens the regression — nothing fires, and the change
ships undocumented and unplanned. We would lose the record of *what* changed and *why*.

## Why it slipped

The test taxonomy carried only two shapes: a GREEN **guard** (asserts correct behaviour;
`@regresses` a *fixed* bug) and an implicit "RED until fixed" **aspiration**. For a bug we
deliberately choose *not* to fix yet, both shapes fail — the aspiration breaks the build,
and disabling it goes blind. There was no first-class concept of *pinning an open bug's
current behaviour as a live tripwire*, and the ontology had no status to make such pins
navigable. So the path of least resistance was `@Disabled`, which looks like coverage but
provides none — the exact "test theatre" the deterministic-gates rule exists to forbid.

## Rule that emerged

**Pin known bugs; never disable them.** A bug we choose not to fix yet gets a
**characterization** test that asserts its *documented-incorrect* behaviour — GREEN while the
bug exists, RED the instant the behaviour changes — never `@Disabled`, never a build-breaking
RED aspiration. The test declares `@pins <bug-id>` (distinct from `@regresses`, which guards
a *fixed* bug from re-introduction) and carries full in-source documentation: why it exists,
the references (LSN / PLT / ADR), that it asserts the wrong behaviour *on purpose*, and the
**flip protocol** — on RED, decide *intentional planned fix* (→ invert the test to assert the
correct behaviour, change `@pins` to `@regresses`, move the id from `pins:` to `regresses:`
in `test-gates.yaml`, close the bug) vs *unplanned change* (→ stop and investigate before it
ships). The ontology carries an explicit, navigable `status: pins-known-bug` (the extractor's
`@pins` tag → `pins` field → `status`; the `/align` scorecard's "known-bug pins" census line;
a JUnit `@Tag("known-bug")` for runner-level filtering) so the known-bug register is queryable
rather than buried in a comment. **We only fix bugs intentionally** — the tripwire guarantees
an unplanned behaviour change cannot ship silently.

## Forcing question

For a bug we are choosing not to fix yet: does a test assert its *current incorrect* behaviour
as a live GREEN tripwire — so any change to that behaviour, planned or not, turns it RED —
rather than being `@Disabled` (blind) or left RED (build-breaking)?

## References

- `odd-platform-api/.../config/MinioConfigRegionTest.java` — the characterization pin + the in-source flip protocol (`@pins PLT-086`, `@Tag("known-bug")`, `doesNotContain(".region(")`)
- `lineage/_extractor/src/lineage_extractor/extractors/tests.py` — the `@pins` / `status=pins-known-bug` convention (module docstring + `_PINS_RE` + status derivation)
- `lineage/odd-platform/test-gates.yaml` — the `pins: [PLT-086]` gate entry + the known-bug-pin comment
- `lineage/odd-platform/alignment-scorecard.md` — the "known-bug pins (characterization tripwires)" navigable census line
- LSN-002 (the open bug being pinned) · PLT-086 Defect 2 (the tracked fix)
- `feedback_tests_as_deterministic_gates` (memory) — every test gates an ontology relation; no orphan tests; a disabled test is the orphan's blind cousin
