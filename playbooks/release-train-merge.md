---
playbook: release-train-merge
status: active
since: 2026-06-11
applies_to: universal
---

# PROTOCOL release-train-merge

The live manual describes the latest **published release**, never `main`. Documentation for merged-but-unreleased behaviour accumulates on one branch per milestone (`release/{version}` in `../documentation`) and publishes in a single human-merged PR when the matching release ships. This protocol is the **documentation-publication** gate — half 1 readies and opens the train PR (`/implement release:{version}`); half 2 verifies publication and closes the items. It is **check 4 of the full `playbooks/release-review.md`**: `/review release:{version}` runs the umbrella (release delta → coverage matrix · the full test suite on the released version, unit + IT · real-instance verification on the released image · this doc gate · ontology refresh · security-fix coordination · close-out), not this playbook alone. Decision + routing classifier + status machine: `adrs/drafts/release-train-doc-gating.md`.

## trigger

- The maintainer announces release `{version}` is (about to be) published; or
- `/status` / `/orient` detect: `GET /repos/opendatadiscovery/odd-platform/releases/latest` returns a version whose train branch still exists, or a **closed** milestone has backlog items in `pending-release`.

## inputs

- `{version}` — the milestone title == the release tag (plain semver, e.g. `0.28.0`)
- the train manifest, **derived, never a state file**: `grep -rl 'milestone: "{version}"' backlog/ contributor/` (**`contributor/` is not optional** — CTRIB items are the largest producer of release-gated work; a `backlog/`-only grep hid 22 stale items for 10 weeks, `retrospectives/LSN-041`. Re-measured 2026-08-30 for 1.0.0: `backlog/` alone finds 9, `contributor/` holds 22 more, 19 of them already `pending-release`) + `git -C ../documentation log origin/main..origin/release/{version} --oneline`
- each manifest item's recorded post-merge URL list + expected verbatim phrases (written at `/review` time with the `PENDING-RELEASE` Gate 8 verdict)

## procedure

### Half 1 — pre-merge readiness + the train PR (`/implement release:{version}`)

1. **Preconditions — each is a HARD stop:**
   - milestone `{version}` exists and `state == closed` (`GET /repos/opendatadiscovery/odd-platform/milestones?state=all`);
   - release `{version}` is published and `tag_name == {version}` (`GET .../releases/tags/{version}`; cross-check `git -C ../odd-platform fetch --tags && git -C ../odd-platform tag --list '{version}'`);
   - the train exists: `git -C ../documentation ls-remote origin "refs/heads/release/{version}"` returns a ref.
2. **Final sync.** On `release/{version}`: `git fetch origin && git merge origin/main`; resolve conflicts (merge, never rebase — it is a shared branch).
3. **Mechanical sweeps over the FULL train diff** — file list: `git -C ../documentation diff origin/main...HEAD --name-only -- docs | grep '\.md$'`. Run the Gate 11 banned-term grep, the ≤200-char description check, and the PyYAML frontmatter parse over that list (commands: `.claude/skills/implement/SKILL.md` step 6.5). Zero hits before proceeding.
4. **Manifest completeness:**
   - every manifest item is `pending-release` — any `review-ready` → run `/review {id}` first; any `pending`/`in-progress` → the train is not ready: surface to the maintainer (hold the gate, or re-target the item's milestone — maintainer's call);
   - cross-check the milestone's closed issues (`GET .../issues?milestone={milestone-number}&state=closed`): each is matched by docs on the train, a recorded "no doc change + why" (CTRIB record), or gets flagged in the gate report — this catches code merged outside the agent flows and makes the milestone a verified code+docs bundle.
5. **Push + the train PR.** `git push origin release/{version}` (same-name refspec — LSN-034); output `https://github.com/opendatadiscovery/documentation/compare/release/{version}?expand=1` with a suggested PR body enumerating manifest items + milestone issues by ID. **The human merges** — the one publication gate per release.

### Half 2 — post-merge publication verification (`/review release:{version}`)

6. **Confirm the merge** — `git -C ../documentation fetch && git log origin/main --oneline -5` shows the train merge; never infer merge state from local refs.
7. **Live verification.** Run `playbooks/live-site-verification.md` once across the union of every manifest item's recorded URLs + expected phrases.
8. **Flip statuses.** Per item: all its URLs verified → `pending-release` → `done`; any failure → `blocked` with the failing URL + fetched evidence (the playbook's on-fail).
9. **Refresh the doc ground-truth layer:** `/ingest-docs` against the new documentation `main` + graph rebuild (the doc graph ingests published truth only).
10. **Record + clean up.** Append the release record (version, date, items, verdicts) to `state/PROGRESS.md`; when zero `pending-release` items remain for `{version}`, delete the merged train: `git push origin --delete release/{version}`.

## exit

- The train PR is merged by a human; every manifest item is `done` with cited live evidence (or `blocked` with the failure surfaced).
- The doc graph reflects the new documentation `main`; the train branch is deleted; the release record is in `state/PROGRESS.md`.

## on-fail

- **Milestone still open while the release is published** → the maintainer closes it (re-targeting unfinished issues — GitHub's standard close flow) before the train merges. Never merge a train for an open milestone.
- **`tag_name != {version}`** (retitle / renumber) → never merge; surface. Renaming a milestone = rename the train branch + update the items' `milestone:` fields, then re-run half 1.
- **A manifest item not ready** (step 4) → maintainer decides: hold the gate, or re-target the item to the next milestone (cherry-pick its commits onto the next train + revert them on this one).
- **Live verification fails** (step 8) → item `blocked` per `playbooks/live-site-verification.md` on-fail. The published page is now live evidence of the defect — fix forward as an immediate item; do not revert the train.

## case-law

- `retrospectives/LSN-034-docs-work-branch-bare-push-published-main-early.md` — docs published before the code shipped (the merge-level instance); this protocol closes the class at release level and keeps LSN-034's push guards.
- `adrs/drafts/release-train-doc-gating.md` — the decision, the routing classifier, the status machine, the full change map.
- `contributor/CTRIB-003.md` — the worked instance: issue #1748 carried milestone `0.28.0`; its docs note went live 2026-06-10 while the latest published release was `0.27.13` — exactly the gap this gate closes.
