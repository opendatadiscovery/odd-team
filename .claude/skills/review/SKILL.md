---
name: review
description: Verify a `review-ready` work item (or an entire batch) meets every acceptance criterion and every Quality Bar responsibility. Reject by default — each check requires cited evidence. Must run in a session distinct from the `/implement` session that produced the item.
argument-hint: <work-item-id> | batch:<branch-name>
allowed-tools: Read Grep Glob WebFetch Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
---

# Review Work Item / Batch

You are reviewing `$ARGUMENTS`. The item (or batch) is in `status: review-ready`. Your job is to flip it to `done` **only** if every gate below passes with cited evidence. The default verdict is **rejection**. "Looks fine" is not a verdict.

This SKILL exists because `/implement` is not allowed to self-close items. On 2026-04-23 a silent AWS S3 region caveat (`MinioConfig.java` never calling `.region(...)`) shipped under the old bar — every one of the 17 items closed before that date was self-closed by the same session that implemented it. A separate-session review with a checklist would have caught it. This is that checklist.

## Hard prerequisites

Refuse to run if any of these are true:

- `$ARGUMENTS` is empty → list every `review-ready` item and ask which to review.
- The work item status is not `review-ready` → print the status and stop. Only `review-ready` items are reviewable.
- **You are the same session that implemented the item.** Check the conversation context. If you just ran `/implement` and now `/review` was called without an intervening session boundary, stop and surface that — self-review defeats the gate. The user (or operator of a CI wrapper) must start a fresh session.
- The work item's commit is missing a `Sources:` footer (or the legacy `Consumer-read:` footer) AND the item's claims are factual (code-backed, URL-backed, spec-backed, or terminology-backed) → reject immediately with "missing Sources footer" and set status to `blocked`. Only pure prose-polish items with `Sources: none (prose polish, no factual claim)` are exempt.

## Protocol

### 1. Orient

Read, in order:
- `CLAUDE.md` — team identity, Quality Bar (nine responsibilities), lifecycle, Gate 9 SoT table.
- `backlog/README.md` — status transitions, rules.
- The work item file — status, acceptance criteria, Context, Implementation Record.
- The commit(s) that implemented it — `git log --format=full <branch>` in the target repo. Extract the `Sources:` footer (or legacy `Consumer-read:`); you will verify every source listed against the SoT table.

### 2. Verify acceptance criteria — one-by-one, cite evidence

For each `- [ ]` / `- [x]` criterion:
- Read the file(s) the criterion references.
- Write a one-line verdict: `PASS: {evidence file:line or URL}` or `FAIL: {what's missing}`.
- A criterion is not "superficially met". "Section exists" fails if the section is a placeholder. "Warning present" fails if the warning is buried in prose instead of an admonition block.

### 3. Verify Quality Bar responsibilities — each is a gate

Each of the nine responsibilities in `CLAUDE.md` is a gate. Record evidence per gate. Every verdict entry (PASS/FAIL/N/A) must end with `via {fetch/grep/read citation}` — no standalone adjectives.

#### Gate 1 — No duplicates

- Grep the doc tree for each canonical term the item touches (consult `main-concepts.md` Terms & Aliases).
- Verify the Implementation Record's duplication-sweep classifications are honest: every hit was either linked, expanded-in-place, consolidated, or aliased.
- **FAIL** if a parallel copy of the same content exists under a different name with no cross-link.

#### Gate 2 — Synonyms and aliases are logged

- If the item introduced or used an alias (e.g., M2M ↔ S2S, Alternative Secrets Backend ↔ Collector Secrets Backend), check `docs/main-concepts.md` Terms & Aliases for a row in the same PR.
- **FAIL** if an alias is used in the authored content but not in the table.

#### Gate 3 — Caveats captured

- For each integration touched, list what the implementation record (or Phase 2 audit) claims are the caveats.
- Read the authored doc: is every caveat present as an admonition block (hint, warning, danger) or dedicated section, not buried in prose?
- **FAIL** if a known limitation from the consumer-read audit is missing from the doc.

#### Gate 4 — Consumer-read evidence (runtime-behavior slice of Gate 9)

For every file listed in the commit's `Sources:` footer under `Config:`, `Config-consumer:`, `Builder:`, or `Handler:` lines (or any file in a legacy `Consumer-read:` footer):
- Read the file at the cited lines.
- Verify the doc's claims match what the consumer code actually does.
- If the consumer feeds an SDK builder, verify Gate 5 against it.

For every config key / env var mentioned in the doc change:
- Grep the target repo for `@Value.*{key}` (or the Python/pydantic equivalent).
- If there is a consumer not in the footer, and the consumer affects behavior the doc describes, the footer is incomplete → **FAIL** with "Sources footer missing consumer: {file}".

#### Gate 5 — Unset-parameter audit

For every SDK / client builder in the consumer-read path:
- Look up the SDK's official builder parameters.
- For each parameter, classify: `configured | safely-defaulted | caveat-defaulted`.
- For every `caveat-defaulted` parameter, verify it's documented in the change as a known limitation.
- **FAIL** if an SDK builder has an unset parameter with an unsafe default that the doc does not mention. This is the DOC-008 gate.

Example (what a passing verdict looks like for MinIO):
```
Gate 5 — MinioAsyncClient.builder() (MinioConfig.java:22)
  .endpoint(url)         — configured from attachment.remote.url         ✓
  .credentials(...)      — configured from attachment.remote.{access,secret}-key ✓
  .region(...)           — caveat-defaulted (us-east-1 only); doc hints at Features.md:XX  ✓
  .httpClient(...)       — safely-defaulted (OkHttp default timeout acceptable for LAN)    ✓
PASS
```

A failing verdict looks like:
```
Gate 5 — MinioAsyncClient.builder() (MinioConfig.java:22)
  .region(...)           — caveat-defaulted (us-east-1 only); doc makes NO mention  ✗
FAIL — reopen as blocked with "document region caveat"
```

#### Gate 6 — Bidirectional code ↔ doc coverage

- Every functional claim in the authored doc → evidence file:line in the commit or verifiable now.
- Every user-visible code path touched (controller methods, API endpoints, UI components, SDK calls) → doc coverage as feature / limitation / performance / security.
- **FAIL** if either direction has gaps the Implementation Record did not log as follow-up work.
- **"Logged as follow-up"** can mean either path, both on disk:
  - A new `backlog/{cat}/DOC-NNN.md` item — when the missing coverage is doc-side and we will write it ourselves.
  - A new `issues/{repo}/{PREFIX}-NNN.md` upstream issue draft — when the missing coverage reflects an upstream code defect or feature gap that needs filing into the target repo's GitHub tracker. Use `/log-issue` to scaffold; see `issues/README.md`.
  - Narration in the work item ("tracked as a follow-up candidate") **does not satisfy this gate**. The 2026-04-23 DOC-001 review surfaced the Azure `logout-uri` gap and would have reopened DOC-001 as `blocked` had the verdict only narrated; the file `backlog/docs/DOC-061.md` is what made it pass.

#### Gate 7 — Layout and completeness

- If a page was added / renamed / removed: `SUMMARY.md` entry present? Every `README.md` / index link updated?
- Orphan pages? Broken section headings? Heading levels match TOC depth?
- **In-page TOC sync.** For every page the change touches, read the top ~30 lines. If the page carries an in-page TOC (a sequence of `[Title](path.md#anchor)\` links — canonical example: `docs/Features.md` lines 3-29), enumerate the H2s the change added / renamed / removed and verify each has a matching TOC row added / renamed / removed in the same commit. **FAIL** if a new H2 was added to such a page without a TOC row, or an H2 was renamed without the TOC row updated, or an H2 was removed without the TOC row removed. (DOC-069 shipped a new H2 on `Features.md` without the TOC row; reviewer missed it on first pass; user caught it post-merge — DOC-076 logged.)
- **FAIL** on any inconsistency not explicitly covered by another in-scope item.

#### Gate 8 — Publishing standards (live-site verification)

MANDATORY for every `target_repo: documentation` item. Wait for the GitBook build (typically ≤5 min after merge; if the PR is not yet merged, this gate is deferred until after merge, and the item stays in `review-ready`).

For each affected page (per the Implementation Record's live-URL list):
- Compute the live URL: `docs/a/b/c.md` → `https://docs.opendatadiscovery.org/a/b/c`; `README.md` collapses to the directory URL.
- `WebFetch` the URL.
- Verify:
  - Page loads with the intended change visible (quote the authored text back).
  - No `github.com/opendatadiscovery/documentation/blob/` substrings appear anywhere in the rendered HTML (GitBook fallback signature).
  - Every relative link touched resolves to `docs.opendatadiscovery.org`, not to `github.com`.
  - Sidebar entry present for any newly-added page.
- **FAIL** on any of the above. Quote the failing evidence (URL + observed substring).

#### Gate 9 — Factual claim provenance (the generalization)

Gate 9 is the umbrella that Gates 4 & 5 sit inside. For every claim class in the `Sources:` footer, verify the cited source actually supports the claim. Then sweep for claim classes that should have been cited and weren't.

**Per-class verification:**

- **`Repo:` lines** — For every `github.com/opendatadiscovery/*` URL in the doc change (whether or not it's in the footer): `WebFetch` the target README, grep for the link text / feature name. If the README does not describe the claimed feature, FAIL with `Repo mismatch: {url} does not describe {claimed feature}`. This is the DOC-027 dbt gate — "defensible because it's the monorepo owner" is not acceptable; read the README.
- **`Integration:` lines** — Cross-check against `docs/integrations/README.md` (canonical integrations hub — DOC-042, once shipped). Before DOC-042 lands, cross-check against `navigation/architecture.md` + `github-organization-overview.md`. FAIL if a push-client is labelled as a collector or vice versa.
- **`Config:` / `Config-consumer:` lines** — verified under Gate 4.
- **`Builder:` lines** — verified under Gate 5.
- **`Spec:` lines** — grep the OpenAPI YAML at the cited path; verify the claim matches the schema / path / operation. FAIL on drift.
- **`Term:` lines** — open `docs/main-concepts.md` Terms & Aliases; verify the cited row exists and matches the alias being used. FAIL if an alias is used in prose without a table row.
- **`Lifecycle:` lines** — verify ADR / CHANGELOG / release tag matches the lifecycle claim in the doc.
- **`Dep:` / `Handler:` / `Cross-repo:` lines** — read the cited file:line; verify the claim.

**Banned rationalizations** (standalone justifications that FAIL review):

- "defensible"
- "probably correct" / "probably"
- "looks right" / "looks correct"
- "canonical owner" (as in "the monorepo is the canonical owner, so the link is fine" — this was the DOC-027 rationalization)
- "monorepo default"
- "safe to assume"
- "presumably"
- "should be"

Every review note — including "Notes" entries at the end of the verdict — must end in one of:
- `VERIFIED via {WebFetch URL / grep command / file:line read}`
- `NOT VERIFIED → logging as DOC-NNN` (or `issues/{repo}/{PREFIX}-NNN.md` for upstream)

If the reviewer catches themselves typing a banned phrase, treat it as a signal to stop and fetch — then rewrite the note with cited evidence.

**Outbound URL sweep** (MANDATORY for every `target_repo: documentation` item):

- `grep -E 'https?://[^)]+' {changed files}` to enumerate every outbound URL touched by the change.
- For each `github.com/opendatadiscovery/*` URL: `WebFetch` target, grep README for link text / feature name. FAIL on mismatch.
- For each external URL: `WebFetch`; verify 200 response. Log broken URLs as follow-up backlog items.

This step closes the DOC-027 dbt-link class. It costs ~30 seconds per URL and runs once per review.

### 4. Check for regressions

- Run the relevant test suite for the target repo (if any).
- For doc changes: click-check (programmatically) every link on the affected pages via WebFetch.
- For code comments: verify against surrounding code.
- For test additions: verify they test what they claim.

### 5. Check navigation consistency

- Are file paths in `navigation/domains/*.md` still correct after the change?
- Did the consumer-read audit discover new bean factories / SDK builders? Are they in navigation?
- If the Implementation Record claims navigation was updated, verify.

### 6. Verdict — append to the work item

```markdown
## Review (YYYY-MM-DD, session: <short-hash-or-label>)
- **Result**: ACCEPTED | REJECTED
- **Acceptance criteria**:
  - [x] Criterion 1 — PASS ({evidence})
  - [ ] Criterion 2 — FAIL ({reason})
- **Quality Bar**:
  - Gate 1 (duplicates) — PASS ({evidence})
  - Gate 2 (aliases) — PASS ({evidence}) | N/A
  - Gate 3 (caveats) — PASS ({evidence})
  - Gate 4 (consumer-read) — PASS (footer verified: {files}) | FAIL ({missing})
  - Gate 5 (unset-parameter) — PASS ({SDK builder audit}) | N/A (no SDK in scope) | FAIL ({unset caveat})
  - Gate 6 (bidirectional coverage) — PASS ({evidence})
  - Gate 7 (layout) — PASS ({evidence})
  - Gate 8 (live-site) — PASS ({URL + observed text}) | DEFERRED (not yet merged)
  - Gate 9 (factual provenance) — PASS ({per-class summary: Repo URLs VERIFIED via WebFetch of X; Integration category VERIFIED via integrations/README.md; Spec lines VERIFIED via grep of Y}) | FAIL ({specific unverified claim})
- **Outbound URL sweep**: {count} URLs verified via WebFetch; {count} mismatches caught (list); {count} broken (logged as DOC-NNN)
- **Banned-phrase check**: none used | self-caught and rewritten (note which)
- **Regressions**: none | {description}
- **Navigation**: consistent | {what needs update}
- **Upstream issues logged**: none | {list of `issues/{repo}/{PREFIX}-NNN.md` paths drafted during this review}
- **Notes**: {free text, each note ending in `VERIFIED via ...` or `NOT VERIFIED → logging as ...`; no standalone "defensible"/"probably"/"looks right"}
```

- **All gates PASS and no deferrals**: flip `status: review-ready` → `status: done`. Update `state/PROGRESS.md` counts.
- **Any gate FAIL**: flip `status: review-ready` → `status: blocked`. Leave the verdict in the item. Surface to the user with the specific failure and the fix the implementer needs to do.
- **Any gate DEFERRED** (typically Gate 8 because the PR isn't merged yet): leave `status: review-ready`. Re-run `/review` after the merge to close out Gate 8.

### 7. Batch mode

If `$ARGUMENTS` starts with `batch:` (e.g., `batch:feature/critical-odd-platform-config`):
- Identify every item on the branch via `git log` (look for `[DOC-NNN]` in commit messages).
- Run the per-item protocol for each.
- Produce one combined verdict table at the end. Individual items may FAIL while others PASS.

## Rules

- **Reject is the default.** If you cannot cite evidence for a gate, it fails. Do not mark PASS on faith.
- Be strict on acceptance criteria and Quality Bar gates; be lenient on prose style.
- If a test passes but tests the wrong thing → FAIL.
- If a doc is technically correct but misleading → FAIL with specific feedback.
- Never modify the authored files during review. If fixes are obvious and trivial (a typo you happened to spot), log them as a follow-up backlog item and let the implementer roll them in. If the discovery is in upstream code (Java platform, Python collectors, spec, etc.) rather than in our own docs/tests/spec work, log it as an upstream issue draft (`/log-issue {repo} "title"` → `issues/{repo}/{PREFIX}-NNN.md`); never just narrate.
- If `$ARGUMENTS` is empty → list every item with `status: review-ready` and ask which to review.
- If `$ARGUMENTS` refers to an item not in `review-ready` → explain the current status and stop.