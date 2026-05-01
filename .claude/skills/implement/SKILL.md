---
name: implement
description: Work a batch of backlog items end-to-end as a maintainer — hold the Implementation Quality Bar, run the Pre-authoring stance check, log follow-ups on disk, flip items to `review-ready`, and ship one PR per repo per batch.
argument-hint: <work-item-id>
allowed-tools: Read Grep Glob Edit Write WebFetch Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
---

# Implement a Batch

`$ARGUMENTS` is the **batch starter**, not the sole item. You are an ODD Team maintainer working a batch end-to-end: holding the Implementation Quality Bar, logging discovered follow-ups on disk, producing few cohesive PRs that the user can review in one pass.

If `$ARGUMENTS` is empty, show pending items sorted by priority and ask which to start the batch from.

**You cannot self-mark items `done`.** This phase ends at `status: review-ready`. `/review` in a separate session handles the final transition. The lesson: `retrospectives/LSN-002-minio-region-unset.md` — self-closed items shipped a silent data-loss caveat that a separate-session review would have caught.

## What to load

Read in this order (the session-boot pattern from `CLAUDE.md`):

1. `CLAUDE.md` — universal framework, Quality Bar overview, batching rules.
2. `pillars/{active}/pillar.md` — the bar; for documentation-pillar items, `pillars/documentation/pillar.md` "The bar — stated explicitly".
3. `pillars/{active}/{cornerstones,gates,authoring,canonical-homes}.md` — pillar-specific rules.
4. `navigation/architecture.md` + `navigation/domains/{relevant}.md` — code pointers.
5. The work item file (search `backlog/`).

## Phase 1 — Plan the batch

1. **Pre-flight on the starter.** Status must be `pending`; check `state/file-registry.yaml` for conflicts; check `adrs/` for constraints; read every file in `affected_files`; consult navigation if a path is stale.

2. **Freshen `origin/main`** for every target repo the batch will touch. **Mandatory for `documentation`** (`retrospectives/LSN-008-stale-branch-false-positives.md`): fetch and checkout `origin/main` in `../documentation` before reading or editing.

3. **Assemble batch candidates.** From the backlog, pick continuation items that share the starter's `target_repo`, have no file conflicts with already-staged items, are small or medium effort, and share a theme (scanner source, feature area, or quality-bar concern). Name the batch after the theme it covers (e.g., `feature/docs-quality-xrefs`). Cut the batch branch from freshly-fetched `origin/main`; the odd-team bookkeeping lives on a parallel branch in this repo.

4. **Per-item: pre-authoring duplication sweep** → run `playbooks/duplication-sweep.md`. Existing-content + new-content + backlog-internal sweeps; record decisions in the item's Context. If the sweep shows the item is mis-scoped, drop it from the batch.

5. **Per-item: claim inventory + Sources plan** → run `playbooks/claim-inventory.md`. Draft the `Sources:` commit footer **before** authoring; name a verifiable SoT per claim class. If a claim's SoT is not reachable in <60s, drop the claim or mark the item `blocked` pending SoT.

## Phase 2 — Execute each item (in order on the batch branch)

Repeat per item.

1. **Flip status** — set the item's frontmatter to `status: in-progress`.

2. **Pre-authoring stance check** → run `playbooks/pre-authoring-stance.md` for **each sub-section** the change will introduce, not just at item start. Five questions: content type / canonical home / SUMMARY placement / WHY-preservation / Pride. If any answer reveals a structural mismatch, **stop and address the structural question first** — extend the canonical home, propose a new pillar, or escalate. Do not author over a known mismatch.

3. **SoT verification** → run `playbooks/consumer-read.md` (covers config / SDK / feature / error / spec / lifecycle / dep claim classes). For SDK-backed claims, this calls `playbooks/unset-parameter-audit.md` per builder. Every `caveat-defaulted` parameter is either documented in the change as a known limitation or logged as a new backlog item via `playbooks/follow-up-on-disk.md`.

4. **Author the change.** Hold every Quality Bar gate (universal cores in `playbooks/`; pillar specialisations in `pillars/{active}/gates.md`). Acceptance criteria are the floor; the gates are the bar.

5. **Follow-up auto-logging** → run `playbooks/follow-up-on-disk.md` for every out-of-scope discovery. Grep the backlog first; classify scope (trivial-fold / small-batch-item / larger-deferred / upstream-issue). Never write "noted as follow-up" without the file on disk.

6. **Pillar authoring rules** — for `target_repo: documentation`, hold `pillars/documentation/authoring.md` (no GitBook `"mention"` links; ship page + SUMMARY + index together; in-page TOC sync; `Sources:` footer format).

7. **Verify locally** — every acceptance criterion met; every Quality Bar gate has citable evidence; outbound URLs verified per `playbooks/claim-inventory.md` step 3; tests pass.

8. **Commit** on the batch branch with the `Sources:` footer (format in `pillars/documentation/authoring.md`):
   ```
   {category}: {title} [{ID}]

   {1–3 sentence what-and-why}

   Sources:
   - Config: {file:line}
   - Builder: {file:line} ({param-status})
   - Repo: {url} → architecture.md row "{repo}"
   ...
   ```
   Footer is **mandatory** for code-backed / URL-backed / spec-backed / terminology-backed claims. Pure prose-polish writes `Sources: none (prose polish, no factual claim)` explicitly.

9. **Flip status to `review-ready`** — not `done`. Record in the item's Context: affected pages (for live-site verification), the `Sources:` footer contents, the outbound URL list, any caveats surfaced (in-scope and out-of-scope).

## Phase 3 — Close the batch

1. **Consolidate state updates** on a single odd-team branch: `DOC-XXX` frontmatter → `review-ready`; `state/file-registry.yaml`; `state/PROGRESS.md` counts (and Upstream Issues table for any new draft); `navigation/domains/*.md` if pointers shifted (especially bean factories / SDK builders discovered during the consumer-read audit); any new ADR drafts; new `backlog/{cat}/DOC-NNN.md` follow-up items; new `issues/{repo}/{PREFIX}-NNN.md` upstream drafts.

2. **Push and open PRs** — at most one per repo. Target-repo PR body enumerates each item by ID with a one-line summary; mark explicitly as **pending review**. odd-team state PR covers all bookkeeping for the batch with the same pending-review marker.

3. **Hand off to review.** The batch does not proceed to merge from this session. Report: items moved to `review-ready` (by ID); follow-ups logged (by ID — both backlog and issue drafts); `Sources:` footers (summarised); caveats surfaced; PR URLs; instruction to user to run `/review` in a separate session.

Live-site verification is **`/review`'s** responsibility (`playbooks/live-site-verification.md`), not the implementer's. Surface the live-URL list so `/review` does not have to derive it.

## When to pause and ask the user

- Acceptance criteria genuinely cannot be met → mark the item `blocked`, continue the batch; do not escalate single-item blockers.
- A destructive or irreversible action isn't explicitly authorized.
- An ADR conflict forces a material scope decision.
- A scope-expansion judgment call ("this pulls in 5 more items — expand or split?").
- The consumer-read audit surfaces a caveat whose fix would materially expand the change.
- The batch is complete — surface one review-handoff request with the full list.

Silence is not the target; savvy judgment is. Don't bundle unrelated items, don't skip Quality Bar checks to speed through a batch, don't merge logically distinct changes into one commit, don't skip the SoT verification, **don't self-mark items `done`**.

## Reference

- Quality Bar gates → `pillars/{active}/gates.md` (documentation: `pillars/documentation/gates.md`)
- Universal-gate playbooks → `playbooks/{consumer-read,unset-parameter-audit,duplication-sweep,pre-authoring-stance,claim-inventory,live-site-verification,follow-up-on-disk}.md`
- Case-law → `retrospectives/` (`retrospectives/README.md` carries an LSN-by-gate index)
- Integration patterns + canonical repos → `navigation/architecture.md`
- Batching rules → `CLAUDE.md` "Autonomous Execution and Batching"
- Work-item format + lifecycle → `backlog/README.md`