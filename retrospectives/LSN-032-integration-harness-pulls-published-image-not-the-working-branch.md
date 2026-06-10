---
id: LSN-032
title: "Integration validation must build from the working branch — the harness pulls the published image"
date: 2026-06-09
gates: [G-C2, G-C10]
pillars: [contributor, tests]
surfaced_by: "maintainer review of the first /contribute run (CTRIB-001 / PR #1745)"
---

# LSN-032 — the integration harness tests the PUBLISHED image, not your fix

## The miss

The first `/contribute` run (CTRIB-001, the activity-feed fan-out, PR #1745) opened the draft PR with the
**unit** bucket green (full `:odd-platform-api:build`, 432 tests, on the working branch) — but **never ran
the integration bucket**, and skipped the docs-verification and ontology-refresh phases, jumping from the
unit run straight to the PR. The maintainer caught it.

Worse than "skipped": had the integration suite been run as wired, it would have **falsely passed**. The
integration harness (`lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml`) pulls
`image: ghcr.io/opendatadiscovery/odd-platform:latest` — the **published** image, which still contains the
bug. The IT would have driven the buggy upstream backend, not the branch's fix → a green that proves
nothing. **Verify-the-running-system (LSN-031) is only true if the running system is YOUR system.**

## Why it happened

The probe/ontology harness was built for the *reverse-engineering* use case: bring up the **published**
image and observe upstream's real behaviour. That is correct for deriving the ontology. It is exactly
**wrong** for the contributor use case: validating a fix requires the running system to be built **from the
working branch**. The same docker-compose served two opposite intents, and nothing in `/contribute` forced
the contributor intent (build-from-branch) or made the integration run a hard gate before the PR.

## The rule

A contributor fix is **not done** until BOTH buckets are green **on the working branch**, plus docs and
ontology:

1. **Unit** — the FULL CI replica on the branch: `scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build` = test + checkstyle + assemble). Not a bare `:test` (blind to checkstyle).
2. **Integration** — the `IT-NNN` suite against an odd-platform image **built from the branch**, never `ghcr…:latest`. **⚠️ Refined by `LSN-033`: the build-from-branch must NOT be a frozen per-fix tag (that re-freezes the SUT — the exact mistake this fix shipped first). The System Under Test is a run parameter: `integration-tests/run-suite.sh` builds `odd-platform:odd-team-sut` from `$ODD_SUT` (default = the working tree) on every run, via `build-sut.sh`. Just `integration-tests/run-suite.sh IT-NNN`.**
3. **Docs** — READ the affected page and decide (change, or "no change + why"); never assert without reading (the fan-out fix's "no doc change" was only trustworthy after reading `activity-feed.md`).
4. **Ontology** — re-enrich the touched sidecar(s) + re-embed the graph, COMMITTED. A code change silently invalidates the sidecar that described the old shape (CTRIB-001 left `ReactiveActivityRepositoryImpl`'s sidecar saying "LEFT JOIN" after the fix made it `EXISTS`).

These four are a **Definition of Done** checklist that gates un-drafting / merging the PR — not optional trailing phases.

## The gate

- `/contribute` SKILL phase 11 split into 11-unit (full build, branch) + 11b-integration (branch image, the build-from-branch commands) + a **Definition of Done** block before the draft-PR phase.
- `pillars/contributor/gates.md` G-C2 (full build + build-from-branch integration) and G-C10 (docs READ + ontology committed); a DoD acceptance criterion (#11).
- `odd-minimal.docker-compose.yml` parameterised (`ODD_PLATFORM_IMAGE`).

## General rule

When one tool serves both "observe the published system" and "validate my change," the default must be
explicit and the change-validation path must force build-from-source. A green test against the wrong
artifact is more dangerous than no test — it manufactures false confidence. Always ask: *which binary did
this test actually exercise?*
