---
pillar: contributor
file: canonical-homes
status: active
since: 2026-06-09
---

# Contributor canonical homes

Every artifact a `/contribute` run produces has exactly one home. The schema for each is in `adrs/drafts/contributor-pillar.md` §Decision.8.

| Artifact | Home | Notes |
|---|---|---|
| **Work record** | `contributor/CTRIB-NNN.md` (this repo) | One per resolved issue. Frontmatter: `github_issue_number`, `class`, `milestone` (the issue's milestone — G-C11), `status` (lifecycle below), `reproduced`, `adr_required`, `plan_approved_by/at`, `docs_routing` (`main` \| `release/{version}` \| `none`), `pr_url`, `pr_draft`. Body: scope analysis, reproduction log, root-cause, the approved plan (with scope exclusions), the test/doc/ontology ledger. ID = `max(contributor/CTRIB-*) + 1`. |
| **Reproduction evidence** | inside the CTRIB record + (if a probe) `lineage/odd-platform/probes/P-NNN.yaml` | The captured live observation (curl/UI). Reuses the probe schema. |
| **The plan (GATE 1 artifact)** | inside the CTRIB record (a `## Plan` section) | A `/code-walk`-derived plan; this is what the human approves. Must carry explicit scope EXCLUSIONS. |
| **Clarify / root-cause comments** | the GitHub issue thread (via `playbooks/github-write.md`) | NOT a new issue. The CTRIB record links each comment URL. |
| **Code change** | a branch on `opendatadiscovery/odd-platform` (`contrib/CTRIB-NNN-slug`) | Branch on upstream, not a fork. The bot pushes; humans merge. |
| **Unit tests** | the odd-platform repo (run in its CI) | tests pillar, unit bucket. |
| **Integration tests** | `integration-tests/protocols/IT-NNN.md` (this repo) + the Playwright/probe harness | tests pillar, integration bucket. Characterization pins re-grounded per LSN-029. |
| **Docs** | the `documentation` repo — `main` via the normal PR flow for released-truth corrections; the **`release/{version}` train branch** for unreleased behaviour (publishes at the release gate; the paired backlog DOC item carries `milestone:` + the post-merge URL list) | documentation pillar + `adrs/drafts/release-train-doc-gating.md` (G-C11). Or an explicit "no doc change + why" in the CTRIB record. |
| **Ontology refresh** | `lineage/odd-platform/...` (sidecars / feature-flows) + the re-embedded graph | via `/enrich --touched`; committed. |
| **ADR (if architecturally significant)** | `adrs/drafts/{slug}.md` → the adr pillar lifecycle | When G-C7 fires; approved before any code. |
| **The draft PR** | a DRAFT PR on `opendatadiscovery/odd-platform`, `Closes #N` | GATE 2; humans review + merge. |
| **GitHub App identity + key** | OUT of this repo — the install key is encrypted, never committed | `odd-contributor[bot]`; the maintainer registers it. Kill-switch = uninstall / delete key. |

## Status lifecycle (CTRIB record)

```
intake -> scoping -> clarifying -> reproducing -> root-caused -> planned
  -> plan-approved   [GATE 1]
  -> implementing -> tests-green -> docs-done -> ontology-refreshed -> pr-draft
  -> review-ready
  -> merged   [GATE 2, human]   |   blocked
```

The contributor cannot set `merged` or skip `review-ready` — `/review` (separate session) and the human merge own the tail, exactly as `/implement` cannot self-`done`.

`docs-done` means authored + **routed** (G-C11): released-truth corrections go to docs `main`; unreleased-behaviour docs sit on the `release/{version}` train and publish at the release gate. The CTRIB still closes at `merged` (the code); the paired backlog DOC item (status `pending-release`) tracks the doc until the post-release live verification flips it `done` (`playbooks/release-train-merge.md`).
