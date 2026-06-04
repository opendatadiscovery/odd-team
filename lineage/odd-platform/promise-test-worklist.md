# Integration / e2e test worklist — promise-driven, RISK-RANKED

**Snapshot 2026-06-04. POINT-IN-TIME PLAN — not a maintained mirror** (regenerate from the promise layer via the graph; do not hand-edit — ADR-0077).

## What this is
Every feature's LSN-030 `use_cases` (falsifiable `given_when_then` + `trace`) routed to the cheapest verifying layer,
ranked by a transparent **risk score** (security ×3 · data-loss ×2 · max-severity · contradictions ×0.3 · security-promises ×0.2 · SHB-origin),
minus the 21 features that already have an e2e IT. Drive against the per-feature frontier (platform 97/1306 = **7%**).

## The shape — route by layer (NOT 1,209 e2e tests)

| layer | unverified | how |
|---|---|---|
| **e2e (Playwright IT-NNN)** | 692 | user-observable UI→DB flow |
| **integration — security** | 252 | WebTestClient permission/RBAC (not e2e) |
| **unit** | 220 | Mockito/StepVerifier (grammar/guards/no-match) |
| **integration — multi-step** | 51 | service/repo |

## THE FRONT OF THE QUEUE — top 25 by risk, no IT yet (start here, top→down)

| # | risk | feature | frontier | e2e/sec/unit | R→pin / G→lock | flags |
|---|---|---|---|---|---|---|
| 1 | 9.9 | **F-008** Batch Ingestion (S2S API) | 0/14 | 5/8/1 | 11R / 0G | SEC DATA-LOSS  |
| 2 | 9.4 | **F-059** Lookup Table Rename Cascade | 0/10 | 8/1/1 | 4R / 5G | SEC DATA-LOSS HIGH |
| 3 | 9.2 | **F-046** Custom Metadata Field Catalogue | 2/12 | 5/2/2 | 6R / 2G | SEC DATA-LOSS MEDIUM |
| 4 | 8.7 | **F-076** Cross-Management Cascade-on-Delete Protection  | 1/12 | 5/3/1 | 7R / 2G | SEC DATA-LOSS  |
| 5 | 8.6 | **F-011** Principal-to-Owner Resolution (Owner-Scoping M | 0/13 | 9/3/1 | 10R / 0G | SEC DATA-LOSS  |
| 6 | 8.4 | **F-055** Lineage Depth Boundary Contract | 1/11 | 5/3/2 | 6R / 2G | SEC HIGH |
| 7 | 8.3 | **F-006** Role-Based Access Control | 2/15 | 8/0/5 | 11R / 2G | SEC DATA-LOSS  |
| 8 | 8.2 | **F-057** DQ Test Severity Lifecycle | 0/12 | 4/5/3 | 4R / 5G | SEC HIGH |
| 9 | 8.1 | **F-105** Management Section Route Gating (reads bypass  | 0/11 | 3/6/2 | 3R / 4G | SEC HIGH |
| 10 | 8.0 | **F-047** Dataset Field per-Column Annotation Surface | 0/3 | 3/0/0 | 0R / 0G | SEC DATA-LOSS HIGH |
| 11 | 7.9 | **F-123** Deletion Semantics Per-Resource Contract | 0/11 | 8/2/0 | 5R / 2G | SEC DATA-LOSS  |
| 12 | 7.6 | **F-086** OAuth Logout Token-Revocation Semantics | 0/11 | 5/2/2 | 4R / 4G | SEC DATA-LOSS  |
| 13 | 7.5 | **F-084** OAuth Provider Admin-Detection Matrix | 0/11 | 3/7/1 | 7R / 2G | SEC  |
| 14 | 7.4 | **F-208** Data Entity Staleness Indicator | 0/12 | 8/1/3 | 4R / 5G | SEC HIGH |
| 15 | 7.3 | **F-058** Lookup Tables Listing UX | 0/10 | 7/2/1 | 3R / 4G | SEC HIGH |
| 16 | 7.3 | **F-030** Metrics Ingestion | 1/11 | 3/4/3 | 5R / 3G | SEC DATA-LOSS  |
| 17 | 7.1 | **F-054** Microservices Lineage | 0/7 | 5/1/1 | 3R / 4G | SEC HIGH |
| 18 | 7.1 | **F-095** Statistics ingestion endpoint cross-dataset wr | 2/12 | 3/5/2 | 7R / 2G | SEC  |
| 19 | 7.0 | **F-125** Ingestion Credential Storage & Lifecycle | 1/12 | 8/2/1 | 2R / 6G | SEC DATA-LOSS  |
| 20 | 6.9 | **F-029** Platform Public API Contract | 1/15 | 10/3/1 | 11R / 2G | SEC  |
| 21 | 6.9 | **F-015** My-Objects Anchor-Set Reads | 0/13 | 5/2/6 | 5R / 4G | SEC DATA-LOSS  |
| 22 | 6.7 | **F-104** Feature-Local State Persistence (jotai per-Pro | 0/10 | 8/1/1 | 5R / 2G | SEC MEDIUM |
| 23 | 6.5 | **F-097** Swagger UI per deployment — public discovery o | 0/11 | 9/2/0 | 7R / 3G | SEC  |
| 24 | 6.5 | **F-096** Ingestion batch atomicity contract surfaced to | 0/11 | 3/2/6 | 7R / 2G | SEC  |
| 25 | 6.3 | **F-075** User-Owner Association Request Flow (DIRECT_OW | 1/11 | 5/4/1 | 5R / 3G | SEC  |

## How to work each (the loop)
1. The feature's unverified `use_cases` ARE the test cases (`given_when_then` + `trace`). `/probe-define` skeletons them.
2. Route: e2e→IT-NNN (Playwright) · sec→WebTestClient · unit→Mockito/StepVerifier.
3. **Contradicted (R) → RED** test: pin the bug / document the limitation (no-code-change posture, LSN-029). **Confirmed-untested (G) → GREEN**: lock the working behaviour in.
4. Flip `coverage: verified` on green → `graph-build` → frontier % climbs.
5. Cross-check the 16 triaged items (DOC-326..335 / TST-002..004 / PLT-140) — several front-queue promises are already routed there.

## The bar (sole-maintainer)
Drive the front-25 to high promise-coverage; let the tail climb opportunistically. Risk picks the order — never attention or work-magnitude. The frontier % is the dashboard.

## Front-25 — the concrete first tests

- **F-008** Batch Ingestion (S2S API) — e2e 5 / sec 8:
    - `F-008-UC-13` [edit-reconcile] A partial re-ingest preserves the omitted metadata fields + lineage edges (merge) — a tr
    - `F-008-UC-04` [edit-reconcile] An operator's UI rename/description edit on a datasource persists across collector ticks
- **F-059** Lookup Table Rename Cascade — e2e 8 / sec 1:
    - `F-059-UC-001` [edit-reconcile] When an operator renames a lookup table (name normalises to a new physical name),
ALTER 
    - `F-059-UC-002` [edit-reconcile] A description-only edit (or a name change that normalises to the same physical name)
doe
- **F-046** Custom Metadata Field Catalogue — e2e 5 / sec 2:
    - `F-046-UC-2` [render] Empty-query autocomplete returns the full deployment INTERNAL catalogue, identical for e
    - `F-046-UC-3` [edit-reconcile] Picking an existing field pre-fills its type; saved values are type-consistent with that
- **F-076** Cross-Management Cascade-on-Delete Protection  — e2e 5 / sec 3:
    - `H-002` [render] The delete confirmation dialog's on-screen text matches the real semantics (guarded soft
    - `H-010` [render] A user without the relevant *_DELETE permission sees no Delete control on the Management
- **F-011** Principal-to-Owner Resolution (Owner-Scoping M — e2e 9 / sec 3:
    - `H-003` [happy-path] Under LOGIN_FORM, authored Policies/Roles actually gate what each user can do.
    - `H-004` [edit-reconcile] PUT /api/owners/{id} omitting roles preserves the Owner's existing role bindings (omitte
- **F-055** Lineage Depth Boundary Contract — e2e 5 / sec 3:
    - `H-001` [render] The depth dropdown constrains the user to [1..20]; selecting 20 returns at most 20 hops 
    - `H-007` [happy-path] Opening lineage with no depth set yields a sensible documented default (UI) / the docume
- **F-006** Role-Based Access Control — e2e 8 / sec 0:
    - `H-001` [render] An operator/auditor can see who created/edited/deleted an RBAC policy/role/owner, and wh
    - `H-003` [render] A role's policy chip list renders only live (non-deleted) policies.
- **F-057** DQ Test Severity Lifecycle — e2e 4 / sec 5:
    - `F-057-UC-002` [happy-path] Raising a failing test Major->Critical flips the dataset SLA YELLOW->RED with no run-sta
    - `F-057-UC-009` [happy-path] Setting severity to its current value is a clean no-op.
- **F-105** Management Section Route Gating (reads bypass  — e2e 3 / sec 6:
    - `H-004` [render] A Management write affordance (e.g. Create-policy) is rendered as nothing (absent
from t
    - `H-007` [render] The Associations tab is hidden from the vertical tab strip when the user lacks
OWNER_ASS
- **F-047** Dataset Field per-Column Annotation Surface — e2e 3 / sec 0:
    - `F-047-UC-1` [happy-path] A user assigns a glossary term to a specific column and sees it on the column's annotati
    - `F-047-UC-2` [teardown] A user removes a term from a column and it disappears; column completeness reflects the 
- **F-123** Deletion Semantics Per-Resource Contract — e2e 8 / sec 2:
    - `F-123-UC-1` [resolve-later] Delete a DataSource/Role/Namespace/Tag then create one with the same name SUCCEEDS — the
    - `F-123-UC-3` [resolve-later] Soft-delete an INTERNAL custom metadata field then re-create it by the same name SUCCEED
- **F-086** OAuth Logout Token-Revocation Semantics — e2e 5 / sec 2:
    - `F-086-UC-01` [happy-path] Google + GitHub logout actively revokes the IdP-issued token, not just the local session
    - `F-086-UC-07` [render] The Logout UI signals revoke-vs-session-only outcome so the user knows what happened.
- **F-084** OAuth Provider Admin-Detection Matrix — e2e 3 / sec 7:
    - `H-001` [happy-path] A Google admin-principals match (email claim) grants ADMIN for the session.
    - `H-002` [happy-path] A member of a configured Google admin-groups entry is granted ADMIN.
- **F-208** Data Entity Staleness Indicator — e2e 8 / sec 1:
    - `F-208-UC-1` [happy-path] An entity not re-ingested for longer than the stale period (default
7 days) shows the or
    - `F-208-UC-2` [resolve-later] Unset odd.data-entity-stale-period does not silently disable the
signal platform-wide wi
- **F-058** Lookup Tables Listing UX — e2e 7 / sec 2:
    - `F-058-UC-001` [render] A >30-table tenant scrolling to the bottom of the list loads page 2 and beyond until the
    - `F-058-UC-002` [render] A tenant at N<=30 tables sees the entire catalog on first load.
- **F-030** Metrics Ingestion — e2e 3 / sec 4:
    - `H-007` [resolve-later] A PROMETHEUS write failure does NOT roll back ODD-side bookkeeping (partial state) and i
    - `H-011` [render] The same counter input renders identically on the Metrics tab regardless of storage back
- **F-054** Microservices Lineage — e2e 5 / sec 1:
    - `F-054-UC-1` [happy-path] A MICROSERVICE-class entity with a call edge renders its neighbour on the Lineage canvas
    - `F-054-UC-3` [render] Microservice-specific OpenTelemetry fields are dropped at the response DTO (CURRENT cont
- **F-095** Statistics ingestion endpoint cross-dataset wr — e2e 3 / sec 5:
    - `F-095-UC-5` [render] Out-of-range statistics (negative counts, inverted min/max, NaN) are rejected or normali
    - `F-095-UC-8` [edit-reconcile] Concurrent stats pushes to the same fields reconcile tags without nondeterministic loss.
- **F-125** Ingestion Credential Storage & Lifecycle — e2e 8 / sec 2:
    - `F-125-UC-002` [edit-reconcile] A rotated-out token keeps working for a grace window so the collector can be reconfigure
    - `F-125-UC-003` [render] The Regenerate confirmation warns the operator the old token dies immediately and breaks
- **F-029** Platform Public API Contract — e2e 10 / sec 3:
    - `F-029-UC-1` [render] An SDK generated from the platform OpenAPI spec contains authentication wiring (Bearer /
    - `F-029-UC-2` [render] Each operation's error responses (400 / 401 / 403 / 404 / 500) are declared in the spec 
- **F-015** My-Objects Anchor-Set Reads — e2e 5 / sec 2:
    - `F-015-UC-1` [happy-path] A signed-in user's 'Upstream dependents' tile shows up to 5 entities their owned set dep
    - `F-015-UC-3` [happy-path] 'Downstream dependents' returns the entities that depend ON the user's owned set (downst
- **F-104** Feature-Local State Persistence (jotai per-Pro — e2e 8 / sec 1:
    - `H-001` [render] A filter slice built on /data-quality survives a click-into-dataset-and-Back, consistent
    - `H-002` [resolve-later] A bookmarked/shared /data-quality?<filters> URL reconstructs the FULL ten-dimension filt
- **F-097** Swagger UI per deployment — public discovery o — e2e 9 / sec 2:
    - `F-097-UC-001` [happy-path] Under the shipped default (auth.type=DISABLED), the Swagger/spec surface is anonymously 
    - `F-097-UC-003` [render] The Swagger UI / spec info.title shows an ODD-branded name, not the legacy 'ProspectLog'
- **F-096** Ingestion batch atomicity contract surfaced to — e2e 3 / sec 2:
    - `H-001` [happy-path] One bad entity (or one failing processor) in an N-entity batch rolls back ALL N entities
    - `H-008` [render] Ingestion accepts large batches quickly (202/async) so the collector is not blocked hold
- **F-075** User-Owner Association Request Flow (DIRECT_OW — e2e 5 / sec 4:
    - `H-001` [happy-path] A user without DIRECT_OWNER_SYNC self-requests an existing owner; the request is PENDING
    - `H-008` [render] The live /user-owner-association doc documents the DIRECT_OWNER_SYNC auto-approve branch

<details><summary>Full ranked backlog (all 113, risk-ordered)</summary>

| risk | feature | frontier | e2e/sec/unit | has IT |
|---|---|---|---|---|
| 9.9 | F-008 Batch Ingestion (S2S API) | 0/14 | 5/8/1 | — |
| 9.4 | F-059 Lookup Table Rename Cascade | 0/10 | 8/1/1 | — |
| 9.2 | F-046 Custom Metadata Field Catalogue | 2/12 | 5/2/2 | — |
| 8.7 | F-076 Cross-Management Cascade-on-Delete Protection  | 1/12 | 5/3/1 | — |
| 8.6 | F-011 Principal-to-Owner Resolution (Owner-Scoping M | 0/13 | 9/3/1 | — |
| 8.4 | F-055 Lineage Depth Boundary Contract | 1/11 | 5/3/2 | — |
| 8.3 | F-006 Role-Based Access Control | 2/15 | 8/0/5 | — |
| 8.2 | F-057 DQ Test Severity Lifecycle | 0/12 | 4/5/3 | — |
| 8.1 | F-044 Data Entity Status Lifecycle (Auto-Flip + Rete | 4/13 | 6/3/0 | Y |
| 8.1 | F-045 Dataset Schema Revision History | 1/11 | 4/3/3 | Y |
| 8.1 | F-105 Management Section Route Gating (reads bypass  | 0/11 | 3/6/2 | — |
| 8.0 | F-047 Dataset Field per-Column Annotation Surface | 0/3 | 3/0/0 | — |
| 7.9 | F-123 Deletion Semantics Per-Resource Contract | 0/11 | 8/2/0 | — |
| 7.8 | F-027 Attachment Lifecycle (Files + Links) | 0/13 | 7/2/3 | Y |
| 7.6 | F-018 Manual Object Tagging | 2/15 | 7/3/2 | Y |
| 7.6 | F-086 OAuth Logout Token-Revocation Semantics | 0/11 | 5/2/2 | — |
| 7.5 | F-084 OAuth Provider Admin-Detection Matrix | 0/11 | 3/7/1 | — |
| 7.4 | F-208 Data Entity Staleness Indicator | 0/12 | 8/1/3 | — |
| 7.3 | F-058 Lookup Tables Listing UX | 0/10 | 7/2/1 | — |
| 7.3 | F-030 Metrics Ingestion | 1/11 | 3/4/3 | — |
| 7.1 | F-054 Microservices Lineage | 0/7 | 5/1/1 | — |
| 7.1 | F-095 Statistics ingestion endpoint cross-dataset wr | 2/12 | 3/5/2 | — |
| 7.0 | F-125 Ingestion Credential Storage & Lifecycle | 1/12 | 8/2/1 | — |
| 6.9 | F-029 Platform Public API Contract | 1/15 | 10/3/1 | — |
| 6.9 | F-015 My-Objects Anchor-Set Reads | 0/13 | 5/2/6 | — |
| 6.7 | F-104 Feature-Local State Persistence (jotai per-Pro | 0/10 | 8/1/1 | — |
| 6.6 | F-178 Entity Header Authoring Surface — Internal Nam | 3/11 | 7/0/1 | Y |
| 6.5 | F-097 Swagger UI per deployment — public discovery o | 0/11 | 9/2/0 | — |
| 6.5 | F-096 Ingestion batch atomicity contract surfaced to | 0/11 | 3/2/6 | — |
| 6.3 | F-075 User-Owner Association Request Flow (DIRECT_OW | 1/11 | 5/4/1 | — |
| 6.3 | F-094 Ingestion authentication-coverage matrix (5 en | 0/11 | 4/1/6 | — |
| 6.2 | F-098 Slack Events inbound integration receiver — th | 0/11 | 3/5/2 | — |
| 6.1 | F-065 Single-Leader Background Subsystem Registry | 1/11 | 5/1/3 | — |
| 6.1 | F-064 User-Owner Association Discoverability | 1/9 | 4/1/3 | — |
| 6.0 | F-207 RBAC Frontend Affordance — WithPermissions HOC | 1/11 | 5/4/1 | — |
| 6.0 | F-056 Term Description-Mention Auto-Link Side-Channe | 1/7 | 4/0/2 | — |
| 5.8 | F-186 Lineage Canvas Compact/Full View-Mode Toggle | 0/11 | 8/1/2 | — |
| 5.8 | F-088 S2S API Key — Global Admin Grant Surface | 0/12 | 4/3/3 | — |
| 5.7 | F-124 ADMIN Promotion Across Auth Providers | 0/10 | 4/1/5 | — |
| 5.6 | F-163 One-Shot Token Reveal Affordance Pattern | 0/11 | 6/2/2 | — |
| 5.6 | F-089 Post-Logout Redirect Provenance | 0/11 | 3/2/4 | — |
| 5.6 | F-074 Management-Tab Read-Collaborative Posture | 3/11 | 2/5/1 | — |
| 5.4 | F-131 Query Examples Authoring Surface | 0/12 | 8/1/3 | — |
| 5.4 | F-090 Permission Read Surface — Contextual vs Non-Co | 0/11 | 5/1/4 | — |
| 5.3 | F-121 Scheduled-Job Executor Concurrency Contract | 3/11 | 5/2/1 | — |
| 5.3 | F-014 Per-Entity Alert View | 3/14 | 3/6/2 | Y |
| 5.2 | F-022 Per-Dataset Data Quality Test Reports & SLA | 1/13 | 9/1/1 | — |
| 5.2 | F-020 Collector Lifecycle Management | 5/14 | 5/4/0 | — |
| 5.2 | F-085 Identity Probe & DISABLED-Mode Synthetic Admin | 0/7 | 2/3/1 | — |
| 5.1 | F-120 R2DBC Pool Operator-Tunability | 0/11 | 9/1/1 | — |
| 5.1 | F-087 Session Cookie Security Posture & Lifetime | 0/11 | 8/1/1 | — |
| 5.0 | F-041 Application Toolbar / Primary Navigation Chrom | 0/13 | 7/3/3 | — |
| 4.9 | F-162 Integration Wizard Argument-Form Authoring | 0/12 | 9/0/3 | — |
| 4.9 | F-021 Activity Feed (Audit-Trail Surface) | 3/17 | 8/1/4 | — |
| 4.7 | F-019 Owner Lifecycle Management | 3/16 | 7/3/2 | Y |
| 4.6 | F-119 Deployment-Info Introspection Surface | 0/8 | 8/0/0 | — |
| 4.6 | F-122 Management-Endpoint Exposure & Credential Hand | 0/11 | 6/0/1 | — |
| 4.6 | F-012 Data Entity Group Membership | 1/12 | 5/4/2 | Y |
| 4.5 | F-031 Data Source Lifecycle Management | 2/14 | 9/2/1 | Y |
| 4.3 | F-043 Multilingual UI (i18n / Locale Switching) | 0/12 | 9/1/2 | — |
| 4.2 | F-172 Admin Direct-Bind UserOwnerMapping Create (byp | 0/11 | 6/3/1 | — |
| 4.1 | F-192 Per-Column Annotation Editor Composition (UI s | 0/11 | 9/1/1 | — |
| 4.1 | F-026 Lookup Tables (Reference Data Management) | 0/12 | 8/3/1 | — |
| 4.1 | F-147 Search Result Row Click-Target — second UI clo | 0/9 | 5/3/1 | — |
| 4.0 | F-154 Term Create / Edit Form — Dialog with namespac | 0/12 | 7/1/4 | — |
| 4.0 | F-040 DQ Test Run History | 2/13 | 7/1/2 | — |
| 3.9 | F-146 Metadata Stale Indicator (orange-clock per-row | 1/12 | 6/2/1 | — |
| 3.9 | F-025 Query Examples (CRUD + Faceted Search) | 1/12 | 6/2/3 | — |
| 3.8 | F-013 Custom Metadata Field Editing | 0/13 | 8/4/1 | Y |
| 3.7 | F-004 Entity Description Editing | 1/12 | 7/1/3 | Y |
| 3.7 | F-037 F-037 | 0/12 | 7/1/4 | — |
| 3.5 | F-152 Term Reverse-Lookup — Linked Terms paginated t | 0/11 | 7/2/2 | — |
| 3.4 | F-153 Term Reverse-Lookup — Linked Columns paginated | 0/10 | 8/1/1 | — |
| 3.4 | F-007 AlertManager Integration | 0/14 | 8/2/3 | — |
| 3.4 | F-196 Per-Entity Activity Tab — Sibling Surface to G | 0/10 | 7/1/0 | — |
| 3.4 | F-035 F-035 | 0/13 | 7/3/3 | — |
| 3.4 | F-028 Namespace Lifecycle Management | 3/13 | 5/1/3 | Y |
| 3.4 | F-036 F-036 | 0/11 | 5/3/2 | — |
| 3.2 | F-042 Page-level UI Error Display + Missing-Route Fa | 1/11 | 8/0/2 | — |
| 3.2 | F-141 Catalog Overview Home Page composition | 4/11 | 5/2/1 | — |
| 3.1 | F-148 Search Result Class-Tab Filter — 9-tab class s | 3/12 | 6/1/3 | — |
| 3.1 | F-032 Quality Dashboard | 0/13 | 6/2/5 | — |
| 2.9 | F-039 GenAI Assistant | 1/13 | 3/7/0 | — |
| 2.8 | F-005 Lineage Graph Traversal | 2/14 | 8/2/0 | Y |
| 2.8 | F-034 F-034 | 0/11 | 5/3/2 | — |
| 2.7 | F-179 Overview Sidebar List Truncation — Tags / Term | 0/9 | 7/1/0 | — |
| 2.6 | F-161 Management Section Top-Level Chrome | 0/11 | 8/2/1 | — |
| 2.6 | F-001 Popular Entities Ranking | 0/13 | 7/4/2 | — |
| 2.6 | F-156 Term Tag + Owner Management — Overview right-r | 0/11 | 5/5/1 | — |
| 2.6 | F-126 Global Alerts List Page | 2/12 | 3/4/3 | Y |
| 2.5 | F-177 Entity Class / Type Badge Rendering on Detail  | 1/10 | 8/0/1 | Y |
| 2.5 | F-038 Data Collaboration (Slack Discussions) | 1/13 | 5/2/4 | — |
| 2.5 | F-017 Search Filter Facets | 2/13 | 4/5/2 | Y |
| 2.4 | F-151 Term Detail Page Composition (Overview / Linke | 3/13 | 6/1/2 | Y |
| 2.3 | F-009 WAL-driven Notification Delivery | 3/13 | 9/1/2 | — |
| 2.1 | F-191 Dataset Schema Revision Compare Viewer (UI sur | 0/11 | 7/1/3 | — |
| 2.1 | F-010 Housekeeping TTL Enforcement | 1/13 | 4/3/2 | — |
| 2.0 | F-198 Per-Entity Alert Notification Settings — opera | 0/11 | 9/1/1 | — |
| 2.0 | F-003 Popular Entities Ranking | 0/12 | 5/4/3 | — |
| 2.0 | F-002 Term-to-Entity Linkage | 1/5 | 3/0/1 | Y |
| 1.9 | F-155 Term Query-Example Linkage — assign existing Q | 1/11 | 8/2/0 | Y |
| 1.8 | F-142 User-Owner Association Request Workflow | 0/12 | 7/1/3 | — |
| 1.8 | F-033 Integration Wizard | 0/12 | 5/3/3 | — |
| 1.7 | F-024 Term Search & Browse (Dictionary tab) | 1/13 | 8/1/3 | Y |
| 1.7 | F-171 Operator-Facing Owner-Association Triage Workf | 2/12 | 7/4/0 | — |
| 1.3 | F-016 DEG-Anchored Lineage | 0/12 | 8/2/2 | — |
| 1.2 | F-176 Data Entity Overview Tab — Composed Reading Su | 1/12 | 8/1/2 | Y |
| 1.2 | F-174 Owner-Association History Audit-Trail Consumer | 0/11 | 6/3/2 | — |
| 1.2 | F-173 Active-tab Remove UserOwnerMapping (unbind aff | 0/11 | 5/3/0 | — |
| 1.2 | F-023 Directory Browsing — 4-level catalog drill-dow | 3/12 | 5/3/1 | — |
| 1.1 | F-197 Per-Entity Discussions Tab — operator-visible  | 2/11 | 6/1/2 | — |
| 0.9 | F-132 Query Example Detail Page Navigation | 0/11 | 10/0/1 | — |
| 0.9 | F-206 Entity Class / Type Badge Encoding | 4/11 | 5/0/2 | — |
</details>

