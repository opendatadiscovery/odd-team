---
id: CTRIB-059
title: "#1839 ST-5c — snapshotted popularity_score on the unified search index"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1839"
parent_epic: 1825
class: "performance — substrate"
status: pr-draft   # see the Provenance banner — retro-booked from upstream evidence, not from a local gate run
target_repo: odd-platform
milestone: "1.0.0"   # inherited from the #1825 epic; milestone 1.0.0 is OPEN (due 2026-07-31, unreleased)
slice: "ST-5c of #1839"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1862"
pr_draft: true
merged_sha: ""
record_provenance: retro-booked-2026-08-30   # ledger reconciliation; no local gate artefacts exist for this item
---

# CTRIB-059 — #1839 ST-5c — snapshotted popularity_score on the unified search index

> **Provenance — retro-booked 2026-08-30 by the ledger reconciliation.**
> This slice shipped upstream during the 2026-07-03..07-08 window, but no `contributor/CTRIB-059.md` was ever
> committed to odd-team — the workspace ledger stopped at CTRIB-051 (odd-team `main` @ `00b78011`, 2026-07-03)
> while the bot kept shipping. Every field in this record is derived from **verified upstream evidence** (the
> GitHub PR API + `odd-platform` git history, re-read 2026-08-30); nothing is reconstructed from memory.
> **This record does not claim the local gates were run** — see "What this record does NOT carry".

## What shipped

The final ST-5 slice. Per ADR `unified-asset-search` D5 + its rev-3 SRE correction, indexes a snapshotted/bucketed `popularity_score` rather than the live `data_entity.view_count`: `V0_0_100` adds `popularity_score smallint NOT NULL DEFAULT 0` on `asset_search_entrypoint` (rewrite-free fast default, backfilled from `view_count`), maintained by an always-on `@Scheduled(15 min)` + ShedLock `AssetPopularitySnapshotJob` that writes only rows whose bucket changed.

## Verified evidence

| Fact | Value | Source |
|---|---|---|
| Slice | ST-5c of #1839 (epic #1825) | PR title + `state/search-overhaul-decomposition.md` |
| PR(s) | [#1862](https://github.com/opendatadiscovery/odd-platform/pull/1862) | GitHub PR API |
| Author | `odd-contributor[bot]` | GitHub PR API |
| Total diff | 5 files, +375/-0 | GitHub PR API |
| Released in | **not yet released** — merged after tag `0.29.0` (2026-06-26); in `0.29.0..origin/main` | `git -C ../odd-platform log 0.29.0..origin/main` |

| PR | head branch | merge state | diff |
|---|---|---|---|
| PR #1862 | `contrib/CTRIB-059-popularity-snapshot` | **OPEN DRAFT** (unmerged) | 5 files, +375/-0 |

## Status rationale

`pr-draft` — The PR is still an **open draft** upstream (opened 2026-07-08, unmerged as of 2026-08-30) and is ~8 weeks behind `main` — it needs a rebase before GATE 2 can be exercised.

## What this record does NOT carry

The local artefacts a `/contribute` run normally leaves behind are **absent** for this item — no GATE-1 plan
approval record, no separate-session `/review` verdict, no regression run-log, no ontology/doc-routing decision.
They were either produced on another machine and never pushed, or never produced. **Do not read this record as
evidence that those gates passed.** The 1.0.0 release gate (`playbooks/release-review.md`) must therefore verify
this slice's behaviour against the published 1.0.0 artifact directly rather than trusting a prior review.
