---
id: CTRIB-056
title: "#1838 ST-4 — unified cross-kind search core: Data Entities + Terms + Query Examples in one ranked list"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1838"
parent_epic: 1825
class: "feature — full stack (core vertical)"
status: pending-release   # see the Provenance banner — retro-booked from upstream evidence, not from a local gate run
target_repo: odd-platform
milestone: "1.0.0"   # inherited from the #1825 epic; milestone 1.0.0 is OPEN (due 2026-07-31, unreleased)
slice: "ST-4 of #1825"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1856 , https://github.com/opendatadiscovery/odd-platform/pull/1857 , https://github.com/opendatadiscovery/odd-platform/pull/1858"
pr_draft: false
merged_sha: "ef2b34bb"
record_provenance: retro-booked-2026-08-30   # ledger reconciliation; no local gate artefacts exist for this item
---

# CTRIB-056 — #1838 ST-4 — unified cross-kind search core: Data Entities + Terms + Query Examples in one ranked list

> **Provenance — retro-booked 2026-08-30 by the ledger reconciliation.**
> This slice shipped upstream during the 2026-07-03..07-08 window, but no `contributor/CTRIB-056.md` was ever
> committed to odd-team — the workspace ledger stopped at CTRIB-051 (odd-team `main` @ `00b78011`, 2026-07-03)
> while the bot kept shipping. Every field in this record is derived from **verified upstream evidence** (the
> GitHub PR API + `odd-platform` git history, re-read 2026-08-30); nothing is reconstructed from memory.
> **This record does not claim the local gates were run** — see "What this record does NOT carry".

## What shipped

One `/search` query returns Data Entities, Glossary Terms and Query Examples interleaved in a single relevance-ranked list, each row routing to its own kind's detail page. Unified `asset_search_entrypoint(asset_kind, asset_id, search_vector)` + GIN, maintained by AFTER INSERT/UPDATE/DELETE triggers on the three per-kind FTS tables; one GIN scan + a live semi-join for eligibility; additive stateless `POST /api/search/assets`; a polymorphic cross-kind result row.

Two maintainer-found follow-ups shipped on the same item: **#1857** replaced the bespoke checkbox Asset-type control with the platform-standard `FixedOptionsMultiFilter` multiselect, and **#1858** fixed the Data-entity-type filter's AND-not-OR semantics (`entity_class_ids @> [ids]` → `&& [ids]`) plus reliable multi-class selection — both reproduced on a running stack first.

## Verified evidence

| Fact | Value | Source |
|---|---|---|
| Slice | ST-4 of #1825 (epic #1825) | PR title + `state/search-overhaul-decomposition.md` |
| PR(s) | [#1856](https://github.com/opendatadiscovery/odd-platform/pull/1856) · [#1857](https://github.com/opendatadiscovery/odd-platform/pull/1857) · [#1858](https://github.com/opendatadiscovery/odd-platform/pull/1858) | GitHub PR API |
| Author | `odd-contributor[bot]` | GitHub PR API |
| Total diff | 53 files, +2018/-775 | GitHub PR API |
| Released in | **not yet released** — merged after tag `0.29.0` (2026-06-26); in `0.29.0..origin/main` | `git -C ../odd-platform log 0.29.0..origin/main` |

| PR | head branch | merge state | diff |
|---|---|---|---|
| PR #1856 | `contrib/CTRIB-056-unified-cross-kind-search` | merged 2026-07-06 as `ef2b34bb` | 34 files, +1656/-576 |
| PR #1857 | `contrib/CTRIB-056-filter-multiselect-ux` | merged 2026-07-06 as `09b98d66` | 14 files, +272/-131 |
| PR #1858 | `contrib/CTRIB-056-filter-fixes` | merged 2026-07-06 as `f1d34ce1` | 5 files, +90/-68 |

## Status rationale

`pending-release` — GATE 2 done (every PR merged to odd-platform `main`), but milestone **1.0.0 has not shipped** (latest release 0.29.0, 2026-06-26) — `/review release:1.0.0` owns the flip to `done`.

## What this record does NOT carry

The local artefacts a `/contribute` run normally leaves behind are **absent** for this item — no GATE-1 plan
approval record, no separate-session `/review` verdict, no regression run-log, no ontology/doc-routing decision.
They were either produced on another machine and never pushed, or never produced. **Do not read this record as
evidence that those gates passed.** The 1.0.0 release gate (`playbooks/release-review.md`) must therefore verify
this slice's behaviour against the published 1.0.0 artifact directly rather than trusting a prior review.
