## REFACTOR-611 — `IntegrationMapper` hardcodes `installed: false` on every Integration / IntegrationPreview response — structurally dead OpenAPI required field; UI "Integrated" badge never renders

**Severity**: MEDIUM
**Category**: dead-code / contract-violation
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-08 Management & Administration (the Integrations tab UI), P-10 Integrations & Ingestion (the OpenAPI contract surface)]

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "`installed: false` hardcoded constant on every response — the field is structurally dead. `IntegrationMapper.java:27` (`@Mapping(target = \"installed\", constant = \"false\")`) and `:30` apply to both the full Integration and the preview shape. The OpenAPI contract (`components.yaml:64-70`) declares `installed: boolean` REQUIRED, and the UI's `IntegrationPreviewItem.tsx:44-51` conditionally renders an 'Integrated' badge on `{installed && (...)}` — but the badge will NEVER show because the value is always false."

**Statement**: The OpenAPI contract at `components.yaml:64-70` declares `IntegrationPreview.installed: boolean` REQUIRED. The MapStruct mapper at `IntegrationMapper.java:27` (for the full `Integration` shape) and `:30` (for the `IntegrationPreview` shape) hardcodes the field via `@Mapping(target = "installed", constant = "false")`. No code path inspects whether an integration is actually wired into the platform (no `DataSourceRepository` lookup matching wizard id to a registered datasource, no comparison against registered collectors). The field is therefore structurally dead — REQUIRED-and-meaningless. The UI's `IntegrationPreviewItem.tsx:44-51` renders a conditional 'Integrated' badge on `{installed && (...)}` — the conditional branch is dead code; the badge code path will NEVER execute.

This is either (a) a never-implemented feature (an integration is "installed" when a datasource of matching id/family exists — but no detection code exists), or (b) a contract violation (the field is required-but-meaningless). Operators reading the API contract are misled into expecting a meaningful state value; UI designers reading the IntegrationPreviewItem code see a code path that promises a "Integrated" indicator but never delivers.

**Evidence**:
- `IntegrationMapper.java:27` (`@Mapping(target = "installed", constant = "false")` for full Integration)
- `IntegrationMapper.java:30` (same for IntegrationPreview)
- `components.yaml:64-70` (`installed: boolean` REQUIRED)
- `IntegrationPreviewItem.tsx:44-51` (UI gates the badge on `installed` — dead branch)
- grep `installed` in `<odd-platform-repo>/odd-platform-api/src/main` returns ONLY the two mapper lines (no detection code anywhere)

**Existing-ADR-or-implied-prescription**: no ADR. The standard pattern (per the live wizard doc page's framing — "Lists every integration the platform's classpath registers") suggests `installed` is intended to discriminate "wizard available" vs "datasource of this family actually wired up" — but no detection code exists. The OpenAPI contract should EITHER mark `installed` as optional OR the platform should implement detection.

**Proposed remedy**: Two paths — (a) **Detect actually-installed integrations**: cross-reference wizard `id` against `DataSourceRepository` records (or against the registered Collector list — the live doc page suggests "if a collector matching this family is configured, the integration is 'Installed'"). Add a service-tier check that returns `installed: true` when ≥1 DataSource exists whose `connection_url` host pattern matches the wizard's expected pattern, OR when the Collector list contains an entry whose data-source family matches the wizard id; (b) **Make the contract honest**: change `components.yaml:64-70` to mark `installed` as optional (the field stops being REQUIRED), and remove the UI's dead conditional branch. Path (a) is the larger fix and aligns with the wizard's promise to operators; path (b) is the smaller fix that closes the dead-code gap.

**Severity rationale**: MEDIUM — affects every Integration card in the Management → Integrations UI. The operator-visible breakage is "the UI shows a badge slot that never renders" — confusing but not security-impacting. A future maintainer who reads the OpenAPI contract believing `installed` to be a meaningful state value would write a third-party client that branches on it; the client would never see `installed: true`.

**Suggested backlog grouping**: "Integration Wizard UX completion sprint" (this scope + REFACTOR-612 + REFACTOR-613 + REFACTOR-614 + REFACTOR-615 + REFACTOR-619 form a coherent completion sprint for the wizard feature).
