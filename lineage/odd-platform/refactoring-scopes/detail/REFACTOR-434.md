## REFACTOR-434 — `ExternalAlert.startsAt` is `LocalDateTime` (timezone-naive); Jackson silently strips RFC3339 timezone offsets; embedded query-URLs use ODD server's local time, not the alert's actual timestamp

**Severity**: LOW (operator-visible misalignment but not a security or correctness gap)
**Category**: silent-payload-drop (timezone handling)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: P (2026-05-20)

**Surfaced by**: `AlertManagerController__controller-method__postAlerts.md:bugs_limitations_corner_cases.[3]`

**Description**: `ExternalAlert.startsAt` is `LocalDateTime` (`ExternalAlert.java:14`). Jackson's default LocalDateTime deserialiser strips RFC3339 timezone offsets silently. `AlertServiceImpl.java:67-68` declares the formatter as `yyyy-MM-dd HH:mm:ss` (no timezone). The URL embedded in the chunk description (`AlertServiceImpl.java:168-172`) uses this naive timestamp for Prometheus query params (`g0.moment_input`, `g0.end_input`). Operators clicking the linked URL land in a Prometheus query window keyed by the ODD server's local time, NOT the alert's actual timestamp.

**Primary source citations**:
- `ExternalAlert.java:14`
- `AlertServiceImpl.java:67-68, 168-172`

**Existing-ADR-or-implied-prescription**: NONE existing; this is a silent bug class. The OpenAPI-contract migration (REFACTOR-433's prescription) would address it incidentally if the new contract uses `OffsetDateTime`.

**Proposed remedy**: Change `ExternalAlert.startsAt` to `OffsetDateTime` (or `Instant`); update `AlertServiceImpl.java:67-68` to a timezone-aware formatter. Companion `@WebFluxTest` regression asserting that a POST with RFC3339-offset timestamp preserves the offset in the stored alert and the embedded URL.

**Severity rationale**: LOW — operator-visible UX bug; not data loss; not a security gap.

**Suggested backlog grouping**: `AlertManager wire-format hardening` (pair with REFACTOR-433).

---
