## REFACTOR-433 — AlertManager DTO silently drops AlertManager v2 wire fields (`status: resolved`, `endsAt`, `annotations`, `fingerprint`, `groupKey`, etc.); the most operationally-impactful drop is `status: resolved` — AlertManager-driven alerts cannot be auto-resolved on receipt

**Severity**: LOW (documented in live doc; the active-platform-features/alerting page surfaces the halt-toggle limitation; the absence is not silently broken — operators see the caveat)
**Category**: silent-payload-drop (wire-format incompleteness)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: P (2026-05-20)

**Surfaced by**: `AlertManagerController__controller-method__postAlerts.md:bugs_limitations_corner_cases.[4]`

**Description**: `AlertManagerRequest` (`AlertManagerController.java:28-32`) carries one field (`List<ExternalAlert> alerts`), and `ExternalAlert` (`ExternalAlert.java:9-15`) carries three fields (`labels`, `generatorURL`, `startsAt`). The AlertManager v2 webhook wire format includes additional fields: `status` (firing | resolved), `endsAt`, `annotations`, `fingerprint`, `groupKey`, `groupLabels`, `commonLabels`, `commonAnnotations`, `externalURL`, `version`, `receiver`. ALL are silently dropped by Jackson on deserialisation (the DTOs don't declare them; Jackson's default is FAIL_ON_UNKNOWN_PROPERTIES=false). The most operationally-impactful drop is `status: resolved` — AlertManager-driven alerts cannot be auto-resolved on receipt because the platform never sees the field. The live `active-platform-features/alerting` page documents this verbatim: "the Distribution Anomaly halt toggle doesn't enforce suppression on AlertManager-driven alerts, recommending operators use Prometheus Alertmanager configuration layers instead to manage alert noise."

**Primary source citations**:
- `AlertManagerController.java:28-32`
- `ExternalAlert.java:9-15`
- WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-20 status 200

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-014 (hand-rolled AlertManagerController — the no-OpenAPI-contract decision) explains WHY the DTO is hand-rolled and partial; the implicit prescription is "the OpenAPI-contract migration is the long-term fix" (per the TODO comment at `AlertManagerController.java:20`).

**Proposed remedy**: Long-term: define an OpenAPI spec for the AlertManager wire format and migrate the controller to the contract-driven path. Short-term: expand `ExternalAlert` to include `status` + `endsAt` so the platform can auto-resolve on `status: resolved` payloads (the most operationally-impactful gap). Pair with REFACTOR-NNN F-007 halt-toggle facet fix (the halt-toggle would then work for AlertManager-driven alerts).

**Severity rationale**: LOW — documented in live doc (operator-warned); the gap doesn't enable a security exploit; pure operational/UX caveat.

**Suggested backlog grouping**: `AlertManager wire-format hardening` (pair with F-007 facet fix + the OpenAPI-contract migration).

---
