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
user_facing_verified: true | false   # false until the user-facing claim is driven against the running system; draft -> filed needs true OR an explicit false + reason (playbooks/user-facing-verification.md)
suggested_milestone:              # optional ("0.29.0") — the agent's recommendation for the target release; carried into the paste
---
```

**odd-platform drafts — attach a milestone at filing.** When a `PLT-*` draft is filed, attach the target **milestone** (the future release tag, e.g. `0.28.0`) in the GitHub UI — `/contribute` hard-stops on milestone-less issues (`pillars/contributor/gates.md` G-C11), and the milestone keys the documentation release train (`adrs/drafts/release-train-doc-gating.md`). The `suggested_milestone:` field carries the agent's recommendation; the maintainer decides.

## Body sections (paste-ready)

The file content below the frontmatter **is** the GitHub issue body — copy-paste, no editing required. Structure:

```markdown
## What
One concise paragraph. State the defect / gap / requested feature in operator-visible terms.

## Where
File:line citations with a short code excerpt. Operators searching the GitHub issue need to find the offending code without leaving the issue.

## User-facing impact
What the user actually does, and what they actually see — VERIFIED against the running feature, not inferred from code. Name the user (operator / API consumer / end user), the feature or flow they are in, and the observable behaviour on the real surface (the UI screen, the HTTP response, the alert that does or does not arrive). Call out any front-end/back-end contradiction (the back end does X, the front end shows Y) and any on-screen self-contradiction (e.g. a count badge that disagrees with the list it labels). For a back-end-only issue, state the consumer-visible effect (the 500, the silently dropped delivery). This section is REQUIRED: a bug we cannot describe in end-to-end user-facing terms is a bug we have not finished investigating.

## Why it matters
Operator impact in concrete terms. For bugs: what breaks, who is affected, how the failure manifests (silent, loud, intermittent). For features: what use case it unlocks. Severity rationale if relevant.

## Suggested fix
A concrete, code-level suggestion when one exists. For features: a sketch of the API or behavior. Mark as "open to alternatives" if you're not sure.

## How discovered
The on-disk trail in this workspace: which backlog item, which scan, which review session. Helps the upstream maintainer see this is not a drive-by report.
```

Anything that is **not** appropriate for the GitHub issue body (internal-only context, links to the workspace, severity-prioritisation reasoning that would read oddly to outsiders) should be omitted from the file or kept to a single-line frontmatter field. **One file = paste-ready draft. No double maintenance.**

### Verify the user-facing surface — do not infer it

The `User-facing impact` section must be grounded in the running feature: drive the UI, hit the endpoint, read the front-end component — not deduced from back-end code alone. Code-only analysis misses front-end/back-end contradictions: e.g. a back end that returns duplicate rows while the UI de-dupes them, so the real symptom is an inflated count badge, not duplicate rows (the failure mode behind PLT-176). If a local stack is available, reproduce the observable behaviour and cite what you saw. Protocol: `playbooks/user-facing-verification.md`. A draft carries `user_facing_verified: true` only once driven; the whole statically-authored corpus is `false` by default (per `retrospectives/LSN-031`), and `draft -> filed` is gated on it.

### Encoding: ASCII-only body

The maintainer's copy-paste path into GitHub mangles UTF-8 — `N×M` pastes as `N�M`, an em dash as `?`. Keep issue **bodies ASCII-only**: use `-` / `--` for dashes, `x` for the multiplication sign, `->` `<-` `<->` for arrows, `>=` / `<=`, `...` for an ellipsis, straight quotes. The only exception is content that is inherently non-Latin (e.g. native-language strings that ARE the subject of the bug, as in PLT-213); flag such a draft as needing a UTF-8-safe paste, and keep the non-Latin text confined to a code block where possible. Mechanical protocol + full replacement map: `playbooks/ascii-only-issue-bodies.md`.

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
