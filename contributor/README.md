# Contributor work records (CTRIB-NNN)

One file per GitHub issue the odd-team resolves as a virtual contributor. Created and driven by the `/contribute` skill; governed by `pillars/contributor/pillar.md` + `gates.md`; decision + schema in `adrs/drafts/contributor-pillar.md`.

This is the odd-team-internal audit trail for a resolution — the public artifacts live on GitHub (the issue comments, the draft PR) and in the target repos (the code, the docs, the ontology). The CTRIB record mirrors every public URL so the maintainer's audit is one file.

## ID

`CTRIB-NNN`, sequential = `max(contributor/CTRIB-*.md) + 1` (the canonical tracker dir; never grep `lineage/`).

## Frontmatter

```markdown
---
id: CTRIB-NNN
github_issue_number: <n>
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/<n>
class: bug | feature | expected-behaviour | doc-gap | misunderstanding
status: intake | scoping | clarifying | reproducing | root-caused | planned | plan-approved | implementing | tests-green | docs-done | ontology-refreshed | pr-draft | review-ready | merged | blocked
reproduced: false | "<evidence path / inline observation>"
adr_required: false | "ADR-<slug>"
plan_approved_by:            # set at GATE 1
plan_approved_at:            # set at GATE 1
pr_url:                      # the DRAFT PR
pr_draft: true
---
```

## Body

`## Scope analysis` · `## Reproduction` (the live observation) · `## Root cause` · `## Plan` (the GATE 1 artifact — exact change + **scope exclusions** + ADR decision + test/doc/ontology plan) · `## Test ledger` (unit + integration + the running-system observation) · `## Comments` (issue-thread URLs) · `## Outcome`.

## Lifecycle + gates

`pillars/contributor/canonical-homes.md`. The contributor cannot set `merged` or skip `review-ready`: GATE 1 (human approves the plan) and GATE 2 (human merges) own those transitions, and GATE 2 is enforced by GitHub (draft PR + branch protection + CODEOWNERS), not convention.
