---
id: LSN-011
title: Doc-product coherence is not self-detecting — per-item gates verify execution, not whole-text consistency; a user spot-check after seven /implement+/review sessions surfaced three coherence findings the system had not caught
date: 2026-05-03
domain: documentation
severity: high
gates_informed:
  - playbook-doc-product-editorial-read
  - cornerstone-1-discoverability-without-context
  - cornerstone-4-three-audiences-ai-maintained
  - gate-2-aliases-logged
status: closed
---

# LSN-011: Doc-product coherence is not self-detecting — per-item gates verify execution, not whole-text consistency

## What happened

On 2026-05-03, after the `/review batch:feature/docs-content-type-homing-followups` verdict closed out (DOC-086 + DOC-087 → `done`, all 10 Quality Bar gates PASS), a user spot-check on `docs.opendatadiscovery.org/features` surfaced three coherence findings none of the seven preceding `/implement` + `/review` sessions had caught:

- **DOC-091 (cross-audience absence)** — The Data Collaboration feature was fully documented at `configuration-and-deployment/odd-platform.md:622` `## Enable Data Collaboration` (operator surface; 7 config keys + advisory-lock setup + Slack OAuth token), `developer-guides/api-reference.md:81-105` `## Data Collaboration` (developer surface; 7 endpoints across 3 groups), and `navigation/domains/collaboration.md` (workspace surface). It was **completely absent from `docs/Features.md`** — no H2, no in-page TOC entry, no inline mention. A first-time reader scrolling Features.md to grasp "what does ODD do?" had no path to discover the feature exists.
- **DOC-092 (cross-link mismatch + reader-flow defect)** — `docs/Features.md` `## Alerting` had three cross-link defects: lines 146-152 narrative paragraphs about Slack / webhook / email notification setup carried *no* cross-link to the canonical configuration H2; line 281 cross-linked to `#postgresql-configuration` (wrong anchor — that's the Postgres connection H2, not alert notifications) via an absolute Medium-tracking URL clearly copy-pasted from a Medium article (`?source=post_page-----86ddd04e5aaf--------------------------------#postgresql-configuration`); line 287 had the same Medium-URL pattern targeting `#cleaning-up`. A reader following the feature page to set up alert notifications hit a broken cross-link AND no working cross-link at three sites.
- **DOC-093 (conceptual drift)** — The platform uses Slack for two unrelated purposes: as an outgoing-only notification webhook for alerts (`notifications.receivers.slack.url`; one-way write to a channel) and as a full Slack app for in-app per-entity discussions (`datacollaboration.slack-oauth-token`; OAuth + Events API webhook for inbound replies + channel listing + thread sync). These are entirely different Slack-side artefacts, configured by different keys, used by different code paths. **No surface — config page, feature pages, API reference, or `main-concepts.md` Terms & Aliases — made the distinction.** An operator silently mis-configuring one thinking they had covered both was a real operational hazard (alerts simply don't fire, or Data Collaboration messages don't deliver, with no loud failure).

All three findings had existed for months before 2026-05-03. Seven `/implement` + `/review` sessions in 2026-04 and 2026-05 had run against pages adjacent to or overlapping these defects without surfacing any of them.

## Why it slipped

Every Quality Bar gate the system carries — Gates 1 through 10, the pre-authoring stance check, the consumer-read audit, the bi-directional duplication sweep — is **change-reactive**. The gates verify what the maintainer authored on this run; they do not enumerate the doc product as a coherent text. Specifically:

- **Gate 1 (no duplicates)** catches same-content duplication ("the same paragraph on two pages"). It does not fire when content is *absent* from a page where it should exist.
- **Gate 6 (bidirectional code↔doc)** is scoped to "every user-visible code path *touched by the change*." Code paths that exist but were not touched by the current change are out of scope. Data Collaboration was not touched; nothing fired.
- **Gate 9 (factual provenance)** verifies cited claims; it does not verify *missing* claims that should have been made. Slack-as-collaboration-app and Slack-as-notification-target both had cited claims on their respective surfaces; the gap was the *absent disambiguation across* them, which has no Sources footer to verify.
- **Gate 10 (content type homing)** catches embedded content of a recognizable type when a canonical home exists. It does not fire when content is *absent* from where its content-type homing rule says it should exist.
- **The pre-authoring stance check** runs before each new sub-section being authored. It cannot fire for what is *not* being authored.

Cornerstones 1 (Discoverability without context) and 4 (Three audiences, AI-maintained consistency) state the rule that catches all three findings: a feature must be discoverable from the user-facing landing; the three audience surfaces must cohere. But the cornerstones are *principles*, not *procedures*. They tell the maintainer the standard; they do not run.

The deeper structural pattern: the system has rich machinery for **quality of execution** (you wrote X, did you do it right?) and thin machinery for **completeness of coverage** (does the doc product cover the platform's full surface?). Every prior retrospective on disk — LSN-001 through LSN-010 — was a finding caught by user spot-check, not by the system's own machinery. Today's case is the seventh in a row of that shape. That is not coincidence; it is a structural signal that the gates verify what is authored and the user fills the comprehensiveness gap.

## Rule that emerged

**`/review` now runs `playbooks/doc-product-editorial-read.md` end-to-end on every invocation, after the per-item Quality Bar gates and before the verdict.** The audit's stance is editorial, not mechanical: the reviewer reads `documentation/docs/**/*.md` end-to-end as the documentation owner — the way an operator three years from now will read it — and surfaces every coherence finding (internal contradiction, conceptual drift, cross-audience absence, reader-flow defect, parallel surfaces with drift, dead admonitions, half-finished narratives, IA / hierarchy incoherence, phantom config keys, unresolved references) as a tracked DOC-NNN follow-up via `playbooks/follow-up-on-disk.md`.

The audit's findings **do not block the per-item verdict** — the 10 gates remain the sole authority for `review-ready` → `done` or `blocked`. The editorial findings extend the backlog as parallel work; the doc product as a whole stays at the bar by progressive closure of the editorial backlog over time, not by holding the per-item flow hostage.

The user's directive (2026-05-03) on token / time cost: **token budget is intentionally not a constraint for this audit**. The session may be long. The reviewer cares about the full picture; tokens and time are spent in service of perfection. This is the ecosystem-owner stance the doc product warrants because it is published at `docs.opendatadiscovery.org` with the team's name on every page.

## Forcing question

Read this `docs/` tree end-to-end as the operator three years from now will read it: where does the manual contradict itself, leave threads unresolved, use the same word for two things, or omit a feature that exists? List every coherence finding; log every one as a DOC-NNN.

## References

- Backlog: `backlog/docs/DOC-091.md` (Data Collaboration absent from Features.md — cross-audience absence)
- Backlog: `backlog/docs/DOC-092.md` (Features.md alerting cross-link defects — cross-link mismatch + reader-flow defect)
- Backlog: `backlog/docs/DOC-093.md` (Slack used for two unrelated integrations without disambiguation — conceptual drift)
- Playbook: `playbooks/doc-product-editorial-read.md` (the procedure that closes this gap)
- Skill: `.claude/skills/review/SKILL.md` Step 5 (the `/review` step that invokes the playbook on every run)
- Cornerstones: `pillars/documentation/cornerstones.md` Cornerstones 1 + 4 (the principles the audit operationalises)
- Related: LSN-006 (parallel-surfaces-with-drift; the canonical case for embedded content the audit also catches)
- Related: LSN-007 (IA hierarchy convenience-placements; same root cause shape — local optimization without holding the global picture)
- Related: every prior LSN — LSN-001 through LSN-010 are *all* user-spot-check findings; LSN-011 names the structural reason that pattern recurred and closes it.
