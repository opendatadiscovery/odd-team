## REFACTOR-245 — AlertManager webhook `generatorURL` propagated verbatim into UI-rendered alert chunk description — potential stored-XSS / open-redirect surface

**Severity**: MEDIUM (file-local; HIGH if UI renders description as innerHTML)
**Category**: missing-sanitisation + open-redirect
**Surfaced by**:
- `AlertServiceImpl.md:bugs_limitations_corner_cases[3]`
- `AlertServiceImpl.md:security.known_security_gaps[3]`

**Description**: `AlertServiceImpl.handleExternalAlerts` (line 168) builds the embedded Prometheus query URL via `UriComponentsBuilder.fromUri(externalAlert.getGeneratorURL())`; line 185 embeds it in the alert chunk description as `String.format("Distribution Anomaly. URL: %s", queryUrl)`. The `URI` type does some shape validation but does NOT block `javascript:` scheme or arbitrary host URLs. The composed description text is persisted to `alert_chunk.description` and later rendered in the UI (`/alerts` list, alert detail view).

The XSS surface depends on the UI rendering strategy:
- If the UI renders description as plain text (escaped), the URL appears as visible text but is not clickable — LOW risk.
- If the UI renders description with auto-linking (e.g. `react-linkify`, custom regex link conversion), the URL becomes clickable — MEDIUM risk: clicking a `javascript:` URL fires the script; clicking an arbitrary host enables open-redirect for phishing.
- If the UI renders description as innerHTML (e.g. via `rehype-raw` without sanitisation — REFACTOR-218 family shape), arbitrary HTML/JS executes — HIGH risk: stored-XSS via the unauthenticated AlertManager webhook.

Compounding factors:
- The AlertManager webhook endpoint is UNAUTHENTICATED (per ADR-CANDIDATE-006 + REFACTOR-082). Any caller with network reach can plant the payload.
- The `generatorURL` field has no schema constraint (the hand-rolled `ExternalAlert` DTO has only minimal validation per ADR-CANDIDATE-014).
- The alert is visible to ANY authenticated platform user (per REFACTOR-024 cross-owner alerts read).
- The chunk text is persisted in `alert_chunk.description` and is durable until the alert is resolved + housekeeping purges it (per REFACTOR-085 + REFACTOR-142 housekeeping bugs may delay purge).

**Primary source citations**:
- `AlertServiceImpl.java:168` — `UriComponentsBuilder.fromUri(externalAlert.getGeneratorURL())` (no scheme allowlist, no host allowlist)
- `AlertServiceImpl.java:185` — `String.format("Distribution Anomaly. URL: %s", queryUrl)` (unbounded string interpolation)
- `AlertManagerController.java:21-26` — unauthenticated webhook endpoint
- contrast with `AlertManagerController.java:20` — the TODO comment about defining the OpenAPI spec; a schema would constrain the URL
- the UI rendering layer (out of scope for this sidecar; the depends-on-UI severity escalation requires a UI-side audit)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-006 (AlertManager network-delegated auth) codifies the absence of app-layer auth as deliberate. The ADR does NOT defend against payload-content sanitisation; the trust-the-network model assumes operators put a reverse proxy in front, but the proxy does not sanitise alert content. ADR-CANDIDATE-014 (hand-coded AlertManagerController) acknowledges the DTO is minimal; the gap is the missing sanitisation. The fix is refactoring within the existing architecture.

**Proposed remedy**: Three composable fixes:
1. **URL scheme allowlist**: validate `externalAlert.getGeneratorURL()` against `Set.of("http", "https")` at line 168; reject other schemes with 400. Prevents `javascript:` injection.
2. **URL host allowlist (optional)**: an operator-tuneable allowlist (`alerts.alertmanager.allowed-generator-hosts: ["prometheus.internal", "alertmanager.internal"]`) rejected if `URI.getHost()` is not in the list. Prevents open-redirect to attacker-controlled hosts.
3. **UI-side sanitisation**: ensure description is rendered as plain text (NO innerHTML, NO auto-linking unless via sanitised library); this is the defence-in-depth layer the backend cannot provide. Composes with REFACTOR-218 (the description-Markdown-sanitisation gap).

Doc companion: update the AlertManager hardening sprint (referenced from REFACTOR-082) to enumerate the payload-sanitisation requirements alongside the network-auth requirement.

**Severity rationale**: MEDIUM (file-local — the URL is embedded but the XSS escalation depends on the UI render path). Escalates to HIGH if the UI renders description as innerHTML (REFACTOR-218 confirms `rehype-raw` is used without `rehype-sanitize` on description bodies, so the escalation is plausible). The file-local primitive is the unbounded URL embedding; the consequence chain is at the UI.

**Suggested backlog grouping**: `AlertManager hardening sprint` — pair with REFACTOR-082 (the original sibling-unprotected finding), REFACTOR-231 (entity_oddrn spoofing), REFACTOR-218 (UI sanitisation). All four together describe the AlertManager attack surface.

---
