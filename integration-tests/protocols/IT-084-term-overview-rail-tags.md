---
id: IT-084
title: "Term Overview right-rail tag chips render important-first; empty rail offers Add tags"
gates:
  validates: [F-156]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:term-overview-rail-tags.spec.ts"
plan_ref: I9
status: ready
---

# IT-084 — Term Overview right-rail tag chips (importance-first sort)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
The term Overview right-rail renders the term's assigned tag chips with importance-first ordering
(important chips precede non-important; alphabetical within each group) at ≤20 tags (F-156 UC-002);
a term with no tags shows the actionable empty state with an inline "Add tags" affordance (UC-008).
If this regresses, operators lose the at-a-glance priority signal on a term's tags.

Source: F-156 UC-002 / UC-008 (`OverviewTags.tsx:20-26,47-49,93-96`, `TagItem.tsx`).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` running at `http://localhost:18080` (`ODD_STACK_EXTERNAL=1` for a shared stack).
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default).
- **Seed data** (ids 20840–20849; names prefixed `it084_`):
  1. namespace `it084_ns`; term `it084_TaggedTerm`.
  2. tag `it084_zzz_important` (important=TRUE) + tag `it084_aaa_plain` (important=FALSE), both linked
     via `tag_to_term(tag_id, term_id)`. **Order trap**: the important tag is alphabetically LAST so a
     correct importance-first sort puts it FIRST — the opposite of alphabetical — proving the sort.
  3. term `it084_UntaggedTerm` with no `tag_to_term` rows (empty-state corner).

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `SELECT count(*) FROM tag_to_term tt JOIN term t ON t.id = tt.term_id WHERE t.name = 'it084_TaggedTerm'` → 2.

## 4. Run protocol — what to run
1. Navigate `/terms/{TaggedTerm.id}/overview`; await `GET /api/terms/{id}`.
2. Read the two tag chips' rendered order (compare bounding-box position: top, then left).
3. Navigate `/terms/{UntaggedTerm.id}/overview`; read the empty Tags rail.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/term-overview-rail-tags.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: both chips render AND the important chip (`it084_zzz_important`) is positioned BEFORE
  the plain chip (`it084_aaa_plain`) in the DOM. AND: the untagged term renders the Tags heading + an
  "Add tags" affordance and no chip.
- **FAIL** when: the plain chip precedes the important chip (sort wrong), a chip is missing, or the
  empty rail shows no Add-tags affordance.

> DEFERRED — the slice-then-sort bug (F-156 facet
> `tags_slice_then_sort_ordering_bug_important_tags_silently_hidden`, `OverviewTags.tsx:47-49`) hides
> an important tag only when it lands at API-payload index ≥20. VERIFIED (2026-06 live probe of
> `GET /api/terms/{id}.tags`): the backend returns tags in NON-DETERMINISTIC order, so an e2e cannot
> deterministically force the important tag past index 20 — a pin here would flake. This bug belongs
> in a unit test rendering `OverviewTags` with a fixed 21-tag array (F-156 `test_matrix.unit` GAP);
> it is intentionally NOT pinned at the e2e layer.

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-084.md`.

## Cross-references
- Source: F-156 UC-002 / UC-008 (deferred bug facet: slice-then-sort)
- Plan: `lineage/odd-platform/test-plan.md` batch I9
- Automation spec: `integration-tests/e2e/specs/term-overview-rail-tags.spec.ts`
