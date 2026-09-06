---
name: log-issue
description: Draft an upstream-repo GitHub issue on disk and file it. Creates the next ISS file under issues/{repo}/ with frontmatter + body, then opens the real GitHub issue via the scoped App token and writes the returned URL + number back into the draft.
argument-hint: <repo> [optional: "title"]
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *) Bash(curl *) Bash(scripts/gh-app/*) Write Edit
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
- The filed issue's URL + number (file it — see Rules), or, if the caller asked for a draft only, the path plus a 1-line note that `github_issue_url` + `status` are still to be set.
- If sections were left as placeholders, list them so the caller knows what to fill in.

## Rules

- **File it.** The maintainer lifted the never-auto-file rule on 2026-09-06 ("you could create gh issues on your own"). The GitHub App token carries `issues: write` — `POST /repos/{owner}/{repo}/issues` with `{title, body, labels}` from the draft's `filed_title` / `filed_labels`. Then write the returned URL + number into the draft and flip `status: draft` → `filed`. Preconditions, every time: the body is pure ASCII (the maintainer's paste mangles UTF-8, and a filed body is read the same way); the body carries **zero** workspace-internal ids (`PLT-`/`CTRIB-`/`DOC-`/`TST-`/`LSN-`/`G-C`/`lineage/`/`backlog/` — describe the thing instead of naming the tracker row); and every label in `filed_labels` exists on the target repo (a missing label 422s the whole call). File with **no** milestone — that stays the maintainer's. Don't batch-file a backlog of older drafts unasked; file what belongs to the work in hand.
- **Never invent code references.** If you don't have a real `file:line` for the Where section, leave a TODO. A wrong file:line in a paste-ready draft is worse than a TODO.
- **Never reuse an ID.** Each new draft increments the prefix's counter, even if older drafts have been closed or rejected.
- **One file = paste-ready draft.** Workspace-internal context belongs in the originating backlog item or in conversation, not in the draft body.
- If the user wants to log multiple issues at once, run this protocol once per file. Don't try to batch-write — each draft deserves its own confirm-and-think pass on the body.