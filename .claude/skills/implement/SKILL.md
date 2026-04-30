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

1. **Orient** — Read `CLAUDE.md` (team identity, nine-gate Quality Bar, batching, authoring rules), `navigation/features.yaml`, `navigation/architecture.md` (integration-pattern + canonical-repo map), the relevant `navigation/domains/*.md`, and the work item file for `$ARGUMENTS` (search `backlog/`). Special attention to Quality Bar #4 (Consumer-read), #5 (Unset-parameter audit), and **#9 (Factual Claim Provenance)** — every factual claim must be traceable to a canonical Source of Truth, not to memory.

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

5. **Pre-authoring bi-directional duplication sweep** (MANDATORY for `target_repo: documentation`, run per item in the batch):
   The sweep runs in both directions — existing content you might conflict with, **and** new terms / URLs / repos / aliases you are about to introduce. Introducing an unregistered alias is just as bad as missing an existing duplicate.
   - Read `docs/main-concepts.md` **Terms & Aliases** table — the canonical synonym map.
   - Build the **existing-content** search surface: each canonical term or alias matching the item's topic, each config key / env var, each proposed page-title keyword.
   - Grep the whole `../documentation/docs/` tree for that surface.
   - **For every hit outside `affected_files`**, classify and decide before authoring:
     - **Link** — existing mention stays, new content links to it (or vice versa).
     - **Expand-in-place** — existing mention is the right home; grow it there instead of creating a new page. Update `affected_files`.
     - **Consolidate** — existing mention is a redundant copy that should collapse into a teaser pointing to the canonical page. Update `affected_files`.
     - **New alias entry** — existing mention uses a different name for the same thing; the item must also add a row to the Terms & Aliases table.
   - Record each decision in the item's Context (format: `- {file:line} — {classification} — {brief reason}`). This is the audit trail for why a file was or wasn't touched.
   - Build the **new-content** inventory: every term, config key, URL (outbound GitHub repo link, live-site link, external docs link), and repo name the item is about to introduce. For each:
     - **Term / alias** → if not already in `main-concepts.md`, the item must add a row. Log the intended row now.
     - **Outbound URL** (e.g., `https://github.com/opendatadiscovery/odd-dbt`) → name the SoT that justifies the link target (repo README / owner's docs) and plan the Gate 9 verification (WebFetch / `gh repo view`).
     - **Repo name** (`odd-collector`, `odd-dbt`, `odd-great-expectations`, …) → classify against `navigation/architecture.md` integration patterns (collector / push-client / SDK / platform / spec). If the architecture map doesn't list it, that is a navigation gap — log a discovered finding.
   - If the sweep shows the item is mis-scoped (feature already fully documented elsewhere under a different name), update the work item, drop it from the batch, and **do not** author duplicate content.

   Rationale: 2026-04-22 — DOC-003 (S2S) and DOC-013 (collector secrets backend) both shipped as new pages while `Features.md` already had sections under different names. 2026-04-23 — DOC-027 authored a GitHub URL (`/odd-collectors`) for a push-client that actually lives at `/odd-dbt`; the bi-directional sweep on the new URL would have forced a Gate 9 WebFetch before the commit. This sweep makes both classes of failure impossible to reach a PR.

6. **Claim inventory and Source-of-Truth plan** (MANDATORY, supersedes the older Consumer-read plan — it now covers the full Gate 9 surface):
   Draft the `Sources:` commit footer *before* authoring. For every factual claim the item will make, name the canonical SoT you will verify against. Use the class labels from the Gate 9 SoT table (`CLAUDE.md`).
   - **Repo** claims (a GitHub URL, a repo role as collector / push-client / SDK / platform): SoT is the repo's live README or `gh repo view` — plan a WebFetch or `gh repo view opendatadiscovery/{name}`.
   - **Integration** claims (what pushes / pulls, which entity types): SoT is the integration's README / top-level module docstring in the integration repo. Name the file.
   - **Config key** claims (`application.yml` key behavior, env var semantics): SoT is the platform/collector `application.yml` **plus** every `@Value` / `@ConfigurationProperties` consumer. List each `file:line`.
   - **SDK / Builder** claims (retry behavior, default region, timeout, connection pooling): SoT is the bean factory / builder file. List the file and the builder method. Plan the unset-parameter audit (Gate 5) here.
   - **Spec** claims (URL path, verb, request/response shape): SoT is `opendatadiscovery-specification/openapi.yaml`. List the line range.
   - **Term / alias** claims (feature name, canonical synonym): SoT is `main-concepts.md` Terms & Aliases. If absent, the item must add the row — log it.
   - **Lifecycle** claims (deprecated / removed / renamed-in-vX.Y): SoT is the release notes / CHANGELOG + a grep of the current `main` for the symbol. Name both.
   - **Dependency / version** claims (`dataprofiler==0.10.9`, Spring Boot 3.x): SoT is `pyproject.toml` / `build.gradle` / `pom.xml` on current `main`.
   - **Error / retry / timeout** claims: SoT is the explicit handler file — never "the SDK probably…".
   - **Cross-repo fact** (where does feature X live): SoT is `repos.yaml` in this workspace + the referenced repo's README.
   
   If a claim's SoT is not reachable in under a minute of verification, de-scope the claim or mark the item `blocked` pending SoT. **"I remember from a prior session" is not a SoT.**
   
   For each SoT entry, also list `navigation/domains/*.md` or `navigation/architecture.md` as the pointer that led you there — if navigation doesn't list it, that is a navigation gap to log during Phase 2.

## Phase 2 — Execute each item (in order on the batch branch)

Repeat per item. The Quality Bar in `CLAUDE.md` is not optional — acceptance criteria are the floor.

1. **Flip status** — set the item's frontmatter to `status: in-progress`.

2. **Run the Source-of-Truth verification** (Quality Bar #4 + #5 + #9, MANDATORY — covers every claim class in the Gate 9 SoT table, not only integration-backed claims):
   Work through the claim inventory from Phase 1 step 6. For each claim class, verify against its SoT before writing the claim text.
   - **Config-key claims**: open every `@Value` / `@ConfigurationProperties` consumer for each key. Record `file:line`.
   - **SDK / Builder claims**: enumerate every builder parameter and classify each as `configured | safely-defaulted | caveat-defaulted` (Quality Bar #5). Every `caveat-defaulted` parameter is either:
     - In scope → must be documented as a known limitation (admonition block) in this item's change.
     - Out of scope → log as a new backlog item with `scanner_source: "discovered-during-{original-ID}"` and, if the code can be fixed, run `/log-issue` to draft the upstream issue.
   - **Integration claims** (which repo implements the feature, what it pushes/pulls): WebFetch the repo README, or run `gh repo view opendatadiscovery/{name}`. Do not rely on memory — 2026-04-23 DOC-027 shipped with a wrong repo URL because memory said "collectors" and no SoT fetch happened.
   - **Spec claims**: open `opendatadiscovery-specification/openapi.yaml` on the latest `origin/main` and cite the line range.
   - **Term / alias claims**: read `main-concepts.md` Terms & Aliases; if the term is missing, the item adds the row.
   - **Lifecycle claims**: read the release notes / CHANGELOG and grep current `main` for the symbol.
   - **Dependency / version claims**: read the manifest file on current `main` (`pyproject.toml`, `build.gradle`, `pom.xml`).
   - **Error / retry / timeout claims**: read the explicit handler file — not "the SDK probably…".
   - Open explicit error / retry / timeout handlers for each integration. Undocumented behavior that materially affects operators → finding.
   - **If you find a caveat that is in scope for the current item, you must ship the caveat in the same PR.** Shipping a fix for the visible bug while leaving the silent caveat for "next time" is the failure mode this audit exists to prevent.
   - Fill the `Sources:` footer draft with every SoT touched, by class.

3. **Author the change** — follow acceptance criteria, hold the full nine-gate Quality Bar:
   - **No duplicates.** Duplication sweep already classified every collision; honor those decisions.
   - **Synonyms and aliases logged.** Any alias encountered or introduced → row in `docs/main-concepts.md` Terms & Aliases table, in this same PR.
   - **Caveats captured.** Every caveat surfaced by the consumer-read audit is in the doc as a dedicated section, not prose.
   - **Code ↔ doc cross-check.** Bidirectional — every functional claim → code evidence; every user-visible code path touched → doc coverage (feature / limitation / performance note / security consideration). Missing either direction is a finding.
   - **Layout and completeness.** If the change adds or renames a page, update `SUMMARY.md` and every index / `README.md` link in the same commit. **If the page has an in-page TOC at the top** (a sequence of `[Title](path.md#anchor)\` lines in the first ~30 lines — canonical example: `docs/Features.md` lines 3-29), and the change adds, renames, or removes an H2, **update the TOC row in the same commit**. Detection: read the top of every page being touched; if you see the bracket-link sequence, treat it as part of `affected_lines` for any H2 edit. Skipping this caused the 2026-04-27 DOC-069 miss (user-caught post-merge; DOC-076 logged).
   - **IA hierarchy — pre-authoring placement check.** Before writing the SUMMARY entry for any new page, walk the conceptual tree (per CLAUDE.md Cornerstone 2 "Hierarchy depth must reflect conceptual depth"):
     1. Read `SUMMARY.md` end-to-end and identify the candidate parent: which top-level entry, pillar landing, or section group is this page conceptually a child of?
     2. Inspect the candidate parent's existing children. Are they conceptual peers of the new page? If yes → nest under this parent. If no → keep walking; the right parent is elsewhere or doesn't exist yet.
     3. **Don't default to top-level just because no obvious parent jumps out.** Top-level slots are scarce and signal "primary navigation pillar." The absence of a clean parent is a signal to think harder, not to convenience-place. Three legitimate outcomes:
        - **(a) Nest under an existing parent** (the common case).
        - **(b) Expand scope** to add the missing parent landing first (a Cornerstone-2 decision: which pillar does it belong under, what other peers will it host). This is rare but legitimate when a new page genuinely opens a new aspect.
        - **(c) Pause and escalate** to the user as a placement-judgment call — this is the "minimize user interventions but don't skip judgment calls" autonomous-batching rule. Better to ask once than to ship convenience drift the reviewer rejects under Gate 7.
     4. **Avoid the "sibling of a parent group" trap**: if the candidate placement would put the new page next to a group that has its own subpages, ask whether the new page belongs *inside* that group instead. Past drift example: `Build a custom collector` placed as a sibling of the `Build and run` group instead of nested inside it.
     5. **Existing drift is not yours to fix mid-batch** — if you notice the candidate parent or its surrounding tree carries pre-existing IA drift (e.g., `Directory` shouldn't be top-level), log a separate `DOC-NNN` refactor item; don't bundle the IA refactor into the current item unless the implementer-side AC explicitly covers it. Reviewer Gate 7 will reject *new* convenience drift but accept inherited drift that the current change does not make worse.
   - **Factual provenance (Gate 9).** Every claim in the text corresponds to a row in your `Sources:` draft. If a claim has no SoT entry, either verify now and add the row, or remove the claim. **No "from memory" claims.**
   - **Outbound URLs verified.** Every `github.com/opendatadiscovery/...` URL, every live-site link, every external docs link written in this change has been fetched or confirmed against the SoT named in the claim inventory. No hand-authored URLs based on pattern guesses.
   - **No functional changes** to application code — only docs, tests, comments, spec alignment.

4. **Follow-up work auto-logging** — if the change reveals an out-of-scope issue:
   - **Before creating any new `DOC-NNN`**: grep `backlog/` for the concept (canonical term + aliases from `main-concepts.md`) to confirm it isn't already covered. 2026-04-23 — a retrospective proposed a new "integrations hub" item without checking; DOC-042 already covered it at higher fidelity. The rails catch this only if you run them.
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
   - Every Quality Bar responsibility #1–#9 has citable evidence (file:line for code-backed claims, URL for published pages, SoT class for every factual claim)
   - Outbound URL sweep: `grep -nE "https?://(github\.com|docs\.opendatadiscovery\.org|.*opendatadiscovery.*)"` across the lines this item touched, verify every hit is in the `Sources:` footer (WebFetched or `gh repo view`'d)
   - Tests (if any) pass, no regressions

7. **Commit** on the batch branch:
   - Stage only the files this item touches
   - Message format:
     ```
     {category}: {title} [{ID}]

     {1–3 sentence what-and-why body}

     Sources:
     - Config: {file:line}
     - Config-consumer: {file:line}
     - Builder: {file:line} ({builder}; {parameters-classified})
     - Integration: {repo-README-url or gh-repo-view output}
     - Spec: {openapi.yaml:line-range}
     - Term: main-concepts.md Terms & Aliases row "{term}"
     - Repo: https://github.com/opendatadiscovery/{name} ({role: collector | push-client | SDK | platform | spec})
     ```
   - Include only the classes that apply. Legacy `Consumer-read:` footer form is still accepted for items whose only claims are config / builder (strict subset of `Sources:`), but new work should use `Sources:` so review can map each line back to the Gate 9 SoT table.
   - The footer is **mandatory** for any item whose claims are code-backed or include outbound URLs / repo names. Documentation-only grammar / prose polish items (no factual claim) may omit it; note `Sources: none (prose polish, no factual claim)` so review knows you considered it.

8. **Flip status to `review-ready`** — not `done`. Record in the item's Context:
   - The list of affected pages (for live-site verification).
   - The `Sources:` footer contents (even if already in the commit, duplicating here makes `/review` cheap).
   - The **outbound URL list** the item touched (every `github.com/opendatadiscovery/*`, `docs.opendatadiscovery.org/*`, and external docs URL written in this change), so Gate 9 can re-fetch without grepping.
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

- **Quality Bar (the nine responsibilities)** → `CLAUDE.md` "Implementation Quality Bar"
- **Source-of-Truth table (Gate 9 claim classes)** → `CLAUDE.md` "Factual Claim Provenance"
- **Integration patterns + canonical repos** → `navigation/architecture.md`
- **Batching rules** → `CLAUDE.md` "Autonomous Execution and Batching"
- **GitBook authoring gotchas** → `CLAUDE.md` "Documentation Authoring Rules"
- **Work-item format + lifecycle** → `backlog/README.md`
- **Integration caveat scanner** → `scanners/docs/accuracy/integration-caveats.md` (useful as a checklist when planning consumer-reads)