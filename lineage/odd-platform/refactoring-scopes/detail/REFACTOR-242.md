## REFACTOR-242 — `LineageDepth.empty()` semantics are call-site folklore — the `empty` flag is never read; only the `-1` value matters

**Severity**: LOW
**Category**: misleading-API (call-site folklore)
**Surfaced by**:
- `ReactiveLineageRepositoryImpl.md:bugs_limitations_corner_cases[7]`

**Description**: `LineageDepth.empty()` (`LineageDepth.java:16-18`) returns `new LineageDepth(-1, true)` — a `(int depth, boolean empty)` record where the `empty` flag is set to `true` and the `depth` is `-1`. The class is consumed by `ReactiveLineageRepositoryImpl.lineageCte` (lines 150-176).

**The `boolean empty` flag is NEVER read inside `lineageCte`**. Only the depth integer is consumed. The recursive step's termination condition is `tDepth.lessThan(lineageDepth.getDepth())` (line 174); for `LineageDepth.empty()` (depth = -1), the condition `tDepth.lessThan(-1)` is FALSE on the first iteration (depth starts at 1), so recursion terminates with seed-only output.

The class therefore has TWO paths to "terminate immediately":
- `LineageDepth.empty()` — depth = -1, `empty = true`
- `LineageDepth.of(0)` — depth = 0, `empty = false` (also `tDepth.lessThan(0)` = FALSE on iteration 1)

Both produce the same seed-only result. The `boolean empty` flag is documentation; it doesn't drive behaviour.

**The name `empty()` is misleading**: a caller reading the code at `DataEntityRelationsServiceImpl.java:34` (`getLineageRelations(set, LineageDepth.empty(), kind)`) would plausibly read it as "zero edges returned" — the natural meaning of `empty()`. The actual behaviour is "seed-only", i.e. the direct edges touching the root oddrn set (which IS non-empty if those edges exist). A maintainer adding a new caller of `LineageDepth.empty()` could reasonably expect zero edges and be surprised by the seed rows.

The wisdom-test verdict is GAP (not ADR): there is no comment defending the asymmetry. The `boolean empty` field appears to be vestigial — possibly a maintainer's intent at an earlier design iteration to make `lineageCte` consult the flag, but the consultation never happened. The class signature now lies about its semantics.

**Primary source citations**:
- `LineageDepth.java:16-18` — `empty()` factory returns `new LineageDepth(-1, true)`
- `LineageDepth.java:12-14` — `of(int)` factory accepts any int
- `ReactiveLineageRepositoryImpl.java:151-176` — `lineageCte` (does NOT read the `empty` flag)
- `DataEntityRelationsServiceImpl.java:34` — the sole production caller of `LineageDepth.empty()`
- `LineageServiceImpl.java:96` — the typical `LineageDepth.of(N)` caller

**Existing-ADR-or-implied-prescription**: implicit — the project's API style is "the public method name describes the result". `empty()` returning "seed-only-edges" violates that style.

**Proposed remedy**: Two paths:
1. **Rename + remove the dead flag** (preferred): rename `empty()` to `seedOnly()` to accurately describe the behaviour; remove the unused `boolean empty` field from the record. Update the sole caller. Add Javadoc explaining the seed-only semantic explicitly:
   ```java
   /**
    * Returns a LineageDepth that produces ONLY the seed edges (the direct
    * edges touching the root oddrn set) when used in a recursive lineage
    * traversal. Equivalent to passing depth=0 to the CTE.
    *
    * <p>Used by {@link DataEntityRelationsServiceImpl#getDependentOddrns} for
    * one-hop owner-scoped subgraph expansion.</p>
    */
   public static LineageDepth seedOnly() { return new LineageDepth(0); }
   ```
2. **Make the flag actually drive behaviour** (more disruptive): change `lineageCte` to consult `empty` and return `Flux.empty()` (truly no edges) when set. This matches the original `empty()` name but changes the production behaviour of the sole caller — likely undesirable.

Option (1) is preferred. The rename is breaking for any external consumer of `LineageDepth.empty()`, but verified at primary source: the only caller is `DataEntityRelationsServiceImpl.java:34`. One-line caller update.

**Severity rationale**: LOW — naming clarity. No data-loss, no security, no current bug. The cost is future-maintainer confusion + the risk of a wrong-mental-model bug on a future feature.

**Suggested backlog grouping**: `Code-quality cleanup` — bundle with REFACTOR-241 (the misleading OR-predicate; same class of "code-literal-vs-mental-model" gap).

## STRENGTHENS — Batch M (`getMyObjectsWithUpstream` + `getMyObjectsWithDownstream` — controller-method PRIMARY-SOURCE confirms the sole production-caller risk + the new ADR-CANDIDATE-118 codifies the architectural SCOPE decision)

**Primary-source confirmation at DataEntityRelationsServiceImpl.java:34 from the TWO controller-method angles**. Batch M's two controller-method sidecars (`getMyObjectsWithUpstream.md` + `getMyObjectsWithDownstream.md`) name `LineageDepth.empty()` as the single-hop-bound choice for both lineage variants — both endpoints route through `DataEntityRelationsServiceImpl.java:34` which is the sole production caller of the `empty()` factory.

**New batch-M evidence**:

1. **`getMyObjectsWithUpstream.md:bugs_limitations_corner_cases.[6]`** (LOW): "**LineageDepth.empty() is fragile encoding — depth=-1 is sentinel, not unlimited.** The current `getLineageRelations` implementation guards the recursive branch via `tDepth.lessThan(lineageDepth.getDepth())` (`ReactiveLineageRepositoryImpl.java:174`). With `LineageDepth.empty()` (`depth=-1`), the guard becomes `tDepth < -1` (never true) and the recursive UNION ALL never fires — single-hop. But a maintainer reading only `lineageRepository.getLineageRelations(oddrns, LineageDepth.empty(), ...)` at `DataEntityRelationsServiceImpl.java:34` could reasonably misinterpret `empty()` as 'no depth limit / unlimited recursion' rather than 'single-hop only'. The class-level `boolean empty` field at `LineageDepth.java:10` is the explicit disambiguation, but it is consulted only at the CTE-construction site, not anywhere that reads the field name."

2. **`getMyObjectsWithDownstream.md:bugs_limitations_corner_cases.[5]`** (LOW): "**`LineageDepth.empty()` sentinel is not honored by the recursive CTE.** Per batch-H DOC-GAP-105 finding, the recursive CTE at ReactiveLineageRepositoryImpl.java:174 uses only the `int depth` field via `tDepth.lessThan(lineageDepth.getDepth())`. The `boolean empty` flag (set to `true` by `LineageDepth.empty()`) is never read by the CTE. The current behaviour (recursion terminates after seed step when depth=-1) depends on the SQL semantics of `lessThan(-1)`, NOT on an explicit `if (empty) return seed` branch. A future refactor changing the termination predicate to `lessThanOrEqual` would silently expand this endpoint to two hops without any test catching it — because the `empty()` semantic is encoded only by the magic `-1` integer, not by a dedicated code path."

**New ADR-CANDIDATE-118 (batch M) codifies the architectural decision**: The ADR (NEW batch M) frames the single-hop scope choice for the `/my/upstream` + `/my/downstream` endpoints as the deliberate architectural pattern that THIS REFACTOR's implementation gap does not defend. The ADR endorses the SCOPE choice (single-hop is appropriate for the home-page Recommended panel use case); this REFACTOR catches the IMPLEMENTATION gap (sentinel-encoded; `boolean empty` field vestigial; a single line change to the CTE termination predicate silently doubles the scope). The two artefacts together describe the FULL surface: the architectural decision is sound, the implementation encoding is fragile.

**Architectural refinement**: REFACTOR-242's fix (option 1: rename `empty()` to `seedOnly()` + remove the dead `boolean empty` field) is now load-bearing for TWO production callers (the UPSTREAM + DOWNSTREAM siblings), not one. The sole-caller-update calculus from the original REFACTOR-242 needs to count BOTH `getMyObjectsWithUpstream` and `getMyObjectsWithDownstream` as the contract change scope; the rename touches `DataEntityRelationsServiceImpl.java:34` (the single call site) which both endpoints route through, so the change remains one line at the caller side. The ADR-CANDIDATE-118 NEW must be updated when the rename lands to reflect the new factory name.

**Cross-link to ADR-CANDIDATE-118 NEW**: The ADR's accept-the-risk clause names this gap — "the implementation gap (sentinel encoding) is a known maintainability cost but does not invalidate the architectural decision." The maintainer's triage: keep the encoding (accept future-refactor risk) OR rename + remove dead field (cost: factory-name change, ADR update).

**Severity unchanged**: LOW (naming clarity / future-maintainer risk; not a current bug).

---
