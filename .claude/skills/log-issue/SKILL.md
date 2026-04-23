---
name: log-issue
description: Draft an upstream-repo GitHub issue on disk. Creates the next ISS file under issues/{repo}/ with paste-ready frontmatter + body skeleton. The actual filing into GitHub is a deliberate human action — this skill never opens a real issue.
argument-hint: <repo> [optional: "title"]
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Write
---

# Log Upstream Issue Draft

Create a paste-ready GitHub issue draft at `issues/{repo}/{PREFIX}-NNN.md` for the repository named in `$ARGUMENTS`.

## Hard prerequisites

Refuse to run if any of these are true:

- `$ARGUMENTS` is empty → list every prefix from `issues/README.md` and ask which repo to target.
- The first arg does not match any directory under `issues/` AND is not a known repo key in `navigation/repos.yaml` → stop and ask which repo (do not invent a new prefix without explicit user confirmation).
- The user is asking to **file** an existing draft to GitHub → refuse and explain: filing is a manual human action under the workspace's safety rules; this skill only drafts on disk.

## Protocol

### 1. Orient

Read, in order:
- `issues/README.md` — frontmatter format, body sections, lifecycle, prefix table.
- `navigation/repos.yaml` — to confirm the repo key + paste a useful link in the draft.
- The originating context if the user has named one (e.g., a backlog item ID like `DOC-013` — read `backlog/docs/DOC-013.md` so the `discovered_during:` field and the body's "How discovered" section can cite real evidence rather than handwaving).

### 2. Resolve the prefix

Parse the first positional arg in `$ARGUMENTS`. Acceptable forms:

- `odd-platform` → `PLT`
- `odd-collectors` → `COL`
- A bare prefix (`PLT`, `COL`, `SPEC`, `CHT`, etc.) → use directly

Cross-check against the prefix table in `issues/README.md`. If the prefix is **not yet in the table**, stop and ask the user to confirm the prefix to register; then update `issues/README.md` in the same step.

### 3. Compute the next ID

`ls issues/{repo}/` and find the highest existing `{PREFIX}-NNN.md`. The new ID is `{PREFIX}-{NNN+1}`, zero-padded to three digits. If the directory does not exist yet, create it implicitly via the `Write` call (and start at `001`).

### 4. Determine issue_type

Default: ask the user. Acceptable values: `bug | feature | adjustment`.

If `bug`, prompt for `severity`: `critical | high | medium | low`. Severity is required for bugs because GitHub triagers use it to decide priority; for features and adjustments, omit the field.

If the user invoked the skill with an obvious intent already (e.g., `/log-issue odd-platform "Defensive null handling in S2sTokenProvider.isValidToken"`), infer `bug` from a "fix"/"defensive"/"NPE"/"crash" type title, but confirm before writing.

### 5. Compose the title

If a title was passed in quoted form, use it verbatim. Otherwise, ask. Title rules from `issues/README.md`:
- Imperative mood ("Add pagination to SSM secrets backend", not "SSM doesn't paginate")
- ≤70 characters
- No leading prefix like `[Bug]` (GitHub labels carry that)

### 6. Write the file

Create `issues/{repo}/{PREFIX}-NNN.md` with:

```markdown
---
id: {PREFIX}-{NNN}
title: "{title}"
target_repo: {repo}
issue_type: {bug|feature|adjustment}
status: draft
severity: {critical|high|medium|low}     # only for bugs
discovered_during: {DOC-NNN | scan/{scanner} | free text — ask if not provided}
github_issue_url:
github_issue_number:
found_date: "{today, YYYY-MM-DD}"
---

## What

<one paragraph; operator-visible terms>

## Where

<file:line citations + short code excerpt>

## Why it matters

<operator impact: what breaks, who is affected, how the failure manifests>

## Suggested fix

<concrete suggestion if you have one; otherwise note "open to alternatives">

## How discovered

<the on-disk trail in this workspace: backlog ID, scan, review session>
```

Leave each section as a placeholder if the calling context did not give you the substance. **Never invent technical claims** — if you don't have the consumer-read evidence yet, leave a TODO and tell the user what they need to provide.

### 7. Update cross-references

If `discovered_during:` names a backlog item, append a `## Platform-side follow-up filed` section to that backlog file pointing at the new issue draft path. Use this exact heading so future sessions can grep for it.

If the prefix was new (you had to register it in `issues/README.md` in step 2), make sure that update is in the same logical change as this file creation.

### 8. Update `state/PROGRESS.md`

Increment the `draft` count for the target repo in the Upstream Issues table. If the repo doesn't appear in the table yet, add a new row.

### 9. Surface the result

Print:
- Path of the new draft.
- A 1-line reminder: "Filing is a manual action — when you're ready, paste into `https://github.com/opendatadiscovery/{repo}/issues/new` and update `github_issue_url` + status."
- If sections were left as placeholders, list them so the caller knows what to fill in.

## Rules

- **Never file an issue to GitHub.** Even if `gh` CLI is available. Filing is a deliberate human action under the workspace's "visible to others" safety rule.
- **Never invent code references.** If you don't have a real `file:line` for the Where section, leave a TODO. A wrong file:line in a paste-ready draft is worse than a TODO.
- **Never reuse an ID.** Each new draft increments the prefix's counter, even if older drafts have been closed or rejected.
- **One file = paste-ready draft.** Workspace-internal context belongs in the originating backlog item or in conversation, not in the draft body.
- If the user wants to log multiple issues at once, run this protocol once per file. Don't try to batch-write — each draft deserves its own confirm-and-think pass on the body.