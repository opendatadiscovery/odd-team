---
id: LSN-033
title: "The System Under Test is a run-time parameter (default: the working tree) — not a property of the test"
date: 2026-06-10
gates: [G-C2, tests-pillar-SUT]
pillars: [tests, contributor]
supersedes_partial: LSN-032
surfaced_by: "maintainer review of IT-126 — the protocol pinned a frozen image tag"
---

# LSN-033 — the SUT is a run parameter, defaulting to the working tree

## The miss

IT-126's protocol pinned `ODD_PLATFORM_IMAGE=odd-platform:contrib-CTRIB-001` — a frozen image built once,
at the moment of the fix. Every future run of that "regression" test would re-verify a fix against a fossil:
it would go green no matter what a later feature broke in the Activity feed, because it never looks at the
later code. **A regression test welded to a fixed artifact is a museum exhibit — it manufactures exactly the
false confidence it claims to prevent.**

This is the same class of error LSN-032 named, one level up. LSN-032 said "don't validate a fix against the
published image — build from the branch." Correct direction — but I implemented even *that* as a per-fix
frozen tag, which re-froze the SUT. LSN-032 was a half-step; this is the completion.

## The principle

**What a test verifies (its assertion) and which artifact it runs against (the System Under Test) are
orthogonal. The test is the question; the SUT is the subject. The subject is chosen at RUN time — and the
default subject is "what I'm building right now."**

A test must never name an image, a tag, or a commit. The operator (a contributor, CI, a release manager)
selects the SUT at invocation:

| `ODD_SUT` | Subject | Use |
|---|---|---|
| **`working`** (DEFAULT) | the checked-out working tree, **uncommitted included** | the odd-team member's normal loop: "run the regression + my new feature on what I'm building now" |
| `main` | HEAD of `origin/main` (throwaway worktree) | "is main green?" / the integration baseline |
| `ref:<tag\|sha>` | a specific ref (throwaway worktree) | a release candidate, a bisect point |
| `published` / `published:<version>` | the shipped ghcr image (`:latest` **moves** = current release, verified 2026-06 to track the newest semver; pin `:<version>` to reproduce) | "does the *released* build have this?" / reproduce-against-prod / the RED half of a fix proof |

The tests and the compose stack reference a **stable** name (`odd-platform:odd-team-sut`); the harness
**re-materialises** that name from the selected source on **every** run. Regression is therefore always
measured against the subject you chose — never a snapshot.

## The mechanism

- `integration-tests/build-sut.sh` materialises `odd-platform:odd-team-sut` from `$ODD_SUT` (Jib for the
  source modes — UI bundled; `docker pull`+retag for published). Default `working`.
- `integration-tests/run-suite.sh` calls it before bring-up (unless an explicit `$ODD_PLATFORM_IMAGE`
  raw-image override is set), and recreates the stack when the SUT image changed.
- The contributor RED→GREEN needs **no frozen tags**: GREEN = `working` (the branch), RED = `ref:main` or
  `published` (the bug's home). For CTRIB-001: `run-suite.sh IT-126` → GREEN; `ODD_SUT=ref:main … IT-126` → RED.

## The gate

- `pillars/tests/pillar.md` — the SUT-selection section: no test/protocol names a frozen artifact; the SUT
  is a run parameter, default working tree, across unit + integration + CI + the contributor loop.
- `pillars/contributor/gates.md` G-C2 + `SKILL.md` — GREEN=`working`, RED=`ref:main`/`published`; never a `contrib-*` pin.
- `integration-tests/protocols/IT-*.md` — protocols document `ODD_SUT`, never an image tag.

## General rule

When you write a test, ask two separate questions: *what behaviour does this assert?* (the test, forever)
and *which build am I asserting it about?* (a run choice, defaulting to my working tree). Conflating them —
baking the second into the first — is how a test stops measuring reality. The default must be the live
working tree, because the most common question is "did I just break something, here, now?"
