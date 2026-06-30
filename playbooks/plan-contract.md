---
playbook: plan-contract
status: active
since: 2026-06-30
applies_to: universal (wired to pillar:contributor first — any plan presented at a human plan-gate)
---

# PROTOCOL plan-contract

A plan presented for human approval is a **falsifiable contract**, not prose, and it is **adversarially verified before the human sees it**. The contract is `must_haves` — the user-observable truths the change must deliver, the artifacts that deliver them, and the wiring that connects them. The verification is a fresh-context, assume-it's-flawed plan-check (`.claude/agents/plan-checker.md`) that runs **goal-backward** and must PASS (no open BLOCKERs) before GATE 1.

This exists because **the maintainer is not the QA gate** (`CLAUDE.md`): a plan that the human has to debug at GATE 1 has offloaded verification we could have done ourselves. The contract makes the plan checkable; the adversarial check catches the silent failure (a missing requirement, an unwired artifact, a scope reduction) before it reaches the human. Pattern: gsd-core `planner-guidance` (the `must_haves` shape, goal-backward) + `gsd-plan-checker` (the adversarial verifier).

## trigger

Fire when a plan is being finalised for a human plan-gate — for `/contribute`, **every** slice plan before GATE 1 (G-C3), after `spec-gate.md` (the WHAT) and `design-before-build.md` (the HOW). Also fires for any `/implement` batch plan substantial enough that a wrong plan is expensive.

## inputs

- The **spec** (`spec-gate.md` output) — the falsifiable WHAT + acceptance criteria.
- The **design** (`design-before-build.md` output) — reuse-scan, ADR-check, impact checklist, PO/SRE lens.
- The ontology + source for the affected area (`/retrieve`, `concepts.yaml`, `navigation/domains/`).

## procedure

### 1. Derive `must_haves` goal-backward (outcome → artifacts → wiring)

Start from what must be TRUE for a user when the slice is done; work back to the files and the connections. Do **not** start from "files I'll touch" — that is forward planning and it loses the goal.

```yaml
must_haves:
  truths:                 # user-observable; a human can verify each by driving the running system.
    - "Clearing the query (✕ or empty-Enter) returns the unfiltered result set"
    - "A shared search URL re-runs as the recipient, under the recipient's permissions"
  artifacts:              # each truth's required files. path + what it provides + a content anchor.
    - path: "odd-platform-ui/src/components/Search/Search.tsx"
      provides: "URL↔state sync on the search-page mount path"
      anchor: "useSearchParams"            # a grep-able marker the executor must produce
    - path: "...Repository.java"
      provides: "the ranked query over the unified index"
      anchor: "asset_search_entrypoint"
  key_links:              # the wiring — where it breaks if missed. from → to → via.
    - from: "Search.tsx"
      to: "the search session thunk"
      via: "stateToRoute/routeToState debounced over useSearchParams, loop-guarded"
    - from: "the unified-index query"
      to: "each kind's live list query"
      via: "page-sized semi-join (FavoriteAssetResolver template)"
```

**Rules for the contract:**
- **Truths are user-observable, never implementation facts.** ✗ "the index table exists" / "the thunk is added"; ✓ "search returns terms and data-entities in one ranked list". An implementation fact is an *artifact*, not a *truth*.
- **Every truth traces to a spec acceptance criterion.** A truth with no spec line is scope creep; a spec line with no truth is a coverage gap.
- **key_links name where it breaks** — the component that renders but never fetches, the endpoint created but never called, the index written but never queried. This is the wiring the plan-checker hunts for.

### 2. Structure the tasks — specific, sized, no scope reduction

- **Specificity test:** could a *different* instance execute each task without asking a clarifying question? If not, add the `file:line`, the exact endpoint shape, the exact component. (gsd: "Add JWT auth with refresh rotation using jose, httpOnly cookie, 15min/7day" — not "add auth".)
- **Each task carries Files + Action + Verify + Done.** Verify is a runnable command; Done is a measurable acceptance line. A task whose verify is absent or whose action is "implement X" is incomplete.
- **Size within budget.** A slice plan that needs **>3–5 files** or **>2–3 distinct tasks** is over a single context window's quality budget → that is a `decompose-epic.md` signal, not a bigger plan. Split.
- **No scope reduction — banned in any task action:** `v1`, `v2`, `simplified`, `static for now`, `hardcoded for now`, `placeholder`, `basic version`, `minimal`, `will be wired later`, `stub`, `skip for now`, "too complex/hard" used to justify omission. If the spec says deliver X, the plan delivers X; if it's too big, **split the slice** — never silently ship a shadow of the decision. (This is the single most insidious failure mode — the plan "looks compliant" by mentioning the decision while delivering a fraction.)

### 3. Run the adversarial plan-check — fresh context, before the human

Spawn `.claude/agents/plan-checker.md` (a separate context; it assumes the plan is flawed and proves it goal-backward). Pass it: the plan (with `must_haves`), the spec, the design, the ADR(s) for the area, and `CLAUDE.md`. It returns **VERIFICATION PASSED** or **ISSUES FOUND** with each issue classed **BLOCKER** (the slice goal will not be achieved) or **WARNING** (quality/maintainability).

- **Any BLOCKER → revise the plan and re-check.** Loop ≤ 3×.
- **WARNINGs** are recorded in the plan and surfaced at GATE 1; they do not block.
- Record the plan-check verdict in the work record (CTRIB `## Plan-check` section) — the evidence that the plan was verified, not just written.

### 4. Only a PASS plan reaches GATE 1

The human GATE 1 (G-C3) approves a plan that already carries `must_haves` and a plan-check PASS. The human is approving *intent and product-fit*, not debugging *coverage and wiring* — those are machine-checked. Open research questions must all be `RESOLVED` (the plan-checker blocks on an unresolved one).

## exit

- The plan carries a `must_haves` block: truths (user-observable, each → a spec acceptance line), artifacts (path + provides + anchor), key_links (from → to → via).
- Every task has Files + Action + Verify + Done and passes the specificity test; no banned scope-reduction language; the slice is within context budget.
- `.claude/agents/plan-checker.md` returned **VERIFICATION PASSED** (no open BLOCKER); the verdict is recorded in the work record.
- All research open-questions are `RESOLVED`.

## on-fail

- **A BLOCKER will not clear in 3 loops** → the plan is wrong or the slice is too big. Escalate: re-spec (`spec-gate.md`) or split (`decompose-epic.md`); do not hand a known-broken plan to the human.
- **A `must_have` truth can't be made user-observable** → it is an implementation detail; move it to `artifacts` and find the real user-facing truth it serves.
- **The plan needs scope reduction to fit** → split the slice; never ship a `v1`/`static` shadow of an approved decision.
- **The plan-checker can't run** (no fresh context available) → at minimum, self-run its dimensions against the plan and record the result; note that the independent check is owed, the same way `/review` is owed on the diff.

## case-law

- `retrospectives/LSN-040-contribute-frontloop-bug-shaped.md` — #1825: the only pre-code check was the human at GATE 1 reading prose; no falsifiable contract, no adversarial check. This protocol moves coverage/wiring/scope-reduction detection off the maintainer and onto a machine pass.
- `feedback_linus_torvalds_engineering_bar` + `CLAUDE.md` "the maintainer is not the QA gate" — first-time-right is owed before the human, not by the human.
- `retrospectives/LSN-035` (the missed PO/SRE lens + en-only i18n caught at review) — coverage gaps belong at planning; the plan-checker's impact/compliance dimensions catch them there.
- Source: gsd-core `gsd-core/references/planner-guidance.md` (the `must_haves` / goal-backward worked example) + `agents/gsd-plan-checker.md` (the adversarial dimensions + scope-reduction-is-always-BLOCKER rule).
