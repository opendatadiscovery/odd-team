## REFACTOR-592 — `palette.runStatus[status].color` (`DataQualityContent.tsx:48`) throws an uncaught TypeError and BLANKS THE WHOLE `/data-quality` DASHBOARD if the backend ever returns a `DataEntityRunStatus` outside the 6-member enum; the `?? palette.dataQualityDashboard.unknown` fallback is mis-written defensive code (it guards a missing `.color` on a PRESENT entry, not a missing entry)

**Severity**: HIGH
**Category**: buggy-default / latent-crash
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityContent.md:bugs_limitations_corner_cases.[0]` (HIGH) — |-
    "**`palette.runStatus[status].color` (line 48) throws an uncaught TypeError and blanks the whole dashboard if the backend returns a run-status outside the `DataEntityRunStatus` enum.** `testResultsBreakdownChartData` does `palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown` (`DataQualityContent.tsx:47-48`). `palette.runStatus` is a `Record<DataEntityRunStatus, ItemColors>` (`interfaces.ts:55`) — keyed by exactly the 6 enum values. If `status` is any other string (a new backend enum value not yet in the generated frontend types, a stale generated-sources build, or malformed data), `palette.runStatus[status]` is `undefined` and `.color` throws BEFORE the `??` is evaluated — the `??` guards a missing `.color` on a PRESENT entry, not a missing entry. The error propagates out of the `useMemo` and crashes the component tree."

**Description**: `DataQualityContent.tsx:47-48` builds the Test Results Breakdown donut by mapping each `(status, count)` pair from `calcTestResultsBreakdown` into a chart slice and looking up the slice colour via:

```ts
color: palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown,
```

The TypeScript type system says `palette.runStatus: Record<DataEntityRunStatus, ItemColors>` (`interfaces.ts:55`) — a total map over the SIX enum values `SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | UNKNOWN` (`components.yaml:1407-1415`). At runtime the input to the bracketed lookup is the `status` field of a `DataQualityRunStatusCount` row from the backend; nothing in the runtime data path enforces the enum membership the type claims — the JSON payload is just a string. Three plausible production paths produce an out-of-enum `status`:

1. **Backend adds a 7th `DataEntityRunStatus` value** (e.g. `RETRYING`, `QUEUED`) before the frontend's `generated-sources` is rebuilt — the JSON carries the new string but the frontend type and the `palette.runStatus` keys do not know about it. Result: `palette.runStatus['RETRYING']` is `undefined`, `.color` throws `TypeError: Cannot read properties of undefined (reading 'color')`, the `useMemo` fails, React unmounts the parent — the entire dashboard goes white. There is no error boundary at this node (per `DataQuality.tsx` `bugs_limitations_corner_cases.[1]`); the only visible UI is `AppLoadingPage` indefinitely or the React error overlay in dev.
2. **Stale generated-sources build** — a developer who runs the UI off a stale `generated-sources` against a fresher backend hits the same crash.
3. **Malformed backend data** — a serialisation bug or a hand-crafted curl test that submits a non-enum status reaches the same code path.

The `?? palette.dataQualityDashboard.unknown` fallback was *intended* as the defence, but it is mis-written: `??` (nullish-coalescing) chains AFTER the `.color` property access has already thrown. The fallback would help if the code were `(palette.runStatus[status] ?? palette.dataQualityDashboard.unknown).color` — but the parenthesisation puts the fallback in the WRONG place. The dead `?? unknown` makes the surrounding code LOOK safer than it is; a reader skimming the file would miss the trap.

**Wisdom-test classification**: GAP. (1) Intentional? NO — the `?? unknown` fallback proves the author was thinking about the out-of-enum case and INTENDED to handle it; the bug is that the parenthesisation defeats the intent. (2) Structural impact? NO — fixing it is a one-line parenthesisation change; no architectural decision is being made; the contract (six enum values, one colour each) is unchanged. (3) Refactoring or structural? REFACTORING — the fix is to move the `??` outside the property access: `(palette.runStatus[status] ?? palette.dataQualityDashboard.unknown).color`. → Refactoring scope.

**Same risk does NOT apply to siblings**: `tableHealthData` / `tableMonitoredTables` (`DataQualityContent.tsx:53-73`) read fixed `palette.dataQualityDashboard` keys (`healthy`, `warning`, `error`, `monitored`, `notMonitored`), not status-indexed lookups, so they cannot trip the same TypeError.

**Primary source citations**:
- `DataQualityContent.tsx:47-48` (the unsafe indexed access + the dead `??` fallback)
- `interfaces.ts:55` (`RunStatus = Record<DataEntityRunStatus, ItemColors>` — the type that promises totality but does not enforce it at runtime)
- `components.yaml:1407-1415` (the 6-value `DataEntityRunStatus` enum the type and the palette are keyed against)
- `DataQualityContent.tsx:43-51` (the `useMemo` whose throw propagates out of the component tree)
- `DataQuality.tsx:bugs_limitations_corner_cases.[1]` (the absence of an ErrorBoundary at the route-entry node — the throw propagates without recovery)

**Existing-ADR-or-implied-prescription**: none — no ADR prescribes "all UI-side enum-indexed lookups must use the index-then-fallback pattern not the property-then-fallback pattern." The defensive intent is local; the bug is local; this is a clean refactoring scope.

**Proposed remedy**: Two-line change at `DataQualityContent.tsx:47-48`:

```ts
// Before (buggy):
color: palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown,
// After (correct):
color: (palette.runStatus[status] ?? palette.dataQualityDashboard.unknown).color,
```

Add a unit test asserting the component renders without throwing when given a `DataQualityResults` with a `results[].status` value outside `DataEntityRunStatus` (e.g. `'RETRYING'`). Also: consider lifting this pattern to a small `runStatusColor(status: string): string` helper that does the safe lookup once — the same pattern is repeated in the legend (`DataQualityContent.tsx:83-89`), at `TestCategoryResults.styles.ts:33` (`theme.palette.runStatus[$status].color` — same shape, same risk on the per-tile rendering path), and would be reused on any future per-status visual element.

Defence-in-depth: at the slightly larger refactor level, add a React `ErrorBoundary` around the dashboard subtree (currently absent — per `DataQuality.tsx:bugs_limitations_corner_cases.[1]`) so that even a future runtime exception in any of the three donuts or the per-category cards degrades the dashboard gracefully rather than blanking the page.

**Severity rationale**: HIGH. The bug is dormant TODAY (no backend path produces an out-of-enum status), but the activation pre-condition is "any change to the backend `DataEntityRunStatus` enum without coordinated frontend regen" — a routine evolution change. When activated, the operator-visible consequence is the **entire `/data-quality` dashboard goes blank** — not "wrong number," not "missing tile," but full-page unmount. This is the LSN-001 shape (LSN-001-attachment-ephemeral-default): a one-line maintainer-intent error whose latent activation is an operator-evident production failure. The same class of bug also exists per-tile at `TestCategoryResults.styles.ts:33` — fixing one without the other leaves the per-tile path exposed.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` (alongside REFACTOR-593..617) — this is the highest-priority entry in the cluster. Group with the missing-ErrorBoundary defence-in-depth follow-up.

---
