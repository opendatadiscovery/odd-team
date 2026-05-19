## REFACTOR-249 — `AlertServiceImpl.getTotals` uses `Mono.zipDelayError` (vs `Mono.zip`); changing to eager-abort would silently change user-facing 5xx behaviour

**Severity**: LOW (current behaviour is defensible; doc-warning gap)
**Category**: silent-feature-ignored
**Surfaced by**:
- `AlertServiceImpl.md:bugs_limitations_corner_cases[8]`

**Description**: `AlertServiceImpl.getTotals` (line 104) composes the three count queries with `Mono.zipDelayError(allCount, countByOwner, countDependent)`. The semantic difference from `Mono.zip` is:
- `zip` fires all inputs in parallel; the FIRST failure aborts the others and propagates immediately.
- `zipDelayError` fires all inputs in parallel; ANY failure delays propagation until ALL inputs complete (success or failure), THEN propagates a composite failure.

The user-facing consequence: under `zipDelayError`, if `countDependentObjectsAlerts` fails (e.g. on a malformed lineage graph), the user sees a 500 even though `allCount` and `countByOwner` would have succeeded. The badge counter's "All" tab would have worked fine, but the API call returns 500 holistically.

Today's behaviour is DEFENSIBLE — the badge counter's three numbers are conceptually one render, and partial-state badges would confuse operators (one tab shows a count, the other shows error). The maintainer chose all-or-nothing.

A future refactor to `Mono.zip` (eager-abort, fail-fast) would change the user-facing behaviour:
- Faster failure surfacing (no waiting for the other two queries to complete).
- Different error trace (the first-to-fail leg is the primary error; the other legs are no longer cancelled and may continue to consume connection-pool slots until they complete or are cancelled by R2DBC).
- Potentially different latency profile on the success path (no change) vs the failure path (faster).

The gap is purely documentation — the current behaviour is correct; the absence of a code comment explaining why `zipDelayError` was chosen over `zip` makes the choice fragile. A maintainer reading the code with no context may switch to `zip` as a "performance improvement" and silently change the failure mode.

**Primary source citations**:
- `AlertServiceImpl.java:104` — `Mono.zipDelayError(allCount, countByOwner, countDependent)`
- Reactor docs for `zipDelayError` vs `zip` semantic difference
- contrast with `DataEntityServiceImpl.enrichEntityClassDetails` (`DataEntityServiceImpl.java:513-532`) which uses plain `Mono.zip` — different reasoning for that surface (enrichment legs are independent and the slowest leg determines latency)

**Existing-ADR-or-implied-prescription**: none. Composes with the platform's reactive-pipeline patterns. No ADR defends `zipDelayError` placement.

**Proposed remedy**: Add a code comment at line 104 explaining the choice:
```java
// zipDelayError (not zip): the badge counter renders three numbers as one logical
// unit; partial-state failures would produce a confusing UI (one tab showing a
// count, another showing error). The cost: a failure in any leg delays the
// composite error by the slowest-still-running leg.
return Mono.zipDelayError(allCount, countByOwner, countDependent) ...
```

Alternatively, add an ADR fragment to ADR-CANDIDATE-056 (zip-merge enrichment) documenting the `zip` vs `zipDelayError` choice criterion for the project: "prefer `zip` for independent legs (enrichment, parallel fetches); prefer `zipDelayError` for composite renders that must be all-or-nothing."

**Severity rationale**: LOW — current behaviour is correct; no operator-visible defect today. The gap is the absence of a defending comment that prevents a future maintainer from silently changing the failure mode.

**Suggested backlog grouping**: `Code-comment hygiene sprint` — bundle with similar comment-absence findings (REFACTOR-244 observability, the various deferred-feature comments). Cheap, additive.

---
