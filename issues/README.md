# Upstream Issue Drafts

Paste-ready GitHub issue drafts that the ODD Team has discovered and intends to file into upstream repositories' issue trackers.

## Why this exists

Backlog items (`backlog/`) track work the ODD Team does **inside** this workspace — write a doc, add a test, update navigation. Issue drafts (`issues/`) track work the ODD Team **hands off** to a specific upstream repository's GitHub issue tracker — a Java platform bug, a Python collector defect, a spec gap, a chart change.

Without this directory, every platform-side or collector-side defect surfaced during scan / implement / review evaporates into conversation. With it, every discovery becomes an auditable on-disk artifact that can be reviewed, refined, and filed deliberately.

## Layout

```
issues/
  README.md                                # this file
  odd-platform/
    PLT-001.md
    PLT-002.md
  odd-collectors/
    COL-001.md
  opendatadiscovery-specification/
    SPEC-001.md
  ...
```

One file per draft, organised by target repository. The directory name **must match** the corresponding key in `navigation/repos.yaml`.

## ID conventions

Per-repo prefixes. The directory location plus the prefix together make every reference unambiguous in conversation and in commit messages.

| Repository | Prefix | Notes |
|------------|--------|-------|
| `odd-platform` | `PLT-` | |
| `odd-collectors` | `COL-` | Covers all four monorepo packages (sdk, generic, aws, azure, gcp). The body identifies the package. |
| `opendatadiscovery-specification` | `SPEC-` | 4-letter to avoid collision with `backlog/spec/SPC-NNN.md` (work we do on the spec ourselves). |
| `documentation` | `DOCS-` | 4-letter to avoid collision with `backlog/docs/DOC-NNN.md`. Issues here are unusual — most documentation work is a backlog item — but the slot exists for future cases (e.g., a doc improvement we want filed for a community contributor to pick up). |
| `charts` | `CHT-` | |
| `odd-cli` | `CLI-` | |
| `odd-dbt` | `DBT-` | |
| `odd-airflow-2` | `AIR-` | |
| `odd-spark-adapter` | `SPK-` | |
| `odd-great-expectations` | `GE-` | |
| `odd-collector-profiler` | `PRF-` | |
| `odd-models-package` | `MOD-` | |
| `odd-examples` | `EX-` | |
| `odd-docs` | `OD-` | Status TO BE MERGED — issues here probably converge into `documentation` over time. |

Numbers are **sequential within each prefix**. Reuse the prefix's next free integer; do not reset between status flips.

When filing an issue against a repo not yet in this table, add the new prefix here in the same PR that creates the first draft.

## Frontmatter format

```markdown
---
id: {PREFIX}-{NNN}                # e.g., PLT-001
title: "Imperative-mood title, ≤70 chars"
target_repo: odd-platform         # must match repos.yaml key + directory name
issue_type: bug | feature | adjustment
status: draft | filed | closed | rejected
severity: critical | high | medium | low   # required for bugs; omit for features/adjustments
discovered_during: DOC-013 | scan/{scanner} | free text
github_issue_url:                 # populated when status flips draft → filed
github_issue_number:              # populated when filed (nice for cross-reference)
found_date: "YYYY-MM-DD"
---
```

## Body sections (paste-ready)

The file content below the frontmatter **is** the GitHub issue body — copy-paste, no editing required. Structure:

```markdown
## What
One concise paragraph. State the defect / gap / requested feature in operator-visible terms.

## Where
File:line citations with a short code excerpt. Operators searching the GitHub issue need to find the offending code without leaving the issue.

## Why it matters
Operator impact in concrete terms. For bugs: what breaks, who is affected, how the failure manifests (silent, loud, intermittent). For features: what use case it unlocks. Severity rationale if relevant.

## Suggested fix
A concrete, code-level suggestion when one exists. For features: a sketch of the API or behavior. Mark as "open to alternatives" if you're not sure.

## How discovered
The on-disk trail in this workspace: which backlog item, which scan, which review session. Helps the upstream maintainer see this is not a drive-by report.
```

Anything that is **not** appropriate for the GitHub issue body (internal-only context, links to the workspace, severity-prioritisation reasoning that would read oddly to outsiders) should be omitted from the file or kept to a single-line frontmatter field. **One file = paste-ready draft. No double maintenance.**

## Lifecycle

```
draft → filed → closed
   ↓        ↓
rejected  rejected
```

| From → To | Who | When |
|-----------|-----|------|
| `(new)` → `draft` | `/log-issue` or any session that surfaces an upstream defect | Immediately on discovery |
| `draft` → `filed` | **A human, manually**, via the GitHub web UI (or `gh issue create`) | After review of the draft. Update `github_issue_url` + `github_issue_number` in frontmatter. |
| `filed` → `closed` | Any session noticing the upstream issue closed | Update frontmatter; add a `## Outcome` section noting the closing PR / commit and whether the workspace's caveat doc can be removed. |
| `draft` → `rejected` | Any session, with reasoning | False positive, obsolete, superseded. Add a `## Rejection` section with evidence. |
| `filed` → `rejected` | Any session | Upstream maintainer marked "wontfix" or closed without a fix. Document the upstream conversation; consider whether a permanent doc caveat is now needed in `documentation`. |

Filing is **always** a human action for now (a "visible to others" operation under the workspace's safety rules). Drafts can be created freely; filing requires a deliberate paste-and-submit.

## Cross-referencing

When an issue draft is created from a backlog item's discovery:

1. The issue draft's `discovered_during:` field names the backlog ID (e.g., `DOC-013`).
2. The originating backlog item gains a `## Platform-side follow-up filed` section pointing at `issues/{repo}/{PREFIX}-NNN.md`.

Two-way pointer keeps the audit trail traceable from either direction.

## When to create an issue draft vs a backlog item

| Discovery is in… | And the fix is… | Where it goes |
|-----------------|----------------|---------------|
| Documentation we maintain here | Doc-side | `backlog/docs/DOC-NNN.md` |
| Spec we maintain here | Spec-side | `backlog/spec/SPC-NNN.md` |
| Tests we own | Test-side | `backlog/tests/TST-NNN.md` |
| Java platform code | Code change in `odd-platform` | `issues/odd-platform/PLT-NNN.md` (file via GitHub) |
| Python collector code | Code change in `odd-collectors` | `issues/odd-collectors/COL-NNN.md` (file via GitHub) |
| Spec wire contract | Schema change | `issues/opendatadiscovery-specification/SPEC-NNN.md` |
| Helm chart | Chart change | `issues/charts/CHT-NNN.md` |

The principle: **work we do here lives in `backlog/`, work we hand off lives in `issues/`.** A single discovery may produce both — for example, DOC-013 shipped a "Known limitations" caveat (backlog work, done) and `COL-001` queues the upstream pagination fix (issue, draft).

## Don't

- Don't file from `draft` → `filed` automatically. The GitHub issue tracker is a public, indexed surface; every filing should be a deliberate human action.
- Don't move a draft into `backlog/` or vice versa. The directory choice IS the work-vs-handoff statement.
- Don't keep workspace-internal context in the body. The body is the GitHub issue. Internal-only context belongs in the originating backlog item or in a session-specific finding file.
- Don't delete rejected items. The file stays as audit trail; status flip + `## Rejection` section is enough.
