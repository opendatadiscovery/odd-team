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

**A DOC item is not `done` until the live URL has been WebFetched and verified.** That verification is part of `/review` in a separate session — the implementer does not self-close. If verification fails, the item reopens as `blocked` with the live-site evidence.

**Before authoring, fetch + checkout `origin/main` of the documentation repo.** GitBook commits directly to main as `[GITBOOK-NN]` commits; any local branch lags. Skipping this step caused the 2026-04-22 stale-branch re-verification sweep (`retrospectives/LSN-008-stale-branch-false-positives.md`). Same rule as the scan protocol in `scanners/README.md`.

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