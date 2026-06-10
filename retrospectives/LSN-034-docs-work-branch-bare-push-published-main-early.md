---
id: LSN-034
title: A docs work branch created off origin/main published straight to main on push — the fixed-note went live before the fix merged
date: 2026-06-10
domain: documentation
severity: high
gates_informed:
  - Gate 8 — publishing standards / live-site verification
  - playbooks/github-write.md (push mechanics)
  - contributor G-C4 (guarantees must be structural, not prompts)
status: closed
---

# LSN-034: A docs work branch created off origin/main published straight to main on push

## What happened
CTRIB-003's docs deliverable (`d6b42f8`, the multilingual-ui #1748 fixed-note) carried an explicit sequencing decision in its own commit body — "merge AFTER the odd-platform PR closing #1748" — yet landed on `opendatadiscovery/documentation` `main` the same evening, while PR #1749 was still an open draft. The push came from this machine (`refs/remotes/origin/main@{0}: update by push`; remote `main` == `d6b42f8` exactly, a fast-forward — no GitHub PR merge). GitBook synced within minutes: by 20:09 the live page asserted "odd-platform#1748 added the three keys to every bundle — all nine toolbar tabs now translate" — a claim that was false until GATE 2 merged #1749. Caught by the `/review` session's Gate 8 pass (2026-06-10), not by the implementer.

## Why it slipped
Three layers lined up. (1) The branch was created from `origin/main`, so git auto-set its upstream to `refs/heads/main` (`branch.<name>.merge=refs/heads/main` — the default `branch.autoSetupMerge` behaviour when forking a remote-tracking ref). (2) `push.default` was unset (= `simple`): a bare `git push` on a branch whose upstream name differs from the branch name refuses — and its error hint offers `git push origin HEAD:main` as the first suggested command. A push of BOTH refs happened (the branch ref exists remotely AND main fast-forwarded), consistent with following that hint; the exact command is unrecovered (no session transcript), but every candidate command shares the same class: a refspec naming `main` on the right-hand side. (3) `opendatadiscovery/documentation` `main` has no branch protection, so a direct fast-forward push publishes unreviewed — unlike odd-platform, where G-C4's required-review protection makes this class structurally impossible. The sequencing decision lived only in a commit body — a prompt, not a guarantee.

## Rule that emerged
(a) **Repo-local guard, applied 2026-06-10:** `git config push.default current` in `../documentation` — a bare `git push` now only creates/updates the same-named remote branch, never `main`. Apply the same in any new checkout the workspace pushes from. (b) **Push with explicit same-name refspec** (`git push -u origin <branch>` / `git push origin HEAD`); treat any git hint or command whose refspec right-hand side names a ref you did not intend to publish (`HEAD:main`) as a stop-and-read moment, exactly like an auto-mode guard denial (`feedback_verify_identifiers_never_from_memory` precedent: the guard signal is true). (c) **Structural recommendation to the maintainer:** enable branch protection (require a PR) on `opendatadiscovery/documentation` `main` — every existing flow already merges via PRs (#88, #96); protection makes the sequencing class impossible rather than discipline-dependent, mirroring contributor G-C4's "the merge gate is a GitHub guarantee, not a prompt."

## Forcing question
Before any `git push` in a publishing repo: does the right-hand side of the refspec name exactly the branch you intend to update — and would a human see this content before it goes live?

## References
- `../documentation` reflog: `refs/remotes/origin/main@{0}: update by push` → `d6b42f8`; `git ls-remote origin main` == `d6b42f85` (2026-06-10 ~20:05+02)
- `branch.fix/multilingual-ui-1748-fixed-note.merge = refs/heads/main`; `push.default` unset (= simple)
- Live evidence: `docs.opendatadiscovery.org/features/multilingual-ui` serving "about 70 code-referenced keys" + the #1748 fixed-note at 20:09+02 with PR #1749 still `draft: true` (GitHub API)
- Sequencing intent: `d6b42f8` commit body ("merge AFTER"); `contributor/CTRIB-003.md` DoD item 3
- Caught in: `/review` CTRIB-003 (2026-06-10), Gate 8; remediation = prompt GATE 2 merge of #1749 (closes the window), not a revert (would re-publish the 5x-understated "14 or more" count)
- Related: LSN-032 (false-done class — guarantees over prompts), G-C4 (`pillars/contributor/gates.md`)
