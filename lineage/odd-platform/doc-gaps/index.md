---
artefact: doc-gaps
generated_at: "2026-05-19T00:00:00Z"
generated_at_commit: 80637ed
sidecar_count: 65
concepts_yaml_version: 9
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 138
findings_by_severity: { HIGH: 65, MEDIUM: 57, LOW: 16 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 110, missing-page: 8, stale-page: 0, coverage-gap: 4, meta: 7 }
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041)."
  - "2026-05-12 (batch C): DOC-GAP-045..058 — refresh after batch 2026-05-12C (5 sidecars: 4 auth-mode SecurityConfiguration + NotificationsProperties). Auth-mode wiring-site blast-radius gaps surfaced (8 new HIGH); class-level DOC-GAP-058 captures GitBook legacy-route drift."
  - "2026-05-12 (batch D): DOC-GAP-059..071 — refresh after batch 2026-05-12D (5 config-properties-class sidecars). Primary-source POJO sidecars CONFIRM batch-C wiring-site findings AND surface 13 new findings."
  - "2026-05-12 (batch E): DOC-GAP-072..083 — refresh after batch 2026-05-12E (5 method-level RBAC sidecars). 4 new RBAC entity concepts + 1 new feature concept added."
  - "2026-05-12 (batch F): DOC-GAP-084..095 — refresh after batch 2026-05-12F (5 method-level sidecars on DataEntityController centerpiece + IngestionController)."
  - "2026-05-13 (batch G): DOC-GAP-096..103 — refresh after batch 2026-05-13-G (5 DataEntityController method-level sidecars)."
  - "2026-05-19 (batch H): DOC-GAP-104..112 — refresh after batch 2026-05-19-H (5 repository-layer sidecars). FIRST batch of repository-layer (SQL primary source) coverage in the catalog."
  - "2026-05-19 (batch I): DOC-GAP-113..127 — refresh after batch 2026-05-19-I (5 service-layer sidecars). FIRST batch of service-layer (business-invariant primary source) coverage in the catalog."
  - "2026-05-19 (batch J): DOC-GAP-128..138 — refresh after batch 2026-05-19-J (5 UI-axis sidecars: DataEntityDetails, fetchDataEntityDetails thunk, DataEntityDescription cluster, PopularStrip, LineageGraph). FIRST batch of UI-axis (consumer-surface primary source) coverage in the catalog — anchors findings on `*.tsx` and Redux thunks where consumer-visible behaviour is finally observable end-to-end. NEW HIGH findings: 2 (DOC-GAP-130 — LSN-017 +2 view_count doubling undocumented; DOC-GAP-137 — META: zero UI test coverage across entire SPA; the test harness is fully installed but ZERO `.test.tsx` files exist). NEW MEDIUM findings: 6 (DOC-GAP-128 — docs say 'click → Structure' code routes to Overview; DOC-GAP-129 — docs say 'panel visible under DISABLED' code hides it entirely; DOC-GAP-131 — UI hardcodes d=1, caps slider at 20, accepts unbounded `?d=` URL; DOC-GAP-132 — Diamond DAG amplification + silent crossEdge drop at UI canvas; DOC-GAP-134 — partial permission gating on description rendering; DOC-GAP-136 — AppError reflects backend URL/message verbatim). NEW LOW findings: 3 (DOC-GAP-133 — microservices lineage same component as data-entity lineage no toggle; DOC-GAP-135 — Shift+Enter save shortcut undocumented; DOC-GAP-138 — NaN-route-param has no client-side guard). STRENGTHENED existing findings: DOC-GAP-101 (now 5-sidecar — UI-side F-001 loop closure confirmed at consumer); DOC-GAP-105 (now 6-angle triangulation — feature page silent + api-ref unimplementable + controller NPE + repository no-default/no-bound/no-cycle/no-owner + service NPE-site/no-clamp/heap-amplification + **UI d=1 default + unclamped URL + diamond rendering + anchor-set negative-case**); DOC-GAP-096 (now 5-file UI cluster — partial-gating + P-009 empirical pin + platform-wide Markdown surface coupling); DOC-GAP-100 (now 4-sidecar — UI cluster confirmation of `[[ns:term]]` syntax + UI-vs-backend regex asymmetry); DOC-GAP-117 (5-vector compound webhook chain holds; UI markdown render confirmed at primary source). WebFetch GRANTED in current session: 4 live URLs re-verified at status 200 (catalog-overview, data-lineage, data-lineage/data-objects, api-reference/lineage); 2 additional spot-checks at status 200 (active-platform-features/alerting + data-discovery)."
maintainer_curated: false
confidence_overall: HIGH
---

# Doc gaps — odd-platform — 2026-05-19 (batch J refresh)

## Summary

- **Findings**: 138 total (65 HIGH, 57 MEDIUM, 16 LOW)
- **By category**: broken-url 9, drift 110, missing-page 8, coverage-gap 4, meta 7
- **By feature** (top affected concepts): Auth Mode (15), Data Entity (14), RBAC primary surface (Policy / Role / Owner / Permission) (12), **Lineage (8 — batch J adds DOC-GAP-131 + DOC-GAP-132 + DOC-GAP-133 UI-side angle; DOC-GAP-105 strengthens to 6-angle)**, Ingestion (8), Notifications (8), Search (3), Activity Feed (5), Attachment (5), Housekeeping TTL (4), DataCollaboration (4), Alert (7), AlertManager Webhook Receiver (5), GenAI Assistant (3), Slack collaboration app (3), Activity Table Partitioning (4), Multi-Tenant Configuration / Metrics Ingestion (1), Collector / Collector Token (2), Directory (2), Multilingual UI (1), **Popular ranking surface (5 — batch J STRENGTHENS DOC-GAP-101 with UI-side F-001 loop closure)**, **Data Entity Description cluster (5 — batch J STRENGTHENS DOC-GAP-096 to 5-file UI cluster + adds DOC-GAP-134 partial-gating + DOC-GAP-135 Shift+Enter)**, **UI Test Coverage (1 NEW META — DOC-GAP-137 — zero `.test.tsx` files across the entire SPA)**, **Catalog-overview live-page (2 NEW — DOC-GAP-128 click-target mismatch + DOC-GAP-129 DISABLED-mode rendering mismatch)**
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). **Batch J adds 11 NEW findings (2 HIGH + 6 MEDIUM + 3 LOW) AND strengthens 5 existing findings with UI-AXIS consumer-surface primary-source evidence** — the FIRST batch to anchor findings on `*.tsx` React components and Redux thunks where consumer-visible behaviour is finally observable end-to-end:
  - (aa) **NEW batch J: DOC-GAP-128 — Live `/features/data-discovery/catalog-overview` says "Clicking a tile opens that entity's Structure page" — code routes to Overview tab.** Direct factual contradiction between a published manual and the code; file:line-anchored on both sides (`DataEntityList.tsx:38` + `dataEntitiesRoutes.ts:66-73` default `path='overview'` vs live-page verbatim quote). MEDIUM — the Overview tab is also the LSN-017 +2 view_count producer; the doc correction composes with DOC-GAP-130.
  - (bb) **NEW batch J: DOC-GAP-129 — Live catalog-overview says "on auth-disabled deployments the panel is visible" — code HIDES the entire Recommended panel under DISABLED.** Direct factual mismatch; `Overview.tsx:25-27, :53-59` structurally precludes the documented behaviour on the platform's DEFAULT config (DISABLED). The doc-product asserts a feature behaviour the code structurally precludes; operators following the doc on default deployments see the panel missing entirely. MEDIUM — published-manual coherence failure on the most-trafficked page.
  - (cc) **NEW batch J: DOC-GAP-130 — LSN-017 +2 view_count doubling per detail-page-open undocumented end-to-end.** The Popular ranking surface (`catalog-overview`) names "most-viewed" but is silent on (a) the per-page-open multiplicity (+2 not +1 under the bug), (b) detail-page-open IS the read-as-write trigger, (c) the dep-array bug locus. 4 UI sidecars + 1 backend repository converge; empirically pinned by P-004 (xhr_count=2 + DB delta=2 with regex-filtered exact path match). HIGH — the platform's marquee recommendation surface is twice as sensitive to legitimate browsing as the docs describe AND is structurally inflatable; operators evaluating ODD for public-facing or multi-team catalogs have NO doc-side signal that Popular is manipulable nor that the manipulation surface is twice the documented size. Fix is a one-line UI edit at `DataEntityDetails.tsx:63` (remove `details.status?.status` from dep-array) + a doc-side caveat-addition.
  - (dd) **NEW batch J: DOC-GAP-131 — UI Lineage canvas hardcodes d=1 + caps depth slider at [1..20] + accepts unbounded `?d=` URL param.** Three caveats invisible across THREE WebFetched live pages (`/features/data-lineage` + `/features/data-lineage/data-objects` + `/developer-guides/api-reference/lineage`). The api-reference's "Unset returns the platform's default depth" claim is UNREACHABLE from the UI (which always supplies d=1). A curious user hand-editing `?d=10000` reaches the unbounded REFACTOR-202 amplification surface. MEDIUM — three doc updates + one-line UI clamp.
  - (ee) **NEW batch J: DOC-GAP-132 — UI Lineage canvas amplifies diamond DAGs into duplicate visual nodes + silently drops crossEdges that reference missing nodes.** `d3-hierarchy` builds a TREE not a DAG; diamond shapes render the bottom vertex twice; crossEdge resolution does silent `.find(...).undefined` drop. Neither behaviour documented. MEDIUM — the marquee F-005 visual surface; operators cannot self-diagnose duplicate nodes.
  - (ff) **NEW batch J: DOC-GAP-134 — Permission docs name `DATA_ENTITY_DESCRIPTION_UPDATE` but do NOT say content render is unconditional for any `DATA_ENTITY_VIEW` holder.** The partial-gating semantic (Edit button gated, Markdown content NOT gated) is undocumented; the maintainer's INTENT is captured at `InternalDescriptionHeader.tsx:40-50` (wrap only the BUTTON) but the universal-read posture for description CONTENT is unsaid. Combined with DOC-GAP-096 + DOC-GAP-117 the XSS chain is invisible to operators evaluating ODD multi-tenant. MEDIUM — single-paragraph addition to the Permissions doc page.
  - (gg) **NEW batch J: DOC-GAP-137 META — ZERO UI test coverage across the entire `odd-platform-ui` SPA.** Vitest + @testing-library/react + jsdom installed; `test`/`test:coverage` scripts declared; ZERO `.test.tsx`/`.spec.tsx` files exist anywhere. 57 named uncovered UI behaviours surface across 5 batch-J sidecars; every regression that breaks the dep-array (LSN-017), the click-target (DOC-GAP-128), the DISABLED-mode gate (DOC-GAP-129), the depth-clamp (DOC-GAP-131), the partial-gating (DOC-GAP-134), or the XSS-defence-in-depth (DOC-GAP-096 / DOC-GAP-117 / DOC-GAP-134) ships invisibly. HIGH — the platform's hottest user-facing flows are enforced today by manual exercise and the probe-runs suite alone. Highest-leverage developer-guide-page addition is canonical-home for "how to test the UI" + TEST-GAP-NNN cluster.
  - (hh) **STRENGTHENED batch J: DOC-GAP-105 to 6-angle triangulation** — UI-layer adds d=1 hardcoded default + unclamped URL `?d=` + diamond DAG visual amplification + anchor-set defence-in-depth NEGATIVE-case realisation point. Lineage canvas is the consumer-facing F-005 surface; every gap has now been pinned at every layer (controller + service + repository + UI).
  - (ii) **STRENGTHENED batch J: DOC-GAP-101 to 5-sidecar** — UI-side F-001 loop closure: Popular click → Overview tab → `fetchDataEntityDetails` → `+1 view_count` → next refresh ranks higher → click again. NO debounce, NO idempotency, NO per-tab-per-entity cache; the surface that displays the ranking IS the surface that drives the ranking. **Under the LSN-017 doubling (DOC-GAP-130) each click is +2.**
  - (jj) **STRENGTHENED batch J: DOC-GAP-096 to 5-file UI cluster** — `Markdown.tsx` is the SOLE Markdown renderer on the platform; the rehype-pipeline coupling is platform-wide (alerts + queries + term definitions + dataset-field descriptions + owner descriptions all share the surface). P-009 empirical pin holds; the defence-in-depth is Chromium HTML-parser policy + React attribute filtering, NOT application-layer; a future regression (e.g. switching to `dangerouslySetInnerHTML`, relaxing CSP, SVG `onload` payload) re-opens silently.
  - (kk) **STRENGTHENED batch J: DOC-GAP-100 to 4-sidecar** — UI-vs-backend regex asymmetry surfaced: UI `TERM_PATTERN = /\[\[([^:\]]+):([^\]]+)\]\]/g` requires non-empty groups; backend allows empty groups; `[[:foo]]` and `[[foo:]]` parse differently across layers.

Batch H-and-prior meta-recommendations (preserved):
  - (n) **batch H: DOC-GAP-082 META 13-sidecar (DISABLED-bypasses-RBAC-primary-surface)**.
  - (o) **batch H: DOC-GAP-083 META 4-layer (No-audit-log on RBAC mutations + ownership-binding-vs-directory-CRUD asymmetry)** — extended to PolicyServiceImpl service-layer in batch I.
  - (p) **batch H: DOC-GAP-105 supersedes DOC-GAP-021 with SQL primary-source** — extended to 6-angle in batch J.
  - (q) **batch H: CROSS-BATCH CORRECTION (DOC-GAP-108 — 5xx misclaim → 400 USR003)**.
  - (r) **batch H: DOC-GAP-106 closes the AUTHORIZATION HOT PATH soft-delete leak**.
  - (s) **batch H: First SQL-injection finding (DOC-GAP-104)**.

Batch I-and-prior meta-recommendations (preserved):
  - (t) **batch I: DOC-GAP-113 + DOC-GAP-114 — Ingestion silent destruction LSN-001 family**.
  - (u) **batch I: DOC-GAP-115 — Lineage anchor-set asymmetry positive vs negative case**.
  - (v) **batch I: DOC-GAP-116 META — Service-tier transaction-boundary pattern is undocumented platform-wide ADR**.
  - (w) **batch I: DOC-GAP-117 — AlertManager webhook XSS via UI markdown render** — UI primary source confirmed at batch J (DOC-GAP-096 cluster).
  - (x) **batch I: DOC-GAP-105 strengthens to 5-angle** — extended to 6-angle in batch J with UI layer.
  - (y) **batch I: DOC-GAP-122 — PolicyService lost-update race**.
  - (z) **batch I: DOC-GAP-097 + DOC-GAP-083 + DOC-GAP-107 + DOC-GAP-110 + DOC-GAP-073 strengthened with service-layer primary-source confirmation**.

Batch F-and-prior meta-recommendations (preserved): (i)-(s) — see prior frontmatter.
Batch E-and-prior meta-recommendations (preserved): (e)-(h) — see prior frontmatter.
Batch D-and-prior meta-recommendations (preserved): (a)-(d) — see prior frontmatter.
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages.
  - **Doc-text-vs-code audience drift** (2026-05-10A).
  - **Triangulated default-open posture** (2026-05-10B → batch I).
  - **Documentation-overstates-config-effect** (2026-05-10B + 2026-05-12D + batch F).
  - **GitBook legacy-route 404 cluster**.
  - **Auth-mode-wiring-site blast-radius gap** (2026-05-12C).
  - **Notifications subsystem under-documented for operations** (2026-05-12C + D).
  - **2026-05-12D: Housekeeping subsystem doc completeness**.
  - **2026-05-12D: OAuth2 docs internal inconsistency**.
  - **2026-05-19 batch H: Repository-layer SQL primary-source confirms 8 existing findings AND surfaces 5 new HIGH**.
  - **2026-05-19 batch H: First SQL-injection in the catalog (DOC-GAP-104)**.
  - **2026-05-19 batch H: First cross-batch correction propagated (DOC-GAP-108)**.
  - **2026-05-19 batch I: Service-layer business-invariant primary-source confirms 6 existing findings AND surfaces 15 new (5 HIGH + 8 MEDIUM + 2 LOW)**.
  - **2026-05-19 batch I: First META on a platform-wide ADR-grade architectural pattern (DOC-GAP-116)**.
  - **2026-05-19 batch I: Ingestion silent-destruction LSN-001 family (DOC-GAP-113 + DOC-GAP-114)**.
  - **NEW 2026-05-19 batch J: UI-axis consumer-surface primary-source confirms 5 existing findings AND surfaces 11 new (2 HIGH + 6 MEDIUM + 3 LOW)** — for the first time the catalog is anchored on `*.tsx` and Redux thunks where consumer-visible behaviour is observable. The pattern from batch J: the UI layer is where docs-vs-code mismatches become operator-observable; the same Markdown component is the platform-wide XSS surface; the same `<Lineage />` component handles both data-entity and microservices lineage; the same `useEffect` dep-array drives LSN-017 doubling AND the F-001 ranking inflation; the UI's URL parameters are an UNCLAMPED surface to the backend's amplification gaps.
  - **NEW 2026-05-19 batch J: First META on UI test coverage absence (DOC-GAP-137)** — the test harness is fully installed (Vitest + @testing-library + jsdom + scripts); ZERO test files exist; 57 named uncovered behaviours across 5 sidecars. Highest-leverage developer-guide-page is the canonical-home for "how to test the UI" + the first batch of TEST-GAP-NNN regressions to author.
  - **NEW 2026-05-19 batch J: Two NEW factual doc-vs-code mismatches on the catalog-overview live page (DOC-GAP-128 + DOC-GAP-129)** — both Principal-engineer-quality publishing failures; both fixable with one-line doc edits. The Recommended panel section is a high-traffic-page coherence failure.

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 138

---

## DOC-GAP-001 — DataEntity `/term` vs `/terms` path mismatch silently disables DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM gates — undocumented on Permissions page

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-001.md`

---

## DOC-GAP-002 — Alerting feature page does not warn that `getAllAlerts` exposes every platform alert to any authenticated user; doc text names "stewards and admins" audience while code enforces any authenticated user

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-002.md`

---

## DOC-GAP-003 — AlertManager Webhook Receiver lacks rate-limit / payload-cap / dedup / spoofing caveats on operator-facing config page

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-003.md`

---

## DOC-GAP-004 — Attachment feature page does not warn about read-path authorization asymmetry (GET endpoints unprotected)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-004.md`

---

## DOC-GAP-005 — Attachment max-file-size cap is client-side-only; non-browser caller can submit arbitrary-size files — undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-005.md`

---

## DOC-GAP-006 — `/actuator/env` exposes S3/MinIO credentials by default — undocumented on Attachment Storage page (**REFINED batch D**: Spring Boot 3.4.10's `show-values: NEVER` default DOES mask values; the durable leak surface is Lombok-toString — see DOC-GAP-067)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-006.md`

---

## DOC-GAP-007 — GenAI feature page lacks prompt-injection / SSRF / DISABLED-anonymous-reachability caveats

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-007.md`

---

## DOC-GAP-008 — Directory feature page does not warn that the surface is platform-wide and bypasses owner-scoping (reconnaissance surface)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-008.md`

---

## DOC-GAP-009 — `developer-guides/api-reference` does not document the 40 dataEntity operations — punts to Swagger UI

**Severity**: HIGH
**Category**: coverage-gap

**Full detail**: `detail/DOC-GAP-009.md`

---

## DOC-GAP-010 — Attachment chunked-upload protocol (3-step state machine) undocumented anywhere; cross-entity uploadId hijack now confirmed at method level

**Severity**: HIGH
**Category**: coverage-gap

**Full detail**: `detail/DOC-GAP-010.md`

---

## DOC-GAP-025 — Activity Feed exposes cross-owner audit trail (`old_state`/`new_state` diffs) to any authenticated user — undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-025.md`

---

## DOC-GAP-029 — No `/developer-guides/api-reference/activity` page — global Activity feed has no first-party API reference

**Severity**: HIGH
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-029.md`

---

## DOC-GAP-032 — Slack Data Collaboration cross-tenant message injection + missing authorization gate undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-032.md`

---

## DOC-GAP-036 — `auth.type=DISABLED` is the application.yml-bundled default but live `enable-security/authentication` pages do NOT state this — operator following the docs ships an unauthenticated platform without explicit opt-in

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-036.md`

---

## DOC-GAP-037 — `/api/appInfo` discloses active `auth.type` + `projectVersion` to unauthenticated network callers under DISABLED-default — passive fingerprinting surface, undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-037.md`

---

## DOC-GAP-038 — `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-038.md`

---

## DOC-GAP-039 — `auth.type=LOGIN_FORM` runs WITHOUT the authorization framework (Policies / Permissions / Roles / Owners) — `Authorization` page describes the framework with no mention of which auth modes wire it

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-039.md`

---

## DOC-GAP-041 — Activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code never DROPs activity partitions AND housekeeping has no `activity*Days` field; the retention claim is materially incorrect (**2-angle CONFIRMED batch D**)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-041.md`

---

## DOC-GAP-045 — `disabled-authentication` page declares DISABLED "the default configuration" with a single production-warning, but omits the full blast radius (CSRF / CORS / actuator / S2S-ignored / audit-absence / no boot WARN)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-045.md`

---

## DOC-GAP-046 — OAuth2/OIDC docs list 7 supported providers (AWS Cognito, GitHub, Google, Azure AD, Okta, Keycloak, Custom OIDC) but `Provider` enum has only 5; Okta/Keycloak operators silently get no provider-specific user enrichment and no provider-specific logout (**2-angle CONFIRMED batch D from primary-source POJO sidecar**; see also DOC-GAP-069, DOC-GAP-070 for batch-D-surfaced refinements: ODD_IAM completely absent from docs, `adminUserInfoFlag` field undocumented)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-046.md`

---

## DOC-GAP-047 — OAuth2 docs reference `azure-tenant-id` config key + use `${auth.oauth2.client.azure.azure-tenant-id}` interpolation, but `ODDOAuth2Properties.OAuth2Provider` POJO has NO `azureTenantId` field — Azure YAML example is not deployable as-shown

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-047.md`

---

## DOC-GAP-048 — OAuth2 docs flag Azure `logout-uri` as REQUIRED ("unset value causes NullPointerException") but `ODDOAuth2Properties.validate()` only checks `clientId` and `provider` — operator boots successfully and fails at first logout

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-048.md`

---

## DOC-GAP-049 — OAuth2/OIDC docs do NOT mention `auth.s2s.enabled` or the S2S composition with OAUTH2 — operators deploying OAuth2 + S2S see an undocumented X-API-Key → ADMIN-across-all-paths surface

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-049.md`

---

## DOC-GAP-050 — LDAP `auth.ldap.password` leak surface — actuator-env value-mask is operator-overridable AND the **durable** leak vector is Lombok `@Data`-generated `toString()` (**REFINED batch D**)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-050.md`

---

## DOC-GAP-051 — LDAP setup page omits `ldap://` vs `ldaps://` scheme guidance, substring-match admin-groups collision risk, empty admin-groups → no admins, S2S composability, `management.health.ldap.enabled` default false, and timeout/pooling configuration — seven distinct caveats absent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-051.md`

---

## DOC-GAP-052 — LOGIN_FORM page omits `auth.login-form-redirect` config key (open-redirect surface), the absence of the authorization framework (DOC-GAP-039 sibling), session-cookie security flags, S2S composability, plain-text credential leak via `/actuator/env`, and CSRF posture — six distinct caveats absent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-052.md`

---

## DOC-GAP-053 — **META-FINDING** — "docs frame default behaviour but omit blast radius" pattern (3-sidecar triangulated; cross-cutting class)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-053.md`

---

## DOC-GAP-054 — Notifications subsystem: no rate-limit / queue / backpressure — bursty alert events translate 1:1 into outbound HTTP/SMTP requests; Slack will rate-limit (429), SMTP/webhook receivers will be overwhelmed

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-054.md`

---

## DOC-GAP-055 — Notifications subsystem: no audit trail of delivery (no DB record, no metric, only DEBUG-level log) — operators cannot answer "did the alert get delivered?" or "which alerts went to which channels?"

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-055.md`

---

## DOC-GAP-059 — Housekeeping TTL Java-default vs YAML-default mismatch — operator overriding application.yml without the housekeeping block silently rebinds to 0 (Java `int` default) → next 15-min housekeeping cycle hard-deletes ALL resolved alerts, ALL search-facet history, ALL soft-deleted entities (LSN-001 shape, undocumented)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-059.md`

---

## DOC-GAP-061 — No `messageDays` retention field for the DataCollaboration `MESSAGE` table — `housekeeping.ttl.*` surface has 3 fields, none target messages; symmetric to DOC-GAP-041 activity-feed gap (silent unbounded growth)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-061.md`

---

## DOC-GAP-063 — OAuth2 docs internal inconsistency — descriptive prose uses `username-attribute` (no hyphen) but every YAML example uses `user-name-attribute` (hyphenated); Spring relaxed binding maps `user-name-attribute` (not `username-attribute`) to the `userNameAttribute` POJO field; operators copy-pasting the prose key get silent binding failure

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-063.md`

---

## DOC-GAP-067 — **META-FINDING** — Lombok `@Data` toString sensitive-field leak class (4-sidecar triangulated)

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-067.md`

---

## DOC-GAP-069 — ODD_IAM provider is in the `Provider` enum but COMPLETELY ABSENT from the OAuth2/OIDC docs page — operators deploying ODD_IAM have no doc surface (drift in the other direction — POJO supports a provider docs don't name)

**Severity**: HIGH
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-069.md`

---

## DOC-GAP-070 — `adminUserInfoFlag` field is the ODD_IAM admin-detection mechanism but is undocumented on the OAuth2/OIDC docs page (sub-finding of DOC-GAP-069)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-070.md`

---

## DOC-GAP-072 — Roles live doc page omits the entire role-creation API surface — `POST /api/roles`, `ROLE_CREATE` permission, name uniqueness rules, audit-absence, predefined-name reservation asymmetry, S2S-ADMIN interaction, and the spec-vs-code 201-vs-200 drift (5 doc-drift findings against one page)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-072.md`

---

## DOC-GAP-073 — Policies live doc page omits POLICY_CREATE permission, Administrator-bootstrap, audit-trail absence, `GET /api/policies/schema` endpoint, and DISABLED-mode bypass (keys-to-the-kingdom under DISABLED — 5 doc-drift findings) **(batch H STRENGTHENS to 7 sub-findings via DOC-GAP-106 + DOC-GAP-112; batch I adds 8th: concurrency model + pagination asymmetry — see DOC-GAP-122 + DOC-GAP-123 + DOC-GAP-126)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-073.md`

---

## DOC-GAP-076 — PermissionController read-side discovery endpoint `GET /api/resource/{type}/{id}/permissions` is undocumented across the 3 canonical `/authorization/*` live pages — operators auditing the security model cannot discover the platform's "what can I do?" surface

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-076.md`

---

## DOC-GAP-079 — Search feature page (canonical `/features/data-discovery/search`) is silent on WHO can search + cross-owner catalog enumeration — the platform's WIDEST cross-owner read surface is undocumented (3rd corroborating surface for read-collaborative posture)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-079.md`

---

## DOC-GAP-082 — **META-FINDING** — DISABLED-bypasses-RBAC-primary-surface pattern **(now 13-sidecar triangulation, batch H STRENGTHENS from 8 to 13 with 5 repository-layer sidecars confirming the SQL primary source on read-and-write paths)**

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-082.md`

---

## DOC-GAP-083 — **META-FINDING** — No-audit-log on RBAC mutations pattern **(batch H STRENGTHENS with repository-layer forensic-silence confirmation + ownership-edge partial-exception evidence; batch I STRENGTHENS to 4-layer triangulation for PolicyServiceImpl with maintainer-intent capture of ownership-binding-vs-directory-CRUD design asymmetry)**

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-083.md`

---

## DOC-GAP-096 — Markdown rendering on data-entity descriptions is not sanitised at the backend AND the UI's `rehype-raw` configuration has no `rehype-sanitize` — stored-content-injection surface entirely undocumented **(batch J STRENGTHENS to 5-file UI cluster — partial-gating + P-009 empirical pin + platform-wide Markdown surface coupling; same component renders alerts/queries/term-definitions/dataset-field-descriptions/owner-descriptions/AlertManager-supplied URLs)**

**Severity**: HIGH
**Category**: drift (security caveat absent on doc page covering the feature)

**Full detail**: `detail/DOC-GAP-096.md`

---

## DOC-GAP-097 — `PUT /api/dataentities/{id}/description` is a pure UPDATE with silent no-op on missing entity — operationId, OpenAPI summary, and consumer expectation all use "upsert" language that contradicts the implementation **(batch I STRENGTHENS with service-tier confirmation that extends to sibling field `upsertBusinessName`; maintainer-intent captured as deliberate per-write-shape asymmetry)**

**Severity**: HIGH
**Category**: drift (OpenAPI contract drift; spec asserts upsert; implementation is replace-or-silently-200)

**Full detail**: `detail/DOC-GAP-097.md`

---

## DOC-GAP-098 — `createDataEntityTagsRelations` operationId is misleading — semantic is replace-all (delete missing) but spec/operationId/method-name say "create" (additive); third-party consumers will silently lose tags

**Severity**: HIGH
**Category**: drift (OpenAPI contract drift; create-language for replace-all behaviour)

**Full detail**: `detail/DOC-GAP-098.md`

---

## DOC-GAP-099 — `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` OpenAPI summary literally describes the wrong semantic — claims response is owned-with-lineage; actual response is NON-owned entities reachable from owned set **(batch H STRENGTHENS with SQL primary-source confirmation of anchor-set defence-in-depth pattern)**

**Severity**: HIGH
**Category**: drift (OpenAPI contract drift; spec summary is the inverse of implementation)

**Full detail**: `detail/DOC-GAP-099.md`

---

## DOC-GAP-104 — SQL-injection vector in `ReactiveDataEntityRepositoryImpl.getHighlightedResult` — `String.formatted(text, tsQuery)` interpolates user-controllable `internal_description` / `internal_name` / tags + search query into raw SQL passed to `DSL.field(sql, ...)`; no escaping, no parameterisation, no length cap — first SQL-injection-class finding in the catalog

**Severity**: HIGH
**Category**: drift (security caveat absent on doc pages covering the affected writer + reader surfaces)

**Full detail**: `detail/DOC-GAP-104.md`

---

## DOC-GAP-105 — Lineage recursive-CTE at the SQL primary source has NO cycle guard, NO upper bound on `lineageDepth`, NO owner JOIN — supersedes DOC-GAP-021 framing with primary-source evidence; combined with controller-layer NPE on null default (DOC-GAP-089) + inverse-semantic OpenAPI summary (DOC-GAP-099), 4-angle confirmed **(batch I extends to 5-angle with service-layer null-NPE site + no-clamp + heap-amplification; batch J extends to 6-angle with UI-layer d=1 default + unclamped `?d=` URL + diamond rendering + anchor-set negative-case realisation)**

**Severity**: HIGH
**Category**: drift (live `/features/data-lineage` silent on depth/cycle/owner; api-ref's "Unset returns default" is unimplementable)

**Full detail**: `detail/DOC-GAP-105.md`

---

## DOC-GAP-106 — `ReactivePolicyRepositoryImpl.getRolesPolicies` does NOT filter soft-deleted policies on the RBAC authorization hot path — direct-DB soft-delete produces ghost-permission policies that silently keep granting access; single-line `AND policy.deleted_at IS NULL` fix closes structurally

**Severity**: HIGH
**Category**: drift (live `/authorization/policies` silent on soft-delete semantics + ghost-binding risk + direct-DB caveat; partial-index design + cascade-FK-absence undocumented)

**Full detail**: `detail/DOC-GAP-106.md`

---

## DOC-GAP-107 — AlertManager webhook `POST /ingestion/alert/alertmanager` bypasses `IngestionDataEntitiesFilter` (filter only matches `/ingestion/entities`) AND `ReactiveAlertRepositoryImpl.createAlerts` has NO `ON CONFLICT` — combined: unauthenticated caller can POST AlertManager-shaped payloads with attacker-chosen `entity_oddrn` AND no de-duplication on retry; strengthens DOC-GAP-003 + DOC-GAP-038 **(batch I extends to 5-vector compound — adds DOC-GAP-117 generatorURL XSS via UI markdown render + DOC-GAP-125 LocalDateTime timezone-naive startsAt)**

**Severity**: HIGH
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` warns generically about "no application-layer auth" but does not enumerate the 5 specific vectors)

**Full detail**: `detail/DOC-GAP-107.md`

---

## DOC-GAP-108 — CROSS-BATCH CORRECTION — batch-F `createOwnership` sidecar's "5xx on duplicate" claim is WRONG; actual surface is HTTP 400 with `USR003` (`UniqueConstraint`) and friendly message "Ownership for this data entity and owner already exists" — AND this error shape is undocumented in OpenAPI, in the permissions live page, and in the owners live page

**Severity**: HIGH
**Category**: drift (substrate misclaim correction + class-wide OpenAPI 400-USR003 undeclared on every create endpoint with a UNIQUE constraint translation)

**Full detail**: `detail/DOC-GAP-108.md`

---

## DOC-GAP-113 — IngestionService silent metadata-delete-on-absence — `MetadataIngestionRequestProcessor.process` issues `bindingsToDelete = existingMetadataBindings.difference(currentBindings)` then `metadataFieldValueRepository.delete(bindingsToDelete)` INSIDE the per-request transaction with NO log.warn on the delete branch; a collector that emits incomplete metadata silently destroys platform-side data with no operator visibility; LSN-001-shape silent-data-loss surface

**Severity**: HIGH
**Category**: drift (replace-not-merge contract is an INTENTIONAL maintainer-design choice — implicit_adrs.[4] — but is undocumented operator-facing on `/integrations/ingestion-filters` or `/developer-guides/api-reference`)

**Full detail**: `detail/DOC-GAP-113.md`

---

## DOC-GAP-114 — IngestionService silent lineage-edge-delete-on-absence — `LineageServiceImpl.replaceLineagePaths` does `batchDeleteByEstablisherOddrn(establishers)` then `batchInsertLineages(pojos)` inside one transaction; a collector that emits a partial sourceList silently destroys the rest of the establisher's lineage edges; LSN-001-shape sibling to DOC-GAP-113

**Severity**: HIGH
**Category**: drift (operator-facing `/features/data-lineage` and `/developer-guides/api-reference/lineage` silent on per-ingestion replace semantics; the verb `replaceLineagePaths` is the structural decision)

**Full detail**: `detail/DOC-GAP-114.md`

---

## DOC-GAP-115 — Lineage service-layer anchor-set defence asymmetry — `LineageServiceImpl.getLineage` has NO `AuthIdentityProvider` field, NO `fetchAssociatedOwner` call; `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns` DOES; positive-vs-negative-case asymmetry one directory apart on the SAME underlying repository; lineage canvas is the cross-owner enumeration sink while the seemingly-equivalent "My objects with lineage" feature is owner-scoped

**Severity**: HIGH
**Category**: drift (live `/features/data-lineage` silent on visibility model; the canvas-vs-my-objects asymmetry is invisible to operators evaluating ODD for multi-tenant deployments)

**Full detail**: `detail/DOC-GAP-115.md`

---

## DOC-GAP-116 — **META-FINDING** — Service-tier `@ReactiveTransactional` boundary pattern is a platform-wide ADR-grade architectural decision (every reactive service places txn boundaries at the service; every Reactive*RepositoryImpl is un-annotated) but is undocumented at any layer; within-service asymmetries (RoleServiceImpl IS transactional, PolicyServiceImpl is NOT; updateStatus delegates to a downstream-annotated method) are also undocumented

**Severity**: HIGH
**Category**: drift (meta — pattern-vs-doc divergence on a structural decision; affects every developer-guide page describing platform writes)

**Full detail**: `detail/DOC-GAP-116.md`

---

## DOC-GAP-117 — AlertManager webhook `generatorURL` field is embedded verbatim into chunk description via `String.format("Distribution Anomaly. URL: %s", queryUrl)`; combined with DOC-GAP-096 (UI markdown render without sanitisation) AND DOC-GAP-038 (unauthenticated webhook), any network-reachable caller can plant a wire-XSS chain that fires in any platform user's session viewing the alert; 4th attack vector on DOC-GAP-107's compound finding

**Severity**: HIGH
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` covers wiring without warning about untrusted-URL embedding; the cross-attack-surface chain is invisible)

**Full detail**: `detail/DOC-GAP-117.md`

---

## DOC-GAP-130 — LSN-017 +2 view_count per detail-page-open undocumented end-to-end — Popular ranking is twice as sensitive to legitimate browsing as the docs describe; mechanism (read-as-write detail-page; dep-array bug at `DataEntityDetails.tsx:63`) invisible across `catalog-overview` + `Popular` doc surfaces; empirically pinned by P-004

**Severity**: HIGH
**Category**: drift (live `catalog-overview` describes Popular as "most-viewed" without naming the per-page-open multiplicity, the read-as-write trigger, or the UI bug locus; 4 UI sidecars + 1 backend repository converge)

**Full detail**: `detail/DOC-GAP-130.md`

---

## DOC-GAP-137 — **META-FINDING** — ZERO UI test coverage across the entire `odd-platform-ui` SPA — Vitest + @testing-library/react + jsdom installed; `test`/`test:coverage` scripts declared; ZERO `.test.tsx`/`.spec.tsx` files exist anywhere; 57 named uncovered behaviours surface across 5 batch-J sidecars; the platform's hottest user-facing flows are enforced today by manual exercise and the probe-runs suite alone

**Severity**: HIGH
**Category**: meta (cross-cutting; pairs with the test-coverage-mapper reducer's TEST-GAP-NNN cluster)

**Full detail**: `detail/DOC-GAP-137.md`

---

## DOC-GAP-011 — Legacy URL `/active-platform-features/alerting` returns 404 — canonical at `/features/active-platform-features/alerting`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-011.md`

---

## DOC-GAP-012 — Legacy URL `/active-platform-features/genai` returns 404 — canonical at `/features/active-platform-features/genai`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-012.md`

---

## DOC-GAP-013 — Legacy URL `/data-discovery/attachments` returns 404 — canonical at `/features/data-discovery/attachments`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-013.md`

---

## DOC-GAP-014 — Legacy URL `/data-discovery/directory` returns 404 — canonical at `/features/data-discovery/directory`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-014.md`

---

## DOC-GAP-015 — Legacy URL `/main-concepts` returns 404 — canonical at `/introduction/main-concepts.md`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-015.md`

---

## DOC-GAP-016 — Directory page wording: level 3 mixes "classes" and "types" — operator confusion

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-016.md`

---

## DOC-GAP-017 — GenAI feature page: OpenAPI spec declares only 200 OK — no documented 400/500 error contract for `/api/genai/ask`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-017.md`

---

## DOC-GAP-018 — API spec carries no `security:` block and no `components.securitySchemes` — invariant of contract-vs-runtime mismatch undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-018.md`

---

## DOC-GAP-019 — Concept "AlertManager Webhook Receiver" is a canonical_candidate but not a registered term in `main-concepts.md`

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-019.md`

---

## DOC-GAP-020 — Concept "Locale Bundle" / "Multilingual UI" — F-047 is filed; cross-referenced here

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-020.md`

---

## DOC-GAP-021 — Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat **(batch H: superseded by DOC-GAP-105 with SQL primary-source; cross-referenced here)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-021.md`

---

## DOC-GAP-022 — Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-022.md`

---

## DOC-GAP-023 — Cross-entity uploadId hijack (Attachment) — undocumented; method-level evidence confirms the attack shape

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-023.md`

---

## DOC-GAP-030 — Activity Feed feature page omits `type` parameter, visibility model, cursor pagination mechanics

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-030.md`

---

## DOC-GAP-033 — Slack Data Collaboration api-reference page omits authentication/authorization/validation/rate-limit

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-033.md`

---

## DOC-GAP-034 — Token Rotation operational mechanics (grace period, audit logging, plaintext-in-response, in-flight 401) absent from enable-security pages

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-034.md`

---

## DOC-GAP-035 — `/active-platform-features/data-collaboration` returns 404 on legacy URL — canonical at `/features/active-platform-features/data-collaboration`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-035.md`

---

## DOC-GAP-040 — `AuthorizationManagerCondition` is unwired dead code — Authorization page describes the framework as if a centralised condition gates it

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-040.md`

---

## DOC-GAP-042 — Activity-feed partition WIDTH is `2 × partition-period` (60 days at default) but docs say "a new partition every 30 days"

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-042.md`

---

## DOC-GAP-043 — Activity-feed partition CREATE failures are silently swallowed; operator has no metric / alert / health-check signal — undocumented; `partition.advisory-lock-id` undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-043.md`

---

## DOC-GAP-056 — Legacy URL `/active-platform-features/notifications` returns 404 — canonical at `/features/active-platform-features/notifications`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-056.md`

---

## DOC-GAP-057 — Notifications subsystem under-documents operational caveats — dead `notifications.webhookUrl` field, no per-channel filtering, no PII redaction, replication-slot orphan risk on rename, webhook unsigned delivery

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-057.md`

---

## DOC-GAP-058 — **META-FINDING** — GitBook legacy-vs-canonical routing drift is a cross-cutting class (**now 3-sidecar triangulated after batch E: DataCollaboration + Notifications + Search**); recommend a doc-side audit of ALL legacy paths

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-058.md`

---

## DOC-GAP-060 — Housekeeping docs frame the subsystem as "three cleanup tasks" but code has 5 HousekeepingJob beans — `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` are undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-060.md`

---

## DOC-GAP-062 — AlertHousekeepingJob jOOQ-precedence bug acknowledged in docs but unlinked to a tracking issue / no workaround documented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-062.md`

---

## DOC-GAP-064 — DataCollaboration lock-id collision risk undocumented — operators tuning the four advisory-lock IDs (`partition.advisory-lock-id=90`, `notifications.wal.advisory-lock-id=100`, `datacollaboration.receive-event-advisory-lock-id=110`, `datacollaboration.sender-message-advisory-lock-id=120`) get no guardrails; operator who copies default 100 to data-collab silently breaks both subsystems

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-064.md`

---

## DOC-GAP-066 — Email channel config doc completeness — `port`=int default 0 cliff, boxed Boolean nullability, modern SMTP-AUTH OAUTH2 absent, no Reply-To / Cc / Bcc / DKIM support, sender no `@Email` validation, recipient list comma-split has no per-address trim

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-066.md`

---

## DOC-GAP-068 — **META-FINDING** — Partial-home pattern: `@ConfigurationProperties` POJOs bind only a subset of their config-prefix's keys; docs that enumerate the prefix don't surface the @Value-scattered remainder

**Severity**: MEDIUM
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-068.md`

---

## DOC-GAP-071 — DataCollab `datacollaboration.*` prefix is a partial-home — 3 of 7 keys bind to `DataCollaborationProperties`, 4 scattered across `@Value` in 4 files (specific instance of DOC-GAP-068 META)

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-071.md`

---

## DOC-GAP-074 — OpenAPI declares 201 Created for `POST /api/owners` (and sibling create endpoints) but `OwnerController.java:26` returns 200 OK via `ResponseEntity::ok` — third concrete instance of a class-wide 201-vs-200 OpenAPI/implementation drift on RBAC create operations

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-074.md`

---

## DOC-GAP-075 — Owners live doc page omits creation mechanics (`POST /api/owners`), `OWNER_CREATE` permission, audit-trail absence, association-request flow mechanics, name validation gaps, and soft-delete recovery semantics (6 doc-drift sub-findings)

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-075.md`

---

## DOC-GAP-077 — Live `/authorization/permissions` page lists 5 permission categories (Data entity / Term / Query Example / Lookup table / Management) but the code's `PermissionResourceType` enum exposes 4 contextual values (DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT) — Lookup table is documented as a category but is NOT a contextual resource type; LOOKUP_TABLE_* permissions live as NO_CONTEXT MANAGEMENT-bucket entries

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-077.md`

---

## DOC-GAP-080 — Search live doc page silent on query syntax — `JooqFTSHelper.tsQuery` splits user input on a single space, appends `:*` to each token, joins with `&`, and passes verbatim to Postgres `to_tsquery(?)`; user queries with tsquery-meaningful metacharacters (`!`, `|`, `(`, `)`, `<->`, `:`) silently re-interpret or yield syntax-error 500s

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-080.md`

---

## DOC-GAP-081 — Legacy URL `/features/active-platform-features/search` returns 404 — canonical at `/features/data-discovery/search`; 3rd corroborating instance of the legacy-vs-canonical routing-drift cross-cutting pattern (strengthens DOC-GAP-058 META from 2-sidecar to 3-sidecar)

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-081.md`

---

## DOC-GAP-100 — `[[namespace:term]]` description auto-linking syntax is platform-specific, undocumented in operator-facing pages, and quadruple-confirmed-missing (batch I + batch J UI cluster + UI-vs-backend regex asymmetry surfaced)

**Severity**: MEDIUM
**Category**: missing-page (no operator-facing dictionary / glossary / business-glossary feature page exists; the description-side auto-linking syntax has no canonical home)

**Full detail**: `detail/DOC-GAP-100.md`

---

## DOC-GAP-101 — Popular ranking signal is undocumented externally — `catalog-overview` describes the surface, no page describes the `view_count DESC`-only mechanism, the inflation surface, or the `EXCLUDE_FROM_SEARCH` bypass **(batch H STRENGTHENS with SQL primary-source confirmation; batch J STRENGTHENS to 5-sidecar with UI-side F-001 loop closure: Popular click → Overview tab → fetchDataEntityDetails → +1 (or +2 under LSN-017) view_count → next refresh ranks higher)**

**Severity**: MEDIUM
**Category**: drift (live `catalog-overview` describes the surface but omits the mechanism + the abuse-resistance gap)

**Full detail**: `detail/DOC-GAP-101.md`

---

## DOC-GAP-102 — `getMyObjects` empty-Flux degradation for unlinked users is documented at the wrong layer — `catalog-overview` mentions the Owner-link prerequisite but no page describes what the operator-facing failure mode looks like

**Severity**: MEDIUM
**Category**: drift (the doc names the prerequisite but doesn't surface the consumer-visible failure mode)

**Full detail**: `detail/DOC-GAP-102.md`

---

## DOC-GAP-109 — Alert `listByOwner` empty-result total uses platform-wide count (`countAlertsWithStatusOpen`) instead of owner-scoped count (`countAlertsWithStatusOpenByOwner`) — when caller has zero owned alerts, the UI's pagination badge / "X total" indicator displays a non-zero number while the visible list is empty; single-line SQL method swap fix

**Severity**: MEDIUM
**Category**: drift (UX correctness; latent regression; no live-doc claim to drift against — primary-source SQL bug)

**Full detail**: `detail/DOC-GAP-109.md`

---

## DOC-GAP-110 — Alert reopen-conflict guard `openAlertWithTheSameTypeExistsForDataEntity` is read-then-write without `SELECT FOR UPDATE` or DB-side `UNIQUE(data_entity_oddrn, type) WHERE status = OPEN` partial-index — two concurrent reopens can both pass the EXISTS check and both proceed to UPDATE, briefly violating the "one OPEN of the same type per data entity" invariant **(batch I STRENGTHENS to 3-layer with service-layer maintainer-intent capture: the unfenced guard is INTENTIONAL trade-off to keep DB schema simple and error UX human-readable)**

**Severity**: MEDIUM
**Category**: drift (live alerting page does not describe the reopen-conflict semantic; the platform invariant has no SQL-level backstop)

**Full detail**: `detail/DOC-GAP-110.md`

---

## DOC-GAP-112 — Policy soft-delete + partial unique index `policy_name_unique ON policy(name) WHERE deleted_at IS NULL` + `PolicyServiceImpl.create` missing Administrator-name protection = compound risk under direct-DB; companion to DOC-GAP-106 + strengthens DOC-GAP-073 with the 7th sub-finding

**Severity**: MEDIUM
**Category**: drift (live `/authorization/policies` silent on the partial-index mechanism that enables Administrator-name re-creation via create-path asymmetry)

**Full detail**: `detail/DOC-GAP-112.md`

---

## DOC-GAP-118 — Soft-deleted data entities are silently restored on re-ingestion — `IngestionServiceImpl.java:127-136` routes DELETED-status entities through `restoreDeletedDataEntityRelations`; activity-feed emits NO event on restore (only on NEW entities); operators deleting deprecated entities find them silently return on the next collector tick unless the entity is ALSO removed from the collector's source — undocumented coupling

**Severity**: MEDIUM
**Category**: drift (operator-facing `/configuration-and-deployment/odd-platform` housekeeping section silent on restore-on-re-ingestion flow; collector-coupling requirement for permanent deletion is invisible)

**Full detail**: `detail/DOC-GAP-118.md`

---

## DOC-GAP-119 — MICROSERVICE-typed existing entities are silently EXCLUDED from `specificAttributesDeltas` at `IngestionServiceImpl.java:103` — `filter(e -> DataEntityTypeDto.MICROSERVICE != e.getValue().getType())` with no defending comment; MICROSERVICE entities can never trigger schema-diff BIS alert candidates; type-specific carve-out invisible to operators evaluating ODD for microservice-heavy catalogs

**Severity**: MEDIUM
**Category**: drift (live `/active-platform-features/alerting` discusses Distribution Anomaly + BIS without naming type-specific carve-outs; the exclusion is structurally invisible)

**Full detail**: `detail/DOC-GAP-119.md`

---

## DOC-GAP-120 — `POST /ingestion/entities` is all-or-nothing on batch failures — `@ReactiveTransactional` scopes the entire 14-processor chain; a single failed entity in a 1000-entity payload rolls back the other 999; HTTP response is `Mono<ResponseEntity<Void>>` with NO error-detail body; collectors receive no per-entity error report; debugging requires server-log access

**Severity**: MEDIUM
**Category**: drift (operator-facing `/integrations/ingestion-filters` documents the toggle; `/developer-guides/api-reference` documents the OpenAPI shape with no error-response-detail story; the rollback semantic and absent 207 Multi-Status response shape are undocumented)

**Full detail**: `detail/DOC-GAP-120.md`

---

## DOC-GAP-121 — Activity-feed integration in the ingestion path emits ONLY for NEW entities, NOT for ingestion-driven UPDATEs — `ActivityIngestionRequestProcessor.shouldProcess = isNotEmpty(request.getNewEntities())` AND `activityService.createActivityEvents` consumes `request.getNewIds()` only; ingestion-driven changes to name / description / type / tags / specific-attributes silently produce no activity event; compromised collector mutations are invisible in the audit trail

**Severity**: MEDIUM
**Category**: drift (live `/features/active-platform-features/activity-feed` describes the event types but does not discuss the ingestion-side activity-emission scope; the cross-axis gap is invisible)

**Full detail**: `detail/DOC-GAP-121.md`

---

## DOC-GAP-122 — PolicyService lost-update race on `PUT /api/policies/{id}` — `PolicyServiceImpl.update` is NOT `@ReactiveTransactional`; the read-then-write composition outside any transaction can lose updates silently with no error returned to either caller; sibling `RoleServiceImpl.update` IS transactional; the asymmetry is the canonical concrete instance of DOC-GAP-116 META

**Severity**: MEDIUM
**Category**: drift (live `/configuration-and-deployment/enable-security/authorization/policies` documents the JSON shape; the per-CRUD-method transaction discipline + asymmetry vs `roles.md` are invisible)

**Full detail**: `detail/DOC-GAP-122.md`

---

## DOC-GAP-123 — PolicyService schema-validation failures surface as HTTP 500 (Internal Server Error) rather than HTTP 400 — `PolicyJSONValidator` throws `IllegalArgumentException`; ControllerAdvice has NO dedicated handler for the JDK-standard exception; falls through to the catch-all `Exception.class` → 500 with body `"Internal Server Error"`; validator's actual error message buried in server logs

**Severity**: MEDIUM
**Category**: drift (live `/configuration-and-deployment/enable-security/authorization/policies` documents the JSON shape and recommends consulting the schema endpoint; does not warn that malformed body produces unhelpful 500 with no validator-error detail)

**Full detail**: `detail/DOC-GAP-123.md`

---

## DOC-GAP-124 — Inner-DEG suppression in `LineageServiceImpl.getDataEntityGroupLineage` is a deliberate deferred-feature carve-out (verbatim TODO at line 71 `// Remove this when we will support inner DEGs for DEG lineage`); the source-code TODO has no backlog citation, no `@Disabled` regression test, no operator-facing doc warning; clients building DEG-aware lineage tooling silently observe missing edges

**Severity**: MEDIUM
**Category**: drift (live `/features/data-lineage` discusses lineage without naming the DEG-lineage contract; live `/developer-guides/api-reference/lineage` describes endpoints without describing the inner-DEG carve-out)

**Full detail**: `detail/DOC-GAP-124.md`

---

## DOC-GAP-125 — AlertManager webhook `ExternalAlert.startsAt` is `LocalDateTime` (timezone-naive); Jackson silently strips RFC3339 offset on deserialisation; `AlertServiceImpl` formatter `yyyy-MM-dd HH:mm:ss` has no offset component; embedded Prometheus query-window URL keyed to SERVER local time; operators clicking the link in non-UTC deployments may see no data because the query window is off

**Severity**: MEDIUM
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` covers the integration setup but does not describe timezone handling; operators with Prometheus instances in non-UTC zones get broken query-window links with no doc-product warning)

**Full detail**: `detail/DOC-GAP-125.md`

---

## DOC-GAP-128 — Live `/features/data-discovery/catalog-overview` says "Clicking a tile opens that entity's **Structure** page" but the UI navigates to the **Overview** tab — direct factual contradiction between docs and code, file:line-anchored on both sides; the Overview tab is also the LSN-017 view_count producer surface

**Severity**: MEDIUM
**Category**: drift (live page asserts behaviour the code does not exhibit; click-target string in docs is wrong)

**Full detail**: `detail/DOC-GAP-128.md`

---

## DOC-GAP-129 — Live `/features/data-discovery/catalog-overview` says under DISABLED auth "the panel is visible but the per-user filtering does not apply" — code HIDES the entire Recommended panel under DISABLED; the published behaviour is unreachable on the platform's DEFAULT config

**Severity**: MEDIUM
**Category**: drift (live published manual asserts a feature behaviour that the code structurally precludes; operator following the doc on the default DISABLED deployment sees the panel missing entirely)

**Full detail**: `detail/DOC-GAP-129.md`

---

## DOC-GAP-131 — UI Lineage canvas hardcodes a depth-1 default + caps the visible depth slider at 20 + accepts unbounded `?d=` URL param — three UI-side caveats invisible across `/features/data-lineage`, `/features/data-lineage/data-objects`, AND `/developer-guides/api-reference/lineage`; api-ref's "Unset returns default" is unreachable from UI which ALWAYS supplies d=1

**Severity**: MEDIUM
**Category**: drift (3 live pages WebFetched 2026-05-19; all silent on UI defaults, slider range, and URL-clamp absence; the d=1 default is invisible AND a curious user hand-editing `?d=10000` reaches the unbounded REFACTOR-202 amplification surface)

**Full detail**: `detail/DOC-GAP-131.md`

---

## DOC-GAP-132 — UI Lineage canvas amplifies diamond DAGs into duplicate visual nodes (D appears twice for A→B→D + A→C→D) AND silently drops crossEdges that reference missing nodes — neither behaviour documented; visual-correctness gap on the platform's marquee F-005 surface

**Severity**: MEDIUM
**Category**: drift (live pages silent on cycle / diamond / cross-edge visualisation; UI behaviour is a structural surprise that operators cannot self-diagnose)

**Full detail**: `detail/DOC-GAP-132.md`

---

## DOC-GAP-134 — F-004 entity-description rendering surface — Permission docs name `DATA_ENTITY_DESCRIPTION_UPDATE` but do NOT say content render is unconditional for any `DATA_ENTITY_VIEW` holder; the partial-gating semantic (Edit button gated, Markdown CONTENT not gated) is undocumented; combined with DOC-GAP-096 + DOC-GAP-117 the XSS chain is invisible

**Severity**: MEDIUM
**Category**: drift (Permission page describes the permission's edit/delete semantic; the universal-read posture for description CONTENT — including embedded raw HTML — is unsaid)

**Full detail**: `detail/DOC-GAP-134.md`

---

## DOC-GAP-136 — `AppError` banner reflects `error.status` / `error.statusText` / `error.url` / `error.message` verbatim — backend stack traces and internal API paths render into the UI banner when 5xx responses carry diagnostic bodies; operator deploying ODD behind a permissive reverse-proxy exposes internal API path tree

**Severity**: MEDIUM
**Category**: drift (security defence-in-depth caveat absent on every "deployment hardening" / "production checklist" doc page; not a critical surface but a Principal-engineer-quality concern)

**Full detail**: `detail/DOC-GAP-136.md`

---

## DOC-GAP-024 — OpenAPI tag `alert` has no `description:` field and no `externalDocs.url`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-024.md`

---

## DOC-GAP-026 — AlertManager DTO drops `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`; cannot honour `status: resolved`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-026.md`

---

## DOC-GAP-027 — Locale-bundle CSP / localStorage caveat absent on (eventual) i18n doc page

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-027.md`

---

## DOC-GAP-028 — Activity Feed counts endpoint (`/api/activity/counts`) issues 4 parallel aggregation queries per call

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-028.md`

---

## DOC-GAP-031 — `lasEventId` typo on Java controller signature persists into generated client SDKs

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-031.md`

---

## DOC-GAP-044 — Prometheus `tenant_id` label read/write asymmetry on empty-string `odd.tenant-id`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-044.md`

---

## DOC-GAP-065 — DataCollaboration `sending-messages-retry-count: 0` is accepted by `@PostConstruct` validator (`< 0` check is strict) but docs imply minimum is 1 — semantic edge case undocumented

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-065.md`

---

## DOC-GAP-078 — Administrator policy's effective scope on `LOOKUP_TABLE_*` permissions depends on `PolicyPermissionExtractor`'s handling of `'ALL'` on the MANAGEMENT type — unverified whether `'ALL'` expands to every LOOKUP_TABLE_* constant; if not, the seeded Administrator effectively cannot manage lookup tables despite being the platform's full-permissions role

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-078.md`

---

## DOC-GAP-103 — LOGIN_FORM and LDAP both produce `provider=null` in `USER_OWNER_MAPPING` — undocumented cross-mode user-identity bleed during auth-mode migrations

**Severity**: LOW
**Category**: drift (operational migration caveat absent on the Authorization / User-owner-association doc page)

**Full detail**: `detail/DOC-GAP-103.md`

---

## DOC-GAP-111 — Ownership is HARD-DELETE at the SQL layer — no `deleted_at` column on the `ownership` table; recovery depends on the activity-feed audit trail being intact; the irreversibility is not surfaced on the Permissions / Owners live pages

**Severity**: LOW
**Category**: drift (operator-facing caveat absent; sibling resources Policy/Role/Owner are soft-delete, ownership is hard-delete — the asymmetry is undocumented)

**Full detail**: `detail/DOC-GAP-111.md`

---

## DOC-GAP-126 — PolicyService non-admin list path silently ignores pagination — `PolicyServiceImpl.list` for non-admin users returns `new Page<>(filteredPolicies, filteredPolicies.size(), false)` regardless of `page` / `size` request parameters; admin users get repository-paged results; asymmetric pagination contract invisible to operators and API consumers

**Severity**: LOW
**Category**: drift (live `/configuration-and-deployment/enable-security/authorization/policies` documents the GET endpoint shape; OpenAPI declares page/size with no warning that they're ignored for non-admin callers)

**Full detail**: `detail/DOC-GAP-126.md`

---

## DOC-GAP-127 — LineageServiceImpl.replaceLineagePaths is `@ReactiveTransactional`-annotated but a future self-invocation would silently bypass the annotation — Spring's transactional proxy only applies on EXTERNAL calls; if a future method called `this.replaceLineagePaths(...)`, the delete+insert sequence would NOT be atomic; the standard Spring caveat is undocumented at the service

**Severity**: LOW
**Category**: drift (developer-guide / code-comment absence; no current bug; future-refactor trap)

**Full detail**: `detail/DOC-GAP-127.md`

---

## DOC-GAP-133 — UI Lineage canvas renders microservices lineage identically to data-entity lineage with NO mode toggle, NO class-based override, NO microservices-specific affordances — operators evaluating ODD for microservice-heavy deployments may expect richer trace visualisation than data-entity lineage offers

**Severity**: LOW
**Category**: drift (live `/features/data-lineage` references a "microservices lineage" sub-surface; code reveals the SAME `<Lineage />` component handles both)

**Full detail**: `detail/DOC-GAP-133.md`

---

## DOC-GAP-135 — Shift+Enter description-save shortcut is a power-user affordance hidden from the operator-facing tooltip; the only operator-facing documentation of any description-editor shortcut is the `[[Namespace:TermName]]` syntax tooltip (cross-link DOC-GAP-100)

**Severity**: LOW
**Category**: drift (undocumented affordance; minor but published-product editorial gap)

**Full detail**: `detail/DOC-GAP-135.md`

---

## DOC-GAP-138 — `DataEntityDetails.tsx` `useEffect` dispatches `fetchDataEntityDetails({ dataEntityId: NaN })` for invalid route params — `useDataEntityRouteParams()` calls `parseInt(dataEntityId, 10)` with NO `Number.isNaN` guard; backend likely 404s but no UI-side validation surfaces the error at the source; user sees a generic `<AppErrorPage>`

**Severity**: LOW
**Category**: drift (UX-correctness; no live-doc claim to drift against; latent regression hazard absent from the developer-guides / contributing tree)

**Full detail**: `detail/DOC-GAP-138.md`

---
