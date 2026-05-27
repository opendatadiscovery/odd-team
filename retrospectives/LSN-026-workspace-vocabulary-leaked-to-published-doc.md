---
id: LSN-026
title: Workspace-internal vocabulary leaked to a published doc page
date: 2026-05-27
domain: pillar:documentation / authoring + review
severity: medium
gates_informed: [pillars/documentation/gates.md Gate 11, pillars/documentation/authoring.md "Audience isolation"]
status: open
related_lsn: [LSN-011, LSN-022]
---

# LSN-026: Workspace-internal vocabulary leaked to a published doc page — "Cornerstone 5 holds" on a page about tagging

## What happened

`docs.opendatadiscovery.org/features/data-discovery/tagging` (source: `documentation/docs/data-discovery/tagging.md:56`) carries the sentence:

> *"Cornerstone 5 holds — two surfaces for two distinct content types: Management → Tags is the operator-mutating canonical home for the vocabulary; this page is the read-side canonical home for applying and finding by tags."*

"Cornerstone 5" is the workspace's internal documentation principle defined in `pillars/documentation/cornerstones.md`. The published doc is for ODD operators learning to use the platform — they have never opened this workspace, do not know what a Cornerstone is, do not have access to `pillars/`, and cannot make sense of the sentence. The internal-pillar reference exposes the maintainer's machinery to the reader as if the reader shared the maintainer's frame.

The sentence shipped to production. It survived two `/review` passes. The maintainer caught it externally on 2026-05-27 by reading the live site and asking *"could we check that the agent that proposes changes into docs and the agent that reviews this changes should take into consideration idea that this is user facing documentation … there should be no sentences like this."*

## Why it slipped

The methodology's existing defences against this were **stance-only**:

1. **Pre-authoring stance check** (`pillars/documentation/gates.md` "Pre-authoring stance check") asks five questions before each sub-section: content-type / canonical-home / SUMMARY-placement / WHY-preservation / *"Would I be ashamed to see this quoted back?"*. The fifth question is the closest to a Gate 11 catch — but it relies on the maintainer noticing the leak, not on a mechanical signal.
2. **Doc-product editorial read** (`playbooks/doc-product-editorial-read.md`) is mandatory on every `/review` invocation and explicitly says *"Read the manual the way an operator three years from now will read it."* The reviewer adopts the audience's stance. But "Cornerstone 5 holds —" is 12 words inside a 1400-line `tagging.md`; the reviewer's eye on a long read glides over single-sentence anomalies that don't break the local paragraph flow. The sentence read as confident maintainer voice rather than as an alien reference, and the editorial pass missed it.
3. **Gate 9 (Source-of-Truth class)** requires every claim to cite a canonical source. The "Cornerstone 5" sentence is a *meta-claim about doc structure* — it doesn't claim a runtime fact, so Gate 9's grep didn't catch it.

The structural pattern: **stance is necessary but not sufficient.** The editorial-read stance is irreplaceable for coherence findings (cross-page drift, missing audience surfaces, IA misplacement) — those are inherently judgment calls that no grep replaces. Banned-term leakage is the opposite shape: a finite list of strings; either they appear on a doc line or they don't. Mechanical checks catch what editorial reading reliably misses; editorial reading catches what mechanical checks cannot. The two are complementary; the methodology was running only one half.

LSN-011 named the same structural shape one layer up (*"doc-product coherence is not self-detecting"*): the gates fire on what is *authored*, not on what is *absent or incoherent across pages*. LSN-026 is the inverse for single-page leaks: the gates fire on what is *missing* (Gate 6 coverage), not on what is *present and shouldn't be*. Both LSNs prove the same point: every quality bar needs both an editorial stance and a mechanical complement.

## Why it matters

A single sentence is locally small but the class is operator-trust-shaped. A reader landing on `tagging.md` from a search hit, scrolling the page, hitting *"Cornerstone 5 holds"* with no prior context has three options:

1. **Skim past.** The sentence is meaningless to them; they lose ~0 information and ~ε trust.
2. **Pause and try to parse it.** "What is Cornerstone 5? Is there a list somewhere? Did I miss a tutorial?" — friction, then skim. They lose ~30s and ~1 trust unit.
3. **Conclude the docs aren't talking to them.** *"This was written for someone else. The maintainers are talking to themselves."* The page-level trust drops; the next ambiguous sentence on this page gets the harsher reading; the next *missing* caveat gets the *"of course they didn't tell me"* interpretation. The site-level trust drops.

Outcome 3 is the failure mode. Trust compounds downward, and it compounds across pages — once a reader has the *"the maintainers are talking to themselves"* heuristic, every internal reference on every other page reinforces it.

The same shape (smaller scale) sits in `developer-guides/how-to-contribute.md` ("Our maintainers will be glad to pick it up"). That use of *maintainers* is **legitimate** — it's the community-contributor sense (the GitHub-PR-reviewer role), not the workspace meta-role. Gate 11's exception list is explicit about it. The point of the exception list is that the rule is mechanical AND contextual: the mechanical grep surfaces every hit; per-hit classification per the Exceptions table decides what to keep.

## Rule that emerged

**Gate 11 — Audience isolation.** Published documentation is for ODD operators, integrators, and developers learning to use the platform. Workspace-internal vocabulary — terms whose meaning is defined inside `pillars/`, `playbooks/`, `retrospectives/`, `adrs/`, `state/`, `backlog/`, `issues/`, `lineage/`, `scanners/`, `CLAUDE.md`, or `APPROACH.md` — MUST NOT appear in published doc pages. The rule is **mechanical, not stance-only**: a grep on the banned-term registry runs as part of `/implement` (step 6.5, pre-commit) and `/review` (Gate 11 in the gates table). Each hit is a finding; the implementer rewrites in operator language (naming the underlying user-observable concept directly), or deletes (often the right call — internal references frequently signal the maintainer talking to themselves through the doc), or moves to an internal artefact.

Full rule + banned-term registry + exception list + mechanical check command at `pillars/documentation/gates.md` Gate 11.

## Probe that would have caught it

```bash
# Run from workspace root before committing any doc change
grep -rnE 'Cornerstone [0-9]+|Gate [0-9]+|\bLSN-[0-9]+\b|\bSHB-[0-9]+\b|\bREFACTOR-[0-9]+\b|\bTEST-GAP-[0-9]+\b|\bDOC-GAP-[0-9]+\b|\bADR-CANDIDATE-[0-9]+\b|feature-flow-builder|feature-reflector|doc-gap-finder|concept-merger|odd-sme|adr-archaeologist|methodology-reviewer|graph-retriever|file-analyser|probe-runner|domain-extractor|Stress Protocol|Quality Bar|Pre-authoring stance|claim-inventory|consumer-read|unset-parameter audit' ../documentation/docs/
```

On 2026-05-27 this grep returns one HIGH-CONFIDENCE finding (the leaked sentence in `data-discovery/tagging.md:56`) and zero false positives. The grep takes <1 second. Had it been part of `/implement` step 6.5 or `/review` Gate 11 when the original commit landed, the leak would have been caught at author time and never shipped.

## Fixed by

- **`pillars/documentation/gates.md` Gate 11** — the new rule, registry, exceptions, procedure, mechanical check command, case-law.
- **`pillars/documentation/authoring.md` "Audience isolation"** — author-facing summary + the per-commit grep snippet.
- **`playbooks/doc-product-editorial-read.md` step 0** — mandatory mechanical pre-pass before the editorial stance.
- **`.claude/skills/implement/SKILL.md` step 6.5** — pre-commit grep on staged diff.
- **`.claude/skills/review/SKILL.md` Gate 11 row** — verifies the grep ran clean before flipping items to `done`.
- **`backlog/docs/DOC-{NNN}-tagging-cornerstone-leak.md`** — the actual leak in `data-discovery/tagging.md:56`; rewrite in operator language. (Filed via `/log-issue` if upstream-only; backlog item if our PR shapes the fix.)

## What's still load-bearing

- **The Gate 11 registry is the maintained minimum, not the closed maximum.** Every new internal term introduced into the workspace (a new agent, a new playbook, a new artefact kind, a new methodology protocol) must extend the table in the same commit. The Gate 11 section already names this as part of the procedure.
- **Exception-list classification is per-hit, not blanket.** `sidecar` in the SSO/S3-proxy infrastructure sense ships freely; `sidecar` in the workspace per-node sense never does. The reviewer reads the surrounding sentence; the grep does not.
- **The editorial-read stance is not replaced by the mechanical check** — it is augmented. Coherence findings (cross-page drift, missing audience surfaces, reader-flow defects, IA misplacement) are still judgment calls; the editorial pass is the only thing that catches them. The mechanical pass catches strings; the editorial pass catches semantics. Both are required.
- **The grep is `git diff --staged --name-only` scoped at `/implement` time** — that's <1 second per commit. The whole-tree grep at `/review` time and during the editorial-read playbook's step 0 is also <1 second; the cost ceiling is well below the value.
