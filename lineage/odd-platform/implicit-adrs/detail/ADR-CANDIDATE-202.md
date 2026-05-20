## ADR-CANDIDATE-202 — Linear-scan handler dispatch (`stream().filter().findFirst()`) over `List<ActivityHandler>` is the chosen idiom — tolerates multi-event-type handlers (`DatasetFieldInformationUpdatedActivityHandler` handles 3 events via `||` chain) at the cost of O(N) dispatch and silent first-wins on Spring bean ordering

**Severity**: LOW
**Classification**: promote (new — implementation-pattern decision worth codifying)
**Support count**: 2 sidecars (`ActivityHandler` PRIMARY-SOURCE + `ActivityServiceImpl` confirms via the dispatch site)
**Axes present**: dispatch-pattern, autowired-list, multi-event-handler-tolerance
**Pillars affected**: P-01 — activity-audit dispatch

**Surfaced by**:
- `ActivityHandler.md:implicit_adrs[1]` (PRIMARY-SOURCE — "**Linear handler-list dispatch (vs. map-based)**: `ActivityServiceImpl.getActivityHandler` (`:260-264`) iterates `List<ActivityHandler>` calling `isHandle()` rather than maintaining a `Map<ActivityEventTypeDto, ActivityHandler>`. The decision tolerates multi-event-type handlers (`DatasetFieldInformationUpdatedActivityHandler` handles 3 events) at the cost of O(N) dispatch and silent handler-order ambiguity if two handlers claim the same event" — confidence: MEDIUM)
- `ActivityServiceImpl.md:stress_findings.S-E-4` (CONTEXT — "`getActivityHandler` linear-scan with RuntimeException on miss — `handlers.stream().filter(...).findFirst().orElseThrow(...)`")
- `ActivityServiceImpl.java:260-264` (verified the dispatch)
- `ActivityServiceImpl.java:41` (the autowired `List<ActivityHandler> handlers` field)
- `DatasetFieldInformationUpdatedActivityHandler.java:26-30` (the canonical multi-event handler — `||` chain pattern for 3 event types)

**Decision statement**: The platform's activity-handler dispatch uses linear-scan iteration over an autowired `List<ActivityHandler>`:

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

This pattern is DELIBERATE — it tolerates handlers that claim MULTIPLE event types via the `||` chain in their `isHandle()` body:

```java
// DatasetFieldInformationUpdatedActivityHandler.java:26-30
@Override
public boolean isHandle(ActivityEventTypeDto eventType) {
  return eventType == DATASET_FIELD_DESCRIPTION_UPDATED
      || eventType == DATASET_FIELD_TAGS_UPDATED
      || eventType == DATASET_FIELD_INTERNAL_NAME_UPDATED;
}
```

This single handler implementation services THREE distinct event types. The dispatch via `List<ActivityHandler>` + `isHandle()` boolean check is the natural fit for this many-to-one mapping.

**The alternative — `Map<ActivityEventTypeDto, ActivityHandler>` — was REJECTED**:
- Map-based dispatch requires each handler to declare exactly ONE event type (or to register multiple keys for the same handler).
- The current linear-scan pattern allows a handler to declare its dispatch logic inline (the `||` chain), with no separate registration.
- The O(N=18) dispatch cost is negligible at current scale.

**The trade-off (the cost paid for the flexibility)**:
- O(N) dispatch per activity emit (currently 18 handlers; would degrade if extended to 50-100).
- Silent first-wins behaviour: if two handlers ever return `true` for the same event type, Spring bean-discovery order determines which wins (per REFACTOR-575).
- No compile-time check for uniqueness.

**The maintainer accepted these costs in exchange for**:
- Multi-event-handler flexibility (the `||` chain idiom).
- Simpler handler registration (just declare `@Component`; no Map registration).
- Clearer single-handler-file pattern (one .java file per handler-cluster).

**Wisdom test (3-question)**:
1. *Intentional?* MEDIUM-YES — the `||` chain pattern in `DatasetFieldInformationUpdatedActivityHandler` is explicit and not accidental — the handler PROVIDES the flexibility the linear-scan dispatch consumes. The chosen idiom is observable, but no comment explicitly defends the design over Map alternatives.
2. *Structural impact?* PARTIAL — affects every activity-emit dispatch. Wide blast radius across the @ActivityLog framework's 18+ business methods.
3. *Refactoring or structural?* PARTIALLY STRUCTURAL — replacing with Map-based dispatch is a refactor that breaks the multi-event-handler flexibility (would require either splitting handlers or maintaining a registry).

→ ADR (with the borderline confidence noted).

**Evidence**:
- `ActivityHandler.md` says: "Linear handler-list dispatch (vs. map-based) — tolerates multi-event-type handlers (`DatasetFieldInformationUpdatedActivityHandler` handles 3 events) at the cost of O(N) dispatch"
- `DatasetFieldInformationUpdatedActivityHandler.java:26-30` — verified the `||` chain.
- `ActivityServiceImpl.java:260-264` — verified the linear-scan dispatch.
- intent_anchor: the `||` chain pattern + the linear-scan dispatch — the two parts of the same design.

**Existing ADR**: NEW (codifies an implementation-detail pattern). Composes with:
- ADR-CANDIDATE-200 (NEW from this batch — ActivityHandler is a state-snapshot differ; read-only contract) — composes: the dispatch is for read-only handlers; the pattern is consistent.
- ADR-CANDIDATE-202 itself adds the dispatch-mechanism detail.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-574 (NEW from this batch — default-throw multi-id `getUpdatedState`) — the gap: the dispatch tolerates multi-event handlers, but the multi-ID variant of `getUpdatedState` has 16 of 18 throwing defaults. Latent regression risk.
- REFACTOR-575 (NEW from this batch — linear-scan dispatch + Spring bean-discovery ordering ambiguity) — the gap: no boot-time uniqueness validation. The proposed fix: add a `@PostConstruct` validator.

**Proposed action**: Promote to `adrs/drafts/activity-handler-linear-scan-dispatch.md` OR fold into ADR-CANDIDATE-200 as a sub-section. Document:
- The linear-scan dispatch pattern.
- The multi-event-handler tolerance (the `||` chain).
- The trade-off framing.
- The cross-link to REFACTOR-575 (the proposed uniqueness validator).
- The future-design hook: if N grows past 100 handlers, Map-based dispatch may become necessary.

**Severity rationale**: LOW — implementation-pattern decision. Severity is bounded by:
- Current scale (N=18) is well within linear-scan cost.
- The flexibility advantage IS observable (one multi-event handler today).
- The proposed validator (REFACTOR-575) closes the regression risk.

**Cross-pillar bump**: P-01 — activity-audit only. Severity stays LOW.

**Suggested backlog grouping**: ADR draft (fold into ADR-200 or standalone). Pair with REFACTOR-574 + REFACTOR-575 (the actionable gaps).

---
