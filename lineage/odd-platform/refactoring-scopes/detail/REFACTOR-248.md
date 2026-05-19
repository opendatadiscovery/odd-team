## REFACTOR-248 — `ExternalAlert.startsAt` is `LocalDateTime` (timezone-naive); the embedded Prometheus query URL points to a time window keyed by SERVER local time, not the alert's UTC timestamp

**Severity**: MEDIUM
**Category**: timezone-implicit
**Surfaced by**:
- `AlertServiceImpl.md:bugs_limitations_corner_cases[7]`

**Description**: `AlertServiceImpl.handleExternalAlerts` formats `externalAlert.getStartsAt()` via `ALERT_MANAGER_TIME_FORMATTER` (pattern `yyyy-MM-dd HH:mm:ss`, line 67-68) and uses the result in the `g0.moment_input` / `g0.end_input` query parameters of the embedded generator URL (lines 162-172). The `ExternalAlert.startsAt` field is declared as `LocalDateTime` (`ExternalAlert.java:14`) — Jackson's default `LocalDateTime` deserialisation reads the RFC3339 timestamp from AlertManager's payload and SILENTLY STRIPS the timezone offset.

AlertManager's webhook payload carries timezone info (RFC3339 with offset, e.g. `2026-05-19T14:30:00Z` or `2026-05-19T16:30:00+02:00`). The deserialised `LocalDateTime` represents the wall-clock time in some implicit zone — typically interpreted as the JVM's default zone (system property `user.timezone`), which on a Kubernetes pod is usually UTC but on a developer machine is local.

The consequence: the URL embedded in the alert chunk description points to a Prometheus query window keyed by the SERVER's local time, not the alert's actual timestamp. Operators clicking the link may see NO data because the query window is off by the JVM's timezone offset.

This is the same class of bug as the `ExternalAlert.LocalDateTime` finding originally surfaced as REFACTOR-032 (referenced from ADR-CANDIDATE-014's co-surfaced gaps) — the present finding is the SERVICE-TIER primary source confirming the consequence chain at the URL-construction site.

**Primary source citations**:
- `AlertServiceImpl.java:67-68` — `private static final DateTimeFormatter ALERT_MANAGER_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")` (pattern carries NO timezone)
- `AlertServiceImpl.java:162-172` — the URL construction embedding the formatted timestamp
- `ExternalAlert.java:14` — `private LocalDateTime startsAt;` (timezone-naive type)
- cross-reference REFACTOR-032 (the original timezone-naive finding from ADR-CANDIDATE-014's co-surfaced gaps)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-014 (AlertManagerController is hand-coded, NOT OpenAPI-generated) explains the loose DTO; the gap is the missing type discipline. The fix is refactoring within the existing structure.

**Proposed remedy**: Three composable fixes:
1. **Use `OffsetDateTime` instead of `LocalDateTime`** — change `ExternalAlert.startsAt` from `LocalDateTime` to `OffsetDateTime`; Jackson will deserialise the RFC3339 timestamp WITH the offset preserved. The URL construction then uses `OffsetDateTime.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)`.
2. **Explicit timezone in the formatter** — if `LocalDateTime` must be retained for compat, use `DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ssXXX").withZone(ZoneOffset.UTC)` to anchor the format string to UTC; the URL then explicitly uses UTC regardless of the JVM zone.
3. **Test pinning** — add a `WebFluxTest` that POSTs an AlertManager-shaped payload with a non-UTC timestamp (`2026-05-19T16:30:00+02:00`) and asserts the resulting chunk URL points to UTC `2026-05-19T14:30:00Z`. Pins the contract regardless of the JVM's default zone.

Doc companion: the live AlertManager-integration page should explicitly document the timezone expectation (operators sending payloads from time-zoned Prometheus deployments need to know whether the URL link will land on the right query window).

**Severity rationale**: MEDIUM — operator UX trap (clicking an alert link to investigate the metric shows nothing because the query window is off). The bug is silent — operators don't know they're clicking into an empty time window. Compounds with REFACTOR-082 (the AlertManager webhook is the operator's ENTRY POINT to integrate Prometheus alerts — getting the URL wrong on first contact is a poor onboarding).

**Suggested backlog grouping**: `AlertManager hardening sprint` — pair with REFACTOR-082 (sibling auth), REFACTOR-231 (entity_oddrn spoofing), REFACTOR-245 (URL XSS), REFACTOR-032 (the original timezone finding). The set describes the AlertManager DTO hygiene gaps.

---
