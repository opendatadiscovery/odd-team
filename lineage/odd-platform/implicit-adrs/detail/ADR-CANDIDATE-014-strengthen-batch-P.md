## ADR-CANDIDATE-014 — STRENGTHENED BATCH P — Hand-rolled AlertManagerController is the canonical exception to the OpenAPI-generated-controller-interfaces pattern — METHOD-TIER PRIMARY SOURCE CONFIRMED

**Severity unchanged**: HIGH
**Updated support count**: now **2-sidecar** (batch A class-level + batch P method-level)
**Batch**: P (2026-05-20)

**New surfaced_by**:
- `AlertManagerController__controller-method__postAlerts.md:implicit_adrs.[0]` (HIGH) — "The AlertManager receiver is not implemented via the OpenAPI-contract path. The `// TODO: define OpenAPI spec based on alert provider contract` comment at AlertManagerController.java:20 is the explicit intent_anchor — every other inbound HTTP method in `org.opendatadiscovery.oddplatform.controller.*` implements an `*Api` interface generated from `odd-platform-api-contract` (e.g. AlertController implements AlertApi); this method does not, and the inner static `AlertManagerRequest` DTO is the deliberate alternative. The decision is not 'we don't have a contract for this' — the TODO names the contract as pending; the decision IS 'we ship the receiver without the contract for now, because the AlertManager wire format is operator-driven and the platform absorbs whatever shape arrives'." — evidence: AlertManagerController.java:15 (no `implements *Api` clause) + AlertManagerController.java:20 (the TODO comment) + AlertManagerController.java:28-32 (the inner static DTO) — intent_anchor: "// TODO: define OpenAPI spec based on alert provider contract"

**Triangulation expansion**: ADR-CANDIDATE-014 is now ANCHORED at the method-tier with WebFetched doc-side confirmation; the implicit decision ("we ship the receiver without the contract for now, because the AlertManager wire format is operator-driven") is articulated at the controller-method evidence layer for the first time. The TODO comment is the explicit maintainer-acknowledged anchor.

**Cross-link with ADR-CANDIDATE-140 (NEW batch P)**: AlertManagerController being non-contract-driven AND non-filter-protected forms the COMPLETE deviation set from the IngestionController pattern — both decisions are simultaneous, both surface in the post-batch-P review. The two together are the maintainer's "this endpoint is structurally OUTSIDE the platform's normal ingestion architecture" statement.

**Cross-link with REFACTOR-433 + REFACTOR-434 (NEW batch P)**: the hand-rolled DTOs (`AlertManagerRequest` + `ExternalAlert`) silently drop AlertManager v2 wire fields (`status`, `endsAt`, `annotations`, etc. — REFACTOR-433) AND the `LocalDateTime`-typed `startsAt` strips timezone offsets (REFACTOR-434). These are operational gaps that ADR-CANDIDATE-014's "no-contract" stance explicitly accepts as the trade-off; the long-term remedy is the OpenAPI-contract migration the TODO names.

**Severity unchanged at HIGH**.

---
