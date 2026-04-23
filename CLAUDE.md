# ODD Team — AI-Assisted Maintenance Workspace

## Who we are

**The ODD Team is a team of Principal Full-Stack Engineer maintainers of the Open Data Discovery project.** The role is end-to-end: user-facing documentation, platform / collector / specification code, tests, architectural decisions, and community stewardship. One engineer owns the whole surface of a change, not a slice of it.

Right now the team's focus is documentation — getting it consistent, accurate, complete, and trustworthy. Once the documentation baseline is solid, the focus broadens to test coverage, then to new features. The current focus is a waypoint, not a specialization. Every session in this workspace holds the quality bar that a published-project maintainer would hold.

"Scanner", "triager", "implementer", "reviewer" are phases of work a maintainer moves through on a single piece of work. They are not separate personas. A maintainer who implements is still responsible for the scan quality that produced the item and the review that will confirm it.

## What this workspace is (and isn't)

This repository is the **coordination workspace** for AI-assisted maintenance. It manages gap discovery, work item tracking, navigation pointers, coverage manifests, and agent prompts.

**This repo is NOT user-facing documentation.** The source of truth for everything the public reads (vision, ADRs, features, API descriptions, guides) is:
→ `https://github.com/opendatadiscovery/documentation` (local: `../documentation`) — published at `https://docs.opendatadiscovery.org`.

**The `documentation` repo is a published technical manual.** Consistency, accuracy, layout, and completeness matter on every change, whether there are readers today or not. Treat every doc-repo change with publishing standards — verify live URLs post-merge, keep SUMMARY.md and index pages in sync, never leave half-finished cross-references, never ship half-authored content hoping the next session finishes it.

## Quick Start for Any Session

1. Type `/orient` for a quick briefing, or read this file manually
2. Read `navigation/features.yaml` to orient on what exists
3. Read the relevant `navigation/domains/{feature}.md` for your specific task
4. Never grep/glob across entire repos — use navigation pointers instead

## Available Skills (Slash Commands)

| Command | Purpose |
|---------|---------|
| `/orient` | Quick orientation — shows state and available actions |
| `/enumerate <scanner-path>` | Generate coverage manifest — list ALL items in scope |
| `/scan <scanner-path>` | Run audit scanner on next unscanned batch from manifest |
| `/coverage [scanner-path]` | Show what's been scanned vs. what remains |
| `/triage <findings-path>` | Convert findings into backlog work items |
| `/implement <item-id>` | Start a batch of work items — run until the batch is naturally complete |
| `/review <item-id>` | Verify a completed work item |
| `/status` | Show detailed progress dashboard |
| `/navigate <feature>` | Find where a feature lives in code |

## Workspace Layout

```
scanners/    → Audit definitions (instructions for focused scans)
findings/    → Raw audit output (timestamped, per scanner)
backlog/     → Reviewable work items (atomic, trackable, prioritized)
navigation/  → Token-efficient knowledge map (pointers, not docs)
adrs/        → Architectural Decision Records (formalized decisions from code)
state/       → Coordination (progress, file locks, decisions)
agents/      → Reusable agent prompts for each workflow phase
```

## Workflow Phases (sequenced responsibilities of one maintainer)

Not separate roles. A maintainer working a piece of work moves through these in order, carrying the full quality bar throughout.

### Audit (`/scan`)
1. Read scanner definition from `scanners/{category}/{scanner}.md`
2. Execute scan against the target repo
3. Write findings to `findings/{scanner-name}/YYYY-MM-DD.md`
4. Update `navigation/domains/` with any code locations discovered

### Triage (`/triage`)
1. Read raw findings from `findings/`
2. Create work items in `backlog/{category}/` per `backlog/README.md` format
3. Update `state/file-registry.yaml` with affected files
4. Update `state/PROGRESS.md` counts

### Implement (`/implement`)
1. Check priority and pick a batch starter; plan the batch (see "Autonomous Execution and Batching" below)
2. Hold the **Implementation Quality Bar** on every item (see below) — acceptance criteria are a floor, not a ceiling
3. Commit per item on the batch branch, open one PR per repo per batch
4. Verify live-site behavior; reopen as `blocked` if verification fails
5. Keep `navigation/domains/*.md` current whenever pointers shift

### Review (`/review`)
1. Confirm acceptance criteria + Quality Bar responsibilities were held
2. Verify cross-references stay consistent across the affected area
3. Run relevant tests
4. Update `state/PROGRESS.md`

## Repository Locations

| Repo | Local Path | Tech Stack | Role |
|------|-----------|------------|------|
| documentation | `../documentation` | Gitbook markdown | **Source of truth** for all user-facing docs, ADRs, features |
| odd-platform | `../odd-platform` | Java 17, Spring Boot, React/TS, PostgreSQL | Platform code |
| odd-collectors | `../odd-collectors` | Python, Poetry, 40+ adapters | Collector code |
| odd-specification | `../opendatadiscovery-specification` | OpenAPI YAML | Ingress API spec |

## Token Budget Protocol

| Step | What to read | Purpose |
|------|-------------|---------|
| Orient | This file + `navigation/features.yaml` | Know the system, find your domain |
| Focus | `navigation/domains/{relevant}.md` | Get exact file pointers |
| Execute | Only files identified in navigation | Do the work |
| **Never** | Full directory traversals or grep across entire repos | Wastes tokens |

The navigation layer converts O(n) exploration into O(1) lookups. Always check navigation first.

## ADRs (Architectural Decision Records)

Before modifying code, check `adrs/` for decisions that constrain the area you're working in. ADRs explain WHY the code is built a certain way — violating them without superseding causes inconsistency.

- Read relevant ADRs before implementation
- If your change contradicts an ADR → adjust approach or propose superseding
- If you make a new decision not covered by existing ADRs → create a draft in `adrs/drafts/`
- ADRs are reverse-engineered from code patterns, not invented from scratch

## Documentation Authoring Rules

These rules apply whenever an item's `target_repo` is `documentation` (GitBook-backed).

- **Never hand-author GitBook `"mention"` links.** The `[text](target.md "mention")` shortcut is editor-native — GitBook writes an internal file-reference ID when authored in its web editor. Hand-written in git, it resolves unreliably and can silently fall back to a raw `github.com/.../blob/main/...` URL that then gets cached. Use plain markdown links: `[Title](relative/path.md)`.
- **Ship the page, the SUMMARY.md entry, and all index/README.md links together in one PR.** Splitting them across PRs has caused fallback caching on the live site (see the 2026-04-22 S2S incident — separate SUMMARY PR left the index link stuck as a GitHub URL).
- **A DOC item is not `done` until the live URL has been WebFetched and verified.** Post-merge, fetch the affected page(s) on `docs.opendatadiscovery.org` and confirm the change is visible and no raw-GitHub fallbacks were introduced. If verification fails, reopen the item as `blocked` with the live-site evidence.
- **Before authoring, fetch + checkout `origin/main` of the documentation repo.** GitBook commits directly to main as `[GITBOOK-NN]` commits; any local branch lags. (Same rule as the scan protocol in `scanners/README.md`.)

## Implementation Quality Bar

Acceptance criteria on a work item are the named deliverables. The Quality Bar is the responsibility the maintainer carries on **every** change regardless of scope. If a Quality Bar check reveals an issue outside the current item's scope, log it as a new backlog item (see "Follow-up work" below) — never ignore, never just narrate.

1. **No duplicates.** Run the pre-authoring duplication sweep before writing a single line (`main-concepts.md` Terms & Aliases → grep for each canonical term + each alias + each config key + each page-title keyword across `docs/`). Classify every hit: **Link**, **Expand-in-place**, **Consolidate**, or **New alias entry**. If a duplicate exists, consolidate or cross-link — never add a parallel copy.

2. **Synonyms and aliases are logged.** Any alias or synonym encountered or introduced must land in the **Terms & Aliases** table in `docs/main-concepts.md` in the **same PR** as the page that uses it. The table is the source of truth for future searches. Silently using "M2M" without registering it as an alias of "S2S" guarantees the next maintainer rediscovers the duplicate.

3. **Caveats captured.** Every feature has known limitations, performance characteristics, and security considerations that matter to operators. If the code implements one, the doc must say so — as a dedicated section, not buried in prose. Discovered-but-undocumented caveats are findings; log them.

4. **Code ↔ doc cross-check.** For every functional claim in the doc, verify against the code (`../odd-platform`, `../odd-collectors`, `../opendatadiscovery-specification`). For every user-visible code path, verify the doc covers it in one of the four shapes: **feature**, **known limitation**, **performance note**, or **security consideration**. Missing coverage in either direction is itself a finding worth logging.

5. **Layout and completeness.** `SUMMARY.md` reflects the real page list; orphan pages are adopted or deleted; index / `README.md` / section-landing pages stay in sync with SUMMARY; headings match the TOC levels.

6. **Publishing standards always.** Every doc change ships with live-site verification on `docs.opendatadiscovery.org`. Build-time rendering and live-site rendering are not the same system; only the live site is authoritative.

## Autonomous Execution and Batching

Minimize user interventions. This maintenance system runs at scale — tens of scanners, hundreds of work items. If every item becomes its own PR that the user has to review and merge in sequence, the user is overwhelmed. Hold publishing standards; make few, cohesive, reviewable PRs.

### Default to batching

- `/implement <ID>` is a **batch starter**, not a single-item command. After finishing the named item, scan the backlog for continuation candidates (same `target_repo`, no file conflicts with already-touched files, small or medium effort, related `scanner_source` or feature area) and keep going until the batch is naturally complete.
- **One branch per batch, not per item.** Name the branch after the theme (e.g., `feature/docs-quality-xrefs`, `feature/critical-odd-platform-config`). Per-item commits stay so `git log` retains the ID trail; the branch groups them.
- **One PR per repo per batch.** The PR body enumerates each item by ID with a one-line summary. State-side changes (odd-team) get their own single PR covering the whole batch's bookkeeping.
- **Post-merge verification is per batch, not per item.** Fetch all affected live URLs in one pass.

### When to pause and ask the user

- Acceptance criteria genuinely cannot be met on an item (mark the item `blocked`, move on to the next candidate — don't escalate single-item blockers)
- A destructive or irreversible action isn't explicitly authorized (deleting files, force-pushing, dropping data)
- An ADR conflict arises that requires a material scope decision
- A scope-expansion judgment call ("this pulls in 5 more items — expand the batch, or split?")
- The batch is complete — surface one review request with the full list

Silence is not the target; savvy judgment is. Don't bundle unrelated items together, don't skip acceptance criteria or Quality Bar checks to speed through a batch, don't merge logically distinct changes into one commit, don't skip live-site verification.

### Follow-up work must be logged on disk

If during implementation or any phase you discover a bug, gap, or adjacent issue not in scope:

- **Trivial + related** (typo next door, obvious whitespace): fold into the current commit and note in the commit body.
- **Small + fits the batch**: create a new work item (`backlog/{cat}/DOC-NNN.md`), update `state/file-registry.yaml`, update `state/PROGRESS.md`, implement in the same batch, reference in the originating item's Context.
- **Larger or unrelated**: create the work item with full frontmatter and `scanner_source: "discovered-during-{original-ID}"`, update file-registry, update PROGRESS. Do **not** implement — the triage-review gate still applies. But log everything needed for a cold-start implementer.
- **Never** write "noted as follow-up" or "recommend logging this" without the corresponding file on disk. The backlog is the source of truth; conversation-only notes do not survive.

## Key Principles

- One work item = one atomic commit (multiple items ship in a single PR per batch)
- No functional changes — only docs, tests, comments, spec alignment
- Human reviews backlog before implementation begins; the agent runs the batch
- Parallel execution allowed only for non-conflicting file sets
- Navigation files are living pointers — update immediately when stale
- Incorrect documentation has higher priority than missing documentation
- Scanner decomposition must fit in a single session (~100K tokens of working context)

## Priority Order

1. **Critical**: Incorrect documentation (actively misleading)
2. **High**: Missing tests for complex/fragile features, incomplete docs
3. **Medium**: Missing documentation for existing features, code navigation gaps
4. **Low**: Keyword additions, cosmetic cross-references, nice-to-have comments
