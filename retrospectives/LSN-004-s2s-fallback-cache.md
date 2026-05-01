---
id: LSN-004
title: S2S page shipped without SUMMARY entry, leaving the live-site index link cached as a raw GitHub URL
date: 2026-04-22
domain: documentation
severity: high
gates_informed:
  - documentation-authoring-rule-ship-together
  - gate-2-aliases-logged
  - gate-7-layout-completeness
status: closed
---

# LSN-004: S2S page shipped without SUMMARY entry, leaving the live-site index link cached as a raw GitHub URL

## What happened

On 2026-04-22, the S2S authentication page (`docs/configuration-and-deployment/server-to-server-auth.md`) shipped in one PR; the matching SUMMARY.md entry shipped in a separate PR. Between the two merges, GitBook's cache for the index link resolved to a raw `github.com/.../blob/main/...` URL on the live site. The fallback URL was then cached aggressively. Even after the second PR merged with the proper SUMMARY entry, the live-site link continued to point at the GitHub fallback for an extended period. Operators who clicked through landed on raw markdown rendered by GitHub instead of the GitBook page. A second issue surfaced in the same incident: the page was authored using the term "M2M" (machine-to-machine) while the rest of the docs used "S2S" (server-to-server) — a terminology collision with no row in the Terms & Aliases table.

## Why it slipped

GitBook's caching behaviour for index links was not encoded as a rule. The implementer's mental model was "small, atomic PRs are good", but for GitBook authoring "atomic" means **the page + its SUMMARY entry + every back-reference together** — splitting them creates a window where the live-site link can fall back to a stale target and get cached. The terminology collision slipped because no protocol forced an alias-table consultation when introducing a new term that overlaps with an existing concept; the implementer authored "M2M" without checking whether `main-concepts.md` already had a canonical name for the same thing.

## Rule that emerged

**Documentation authoring rule — ship together.** A new page ships with its SUMMARY entry and all index/README link-backs in **one PR**. Hand-authored GitBook `"mention"` links are banned (they fall back unpredictably to GitHub URLs); use plain markdown links. **Gate 2 — Synonyms and aliases logged.** Any alias or synonym encountered or introduced lands in the Terms & Aliases table in `docs/main-concepts.md` in the **same PR** as the page that uses it. **Gate 7 — Layout and completeness.** SUMMARY.md, index pages, and section landings stay in sync with the page list; a new page without a SUMMARY entry fails review. All three rules live in `CLAUDE.md` ("Documentation Authoring Rules" and "Implementation Quality Bar"); Phase 3 of the architecture refactor moves them into `pillars/documentation/authoring.md` and `pillars/documentation/gates.md`.

## Forcing question

Before I split this change across PRs, will the live-site index links and cross-references remain *correct and uncached-incorrectly* between the two merges?

## References

- DOC-003 backlog item (`backlog/docs/DOC-003.md`)
- `docs/main-concepts.md` Terms & Aliases — the row that should have shipped in the same PR
- `state/PROGRESS.md` 2026-04-22 stale-branch re-verification sweep (related infrastructure incident; see LSN-008)
- Related: LSN-008 (the stale-branch sweep that surfaced this incident), LSN-005 (a sibling layout-sync failure on `Features.md`'s in-page TOC)