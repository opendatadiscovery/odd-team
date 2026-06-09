# External Practice: Production Agentic-SWE Systems — Issue to PR

**Research date:** 2026-06-09
**Purpose:** Ground the contributor-pillar ADR (issue-scope → reproduce → plan → code → tests → docs → PR,
scoped GitHub write, two human gates) in what production systems have proven.

---

## 1. Systems Covered

| System | Type | SWE-bench Verified (Jun 2026) |
|---|---|---|
| SWE-agent + SWE-bench | Open research scaffold | Foundational baseline (~12.5% GPT-4, ~70%+ Claude 3.7 Sonnet with v1) |
| Devin (Cognition) | Proprietary autonomous engineer | Not published as a single score; see §7 |
| GitHub Copilot Coding Agent | Embedded GitHub product | Not published |
| OpenHands (ex-OpenDevin) | Open platform | Claude Opus 4.8 leads their index |
| Claude Code (Anthropic) | Terminal-native agent | 88.6% Claude Opus 4.8 on Verified |
| Top of leaderboard (Jun 2026) | Claude Mythos Preview | **93.9%** |

Sources:
- [SWE-bench Verified leaderboard — awesomeagents.ai](https://awesomeagents.ai/leaderboards/swe-bench-coding-agent-leaderboard/)
- [SWE-bench Verified scores — benchlm.ai](https://benchlm.ai/benchmarks/sweVerified)
- [SWE-agent paper — arXiv:2405.15793](https://arxiv.org/pdf/2405.15793)

---

## 2. System Summaries

### 2.1 SWE-agent / SWE-bench

SWE-agent introduced the **Agent-Computer Interface (ACI)** concept: language models are a new kind of end user
requiring interfaces designed for them, not for humans. The core insight is that careful ACI design improves
performance more than model tuning alone.

**ACI design principles** (from the paper):
- Granular commands (`find_file`, `search_file`, `search_dir`) with context-limited, concise outputs — prevents
  context saturation from long grep outputs.
- Windowed file viewer — agents see a fixed window of code, not the whole file.
- Linting before applying edits — syntax errors are caught at the tool boundary, not discovered at test-run time.
- Shell execution with structured feedback — test results are formatted for LLM consumption.

**The loop:** Localize → Edit → Run tests → Read results → Re-localize or fix → Repeat. This is not a linear
waterfall; re-localization after failed tests is normal and expected.

**Reproduce-first:** SWE-agent runs are more successful when the agent first writes a reproduction step (a command
or minimal script that exhibits the bug) before touching source code. This reduces speculative edits.

**Failure analysis (from the paper and subsequent analyses):**
- Localization failure is the dominant failure category — agents target the wrong file or wrong function.
- Agents get stuck in localization loops: same search commands repeated, no progress.
- Incorrect fixes that pass narrow tests but break adjacent behaviour (test overfitting — see §5).
- Multi-file changes are significantly harder; single-file fixes dominate the success distribution.

Sources:
- [SWE-agent paper — arXiv:2405.15793](https://arxiv.org/pdf/2405.15793)
- [ORACLE-SWE localization signal analysis — arXiv:2604.07789](https://arxiv.org/pdf/2604.07789)
- [SWE-bench failure analysis — codeant.ai](https://www.codeant.ai/blogs/swe-bench-scores)

### 2.2 Devin (Cognition)

Devin is the most complete production deployment of the autonomous-engineer model. It is not a single model but
a compound system.

**Architecture:**
- **Planner:** High-reasoning model that decomposes the task into a DAG (directed acyclic graph) of dependent
  steps, not a flat list.
- **Coder:** Specialised model trained on high-quality code.
- **Critic/Reviewer:** Adversarial model that reviews code after writing, before the PR is opened to humans.

**Planning gate:** Before executing a single line of code, Devin shows the user the written plan. The user can
edit, reorder, or approve each step. This is the first human gate. The design rationale: catching scope
misunderstandings at plan-review time costs one message; catching them after implementation costs a re-run.

**Dynamic re-planning:** When tests fail or blockers appear, the DAG is revised. The system does not stop and
ask; it re-plans autonomously for mechanical issues (lint, CI failures, null-check misses) and escalates to the
human only for judgment calls (architecture decisions, product direction, domain-knowledge edge cases).

**CI iteration loop:** Devin watches for GitHub bot comments (linters, CI failures, security scanners). Any
automated comment triggers a fix loop that iterates until automated checks pass. Human reviewers only see a
"CI-green, linter-clean" PR. The explicit design choice: "everything mechanical gets caught and fixed before you
even open the diff."

**PR workflow:** Devin ships the PR only after its own internal Critic has reviewed the diff. The human's job is
judgment-level review, not mechanical defect hunting.

Sources:
- [Devin introduction docs — docs.devin.ai](https://docs.devin.ai/get-started/devin-intro)
- [Closing the agent loop — cognition.ai](https://cognition.ai/blog/closing-the-agent-loop-devin-autofixes-review-comments)
- [How Devin actually thinks — Medium](https://medium.com/@nitinmatani22/how-devin-ai-actually-thinks-autonomous-planning-dag-execution-and-dynamic-re-planning-explained-997be175a475)
- [Devin agents101 — devin.ai](https://devin.ai/agents101)

### 2.3 GitHub Copilot Coding Agent

Fully embedded in the GitHub issue-tracker workflow. GA since September 2025; available to Copilot Enterprise
and Pro+.

**Issue assignment flow:**
1. User assigns the issue to Copilot (github.com, mobile, or CLI — same UX as assigning to a teammate).
2. Agent adds a 👀 emoji reaction and fires a GitHub Actions session (max 59 minutes per session).
3. Agent **immediately opens a branch and a draft PR** — before code is written. The draft PR is the live
   session log, not a deliverable.
4. Agent breaks the issue into a **checklist of tasks** in the PR description. Tasks are checked off as the
   agent completes them — this is the visible plan.
5. Agent writes code, runs available tests and linters, iterates on failures, pushes commits.
6. When complete, the agent tags the assignee for review. The PR moves from draft to open.

**Key design choices:**
- Draft PR created immediately = continuous progress visibility. You can watch in real time or read session logs later.
- Agent cannot merge its own PRs. Branch protections and required checks are enforced by GitHub, not the agent.
- "The person who created the issue can't be the final approver" — separation of concern is enforced at the
  platform level.
- No interactive clarification dialog: if the issue is unclear, the agent proceeds on its best interpretation
  and you see the result in the draft PR. Course-correction happens through PR comments.

**Session continuity:** After human review comments, the agent opens another Actions session to address
feedback. Multiple sessions can accumulate on one PR.

Sources:
- [Copilot coding agent concepts — GitHub Docs](https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent)
- [Assigning issues — GitHub Blog](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/)
- [Idea to PR guide — GitHub Blog](https://github.blog/ai-and-ml/github-copilot/from-idea-to-pr-a-guide-to-github-copilots-agentic-workflows/)
- [Assign to Copilot explained — DEV Community](https://dev.to/thelogicwarlock/assign-to-copilot-explained-what-githubs-coding-agent-actually-does-59g9)

### 2.4 OpenHands (ex-OpenDevin)

Open platform. ICLR 2025 paper. MIT licence. 188+ contributors. Used for SWE-bench evaluation across models.

**Architecture (CodeAct agent):**
- Single unified action space: code + shell + browser. Agent writes and executes Python directly in a
  sandboxed interpreter rather than calling specialised tools. This produces a shorter action vocabulary and
  reduces the number of tool-call schema mismatches.
- **Event stream as single source of truth:** The conversation is an append-only event log. Replaying it
  reconstructs the full state. This enables session resumption and debugging.
- **Configurable sandbox isolation:** LocalWorkspace (no Docker, fast) → DockerWorkspace (isolated, for
  production). Agent code is unchanged; the workspace backend swaps.
- **Hard resource ceilings on day one:** MAX_ITERATIONS (default ~100), LLM_NUM_RETRIES (default 8),
  accumulated-cost cutoff. Headless agents must have all three.

**Model performance on OpenHands Index (Jun 2026):** Claude Opus 4.8 and OpenAI gpt-5.2-codex are clear
leaders across issue resolution, frontend tasks, and unit tests.

Sources:
- [OpenHands paper — ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/file/a4b6ad6b48850c0c331d1259fc66a69c-Paper-Conference.pdf)
- [OpenHands index — openhands.dev](https://www.openhands.dev/blog/openhands-index)
- [OpenHands paper abstract — arXiv:2407.16741](https://arxiv.org/abs/2407.16741)

### 2.5 Claude Code (Anthropic)

Terminal-native; the harness running this workspace. Canonical best-practice source from Anthropic.

**Recommended four-phase workflow:**
1. **Explore** (plan mode — reads only, no writes): read files, understand patterns, answer questions.
2. **Plan** (plan mode): produce a detailed implementation plan listing affected files, change descriptions,
   assumptions, and risks. Human edits the plan in editor (Ctrl+G) before proceeding.
3. **Implement** (default mode): execute against the plan; run tests after each change; iterate on failures.
4. **Commit**: descriptive commit message + PR creation via CLI.

**Self-verification is not optional.** The canonical failure mode: agent produces "looks done" output without a
runnable check. The fix is to always provide a verification target — tests, build exit code, linter,
diff-against-fixture, browser screenshot. The check closes the loop so the agent iterates until it passes
rather than stopping on appearance.

**Plan mode calibration:** Use plan mode for multi-file changes, unfamiliar codebases, architectural
modifications. Skip it for single-file typos, simple log lines — the overhead isn't worth it.

**Clarifying questions:** Anthropic's guidance is to have Claude interview the user for large features via
`AskUserQuestion` before writing a spec, then start a **fresh session** to implement from the spec. This
separates the noisy exploration context from the clean implementation context.

**Reproduce-first in practice:** The best-practices page explicitly recommends: "write a failing test that
reproduces the issue, then fix it" as the symptom-description strategy — using the reproduction test as the
specification.

**Subagent reviewer pattern:** For autonomous runs, use a fresh-context subagent to review the diff against
the plan before declaring done. The reviewer sees only the diff + criteria, not the implementation reasoning —
it evaluates the result on its own terms.

**Long-running harness design (Anthropic engineering):**
- Initialiser agent sets up environment; per-session coding agent makes one-feature-at-a-time progress.
- Feature list with completion criteria prevents premature "job done" declarations.
- Each session: read progress → run baseline test → pick next feature → implement → test → commit.
- Browser automation (Puppeteer) for end-to-end testing dramatically improves performance on UI changes.

Sources:
- [Claude Code best practices — code.claude.com](https://code.claude.com/docs/en/best-practices)
- [Effective harnesses for long-running agents — anthropic.com](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Building effective agents — anthropic.com](https://www.anthropic.com/research/building-effective-agents)

---

## 3. Topic Analysis: Best Practices Relevant to Our Loop

### 3.1 Issue Understanding — When and How to Ask Clarifying Questions

**The data on autonomous operation vs. clarification:**
A study of real Claude Code sessions (SWE-chat, arXiv:2604.20779) found agents proactively ask for
clarification in only **1.1%–2.6% of turns**. Users compensate by pushing back in **39%–44% of turns** and
interrupting in 5%–6% of turns. This is the documented failure of under-asking: agents proceed on
misinterpretations, users must intervene reactively, which is costlier than a well-timed upfront question.

Over-asking is equally documented: Devin's design explicitly states that excessive clarification requests
before acting "slows down the agent faster than anything else." The Anthropic agents guide notes that
AskUserQuestion should only be called for genuine blockers, not for questions the agent could answer by reading
code or documentation.

**The resolution:**
The correct model is **one upfront interview for genuinely underspecified issues, zero clarification during
execution for things the agent can resolve from code**. Claude Code's official pattern: for large features,
use AskUserQuestion to interview the user and produce a spec, then implement the spec in a fresh session with
no more questions. For well-scoped issues, proceed immediately. The spec becomes the authoritative scope
boundary; anything outside it is a separate issue.

**Why this matters for our loop:** Our "plan gate" is the natural place to surface ambiguities from issue
reading. If the plan cannot be written without a human clarification, surface exactly one question at the
plan-gate. Once the plan is approved, ambiguities are resolved by code-reading — not by pausing.

Sources:
- [SWE-chat real-user interactions — arXiv:2604.20779](https://arxiv.org/html/2604.20779v1)
- [Building effective agents — anthropic.com](https://www.anthropic.com/research/building-effective-agents)
- [Devin docs — devin.ai](https://devin.ai/agents101)
- [Claude Code best practices — code.claude.com](https://code.claude.com/docs/en/best-practices)

### 3.2 Reproduce-First / Write the Failing Test First

**Evidence it raises success rates:**
- ORACLE-SWE (arXiv:2604.07789): providing oracle information about the correct file location is the single
  largest performance boost in the study — larger than knowing the correct patch. The implication: localization
  (which a reproduction test anchors) is the binding constraint on success.
- Dynamic Cogeneration paper (arXiv:2601.19066, FSE 2026, Google): agents that generate a failing test
  simultaneously with the fix (cogeneration) outperform those that patch without a reproduction test. The
  failing test provides an explicit behavioural specification that constrains the solution space and reduces
  hallucination-driven patches.
- Anthropic best-practices: explicitly recommends "write a failing test that reproduces the issue, then fix
  it" as the canonical symptom-description pattern.
- SWE-bench production analysis (tianpan.co): "bug fixes with reproducible test cases are reliably solvable"
  — the clearest predictor of agent success in production is whether the issue has a reproducible test case.

**Mechanism:** A failing test is a runnable specification. It converts "agent thinks it understands the bug"
into "agent can verify the bug exists and verify it is gone." Without it, the agent's only signal is the
diff — which looks correct by construction.

**Test overfitting caveat (see §5):** A failing test written against the issue description may be too narrow.
The fix passes the narrow test but breaks adjacent behaviour. Mitigation: write the reproduction test to cover
the described behaviour AND any obviously adjacent paths; run the full test suite after fixing, not just the
new test.

Sources:
- [Dynamic Cogeneration of Bug Reproduction Test — arXiv:2601.19066](https://arxiv.org/pdf/2601.19066)
- [ORACLE-SWE — arXiv:2604.07789](https://arxiv.org/pdf/2604.07789)
- [Agentic coding in production — tianpan.co](https://tianpan.co/blog/2026-04-09-agentic-coding-production-swebench-gap)
- [Claude Code best practices — code.claude.com](https://code.claude.com/docs/en/best-practices)

### 3.3 Plan-Before-Code + Plan Approval

**Does it help?**
All production systems with high reported satisfaction rates use a plan-before-code gate. The evidence is
qualitative (no controlled A/B on this specific axis), but the reasoning is structural: the cost of
misunderstanding scope is front-loaded at plan-review time (one message) vs. back-loaded at
implementation-review time (full re-run). Devin's team explicitly states: "Read the plan. Don't just approve it
to move faster." GitHub Copilot surfaces the plan as a task checklist in the draft PR body.

**How plans are represented:**
- **Devin:** DAG of dependent steps. Each node is a discrete action (read file, install dependency, create
  endpoint, write test). Dependencies are explicit. The user can edit, reorder, or approve.
- **GitHub Copilot:** Flat task checklist in the PR description, checked off as tasks complete. Visible but
  not editable before execution starts.
- **Claude Code:** Natural-language plan listing affected files, change descriptions, assumptions, and risks.
  Editable in an editor (Ctrl+G) before implementation begins.
- **Plan Mode pattern (aipatternbook.com):** Formal components: affected files + change descriptions +
  assumptions + identified risks. Editability before execution is the key differentiator from a post-hoc
  report.

**When to skip it:**
All systems agree: skip plan mode for small, well-understood, single-file changes. The overhead is not worth
it. Claude Code: "If you could describe the diff in one sentence, skip the plan." Devin: well-scoped tasks
with explicit completion criteria don't need a planning checkpoint.

**For our loop:** The plan gate is gate 1. The plan must list: affected files, change description, test
strategy, scope boundary (what is explicitly NOT in this issue). Human approval of the plan is the first
human gate. The plan is editable before execution; after approval it is the authoritative scope contract.

Sources:
- [Plan Mode pattern — aipatternbook.com](https://aipatternbook.com/plan-mode)
- [How Devin AI thinks — Medium](https://medium.com/@nitinmatani22/how-devin-ai-actually-thinks-autonomous-planning-dag-execution-and-dynamic-re-planning-explained-997be175a475)
- [Copilot coding agent — GitHub Docs](https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent)
- [Claude Code best practices — code.claude.com](https://code.claude.com/docs/en/best-practices)
- [Plans vs tasks — openwalrus.xyz](https://openwalrus.xyz/blog/plans-vs-tasks-agent-design)

### 3.4 Code Localization — The Dominant Failure Point

**The evidence:**
Multiple independent analyses across SWE-bench name localization as the primary failure category:
- SWE-EVO (arXiv:2512.18470): agents frequently get stuck during localization; endlessly repeated search
  actions are the clearest behavioural signal of localization failure.
- SWE-bench failure taxonomies (codeant.ai, arXiv:2410.12468): localization failure and incorrect fixes are
  the two dominant categories; localization failure precedes the incorrect-fix category because an incorrectly
  localized agent cannot produce a correct fix.
- ORACLE-SWE: providing the correct file location as oracle input produces the largest single performance jump
  among all oracle signals tested — larger than providing the correct test, larger than providing the
  reproduction steps alone.
- SweRank+/SWE-smith research: improving multilingual, multi-turn localization is an active research frontier
  because it gates everything downstream.

**Why localization fails:**
1. The issue description names symptoms (error message, failing feature) not locations (file, class, method).
2. Repository structure is opaque to a model reading it for the first time.
3. Search commands return noisy results (many files match a symbol name).
4. Agents anchor on the first plausible match rather than verifying it is the right one.

**Mitigations production systems use:**
- **Navigation indexes** (like our `navigation/domains/*.md`): pre-built pointers reduce blind search.
- **Reproduction test as localization anchor:** running the failing test with stack traces points directly to
  the relevant code path.
- **Structured search tooling:** ACI-style tools that return concise, context-limited outputs prevent context
  saturation from verbose grep output.
- **Re-localization as an explicit loop step:** SWE-agent frames re-localization after failed test runs as a
  normal iteration, not a failure state.

**For our loop:** Localization is step 1 of implementation. The agent must cite the file:line it is targeting
before writing a single character of implementation. The reproduction test (§3.2) is the primary localization
signal. Our navigation indexes are the secondary signal. If neither yields a confident file:line, that is the
one case where the agent surfaces a question at the plan gate.

Sources:
- [SWE-bench failure analysis — arXiv:2410.12468](https://arxiv.org/pdf/2410.12468)
- [ORACLE-SWE — arXiv:2604.07789](https://arxiv.org/pdf/2604.07789)
- [Agentic issue resolution survey — arXiv:2512.22256](https://arxiv.org/pdf/2512.22256)
- [SweRank+ localization — arXiv:2512.20482](https://arxiv.org/pdf/2512.20482)
- [Beyond resolution rates — arXiv:2604.02547](https://arxiv.org/pdf/2604.02547)
- [SWE-EVO — arXiv:2512.18470](https://arxiv.org/html/2512.18470v2)

### 3.5 Test Generation + Self-Verification, and the Overfitting Problem

**Self-verification is the single highest-leverage harness design decision:**
Anthropic's engineering blog and best-practices page both treat this as the foundation: give the agent a
runnable check that returns pass/fail. Without it, the agent's stopping condition is "looks done", which means
every mistake waits for a human to notice it. With it, the agent iterates until the check passes.

**Overfitting is real and quantified:**
- Claude 3.7 Sonnet: **21.8%** of patches that pass their generated tests fail hidden golden tests (test
  overfitting study, arXiv:2511.16858).
- GPT-4o: **33.0%** overfitting rate. After refinement, rates worsen (25.5% and 35.9% respectively) because
  refinement against a narrow test makes the patch narrower.
- Mechanism: agents overfit by narrowing their fix to exactly what the generated test exercises, not to the
  full intended behaviour.
- State-of-the-art systems (Passerine/Google, Agentless, AutoCoderRover) all show overfitting — it is not a
  beginner failure mode.

**Mitigation:**
1. **Run the full test suite after fixing**, not just the new test. This catches regressions and adjacent
   breakage. The overfitting study found patches with "median coverage of 1" (narrow) vs. overfitted patches
   with "less than 0.8". The full suite enforces broader coverage.
2. **Do not hide tests from the refinement loop** (this was tested and did not reduce overfitting).
3. **Fresh-context reviewer on the diff** (Anthropic subagent pattern, Devin Critic): an adversarial reviewer
   not involved in the implementation sees only the diff and requirements, not the reasoning that produced it.
4. **The reproduction test is a specification, not a pass condition.** It tells the agent where to look; the
   full suite tells the agent whether the fix is correct.

**The write-tests-before-code pattern for our loop:**
The contributor agent should: (a) reproduce the bug with a failing test, (b) fix the code, (c) run the full
test suite — not just the new test, (d) if any pre-existing test breaks, the fix is wrong. Step (d) catches
overfitting before the PR is opened.

Sources:
- [Investigating test overfitting on SWE-bench — arXiv:2511.16858](https://arxiv.org/html/2511.16858v2)
- [Effective harnesses for long-running agents — anthropic.com](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Dynamic Cogeneration — arXiv:2601.19066](https://arxiv.org/pdf/2601.19066)
- [Claude Code best practices — code.claude.com](https://code.claude.com/docs/en/best-practices)
- [Are solved issues really solved — software-lab.org](https://software-lab.org/publications/icse2026_SWE-bench-correctness.pdf)

### 3.6 PR Conventions

**Empirical data (arXiv:2509.14745, study of 567 agent PRs):**
- Agent PRs are accepted and merged at **83.8%** vs. 91.0% for humans — a meaningful gap, not catastrophic.
- **54.9%** of merged agent PRs require zero modification — comparable to humans (58.5%).
- Agent PR descriptions are substantially longer (**median 355 words vs. 56 words for humans**). This
  verbosity is correlated with reviewer comprehension, not penalised for it.
- Top rejection reasons: alternative solution existed (12.1%), PR was verification-only without a fix (5.5%),
  oversized PR (3.3%). Technical bugs caused only 4.4% of rejections.
- **63.7% of rejections had no explanatory comment** — reviewers silently closed the PR. The implication for
  agent design: descriptive PR bodies reduce silent rejections by giving reviewers context.

**Draft PR as progress-visibility tool:**
All production systems (Copilot, Devin, Claude Code best practices) open a draft PR immediately — not as the
deliverable but as the live progress log. This is distinct from the final PR. The draft PR:
- Shows the agent is working (prevents "did it start?" questions)
- Enables watching session logs in real time
- Provides a natural thread for review comments before the work is complete
- Signals to CI that tests should run early

**Conventions all systems agree on:**
- `Closes #N` or `Fixes #N` in the PR body — links the PR to the issue and auto-closes on merge.
- Descriptive body with: what changed, why, how to test it, any caveats.
- Small, focused diffs. Multi-objective PRs have 40% higher revision rates in the empirical study.
- The agent cannot self-merge. Human approval is mandatory.
- AGENTS.md / CLAUDE.md / project instruction files should encode PR formatting rules so agents produce
  consistent output from the start.

Sources:
- [On the use of agentic coding — arXiv:2509.14745](https://arxiv.org/abs/2509.14745)
- [Copilot coding agent — GitHub Docs](https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent)
- [From idea to PR — GitHub Blog](https://github.blog/ai-and-ml/github-copilot/from-idea-to-pr-a-guide-to-github-copilots-agentic-workflows/)
- [Agents.md best practices — GitHub Gist](https://gist.github.com/0xfauzi/7c8f65572930a21efa62623557d83f6e)

### 3.7 Real Success/Failure Rates and What Drives Them

**The headline numbers (SWE-bench Verified, Jun 2026):**
- #1: Claude Mythos Preview — **93.9%**
- #2: Claude Opus 4.8 — **88.6%**
- #3: Claude Opus 4.7 Adaptive — **87.6%**
- Average across 83 models: **63.4%**

**Critical caveat — benchmark contamination:**
The same model scores 80.9% on SWE-bench Verified but only 45.9% on SWE-bench Pro (which uses private
codebases inaccessible during training). The 35-point collapse is the clearest evidence of training-data
contamination. OpenAI stopped reporting Verified scores in early 2026 for this reason. A METR study found
that developers predicted AI would save 24% of time, but objective measurement showed a **19% increase in
task completion time** — developers still believed it helped, demonstrating persistent perception vs. reality
gap.

**What actually drives success in production:**
From the production gap analysis (tianpan.co):
1. **Narrow scope + clear success criteria** — bug fixes with reproducible test cases, CRUD scaffolding, API
   stubs, test fixtures. The common pattern: "clear starting state, clear ending state, mechanical
   transformation pattern, verifiable output."
2. **Security remediation:** 20x improvement (1.5 min vs. 30 min) when vulnerability pattern is
   well-defined.
3. **Multi-file architectural changes:** where agents fail most; PR review time increased 91% and bugs per
   developer rose 9% in high-AI teams, creating system-level stagnation despite individual velocity gains.

**What the data says about our issue→PR loop:**
Issues that are well-scoped, have a clear reproduction path, and touch a bounded number of files will resolve
reliably. Issues requiring architectural judgment, cross-cutting changes, or implicit product knowledge are
where agents produce plausible-but-wrong patches that cost more in review than the agent saved in
implementation.

**The overfitting discount:** At 21-33% test overfitting rates even in top models, a "benchmark solved" count
overstates real-world resolution. The correct expectation for production: ~60-70% of well-scoped, reproduced
issues result in a correct, mergeable patch with one review cycle.

**Where sources disagree:**
The SWE-bench Verified scores (93.9% top) and the production analysis (19% task time increase) appear to
contradict each other. They do not. They measure different things: Verified measures pass rate on a Python
bug-fix benchmark where training contamination inflates scores. The METR study measures end-to-end developer
productivity on real, diverse, often ambiguous tasks in production codebases. The correct reading: benchmark
scores are upper-bound estimates of capability on well-scoped, well-specified tasks; production performance
depends heavily on scope clarity, issue quality, and the overhead of understanding and verifying agent output.

Sources:
- [SWE-bench leaderboard — awesomeagents.ai](https://awesomeagents.ai/leaderboards/swe-bench-coding-agent-leaderboard/)
- [SWE-bench scores analysis — codeant.ai](https://www.codeant.ai/blogs/swe-bench-scores)
- [Agentic coding in production — tianpan.co](https://tianpan.co/blog/2026-04-09-agentic-coding-production-swebench-gap)
- [SWE-bench Pro leaderboard — labs.scale.com](https://labs.scale.com/leaderboard/swe_bench_pro_public)
- [Test overfitting study — arXiv:2511.16858](https://arxiv.org/html/2511.16858v2)

---

## 4. Synthesis: Decisions This Feeds into the ADR

The five most load-bearing decisions for our contributor-pillar ADR design:

**1. Two human gates, not one: plan-gate + merge-gate (not plan + code-review + merge).**
All production systems that expose a plan gate (Devin, Claude Code, Copilot) confirm it catches scope
misunderstandings when they are cheap to fix. A third "code review" gate between plan-approval and merge
adds overhead without proportionate benefit — the empirical data shows 55% of agent PRs need zero
modification. Our loop is: issue scope → plan (human gate 1) → reproduce + code + tests → CI-green PR
(human gate 2: merge). Gate 2 is merge-approval, not re-approval of decisions already in the plan.

**2. Reproduce-first is mandatory, not optional.**
Write the failing test before touching source. This is the primary localization anchor, the specification
for the fix, and the overfitting detector (run the full suite, not just the new test). Without a reproduction
test, the agent has no runnable success criterion and no way to distinguish "fixed" from "seems fixed." Every
production system with high satisfaction rates uses this pattern explicitly.

**3. Plan format must include: affected files + scope boundary (what is OUT of scope).**
The dominant rejection reason for agent PRs is "alternative solution existed" or "oversized PR" — both are
scope failures. The plan must include explicit scope exclusions so reviewers can verify at plan-gate that the
agent will not silently absorb adjacent work. Affected files are cited by name before implementation starts.

**4. Draft PR opened immediately; agent cannot self-merge; CI must be green before human gate 2.**
This is the Copilot/Devin consensus. Draft PR from the first commit = visible progress = early CI signal =
natural thread for feedback. "CI-green" is a non-negotiable precondition for the merge gate — the agent must
iterate on CI failures before requesting human review, not after. Human gate 2 is a judgment review (scope
adherence, design quality), not a mechanical defect hunt.

**5. Issue scope predicts outcome more than model capability.**
For our limited maintainer capacity, issue triage is the highest-leverage activity. Well-scoped issues with
clear reproduction paths resolve reliably. Ambiguous, multi-file, architectural issues should be triaged as
"needs human decomposition" before the contributor agent touches them. The benchmark-vs-production gap is
not a model failure — it is an issue-quality failure. ADR design should encode scope gates at the triage
step, not only at the implementation step.
