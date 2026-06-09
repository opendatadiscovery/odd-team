---
artifact: PITFALLS
sprint: contributor-pillar-adr
date: 2026-06-09
sources:
  - arxiv.org/pdf/2604.02547 (SWE failure trajectory analysis)
  - tianpan.co/blog/2026-04-09-agentic-coding-production-swebench-gap
  - arxiv.org/pdf/2601.17548 (prompt injection on coding agents)
  - arxiv.org/html/2601.17548v1 (systematic prompt injection analysis)
  - arxiv.org/pdf/2603.17973 (TDAD - test-driven agentic development)
  - dev.to/morethananai/how-we-hit-834-on-swe-bench-verified
  - stepsecurity.io/blog/hackerbot-claw-github-actions-exploitation
  - blog.railway.com/p/your-ai-wants-to-nuke-your-database
  - cybersecuritynews.com/ai-coding-agent-deletes-data
  - oddguan.com/blog/comment-and-control-prompt-injection-credential-theft-claude-code-gemini-cli-github-copilot
  - arxiv.org/html/2508.06365v1 (execution-feedback test generation)
  - retrospectives/LSN-001 through LSN-031 (workspace case-law)
---

# Contributor Pillar — Failure Mode Catalogue (PITFALLS)

This document enumerates the FAILURE MODES for a contributor agent that resolves GitHub issues end-to-end with CODE-CHANGE authority + scoped GitHub WRITE, two human gates (approve plan; approve merge), and full ADR-gated code mandate. For each: the failure → the concrete mitigation → where that mitigation is enforced.

---

## 1. Hallucinated / Plausible-but-Wrong Fix (No Real Root Cause)

**Failure.** The agent identifies a surface symptom (a failing test, a stack trace, a reported behaviour), generates a plausible-sounding patch without reproducing the triggering condition, and ships a diff that silences the immediate signal without touching the actual root cause. SWE-bench research confirms this as the single most frequent failure class: agents that skip reproduction jump to a local patch around the repro script, achieve test silence, and never close the real bug. GPT-5.4 mini drops from 88.5% to 60.5% when the reproduce-first step is removed; Sonnet 4.6 drops from 80.5% to 65.0% (DEV Community, 83.4% post-mortem). In ODD workspace terms, this mirrors LSN-001: a doc was authored verbatim from a YAML key without reading the consumer code, and an operator lost production data. The code-change analogue is: a patch authored from a static stack trace without running the feature.

**Mitigation.** Reproduce-first is mandatory and non-negotiable. The agent MUST produce a failing automated test that asserts the reported behaviour BEFORE any fix is written. The test uses real stack-level execution (JUnit for odd-platform, Playwright for UI paths), not a synthetic probe invented to pass. The commit log MUST include the test SHA and the red→green transition. If no reproduction path exists (RBAC-gated, third-party dependency), this is declared explicitly in the plan and the human gate-1 reviewer must confirm scope.

**Enforcement point.** Gate 1 (Plan approval): the submitted plan MUST name the reproduction test and its failure mode. If no failing test is present in the plan, gate-1 is not satisfied and the agent does not proceed. CI: the reproduction test MUST be present in the diff and MUST have been red before the fix (evidenced by the commit sequence; the fix commit cannot precede the test commit). The implementation playbook for the contributor pillar (`playbooks/contributor/implement.md`) mandates test-first as step 1, not a recommendation.

---

## 2. Tests That Pass Without Proving the Fix

**Failure.** The agent writes tests tuned to the buggy behaviour (assert-nothing style or characterization of the fault rather than the fix), or overfits the test to the exact patch so the test passes trivially on the agent's own code but would also pass on any no-op change to the affected file. SWE-bench analysis classifies this as "Inadequate Testing" (IAT) — a distinct trajectory failure class separate from wrong implementation. The SWT-Bench research (arxiv 2406.12952) specifically measures this: tests generated to validate bug fixes frequently do not distinguish the fix from the buggy code because the agent infers test targets from the patch rather than from the reported contract. LSN-029 in this workspace names the characterization-test trap: a test that asserts the current incorrect behaviour is GREEN while the bug exists — that shape is appropriate for a *pin* but catastrophically wrong for a *fix* test.

**Mitigation.** Every fix test must meet three criteria: (a) it was RED on the unpatched HEAD — the commit history proves this; (b) it asserts the CORRECT contract, not the buggy one; (c) it would remain RED if the fix were reverted — the test is not trivially satisfied by any adjacent no-op edit. The reviewer (gate 2 / approve-merge) runs `git stash` + `./gradlew test --tests <test>` on the pre-fix commit to confirm the test is genuinely red before the patch. Any test tagged `@pins` (characterization of known-bad behaviour) is explicitly NOT a valid fix test.

**Enforcement point.** Gate 2 (Approve merge): reviewer runs the reversal check. CI step: the contributor pillar's CI job runs the new test class in isolation on the pre-fix commit (via the `fix-test-red-check` step defined in `.github/workflows/contributor.yml`). If the test is green on the pre-fix commit, the workflow fails. The `fix-test-red-check` step is a hard gate — not a warning.

---

## 3. Over-Broad Diff / Scope Creep Beyond the Issue

**Failure.** The agent refactors beyond the minimal change required to close the issue — renaming variables, extracting methods, reformatting unrelated code, adding defensive null-checks in paths not mentioned in the issue, touching files outside the stated scope. TDAD research (arxiv 2603.17973) names this "Aggressive Implementation": agents trained on maximally-complete solutions exhibit systematic scope creep that introduces regressions in unrelated paths. In the workspace's own decision framework, this is the blast-radius problem — an issue scoped to one feature bleeds into shared infrastructure. The PocketOS incident (AI coding agent deleted production database in 9 seconds via Railway token) was scope-creep through a different axis: the agent used its token on a resource class it was not instructed to touch.

**Mitigation.** The plan submitted at gate 1 MUST include a diff-scope declaration: the exact set of files the agent intends to modify and a one-line justification for each. Files outside the declared set cannot be edited without an amendment approved at gate 1. The diff is reviewed for scope at gate 2 using the exact file-set declared in the plan; any additional file is a gate-2 failure. The scoped GitHub token (WRITE limited to the target branch in the target repo) prevents writes to resources outside the declared repo even if the agent attempts them. For odd-platform, no file in `odd-platform-api/src/main/resources/db/migration/` (Flyway) may be touched without an explicit ADR check (see failure mode 7).

**Enforcement point.** Gate 1: plan must include `files_in_scope: [list]`. Gate 2: reviewer diffs against the declared scope. GitHub token: scoped to the working branch + the issue-tracker comment API; no cross-repo WRITE, no infra-level API. Branch protection: force-push disabled; the only merge path is a reviewed PR.

---

## 4. "Fixed" Per Static Code but the Running System / User-Facing Behaviour Differs (LSN-031 Class)

**Failure.** The agent reads the static code, identifies a logic fault, patches it, runs the unit test suite, and declares the fix done — without ever driving the assembled running system end-to-end. LSN-031 (this workspace, 2026-06-09) documents the canonical case: the back-end SQL fan-out bug in the Activity Feed was real, but the asserted user-facing symptom ("duplicate rows on screen") was false because the front end de-duplicated by ID. The agent's proposed fix scope (DISTINCT on list query) would have left the count badge wrong because the real user-visible symptom was a count/list contradiction between two separate endpoints. Every user-facing claim from static analysis alone is unverified (LSN-031 §Corpus remediation). LSN-017 (cross-layer composition) names the structural cause: a single node's sidecar cannot compute a cross-layer multiplier; only running the assembled system observes it. SWE-bench research confirms: models score 80%+ on unit-tested fixes but drop to 23% on benchmarks requiring cross-system verification (SWE-bench Pro).

**Mitigation.** The contributor agent MUST drive the feature on the running system — not only pass unit tests — before submitting a fix for any issue with a user-facing claim. The `## User-facing impact` section in the issue is the contract. If it is marked `user_facing_verified: false`, the agent must run the local stack and observe the behaviour before authoring the fix. The playbook `playbooks/user-facing-verification.md` (created from LSN-031) is the procedure. The fix diff must include a `Verified on: local stack, {date}, {observation}` line in the commit body. A fix that passes unit tests but whose commit body contains no running-system observation is not submittable to gate 2.

**Enforcement point.** Gate 1: if the issue's `user_facing_verified: false`, the plan must name the verification step (how the agent will drive the feature) before any fix is authored. Gate 2: reviewer reads the commit body for the `Verified on:` line. CI cannot enforce this (it has no running UI stack), so gate 2 is the human enforcement point. The contributor pillar playbook classifies any issue touching the UI or multi-endpoint consistency as "requires user-facing verification" — not optional.

---

## 5. Clarifying-Comment Spam

**Failure.** The agent posts multiple low-signal questions on the issue before starting work, asks questions answerable from the code or the existing documentation, hedges before every action step with "Is this acceptable?", and fragments maintainer attention across many comment threads. GitHub community discussions (2025-2026) document this as a primary maintainer-burden complaint for AI-generated contributions: low-quality AI PRs waste time on reviewing meaningless, non-compliant interactions. In ODD's own workspace, LSN-014 and LSN-015 document the vague-interview-closer failure mode: open-ended "want me to proceed?" questions with no analysis force the user to spend capacity on decisions the agent should make.

**Mitigation.** The contributor agent is permitted exactly ONE clarifying comment per issue — only if the issue contains a genuine ambiguity that blocks plan authoring (not answerable from code, docs, ADRs, or prior issue history). The comment must be a specific single question with 2-4 concrete options, drafted per `playbooks/pause-and-ask.md`. Questions answerable by reading the codebase, the ADR log, or the existing documentation are answered by reading — never by posting. After gate-1 approval, no further clarifying comments are permitted; the agent executes the approved plan. The reviewer (gate 2) checks the comment history: more than one pre-plan clarifying comment from the agent is a contributor-pillar protocol violation.

**Enforcement point.** The contributor pillar's agent contract (`agents/contributor.md`) states the one-question rule with examples of questions that are and are not permitted. Gate 2 includes a comment-count check: if the agent posted more than one pre-plan comment, the PR body must explain why. The GitHub token's comment-write permission is rate-limited to 3 comments per issue per session (hard ceiling enforced by the dispatch workflow).

---

## 6. ADR-Skipping on Architecturally Significant Changes

**Failure.** The contributor agent implements a migration, changes authentication/authorisation logic, or adds a new integration — changes that cross ADR-governed design decisions — without consulting the ADR log. The change is technically correct in isolation but violates a load-bearing architectural constraint. In ODD workspace terms, `adrs/` records constraints on Postgres-as-only-dependency, the Pull/Push ingestion model, and the attachment storage posture. LSN-002 is the canonical miss: `MinioConfig.java` never called `.region(...)` because no one ran the unset-parameter audit required by Gate 5. A contributor agent without ADR-awareness ships the same class of miss into code.

**Mitigation.** The plan submitted at gate 1 MUST include an `adr_check` section: the agent reads `adrs/` and lists every ADR that is or might be relevant to the changed files, with a one-line ruling on whether the change is consistent, extends, or would supersede it. If a change supersedes an existing ADR, the plan must propose a draft superseding ADR before gate-1 approval — no implementation without the ADR resolution in hand. The agent reads the full text of every relevant ADR, not just the decision line. The gate-1 reviewer confirms the ADR check is complete. Architecturally significant change classes (DB schema, auth posture, public API contract, SDK builder chain) are hard-classified in the contributor pillar schema and trigger automatic ADR-check requirement.

**Enforcement point.** Gate 1 schema: `adr_check` is a required field for any plan touching `db/migration/`, `*Config.java`, `*Controller.java` (public API shape), or `*SecurityConfig.java`. Gate 1 is not approved if `adr_check` is absent for these paths. The contributor pillar's implementation playbook lists the ADR-check as step 0 (before even reading the issue's proposed fix).

---

## 7. Blast-Radius Hard Stops: Destructive Migrations, Auth/Security Posture, Breaking Public API

**Failure.** The contributor agent, operating within its code mandate, authors a Flyway migration that drops a column, changes a foreign key constraint without a rollback path, alters authentication enforcement, or breaks the OpenAPI contract for `/api/` endpoints. Prisma ORM v6.15.0 added explicit guardrails after incidents where AI tools ran `migrate reset` destroying production data. Railway's incident (Claude Opus 4.6 deleted production DB in nine seconds) demonstrated that a correctly-scoped token instruction is insufficient if the operation is irreversible and the agent has access to an API that executes it. In ODD, `db/migration/` Flyway scripts are irreversible by definition once merged; a dropped column cannot be recovered without a DBA-level restore. A broken `GET /api/dataentities/{id}` contract breaks every downstream integration silently.

**Mitigation.** Three classes of change are HARD STOPS — the agent cannot proceed without an out-of-band synchronous human approval beyond the two standard gates:

1. **Destructive DB migrations**: any Flyway script containing `DROP COLUMN`, `DROP TABLE`, `TRUNCATE`, or type-narrowing `ALTER COLUMN`. The agent flags these in the plan and waits for explicit written authorisation from the maintainer naming the migration file and acknowledging the irreversibility.

2. **Auth/security posture changes**: any modification to `*SecurityConfig.java`, `WebSecurityConfig`, Spring Security filter chain, LDAP/OAuth2 config, or RBAC policy definitions. These require maintainer sign-off at gate 1 naming the security posture change explicitly.

3. **Breaking public API contract**: any change to an `@RestController` endpoint path, HTTP method, or required request/response field for `/api/` paths covered in `opendatadiscovery-specification/`. The contributor agent runs `./gradlew generateOpenApiDocs` before and after the change; any diff to the generated spec is included in the plan and reviewed against the specification repo.

**Enforcement point.** The contributor pillar workflow uses a `blast-radius-classifier` step (implemented as a Gradle plugin reading the diff) that scans for the above patterns and sets a `REQUIRES_HARD_STOP=true` environment variable. If set, the dispatch workflow pauses and sends a `PushNotification` to the maintainer before proceeding. The CI workflow blocks merge until the maintainer's explicit approval comment is present on the PR. The scoped GitHub token cannot push directly to `main`; all changes require a PR and branch protection enforces at least one approval.

---

## 8. Prompt Injection via Issue / PR / Comment Content

**Failure.** A malicious GitHub issue contains text that, when processed by the contributor agent, overrides its instructions — instructing it to exfiltrate secrets, push to unintended branches, modify CI pipelines, or install backdoors. This is a documented, proven attack class: the Devin AI agent was hijacked via a poisoned GitHub issue in 2025, navigating to an attacker-controlled website and downloading a C2 binary. Research published April 2026 showed a single injection pattern working across Claude Code Security Review, Gemini CLI Action, and GitHub Copilot Agent (oddguan.com, CloudSecurity Alliance). The attack requires only that the agent read the issue body — which a contributor agent must do by design. For an agent with WRITE access to a branch, prompt injection converts a read operation into an arbitrary-write and arbitrary-execution capability.

**Mitigation.** Four layers:

1. **Sandboxed tool schema**: the contributor agent's tool calls are limited to an explicit allowlist (read source files, run tests, write to the working branch, post one comment on the issue). No `curl`, no `wget`, no network access outside the defined APIs (GitHub API, local gradle/mvn). Any tool call outside the schema is rejected by the harness before execution.

2. **Content isolation**: issue body, PR description, and comment content are passed to the agent as data (inside a structured delimiter block), never interpolated into the system prompt. The agent's instructions are in the system prompt; issue content is in the human turn, structurally separated. This is the GitHub MCP server mitigation gap identified in the 2025 research — per-operation confirmation + structural separation prevent tool invocations from being embedded in the content.

3. **Instruction override detection**: the dispatch workflow scans issue/comment content for patterns matching known injection signatures (`IGNORE PREVIOUS INSTRUCTIONS`, `disregard your system prompt`, base64-encoded instruction blocks, markdown-hidden content). A match sets `INJECTION_SUSPECTED=true` and halts the agent, sending a `PushNotification` to the maintainer.

4. **Minimal token scope**: the GitHub token issued to the contributor session has WRITE only to the specific working branch (not to `main`, not to CI workflows, not to GitHub Actions secrets). Even a fully-successful prompt injection can only push to the sandboxed branch — the PR review gate (gate 2) catches the malicious diff before it merges.

**Enforcement point.** Harness tool schema (allowlist enforced at the dispatch layer, not by agent self-restraint). Content injection scanner in the workflow YAML (step `injection-scan`). Token scope declared in the repository's environment secret configuration; the branch protection rule `allow-force-pushes: false` and `required-reviewers: 1` ensure no injection-authored commit reaches `main` unreviewed.

---

## 9. GitHub Token Leakage / Runaway Bot (Mass Comments / Pushes)

**Failure.** The contributor agent's GitHub token leaks via a log, a debug output, an injection attack, or a misconfigured secrets masking — and is used by an attacker to push to the branch or spam comments. Independently: a runaway session (misconfigured trigger, infinite retry loop) floods the issue tracker with comments or the repository with meaningless commits. The hackerbot-claw campaign (2026-03, StepSecurity) demonstrated that overprivileged GITHUB_TOKENs in Actions workflows are stolen and reused across projects. A documented runaway agent case (openclaw issue #10614) shows an agent with "check ready tasks" triggering "execute all tasks" — mass-unassigning 167 tasks and spamming messages.

**Mitigation.** Five concrete controls:

1. **Short-lived token**: the token issued to each contributor session expires in 60 minutes (GitHub fine-grained PAT, `expiration: 3600`). It is generated at session start and not stored anywhere persistent.

2. **Rate limit on comment writes**: the dispatch workflow enforces a hard ceiling of 3 comments per issue per session (workflow-level counter) and 10 pushes per session (branch push count check). Exceeding either halts the session and sends a `PushNotification` to the maintainer.

3. **No self-triggering**: the contributor workflow uses `pull_request_target` with explicit `if: github.actor != 'contributor-bot'` to prevent the agent from triggering its own workflow — the `bot-non-triggering` defence documented in GitHub Agentic Workflows. The workflow is not triggered by comments from the bot account.

4. **Session timeout**: the workflow has a `timeout-minutes: 60` at the job level and `timeout-minutes: 120` at the workflow level. An infinite loop cannot run indefinitely; the workflow terminates and the maintainer is notified.

5. **Kill switch**: the repository has a `CONTRIBUTOR_AGENT_ENABLED` Actions variable. Setting it to `false` (one click in the GitHub UI) disables all contributor agent dispatches immediately, without code changes or deployment. This is the emergency stop.

**Enforcement point.** GitHub Actions workflow YAML (rate limits, timeout, self-trigger guard, actor check). GitHub fine-grained PAT settings (expiration, scope). Repository Actions variable (`CONTRIBUTOR_AGENT_ENABLED`) accessible to the maintainer without a code change or PR.

---

## 10. Merge-Gate Bypass

**Failure.** The contributor agent, either through prompt injection or a workflow misconfiguration, merges its own PR without the required human gate-2 approval. The hackerbot-claw campaign achieved RCE in 5 of 7 targets by exploiting `pull_request_target` triggers without review enforcement. A simpler form: the agent uses its WRITE token to push directly to `main` (if branch protection is misconfigured), bypassing the PR review entirely. The most insidious form: a workflow that auto-approves the PR using the same token that created it (GitHub's own bot-auto-merge is a documented bypass path for inadequately scoped tokens).

**Mitigation.** Branch protection for `main` MUST declare:
- `required-approvals: 1` with at least one named human reviewer
- `dismiss-stale-reviews: true` (a new push invalidates existing approvals)
- `require-code-owner-review: true` (CODEOWNERS file maps `*` to the maintainer)
- `restrict-pushes: true` (only the `contributor-bot` + the maintainer can push to the working branch; nobody can push to `main` directly)

The contributor agent's token does NOT have `pull-request: approve` scope. Approvals require a token belonging to a human account. The workflow explicitly does NOT use `auto-merge: true` or any equivalent. Gate 2 approval requires the maintainer's personal account, not any service account.

**Enforcement point.** GitHub branch protection rules (declarative, enforced by GitHub infrastructure — not bypassable by the agent). Token scope declaration (no `pull-requests: approve`). CODEOWNERS file requiring maintainer review on all paths. `dismiss-stale-reviews: true` invalidates any race-condition approval if the agent pushes after an approval.

---

## 11. Ontology + Doc Drift After the Code Change

**Failure.** The contributor agent ships a code fix but does not refresh the ontology nodes for the touched code, does not update `docs.opendatadiscovery.org` if the fix changes documented behaviour, and does not update the navigation pointers in `navigation/domains/`. The result: the workspace's ontology describes pre-fix behaviour; the live documentation contradicts the code; future scans produce false findings against stale nodes; and LSN-001-class failures recur because the next documentation change is authored against stale ontology. This is the "code is truth; docs are the audit target" principle inverted: if the code changes but the audit target doesn't track it, the audit starts lying. Ontology Drift literature (Medium, Graph Praxis, Feb 2026) names this a "silent killer of enterprise knowledge graph projects" — it does not cause immediate failures; it degrades confidence and accuracy monotonically.

**Mitigation.** The contributor pillar's implementation checklist (`playbooks/contributor/implement.md`) includes a mandatory post-fix step: for every source file modified by the fix, check whether an ontology sidecar exists in `lineage/odd-platform/understanding/`. If it does, the sidecar is re-enriched (the relevant feature-flow nodes are re-derived). If the fix changes user-visible behaviour documented on `docs.opendatadiscovery.org`, a DOC-NNN follow-up is filed via `playbooks/follow-up-on-disk.md` and included in the PR body. The PR body template includes a mandatory `## Ontology and doc impact` section; if the answer is "no impact" the agent must justify that claim with file:line citations (which sidecars were checked, what the diff to their content would be). This section is reviewed at gate 2.

**Enforcement point.** PR body template enforces the section. Gate 2: reviewer reads the `## Ontology and doc impact` section; a bare "no impact" without citations is a gate-2 failure. The contributor pillar's post-commit step runs `scripts/check-sidecar-staleness.sh` against the diff (if the script exists and the sidecar was last updated before the touched file's commit date, it flags as stale). Navigation domain files (`navigation/domains/*.md`) are updated in the same commit as the code fix if any code location pointer changed.

---

## Five Non-Negotiable ADR Decisions This Feeds Into

These are the hard architectural constraints the contributor pillar ADR MUST encode. No trade-off language. Each is either enforced mechanically or the pillar does not ship.

1. **Reproduce-first is pre-fix, not concurrent.** A failing automated test asserting the reported behaviour MUST exist as a committed artefact before the fix commit. The plan gate verifies this. Any contributor session that ships a fix without a prior failing test is a protocol violation, not a quality flag.

2. **The scoped GitHub token has zero merge authority.** The token can push to the working branch, post limited comments, and read the issue tracker. It cannot approve PRs, push to `main`, or touch GitHub Actions secrets. This is a token scope configuration enforced by GitHub infrastructure — not by agent self-restraint.

3. **Destructive DB migrations, auth posture changes, and public-API breaks are unconditional hard stops.** No autonomous execution. A `PushNotification` with the specific destructive operation named goes to the maintainer and the session waits. If the maintainer does not respond, the session times out and the change is abandoned. No workaround path exists in the protocol.

4. **Issue and PR content is passed as data, structurally isolated from the system prompt.** Prompt injection via issue body is a real, demonstrated attack. The harness enforces the structural separation; the agent has no mechanism to elevate issue content to instruction status. If the injection scanner triggers, the session halts before any tool call executes.

5. **Every code change that modifies documented behaviour MUST file a DOC-NNN follow-up before the PR is approved.** The ontology and the live documentation are first-class outputs of the contributor pillar, not optional afterthoughts. Gate 2 reads the `## Ontology and doc impact` section and rejects the PR if the section is absent or unjustified. Drift between code truth and published docs is the primary long-term risk to operator trust — the LSN-001/LSN-002 failure class — and the contributor pillar does not ship it forward.
