---
playbook: reproduce-first
status: active
since: 2026-06-09
applies_to: pillar:contributor
---

# PROTOCOL reproduce-first

You do not fix what you have not reproduced. A patch written without a reproduction is a guess dressed as a fix — and the field evidence is unforgiving: reproduce-first is the single largest improvement lever in agentic SWE (20-28 points), because the failing reproduction's stack trace localizes the bug, and localization is the dominant failure point. It is also our own hardest-won lesson: `retrospectives/LSN-031` — static code analysis cannot tell you what the running system does. This protocol turns a bug report into a failing test on the running system before a single line of fix is written.

## trigger

A `/contribute` run on an issue classified as a **bug** (phase B), before any code change.

## inputs

- the issue's reported behaviour + any setup it names (auth mode, config, the exact request)
- the local stack (docker-compose) + the IT/Playwright + probe harness (`integration-tests/`, `.claude/agents/probe-runner.md`)

## procedure

1. **Bring up the running system** the issue describes. The default is the shipped `odd-minimal` stack (`AUTH_TYPE=DISABLED`); match any config the issue names. If the issue's setup is under-specified such that you CANNOT stand it up, that is the one case where a clarifying question is warranted (G-C6) — ask it; do not guess the setup.

2. **Reproduce the broken behaviour live** and CAPTURE the observation verbatim — the exact `curl` (status + body) or the UI state (the rendered screen, the count, the error). This observation is the ground truth (`retrospectives/LSN-031`): drive the feature; do not infer it from the diff. Record it in the CTRIB `reproduced:` field with the command and the output.

3. **Decide what you reproduced.** Is it a bug, or expected behaviour, a docs gap, or a misunderstanding? A reproduction that shows the *documented* behaviour is not a bug — reclassify and stop (PROBE-1). Check the front-end transform and any sibling endpoint on the same screen — the running symptom can differ from the back-end (`retrospectives/LSN-031`, the PLT-176 class).

4. **Write the failing test against the reproduction** (the test-first half). Unit where the bug is unit-localizable (the failing condition injected explicitly — e.g. `ReflectionTestUtils.setField` for a null path), integration where the symptom is e2e. The test must FAIL on the current code for the reproduced reason. If an existing characterization `@pins` already asserts the buggy behaviour, that pin is your RED — it will flip GREEN on the fix (`retrospectives/LSN-029`), never deleted.

5. **Only now fix** (after GATE 1). The fix makes the failing test pass. Then **re-drive the running system** and **run the FULL suite** (not just the new test) — a patch that passes its own test but not the suite is overfit (G-C2). The reproduction observation, re-run post-fix, must now show the correct behaviour.

## exit

- The CTRIB `reproduced:` field carries the live observation (command + output).
- A test exists that failed pre-fix for the reproduced reason and passes post-fix.
- The full suite is green; the running system, re-driven, shows the corrected behaviour.
- If NOT reproducible: the run did not produce a fix — it produced either a clarifying question or a reclassification (expected-behaviour / docs / misunderstanding), recorded in the CTRIB record.

## on-fail

- Cannot reproduce after a genuine attempt → do NOT fix. Ask the one setup-clarifying question (G-C6), or reclassify and propose close/doc. A "fix" with no reproduction is rejected at `/review`.
- The reproduction shows documented/expected behaviour → reclassify; the deliverable is an explanatory comment, not a code change.
- The fix passes the new test but the full suite goes red → the change is incomplete or wrong; it is not done (G-C2).

## case-law

- `retrospectives/LSN-031` — the running system is the only authority for user-facing behaviour; static code analysis ships false claims (PLT-176: the back end fanned out, the front end de-duped, the count badge contradicted the list — found only by driving the UI).
- `retrospectives/LSN-029` — a characterization pin asserts the CURRENT (buggy) behaviour; it is the RED that flips GREEN on the fix, never deleted, never used as fix-evidence.
- `adrs/drafts/research/contributor/EXTERNAL-PRACTICE.md` — reproduce-first / failing-test-first raises resolution rates; localization is the top failure point.
- `adrs/drafts/research/contributor/PITFALLS.md` #1-2 — hallucinated fixes + test overfitting; the mitigations live here.
