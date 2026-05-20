## REFACTOR-282 — Permission-gating placement is FRAGILE — `<WithPermissions>` wraps ONLY mutation affordance buttons, not content; a refactor "simplifying" the structure by hoisting the wrapper could silently break legitimate cross-owner read access OR expose mutation buttons to non-editors

**Severity**: MEDIUM
**Category**: refactor-risk + missing-test
**Pillars affected**: [P-01, P-02, P-04, P-05, P-06, P-07, P-08, P-09] — every UI cluster with edit-affordance gating
**Surfaced by**:
- `DataEntityDescription.md:security.known_security_gaps[2]` (|-
    "**Permission-gating placement is fragile** — `<WithPermissions>` wraps ONLY the Edit button, not the Markdown render. A junior developer 'cleaning up' the cluster by hoisting the wrapper to the parent could silently hide descriptions from non-editors (breaking cross-owner read collaboration) OR drop the gate entirely (exposing the Edit button to non-editors who could then hit the backend and receive a 403). Neither failure mode is caught by a test (zero UI tests exist).")
- `DataEntityDescription.md:bugs_limitations_corner_cases.partial-permission-gating` (cross-reference)

**Description**: The button-only placement convention (codified in ADR-CANDIDATE-089) means `<WithPermissions>` wrappers are positioned around mutation buttons but NOT around content renders. This placement is subtle enough that refactor scenarios silently break invariants:

**Failure mode A — wrapper hoisted to gate the cluster**:
```tsx
// BEFORE (correct):
<>
  <Markdown value={value} />  // unconditional render — preserves cross-owner read
  <WithPermissions permissionTo={DATA_ENTITY_DESCRIPTION_UPDATE}>
    <EditButton />  // gated
  </WithPermissions>
</>

// AFTER (hoisted refactor — silently broken):
<WithPermissions permissionTo={DATA_ENTITY_DESCRIPTION_UPDATE}>
  <Markdown value={value} />  // NOW gated — hides descriptions from non-editors!
  <EditButton />
</WithPermissions>
```
Result: legitimate cross-owner readers (the read-collaborative posture) lose visibility into other owners' entity descriptions. The system's documented behaviour breaks.

**Failure mode B — wrapper removed under "simplification"**:
```tsx
// AFTER (wrapper-removed refactor — silently broken):
<>
  <Markdown value={value} />
  <EditButton />  // NOW exposed to non-editors!
</>
```
Result: non-editors see the Edit button. Clicking it sends a request that the backend correctly 403s — but the UI surfaced an affordance the user can't use. Trust erodes.

**Failure mode C — wrapper consumes wrong permission**:
```tsx
// AFTER (typo refactor):
<WithPermissions permissionTo={DATA_ENTITY_VIEW}>  // wrong key
  <EditButton />
</WithPermissions>
```
Result: every viewer sees the Edit button regardless of edit permission.

NONE of these failure modes is caught by any test, because ZERO UI tests exist (REFACTOR-289). The placement is the maintainer's discipline + code-review attention; there is no structural defence.

**Primary source citations**:
- `DataEntityDescription.md` documents the gap with all three failure modes
- The lack of any `*.test.tsx` file with permission-gating assertions

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-089 codifies the button-only placement. The placement IS the prescription; the absence of regression-testing is the gap.

**Proposed remedy**: Three-layer defence:
1. **Test suite for permission gating** — a `<WithPermissions>` test that mounts each gated cluster with mock `usePermissions` and asserts the visibility of the button + the visibility of the content. The test pins the partial-gating invariant.
2. **Lint rule** — an ESLint custom rule that flags `<WithPermissions>` wrapping a `<Markdown>` or `<Component>` whose name suggests content (e.g. `*Preview`, `*View`, `*Render*`). Catches Failure mode A.
3. **Comment in the cluster** — a defending comment near every `<WithPermissions>` documenting "this gates the EDIT button only; the content render is UNCONDITIONAL by read-collaborative posture (ADR-CANDIDATE-089)."

**Severity rationale**: MEDIUM — silent refactor-risk gap; the failure modes are all reachable by routine simplification refactors. Fix is layered: tests + lint + comments.

**Suggested backlog grouping**: `UI test coverage bootstrap` + `Authorization audit batch`.

---
