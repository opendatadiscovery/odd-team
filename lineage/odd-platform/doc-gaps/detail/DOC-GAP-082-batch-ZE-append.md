## STRENGTHENS — DISABLED-mode anonymous-reach extends across FIVE NEW controllers (batch ZE)

Batch ZE confirms the DOC-GAP-082 META pattern (DISABLED-bypasses-RBAC) extends to FIVE additional controllers — adding to the multi-batch sidecar coverage that DOC-GAP-082 META catalogs. Every batch ZE controller class shares the same posture: no `@PreAuthorize`, no SECURITY_RULES entry, falls through to `.authenticated()` on non-DISABLED, anonymously reachable under DISABLED.

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[3]` (MEDIUM — "`auth.type=DISABLED` makes the entire search surface anonymously reachable") + `:concepts.invariants.[1]` + `:implicit_adrs.[2]`
  - `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[0]` (LOW — "Authentication required but NO per-permission authorization gate") + `:concepts.invariants.[3]` + `:security.known_security_gaps.[1]` (DISABLED-mode exposure)
  - `odd-platform__java__FeatureController__controller-class__FeatureController.md:bugs_limitations_corner_cases.[0]` (LOW — "Under `auth.type=DISABLED`, `GET /api/features/active` is anonymously reachable") + `:security.known_security_gaps.[0]` (PROVIDER-NULL-BLEED-LIMITED-RISK FACET of REFACTOR-185)
  - `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:bugs_limitations_corner_cases.[1]` (HIGH — "every endpoint is reachable by any authenticated caller (or anonymous under DISABLED)") + `:security.known_security_gaps.[0]` + `:security.known_security_gaps.[1]`
  - `odd-platform__java__LinksController__controller-class__LinksController.md:security.known_security_gaps.[3]` (LOW — "Under DISABLED mode the endpoint is public — an unauthenticated probe to /api/links discloses operator-internal URLs to the public internet")

- **NEW evidence (batch ZE)**:
  - **SearchController** (7 endpoints): all 7 share `.authenticated()` fallback; under DISABLED any anonymous caller can create search sessions, paginate the entire catalog, enumerate facet counts, and (most consequentially) reach the SQL-injection vector at `highlightDataEntity` (DOC-GAP-104 cross-link).
  - **TitleController** (1 endpoint): under DISABLED any anonymous caller can enumerate the entire title directory; severity LOW because titles are role-labels not sensitive data, but the asymmetry is real and undocumented.
  - **FeatureController** (1 endpoint): the PROVIDER-NULL-BLEED-LIMITED-RISK FACET of REFACTOR-185 — anonymous caller can FINGERPRINT which optional features are enabled (`/api/features/active` returns `{items: [DATA_COLLABORATION, ALERT_NOTIFICATIONS]}` or similar) (cross-link DOC-GAP-284).
  - **RelationshipController** (3 endpoints): under DISABLED any anonymous caller reads every relationship across every data source in the catalog; this is HIGH severity at the relationships-feature level because catalog-wide enumeration is the primary discovery vector (cross-link DOC-GAP-287).
  - **LinksController** (1 endpoint): under DISABLED any anonymous caller reads the operator-configured external-links catalogue (cross-link DOC-GAP-285).

- **NEW dimension (batch ZE) — META count update**:
  Prior batches established DOC-GAP-082 META with 29+ sidecar triangulation. Batch ZE adds FIVE more controllers (Search-class + Title + Feature + Relationship + Links), bringing the catalog-wide DISABLED-bypass triangulation to 34+ sidecars. The structural-pattern claim is now overwhelming: EVERY operator-facing read controller in the platform (without exception in the batch ZE scope) inherits the DISABLED-bypass posture. The META's load-bearing claim is structural, not method-by-method.

- **NEW dimension (batch ZE) — pillar coverage expansion**:
  Batch ZE expands the META's pillar coverage to:
  - P-01 Data Discovery (SearchController — already covered in DOC-GAP-082; this batch confirms class-tier)
  - P-02 Data Modelling (RelationshipController — NEW pillar coverage)
  - P-04 Data Collaboration (FeatureController gates the UI features — NEW pillar)
  - P-08 Notifications/Alerting (FeatureController gates the UI features — NEW pillar)
  - P-09 Security & Access Control (TitleController — NEW pillar coverage)
  - Generic platform infrastructure (LinksController — NEW)
  The META's "every pillar has DISABLED-bypass exposure" claim is now structurally confirmed across 5+ pillars (was 4 pre-ZE).

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The five new instances are additive (same polarity) — consistent with the META's load-bearing claim. No CONTRADICTS, no SUPERSEDES.

- **Severity stays at the META's HIGH** (with the meta-claim "DISABLED bypasses every RBAC surface — the catalog's primary security-model regression"). The per-instance severity varies (HIGH for Relationships + Search; MEDIUM for Title; LOW for Feature + Links — these last three carry low-sensitivity payloads). The maintainer's doc-side fix is a SINGLE consolidated admonition on `/configuration-and-deployment/enable-security/disabled-authentication.md` (per the META's proposed doc action) that enumerates the full scope; the per-feature pages reference back to the central admonition rather than duplicating it.
