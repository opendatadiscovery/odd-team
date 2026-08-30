---
id: CTRIB-052
title: "#1835 ST-1c — rewire the home navigators to the param-URL search"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1835"
parent_epic: 1825
class: "bug — FE navigation regression"
status: pending-release   # see the Provenance banner — retro-booked from upstream evidence, not from a local gate run
target_repo: odd-platform
milestone: "1.0.0"   # inherited from the #1825 epic; milestone 1.0.0 is OPEN (due 2026-07-31, unreleased)
slice: "ST-1c of #1835"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1852"
pr_draft: false
merged_sha: "f72f99ec"
record_provenance: retro-booked-2026-08-30   # ledger reconciliation; no local gate artefacts exist for this item
---

# CTRIB-052 — #1835 ST-1c — rewire the home navigators to the param-URL search

> **Provenance — retro-booked 2026-08-30 by the ledger reconciliation.**
> This slice shipped upstream during the 2026-07-03..07-08 window, but no `contributor/CTRIB-052.md` was ever
> committed to odd-team — the workspace ledger stopped at CTRIB-051 (odd-team `main` @ `00b78011`, 2026-07-03)
> while the bot kept shipping. Every field in this record is derived from **verified upstream evidence** (the
> GitHub PR API + `odd-platform` git history, re-read 2026-08-30); nothing is reconstructed from memory.
> **This record does not claim the local gates were run** — see "What this record does NOT carry".

## What shipped

A search started from a home-page **tag tile**, **usage tile**, or the **toolbar Catalog tab** landed on the legacy `/search/{sessionId}` URL, where facet filtering was dead after ST-1a/1b made the param URL the single source of truth (ADR D10). Adds a shared `useNavigateToSearch` hook that builds the canonical `/search?…` URL via `searchStateToParams`, and rewires the three navigators (`TopTagsList`, `DataEntitiesUsageInfo`, `ToolbarTabs`) to it.

## Verified evidence

| Fact | Value | Source |
|---|---|---|
| Slice | ST-1c of #1835 (epic #1825) | PR title + `state/search-overhaul-decomposition.md` |
| PR(s) | [#1852](https://github.com/opendatadiscovery/odd-platform/pull/1852) | GitHub PR API |
| Author | `odd-contributor[bot]` | GitHub PR API |
| Total diff | 9 files, +176/-65 | GitHub PR API |
| Released in | **not yet released** — merged after tag `0.29.0` (2026-06-26); in `0.29.0..origin/main` | `git -C ../odd-platform log 0.29.0..origin/main` |

| PR | head branch | merge state | diff |
|---|---|---|---|
| PR #1852 | `contrib/CTRIB-052-search-navigators-param-url` | merged 2026-07-03 as `f72f99ec` | 9 files, +176/-65 |

## Status rationale

`pending-release` — GATE 2 done (every PR merged to odd-platform `main`), but milestone **1.0.0 has not shipped** (latest release 0.29.0, 2026-06-26) — `/review release:1.0.0` owns the flip to `done`.

## What this record does NOT carry

The local artefacts a `/contribute` run normally leaves behind are **absent** for this item — no GATE-1 plan
approval record, no separate-session `/review` verdict, no regression run-log, no ontology/doc-routing decision.
They were either produced on another machine and never pushed, or never produced. **Do not read this record as
evidence that those gates passed.** The 1.0.0 release gate (`playbooks/release-review.md`) must therefore verify
this slice's behaviour against the published 1.0.0 artifact directly rather than trusting a prior review.
