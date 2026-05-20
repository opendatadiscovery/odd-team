## REFACTOR-575 — `ActivityServiceImpl.getActivityHandler` linear-scan + Spring bean-discovery ordering ambiguity — `stream().filter().findFirst()` silently first-wins; a future duplicate-handler addition compiles, deploys, and routes events to the wrong impl with no warning

**Severity**: LOW (latent regression risk; no production defect today)
**Category**: misleading-code
**Surfaced by**:
- `ActivityHandler.md:bugs_limitations_corner_cases[1]` (CANARY HEADLINE — "Linear handler dispatch + Spring `@Component` ordering ambiguity: `ActivityServiceImpl.getActivityHandler` uses `stream().filter().findFirst()`. If two handlers ever respond `true` for the same `ActivityEventTypeDto`, Spring bean discovery order determines which wins, with no validation, no @Order annotation, no startup warning. A future PR adding a duplicate handler would compile, deploy, and silently route events to the wrong impl" — MEDIUM)
- `ActivityHandler.md:stress_findings.S-B-2` ("the contract does NOT enforce mutual exclusivity. `DatasetFieldInformationUpdatedActivityHandler:26-30` returns true for THREE event types (DESCRIPTION/TAGS/INTERNAL_NAME) via `||` chain... The dispatcher uses `stream().filter().findFirst()` — silently first-wins on bean ordering. The name `isHandle` does not signal this ambiguity")
- `ActivityServiceImpl.java:260-264` (the dispatcher)
- `DatasetFieldInformationUpdatedActivityHandler.java:26-30` (the canonical multi-event handler — `||` chain pattern)

**Description**: `ActivityServiceImpl.getActivityHandler` (`:260-264`):

```java
private ActivityHandler getActivityHandler(ActivityEventTypeDto eventType) {
  return handlers.stream()
    .filter(handler -> handler.isHandle(eventType))
    .findFirst()
    .orElseThrow(() -> new RuntimeException(
      "Can't find handler for event type " + eventType.name()
    ));
}
```

`handlers` is a `List<ActivityHandler>` auto-wired by Spring (per `ActivityServiceImpl.java:41` field declaration). Spring's component-scan + bean-instantiation produces the list in an order that is:
- Deterministic per-JVM (depends on package scan order, class-loader behaviour).
- NOT guaranteed stable across (a) JVM versions, (b) build-system changes, (c) classpath ordering.

The `.findFirst()` operator returns the FIRST handler whose `isHandle(eventType)` returns true. If TWO handlers ever respond `true` for the same event type, the bean-ordering determines which wins.

**The current state**: 18 concrete handlers, each `isHandle(...)` returns true for a non-overlapping subset of event types. No duplicates today (verified by inspection — each event type maps to exactly one handler). The `||` chain pattern in multi-event handlers (e.g. `DatasetFieldInformationUpdatedActivityHandler:26-30` handles 3 types) DOES NOT introduce overlap, only multi-coverage by a single handler.

**The latent risk**: a future developer adds a new handler that overlaps with an existing one. For example:
- Existing: `DescriptionUpdatedActivityHandler` handles `DESCRIPTION_UPDATED`.
- New (developer doesn't realise): `DataEntityDescriptionV2Handler` (intended replacement) ALSO returns `true` for `DESCRIPTION_UPDATED`.

The PR compiles. Tests pass (no test enforces handler uniqueness per event type). The deployed system dispatches DESCRIPTION_UPDATED to whichever handler Spring instantiates FIRST — undefined. The new handler may or may not be reached.

**Operator-visible consequence under the latent risk**:
- Audit-trail content silently misattributed: a field that should be diffed by handler A is diffed by handler B (different diff algorithm).
- Operators investigating "why does the audit row look weird" find no error log; both handlers are valid; the dispatch is invisible.
- Diagnosing the issue requires reading the source code AND running the dispatch manually to identify which handler matches.

**The structural fix**: detect duplicates at boot. Spring provides `@PostConstruct` validation; the activity service can iterate handlers × event types and assert exactly-one-match per type.

**Cross-cutting context**: This is the **autowired-list-without-uniqueness-validation defect class**. Standard Spring pattern: define a uniqueness assertion at bean-init. The risk surface is widespread in any codebase using `List<X>` autowiring for dispatcher patterns.

**Primary source citations**:
- `ActivityServiceImpl.java:260-264` (the dispatcher — verified `stream().filter().findFirst()`)
- `ActivityServiceImpl.java:41` (the `List<ActivityHandler> handlers` field)
- `DatasetFieldInformationUpdatedActivityHandler.java:26-30` (the `||` chain pattern)
- 18 concrete handler classes verified by inspection — currently no event-type overlap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-202 (NEW from this batch — "Linear-scan handler dispatch tolerates multi-event-type handlers via `||` chain"). The maintainer's intent is to allow multi-event handlers (one handler claims multiple types) — confirmed by the `||` chain pattern. The GAP: no DEFENCE against multi-handler-claiming-same-type.

**Proposed remedy**:

```java
// Add to ActivityServiceImpl as @PostConstruct:
@PostConstruct
public void validateHandlerUniqueness() {
  Map<ActivityEventTypeDto, List<ActivityHandler>> dispatch = new EnumMap<>(ActivityEventTypeDto.class);
  for (ActivityEventTypeDto eventType : ActivityEventTypeDto.values()) {
    List<ActivityHandler> claimants = handlers.stream()
      .filter(h -> h.isHandle(eventType))
      .toList();
    if (claimants.size() > 1) {
      throw new IllegalStateException(
        "Event type " + eventType + " has multiple claimants: " 
          + claimants.stream().map(h -> h.getClass().getName()).toList()
      );
    }
    if (claimants.isEmpty()) {
      // OK — event type may be intentionally without handler (e.g. system-only types)
      log.debug("Event type {} has no handler", eventType);
    }
  }
}
```

The fail-fast on duplicate prevents the regression class.

**Severity rationale**: LOW — latent regression risk; no production defect today. Severity is bounded by:
- No current handler-duplication exists.
- The fix is small (one boot-time validator).
- The error message is loud + diagnosable.
- The regression class is bounded to "future developer adds a colliding handler".

**Suggested backlog grouping**: `Code clarity sprint`. Pair with REFACTOR-555 (handler name-vs-contract drift), REFACTOR-574 (default-throw multi-id). The three together are the "ActivityHandler interface hardening" cluster.

---
