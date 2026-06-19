---
name: review
description: Verify a `review-ready` work item (or an entire batch) meets every acceptance criterion and every Quality Bar gate. Reject by default — each check requires cited evidence. Must run in a session distinct from the `/implement` session that produced the item.
argument-hint: <work-item-id> | batch:<branch-name> | release:<version>
allowed-tools: Read Grep Glob WebFetch Bash(ls *) Bash(find *) Bash(cd *) Bash(git *) Bash(./gradlew *) Bash(pnpm *) Bash(poetry *) Bash(pytest *) Bash(npm *)
---

# Review Work Item / Batch

You are reviewing `$ARGUMENTS`. The item (or batch) is in `status: review-ready`. Your job is to flip it to `done` **only** if every gate below passes with cited evidence. The default verdict is **rejection**. "Looks fine" is not a verdict.

This skill exists because `/implement` is not allowed to self-close items. The lesson is `retrospectives/LSN-002-minio-region-unset.md` — every item closed before the separate-session-review rule was self-closed by the same session that implemented it.

## Hard prerequisites

Refuse to run if any of these are true:

- `$ARGUMENTS` is empty → list every `review-ready` item and ask which to review.
- The work item status is not `review-ready` → print the status and stop. (A `pending-release` item is waiting on `/review release:{version}` — the release gate, not a re-review.) **Contributor `CTRIB-NNN` items use `pr-draft` as the review-ready-equivalent** (the draft-PR hand-off state): review them, and flip `pr-draft → review-ready` on PASS (the human GATE-2 merge owns `done`) or `pr-draft → blocked` on FAIL.
- **You are the same session that implemented the item.** If `/implement` and `/review` were called in the same session without an intervening boundary, stop and surface that — self-review defeats the gate.
- The work item's commit is missing a `Sources:` footer (or the legacy `Consumer-read:` footer) **and** the item's claims are factual → reject immediately with "missing Sources footer" and set status to `blocked`. Pure prose-polish items with `Sources: none (prose polish, no factual claim)` are exempt.
- **Cheap precondition BEFORE the expensive run (the 2-minute bounce).** Read the implement-phase Definition of Done in the item ledger. If it admits a gate was **not actually run at the reviewed SHA** — it says "NOT RUN" / "deferred" / "pending the canonical gate", OR (for code changes) there is no integration run-log whose SUT digest == the reviewed commit — **bounce to `blocked` immediately**: "implement did not run its own gate (the FULL regression is implement's DoD; `/review` confirms it, it is not the first runner)". Do not open a full review session to rediscover a break the implementer's own ledger flagged as unverified (CTRIB-023: ~2 hours of review for a 4-line test typo the implementer never ran once). The expensive full re-run later in this protocol is the *confirmation* of a gate implement already passed — never its first execution.

## What to load

1. `CLAUDE.md` — universal framework + Quality Bar overview.
2. `pillars/{active}/{pillar,gates,authoring,canonical-homes,cornerstones}.md` — pillar rules.
3. `backlog/README.md` — status transitions.
4. The work item file — status, acceptance criteria, Context, Implementation Record. A `milestone:` field marks the item **release-gated** (`adrs/drafts/release-train-doc-gating.md`): its commits live on the documentation train `release/{version}` — fetch that branch; the diff under review is the item's commits there.
5. The commit(s) that implemented it — `git log --format=full <branch>` in the target repo. Extract the `Sources:` footer; you will verify every cited source.

## Protocol

### 1. Verify acceptance criteria — one-by-one, cite evidence

For each `- [ ]` / `- [x]` criterion:
- Read the file(s) the criterion references.
- Write a one-line verdict: `PASS: {evidence file:line or URL}` or `FAIL: {what's missing}`.
- "Section exists" fails if the section is a placeholder. "Warning present" fails if the warning is buried in prose instead of an admonition block.

### 2. Verify Quality Bar gates — each is a gate

Run each gate by invoking its playbook in **verification mode** (re-derive what the implementer should have produced; check the change against it). Pillar-specific specialisations live in `pillars/{active}/gates.md`. Every verdict entry (PASS/FAIL/N/A) ends with `via {fetch/grep/read citation}` — no standalone adjectives.

| Gate | Playbook | What review verifies |
|---|---|---|
| Gate 1 — No duplicates | `playbooks/duplication-sweep.md` | Implementation Record's classifications are honest; no parallel copy of the same content under a different name with no cross-link. |
| Gate 2 — Aliases logged | (pillar-specific; `pillars/documentation/gates.md` Gate 2) | If the item used or introduced an alias, the alias table has a row in the same PR. |
| Gate 3 — Caveats captured | (pillar-specific; `pillars/documentation/gates.md` Gate 3) | Every caveat the consumer-read audit surfaced is in the doc as an admonition block, not buried in prose. |
| Gate 4 — Consumer-read | `playbooks/consumer-read.md` | Every file cited in `Sources:` `Config:` / `Config-consumer:` / `Builder:` / `Handler:` lines matches what the consumer code actually does. Grep the target repo for `@Value` consumers not in the footer; FAIL if a behavior-affecting consumer is missing. |
| Gate 5 — Unset-parameter audit | `playbooks/unset-parameter-audit.md` | Every SDK builder in scope has every parameter classified; every `caveat-defaulted` parameter is documented as a known limitation. The `retrospectives/LSN-002` gate. |
| Gate 6 — Bidirectional code ↔ doc | (pillar-specific) | Every functional claim → code evidence. Every user-visible code path touched → doc coverage as feature / limitation / performance / security. Missing either direction is a finding (filed via `playbooks/follow-up-on-disk.md` — narration alone fails this gate). |
| Gate 7 — Layout and completeness | (pillar-specific; `pillars/documentation/gates.md` Gate 7) | SUMMARY entry; index/README links; in-page TOC sync (`retrospectives/LSN-005`); IA hierarchy sanity (`retrospectives/LSN-007`). |
| Gate 8 — Publishing standards | `playbooks/live-site-verification.md` | Live-site WebFetch per affected URL; no GitHub-fallback substring (`retrospectives/LSN-004`). DEFERRED if PR not yet merged; item stays `review-ready`. Release-gated items (`milestone:` set): live verification is **scheduled at the release gate** — run the branch-verifiable sub-checks (PyYAML, ≤200-char description, tree-relative links) against the train now, record `PENDING-RELEASE ({version})` + the post-merge URL/phrase list (`pillars/documentation/gates.md` Gate 8). |
| Gate 9 — Factual claim provenance | `playbooks/claim-inventory.md` | Every cited source actually supports the claim. Per-class: `Repo:` lines WebFetched (`retrospectives/LSN-003`); `Integration:` lines cross-checked against `navigation/architecture.md`; `Spec:` lines grep'd in OpenAPI YAML; etc. **Outbound URL sweep mandatory**. **Banned-phrase check**: every note ends in `VERIFIED via …` or `NOT VERIFIED → log as DOC-NNN`. |
| Gate 10 — Content type homing | (pillar-specific; `pillars/documentation/gates.md` Gate 10) | Read the `Sources:` footer as a content-type signal: 3+ `Spec:` lines on a feature page → API reference content embedded incorrectly (`retrospectives/LSN-006`). 5+ `Config:` lines on a non-config page → configuration reference embedded incorrectly. |
| Gate 11 — Audience isolation *(2026-05-27)* | (pillar-specific; `pillars/documentation/gates.md` Gate 11) | Run the mechanical banned-term grep on `../documentation/docs/**/*.md` files touched by the change. Every workspace-internal term (`Cornerstone N`, `Gate N`, `LSN-NNN`, `SHB-NNN`, `feature-flow-builder`, `Quality Bar`, etc.) on a published doc line = FAIL → flip item to `blocked` with the leak cited; the implementer rewrites in operator language. Contextual stop-words (`sidecar`, `maintainer`, `methodology`, `playbook`, `pillar`, `backlog`, `findings`, `lineage`, `scanners`, `retrospectives`) need per-hit classification per the Gate 11 Exceptions table. Case-law: `retrospectives/LSN-026` — stance-only enforcement missed a single-sentence leak ("Cornerstone 5 holds…") in `data-discovery/tagging.md:56` despite two prior `/review` passes. |

### 3. Check for regressions — FULL suites, never only the impacted scope (maintainer directive 2026-06-11)

- **Regression is measured, not inferred.** Run the FULL test sets of the target repo, both buckets — the impacted items' tests are the inner loop, never the gate:
  - **Unit**: the full CI-replica build (`scripts/run-platform-tests.sh`) on the exact reviewed commit. A CI full-suite run on the same head SHA is citable evidence of the same measurement.
  - **Integration** (code changes in odd-platform scope): the reviewer's own full run against the SUT built from the reviewed commit — `integration-tests/run-suite.sh feature-complete` (must be green) + `multi-stack` (green-target) + `known-bugs` (expected RED; an unexpected GREEN = an un-flipped fix → tests-pillar flip-on-fix checklist) + `ingestion-e2e` (green-target; real source→collector→platform stands — joined the set 2026-06-12). One e2e suite at a time — never concurrent with a possible maintainer run; read actual pass/fail counts, not exit codes.
- For doc changes: WebFetch every link on the affected pages.
- For code comments: verify against surrounding code.
- For test additions: verify they test what they claim.

### 4. Check navigation consistency

- Are file paths in `navigation/domains/*.md` still correct after the change?
- Did the consumer-read audit discover new bean factories / SDK builders? Are they in navigation?
- If the Implementation Record claims navigation was updated, verify.

### 5. Doc-product editorial audit — read the manual end-to-end as its owner

Run `playbooks/doc-product-editorial-read.md` end-to-end. **This is mandatory on every `/review` run, regardless of what the current item touched.** The audit's scope is the doc product as a whole, not the affected pages of the current batch.

This step is **not a checklist of gates**; it is a **stance**. Read every `documentation/docs/**/*.md` end-to-end as the documentation owner — the way an operator three years from now will read it — and surface every coherence finding. The 10 Quality Bar gates verify each item is locally correct; this audit verifies the doc product as a whole coheres.

The audit catalogs failure shapes (internal contradiction, conceptual drift, cross-audience absence, reader-flow defect, parallel surfaces with drift, dead admonitions, half-finished narratives, etc. — full table in the playbook). A finding that does not fit any catalogued shape is still a finding; log it and propose a new shape category.

Every finding is logged as a `DOC-NNN` follow-up via `playbooks/follow-up-on-disk.md` — never narrated in conversation. The follow-up cites source `file:line`, the inconsistent / ambiguous passage verbatim, the failure shape, and the recommended-fix direction.

Token budget is **intentionally not a constraint** here. The session may be long. Per the user's directive (2026-05-03): the reviewer cares about the full picture; tokens and time are spent in service of perfection.

The audit's findings **do not block the per-item verdict**. The 10 gates remain the sole authority for `review-ready` → `done` or `blocked`. The editorial findings extend the backlog as parallel work. An item can flip to `done` while this audit logs 20 follow-ups — the item shipped correctly; the doc product still has work.

If the doc tree exceeds session budget, partition by subtree (e.g., cover `configuration-and-deployment/**` this session; queue `integrations/**` for next) and note the partition state in `state/PROGRESS.md`. The next `/review` resumes where this one stopped. **Do not skip subtrees silently.**

The case for this step's existence is `playbooks/doc-product-editorial-read.md` § case-law: seven prior `/implement` + `/review` sessions passed in 2026-04…05 without catching the Data Collaboration absence, the Features.md alerting cross-link defects, or the Slack-used-twice ambiguity — all caught in one user spot-check on 2026-05-03 (DOC-091 / DOC-092 / DOC-093). The audit exists so that this class of finding is caught by `/review`, not by user spot-check after the fact.

### 6. Verdict — append to the work item

```markdown
## Review (YYYY-MM-DD, session: <short-hash-or-label>)
- **Result**: ACCEPTED | REJECTED
- **Acceptance criteria**:
  - [x] Criterion 1 — PASS ({evidence})
  - [ ] Criterion 2 — FAIL ({reason})
- **Quality Bar**:
  - Gate 1 — PASS ({evidence}) | FAIL ({specific failure})
  - Gate 2 — PASS / N/A / FAIL
  - Gate 3 — PASS / FAIL
  - Gate 4 — PASS (footer verified: {files}) / FAIL ({missing consumer})
  - Gate 5 — PASS ({SDK builder audit}) / N/A (no SDK in scope) / FAIL ({unset caveat})
  - Gate 6 — PASS ({evidence}) / FAIL
  - Gate 7 — PASS ({evidence}) / FAIL
  - Gate 8 — PASS ({URL + observed text}) / DEFERRED (not yet merged) / PENDING-RELEASE ({version} — URLs + phrases recorded) / FAIL
  - Gate 9 — PASS ({per-class verification summary}) / FAIL ({specific unverified claim})
  - Gate 10 — PASS ({per-sub-section content-type identification}) / N/A (pure prose polish) / FAIL ({embedded fragment that should target a canonical home})
- **Outbound URL sweep**: {count} URLs verified via WebFetch; {count} mismatches caught (list); {count} broken (logged as DOC-NNN)
- **Banned-phrase check**: none used | self-caught and rewritten (note which)
- **Regressions**: none | {description}
- **Navigation**: consistent | {what needs update}
- **Upstream issues logged**: none | {list of `issues/{repo}/{PREFIX}-NNN.md` paths drafted during this review}
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: {full tree | subtree list — e.g., "covered `configuration-and-deployment/**` + `developer-guides/**`; queued `integrations/**` for next /review"}
  - **Findings**:
    - DOC-NNN ({priority}, {failure_shape}) — {one-line summary}. Source: `{file:line}`.
    - … (one bullet per finding; `none surfaced this run` if zero)
- **Notes**: {free text, every note ending in `VERIFIED via ...` or `NOT VERIFIED → logging as ...`}
```

- **All gates PASS, no deferrals**: flip `status: review-ready` → `status: done`. Update `state/PROGRESS.md` counts. Editorial findings (if any) are logged as separate follow-ups; they do not block the flip.
- **Release-gated item — all gates PASS with Gate 8 PENDING-RELEASE**: flip `status: review-ready` → `status: pending-release`. The item cannot reach `done` before its release — `/review release:{version}` (below) owns that flip after the train merges and live verification passes.
- **Any gate FAIL**: flip `status: review-ready` → `status: blocked`. Leave the verdict in the item. Surface to the user with the specific failure and the fix the implementer needs to do. Editorial findings are still logged independently.
- **Any gate DEFERRED** (typically Gate 8 because the PR isn't merged yet): leave `status: review-ready`. Re-run `/review` after merge to close out Gate 8. Editorial findings are still logged.

### 7. Batch mode

If `$ARGUMENTS` starts with `batch:` (e.g., `batch:feature/critical-odd-platform-config`):
- Identify every item on the branch via `git log` (look for `[DOC-NNN]` in commit messages).
- Run the per-item protocol for each.
- Produce one combined verdict table at the end. Individual items may FAIL while others PASS.

### 8. Release-gate mode — the full release review

If `$ARGUMENTS` is `release:{version}` (e.g., `release:0.28.0`): run **`playbooks/release-review.md`** — the comprehensive review of the *shipped* release. This is broader than the documentation merge: a release is a **code + test + doc + ontology bundle verified against the published artifact** (the tag and the ghcr image), and this mode owns the `pending-release` → `done` flips.

The seven checks (full procedure + commands in the playbook):

1. **Release delta → coverage matrix** — `git -C ../{repo} log {prev-tag}..{version}` mapped to the train's doc commits + the milestone closed-issue cross-check; any user-facing change with no doc = finding.
2. **Full test suite on the RELEASED version (unit + IT), both buckets, GREEN** — `scripts/run-platform-tests.sh` on the `{version}` checkout (read pass/fail + checkstyle counts, not exit code) **and** `ODD_SUT=published:{version} integration-tests/run-suite.sh {suite}` for every IT bucket (`feature-complete`/`multi-stack`/`ingestion-e2e` green; `known-bugs` expected RED — an unexpected GREEN = an un-flipped fix). The SUT is pinned to the ghcr image via `build-sut.sh published:{version}` (`LSN-032`/`LSN-033`). A red suite on the published tag = CRITICAL → do **not** flip items to `done`.
3. **Real-instance verification on the released image** — `docker pull ghcr.io/{org}/{repo}:{version}`, confirm migrations apply + health UP, verify headline claims on the running instance. **HTTP 200 ≠ working** — read the body/content-type, not the status (`memory/feedback_verify_absence_by_reading_config`).
4. **Documentation-publication gate** — `playbooks/release-train-merge.md` (half 1 readiness + half 2 live verification). Preconditions: milestone `{version}` closed; release `tag_name == {version}`; train PR merged to documentation `main` (verify via `git fetch` + `git log origin/main`, never local state). Manifest: `grep -rl 'milestone: "{version}"' backlog/`; run `playbooks/live-site-verification.md` across every item's recorded URLs + phrases (live GitBook slugs differ — `/features/` prefix, lowercased `adr-NNNN`).
5. **Ontology refresh to the released tag** — `lineage-extractor scan {repo} --full` → `adrs-ingest` → `docs-ingest` → `graph-build` → `alignment` (trust-gate `substrate == HEAD` should flip GREEN); commit as a discrete `chore(lineage):` with explicit paths. Defer the heavy agentic reducers to `/next-batch`.
6. **Security-fix coordination** — for each security fix in the delta, check advisory **publication** state (`…/security-advisories?state=published` + the advisory page; **"closed" ≠ "published"**). Gate any vuln-*disclosing* caveat on the advisory being public — the `documentation` repo is public, so even a pushed branch discloses; graduating an already-public caveat to "fixed in {version}" is not new disclosure.
7. **Close-out** — flip each fully-verified `pending-release` → `done`; any failure → `blocked` with cited evidence; re-target still-pending milestone items to the next release; append the **release record** (delta size, unit+IT pass counts, real-instance evidence, ontology-refresh commit, advisory state, items flipped) to `state/PROGRESS.md`; delete the merged train when zero `pending-release` remain.

Case-law: `retrospectives/LSN-037-release-review-generalized.md`.

## Rules

- **Reject is the default.** If you cannot cite evidence for a gate, it fails. Do not mark PASS on faith.
- Be strict on acceptance criteria and Quality Bar gates; be lenient on prose style.
- If a test passes but tests the wrong thing → FAIL.
- If a doc is technically correct but misleading → FAIL with specific feedback.
- Never modify the authored files (the code/docs under review) during review. **But do not over-log: when the item is being BOUNCED to `blocked` anyway, fold the small in-scope fixes you found (a test typo, a stale count, a missing enum row) into the ONE rework fix-list in the verdict — the implementer fixes them in the same pass. Spawn a separately-tracked item ONLY for genuinely-deferred, separable work that this rework will NOT touch (e.g. a change needing its own ADR).** Logging is for work nobody is about to touch; an item already going back to implement is being touched. (CTRIB-023 over-logged DOC-471 for two 2-line edits the blocked rework was already going to make.) Upstream-code discoveries still get logged as issue drafts via `/log-issue`. Never just narrate.
- **Review is read-only on the repo.** Running suites must not leave side-effect writes committed under the review: the probe runtime merges measured values into `lineage/**` + run-logs as it runs — `git checkout -- lineage/` any ontology drift your run produced before committing. A review commits exactly two things: the verdict in the item + `state/PROGRESS.md`. Re-enrichment is `/implement`'s job, never a review side-effect.