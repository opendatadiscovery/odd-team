## REFACTOR-291 — Sequential dual-fetch contract is FRAGILE under partial failures: `HierarchyLineage.tsx:54-66` issues downstream first then upstream via `.then()` chain; if downstream returns 500, upstream NEVER fires; user sees single error with no recovery path

**Severity**: MEDIUM
**Category**: race-condition + deferred-failure + error-mapping
**Pillars affected**: [P-05] — Data Lineage
**Surfaced by**:
- `LineageGraph.md:bugs_limitations_corner_cases[4]` (|-
    "**Sequential fetch contract is fragile under partial failures** — HierarchyLineage.tsx:54-66 issues downstream first, then `.then()` upstream — if downstream returns 500 (e.g. F-005 NPE), upstream NEVER fires. The Redux error state for downstream surfaces via `downstreamError` selector (line 77), but `upstreamError` is null because the fetch never ran; the user sees a single error but the UI cannot recover by just retrying upstream. Failure is binary: either both succeed (canvas renders) or AppErrorPage shows.")

**Description**: The Lineage tab's mount effect at `HierarchyLineage.tsx:54-66` fires the two lineage fetches sequentially via promise chaining:
```ts
useEffect(() => {
  dispatch(fetchDataEntityDownstreamLineage({...}))
    .unwrap()
    .then(() => dispatch(fetchDataEntityUpstreamLineage({...})))
    .then(() => { /* optional group expansions */ })
}, [d, dataEntityId]);
```

The shape has three failure modes:
1. **Downstream 5xx → upstream NEVER fires** — the `.then()` chain breaks on the first rejected promise; the upstream dispatch is skipped entirely. The user sees the downstream error in the AppErrorPage; the upstream tree is empty because nothing was fetched. Retry semantics are unclear: the user can refresh the page (re-fires both) but cannot retry only upstream.
2. **Upstream 5xx after downstream success → downstream rendered, upstream errored** — the canvas shows the downstream tree + the AppErrorPage banner; the visual is inconsistent (half-rendered).
3. **Both fail → user sees the FIRST error only** — downstreamError populated, upstreamError null (never ran); AppErrorPage surfaces downstream's status; the user doesn't know upstream also failed.

The alternative architectures:
- **Parallel fetch** (`Promise.all([downstream, upstream])`) — halves the wait time but failures are independent; the canvas can render the successful side.
- **Sequential with error recovery** — current chain but retry upstream if downstream fails (defensive).
- **Single unified endpoint** — backend returns both directions in one response; UI fires one fetch.

The current sequential-chain choice prioritises ERROR LOCALISATION (one error path, one AppErrorPage) over PARALLEL THROUGHPUT and PARTIAL RECOVERY. The trade-off is observable but undocumented.

**Primary source citations**:
- `HierarchyLineage.tsx:44-67` — the `.then()` chain
- `LineageGraph.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-093 codifies the two-direction independent layouts but is silent on the fetch sequencing. No ADR prescribes sequential-vs-parallel.

**Proposed remedy**: Two options:
1. **Promise.all** — parallelise; on failure, render the surviving direction (downstream-only or upstream-only canvas) with a toast indicating the missing side. Trade-off: more complex error UI.
2. **Sequential with retry** — keep the chain but add a single retry attempt on each dispatch. Trade-off: marginal improvement.

Option (1) is the structural fix; option (2) is the defensive patch. Option (1) requires deciding how to render half-canvases (a real UX decision).

**Severity rationale**: MEDIUM — user-facing UX gap; affects every lineage tab fetch with partial backend failures. Fix is structural (option 1) or defensive (option 2).

**Suggested backlog grouping**: `Lineage subsystem UX hardening sprint`.

---
