- **DOC-GAP-018**: API spec carries no `security:` block and no `components.securitySchemes` — invariant of contract-vs-runtime mismatch undocumented
  - **Category**: drift
  - **Surfaced by**: `openapi-tag-alert.md:doc_drift_findings.[3]` + `:implicit_adrs.[3]`; `openapi-tag-dataEntity.md:implicit_adrs.[0]`; `concepts.yaml:invariants[Spec carries no security: block]`
  - **Evidence**: exhaustive grep for `security:` block returns zero matches; api-reference does not warn.
  - **Proposed doc action**: Add a "Security note" admonition to `developer-guides/api-reference.md` directing readers to Authorization/Permissions pages for auth model.
  - **Cross-references**: DOC-GAP-009 (when data-entities api-ref page lands).
  - **Severity rationale**: MEDIUM.

## Batch Z append

## Batch Z append

#### Batch 2026-05-20-Z STRENGTHENS — openapi-spec axis PRIMARY SOURCE; promoted to spec-side primary source with full 194-operation enumeration

Batch Z's `odd-platform__openapi__spec__odd-platform-public-api.md` sidecar is the FIRST spec-axis primary source for DOC-GAP-018. The original batch-A framing came from the openapi-tag-level sidecars; this batch enriches the entire `openapi.yaml` + `components.yaml` spec under its own primary source axis, allowing the no-`securitySchemes` finding to be anchored at higher fidelity.

**DOC-GAP-242 NEW (batch Z)** captures the spec-side primary source as a separately-trackable finding with the FULL 194-operation enumeration + the 191-operation error-contract gap + the Swagger UI public-exposure angle. DOC-GAP-018 remains the foundational missing-`securitySchemes` finding; DOC-GAP-242 is the platform-wide breadth promotion.

**The compound with DOC-GAP-244 (NEW batch Z — 9-vs-35 tag coverage gap)**: the Swagger UI is the only complete enumeration of the API surface (26 of 35 tags have no api-reference sub-page) AND the Swagger UI ships from the openapi spec which has no `securitySchemes` block AND the spec declares only 2xx responses for 191 of 194 operations. Third-party API consumers face under-documentation at every layer: the doc-hub has 9 sub-pages (missing 26 tags), the spec has no auth model, the spec has no error contracts.

**The DOC-GAP-099 META cluster framing**: the no-security-model failure shape is one of 6 (per DOC-GAP-242 NEW + DOC-GAP-244 NEW) failure shapes in the OpenAPI authoring-quality cluster. DOC-GAP-018 + DOC-GAP-242 collectively anchor the no-security-model shape.

**Doc-side action expansion** (per DOC-GAP-242's framing): add the `securitySchemes` block + global `security:` declaration to the upstream spec repo; add a "Authentication" admonition to the api-reference hub; add a CI contract conformance test suite. See DOC-GAP-242 for the full directional-fix shape spectrum.

**Severity stays MEDIUM** at the foundational DOC-GAP-018 framing; DOC-GAP-242 is HIGH (the broader integration-story-under-documented framing). Coherence: strengthens DOC-GAP-018 with spec-axis primary source. No conflicts.
