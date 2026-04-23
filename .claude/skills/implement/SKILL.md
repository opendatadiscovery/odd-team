---
name: implement
description: Work a batch of backlog items end-to-end as a maintainer — hold the Implementation Quality Bar, log follow-ups on disk, ship one PR per repo per batch.
argument-hint: <work-item-id>
allowed-tools: Read Grep Glob Edit Write WebFetch Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
---

# Implement a Batch

`$ARGUMENTS` is the **batch starter**, not the sole item. You are an ODD Team maintainer working a batch end-to-end — running the change, holding the Implementation Quality Bar (see `CLAUDE.md`), logging any discovered follow-ups on disk, and producing few cohesive PRs that the user can review in one pass.

If `$ARGUMENTS` is empty, show pending items sorted by priority and ask which to start the batch from.

## Phase 1 — Plan the batch

1. **Orient** — Read `CLAUDE.md` (team identity, Quality Bar, batching, authoring rules), `navigation/features.yaml`, the relevant `navigation/domains/*.md`, and the work item file for `$ARGUMENTS` (search `backlog/`).

2. **Pre-flight on the starter**:
   - Status must be `pending` (not `blocked`, not `in-progress`)
   - Check `state/file-registry.yaml` — no conflicting `in-progress` items on the same files
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

## Phase 2 — Execute each item (in order on the batch branch)

Repeat per item. The Quality Bar in `CLAUDE.md` is not optional — acceptance criteria are the floor.

1. **Flip status** — set the item's frontmatter to `status: in-progress`.

2. **Author the change** — follow acceptance criteria, hold the full Quality Bar:
   - **No duplicates.** Duplication sweep already classified every collision; honor those decisions.
   - **Synonyms and aliases logged.** Any alias encountered or introduced → row in `docs/main-concepts.md` Terms & Aliases table, in this same PR.
   - **Caveats captured.** If the code carries a known limitation, performance characteristic, or security consideration for this feature, the doc must say so — as a dedicated section, not buried in prose. Undocumented caveats discovered here are findings; log them.
   - **Code ↔ doc cross-check.** Verify every functional claim against `../odd-platform`, `../odd-collectors`, or `../opendatadiscovery-specification`. Verify every user-visible code path you touch is covered by the doc as a **feature**, **known limitation**, **performance note**, or **security consideration**. Missing coverage in either direction is a finding.
   - **Layout and completeness.** If the change adds or renames a page, update `SUMMARY.md` and every index / `README.md` link in the same commit.
   - **No functional changes** to application code — only docs, tests, comments, spec alignment.

3. **Follow-up work auto-logging** — if the change reveals an out-of-scope issue:
   - **Trivial + related** (typo on an adjacent line, obvious whitespace): fold into the current commit and note in the commit body.
   - **Small + fits the batch**: create `backlog/{cat}/DOC-NNN.md` with full frontmatter and acceptance criteria, update `state/file-registry.yaml`, update `state/PROGRESS.md` counts, add to the batch, reference in the originating item's Context.
   - **Larger or unrelated**: create the work item with full frontmatter (`scanner_source: "discovered-during-{original-ID}"`, `status: pending`, priority, affected_files, found_date), update file-registry, update PROGRESS. Do **not** implement — the triage-review gate still applies. But log everything a cold-start maintainer needs.
   - **Scope-changing** (e.g., "fixing this link requires restructuring 5 pages"): stop and surface the judgment call to the user before proceeding.
   - **Never** write "noted as follow-up" or "recommend logging this" without the file on disk. Narration is not logging.

4. **Authoring rules for `target_repo: documentation`**:
   - Never hand-author `[text](target.md "mention")` links — GitBook's `"mention"` shortcut is editor-native and falls back to raw GitHub URLs when written in git. Use plain markdown `[Title](target.md)`.
   - When creating a new page, the same commit must include: the page file, the `SUMMARY.md` entry, and any index / README link. Splitting these has caused cached fallbacks on the live site.
   - When adding a page for a feature that already has a `Features.md` section: the `Features.md` section collapses to a 2-sentence teaser linking to the canonical page. No parallel descriptions.
   - Before committing, grep the working tree for `"mention"` on the lines you touched; rewrite as plain links.

5. **Verify locally**:
   - Every acceptance criterion met
   - Quality Bar responsibilities held
   - Tests (if any) pass, no regressions

6. **Commit** on the batch branch:
   - Stage only the files this item touches
   - Message: `{category}: {title} [{ID}]` — e.g., `docs: collapse M2M section to teaser [DOC-053]`

7. **Flip status** — set the item's frontmatter to `status: done`.

## Phase 3 — Close the batch

1. **Consolidate state updates** on a single odd-team branch:
   - All `DOC-XXX` frontmatter flips to `done`
   - `state/file-registry.yaml` status updates
   - `state/PROGRESS.md` counts
   - `navigation/domains/*.md` updates if pointers shifted
   - Any new ADR drafts in `adrs/drafts/`
   - Any new `backlog/{cat}/DOC-NNN.md` follow-up items discovered during the batch

2. **Push and open PRs** — at most one per repo:
   - Target-repo PR (e.g., `documentation`): body enumerates each item by ID with a one-line summary, links to live-verification notes
   - odd-team state PR: single PR covering all bookkeeping for the batch

3. **Post-merge verification** (MANDATORY for any batch touching `documentation`):
   - Wait for the GitBook build (typically < 5 minutes).
   - For every affected page, compute the live URL (`docs/a/b/c.md` → `https://docs.opendatadiscovery.org/a/b/c`; `README.md` collapses to its directory URL).
   - WebFetch each URL and verify:
     - Page loads with the intended change visible
     - No `github.com/opendatadiscovery/documentation/blob/` substrings appear (GitBook fallback signature)
     - Relative links touched by this change resolve to `docs.opendatadiscovery.org`, not to GitHub
     - Sidebar entry present for any newly-added page
   - If any URL fails: reopen that item as `status: blocked`, add a `## Live-site verification failure` section (URL, observed fallback, suggested fix), and surface to the user. The rest of the batch can stay `done` if their URLs passed.
   - If all pass: note the live URL(s) in each item's Context and leave as `done`.

   Non-documentation batches skip live-site verification.

4. **Report to the user** — one concise summary: items completed (by ID), follow-ups logged (by ID), live-URL verifications, open PRs.

## When to pause and ask the user

- Acceptance criteria genuinely cannot be met → mark the item `blocked`, continue the rest of the batch; do not escalate single-item blockers.
- A destructive or irreversible action isn't explicitly authorized (deleting files, force-pushing, dropping data).
- An ADR conflict forces a material scope decision.
- A scope-expansion judgment call ("this pulls in 5 more items — expand or split?").
- The batch is complete — surface one review request with the full list.

Silence is not the target; savvy judgment is. Don't bundle unrelated items, don't skip Quality Bar checks to speed through a batch, don't merge logically distinct changes into one commit, don't skip live-site verification.

## Reference

- **Quality Bar (the six responsibilities)** → `CLAUDE.md` "Implementation Quality Bar"
- **Batching rules** → `CLAUDE.md` "Autonomous Execution and Batching"
- **GitBook authoring gotchas** → `CLAUDE.md` "Documentation Authoring Rules"
- **Work-item format** → `backlog/README.md`