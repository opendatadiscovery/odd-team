---
playbook: release-review
status: active
since: 2026-06-18
applies_to: universal
---

# PROTOCOL release-review

The comprehensive review of a **shipped release** of a target repo — the answer to "is this release done correctly: tested, documented, real-instance-true, and reflected in the ontology?" It is the umbrella `/review release:{version}` runs; the documentation-publication gate (`playbooks/release-train-merge.md`) is **one** of its seven checks, not the whole of it.

The mandate that makes this a *release* review rather than a doc-merge: a release is a **code + test + doc + ontology bundle**, verified against the *published artifact* (the tag and the ghcr image), never against local `main` or a stale build. Each check below yields a cited verdict; the only things that reach the maintainer are genuine decisions (security disclosure timing, re-targeting), not process.

## trigger

- The maintainer announces release `{version}` is published (`/review release:{version}`); or
- `/status` / `/orient` detect: `GET /repos/{org}/{repo}/releases/latest` returns a tag whose documentation train still exists, **or** a closed milestone has `pending-release` backlog items, **or** the ontology `manifest.yaml` `last_scan_commit` is behind the latest release tag.

## inputs

- `{version}` — the release tag == the milestone title (plain semver, e.g. `0.28.0`).
- `{prev-tag}` — the previous release tag: `git -C ../{repo} fetch --tags && git -C ../{repo} tag --sort=-v:refname` → the entry immediately before `{version}`.
- **the release delta** (the backbone of the whole review): `git -C ../{repo} log --oneline {prev-tag}..{version}` and `git -C ../{repo} diff --stat {prev-tag}..{version}`. Derived, never a state file.
- the milestone's closed issues: `GET /repos/{org}/{repo}/issues?milestone={n}&state=closed` (find `{n}` via `…/milestones?state=all`). Use `/search/issues?q=…milestone:{version}…` for the authoritative `total_count`.
- the documentation train `release/{version}` + the pending-release manifest: `grep -rl 'milestone: "{version}"' backlog/ contributor/` (**`contributor/` is not optional** — CTRIB items are the largest producer of release-gated work; a `backlog/`-only grep hid 22 stale items for 10 weeks, `retrospectives/LSN-041`. Re-measured 2026-08-30 for 1.0.0: `backlog/` alone finds 9, `contributor/` holds 22 more, 19 of them already `pending-release`).

## procedure

Run the seven checks in order; 1-3 and 5-6 are independent and may be parallelised. **No check is skippable** — a check that cannot run states the concrete reason and proceeds.

### 1 — Release delta → coverage matrix (code ↔ doc ↔ milestone)

Classify every commit in `{prev-tag}..{version}` as user-facing or internal. For each **user-facing** change, find its doc commit on `release/{version}` **or** a recorded "no doc needed + why" (e.g. a CTRIB record). Cross-check the milestone's closed **issues**: each must be matched by docs / a no-doc record / a flag — this catches code merged outside the agent flows and makes the milestone a verified bundle. Any user-facing change with no doc coverage is a finding (`playbooks/follow-up-on-disk.md`).

### 2 — Full test suite on the RELEASED version (unit + IT) — MANDATORY, both buckets

The single hardest gate: **every test we have, run against the published artifact, green.** Per `memory/feedback_canonical_suite_run_is_the_gate` — per-subset green ≠ release green; the SUT is a run-parameter and must be pinned to the *released* build, never a stale local one (`retrospectives/LSN-032` + `LSN-033`).

- **Unit** — the full CI-replica build on the released tag. Put the tree at the tag (`git -C ../{repo} checkout {version}` detached, or a `ref:{version}` worktree), run `scripts/run-platform-tests.sh` (no-arg = `build`: test + checkstyleMain + checkstyleTest), **read actual pass/fail + checkstyle counts, not the exit code**, then restore the tree. Red = the published release fails its own tests = CRITICAL.
- **Integration / e2e** — the IT suite against an SUT pinned to the released image:
  `ODD_SUT=published:{version} integration-tests/run-suite.sh {suite}` (`build-sut.sh published:{version}` pulls `ghcr.io/{org}/{repo}:{version}` and retags — pinned + reproducible). Run **every** suite, one e2e at a time, never concurrent with a possible maintainer run:
  - `feature-complete` → must be GREEN
  - `multi-stack` → GREEN-target
  - `ingestion-e2e` → GREEN-target (real source→collector→platform stand)
  - `known-bugs` → expected RED; an unexpected **GREEN** means a fix shipped in `{version}` un-flipped → tests-pillar flip-on-fix checklist + a release finding.
  Read actual pass/fail counts, not exit codes.

A red unit or IT suite on `{version}` is a **CRITICAL** finding — do not flip any item to `done`; surface immediately (the release is broken, fix-forward).

### 3 — Real-instance verification on the released image (not the codebase)

Pull the genuine published artifact (`docker pull ghcr.io/{org}/{repo}:{version}` — never a local SUT build), stand up a **throwaway** minimal stack on free ports (do not disturb a pre-existing probe stack), confirm migrations apply (`flyway_schema_history`) and health is UP, then verify the release's headline behavioural claims **directly** against the running instance — the claims the docs make, exercised, not read from source.

- **Trap (load-bearing): HTTP 200 ≠ working.** A single-page-app serves `index.html` for unknown routes, so a 200 on a probe can be the SPA fallback, not the feature (`memory/feedback_verify_absence_by_reading_config`). Verify the response **content-type + body**, not the status code; read the app's own config for non-default endpoint paths (e.g. springdoc can mount the OpenAPI JSON off `/v3/api-docs`).
- Tear the throwaway stack down at the end (`docker compose -p … down -v`).

### 4 — Documentation publication gate

Run `playbooks/release-train-merge.md` (its half 1 readiness + half 2 post-merge live verification): final train sync, the step-6.5 mechanical sweeps (Gate 11 / ≤200-char description / PyYAML) over the **full** train diff, the single human-merged train PR, then `playbooks/live-site-verification.md` across every manifest item's recorded URLs + phrases. Note GitBook live slugs differ from source paths (the `/features/` prefix, lowercased `adr-NNNN`) — verify the live URL, not the recorded one.

### 5 — Ontology / graph refresh to the released tag

The ontology must describe the release, not the prior one. Refresh deterministically and validate via the scorecard:
`lineage-extractor scan {repo} --full` (→ substrate at `{version}`) · `adrs-ingest {repo}` (new published ADRs become nodes) · `docs-ingest {repo}` (the released docs `main`) · `graph-build {repo}` (offline re-embed) · `alignment {repo}` (recompute — the trust-gate `substrate == code HEAD` should flip GREEN). Commit as a discrete `chore(lineage):` commit, **explicit paths only**, excluding any pre-existing in-flight files. The heavy agentic reducers (per-feature reflection, per-changed-node enrichment) are **not** required inline — defer to `/next-batch` and say so; do not fire an unbounded fan-out in a review.

### 6 — Security-fix coordination

Identify security fixes in the delta (security-sensitive CTRIB items, `Merge commit from fork` merges, GHSA references in commit/record). For each, check the advisory **publication** state — `GET /repos/{org}/{repo}/security-advisories?state=published` **and** the advisory page (a published GHSA is anonymously viewable; 404 = private). **"Closed" ≠ "published"**: a *closed* advisory stays private. Then gate the security-doc graduation:

- A caveat that *newly discloses* a vuln publishes only **after** the advisory is public, or on an explicit maintainer decision. The `documentation` repo is public — even a pushed branch discloses; pre-stage local-only until cleared.
- Graduating an **already-public** caveat to "fixed in `{version}`" is *not* a new disclosure — it reduces a stale scare and tells old-version operators to upgrade. Author operator-facing, no exploit/PoC text.
- Fix-public-while-advisory-private is a real window — surface it as the maintainer's disclosure call, don't decide it.

### 7 — Close-out + release record

Flip each fully-verified `pending-release` item → `done` (release-train-merge half 2 owns this); any failure → `blocked` with cited evidence. Re-target still-pending milestone items to the next release. Append the **release record** to `state/PROGRESS.md`: version, date, the delta size, the suite results (unit + IT pass counts), the real-instance evidence, the ontology-refresh commit, the security/advisory state, and the items flipped. Delete the merged train branch when zero `pending-release` remain for `{version}`.

## exit

- Every check 1-7 has a cited verdict; the release is a verified code+test+doc+ontology bundle.
- The unit and IT suites are GREEN on the published `{version}`; headline claims are confirmed on the running released image.
- The ontology trust-gate reads `substrate == HEAD` GREEN at `{version}`.
- The only open items handed to the maintainer are genuine decisions (security-disclosure timing, re-targeting) — surfaced once, with evidence, not re-litigated.

## on-fail

- **Red unit/IT suite on `{version}`** → CRITICAL; the published release is broken. Surface immediately; do not flip items to `done`; fix-forward (a release is not revertible).
- **A user-facing change with no doc** → finding (DOC-NNN, or fix-forward on `main` if the behaviour is released).
- **Advisory private while the fix is public** → surface the window; do **not** publish vuln-disclosing caveats until the maintainer confirms disclosure (over-disclosure is irreversible).
- **Ontology `--full` scan produces a surprising node-count delta** → it is a deterministic refresh, but if it diverges wildly from the prior curated substrate, validate before committing rather than shipping an un-reviewable diff.

## case-law

- `retrospectives/LSN-037-release-review-generalized.md` — the 0.28.0 review that generalised this protocol: what went well (delta-first, real-instance-caught-a-SPA-false-positive, security-disclosure discipline) and the gaps it closed (no full-suite-on-release step; review was ad-hoc beyond the doc gate; over-process is itself a defect).
- `playbooks/release-train-merge.md` — check 4, the documentation-publication dimension.
- `memory/feedback_canonical_suite_run_is_the_gate` — full-set, released-SUT run is the gate (check 2).
- `memory/feedback_verify_absence_by_reading_config` — HTTP 200 = SPA fallback (check 3).
