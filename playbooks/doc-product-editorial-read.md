---
playbook: doc-product-editorial-read
status: active
since: 2026-05-03
applies_to: pillar:documentation
---

# PROTOCOL doc-product-editorial-read

This playbook is the **executor** of `pillars/documentation/quality-framework.md`. The framework defines the twelve doc-quality axes (positive specification of what world-class docs require). This playbook walks them — Mode 1 (per-page systematic audit) for axes 1-10, 11-forward, 12; Mode 2 (code-side coverage sweep) for axis 11-reverse — and logs DOC-NNN follow-ups for every violation.

The reviewer reads as the doc product's **owner** (Principal-grade editor; the manual the way an operator three years from now will encounter it) but the audit is **systematic, not stance-only**. The framework's per-page checklist is mandatory; the stance is what guides judgment when an axis has gray-area edges. A reviewer who runs only the stance and not the checklist will miss what the framework exists to prevent (LSN-011 case-law: two consecutive editorial-audit runs missed `main-concepts.md`'s 4× redundancy because the catalog was reactive, not derived from a positive specification).

## trigger

Every `/review` session, after the per-item Quality Bar gates have been verified and before the verdict is written. Runs once per `/review` invocation regardless of which item the verdict targets — the audit's scope is the doc product **as a whole**, not the affected pages of the current batch.

## inputs

- `pillars/documentation/quality-framework.md` — the twelve axes the audit walks, the audit cues per axis, the procedure for both execution modes
- the user-facing documentation tree: `documentation/docs/**/*.md` (every `.md` file at every depth)
- `pillars/documentation/cornerstones.md` — the doc-product principles the reader holds in mind while reading
- `pillars/documentation/canonical-homes.md` — the content-type-homing reference (audit cue for axis A1)
- `docs/main-concepts.md` Terms & Aliases — the canonical-term registry (audit cue for axis A8)
- `retrospectives/LSN-NNN-*.md` — historical findings the reader recognizes the shape of
- `state/doc-quality-coverage.md` — the audit dashboard; the reviewer updates it at the end of every per-page audit

The reviewer does **not** bring the per-item acceptance criteria, scanner findings, or workspace-internal artefacts into this read. The audit is about the doc product as a publishable text, not the workspace's per-item progress. Workspace internals (CLAUDE.md, pillars, backlog, retrospectives' own text) are read **only** as references for the audit, not as audit targets.

## procedure

### 1. Set the stance, then run the systematic audit

The stance and the systematic audit are complementary. The stance keeps the reviewer reading as the doc product's owner (the qualitative "would I be ashamed to see this quoted back?" check); the systematic audit forces comprehensive coverage so axes don't get skipped because they happen to feel uneventful on this read.

**The owner stance.** Before opening any file, fix three concerns:
- **Coherence.** Does the manual hang together as one product?
- **Ergonomics.** Does a real reader get to what they need without dead-ends, ambiguity, or unresolved references?
- **Pride.** Would I be ashamed to see this passage quoted back to me by an angry operator three years from now?

**The systematic axes.** Load `pillars/documentation/quality-framework.md`. The audit walks the twelve axes (A1-A12) on every page; the framework is the source of truth for what each axis requires, what PASS looks like, what failure shapes derive from it, and the audit cue (the concrete questions the reviewer asks).

### 2. Mode 1 — Per-page systematic audit (axes 1-10, 11-forward, 12)

For every page in `documentation/docs/**/*.md`, walk the eleven page-readable axes. The page audit is not done until each axis has a verdict (PASS / FAIL+DOC-NNN / N/A) recorded in `state/doc-quality-coverage.md`.

**Ordering for the read.** The audit can be done in any order, but comprehensiveness — every file audited once — matters more than order. A useful default sequence (when starting a baseline audit):

1. **Entry surfaces**: `Features.md`, `main-concepts.md`, `README.md`, `SUMMARY.md`, `Architecture.md`, `Overview.md` — what a first-time reader hits.
2. **Aspect landings**: `data-modelling.md`, `master-data-management.md`, `directory.md`, `oddrn.md`, `genai.md` — per-pillar deep-dive entries.
3. **Per-feature detail pages** under each aspect (`data-modelling/*.md`, `master-data-management/*.md`).
4. **Use-case pages** (`Use_cases.md` + `dc_data_compliance.md` etc.).
5. **Configuration-and-deployment/** subtree — the operator surface.
6. **Developer-guides/** subtree — the developer surface.
7. **Integrations/** subtree — the per-integration content.
8. **Anything else** (top-level singletons, orphaned files).

**Per-page execution.** For each page:

1. Open the page; read it end-to-end once for context.
2. For each axis (A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11-forward, A12), apply the framework's audit cue. Decide PASS / FAIL / N/A.
3. For each FAIL: log a DOC-NNN follow-up via `playbooks/follow-up-on-disk.md`. The follow-up cites the axis (A1-A12), the verbatim passage that triggered it, the failure shape from the axis's derived list (or a new shape if none fit), the recommended-fix direction, and cross-references. Never narrate a finding without logging it.
4. Record the page's audit row in `state/doc-quality-coverage.md`:
   ```
   docs/{path}.md — A1✓ A2✗(DOC-NNN) A3✓ A4✓ A5✓ A6✓ A7✓ A8✓ A9✓ A10✓ A11f✓ A12✗(DOC-NNN) — overall FAIL
   ```
5. Move to the next page.

A page passes overall when every axis is PASS or N/A. A single FAIL → page-overall is FAIL.

**Token budget is intentionally not a constraint here.** The session may be long. Per `CLAUDE.md` and the user's directive (2026-05-03): the reviewer cares about the full picture; tokens and time are spent in service of perfection.

### 3. Mode 2 — Code-side coverage sweep (axis 11-reverse)

Walks the platform / collector codebases looking for features that have no doc entry on every audience surface they warrant. NOT executed per-page; runs as a separate scanner-style sweep at minimum every quarter, plus after any significant code refactor.

For each catalogue listed in axis A11's reverse audit cue (`@RestController` / `@Configuration`+`@Bean` / `@Value`+`@ConfigurationProperties` / `@Scheduled` / security configs / SDK client builders):

1. Grep the target codebase, enumerate every match.
2. For each match, decide which audience surface(s) the feature warrants: user-facing (Features.md), operator-facing (configuration-and-deployment), developer-facing (developer-guides/api-reference).
3. For each (match, surface) pair, check whether the doc has an entry. If missing on any surface the feature warrants, log a DOC-NNN with the missing surface(s) named.
4. Record the sweep in `state/doc-quality-coverage.md` under the "Code-side coverage" section.

This sweep is heavy. Decompose by catalogue if it cannot fit in one session — record partition state in `state/doc-quality-coverage.md` so the next session resumes where this one stopped.

### 4. Log every finding

Every editorial finding is a `DOC-NNN` follow-up — never narrated in conversation only. Conversation-only notes evaporate the moment the session ends; the 2026-05-03 user spot-check that surfaced DOC-091 + DOC-092 + DOC-093 is the canonical case for why the on-disk rule is non-negotiable.

For each finding:

1. Run `playbooks/follow-up-on-disk.md` to allocate the backlog slot. The grep-backlog-first step (LSN-009 case-law) avoids creating a duplicate of an existing item.
2. The follow-up's body cites:
   - **Axis** the finding falls under (A1-A12, per `pillars/documentation/quality-framework.md`).
   - **Source location** — `docs/{path}.md:{line}` for Mode 1; `{repo}/{path}:{line}` for Mode 2 (or section anchor if line is unstable).
   - **The verbatim passage** that triggered the finding (Mode 1) OR the code-feature description + missing surface(s) (Mode 2). Quote it; do not paraphrase. The fix-implementer needs to see the exact text or code that triggered the finding.
   - **The failure shape** — pick from the axis's derived list (in `pillars/documentation/quality-framework.md`), or propose a new shape under the axis.
   - **The recommended-fix direction** — what the fix should aim at, not the fix itself. (The fix is the implementer's call when the item is picked up.)
   - **Cross-references** — every other doc page or code path the finding touches (an internal contradiction has at least two source locations).
3. Priority by audience impact:

   | Priority | When to use |
   |---|---|
   | **Critical** | Actively misleading; reader will form a wrong mental model that costs them money, data, or trust. (LSN-001 / LSN-002 shape — defaults that lead to data loss.) |
   | **High** | Incomplete or contradictory in a way that blocks a flow. (Reader cannot complete a documented setup because step 4 dead-ends.) |
   | **Medium** | Coherence drift; reader still gets through but loses confidence or has to guess. (Conceptual drift, parallel-surface-with-drift, cross-link mismatch.) |
   | **Low** | Polish; reader unaffected in practice. (Tone inconsistency on adjacent pages; small ambiguities a careful reader resolves on their own.) |

4. Tag `scanner_source: "discovered-during-{review-session-label}-editorial-audit"` so the follow-up's provenance is traceable.

### 5. Surface the catalog in the /review verdict + update the dashboard

The `/review` verdict template carries a **"Doc-product editorial findings"** section. Populate it with every DOC-NNN logged this run, formatted:

```
- DOC-NNN ({priority}, A{axis}, {failure_shape}) — {one-line summary}. Source: {file:line}.
```

Also include the per-page audit coverage delta:
```
- Pages audited this run: {N} (cumulative: M / total)
- Per-axis pass rate this run: A1 X%, A2 Y%, ... A12 Z%
- Open FAILs (cumulative): {count}
```

If the read produced zero findings, write `none surfaced this run` — explicit silence is required; the section is never omitted.

The per-item verdict (acceptance criteria + 10 gates) is **independent** of the editorial findings. They parallel-track:

- The 10 gates determine whether `review-ready` flips to `done` or `blocked`.
- The editorial findings extend the backlog so the doc product as a whole stays at the bar.
- An item can flip to `done` while the audit logs 20 follow-ups; the item shipped correctly, the doc product still has work.

**Update `state/doc-quality-coverage.md`** at the end of every `/review` invocation, regardless of how many pages were audited. Empty audits get an explicit timestamp confirming no progress was made (so coverage stagnation is visible).

## exit

The audit is done when:

- every page targeted this run has been audited Mode-1 with a verdict per axis recorded in `state/doc-quality-coverage.md`
- every finding surfaced is logged as a DOC-NNN follow-up on disk
- the `/review` verdict's "Doc-product editorial findings" section is populated (or carries `none surfaced this run`)
- the dashboard delta is reflected in the verdict

## on-fail

- **Per-page audit exceeds session budget.** Partition the doc tree by subtree and continue across multiple `/review` runs. Record the partition state in `state/doc-quality-coverage.md` (un-audited rows stay empty; audited rows have full verdicts). The next session resumes from the first un-audited page. Do **not** skip subtrees silently.
- **A finding doesn't fit any failure shape under its axis and the reviewer can't articulate it in two sentences.** Log it anyway with `failure_shape: uncategorised under A{axis} — needs framework extension` + the verbatim passage; surface to the user in the verdict notes; propose the new shape in the same commit.
- **Reading reveals a finding that is in scope of a per-item gate** (e.g., a Gate 9 factual error on a page the current batch touched). Fold into the per-item verdict — it becomes a Quality Bar finding, not an editorial finding — and continue the audit.
- **Reading reveals a finding that should be a new failure shape category under an existing axis.** Add the row to the axis's derived-failure-shape list in `pillars/documentation/quality-framework.md` in the same commit that surfaces the finding's first instance; cite the DOC-NNN as the case-law.
- **Reading reveals a finding that doesn't fit any of the twelve axes.** That is a framework-level signal. Either the axis taxonomy is incomplete (propose a new axis) OR the finding is genuinely out of scope of doc quality. Surface to the user before logging.

## case-law

- `pillars/documentation/quality-framework.md` § "Case-law" — the framework anchors every prior LSN and DOC finding to a specific axis. The shape catalog is no longer in this playbook; it is derived from the axes there.
- `retrospectives/LSN-011-doc-product-coherence-not-self-detecting.md` — **the canonical case-law for this playbook's first version.** On 2026-05-03, after seven prior `/implement` + `/review` sessions had passed without catching any of them, a user spot-check on `docs.opendatadiscovery.org/features` surfaced three editorial findings the system's quality machinery had not detected: **DOC-091** (cross-audience absence — A9), **DOC-092** (cross-link mismatch + reader-flow defect — A4 + A7), **DOC-093** (conceptual drift — A8). LSN-011 named the structural reason the pattern recurred — the system's gates verify *quality of execution*, not *completeness of coverage* — and authored the first version of this playbook as the closure.
- **2026-05-03 second-iteration extension** — A user spot-check after the second editorial-audit run surfaced `main-concepts.md`'s 4× repetition of Adapter / Plugin / Collector / Push adapter content (DOC-114) and forced a structural redesign of the playbook: the stance-only + reactive-failure-shape-table approach was replaced with `pillars/documentation/quality-framework.md`'s positive specification + per-page systematic audit. This playbook became the executor.
- `retrospectives/LSN-006-lookup-tables-content-homing.md` — A1 (canonical-home discipline) + cross-page parallel-surface drift; the canonical case for "content of a recognizable type embedded on a feature page when the canonical home exists elsewhere."
- `retrospectives/LSN-007-summary-convenience-placements.md` — A10 (IA placement); SUMMARY placements that "felt close enough" but didn't match conceptual depth.
- Every prior `retrospectives/LSN-001` through `LSN-010` is a user-spot-check finding now anchored to a framework axis. See `pillars/documentation/quality-framework.md` § "Case-law" for the LSN-by-axis index.
