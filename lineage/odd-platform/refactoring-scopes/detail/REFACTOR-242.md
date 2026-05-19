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

---
