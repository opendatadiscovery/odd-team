---
directory: retrospectives
purpose: case-law for the framework — one file per lesson
---

# Retrospectives

Each file in this directory is a single lesson — a case that earned a forcing-function rule somewhere in the framework. Gates and playbooks cite these by `LSN-NNN`; they do not embed the cases inline.

This directory is the **case law** of the framework. The framework files (`CLAUDE.md`, `pillars/{name}/gates.md`, `playbooks/*.md`) hold the *rules*; this directory holds the *why* — the concrete incidents that justified each rule.

## File format

Each retrospective is a separate file named `LSN-NNN-{slug}.md`. Use kebab-case slugs that name the failure (`LSN-002-minio-region-unset`, not `LSN-002-incident`).

```
---
id: LSN-NNN
title: <one-line title>
date: YYYY-MM-DD
domain: documentation | tests | features | code-quality
severity: critical | high | medium | low
gates_informed:
  - <gate or playbook name>
  - <gate or playbook name>
status: open | closed
---

# LSN-NNN: <title>

## What happened
One paragraph. The incident in concrete terms — what shipped, what broke, who saw it.
Cite the file:line evidence and the date.

## Why it slipped
One paragraph. What gate didn't exist yet, what assumption masked the failure, what the
maintainer was looking at when the gap formed. The blameless angle: what about the
process let this through?

## Rule that emerged
One paragraph. The gate, playbook, or stance question that now prevents recurrence.
Name the framework file and section that carries the rule.

## Forcing question
One sentence. The question that, if asked at authoring time, would have caught this
incident. The Pre-authoring stance check (`playbooks/pre-authoring-stance.md`) is the
most common home for this question.

## References
- File:line evidence
- Originating finding / backlog item / retro thread
- Related LSN entries
```

## Naming and IDs

- IDs are sequential (`LSN-001`, `LSN-002`, …). Do not skip numbers; do not reuse.
- Allocate the next `LSN-NNN` by listing this directory + `_template.md` and picking `max + 1`.
- Slugs name the failure, not the symptom. `LSN-002-minio-region-unset` (failure) beats `LSN-002-attachments-broken` (symptom).

## When to add a retrospective

Add an LSN when:

- An incident shipped publicly (live-site bug, data loss, user report) and required a rule change to prevent recurrence.
- A scan or review caught a class of failure for the first time and the rule that prevents it was added to the framework in the same period.
- A retrospective writeup currently lives in `state/PROGRESS.md` mixed with activity history — it deserves its own LSN file.

Do *not* add an LSN for:

- A bug that was caught and fixed without changing any rule (just a normal fix)
- A typo or local oversight that didn't reflect a structural gap
- A duplicate of an existing LSN — extend the existing one with new references instead.

## Files in this directory (status as of 2026-05-21)

| File | Status | Phase |
|---|---|---|
| `_template.md` | scaffold | Phase 1 |
| `LSN-001-attachment-ephemeral-default.md` | populated | Phase 2 |
| `LSN-002-minio-region-unset.md` | populated | Phase 2 |
| `LSN-003-dbt-wrong-repo-link.md` | populated | Phase 2 |
| `LSN-004-s2s-fallback-cache.md` | populated | Phase 2 |
| `LSN-005-features-toc-desync.md` | populated | Phase 2 |
| `LSN-006-lookup-tables-content-homing.md` | populated | Phase 2 |
| `LSN-007-summary-convenience-placements.md` | populated | Phase 2 |
| `LSN-008-stale-branch-false-positives.md` | populated | Phase 2 |
| `LSN-009-backlog-internal-duplication.md` | populated | Phase 2 |
| `LSN-010-azure-admin-groups-wrong-default.md` | populated | Phase 2 |
| `LSN-011-doc-product-coherence-not-self-detecting.md` | populated | added 2026-05-03 (Phase 7 — review-side editorial-audit machinery) |
| `LSN-012-cornerstone-codified-wrong-pattern.md` | populated | added 2026-05-07 (DOC-150 — cornerstone update after same-day course-correction on bucket-attribution rule) |
| `LSN-013-research-punted-on-substrate-draft.md` | populated | Phase 7 — research-punt caselaw |
| `LSN-014-vague-interview-closers.md` | populated | Phase 7 — pause-and-ask UX |
| `LSN-015-intuition-authored-playbook.md` | populated | Phase 7 — playbook authoring discipline |
| `LSN-016-heuristic-substrate-no-semantic-content.md` | populated | added 2026-05-08 (paradigm pivot — heuristic substrate vs agentic ontology) |
| `LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md` | populated | added 2026-05-19 (methodology pivot — entry-point + feature-flow + 4-class test matrix) |
| `LSN-018-reducer-contradiction-no-coherence-check.md` | populated | added 2026-05-19 (coherence-sweep pre-commit anomaly detector) |
| `LSN-019-file-analyser-describes-not-interrogates.md` | populated | added 2026-05-20 (rev 4 — the Stress Protocol) |
| `LSN-020-activity-userids-filter-binds-to-owner-id-no-top-down-reflection.md` | populated | added 2026-05-21 (rev 5 — Category F + Layer-4b reflection) |
| `LSN-021-methodology-has-no-independent-oracle.md` | populated | added 2026-05-21 (rev 6 — the Adversarial Review Panel) |
| `LSN-022-panel-judged-against-implicit-target.md` | populated | added 2026-05-21 (rev 6 — explicit-target anchoring) |
| `LSN-023-feature-ontology-built-without-the-ui.md` | populated | added 2026-05-22 |
| `LSN-024-meta-review-panel-reviewed-a-stale-model.md` | populated | added 2026-05-22 |
| `LSN-025-substrate-axis-enumerated-only-entry-points.md` | populated | added 2026-05-24 |
| `LSN-026-workspace-vocabulary-leaked-to-published-doc.md` | populated | added 2026-05-27 (Gate 11 audience-isolation mechanical grep) |
| `LSN-027-meta-description-truncation-not-caught-by-webfetch.md` | populated | added 2026-05-28 (Gate 8 raw-HTML head + visible-subtitle inspection extension; 25 docs pages affected) |
| `LSN-028-yaml-frontmatter-parse-error-stalled-gitbook-sync.md` | populated | added 2026-05-28 (Gate 8 + /implement step 6.5 PyYAML parse-check extension; DOC-281 hotfix; GitBook sync was halted entirely until fixed) |
| `LSN-029-disabled-test-is-blind-pin-known-bugs.md` | populated | added 2026-06-02 (tests axis — characterization pins for known bugs: `@pins`/`status=pins-known-bug`, never `@Disabled`; MinioConfigRegionTest) |
| `LSN-030-test-demand-method-shaped-not-use-case-shaped.md` | populated | added 2026-06-03 (tests axis — test demand minted only by method-shaped per-node layer; feature use-cases never become test obligations; F-056 wiki-link never reflected) |
| `LSN-031-reflection-confirms-user-facing-behaviour-from-static-code-not-the-running-system.md` | populated | added 2026-06-09 (issue-reporting — feature-reflector Rule 12 + `user-facing-verification` gate; PLT-176 FE/BE contradiction + count/list on-screen mismatch, found only by driving the UI) |
| `LSN-032-integration-harness-pulls-published-image-not-the-working-branch.md` | populated | added 2026-06-09 (contributor — integration validation must BUILD from the working branch, never pull `ghcr…:latest`; the four-gate Definition of Done; first /contribute run CTRIB-001 / PR #1745) |
| `LSN-033-system-under-test-is-a-run-parameter-not-a-property-of-the-test.md` | populated | added 2026-06-10 (tests + contributor — the SUT is a RUN parameter, default = the working tree; `build-sut.sh` + `ODD_SUT`; completes LSN-032; de-pinned IT-126's frozen `contrib-*` image) |

## Index by gate / playbook informed

When looking up "which retrospectives justify this rule?", grep this section.

| Gate / playbook | Retrospectives |
|---|---|
| Gate 1 — No duplicates (bi-directional sweep) | LSN-003, LSN-009 |
| Gate 2 — Synonyms and aliases logged | LSN-004, LSN-011 |
| Gate 3 — Caveats captured | LSN-001, LSN-002 |
| Gate 4 — Consumer-read before authoring | LSN-001, LSN-002, LSN-010 |
| Gate 5 — Unset-parameter audit for SDK integrations | LSN-002 |
| Gate 7 — Layout and completeness | LSN-005, LSN-007, LSN-012 |
| Gate 9 — Factual claim provenance | LSN-001, LSN-002, LSN-003, LSN-009, LSN-010 |
| Gate 10 — Content type homing | LSN-006 |
| Cornerstone 1 — Discoverability without context | LSN-011 |
| Cornerstone 2 — Aspect deep dive (hierarchy depth) | LSN-007 |
| Cornerstone 2 — Aspect deep dive (bucket attribution + index/detail direction) | LSN-012 |
| Cornerstone 4 — Three audiences, AI-maintained consistency | LSN-011 |
| Cornerstone 5 — One canonical home per content type | LSN-006 |
| Playbook — `doc-product-editorial-read.md` | LSN-006, LSN-007, LSN-011, LSN-012 |
| Playbook — `pre-authoring-stance.md` | LSN-006, LSN-007, LSN-012 |
| Documentation authoring rule — ship together | LSN-004 |
| Documentation authoring rule — fetch origin/main first | LSN-008 |
| Implementer cannot self-mark `done` | LSN-002 |
| Tests axis — pin known bugs (characterization `@pins`/`status=pins-known-bug`, never `@Disabled`) | LSN-029 |
| Tests axis — test demand must be use-case-shaped (feature layer emits the matrix; reflection emits on confirmed hypotheses; second coverage frontier) | LSN-030 (sequel to LSN-017, LSN-020, LSN-023, LSN-025) |
| Gate 8 — Publishing standards (live-site verification) | LSN-004, LSN-027, LSN-028 |
| Gate 11 — Audience isolation (mechanical banned-term grep) | LSN-026 |
| Playbook — `live-site-verification.md` raw-HTML head inspection | LSN-027 |
| Playbook — `live-site-verification.md` YAML frontmatter parse check | LSN-028 |
| Playbook — `user-facing-verification.md` (drive the running feature; no static user-facing claim filed) | LSN-031 (sequel to LSN-020, LSN-023) |
| `feature-reflector` Rule 12 — running-system observable routes to `probe-needed`, not static `confirmed` | LSN-031 |
| Contributor G-C2 / G-C10 — build-from-branch integration + the four-gate Definition of Done (unit-build + branch-image IT + docs-read + ontology-committed) | LSN-032 (sequel to LSN-031) |
| Tests + contributor — the SUT is a run parameter (default working tree); no test/protocol names a frozen image (`build-sut.sh`, `ODD_SUT`) | LSN-033 (completes LSN-032) |
| Gate 8 + `playbooks/github-write.md` — `push.default current` in publishing checkouts; explicit same-name refspec; docs-repo `main` branch protection recommended | LSN-034 |
| Issue drafts — required `## User-facing impact` section + ASCII-only body (`issues/README.md`) | LSN-031 |
| `/implement` skill — step 6.5 pre-commit mechanical sweeps | LSN-026 (Gate 11 banned-term), LSN-027 (description-length), LSN-028 (YAML parse) |
| Contributor G-C2 — behavior-diff-vs-released for cross-cutting / dependency changes (`git show <tag>:<file>` + drive the UI) | LSN-036 |
| Gate 9 (`claim-inventory`) — a rejection's load-bearing premise is a claim; verify it vs open siblings before it stands | LSN-036 |
| Playbook — `follow-up-on-disk.md`: a cross-cutting-invariant defect must PROPOSE an enforced check (CI guard / IT), not only a backlog item ("knowing != preventing") | LSN-036 |
| Playbook — `release-review.md`: the post-release review is a code+test+doc+ontology bundle verified against the *published* artifact; the full suite (unit + IT, pinned to `published:{version}`) is mandatory, real-instance over codebase, security-doc graduation gated on advisory publication | LSN-037 |
| `playbooks/github-write.md` step 5 + `.claude/skills/contribute/SKILL.md` Phase D + G-C4 human-path — a contributor branch must never track/target `main` (App `POST /git/refs`, or local `push.default current` + `switch -c` + same-name `push -u` + pre-push `@{u}!=origin/main`); the bot-only merge gate does not cover a human-admin direct push | LSN-038 (sequel to LSN-034) |
| G-C15 / test-integrity — an e2e assertion that drives the surface programmatically (`evaluate`/`scrollLeft`/`dispatchEvent`) then checks state can be GREEN while the user-facing affordance is broken; assert what the user can perceive/reach (`toBeInViewport()`, real `.click()`/`.hover()`), never what the DOM can be forced into | LSN-039 |
| Contributor front-of-loop — G-C17 (`spec-gate`: understand the WHAT to ambiguity ≤ 0.20 before any HOW), G-C18 (`decompose-epic`: an epic → user-observable SPIDR slices, never one big-bang), G-C19 (`plan-contract` + `.claude/agents/plan-checker.md`: a `must_haves` plan that passes an adversarial goal-backward check before the human) | LSN-040 |