---
playbook: doc-product-editorial-read
status: active
since: 2026-05-03
applies_to: pillar:documentation
---

# PROTOCOL doc-product-editorial-read

The reviewer reads the documentation product end-to-end as its **owner** — a Principal-grade editor reading the manual the way an operator three years from now will encounter it — and surfaces every coherence finding as a tracked follow-up. This is **not a checklist**; it is a **stance**. A reviewer who runs this audit as a mechanical pass over the failure-shape table below will miss the kind of finding the audit exists to catch. Read the doc product as one coherent text; reason across it; surface what does not cohere.

## trigger

Every `/review` session, after the per-item Quality Bar gates have been verified and before the verdict is written. Runs once per `/review` invocation regardless of which item the verdict targets — the audit's scope is the doc product **as a whole**, not the affected pages of the current batch.

## inputs

- the user-facing documentation tree: `documentation/docs/**/*.md` (every `.md` file at every depth)
- `pillars/documentation/cornerstones.md` — the doc-product principles the reader holds in mind while reading
- `pillars/documentation/canonical-homes.md` — the content-type-homing reference
- `docs/main-concepts.md` Terms & Aliases — the canonical-term registry
- `retrospectives/LSN-NNN-*.md` — historical findings the reader recognizes the shape of

The reviewer does **not** bring the per-item acceptance criteria, scanner findings, or workspace-internal artefacts into this read. The audit is about the doc product as a publishable text, not the workspace's per-item progress. Workspace internals (CLAUDE.md, pillars, backlog, retrospectives' own text) are read **only** as references for the audit, not as audit targets.

## procedure

### 1. Set the stance (read as the owner)

Before opening a single file, fix the stance. The owner cares about three things:

- **Coherence.** Does the manual hang together as one product? Do the pages reinforce each other or contradict?
- **Ergonomics.** Does a real reader — operator, user, developer — get to what they need without dead-ends, ambiguity, or unresolved references?
- **Pride.** Would I be ashamed to see this passage quoted back to me by an angry operator three years from now?

Not "is each page individually correct?" — that is the per-item gates' job. The stance here is **"does the product cohere when read together?"** A page can be locally perfect and globally wrong; the audit catches the second case.

### 2. Load the doc tree end-to-end

Read every `documentation/docs/**/*.md`. Suggested order (the order helps the reader build context, but comprehensiveness — every file read once — matters more than order):

1. **Entry surfaces**: `Features.md`, `main-concepts.md`, `README.md`, `SUMMARY.md` — what a first-time reader hits.
2. **Aspect landings**: `data-modelling.md`, `master-data-management.md`, etc. — per-pillar deep-dive entries.
3. **Per-feature detail pages** under each aspect.
4. **Configuration-and-deployment/** subtree — the operator surface.
5. **Developer-guides/** subtree — the developer surface.
6. **Integrations/** subtree — the per-integration content.
7. **Anything else** (`oddrn.md`, `use-cases.md`, top-level singletons).

Token budget is intentionally not a constraint here. The session may be long. Per `CLAUDE.md` and the user's directive (2026-05-03): **the reviewer cares about the full picture; tokens and time are spent in service of perfection**.

### 3. Surface coherence findings

While reading, watch for the failure shapes below. Each shape's example is from a real past finding — the catalog evolves. **Treat the table as a recognition aid, not an exhaustive list.** A finding that does not fit any shape is still a finding; log it and propose a new shape category in this playbook's case-law extension.

| Failure shape | What it looks like |
|---|---|
| **Internal contradiction** | Page A claims X, page B claims not-X about the same fact. (Two pages stating different defaults for the same config key.) |
| **Logical mismatch** | Page A's claim implies Y, but Y is asserted false or absent elsewhere. ("The platform retries on transient errors" on a feature page; "no retry loop" on the API reference for the same endpoint.) |
| **Ambiguity** | Phrasing that admits multiple readings; concepts introduced without disambiguation. A reader following the prose can form two incompatible mental models. |
| **Conceptual drift** | Same term used to mean different things in different places without the alias table catching it because the surface text looks identical. (2026-05-03: "Slack" used to mean both an outgoing notification webhook *and* a full Slack app for in-app messaging — DOC-093 is the resulting follow-up.) |
| **Coverage hole** | Topic introduced but never followed through; "see X for details" → X is thin or empty. ("See API Reference" → the API Reference section was one sentence + a Swagger link before DOC-083.) |
| **Reader-flow defect** | Admonition warns without directing to the fix-path; cross-link promises more than it delivers; getting-started flow dead-ends; circular "see also" loops. ("This is unsupported in production" without naming the supported alternative.) |
| **Outdated baked-in assumption** | Prose assumes an old version, old config shape, or old UI without saying so. (A walkthrough referencing a UI tab that has since been renamed; a config example using a deprecated key.) |
| **Tone / voice inconsistency** | Pages treat the reader at incompatible expertise levels without justification. (Aspect landing reads as "explain like I'm new to data catalogs"; the sub-feature reads as "you already know our internal taxonomy.") |
| **Unresolved reference** | "The X feature" mentioned but X never defined; example value looks real but is a placeholder; an acronym used without expansion. (A SQL snippet using a placeholder hostname that looks like a real service.) |
| **Cross-audience absence** | Feature documented on operator + developer surfaces but absent from the user-facing landing. (2026-05-03: Data Collaboration on `odd-platform.md#enable-data-collaboration` + `api-reference.md#data-collaboration` + `navigation/domains/collaboration.md` but nothing on Features.md — DOC-091 is the resulting follow-up.) |
| **Parallel surfaces with drift** | Two pages cover the same content type without a single canonical home; one is richer than the other or carries a caveat the other lacks. (`retrospectives/LSN-006-lookup-tables-content-homing.md`.) |
| **Half-finished narrative** | Section opens a thread it doesn't close: "First, we'll cover X. Then Y." [section ends after X]. A walkthrough that promises three steps and delivers two. |
| **Cross-link mismatch** | The link text promises one thing; the target delivers another. ("[detailed configuration steps]" → target is a one-paragraph teaser; "[the four halt-timestamp fields]" → target lists three.) |
| **IA / hierarchy incoherence** | A page placed at SUMMARY depth that does not match its conceptual depth — a sub-feature placed as a peer of a primary pillar, or a primary pillar buried under a thematic group. (`retrospectives/LSN-007-summary-convenience-placements.md`.) |
| **Dead admonition** | A `{% hint %}` block that no longer fires (the bug it warns about has been fixed; the caveat it captured has lapsed) but still sits in the page misleading readers. |
| **Phantom config key / endpoint / file** | Documented entity that no longer exists in code (renamed, removed, or never merged). Watch especially for items shipped before a rename was completed upstream. |

If a finding does not fit any shape above and the reviewer can't articulate it in less than two sentences, log it anyway with `failure_shape: uncategorised — needs editorial review` and surface to the user — the catalog should grow rather than the finding be dropped.

### 4. Log every finding

Every editorial finding is a `DOC-NNN` follow-up — never narrated in conversation only. Conversation-only notes evaporate the moment the session ends; the 2026-05-03 user spot-check that surfaced DOC-091 + DOC-092 + DOC-093 is the canonical case for why the on-disk rule is non-negotiable.

For each finding:

1. Run `playbooks/follow-up-on-disk.md` to allocate the backlog slot. The grep-backlog-first step (LSN-009 case-law) avoids creating a duplicate of an existing item.
2. The follow-up's body cites:
   - **Source location** — `docs/{path}.md:{line}` (or section anchor if line is unstable).
   - **The inconsistent / ambiguous passage verbatim** — quote it; do not paraphrase. The fix-implementer needs to see the exact text that triggered the finding.
   - **The failure shape** — pick from the table above, or propose a new category.
   - **The recommended-fix direction** — what the fix should aim at, not the fix itself. (The fix is the implementer's call when the item is picked up.)
   - **Cross-references** — every other doc page the finding touches (an internal contradiction has at least two source locations).
3. Priority by audience impact:

   | Priority | When to use |
   |---|---|
   | **Critical** | Actively misleading; reader will form a wrong mental model that costs them money, data, or trust. (LSN-001 / LSN-002 shape — defaults that lead to data loss.) |
   | **High** | Incomplete or contradictory in a way that blocks a flow. (Reader cannot complete a documented setup because step 4 dead-ends.) |
   | **Medium** | Coherence drift; reader still gets through but loses confidence or has to guess. (Conceptual drift, parallel-surface-with-drift, cross-link mismatch.) |
   | **Low** | Polish; reader unaffected in practice. (Tone inconsistency on adjacent pages; small ambiguities a careful reader resolves on their own.) |

4. Tag `scanner_source: "discovered-during-{review-session-label}-editorial-audit"` so the follow-up's provenance is traceable.

### 5. Surface the catalog in the /review verdict

The /review verdict template carries a **"Doc-product editorial findings"** section. Populate it with every DOC-NNN logged this run, formatted:

```
- DOC-NNN ({priority}, {failure_shape}) — {one-line summary}. Source: {file:line}.
```

If the read produced zero findings, write `none surfaced this run` — explicit silence is required; the section is never omitted.

The per-item verdict (acceptance criteria + 10 gates) is **independent** of the editorial findings. They parallel-track:

- The 10 gates determine whether `review-ready` flips to `done` or `blocked`.
- The editorial findings extend the backlog so the doc product as a whole stays at the bar.
- An item can flip to `done` while the audit logs 20 follow-ups; the item shipped correctly, the doc product still has work.

## exit

The audit is done when:

- every `documentation/docs/**/*.md` has been read end-to-end this session
- every coherence finding the read surfaced is logged as a DOC-NNN follow-up on disk
- the /review verdict's "Doc-product editorial findings" section is populated (or carries `none surfaced this run`)

## on-fail

- **Reading the doc tree exceeds session budget.** Partition the tree by subtree and continue across multiple `/review` runs. Note the partition state in `state/PROGRESS.md` (e.g., "editorial audit covered `docs/configuration-and-deployment/**` this run; `docs/integrations/**` queued for next"). The next session resumes where the prior left off. Do **not** skip subtrees silently.
- **A finding doesn't fit any failure shape and the reader can't articulate it in two sentences.** Log it anyway with `failure_shape: uncategorised — needs editorial review` + the verbatim passage; surface to the user in the verdict notes.
- **Reading reveals a finding that is in scope of a per-item gate** (e.g., a Gate 9 factual error on a page the current batch touched). Fold into the per-item verdict — it becomes a Quality Bar finding, not an editorial finding — and continue the audit.
- **Reading reveals a finding that should be a new failure shape category.** Add the row to the table in this playbook in the same commit that surfaces the finding's first instance; cite the finding's DOC-NNN as the case-law for the new row.

## case-law

- `retrospectives/LSN-011-doc-product-coherence-not-self-detecting.md` — **the canonical case-law for this playbook.** On 2026-05-03, after seven prior `/implement` + `/review` sessions had passed without catching any of them, a user spot-check on `docs.opendatadiscovery.org/features` surfaced three editorial findings the system's quality machinery had not detected: **DOC-091** (cross-audience absence — Data Collaboration documented on operator + developer surfaces but absent from `Features.md`), **DOC-092** (cross-link mismatch + reader-flow defect — `Features.md` alerting section's three cross-link defects: missing inline link to the configuration H2; broken anchor `#postgresql-configuration`; absolute Medium-tracking URLs copy-pasted from a Medium article), **DOC-093** (conceptual drift — "Slack" used as an umbrella term for an outgoing-only notification webhook *and* a full Slack app for in-app messaging, with no disambiguation on any surface). LSN-011 names the structural reason the pattern recurred — the system's gates verify *quality of execution*, not *completeness of coverage* — and authors this playbook as the closure.
- `retrospectives/LSN-006-lookup-tables-content-homing.md` — parallel-surfaces-with-drift; the canonical case for "content of a recognizable type embedded on a feature page when the canonical home exists elsewhere." This audit catches the same shape on first read.
- `retrospectives/LSN-007-summary-convenience-placements.md` — IA / hierarchy incoherence; SUMMARY placements that "felt close enough" but didn't match conceptual depth.
- Every prior `retrospectives/LSN-001` through `LSN-010` is a user-spot-check finding. LSN-011 names the structural reason that pattern recurred; this playbook is what closes it.
