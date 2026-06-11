---
id: ADR-release-train-doc-gating
title: Release-train documentation gating — milestone-keyed doc branches, published at release
status: draft
date: 2026-06-11
deciders: maintainer (Raman)
amends:
  - CLAUDE.md "Review Gates / Gate 8" ("Never defer live-site checks") — refined to "never skip"; release-gated items get a scheduled, tracked deferral
  - backlog/README.md lifecycle — new `pending-release` status between `review-ready` and `done`
  - pillars/contributor — new G-C11 (milestone hard stop); G-C10 docs deliverable routed through the train
  - playbooks/live-site-verification.md trigger — fires per publication event (train merge), not per authoring commit
research:
  - in-band verification 2026-06-11 — GitHub API: odd-platform open milestones `0.28.0` (due 2026-06-22, 4 open + 3 closed issues) and `1.0.0`; latest published release `0.27.13` (2026-04-03); issue #1748 carries milestone `0.28.0`
  - in-band verification — odd-platform tags are plain three-segment semver (`git tag` → `0.27.13`); milestone titles since 0.28.0 match that format (older milestones `0.2`…`0.11` predate the convention)
  - retrospectives/LSN-034-docs-work-branch-bare-push-published-main-early.md — the manifested instance of this gap class (merge-level)
  - GitBook publishes the single synced branch (`main`) of opendatadiscovery/documentation; operational evidence: LSN-004 / LSN-028 / every Gate 8 run (live site updates on docs-main merges, branches are invisible to the publisher)
---

# ADR — Release-train documentation gating

## Context

`docs.opendatadiscovery.org` is a published technical manual. Operators run **published releases** of odd-platform (today: `0.27.13`), not `main`. The current workflow updates documentation as soon as a code change merges to odd-platform `main` — so between code-merge and the next release, the live manual describes functionality **no operator can have**. An operator on 0.27.13 reads a feature page, looks for the feature, and finds the docs "lying" — the exact trust failure this workspace exists to prevent, inverted: the docs are *ahead* of reality instead of behind it.

The gap is not hypothetical. **LSN-034 (2026-06-10)** is the merge-level instance: CTRIB-003's docs note ("odd-platform#1748 added the three keys to every bundle") went live while PR #1749 was still a draft. LSN-034 fixed the push mechanics (`push.default current`, same-name refspecs, branch-protection recommendation) — but even with perfect merge sequencing, the *release-level* gap remains: #1749 merged to `main` on 2026-06-10, and the live page asserts behaviour that ships only when release `0.28.0` is published. Every `/contribute` run (G-C10: "docs move with the code") and every `/implement` doc batch documenting freshly-merged behaviour reproduces this class.

**The maintainer's decision (2026-06-11):** bundle changes with GitHub milestones; publish the matching documentation when the milestone closes AND the release with the same version is published. Milestone title == release tag (e.g. milestone `0.28.0` → tag `0.28.0` — formats verified compatible). Each issue worked by the agent must carry a milestone — **hard stop if not**. All documentation updates for a milestone accumulate on a **single working branch of the documentation repo per milestone**; that branch merges to docs `main` (= publishes) only at release.

GitBook makes this gating mechanically sound for free: it publishes exactly one synced branch (`main`). A train branch is invisible to the live site until merged — which is also why live verification (Gate 8) is *impossible* before the train merges, and must become a scheduled post-release step rather than a skipped one.

## Decision

### 1. The published-manual contract

The live manual describes the **latest published release** of odd-platform. Content describing behaviour that exists only on `main` does not publish until the release containing that behaviour is out. This is the truth anchor every rule below serves. Corollary: documenting a *released defect* truthfully (a known-issue admonition, optionally "fixed in {next-version}") is describing released truth — it publishes immediately. The *removal* of that admonition rides the train.

### 2. Release trains — milestone == release tag == one docs branch

A **release train** is the triple: an odd-platform GitHub milestone titled with the future release tag (plain semver `MAJOR.MINOR.PATCH`), the release that will carry that tag, and **one** branch in `../documentation` named **`release/{version}`** (e.g. `release/0.28.0`). One milestone, one branch — never per-issue or per-batch doc branches for gated content. Concurrent open milestones (today: `0.28.0` and `1.0.0`) mean concurrent trains; each is based on docs `main` and syncs from `main` independently — when an earlier train merges at its release, later trains pick its content up through their normal sync. A doc change belongs to exactly one train (its issue's milestone).

### 3. The routing classifier — every doc change is `immediate` or `release-gated`

Run at triage time and re-checked at authoring time (pre-authoring stance check):

- **`immediate`** — the change describes behaviour present in the **latest published release**: every accuracy correction of live docs (priority Critical, as today), missing docs for shipped features, editorial/structural work, known-issue caveats for released bugs. → current flow, unchanged: feature branch → PR → docs `main`.
- **`release-gated`** — the change describes behaviour merged to odd-platform `main` but **absent from the latest published release**. → authored on `release/{version}`, publishes at release. Marked by a `milestone: "{version}"` frontmatter field on the work item; absence of the field means `immediate`.

Mechanical test for "absent from the latest release": identify the odd-platform commit that introduced the behaviour; `git -C ../odd-platform tag --contains {sha}` — empty output (or only tags newer than the latest published release) ⇒ release-gated. Latest published tag: `git -C ../odd-platform tag --sort=-v:refname | head -1`, cross-checked against `GET /releases/latest` when network allows. The classifier is **per claim, not per page**: a page needing both a released-truth correction and an unreleased-feature section yields two changes — the correction ships `immediate` now; the new section rides the train. Train sync (rule 5) converges the page.

### 4. The milestone hard stop (`/contribute`)

At **intake** (Phase A step 1), immediately after fetching the issue and before any further work:

- `issue.milestone == null` → **HARD STOP.** Report to the maintainer: the issue URL, "a milestone naming the target release must be attached before the contributor works this issue", and the currently-open milestones. The bot **never self-assigns milestones** — release planning is maintainer authority (and writing one would mask the planning gap the stop exists to surface).
- Milestone title not `^\d+\.\d+\.\d+$` → HARD STOP (the milestone-equals-tag contract is broken; surface it).
- Milestone `state == closed` while the issue is being worked → HARD STOP (working into a closed milestone is a release-planning error; the maintainer re-targets the issue).

Record `milestone:` in the CTRIB frontmatter. Re-verify at Phase E (the milestone on the issue is unchanged; the draft-PR body carries a `Milestone: {version}` line). The check costs one field-read on an API response `/contribute` already fetches.

### 5. Train branch mechanics (documentation repo)

- **Lazy creation.** The first release-gated doc change for a milestone creates `release/{version}` from freshly-fetched `origin/main` and pushes it (`git push -u origin release/{version}` — same-name refspec only, per LSN-034). It persists across sessions.
- **Sync-first.** Every session that authors on a train FIRST runs `git fetch origin && git merge origin/main` on the train branch and resolves conflicts (merge, never rebase — it is a shared branch). This keeps the at-release merge trivial instead of a conflict pile, and converges pages touched by both `immediate` fixes and gated sections.
- **Direct commits, no per-batch PR into the train.** Per-item atomic commits land directly on the train branch and are pushed. Rationale: content review still happens (separate-session `/review`, all gates), and the single human-merged PR `release/{version} → main` at release time is the publication gate — interposing per-batch PRs into an unpublished branch would multiply maintainer roundtrips with zero publication risk reduction. This narrows "one PR per repo per batch" for gated docs: **the PR unit is the train.**
- **Never push docs `main`** from a train session (LSN-034 guards stay: `push.default current`, same-name refspecs, and the standing recommendation to enable branch protection on documentation `main` — protection makes early publication structurally impossible and this ADR strengthens the case for it).
- **Leave `../documentation` checked out on `main` at session end.** Every consumer of the local docs tree that means "published truth" (`/ingest-docs`, doc-analyser, the editorial read, doc-gap work) asserts `git -C ../documentation branch --show-current` == `main` before reading.

### 6. Work-item lifecycle — new status `pending-release`

```
pending → in-progress → review-ready → done                      (immediate items, unchanged)
pending → in-progress → review-ready → pending-release → done    (release-gated items)
```

- `/implement` (or the docs phase of `/contribute`) flips release-gated items to `review-ready`, exactly as today.
- `/review` (separate session) runs **all** gates against the **train branch** state. Gate 8 cannot run live → it is recorded as **`PENDING-RELEASE`** with the expected post-merge URL list + verbatim phrases. If every other gate passes: flip `review-ready → pending-release`. If any fails: `blocked`, as today.
- **Nothing flips `pending-release → done` except the post-release half of the release gate** (rule 8), after live verification passes. The implementer-cannot-self-mark-done rule generalises: **nobody marks a release-gated item done before the live site shows it.**
- Work-item frontmatter gains one optional field: `milestone: "0.28.0"`. The train's manifest is **derived** — `grep -l 'milestone: "0.28.0"' backlog/**/*.md` + the train branch's commit trail — there is deliberately **no** `state/release-trains.yaml` (rejected: every fact it would hold is derivable from the backlog, the branch list, and the GitHub API; a mirror file is a drift liability per the no-index-mirrors rule).

### 7. One tracker for gated docs — including `/contribute`'s

Every release-gated doc change is tracked by a backlog DOC item carrying `milestone:` — **including the docs deliverable of a `/contribute` run** (the CTRIB record additionally notes `docs_routing: release/{version} | main | none`). Rationale: the CTRIB lifecycle ends at `merged` (code), but the doc deliverable outlives it until release; a single tracker (the backlog) lets the release gate assemble the train manifest with one grep instead of walking two artifact types. The DOC item is lightweight — title, milestone, affected pages, expected URLs/phrases for the deferred Gate 8 — created in the `/contribute` docs phase.

### 8. The release gate — `playbooks/release-train-merge.md` (new, two halves)

**Triggers:** the maintainer announces a release, or `/status` / `/orient` detect that `GET /releases/latest` returned a version with an un-merged train (or a closed milestone with a live train branch).

**Half 1 — pre-merge readiness + train PR (hosted by `/implement release:{version}`):**
1. Preconditions, each HARD: milestone `{version}` exists and is **closed**; release `{version}` is **published** and `tag_name == milestone title`; train branch `release/{version}` exists on origin.
2. Final sync: merge `origin/main` into the train; resolve; re-run the mechanical sweeps (Gate 11 banned-term grep, description-length ≤200, PyYAML frontmatter parse) over the **full train diff vs main**.
3. Manifest completeness: derive the train manifest (backlog grep + branch log). Every item must be `pending-release` (i.e. reviewed); any still `review-ready` → run `/review` first; any `in-progress` → the train is not ready, surface. Cross-check the **milestone's closed issues** (API): each is matched by docs on the train, a recorded "no doc change + why" (CTRIB record), or gets flagged in the gate report for the maintainer — this catches maintainer-authored code that bypassed the agent flows, and makes the milestone a genuine code+docs bundle.
4. Push the synced train; output the PR URL `release/{version} → main` with a body enumerating items + issues by ID. **The human merges** (the existing publication gate; one merge per release).

**Half 2 — post-merge publication verification (hosted by `/review release:{version}`):**
1. Run `playbooks/live-site-verification.md` for every URL recorded in every manifest item (one pass, batch semantics as today).
2. Flip each verified item `pending-release → done`; failures → `blocked` per the playbook's on-fail.
3. Refresh the doc ground-truth layer: `/ingest-docs` against the new docs `main` + graph rebuild (the existing post-merge practice, now anchored to the release event).
4. Append the release record (version, date, item list, verification verdicts) to `state/PROGRESS.md`; the train is complete when zero `pending-release` items remain for the milestone; delete the merged train branch.

### 9. Gate 8 semantics, amended

Gate 8's verdict vocabulary gains **`PENDING-RELEASE ({version} — URLs recorded for the release gate)`** alongside PASS / DEFERRED / FAIL. The standing rule "Never defer live-site checks" is refined to **"never skip"**: for `immediate` items nothing changes; for release-gated items the check is *scheduled* at the release gate, tracked by the `pending-release` status, and the item structurally cannot reach `done` without it. The existing `DEFERRED (PR not yet merged)` semantics remain for `immediate` items awaiting their batch PR merge.

### 10. Version stamping — release-gated content carries its version

Authoring rule (documentation pillar): a release-gated page or section names its release at first mention — "Available since {version}" (hint admonition for a new page/feature; inline for a changed default or new parameter). This keeps the manual honest for operators on older releases after the train merges, and makes the gating self-documenting. `immediate` corrections do not version-stamp (they describe what every supported release does) unless documenting a fix boundary ("fixed in {version}") — which is itself released-truth the moment that release ships.

### 11. Ontology timing — code truth immediate, doc truth at release

- The **code-derived layers** (sidecars, feature-flows, concepts, test-map) track odd-platform `main` and update immediately — unchanged. The ontology is internal coordination state, not the published manual.
- A sidecar/feature-flow doc-link that points at a page (or section) existing only on a train carries `pending_release: "{version}"` in its `docs_link_semantic` entry; live-URL WebFetch is skipped for those entries until release.
- The **doc ground-truth layer** (`/ingest-docs`, Doc nodes, DESCRIBES edges) ingests published docs `main` only (rule 5's branch assertion). It refreshes at the release gate (half 2).
- **doc-gap-finder** checks, before emitting a missing-page / drift finding, whether a `pending-release` backlog item or train commit already covers it → classify as `pending-release ({version})`, informational, not a gap. Without this, every train would re-surface as a wave of false DOC-GAP candidates at the next reducer run.

### 12. Scope

Trains are keyed to **odd-platform** milestones (where releases, `/contribute`, and the verified milestone discipline live). Collector or specification releases, if ever gated, reuse the pattern with branch names `release/{repo}-{version}`; not built now. Tests, ontology code-layers, and odd-team bookkeeping are never release-gated.

## The per-file change map

The complete set of instruction edits. Order = implementation order (foundations → pillars → skills → agents → pointers).

**Foundation**

1. **`playbooks/release-train-merge.md`** — NEW. PROTOCOL format: trigger (release announced / detected) / inputs (version; derived manifest) / procedure (Decision 8's two halves, with the exact API calls — `GET /repos/opendatadiscovery/odd-platform/milestones?state=all`, `GET .../releases/latest` — and the manifest grep) / exit (all items `done`, doc-graph refreshed, branch deleted) / on-fail (per-precondition: milestone open → maintainer closes/re-targets; tag≠title → surface, never merge; live verification fail → item `blocked` per live-site-verification on-fail) / case-law (LSN-034; CTRIB-003).
2. **`backlog/README.md`** — frontmatter spec: add optional `milestone: "{version}"` (its presence == release-gated). Lifecycle diagram + transitions table: add `review-ready → pending-release` (`/review`, all gates pass with Gate 8 PENDING-RELEASE), `pending-release → done` (`/review release:{version}` half 2 only, after live verification), `pending-release → blocked` (release-gate live verification fails). Rules: add "release-gated items are authored on `release/{version}` in the documentation repo; the classifier (ADR-release-train-doc-gating Decision 3) runs at triage".
3. **`playbooks/live-site-verification.md`** — trigger section: second trigger "the release train `release/{version}` merged to docs main (release-gate half 2); inputs = the union of URL lists recorded in the milestone's `pending-release` items". Case-law: add LSN-034.

**Pillars**

4. **`pillars/contributor/gates.md`** — NEW **G-C11 — Milestone gate: every issue rides a release train**. Rule: intake hard-stops without an open, semver-titled milestone (Decision 4's three checks); the bot never self-assigns; docs deliverables route per the classifier; the CTRIB records `milestone:` + `docs_routing:`. Enforced at: SKILL Phase A step 1 + Phase E step 14; the release gate's manifest cross-check. Case-law: LSN-034; this ADR. Also: G-C10 wording — "updates the affected docs page" → "updates the affected docs page, **routed per the release-train classifier** (released-truth → main; unreleased behaviour → `release/{version}`)". Acceptance criteria: extend #6 (docs decision includes routing) and append #12 (no work on a milestone-less issue).
5. **`pillars/contributor/canonical-homes.md`** — Docs row: home becomes "the `documentation` repo — `main` via PR for released-truth changes; **`release/{version}` train branch** for unreleased behaviour (publishes at release)". CTRIB frontmatter list: add `milestone`, `docs_routing`. Lifecycle note under the diagram: `docs-done` means authored + routed; for train-routed docs, **publication trails at the release gate**, tracked by the paired backlog DOC item (`pending-release`), not by the CTRIB record (which still closes at `merged`).
6. **`pillars/contributor/pillar.md`** — one sentence in the flow description: docs move with the code *to the train*; they publish with the release.
7. **`pillars/documentation/gates.md`** — Gate 8: add the PENDING-RELEASE paragraph (Decision 9) + pointer to `playbooks/release-train-merge.md`. Gate 6 (bidirectional coverage): "documented" for an unreleased code path = present on the open train (cite the train commit), until the release gate makes it live.
8. **`pillars/documentation/authoring.md`** — new subsection "Release-gated authoring": the sync-first rule, direct-commit-to-train, never-push-docs-main (LSN-034), leave-checkout-on-main, and the "Available since {version}" stamping rule (Decision 10) with the admonition pattern.
9. **`pillars/adr/pillar.md`** — one line: a published ADR-log page describing a decision whose behaviour is not yet in a published release rides the train like any release-gated doc.

**Skills**

10. **`.claude/skills/contribute/SKILL.md`** — Phase A step 1 (Intake): insert the milestone hard stop (Decision 4) as the first action after the issue GET; record `milestone:` in the CTRIB frontmatter. Phase C step 7 (Plan): the docs decision names the routing (`main` / `release/{version}` / none + why). Phase D step 12 (Docs): author release-gated changes on the train per Decision 5 (sync-first; direct commit; same-name push); create the paired backlog DOC item (Decision 7); released-truth corrections discovered en route ship via the normal immediate flow on a separate branch — never mixed onto the train commit. Definition-of-Done block: "docs read + decided" → "docs read + decided + **routed** (train or main per the classifier)". Phase E step 14 (PR body): add `Milestone: {version}` and `Docs: documentation@release/{version} (publishes with the {version} release)` or "no doc change". Step 16 (report): state explicitly that the docs publish at release, not at code merge.
11. **`.claude/skills/implement/SKILL.md`** — Phase 1 step 2 (freshen): for release-gated items, the working branch is the train — fetch, create `release/{version}` from `origin/main` if absent, else merge `origin/main` into it; leave the checkout on `main` at session end. Phase 1 step 3 (batch assembly): routing class is a batch-compatibility dimension — never mix release-gated and immediate doc items on one branch; for a gated batch, **the train branch IS the batch branch**. Phase 2: the version-stamp authoring rule applies to gated content. Phase 3 (close): gated batches push the train and open **no PR** (the release gate owns the only publication PR); the handoff lists expected post-merge URLs + verbatim phrases per item for the deferred Gate 8. New `release:{version}` argument form = release-gate half 1 (run `playbooks/release-train-merge.md` steps 1-4). Pause-and-ask: an item classified release-gated with **no** open matching milestone → `blocked`, surface (the maintainer creates/retargets milestones).
12. **`.claude/skills/review/SKILL.md`** — Load step: detect `milestone:` on the item → review against the train branch state (fetch it; the diff under review is the item's commits on `release/{version}`). Gate 8 row + verdict block: add PENDING-RELEASE status (Decision 9); verdict rule: all-pass-except-Gate-8-pending → flip `review-ready → pending-release` (NOT `done` — extend the "cannot self-mark done" hard rule: a release-gated item can never reach `done` before its release). New `release:{version}` argument form = release-gate half 2 (live-verify the milestone's full manifest; flip `pending-release → done`; trigger `/ingest-docs` refresh; PROGRESS release record; delete the train branch).
13. **`.claude/skills/triage/SKILL.md`** — step 3, after the work-vs-handoff split: run the routing classifier (Decision 3) for every DOC item documenting a behaviour change; set `milestone:` from the introducing issue/PR's milestone (or the mechanical tag-containment test for scan-derived findings); no resolvable milestone → create the item as `blocked` with the unresolved-milestone note. Priority note: a release-gated item's urgency is "before the release gate", not "before the next session".
14. **`.claude/skills/status/SKILL.md`** + **`.claude/skills/orient/SKILL.md`** — add a "Release trains" block: derive open trains (backlog grep for `milestone:` by status + `git -C ../documentation branch -r --list 'origin/release/*'`); when network allows, `GET /releases/latest` + open milestones; if a published release has an un-merged train (or a closed milestone has `pending-release` items) → recommended-next-action = run the release gate.
15. **`.claude/skills/ingest-docs/SKILL.md`** — precondition line: assert `../documentation` is checked out on `main` (and synced to `origin/main`) before ingest; refuse otherwise.

**Agents**

16. **`.claude/agents/file-analyser.md`** — `docs_link_semantic` contract: entries may carry `pending_release: "{version}"` when the documenting page/section exists only on `release/{version}`; cite the train path + commit instead of a live URL; skip live WebFetch for those entries; confidence noted accordingly.
17. **`.claude/agents/doc-gap-finder.md`** — procedure: before emitting a missing-page or drift finding, grep the backlog for a covering `pending-release` item / check `origin/release/*` branches; covered → emit as classification `pending-release ({version})`, informational, excluded from DOC-NNN candidate ranking. (Extends the existing dedup step; same place the graph-search dedup runs.)
18. **`.claude/agents/doc-analyser.md`** — precondition: local docs tree must be on `main`; drift findings check train state first — "code does X, live page says Y" is not drift if the correction/section is on an open train (cite the train commit; classify pending-release).

**Pointers + process docs**

19. **`CLAUDE.md`** — minimal, ~8 lines total: (a) Implement phase: one bullet — doc changes route per the release-train classifier; unreleased behaviour rides `release/{version}` (→ ADR). (b) "Review Gates / Gate 8" block: never *skip*; release-gated items defer to the release gate via `pending-release` (→ playbook). (c) Key Principles: one line — "Docs describing unreleased functionality publish at release via the milestone train; live docs describe the latest published release."
20. **`issues/README.md`** — odd-platform drafts: note that the maintainer attaches the target milestone at filing (the contributor hard-stops without one); optional `suggested_milestone:` line in the draft body.
21. **`playbooks/github-write.md`** — procedure: add the two read endpoints the gates use (`GET .../milestones`, `GET .../releases/latest`) — public reads, no scope change to the App.

**Explicitly unchanged:** the `immediate` doc flow (the bulk of the DOC backlog); test routing (both buckets ship with code, never gated); ontology code-layer timing; the 10 Quality-Bar gates' per-item authority; the editorial audit; `/review` separate-session rule; the human as the only merger.

## Edge cases and failure shapes

- **Release published, milestone still open** → half-1 hard stop; the maintainer closes the milestone (re-targeting unfinished issues to the next one — GitHub's standard close flow) before the train merges.
- **Tag ≠ milestone title** (retitle, hotfix renumber) → half-1 hard stop; never merge a train whose version doesn't match the published tag. Renaming a milestone = rename the train branch + update item `milestone:` fields (one sed pass; the gate verifies convergence).
- **Feature reverted on main pre-release** → revert the corresponding train commits; the paired item returns to `pending`/`rejected` per normal backlog rules.
- **Hotfix release (e.g. `0.27.14`)** carrying only fixes → no train needed (docs corrections for it are released-truth the moment it ships); a hotfix shipping new behaviour gets its own small milestone + train.
- **Two trains touching the same page** → each syncs from `main`; after the earlier train's release the later train absorbs it via sync. Mid-flight, the branches don't see each other — acceptable: same-page-different-section is merged at sync; same-line collisions surface as ordinary merge conflicts at the later train's next sync.
- **The inverse gap** (live docs correctly describe a released bug; main carries the fix): the known-issue admonition is `immediate`; its removal + the "fixed" wording ride the train. This is exactly the LSN-034 page, handled correctly under this ADR.
- **Maintainer-authored code merged without the agent** → caught by half-1's milestone-issue cross-check ("issue #N closed in {version}; no docs on the train; no no-doc-needed record") — the gate reports it; the maintainer confirms or a catch-up doc item is authored onto the train before merge.
- **A train left stale** (milestone slips for months) → the sync-first rule bounds the merge debt to one session's conflicts; `/status` surfaces train age.

## Consequences

**Gained:** the live manual never claims unreleased behaviour (the trust property); the milestone becomes a verified code+docs bundle (half-1 completeness check); release notes material falls out of the train PR body for free; Gate 8 keeps its no-skip guarantee with a structurally-enforced schedule; one human merge per release for all its docs.

**Costs, accepted:** docs for merged-but-unreleased work are invisible to operators until release (correct — no operator can use that behaviour yet); train-sync discipline is a new per-session step for gated authoring; the release gate adds one focused session per release (~the cadence of `0.27.x`, a few per quarter); `/contribute` gains one more stop condition (cheap; surfaces real planning gaps).

**Alternatives rejected:** (a) *Status quo + "since {version}" notes only* — still publishes instructions an operator on the current release cannot follow; a version note does not stop the Google-lands-on-the-page failure. (b) *Versioned documentation* (per-release doc variants) — GitBook variant support on the OSS plan is limited, and N maintained doc versions is the one cost a single spare-time maintainer cannot pay; the train + "Available since" stamp gives 90% of the value at ~zero steady-state cost. (c) *Docs in the odd-platform repo, released together* — forfeits the entire documentation-pillar toolchain, GitBook publishing, and the doc/code separation the workspace is built on. (d) *A `state/release-trains.yaml` tracker* — pure mirror of derivable facts; rejected per the no-index-mirrors rule.

## Rollout

1. Maintainer approves this ADR (GATE: it changes two skills' stop conditions and the backlog lifecycle).
2. `/implement` the map in order: foundation (items 1-3) → pillars (4-9) → skills (10-15) → agents (16-18) → pointers (19-21). One batch, one odd-team PR; no documentation-repo changes are needed to adopt (the first train branch is created lazily by the first gated item).
3. Pilot on milestone **`0.28.0`** (open, due 2026-06-22): the next `/contribute` or class-A doc item targeting 0.28.0 creates `release/0.28.0`; when the maintainer publishes release 0.28.0, run the first release gate end-to-end. Note the known pre-ADR leak: the #1748 fixed-note is already live (LSN-034) — not retro-fixable by the train; everything after this ADR rides it.
4. Standing recommendation re-raised (from LSN-034): enable branch protection (require a PR) on `opendatadiscovery/documentation` `main` — with trains, *every* legitimate publication path is a PR, so protection now costs zero workflow friction and makes early publication structurally impossible.

## Status / next

Draft, 2026-06-11, authored from the maintainer's process decision of the same date. Next: maintainer approval → implement the change map (one batch) → pilot on 0.28.0.
