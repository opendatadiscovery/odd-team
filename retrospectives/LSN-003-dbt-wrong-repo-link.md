---
id: LSN-003
title: DOC-027 outbound link mis-targeted odd-dbt as a path inside odd-collectors
date: 2026-04-23
domain: documentation
severity: high
gates_informed:
  - gate-9-factual-provenance
  - bidirectional-duplication-sweep
status: closed
---

# LSN-003: DOC-027 outbound link mis-targeted odd-dbt as a path inside odd-collectors

## What happened

On 2026-04-23, DOC-027 introduced a GitHub URL for the dbt push-client integration. The link target was `https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-dbt`. That path does not exist. `odd-dbt` is its own top-level repository at `https://github.com/opendatadiscovery/odd-dbt`, not a sub-directory of `odd-collectors`. The mistake was authored from memory of the canonical-vocabulary table and a guess at where push-clients lived. A bi-directional duplication sweep on the new URL — grepping `docs/` for `dbt` and cross-checking the existing `github-organization-overview.md` and `main-concepts.md` rows — would have surfaced the correct target before the commit reached a PR. No SoT line cited the link; the implementer's belief was the only source.

## Why it slipped

The pre-existing duplication sweep (Gate 1) ran one direction: search the docs tree for content the new page might collide with. It did not enumerate **new** content the change was about to introduce — terms, URLs, repo names — and did not require an SoT citation per outbound link. Repo URLs in particular were treated as "well-known" and authored from memory; no protocol forced verification against the canonical-vocabulary map or against the live repo (`gh repo view`, README WebFetch).

## Rule that emerged

**Gate 9 — Factual claim provenance**, with an explicit SoT class for `Repo:` claims (canonical: `navigation/architecture.md` repo table + WebFetch of the target README on first introduction). The bi-directional duplication sweep was extended to cover **new terms / URLs / repos / aliases the change is introducing**, not just existing content the change might collide with. Reviewer rationalizations ("defensible", "monorepo default", "probably correct") were banned; every review note ends in `VERIFIED via {fetch/grep/read}` or `NOT VERIFIED → logging as DOC-NNN`. Phase 4 of the architecture refactor distills these into `playbooks/duplication-sweep.md` and `playbooks/claim-inventory.md`.

## Forcing question

Before I author an outbound URL or a repo name into the docs, what canonical SoT did I just verify it against — and would `gh repo view` resolve to the page I'm claiming?

## References

- DOC-027 backlog item and re-ship commit (`backlog/docs/DOC-027.md`)
- `navigation/architecture.md` "Canonical vocabulary" + repo table (the SoT that should have been consulted)
- Backlog discovery: `state/PROGRESS.md` 2026-04-23 pipeline-hardening pass entries
- Related: LSN-009 (a sibling-class failure where backlog-internal duplication was missed because the same sweep wasn't applied to the backlog itself)