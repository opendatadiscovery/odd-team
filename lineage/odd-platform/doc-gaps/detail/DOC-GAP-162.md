- **DOC-GAP-162**: `LineageDepth.empty()` sentinel encoding — `LineageDepth.java:16-18` returns `new LineageDepth(-1, true)` (depth=-1, empty=true); the recursive-CTE termination predicate at `ReactiveLineageRepositoryImpl.java:174` is `tDepth.lessThan(lineageDepth.getDepth())` which short-circuits when depth=-1 because the seed step's tDepth=0 is NOT less than -1; the `boolean empty` flag is NEVER READ by the CTE — the "one hop only" semantic is encoded by the MAGIC -1 INTEGER, not by an explicit `if (empty) return seed` branch; a future refactor changing the termination predicate to `lessThanOrEqual` would silently expand `/my/upstream` and `/my/downstream` endpoints (and any other call site of `getLineageRelations` with `LineageDepth.empty()`) to TWO hops without a test catching the change; the design is fragile and undocumented in any operator-facing or developer-facing surface (MEDIUM; new fragile-sentinel-encoding finding on the lineage design)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithUpstream.md:bugs_limitations_corner_cases.[6]` (LOW — sentinel naming clarity gap) **(NEW batch M)**
    - `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithDownstream.md:bugs_limitations_corner_cases.[5]` (LOW — sentinel not honoured by recursive CTE) **(NEW batch M)**
    - `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithUpstream.md:implicit_adrs.[1]` (HIGH — single-hop semantic encoded via magic -1)
    - `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithDownstream.md:implicit_adrs.[2]` (MEDIUM — `LineageDepth.empty()` is a deliberate factory but the CTE ignores the flag)
    - Cross-batch: batch-H `ReactiveLineageRepositoryImpl.md` (the primary source for the CTE termination predicate; this finding's MEDIUM severity rises from cross-batch composition of LOW-individually findings)
  - **Evidence**:
    - `LineageDepth.java:8-19` — verbatim class:
      ```
      public class LineageDepth {
          private final int depth;
          private final boolean empty;

          public static LineageDepth of(int depth) {
              return new LineageDepth(depth, false);
          }

          public static LineageDepth empty() {
              return new LineageDepth(-1, true);
          }
      }
      ```
      The `boolean empty` field exists at line 10; the only call site that uses it (the CTE termination predicate) consults only `getDepth()`.
    - `ReactiveLineageRepositoryImpl.java:174` — termination predicate (per batch-H sidecar): `tDepth.lessThan(lineageDepth.getDepth())`. The recursion fires only while `tDepth < depth`. With `depth=-1`, the predicate is `tDepth < -1` which is FALSE at every step (seed's tDepth=0 is NOT less than -1). The recursion terminates after the seed step yielding only the one-hop neighbours of the anchor.
    - `DataEntityRelationsServiceImpl.java:34` — verbatim call site: `lineageRepository.getLineageRelations(oddrns, LineageDepth.empty(), streamKind)`. The `empty()` factory is the contract; the maintainer relied on the magic -1 as the sentinel that the CTE check would naturally short-circuit.
    - **The fragility**: a maintainer changing `ReactiveLineageRepositoryImpl.java:174` to `tDepth.lessThanOrEqual(lineageDepth.getDepth())` (a one-character edit) silently changes the semantic from "single-hop" to "two-hop" for every `LineageDepth.empty()` call site. The change passes all existing tests (there are zero tests on this sentinel path per batch-K + batch-M sidecars). The change passes code review (the diff looks like a defensive boundary fix; readers without the sentinel context don't see the implication).
    - The `boolean empty` field is the explicit disambiguation that the maintainer intended; the existence of `empty()` as a NAMED factory method (vs `of(-1)`) is the structural evidence of intent. But the CTE doesn't honour the distinction. A future refactor that ADDS a defensive `if (lineageDepth.isEmpty()) return seedOnly()` branch would BOTH (a) make the design intent explicit AND (b) close the silent-refactor-vulnerability.
  - **Proposed doc action**: **Two-part action**.
    1. **Code-side primary** (file `/log-issue odd-platform`): refactor `ReactiveLineageRepositoryImpl.getLineageRelations` to consult the `empty` flag explicitly: `if (lineageDepth.isEmpty()) { return seedQuery; }` BEFORE the recursive CTE construction. The change is structurally clearer than the current magic-sentinel pattern and prevents the silent-refactor vulnerability. ALSO: add a regression test pinning `LineageDepth.empty()` to single-hop behaviour for the `/my/upstream` and `/my/downstream` endpoints.
    2. **Doc-side optional**: add a developer-guide note (or inline `@docs` annotation on `LineageDepth.empty()`) documenting the single-hop semantic: "`LineageDepth.empty()` indicates a single-hop traversal — the recursion terminates after the seed step. Encoded as `(depth=-1, empty=true)`; the CTE termination predicate `tDepth < depth` naturally short-circuits because the seed's tDepth=0 is not less than -1. A future refactor to `lessThanOrEqual` would change this semantic — pin the behaviour via the regression test." This is purely internal-developer-facing; the operator-facing doc surface is unaffected.
  - **Cross-references**:
    - DOC-GAP-105 (lineage recursive-CTE primary source — no cycle guard, no upper bound, no owner JOIN) — sibling lineage-area finding on the SAME repository method; the depth handling has been documented at multiple angles, but the sentinel encoding for `empty()` is a NEW axis not previously captured
    - DOC-GAP-099 (`getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` inverse-semantic OpenAPI summary) — the sentinel is what makes "single-hop only" hold for both endpoints; if the sentinel breaks, the OpenAPI summary's claim of "dependencies" silently extends to two hops
    - DOC-GAP-115 (Lineage anchor-set defence-in-depth asymmetry) — sibling lineage-area finding; the sentinel encoding interacts with the anchor-set scope question
    - DOC-GAP-167 META (NEW batch M — REV-3 LAYER-0 P-05 Data Lineage sub-feature overpromise) — pillar-level cross-cut
  - **Severity rationale**: MEDIUM — the encoding works correctly today; the gap is fragile-design + silent-refactor-vulnerability + zero test coverage. The code-side fix is a 3-line refactor that closes the gap structurally. The MEDIUM severity reflects the composition of the LOW-individually findings across two batch-M sidecars (UPSTREAM + DOWNSTREAM) plus the batch-H repository-layer evidence. The doc-side action is optional (developer-guide note, not operator-facing); the code-side action is the load-bearing recommendation.
