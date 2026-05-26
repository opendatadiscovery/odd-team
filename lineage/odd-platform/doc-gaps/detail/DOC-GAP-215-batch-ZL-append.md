## STRENGTHENS — LookupTables.tsx UI-COMPONENT primary source adds the FIFTH and SIXTH operational dimensions in batch ZL (UI 30-row cap + namespace_name silent-discard on edit) — the UI-tier complement to DOC-GAP-215's backend-tier compound gap

DOC-GAP-215 (ReferenceData/LookupTables compound doc-coverage gap) covered FOUR backend-tier operational dimensions: cascade-on-delete, XSS surface, per-tenant scoping, buildTableName collision. Batch ZL adds the UI-tier complement via the LookupTables.tsx component sidecar — surfacing TWO new operator-visible dimensions that compound the existing cluster.

### Added surfaced_by (new sidecar cited)

- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases.[InfiniteScroll mis-targeting]` (HIGH per sidecar — VERBATIM: "LookupTablesList.tsx:51-53 mounts `<ScrollableContainer id='lookup-tables-list'>` around `<InfiniteScroll scrollableTarget='directory-entities-list'>`. The `scrollableTarget` is a copy-paste from the Directory feature — it references a DOM id that does NOT exist on this page. ... Likely effect: `fetchNextPage` never gets triggered by scrolling within the table; any tenant with >30 lookup tables sees only 30 rows in the UI.") **(see DOC-GAP-313 NEW for the full UI-tier dimension)**
- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases.[Edit-form DTO drift]` (HIGH per sidecar — VERBATIM: "`LookupTableForm.tsx:49` types form data as `LookupTableFormData` (the CREATE shape with required `namespaceName`). On edit (line 60-66), it submits the SAME shape to `editLookupTable({ lookupTableUpdateFormData: data, ... })`, but the OpenAPI contract for UPDATE (`LookupTableUpdateFormData`, components.yaml:3853-3862) defines ONLY `name` + `description`. The `namespace_name` field is sent on the wire on every edit but silently discarded by the server.") **(see DOC-GAP-314 NEW for the full UI-tier dimension)**
- `odd-platform__ts__react-component__component__LookupTables.md:docs_link_semantic.doc_drift_findings[3 dimensions]` — buildTableName transformation, namespace_name silent discard, page-render-without-permissions — three NEW UI-tier doc drift surfaces that didn't appear in the backend-only DOC-GAP-215.
- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases.[Counter leaks population size]` (MEDIUM per sidecar) — confirms the per-tenant scoping gap from DOC-GAP-215 dimension (c) at the UI-tier: the H1 counter renders `facets?.total` which is the platform-wide count, not owner-scoped — adds the UI-visible-counter dimension to the read-collaborative posture.
- Probes **P-191** + **P-192** + **P-193** (per LookupTables.tsx sidecar `stress_findings.probes_emitted`) — operational confirmation gates for namespace_name discard, InfiniteScroll mis-target, and permissions-rendering posture.

### New evidence (supplementary)

- The TWO NEW UI dimensions are CHILDREN of DOC-GAP-215's cluster and have been filed as **DOC-GAP-313** + **DOC-GAP-314** NEW (this batch). Together, DOC-GAP-215 + DOC-GAP-313 + DOC-GAP-314 form a SIX-dimension P-03 Master Data Management cluster on the same doc page (`features/master-data-management/lookup-tables.md`).
- **WebFetch re-verification 2026-05-26**: per LookupTables.tsx sidecar `docs_link_semantic.inferred_docs[0]` — `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` status **200**. The live page remains silent on the FIVE UI-tier dimensions (cascade-on-delete UI consequence, namespace_name wire drift, InfiniteScroll cap, permissions render-but-not-gate, original-name transformation). Doc-side fix is bounded — one comprehensive operational-characteristics section.
- The doc-side fix scope NOW EXTENDS from the four DOC-GAP-215 backend dimensions to include the two NEW UI-tier dimensions: one comprehensive section with SIX subsections covers the cluster.

### Severity update

Severity remains **MEDIUM** — primary-source extension to the UI tier strengthens the cluster but does not promote the cluster to HIGH. THE SPLIT-OFF NEW FINDINGS (DOC-GAP-313 HIGH for InfiniteScroll 30-row cap; DOC-GAP-314 MEDIUM for namespace_name discard) are independently filed and carry their own severities. DOC-GAP-215's cluster is the doc-product-side aggregation; the per-dimension findings are the maintainer-actionable units.

---

**Batch ZL contribution**: 1 NEW PRIMARY SOURCE at the UI tier (LookupTables.tsx component); 2 NEW SPLIT-OFF NEW findings filed independently (DOC-GAP-313 + DOC-GAP-314); coverage to FOUR additional UI-tier dimensions; severity unchanged (MEDIUM at cluster level; HIGH/MEDIUM at the split-off children); 3 NEW probes emitted (P-191, P-192, P-193).
