---
name: implement
description: Work a batch of backlog items end-to-end as a maintainer — hold the Implementation Quality Bar, run the consumer-read audit, log follow-ups on disk, flip items to `review-ready`, and ship one PR per repo per batch.
argument-hint: <work-item-id>
allowed-tools: Read Grep Glob Edit Write WebFetch Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
---

# Implement a Batch

`$ARGUMENTS` is the **batch starter**, not the sole item. You are an ODD Team maintainer working a batch end-to-end — running the change, holding the Implementation Quality Bar (see `CLAUDE.md`), logging any discovered follow-ups on disk, and producing few cohesive PRs that the user can review in one pass.

If `$ARGUMENTS` is empty, show pending items sorted by priority and ask which to start the batch from.

**You cannot self-mark items `done`.** Phase 2 ends at `status: review-ready` per item. `/review` in a separate session handles the final transition. This is the lesson from 2026-04-23 — self-closed items shipped a silent data-loss caveat (MinIO region) that a separate-session review would have caught.

## Phase 1 — Plan the batch

1. **Orient** — Read `CLAUDE.md` (team identity, Quality Bar, batching, authoring rules), `navigation/features.yaml`, the relevant `navigation/domains/*.md`, and the work item file for `$ARGUMENTS` (search `backlog/`). Special attention to Quality Bar #4 (Consumer-read) and #5 (Unset-parameter audit).

2. **Pre-flight on the starter**:
   - Status must be `pending` (not `blocked`, not `in-progress`, not `review-ready`)
   - Check `state/file-registry.yaml` — no conflicting `in-progress` or `review-ready` items on the same files
   - Check `adrs/` for decisions that constrain the area
   - Read every file in `affected_files`; if a path is stale, consult navigation for the updated one

3. **Freshen `origin/main`** for every target repo the batch will touch. **Mandatory for `documentation`:** fetch and checkout `origin/main` in `../documentation` before reading or editing. GitBook commits land directly on main as `[GITBOOK-NN]` commits; any local branch lags. Skipping this step caused the 2026-04-22 stale-branch re-verification sweep (2 false positives, 4 scope narrowings).

4. **Assemble batch candidates.** From the backlog, pick continuation items that:
   - Share the `target_repo` with the starter
   - Have no file conflicts with items already in the batch
   - Are small or medium effort
   - Share a theme (scanner source, feature area, or quality-bar concern) with the starter

   Name the batch after the theme it covers (e.g., `feature/docs-quality-xrefs`, `feature/critical-odd-platform-config`). The batch branch will be cut from freshly-fetched `origin/main` of the target repo. The odd-team bookkeeping lives on a parallel branch in this repo.

5. **Pre-authoring duplication sweep** (MANDATORY for `target_repo: documentation`, run per item in the batch):
   - Read `docs/main-concepts.md` **Terms & Aliases** table — the canonical synonym map.
   - Build the search surface: each canonical term or alias matching the item's topic, each config key / env var, each proposed page-title keyword.
   - Grep the whole `../documentation/docs/` tree for that surface.
   - **For every hit outside `affected_files`**, classify and decide before authoring:
     - **Link** — existing mention stays, new content links to it (or vice versa).
     - **Expand-in-place** — existing mention is the right home; grow it there instead of creating a new page. Update `affected_files`.
     - **Consolidate** — existing mention is a redundant copy that should collapse into a teaser pointing to the canonical page. Update `affected_files`.
     - **New alias entry** — existing mention uses a different name for the same thing; the item must also add a row to the Terms & Aliases table.
   - Record each decision in the item's Context (format: `- {file:line} — {classification} — {brief reason}`). This is the audit trail for why a file was or wasn't touched.
   - If the sweep shows the item is mis-scoped (feature already fully documented elsewhere under a different name), update the work item, drop it from the batch, and **do not** author duplicate content.

   Rationale: on 2026-04-22 DOC-003 (S2S) and DOC-013 (collector secrets backend) both shipped as new pages while `Features.md` already had sections for the same features under different names (M2M tokens, Alternative Secrets Backend). No cross-link in either direction. This sweep makes that class of failure impossible to reach a PR.

6. **Consumer-read plan** (MANDATORY for every item whose claims depend on platform / collector code):
   - For every config key / env var the item touches, list every `@Value` / `@ConfigurationProperties` consumer you will read. Grep if necessary.
   - For every SDK / external-client integration behind the feature, list the bean factory / builder file you will read. If `navigation/domains/{domain}.md` does not list it, that is a navigation gap — log it as a discovered finding during Phase 2.
   - Record this plan as a draft of the eventual `Consumer-read:` commit footer. You will refine it as you read.

## Phase 2 — Execute each item (in order on the batch branch)

Repeat per item. The Quality Bar in `CLAUDE.md` is not optional — acceptance criteria are the floor.

1. **Flip status** — set the item's frontmatter to `status: in-progress`.

2. **Run the consumer-read audit** (Quality Bar #4 + #5, MANDATORY for integration-backed claims):
   - Open every `@Value` / `@ConfigurationProperties` consumer for each key the item touches. Record `file:line`.
   - For every SDK / client builder in the code path, **enumerate every builder parameter** and classify each as `configured | safely-defaulted | caveat-defaulted` (see `CLAUDE.md` Quality Bar #5). Every `caveat-defaulted` parameter is either:
     - In scope → must be documented as a known limitation (admonition block) in this item's change.
     - Out of scope → log as a new backlog item with `scanner_source: "discovered-during-{original-ID}"` and, if the code can be fixed, draft a platform-side GitHub issue body in the item's Context.
   - Open explicit error / retry / timeout handlers for each integration. Undocumented behavior that materially affects operators → finding.
   - **If you find a caveat that is in scope for the current item, you must ship the caveat in the same PR.** Shipping a fix for the visible bug while leaving the silent caveat for "next time" is the failure mode this audit exists to prevent.

3. **Author the change** — follow acceptance criteria, hold the full Quality Bar:
   - **No duplicates.** Duplication sweep already classified every collision; honor those decisions.
   - **Synonyms and aliases logged.** Any alias encountered or introduced → row in `docs/main-concepts.md` Terms & Aliases table, in this same PR.
   - **Caveats captured.** Every caveat surfaced by the consumer-read audit is in the doc as a dedicated section, not prose.
   - **Code ↔ doc cross-check.** Bidirectional — every functional claim → code evidence; every user-visible code path touched → doc coverage (feature / limitation / performance note / security consideration). Missing either direction is a finding.
   - **Layout and completeness.** If the change adds or renames a page, update `SUMMARY.md` and every index / `README.md` link in the same commit.
   - **No functional changes** to application code — only docs, tests, comments, spec alignment.

4. **Follow-up work auto-logging** — if the change reveals an out-of-scope issue:
   - **Trivial + related** (typo on an adjacent line, obvious whitespace): fold into the current commit and note in the commit body.
   - **Small + fits the batch**: create `backlog/{cat}/DOC-NNN.md` with full frontmatter and acceptance criteria, update `state/file-registry.yaml`, update `state/PROGRESS.md` counts, add to the batch, reference in the originating item's Context.
   - **Larger or unrelated** (work we still own here): create the work item with full frontmatter (`scanner_source: "discovered-during-{original-ID}"`, `status: pending`, priority, affected_files, found_date), update file-registry, update PROGRESS. Do **not** implement — the triage-review gate still applies. But log everything a cold-start maintainer needs.
   - **Upstream code defect or feature gap** (e.g., DOC-008's missing `.region(...)`, DOC-013's SSM pagination silent-truncation): the doc-side caveat ships in the current item; for the upstream code fix, run `/log-issue {repo} "title"` to scaffold `issues/{repo}/{PREFIX}-NNN.md` as a paste-ready GitHub issue draft (see `issues/README.md`). Add a `## Platform-side follow-up filed` section to the originating backlog item pointing at the draft path. Do not modify platform code from a docs session, and do not file the GitHub issue from this session — filing is a deliberate human action.
   - **Scope-changing** (e.g., "fixing this link requires restructuring 5 pages"): stop and surface the judgment call to the user before proceeding.
   - **Never** write "noted as follow-up" or "recommend logging this" without the file on disk. Narration is not logging — neither for backlog items nor for issue drafts.

5. **Authoring rules for `target_repo: documentation`**:
   - Never hand-author `[text](target.md "mention")` links — GitBook's `"mention"` shortcut is editor-native and falls back to raw GitHub URLs when written in git. Use plain markdown `[Title](target.md)`.
   - When creating a new page, the same commit must include: the page file, the `SUMMARY.md` entry, and any index / README link. Splitting these has caused cached fallbacks on the live site.
   - When adding a page for a feature that already has a `Features.md` section: the `Features.md` section collapses to a 2-sentence teaser linking to the canonical page. No parallel descriptions.
   - Before committing, grep the working tree for `"mention"` on the lines you touched; rewrite as plain links.

6. **Verify locally**:
   - Every acceptance criterion met
   - Every Quality Bar responsibility #1–#8 has citable evidence (file:line for code-backed claims, URL for published pages)
   - Tests (if any) pass, no regressions

7. **Commit** on the batch branch:
   - Stage only the files this item touches
   - Message format:
     ```
     {category}: {title} [{ID}]

     {1–3 sentence what-and-why body}

     Consumer-read:
     - {file:line}
     - {file:line}
     ```
   - The `Consumer-read:` footer is **mandatory** for any item whose claims are code-backed. Documentation-only grammar / prose polish items (no runtime claim) may omit it; note `Consumer-read: none (prose polish, no code claim)` so review knows you considered it.

8. **Flip status to `review-ready`** — not `done`. Record in the item's Context:
   - The list of affected pages (for live-site verification).
   - The consumer-read footer contents (even if already in the commit, duplicating here makes `/review` cheap).
   - Any caveats surfaced in the consumer-read audit, in-scope or out-of-scope.

## Phase 3 — Close the batch

1. **Consolidate state updates** on a single odd-team branch:
   - All `DOC-XXX` frontmatter flips to `review-ready`
   - `state/file-registry.yaml` status updates
   - `state/PROGRESS.md` counts (add a `review-ready` row if not present; bump the Upstream Issues table for any new draft)
   - `navigation/domains/*.md` updates if pointers shifted — **especially for bean factories / SDK builders discovered during the consumer-read audit**
   - Any new ADR drafts in `adrs/drafts/`
   - Any new `backlog/{cat}/DOC-NNN.md` follow-up items discovered during the batch
   - Any new `issues/{repo}/{PREFIX}-NNN.md` upstream issue drafts surfaced during the consumer-read audit, with back-references in the originating backlog items

2. **Push and open PRs** — at most one per repo:
   - Target-repo PR (e.g., `documentation`): body enumerates each item by ID with a one-line summary. **Explicitly mark the PR as pending review** — not ready to merge until `/review` passes in a separate session.
   - odd-team state PR: single PR covering all bookkeeping for the batch. Same pending-review marker.

3. **Hand off to review** — the batch does not proceed to merge from this session. Report:
   - Items moved to `review-ready` (by ID)
   - Follow-ups logged (by ID — both backlog items and issue drafts)
   - Consumer-read footers (summarized)
   - Caveats surfaced (in-scope and out-of-scope)
   - PR URLs
   - Instruction to the user: "Run `/review` in a separate session for each item, or `/review batch:{branch-name}` for the batch. Any upstream issue drafts under `issues/` are queued for human filing — review their bodies and paste into the target repo's GitHub when ready."

Live-site verification is **not** the implementer's responsibility under the new bar — it moves to `/review` to enforce the separate-session rule. Tech debt remains on the implementer: surface the live-URL list so `/review` does not have to derive it.

## When to pause and ask the user

- Acceptance criteria genuinely cannot be met → mark the item `blocked`, continue the rest of the batch; do not escalate single-item blockers.
- A destructive or irreversible action isn't explicitly authorized (deleting files, force-pushing, dropping data).
- An ADR conflict forces a material scope decision.
- A scope-expansion judgment call ("this pulls in 5 more items — expand or split?").
- The consumer-read audit surfaces a caveat whose fix would materially expand the change. Flag and ask.
- The batch is complete — surface one review-handoff request with the full list.

Silence is not the target; savvy judgment is. Don't bundle unrelated items, don't skip Quality Bar checks to speed through a batch, don't merge logically distinct changes into one commit, don't skip the consumer-read audit, **don't self-mark items `done`**.

## Reference

- **Quality Bar (the eight responsibilities)** → `CLAUDE.md` "Implementation Quality Bar"
- **Batching rules** → `CLAUDE.md` "Autonomous Execution and Batching"
- **GitBook authoring gotchas** → `CLAUDE.md` "Documentation Authoring Rules"
- **Work-item format + lifecycle** → `backlog/README.md`
- **Integration caveat scanner** → `scanners/docs/accuracy/integration-caveats.md` (useful as a checklist when planning consumer-reads)