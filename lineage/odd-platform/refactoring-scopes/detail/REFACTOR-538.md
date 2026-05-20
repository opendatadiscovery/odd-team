## REFACTOR-538 — Subject template uses Java `String.replace` (NOT Freemarker) — fragile if a future `AlertTypeEnum` value contains `${...}` text; subject prefix coupled to a static String constant

**Severity**: LOW
**Category**: fragile-parsing + future-refactor-risk
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications email channel)]

**Surfaced by**:
- `EmailNotificationSender.md:tests_coverage_semantic.uncovered_behaviours.[9]` (uncovered) — "Subject Template Injection — what happens if AlertTypeEnum.name() contained `${...}` text? (impossible per current enum constants, but a future enum addition could break the manual string-replace)"

**Statement**: `EmailNotificationSender.java:21, 51`:
```java
private static final String EMAIL_SUBJECT_TEMPLATE = "ODD Platform - ${alertType} Alert";
...
helper.setSubject(EMAIL_SUBJECT_TEMPLATE.replace("${alertType}", message.getAlertType().name()));
```
The substitution uses Java's `String.replace(CharSequence, CharSequence)` — NOT a template engine. The constant string `"${alertType}"` is replaced with the enum value verbatim.

**Fragility**: If a future enum value contained `${...}` text (impossible per current `AlertTypeEnum` values `BACKWARDS_INCOMPATIBLE_SCHEMA / FAILED_DQ_TEST / FAILED_JOB / DISTRIBUTION_ANOMALY` which are screaming-case identifiers), the `String.replace` would re-replace within the substituted string, producing unexpected output.

Latent — currently not reachable but structurally present.

**Evidence**:
- `EmailNotificationSender.java:21, 51`

**Proposed remedy**: Either (a) use Freemarker for the subject as well (cross-link with REFACTOR-526's tunability — would naturally fix this), or (b) document the constraint that AlertTypeEnum values must not contain `${...}` text.

**Severity rationale**: LOW — latent; currently not reachable; defence-in-depth.

**Suggested backlog grouping**: `Notifications code hygiene`.

---
