## REFACTOR-555 — `ActivityHandler` interface name-vs-contract drift — the verb "handle" promises side-effect mutation but the contract is read-only state-snapshot differ; developers reading the dispatcher expect to find the source of writes, find diff orchestration instead

**Severity**: MEDIUM-HIGH
**Category**: name-behaviour-drift
**Surfaced by**:
- `ActivityHandler.md:stress_findings.S-B-1` (CANARY HEADLINE — NAME-BEHAVIOUR PAIR — "the interface name `ActivityHandler` implies write-handling; the contract is read-only state snapshotting")
- `ActivityHandler.md:implicit_adrs[0]` ("state-snapshot differ pattern over write-handler pattern" — the deliberate read-only stance)
- `ActivityHandler.md:concepts.entities.ActivityHandler` (`ActivityHandler.java:9-22`) — 4 methods, ALL read-only: `isHandle()` boolean, `getContextInfo()` Mono, `getUpdatedState()` Mono single-id, `getUpdatedState()` Mono multi-id
- `ActivityServiceImpl.md:stress_findings.S-E-4` (the dispatcher's `getActivityHandler` lookup-by-name; the dispatcher framing reinforces the name promise)
- `ActivityAspect.java:81-95` — the diff orchestration lives OUTSIDE the handler in the aspect; the handler does NOT do the write

**Description**: The interface `org.opendatadiscovery.oddplatform.service.activity.handler.ActivityHandler` (`ActivityHandler.java:9-22`) is named with the verb "handle" — which in standard Java idiom (per `javax.servlet.http.HttpServlet.handle()`, Spring's `HandlerInterceptor.handle()`, AWS Lambda's `RequestHandler.handleRequest()`) implies "perform the side-effect, mutate, do the work". A developer reading the dispatcher dispatch `List<ActivityHandler>` reasonably expects to find the write site here.

The actual contract is the OPPOSITE: all four methods are READ-ONLY state observers:
- `isHandle(eventType)` → boolean dispatch question
- `getContextInfo(parameters, dataEntityId)` → `Mono<ActivityContextInfo>` PRE-mutation snapshot
- `getUpdatedState(parameters, dataEntityId)` → `Mono<String>` POST-mutation snapshot (JSON-serialized)
- `getUpdatedState(parameters, List<Long>)` → `Mono<Map<Long, String>>` POST-mutation snapshot (batch)

The actual write happens OUTSIDE the handler — at `ActivityServiceImpl.createActivityEvent` (`:50`, `saveReturning`). The handler is dispatched TWICE by `ActivityAspect.postActivity` (`:81-95`): once before the wrapped business method to capture `oldState`, once after to capture `newState`. The diff (`info.getOldState().equals(newState)` filter at `ActivityAspect.java:86`) is computed in the aspect, NOT in the handler.

**Operator-visible consequence**: a developer extending the `@ActivityLog` framework to a new event type — say, adding a side-effect like "emit a Slack notification when a status changes" — would reasonably look at `ActivityHandler` for the write extension point, find no `void handle()` method, and either (a) add side-effects to the read-only `getUpdatedState` (wrong layer, breaks transactional semantics), (b) misunderstand the architecture and create an inconsistent pattern elsewhere, or (c) take longer to find the actual write site (`ActivityServiceImpl.createActivityEvent` / `ActivityAspect.postActivity`). The name is structurally misleading.

**Cross-cutting context (LSN-019 connection)**: This finding IS the second VAL-LSN-019 canary case. The first canary (Tag — `listMostPopular`) surfaced a name-vs-contract drift; this Activity canary surfaces the same class at an interface level. The Stress Protocol's Category B is doing what it was designed to do: surface name-promise vs implementation drift that descriptive readings miss.

**Primary source citations**:
- `ActivityHandler.java:9-22` (the read-only interface — verify: 4 method signatures, ALL return-type `Mono<X>` or `boolean`, NO `Mono<Void>`, NO `void` return)
- `ActivityServiceImpl.java:50` (`activityRepository.saveReturning` — the actual write, OUTSIDE the handler)
- `ActivityAspect.java:48-95` (the orchestration around the handler: pre-mutation capture line 48, business mutation line 62, post-mutation capture line 82, diff line 86, write line 94)
- `ActivityServiceImpl.java:260-264` (the dispatcher — names the lookup `getActivityHandler` which reinforces the "handler" framing)
- The 18 concrete implementations under `service/activity/handler/*.java` — each consistently provides only read-only methods

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-200 (NEW from this batch — "ActivityHandler is a state-snapshot differ (read-only) intentional posture") codifies the read-only stance as intentional. ADR-CANDIDATE-067 (`@ReactiveTransactional` boundary asymmetry) is the broader transactional commitment. The intent IS clear from the code; the failure is the misleading name.

**Proposed remedy**: Rename the interface from `ActivityHandler` to one of:
- `ActivityStateDiffer` (most accurate — captures the snapshot-diff role)
- `ActivityStateSnapshotProvider` (most descriptive)
- `ActivityDiffSource` (shortest)

Update:
1. The interface name in `service/activity/handler/ActivityHandler.java`.
2. The 18 concrete implementations' `implements` clause.
3. The Spring auto-discovery in `ActivityServiceImpl.java:41` (`List<ActivityHandler> handlers` → `List<ActivityStateDiffer> diffSources`).
4. The dispatcher method name `ActivityServiceImpl.getActivityHandler` (`:260`) → `ActivityServiceImpl.getStateDiffer`.
5. The local variable in `ActivityAspect.postActivity` (line 82-94 referencing the handler).
6. The handler-package directory rename to `service/activity/diff/` (optional but consistent).
7. The `@ActivityLog` JavaDoc and any inline comments that reference "handler".

Side-effect: improves discoverability for future maintainers. The rename is mechanical refactor (~20 file changes, no behaviour change, fully testable as no-op via integration test).

**Severity rationale**: MEDIUM-HIGH — the name-vs-contract drift is exactly what LSN-019 (Stress Protocol) was designed to catch. The blast radius is "future maintainer confusion + extension-point misuse" — not a runtime defect, but a structural quality issue that compounds over time. A future contributor adding a new event-type handler is most likely to hit this confusion FIRST when scoping the change. The fix is mechanical and high-leverage; the cost of NOT fixing it is paid by every future maintainer extending the `@ActivityLog` framework.

**Suggested backlog grouping**: `Code clarity sprint` — bundle with REFACTOR-559 (the Tag-tier name-vs-contract drift from VAL-LSN-019), the LSN-019-canary-class findings, and any future Stress Protocol Category-B findings. The two-canary-validation of LSN-019 supports a focused renaming sprint.

---
