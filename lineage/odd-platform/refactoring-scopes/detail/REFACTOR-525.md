## REFACTOR-525 — `ALERT_PATH` constant hard-coded to `/dataentities/{dataEntityId}/alerts` — email click-through link tightly coupled to SPA routing contract; future SPA route refactor breaks all sent email links silently

**Severity**: MEDIUM
**Category**: hard-coded-path + spa-routing-coupling + observability
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications email channel), P-01-data-discovery (SPA routing)]

**Surfaced by**:
- `EmailNotificationSender.md:implicit_adrs.[5]` (MEDIUM) — "**ALERT_PATH constant is hard-coded to `/dataentities/{dataEntityId}/alerts`** (line 20) — operator-non-tunable, baked into the class. The link rendered in the email body is always `${platformHost}/dataentities/{id}/alerts`. Decision: the URL scheme of the alert detail page is part of the SPA's routing contract — coupling this constant tightly couples the email body to the SPA route table."
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[8]` (LOW) — "**Alert URL construction has no slash normalisation** — line 66-67 builds `platformHost + ALERT_PATH.replace(...)` where ALERT_PATH starts with `/`. If operator sets `odd.platform-base-url=https://odd.example.com/` (trailing slash), the URL becomes `https://odd.example.com//dataentities/.../alerts` (double-slash)."

**Statement**: `EmailNotificationSender.java:20`:
```java
private static final String ALERT_PATH = "/dataentities/{dataEntityId}/alerts";
```
The path is a Java `private static final` constant. The link rendered at line 66-67 is always `platformHost + "/dataentities/{id}/alerts"`. A future SPA route refactor that renames the alerts tab (e.g. to `/dataentities/{id}/incidents` or `/entities/{id}/alerts`) breaks every email link in production AND every historical archived email link.

**Compound issues**:
- No slash normalisation (REFACTOR-525 nested): `platformHost` ending with `/` produces `//dataentities/...` double-slash URL.
- No URL test coverage — no test pins the constant.

**Evidence**:
- `EmailNotificationSender.java:20, 66-67` — the constant + the concatenation

**Proposed remedy**:

1. **Path A (centralise SPA routes)** — Move the constant to a `SpaRoutes` utility class with named methods (`SpaRoutes.dataEntityAlerts(id)`). All places that construct SPA links use the same source. A future route refactor touches one file.

2. **Path B (operator-tunable template)** — Add `notifications.email.alert-url-template: String` config (default `/dataentities/{dataEntityId}/alerts`). Operators can override if SPA is mounted at a non-root path.

3. **Path C (Path A + slash normalisation)** — Add URL normalisation (`URI.create(platformHost).resolve(path).toString()`) to handle trailing/leading slash robustly.

Path C is the recommended.

**Severity rationale**: MEDIUM — SPA route refactor risk + double-slash URL bug; not security-critical; operator-visible.

**Suggested backlog grouping**: `Notifications hardening sprint` + `SPA-route registry refactor`.

---
