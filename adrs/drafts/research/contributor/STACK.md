---
artefact: research/STACK
topic: contributor-pillar internal composition
authored: 2026-06-09
status: complete
feeds: adrs/drafts/research/contributor/ADR.md (not yet authored)
---

# STACK — Contributor Pillar Internal Composition

How the contributor loop is composed from existing odd-team machinery.
Every claim below is backed by a file:line citation from the actual skill/playbook/pillar files.

---

## 1. Phase → Machinery Table

| Phase | What happens | Existing machinery invoked | Reuse classification |
|---|---|---|---|
| **intake** | Fetch the GitHub issue body + comments; parse title/body/labels/milestone; classify as `bug | feature | adjustment` | `/log-issue` skeleton (`issues/README.md:53-70`) + issues frontmatter schema; `issues/README.md:116` for lifecycle vocab | EXTEND — `/log-issue` currently only drafts on-disk; intake reads from GitHub too (net-new read direction). The on-disk draft format is reused unchanged. |
| **scope-analysis** | Does the issue touch an existing F-NNN feature? Does it cross a published ADR? What code surfaces are affected? | `/code-walk` (`.claude/skills/code-walk/SKILL.md`) — spawns `feature-advisor` to read sidecars + concepts.yaml + implicit-adrs.md + refactoring-scopes.md + doc-gaps.md + test-map.yaml; produces `lineage/{repo}/feature-walks/{date}-{slug}.md` | REUSED-AS-IS — the walk's output (`SKILL.md:3-5`) is exactly the impact-assessment a contributor needs before touching code. |
| **clarify** | Post a clarifying question or a root-cause hypothesis as a comment on the GitHub issue | NET-NEW — no existing skill writes back to GitHub. The comment body is drafted on-disk (same ASCII-only rule from `playbooks/ascii-only-issue-bodies.md`) then posted via the scoped-token GitHub API write. |  |
| **reproduce** | Stand up the ephemeral local stack; drive the scenario described in the issue; capture a FAIL/PASS observation trace | `/probe-run` (`.claude/skills/probe-run/SKILL.md`) — `probe-run` brings up a docker-compose stack, executes a probe, captures `probe-runs/{date}-P-NNN.yaml`; local-only per `SKILL.md:93` + `APPROACH.md §5 rule 12` | REUSED-AS-IS for execution mechanics. NET-NEW: a `reproduce-probe` is authored on-the-fly from the issue description (no pre-existing `P-NNN.yaml` yet); the existing probe schema + runner (`lineage/_extractor/probe-runtime/runner.py`) run it unchanged. |
| **root-cause** | Trace the failure through the implementation chain; confirm which file:line is the defect site | `/enrich --touched` (`SKILL.md:enrich:24`) + `/retrieve` (`SKILL.md:retrieve:3-5`) — enrich re-reads touched nodes; the graph-retriever iterates to find the causal chain | REUSED-AS-IS — the iteration logic (`retrieve SKILL.md:27-30`) and sidecar enrichment are already the root-cause-tracing machinery. NET-NEW: the starting seed is a GitHub issue rather than a maintenance gap. |
| **plan (GATE 1)** | Produce a written change plan: which files, which tests, which docs, which ADRs constrained; present to maintainer for approval | `/code-walk` walk document as plan artefact; `playbooks/pause-and-ask.md` for the gate interaction | EXTEND — the walk already produces an "implementation skeleton" section (`SKILL.md:code-walk:101-102`). GATE 1 adds a mandatory human stop (`playbooks/pause-and-ask.md` protocol) before any file is modified. |
| **implement-code** | Edit Java/TypeScript/Python source files in the target repo to fix or add the feature | `/implement` (`.claude/skills/implement/SKILL.md`) — holds the Implementation Quality Bar, reads consumer code, runs the pre-authoring stance check, commits with `Sources:` footer | EXTEND — `/implement` currently works items from `backlog/`; this phase extends its execution loop to work a `contributor/CTRIB-NNN.md` work item whose `target_repo` is `odd-platform` and whose acceptance criteria are the issue's "What/Where/Why/Suggested fix" fields. The Quality Bar gates, pre-authoring stance, Sources footer, and commit shape are reused unchanged. |
| **unit-tests** | Write or extend unit tests in `odd-platform/*/src/test/`; run `scripts/run-platform-tests.sh` CI gate | Tests pillar (`pillars/tests/pillar.md:30-38`) — the "unit" bucket is Gradle `build` in `odd-platform` CI; `scripts/run-platform-tests.sh` is the gate (`pillar.md:96`) | REUSED-AS-IS — test shape, gate annotation, and CI gate are the pillar's existing contract. The contributor adds the `regresses: [PLT-NNN]` or `validates: [F-NNN]` gate to the new test per `pillar.md:58-65`. |
| **integration-tests** | Author an IT-NNN protocol covering the user-observable flow the bug/feature affects; run `integration-tests/run-suite.sh` | Tests pillar integration bucket (`pillar.md:33-43`) — IT-NNN protocol lives in `integration-tests/protocols/`; `TEMPLATE.md` is the shape; `run-suite.sh` is the gate | REUSED-AS-IS — the IT-NNN format, `suites.yaml` registration, and run-suite gate are already the protocol. The contributor authors a new `IT-NNN` file from `TEMPLATE.md`. |
| **docs** | Update `../documentation` pages that describe the affected feature; add/update caveats | Documentation pillar (`pillars/documentation/pillar.md`) — all gates, authoring rules, GitBook constraints, `Sources:` footer, live-site verification | REUSED-AS-IS — `/implement` for `target_repo: documentation` already runs every gate in `pillars/documentation/gates.md` and all pre-commit checks (`SKILL.md:implement:54-113`). |
| **ontology-refresh** | Re-enrich the touched nodes; re-run feature-reflector if a feature's chain changed; update feature-flows | `/enrich --touched` + `/reflect-feature` (`SKILL.md:enrich:24` / `SKILL.md:reflect-feature:3-5`) — incremental enrichment uses `git diff` against the repo HEAD to find touched files; reflect-feature re-derives the promise layer | REUSED-AS-IS — both skills are already designed for incremental refresh after a code change. |
| **PR (GATE 2)** | Open a DRAFT PR on `odd-platform`; post the PR link as a comment on the source GitHub issue; wait for maintainer approval to merge | NET-NEW — no existing skill opens a PR on an upstream repo or links back to the issue. The PR body template mirrors the `issues/README.md` body shape; the draft-PR flag prevents auto-merge. The two-token model (read token for intake, write token for PR + comment) is net-new infrastructure. |  |

---

## 2. Reuse vs New Ledger

### Reused as-is

| Machinery | File | Role in contributor loop |
|---|---|---|
| `/code-walk` | `.claude/skills/code-walk/SKILL.md` | Scope-analysis (feature-advisor walk) + plan document |
| `/probe-run` | `.claude/skills/probe-run/SKILL.md` | Reproduce phase — ephemeral stack execution + trace capture |
| `/enrich --touched` | `.claude/skills/enrich/SKILL.md:24` | Root-cause (re-enrich touched nodes) + ontology-refresh |
| `/retrieve` | `.claude/skills/retrieve/SKILL.md` | Root-cause chain tracing via graph-retriever |
| `/reflect-feature` | `.claude/skills/reflect-feature/SKILL.md` | Ontology-refresh — re-derive promise layer after code change |
| `/implement` (for code + docs) | `.claude/skills/implement/SKILL.md` | Implement-code + docs phases — Quality Bar, Sources footer, pre-authoring stance, pre-commit sweeps |
| `/review` | `.claude/skills/review/SKILL.md` | Post-PR review gate — same 10 gates, same separate-session rule, same reject-by-default posture |
| Tests pillar — unit bucket | `pillars/tests/pillar.md:30-43` | Unit-tests phase — gate annotations, CI gate (`scripts/run-platform-tests.sh`) |
| Tests pillar — integration bucket | `pillars/tests/pillar.md:33-43` | Integration-tests phase — IT-NNN protocol, `integration-tests/run-suite.sh` |
| Documentation pillar | `pillars/documentation/pillar.md` | Docs phase — all 12 quality axes, authoring rules, GitBook constraints |
| ADR pillar | `pillars/adr/pillar.md` | Scope-analysis and implement-code phases — constraint-checking against existing ADRs |
| `playbooks/consumer-read.md` | `playbooks/consumer-read.md` | Implement-code phase — every runtime claim traces to code |
| `playbooks/follow-up-on-disk.md` | `playbooks/follow-up-on-disk.md` | Any phase that discovers adjacent gaps during the contributor loop |
| `playbooks/pause-and-ask.md` | `playbooks/pause-and-ask.md` | Both gate interactions (GATE 1 plan approval, GATE 2 PR approval) |
| `issues/` frontmatter schema | `issues/README.md:53-70` | Intake — the on-disk draft format for tracking the in-flight issue |
| IT-NNN protocol template | `integration-tests/TEMPLATE.md` | Integration-tests phase — the canonical shape for a new IT protocol |

### Extended (existing machinery, new invocation context)

| Machinery | What changes |
|---|---|
| `/log-issue` (`.claude/skills/log-issue/SKILL.md`) | Currently creates drafts only; intake phase adds a read direction (fetch the issue from GitHub before drafting). The on-disk draft is the coordinator artefact for the whole contributor loop. |
| `/implement` (`.claude/skills/implement/SKILL.md`) | Currently works `backlog/{cat}/` items. Contributor phase works a `contributor/CTRIB-NNN.md` item. The Quality Bar, batch logic, commit shape, and phase lifecycle are unchanged; only the item location and the extra `github_issue_ref:` frontmatter field differ. |
| `/code-walk` (`.claude/skills/code-walk/SKILL.md`) | Currently a planning aid; contributor loop treats the walk's "implementation skeleton" section as the formal GATE 1 plan document the maintainer approves. No change to the walk itself; GATE 1 is an orchestration layer on top. |

### Net-new

| What | Where it lives (proposed) | Why nothing existing covers it |
|---|---|---|
| **GitHub issue intake** — read a live GitHub issue via API; populate the on-disk CTRIB-NNN draft | `pillars/contributor/` skill | `/log-issue` is write-only (draft creation); no skill reads from GitHub API |
| **GitHub comment writer** — post a clarifying question or root-cause hypothesis back to the issue thread | `pillars/contributor/` skill + scoped-token config | The workspace explicitly forbids auto-filing (`issues/README.md:121`); the contributor pillar supersedes this rule for COMMENTS (not issue creation) under the decided scoped-token model |
| **Reproduce-probe authoring** — generate a `P-NNN`-compatible probe YAML from the issue description and a feature-walk | Subagent contract under `pillars/contributor/` | `/probe-run` executes existing probes; authoring a probe from an issue description is a new subagent responsibility |
| **Two-gate orchestration** — GATE 1 (plan approval before code), GATE 2 (PR approval before merge); pause, hand back to maintainer, resume | New skill `/contribute` (orchestrator) | The existing `/implement` → `/review` split is for doc/test items; GATE 1 is earlier (pre-code) and GATE 2 involves an upstream repo PR. Different temporal structure. |
| **Draft PR creation** — open a DRAFT PR on `odd-platform` via GitHub API; link PR back to source issue | Part of `/contribute` skill's PR phase | No existing skill creates PRs on upstream repos; CLAUDE.md instructs outputting a manual URL instead (`CLAUDE.md:277-281`) — superseded for the contributor pillar by the decided scoped-token model |

---

## 3. Repo-Touch Map

| Phase | Reads | Writes | Local path |
|---|---|---|---|
| intake | GitHub API (`opendatadiscovery/odd-platform` issues) | `odd-team/contributor/CTRIB-NNN.md` | `./contributor/CTRIB-NNN.md` |
| scope-analysis | `odd-team` lineage graph; `../odd-platform` source | `odd-team lineage/odd-platform/feature-walks/{date}-{slug}.md` | `./lineage/odd-platform/feature-walks/` |
| clarify | — | GitHub API (issue comment) | via GitHub API |
| reproduce | `../odd-platform` source (probe stack image) | `odd-team lineage/odd-platform/probe-runs/{date}-P-NNN.yaml` | `./lineage/odd-platform/probe-runs/` |
| root-cause | `odd-team` sidecars; `../odd-platform` source | `odd-team lineage/odd-platform/understanding/{slug}.md` (re-enriched) | `./lineage/odd-platform/understanding/` |
| plan (GATE 1) | `odd-team` feature-walk | `odd-team contributor/CTRIB-NNN.md` (plan field updated) | `./contributor/CTRIB-NNN.md` |
| implement-code | `../odd-platform` source | **`../odd-platform`** Java/TypeScript source files; `odd-team` bookkeeping | `../odd-platform/odd-platform-api/src/`, `../odd-platform/odd-platform-ui/src/` |
| spec alignment (if needed) | `../opendatadiscovery-specification` OpenAPI YAML | **`../opendatadiscovery-specification`** YAML | `../opendatadiscovery-specification/` |
| unit-tests | `../odd-platform` test files | **`../odd-platform`** `*/src/test/java/**/*Test.java` | `../odd-platform/*/src/test/` |
| integration-tests | `odd-team/integration-tests/` protocols | **`odd-team/integration-tests/protocols/IT-NNN.md`**; `suites.yaml` update | `./integration-tests/protocols/` |
| docs | `../documentation` Markdown | **`../documentation/docs/**/*.md`** + `SUMMARY.md` | `../documentation/` |
| ontology-refresh | `odd-team` lineage; `../odd-platform` HEAD | `odd-team lineage/odd-platform/understanding/`, `feature-flows/`, `feature-reflections/` | `./lineage/odd-platform/` |
| PR (GATE 2) | `odd-team` CTRIB-NNN; `../odd-platform` branch | GitHub API (DRAFT PR on `odd-platform`; comment on source issue) | via GitHub API |

---

## 4. The Two Crossed Rules

### Rule A — CLAUDE.md:254 "No functional changes"

> "No functional changes — only docs, tests, comments, spec alignment"

This rule was written for the **maintenance workspace's doc/test focus** (the sentence is in the "Key Principles" section of the `documentation` pillar era). It governs existing pillars (documentation, tests, ADR) and prevents the agent from making unrequested Java or TypeScript edits while working a doc gap.

**How the contributor pillar supersedes it:**

The contributor pillar is the first pillar with an explicit code-change mandate. The maintainer has decided (as documented in the design context) that `FULL code mandate (bugs+features+migrations, ADR-gated)` is the accepted scope. The pillar's ADR will formally record this as a **pillar-scoped exception**: Rule A holds for all existing pillars; the `contributor` pillar's `pillar.md` carries an explicit override: "code changes to `odd-platform`, `odd-collectors`, and `opendatadiscovery-specification` are in-scope when working a `CTRIB-NNN` item approved through GATE 1." GATE 1 is the human checkpoint that makes the code mandate safe — no code change proceeds without the maintainer reading and approving the plan.

### Rule B — issues/README.md:121 "Filing is always a human action"

> "Filing is **always** a human action for now (a 'visible to others' operation under the workspace's safety rules). Drafts can be created freely; filing requires a deliberate paste-and-submit."

This rule was written to prevent the agent from posting content to public GitHub trackers without human review. The "filing" it guards is **creating a new issue** from a draft.

**How the contributor pillar supersedes it:**

The design context decided scoped-token GitHub WRITE for two operations: (a) posting **comments** on an existing issue (not creating new issues), and (b) opening **DRAFT PRs** (not merging them). Both operations are lower-stakes than issue creation:

- A comment on an existing issue is a reply, not a new entry in the tracker. The issue already exists; the agent is annotating a thread the maintainer opened or approved for analysis. It can be deleted.
- A DRAFT PR is not merged. It requires a second deliberate human action (GATE 2 approval + merge) before any code lands.

The pillar's ADR records this scoping: Rule B continues to govern issue creation (the agent never creates issues from scratch) and all operations in the existing pillars. Within the contributor pillar, the scoped-token model applies to comments and DRAFT PRs only.

---

## 5. How the Two Gates Map onto the Phase Loop

```
intake → scope-analysis → clarify
       → reproduce → root-cause
                          ↓
                    ┌─ GATE 1 (human) ─┐
                    │  plan approval   │
                    │  (AskUserQuestion│
                    │   + pause-and-   │
                    │   ask.md)        │
                    └──────────────────┘
                          ↓ (approved)
               implement-code → unit-tests → integration-tests → docs → ontology-refresh
                                                                           ↓
                                                                   ┌─ GATE 2 (human) ─┐
                                                                   │  PR review +     │
                                                                   │  merge approval  │
                                                                   │  (DRAFT PR open; │
                                                                   │  maintainer merges│
                                                                   └──────────────────┘
```

### Relationship to the existing `/implement` → `/review` split

The existing split (`implement` ends at `review-ready`; `/review` runs in a separate session) handles the **intra-workspace** quality gate: the implementer cannot self-mark `done` because the same session that authored cannot verify its own work (`SKILL.md:implement:14`; `retrospectives/LSN-002`).

The contributor pillar's two gates serve a different purpose:

| | `/implement` → `/review` split | GATE 1 + GATE 2 |
|---|---|---|
| **Trigger** | Self-review is blind | Code mandate on a public repo requires human sign-off |
| **What is gated** | Quality of the change (10 gates, reject-by-default) | Scope of the plan (GATE 1) and the public commit (GATE 2) |
| **Timing** | After authoring | GATE 1 = before code; GATE 2 = after code + tests + docs |
| **Who gates** | A fresh session (agent) | The maintainer (human) |
| **Consequence of rejection** | Item flips to `blocked` | GATE 1: plan revised; GATE 2: PR stays draft |

The contributor pillar **uses both**: GATE 1 is a human pre-code approval (`pause-and-ask.md` protocol); `/review` is the intra-workspace quality gate that runs between GATE 1 completion and GATE 2 hand-off; GATE 2 is the human post-review merge approval. The sequence is:

```
GATE 1 (human approves plan)
  → implement + test + docs [/implement Quality Bar holds throughout]
    → /review [separate session, 10-gate rejection-by-default audit]
      → GATE 2 (human approves DRAFT PR → merge)
```

The GATE 1 / GATE 2 structure is additive, not a replacement for the existing gate.

---

## Decisions This Feeds into the ADR

1. **The contributor pillar is a composition pillar, not a greenfield build.** Eleven of twelve phases reuse or extend existing skills/playbooks/pillars; only intake (GitHub read), comment-write, reproduce-probe authoring, two-gate orchestration, and draft-PR creation are net-new. The ADR should record this composition map so future maintainers understand which existing contracts govern which phase.

2. **The code mandate requires explicit pillar-scoped override of CLAUDE.md:254.** The ADR must state the scope precisely: code changes are in-scope only for `CTRIB-NNN` items that have passed GATE 1; all other pillars are unaffected. This is not a global rule change — it is a pillar-level exception with a human gate as the safety mechanism.

3. **GATE 1 fires at the plan document, not at intent.** The plan document is the `/code-walk` feature-walk's "implementation skeleton" section, not a separate artifact. The ADR should decide whether the walk IS the plan or whether a separate `contributor/CTRIB-NNN-plan.md` is authored. The composition favors the former (less overhead); the ADR records the decision.

4. **The GitHub write token is scoped to two operations only (comments + DRAFT PRs); the existing human-only rule for issue creation is preserved unchanged.** The ADR must cite `issues/README.md:121` and `issues/README.md:148` as the unchanged baseline, then state exactly what the contributor pillar adds: comment writes + DRAFT PR creation, both requiring the `CTRIB-NNN` draft to be in `status: gate-1-approved` before the write is attempted.

5. **The `/review` separate-session gate applies inside the contributor loop.** The sequence is GATE 1 → implement/test/docs → `/review` (separate session) → GATE 2. The ADR must state that the contributor loop does not collapse the `/review` gate: the intra-workspace quality audit (10 gates, reject-by-default, `LSN-002` lesson) runs even though GATE 2 is also a human approval. The human GATE 2 is not a substitute for the quality gate — it is a public-commit authorization layered on top.
