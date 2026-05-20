## REFACTOR-273 — `LineageServiceImpl.getRelationsForEntities` JVM-stack recursion (no TCO); wide-DEG components can stack-overflow

**Severity**: LOW
**Category**: refactor-risk
**Surfaced by**:
- `LineageServiceImpl.md:bugs_limitations_corner_cases[6]`
- `LineageServiceImpl.md:performance.known_performance_gaps[3]`

**Description**: `LineageServiceImpl.getRelationsForEntities` (lines 218-233) is tail-recursive in STRUCTURE — recursion is the final statement (line 232: `getRelationsForEntities(established, newOddrns, ...)`). But Java does NOT have tail-call optimisation (TCO); each recursive call adds a stack frame. The method is the BFS-frontier walk used by `establishDEGRelations` (lines 200-216) to partition a DEG's edge graph into per-member connected components.

The recursion depth equals the number of BFS-frontier expansions — typically the component's DIAMETER, not its SIZE. For a path-graph component of length 1000+, this approaches the default JVM stack limit (~512KB / ~5000 frames depending on JVM and OS).

In production lineage graphs, component diameters are typically < 100 hops. But the platform does not enforce this:
- DEGs with thousands of members are not structurally prevented.
- A DEG built from a long Airflow DAG with no parallel branches would have a path-graph component.
- Combined: a future operator creating a DEG with a long-tail lineage chain could trigger StackOverflowError at canvas-render time.

The blast radius is bounded by DEG membership at line 61 (`getDEGEntitiesOddrns`) — only entities in the requested DEG participate. The platform does not impose a DEG-size cap.

The fix shape is iterative-vs-recursive: rewrite the BFS as a loop with an explicit queue, eliminating the stack growth. The change is mechanical.

**Primary source citations**:
- `LineageServiceImpl.java:218-233` — the recursive method (recursion at line 232)
- `LineageServiceImpl.java:200-216` — `establishDEGRelations` (the caller pattern)
- Java tail-call optimisation absence (well-known JVM characteristic)
- composes with ADR-CANDIDATE-083 (DEG-lineage per-MEMBER stream — the architectural design that USES this BFS pattern)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-083 codifies the per-MEMBER stream model that requires the BFS partitioning. The recursion-vs-iteration choice is an implementation detail; the fix is refactoring within the architecture.

**Proposed remedy**: Rewrite as iterative BFS:
```java
private Map<String, Set<LineagePojo>> getRelationsForEntities(
    Set<String> initialOddrns,
    List<LineagePojo> relations) {
  final Map<String, Set<LineagePojo>> established = new HashMap<>();
  final Deque<String> queue = new ArrayDeque<>(initialOddrns);
  final Set<String> visited = new HashSet<>(initialOddrns);
  while (!queue.isEmpty()) {
    final String oddrn = queue.poll();
    final Set<LineagePojo> connected = relations.stream()
        .filter(r -> r.getChildOddrn().equals(oddrn) || r.getParentOddrn().equals(oddrn))
        .collect(toSet());
    established.put(oddrn, connected);
    connected.stream()
        .flatMap(r -> Stream.of(r.getChildOddrn(), r.getParentOddrn()))
        .filter(o -> !visited.contains(o))
        .forEach(o -> { visited.add(o); queue.offer(o); });
  }
  return established;
}
```

The iterative form has no stack growth. Add a regression test exercising a path-graph component of length 10000 to pin the no-stack-overflow contract.

**Severity rationale**: LOW — no observed bug; the gap is a soft limit on DEG size. Production deployments don't have DEGs that big today.

**Suggested backlog grouping**: `Lineage scalability sprint` — pair with REFACTOR-207 (CTE no cycle detection), REFACTOR-208 (no streaming response), REFACTOR-202 (no depth ceiling). The set together describes the lineage subsystem's scaling concerns.

---
