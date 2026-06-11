---
pillar: documentation
file: authoring
status: active
since: 2026-04-22
---

# Documentation authoring rules

These rules apply whenever an item's `target_repo` is `documentation` (GitBook-backed). They cover the GitBook-specific behaviours that universal Quality Bar gates do not catch — link semantics, multi-PR caching, in-page TOC sync, branch staleness — and the `Sources:` footer format every implementation commit carries.

## GitBook authoring

**Never hand-author GitBook `"mention"` links.** The `[text](target.md "mention")` shortcut is editor-native — GitBook writes an internal file-reference ID when authored in its web editor. Hand-written in git, it resolves unreliably and can silently fall back to a raw `github.com/.../blob/main/...` URL that then gets cached. Use plain markdown links: `[Title](relative/path.md)`.

**Ship the page, the SUMMARY.md entry, and all index/README.md links together in one PR.** Splitting them across PRs has caused fallback caching on the live site (canonical case: `retrospectives/LSN-004-s2s-fallback-cache.md` — separate SUMMARY PR left the index link stuck as a GitHub URL).

**In-page TOCs stay synchronized with H2s in the same commit.** Some pages (canonical example: `docs/Features.md` lines 3-29) carry an in-page Table of Contents — a list of links at the top of the page pointing to each H2 section's anchor. When a commit adds, renames, or removes an H2 on such a page, the TOC must add / rename / remove the corresponding row in the **same commit**. A new H2 without a TOC row is discoverable only by scrolling and breaks the convention every other section on the page follows. Reviewer checks this under Gate 7 (`pillars/documentation/gates.md`). Detection: read the top ~30 lines of the page being touched; if you see a sequence of `[Title](path.md#anchor)` lines, that is the TOC. Canonical failure: `retrospectives/LSN-005-features-toc-desync.md` (DOC-069 / DOC-076).

**A DOC item is not `done` until the live URL has been WebFetched and verified.** That verification is part of `/review` in a separate session — the implementer does not self-close. If verification fails, the item reopens as `blocked` with the live-site evidence. For release-gated items the verification is scheduled, not skipped: the item passes through `pending-release` and the live check runs at the release gate (see Release-gated authoring below).

**Before authoring, fetch + checkout `origin/main` of the documentation repo.** GitBook commits directly to main as `[GITBOOK-NN]` commits; any local branch lags. Skipping this step caused the 2026-04-22 stale-branch re-verification sweep (`retrospectives/LSN-008-stale-branch-false-positives.md`). Same rule as the scan protocol in `scanners/README.md`. (For release-gated items the working branch is the train `release/{version}` — the freshness rule becomes sync-first; see below.)

## Release-gated authoring — unreleased behaviour rides the train *(2026-06-11)*

The live manual describes the **latest published release** of odd-platform. A change describing behaviour merged to odd-platform `main` but absent from the latest published release is **release-gated** (`milestone:` set on the item — classifier: `adrs/drafts/release-train-doc-gating.md` Decision 3) and is authored on the documentation branch **`release/{version}`** (one branch per milestone), publishing only when the matching release ships (`playbooks/release-train-merge.md`).

- **Sync-first.** Before authoring on a train: `git fetch origin && git merge origin/main` on `release/{version}`; resolve conflicts (merge, never rebase — it is a shared branch). Create the train lazily from freshly-fetched `origin/main` on its first item (`git push -u origin release/{version}`).
- **Per-item commits land directly on the train** — no per-batch PR into an unpublished branch. The single human-merged PR `release/{version} → main` at the release gate is the publication gate.
- **Never push docs `main` from a train session.** Same-name refspecs only; `push.default current` stays set. Canonical failure: `retrospectives/LSN-034-docs-work-branch-bare-push-published-main-early.md`.
- **Leave the checkout on `main` at session end.** Every consumer of the local docs tree that means "published truth" (`/ingest-docs`, the doc-product editorial read, doc-gap work) asserts `git -C ../documentation branch --show-current` == `main` before reading.
- **Version-stamp release-gated content.** A new page or feature section carries `{% hint style="info" %}Available since {version}.{% endhint %}` at first mention; a changed default or new parameter gets an inline "since {version}". Immediate corrections do not stamp (they describe what every supported release does); a "fixed in {version}" note on a known-issue admonition is released-truth the moment that release ships — and its removal rides the train.
- **A page needing both** a released-truth correction and an unreleased-behaviour section yields two changes: the correction ships immediately via the normal flow; the new section rides the train. The sync-first rule converges the page.

## The `Sources:` footer

Every implementation commit on the documentation repo includes a `Sources:` footer citing the canonical source of truth for each factual claim class the change touches. The footer's claim-class lines drive Gate 9 (`pillars/documentation/gates.md` Factual claim provenance). Commits without this footer fail review by default. Prose-polish items with no factual claim write `Sources: none (prose polish, no factual claim)` explicitly — silence is not acceptable.

Example commit body:

```
docs: document attachment storage config [DOC-008]

Sources:
- Config: odd-platform-api/src/main/resources/application.yml:215-224
- Config-consumer: odd-platform-api/.../service/attachment/remote/RemoteFileUploadServiceImpl.java:1-120
- Builder: odd-platform-api/.../config/MinioConfig.java:1-35 (MinioAsyncClient; .region unset → caveat shipped)
- Repo: https://github.com/minio/minio-java → README §Quickstart (us-east-1 default confirmed)
```

Legacy `Consumer-read:` footers on older commits remain valid; new commits use the richer `Sources:` form. The full SoT table for each claim class lives in `pillars/documentation/gates.md` Gate 9.

## Audience isolation — published docs are operator-facing, not workspace-internal *(2026-05-27)*

**Every sentence you write into `../documentation/docs/**/*.md` is read by an ODD operator on `docs.opendatadiscovery.org` who has never opened this workspace.** They have not read `pillars/`, `playbooks/`, `retrospectives/`, `adrs/`, or any methodology artefact. They do not know what "Cornerstone 5", "Gate 7", "LSN-023", "shoebox", or "feature-flow-builder" means — and they shouldn't have to.

The full rule + banned-term registry + exception list + mechanical check command lives at **`pillars/documentation/gates.md` Gate 11 (Audience isolation)**. Before committing any change to a published doc page:

1. Run the Gate 11 grep command on your staged diff:
   ```bash
   git diff --staged --name-only -- '../documentation/docs/**/*.md' | xargs -r grep -nE 'Cornerstone [0-9]+|Gate [0-9]+|\bLSN-[0-9]+\b|\bSHB-[0-9]+\b|\bREFACTOR-[0-9]+\b|feature-flow-builder|feature-reflector|doc-gap-finder|concept-merger|odd-sme|Stress Protocol|Quality Bar|Pre-authoring stance'
   ```
2. For each hit, **rewrite in operator language** (name the underlying user-observable concept directly), **delete** (often the right call — internal references frequently signal the maintainer talking to themselves through the doc), or **move** to an internal artefact.
3. Re-grep until zero hits.

Workspace-internal docs (this file, `gates.md`, `cornerstones.md`, any `pillars/`, `playbooks/`, `retrospectives/`, `adrs/`, `state/`, `backlog/`, `issues/`, `lineage/`, `scanners/` file, plus `APPROACH.md` + `CLAUDE.md`) are **exempt** — they speak the methodology's own vocabulary freely. Only the published doc tree is subject to Gate 11.

Case-law: `retrospectives/LSN-026-workspace-vocabulary-leaked-to-published-doc.md` — the 2026-05-27 incident where "Cornerstone 5 holds" shipped to `docs.opendatadiscovery.org/features/data-discovery/tagging` despite the editorial-read stance being in place. The fix: mechanical complement to the stance.