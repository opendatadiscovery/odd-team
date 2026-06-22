---
id: LSN-038
title: A contributor fix branch created off origin/main tracked main; a bare push published unreviewed CODE straight to public odd-platform main — and the human-admin push bypassed G-C4's bot-only merge gate
date: 2026-06-22
domain: contributor / git-hygiene / methodology
severity: critical
gates_informed:
  - playbooks/github-write.md (step 5 — branch creation must never leave origin/main as upstream; local-fallback safety)
  - .claude/skills/contribute/SKILL.md (Phase D — branch step: upstream guard + push.default current)
  - pillars/contributor/gates.md (G-C4 — the bot-only structural guarantee does NOT cover a human-admin direct push; the local-git-hygiene guard is the complement)
status: closed
sequel_to: LSN-034
---

# LSN-038: a contributor branch tracked main → a bare push published unreviewed code to public main

## What happened
CTRIB-028's odd-platform fix was authored on a branch the agent created with
`git checkout -b contrib/CTRIB-028-term-detail-hardening origin/main`. That start-point made git auto-set the
branch's upstream to **`origin/main`** (`branch.<name>.merge=refs/heads/main`) — and the agent's own command
output even printed *"set up to track 'origin/main'"* without flagging it. The agent committed the fix locally
(`9d3de146`). The maintainer then ran a bare `git push`, which followed the upstream and **fast-forwarded
`origin/main` to `9d3de146`** — publishing **unreviewed code to the public `opendatadiscovery/odd-platform`
`main`**, with no PR and no review. The maintainer caught it immediately ("it was pushed into main without
review").

Recovery: `git revert --no-edit 9d3de146` → `b5930a75` pushed to main (content restored to the prior
`fb597e04`); the contrib branch was recreated on the post-revert main and the fix **re-applied as a fresh
commit** (`75fc06cd`, cherry-pick) so the eventual PR diff is the real change, not empty (the revert-then-re-PR
gotcha: a branch whose tip is the already-reverted commit diffs as empty). Both contrib branches
(CTRIB-028 + the parallel CTRIB-029, which had the identical `origin/main` upstream) had their upstream unset.

## Why it slipped (four layers — three are LSN-034 recurring)
1. **`checkout -b <branch> origin/main` sets the upstream to `origin/main`** (`branch.autoSetupMerge`). This is
   the exact mechanism LSN-034 named in `../documentation` — it recurred here because the rule was never
   propagated to the odd-platform contributor checkouts/worktrees.
2. **The bot path that is safe-by-construction was not used.** `playbooks/github-write.md` step 5 designs branch
   creation via the App API (`POST /git/refs`) — no local upstream, no trap. The `odd-contributor` App was
   unconfigured in this environment, so the run fell back to **local git**, where step 5 gave no safe pattern.
3. **`push.default` was not `current`** in the worktree, so a bare `git push` was free to follow the
   diff-named upstream to `main` (LSN-034 rule (a), un-applied here).
4. **G-C4's structural merge gate did not catch it — because the pusher was a human admin, not the bot.** G-C4
   guarantees *the bot* cannot merge (branch protection blocks the PR author from self-approving). It says
   nothing about a **maintainer-admin** doing a direct fast-forward push from a mis-tracked local branch: that
   push either is exempt from branch protection (admin bypass) or no required-review rule applies. The
   bot-only guarantee is necessary but **not sufficient**; the local-git-hygiene guard is the complement for
   the human path.

## Rule that emerged
- **(a) Contributor branch creation never leaves `origin/main` as the upstream.** Prefer the App API
  (`POST /git/refs`, step 5). In the local fallback: create the branch *without* a remote start-point that sets
  the upstream (`git checkout -b <branch>` while on the fetched base, or `git switch -c <branch>`), then publish
  with an explicit same-name refspec **`git push -u origin <branch>`** — never `checkout -b <branch> origin/main`.
- **(b) `git config push.default current`** in every contributor checkout/worktree, so a bare `git push` can
  only ever create/update the *same-named* remote branch — structurally never `main`.
- **(c) Pre-push assertion:** before ANY push from a contributor checkout, verify the branch's upstream is the
  same-named remote branch (or absent) — **`test "$(git rev-parse --abbrev-ref @{u} 2>/dev/null)" != origin/main`**.
  Any refspec whose right-hand side names `main` (`HEAD:main`, a git hint suggesting it) is a stop-and-read.
- **(d) G-C4 gains a human-path clause:** the bot-only merge guarantee is complemented by (a)–(c) because a
  human-admin push bypasses branch protection. **Action for the maintainer:** verify `opendatadiscovery/odd-platform`
  `main` actually requires a PR + review with **no admin bypass for direct pushes** — this push succeeding means
  protection is either absent or admin-bypassable, contrary to what LSN-034/G-C4 assumed.

## Forcing question
Before any `git push` from a contributor checkout: is the branch's upstream the **same-named remote branch**
(never `origin/main`), and will a human review this on a PR before it can reach `main`?

## References
- odd-platform reflog: `origin/main` `fb597e04` → `9d3de146` (bare push, fast-forward) → `b5930a75` (revert).
- `branch.contrib/CTRIB-028-term-detail-hardening.merge = refs/heads/main` (pre-fix); same on CTRIB-029.
- Recovery: revert `b5930a75`; re-PR commit `75fc06cd` (cherry-pick of the fix onto post-revert main).
- Sequel to **LSN-034** (same class, docs repo, `push.default current` + same-name refspec); related G-C4
  (`pillars/contributor/gates.md`), `playbooks/github-write.md`.
- Root contribution: `contributor/CTRIB-028.md`.
