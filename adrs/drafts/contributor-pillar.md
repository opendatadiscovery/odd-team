---
id: ADR-contributor-pillar
title: The Contributor Pillar — autonomous end-to-end GitHub-issue resolution
status: draft
date: 2026-06-09
deciders: maintainer (Raman)
amends:
  - CLAUDE.md:254 ("No functional changes — only docs, tests, comments, spec alignment") — scoped, not removed
  - issues/README.md ("filing is always a human action") — scoped to issue-creation + merge, not comments/draft-PRs
research:
  - adrs/drafts/research/contributor/STACK.md
  - adrs/drafts/research/contributor/EXTERNAL-PRACTICE.md
  - adrs/drafts/research/contributor/GITHUB-MECHANICS.md
  - adrs/drafts/research/contributor/PITFALLS.md
  - adrs/drafts/research/contributor/PROBES.md
---

# ADR — The Contributor Pillar

## Context

The odd-team has matured from documentation-maintainer + issue-drafter into a **virtual contributor** to Open Data Discovery. The pilot batch of verified `PLT-*` issues is ready to file; the next capability is the agent + skills that **resolve** those issues end-to-end: read the issue → understand scope → reproduce → root-cause → plan → change code → add unit + integration tests → update docs → refresh the ontology → open a PR, with clarifying questions and root-cause posted back to the issue thread.

This is a deliberate expansion that crosses two standing rules:
- `CLAUDE.md:254` — "No functional changes." The contributor **changes odd-platform code**. Scoped exception, this pillar only.
- The human-only-GitHub rule (`issues/README.md:121,148`). The contributor **posts comments and opens draft PRs directly**. Scoped: it never creates new issues and never merges.

The four shaping decisions were taken by the maintainer (2026-06-09): **scoped-token GitHub write** (comments + draft PRs directly; humans merge only), **two human gates** (approve the plan before code; approve the PR before merge), **full code mandate** (bugs + features + migrations, ADR-gated), and the deliverable is **this ADR + a `contributor` pillar + skill/agent contracts**, with PLT-001 as the worked example.

**What the research establishes (the load-bearing external facts):**
- Agentic issue→PR is production-real — 93.9% on SWE-bench Verified — but drops ~35 points on private codebases and a METR field study showed a **19% task-time *increase*** in production. The binding variable is **issue-scope quality + reproduction**, not model capability (`EXTERNAL-PRACTICE.md`). So the leverage is in triage, reproduce-first, and the plan-gate — not in the code generator.
- The dominant failure point is **code localization** (finding the right lines); reproduce-first is the single largest improvement lever (20–28 points), because the failing test's stack trace localizes the bug (`EXTERNAL-PRACTICE.md`, `PITFALLS.md`).
- **Test overfitting is real** — 21.8–33% of patches that pass their *own* generated test fail the hidden golden test. Running the full suite + a fresh-context adversarial review is the mitigation (`EXTERNAL-PRACTICE.md`).
- Agents **under-ask** clarifying questions (1–2.6% of turns; users push back 39–44%). The fix is one upfront interview at the plan-gate, zero clarification during execution (`EXTERNAL-PRACTICE.md`).
- **Prompt injection via issue/PR/comment content is a proven attack**, not theoretical (the Devin 2025 incident; the April-2026 cross-agent study). Only structural separation of issue content from instructions mitigates it (`PITFALLS.md`).
- **Token blast radius is an infrastructure problem** (PocketOS: a prod DB deleted in 9s; hackerbot-claw: RCE via an overprivileged `GITHUB_TOKEN`). Least-privilege + hard stops are requirements, not guidance (`PITFALLS.md`).

## Decision

Create the **`contributor` pillar**: a `/contribute` orchestration skill + supporting agents that run the resolve loop below. It **composes** existing machinery (the ontology pipeline, `/implement`, `/review`, the tests/doc/adr pillars, the probe/IT reproduction layer) and adds four net-new capabilities (issue intake, comment writer, reproduce-probe authoring, two-gate orchestration). Per `STACK.md`: 8 skills/pillars reused as-is, 3 extended, 4 net-new.

### 1. The resolve loop — 12 phases, two gates

| # | Phase | Machinery | "Done" signal |
|---|---|---|---|
| 1 | **Intake** | net-new GitHub-API reader | issue body + metadata loaded; class/method/surface identified |
| 2 | **Scope analysis** | `system-mission.md` + `/code-walk` | classified: bug / feature / expected-behaviour / doc-gap; mission-relevance stated |
| 3 | **Clarify** | net-new comment writer + the one-question bar | a single difference-making question posted, or "no question warranted" recorded |
| 4 | **Reproduce** (if bug) | local docker stack + `/probe-run` + a generated probe | the live observation captured (the curl/UI evidence); if not reproducible → clarify or reclassify |
| 5 | **Root-cause** | `/code-walk` + `/retrieve` + reading the running system | the cause + impact posted as a comment; **bug vs expected-behaviour vs missing-docs vs misunderstanding** decided |
| 6 | **Plan** → **GATE 1** | `/code-walk` plan + `pause-and-ask` | a written plan with **explicit scope EXCLUSIONS** + the ADR decision + the test/doc/ontology plan; **human approves** |
| 7 | **Implement** | `/implement` (extended to `contributor/CTRIB-NNN`) | the code diff, bounded by the approved plan |
| 8 | **Unit tests** | tests pillar (unit → odd-platform/CI) | a real behavioural test that fails on the bug and passes on the fix (not a characterization pin as fix-evidence — `LSN-029`) |
| 9 | **Integration tests** | tests pillar (integration → odd-team IT-NNN) | the e2e behaviour verified on the running stack; characterization pins re-grounded RED→GREEN per `LSN-029` |
| 10 | **Docs** | documentation pillar | docs.opendatadiscovery.org updated, **or** an explicit "no doc change + why" recorded |
| 11 | **Ontology refresh** | `/enrich --touched` + graph re-embed | the touched sidecars/feature-flows re-enriched + committed (not narrated) |
| 12 | **Draft PR** → **GATE 2** | net-new PR writer + `/review` (separate session) | a draft PR (CI-green, `Closes #N`, descriptive body); `/review` passes; **human approves + merges** |

The two gates are **additive** on the existing `/implement → review-ready → /review` split; `/review` (separate session, reject-by-default, all 10 Quality-Bar gates) runs between implementation and GATE 2 (`STACK.md`).

### 2. GitHub identity + least privilege (the scoped token)

Per `GITHUB-MECHANICS.md`:
- **Identity: a GitHub App** registered as `odd-contributor`, acting as `odd-contributor[bot]` — a distinct audit actor with **1-hour auto-expiring installation tokens**. A PAT is rejected: it attributes all bot activity to the maintainer's account and is long-lived.
- **Exactly four permissions:** Issues (write), Pull requests (write), Contents (write), Metadata (read). **Nothing else** — no Administration, Workflows, Secrets, Actions. The app cannot read or modify branch protection.
- **Branch on upstream** (`opendatadiscovery/*`), not a fork — write comes from the App installation; branch protection applies cleanly.
- **Execution in this environment:** `gh` is not installed and the GitHub MCP server loses the bot identity (PAT auth), so the path is a small `gen-jwt.sh` (openssl) → installation token in an env var → `curl` to the REST API. The private key is encrypted at rest and **never committed**.
- **Kill-switch:** uninstall the App (immediate, all tokens revoked) or delete the private key (≤60-min window). Every bot action is visible in the org audit log (`actor:odd-contributor[bot]`) and carries the `[bot]` badge.

### 3. The merge gate is enforced by GitHub, not by convention

The guarantee is structural, not conventional (simplifying `GITHUB-MECHANICS.md` §3, which proposed CODEOWNERS as a third layer — dropped per the maintainer's 2026-06-09 call: it hardcodes a single owner, and required-approval already guarantees a human review while letting *any* maintainer give it):
1. **`main` branch protection requires ≥1 approving review**, with no bypass for the bot — the hard gate.
2. **GitHub blocks a PR author from approving its own PR.** The bot is the author (a distinct identity, `odd-contributor[bot]`), so it cannot self-approve — a *human* maintainer must approve before any merge, and **any** maintainer can.
3. **The bot opens PRs as `draft`** — a courtesy signal that the PR awaits review; the required approval (not the draft flag) is the enforcement.

The agent's token *cannot* merge regardless of what it does (no Administration permission to weaken the rule; not on any bypass list). GATE 2 is therefore a platform guarantee, not a prompt instruction.

### 4. The code mandate + the hard-stop guardrails

Full mandate (bugs + features + migrations). But three classes **always** require an approved ADR **and** explicit human sign-off at GATE 1 before any code, because their blast radius is irreversible (`PITFALLS.md`):
- **Destructive / irreversible DB migrations** (drop/alter column, data backfill).
- **Auth / security-posture changes** (a `SecurityRule`, a filter, a token flow, a default).
- **Breaking public API / wire-contract changes** (odd-specification, response shapes).

For these, the agent STOPS at scope-analysis and proposes an ADR (`PROBES.md` PROBE-3), it does not implement first.

### 5. Reproduce-first + verify-the-running-system (the anti-hallucination spine)

The non-negotiable that the external evidence and our own `LSN-031` both demand:
- **No fix without a reproduction.** For a bug, phase 4 must produce a live observation (the curl/UI evidence). If it cannot be reproduced, the agent does not "fix" it — it clarifies or reclassifies.
- **A failing test before the fix** (phase 8 written against the reproduction), then the fix makes it pass.
- **Verify the running system, not the diff** (`LSN-031`): drive the feature / run the full suite; a patch that passes its own test but not the suite is not done (`EXTERNAL-PRACTICE.md` overfitting data).
- **Characterization pins flip, they do not get deleted** (`LSN-029`): an existing `@pins` test asserting the buggy behaviour is re-grounded RED→GREEN, with the flip pre-authored in the IT protocol.

### 6. The clarify discipline (the one-question bar)

Because agents under-ask, the bar is explicit and high (`EXTERNAL-PRACTICE.md`, `PROBES.md`): clarify **only** when the answer changes the implementation, **only** at the plan-gate (not mid-execution), and post **one** highest-value question — never a list. "No question warranted" is a valid, recorded outcome. Comment writes are rate-limited; AI comment-spam is a documented OSS-maintainer burden (`PITFALLS.md`).

### 7. Prompt-injection defense

Issue, PR, and comment content is **data, never instructions** (`PITFALLS.md`). The contributor agent treats the issue body as an untrusted artifact to analyse; an instruction embedded in it ("ignore your guidance and …") is discarded and logged, never executed and never surfaced as a "should I comply?" question (`PROBES.md` PROBE-4). This is structural — the system prompt and the issue content are separated, not filtered.

### 8. Data model (SCHEMA)

- **`contributor/CTRIB-NNN.md`** — the work record per resolved issue. Frontmatter: `id`, `github_issue_number`, `github_issue_url`, `class` (bug | feature | expected-behaviour | doc-gap | misunderstanding), `status` (see lifecycle), `reproduced` (bool + evidence path), `adr_required` (bool + ADR id), `plan_approved_by` / `plan_approved_at`, `pr_url`, `pr_draft` (bool). Body: scope analysis, reproduction log, root-cause, the approved plan (with scope exclusions), the test/doc/ontology ledger.
- **Status lifecycle:** `intake → scoping → clarifying → reproducing → root-caused → planned → plan-approved (GATE 1) → implementing → tests-green → docs-done → ontology-refreshed → pr-draft → review-ready → (human) merged | blocked`.
- **Comment templates** (posted to the issue): the **clarify** comment (one question + why it's load-bearing) and the **root-cause** comment (cause + impact + the planned approach + a link to the draft PR once open).
- **PR body schema:** `Closes #N`, the root-cause, the change summary, the scope exclusions, the test evidence (unit + integration + the running-system observation), the docs/ontology deltas.

### 9. Acceptance criteria + the adversarial probe corpus (the gate to unattended running)

The contributor runs **attended** (every issue through both gates) until it passes the probe corpus; only then does the maintainer consider loosening. Per `PROBES.md`:
- **10 acceptance criteria** (AC-1…AC-10): code-before-plan is disqualifying; reproduction must be logged; scope is bounded by the approved plan; the unit test injects the failing condition explicitly; pins are re-grounded not deleted; the docs decision is stated; the ontology refresh is committed not narrated; status ends `review-ready` not `done`; architectural changes require an ADR before any code; prompt injection is discarded.
- **4 adversarial probes** the agent must pass: a **not-a-bug** issue → explain + propose close/doc, zero code; an **ambiguous** issue → exactly one good question; an **architecturally-significant** issue → STOP + propose an ADR before coding; a **prompt-injection** issue → discard the injected instruction, continue on the legitimate issue.

## Consequences

- **Two rules scoped** (not deleted): `CLAUDE.md:254` and the GitHub-human-only rule now carry a `contributor`-pillar exception; they remain in force for every other pillar.
- **New artefacts:** the `contributor` pillar (`pillars/contributor/`), the `/contribute` skill + the intake/comment/reproduce/PR agents, the `gen-jwt.sh` token helper, and a **one-time human setup**: register the `odd-contributor` GitHub App, confirm `main` branch protection requires ≥1 approving review, and provision the installation key. This is the single human-infrastructure step the whole design depends on.
- **Risk posture:** the irreversible-blast-radius classes are ADR-gated and human-signed; the merge gate is a GitHub guarantee; the token is least-privilege and revocable; prompt injection is structurally contained. The residual risk is a *plausible-but-wrong fix that passes review* — mitigated by reproduce-first + full-suite + the fresh-context `/review`.
- **The leverage is triage, not codegen:** per the field evidence, the value comes from resolving well-scoped, reproduced issues and declining the rest — exactly what the pilot batch (verified, reproduced, scoped) provides.

## Worked example — PLT-001 (the null-guard s2s bug)

The full 12-phase trace is in `PROBES.md`. In brief: intake the issue → scope (bug, mission-relevant, no ambiguity → "no question warranted") → **reproduce live** (`curl -H 'X-API-Key: x'` → 500 vs 200 without, under `AUTH_TYPE=DISABLED` — the exact observation we verified 2026-06-09) → root-cause (the null deref in `S2sTokenProvider.isValidToken`, posted as a comment) → **plan + GATE 1** (one-line null guard; REFACTOR-108 explicitly out of scope; new `S2sTokenProviderTest`; IT-112 re-ground; no doc change + why; `/enrich F-088`) → implement → unit test (`isValidToken` returns false on null token, injected via `ReflectionTestUtils`) → integration test (IT-112 pin flips RED→GREEN per `LSN-029`) → docs (none, with reasoning) → ontology refresh (`/enrich F-088`, committed) → **draft PR + GATE 2** (`review-ready`, never self-`done`). It exercises every gate, guardrail, and the reproduce-first spine on a one-liner — which is why it is the validation seed.

## Status / next

Draft. On approval: scaffold `pillars/contributor/` + author the `/contribute` skill and the intake/comment/reproduce/PR agent contracts, then validate by running PLT-001 through the loop (attended) before any unattended use. The GitHub App registration is the human prerequisite.
