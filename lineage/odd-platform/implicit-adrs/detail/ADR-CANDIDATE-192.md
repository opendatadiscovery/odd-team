## ADR-CANDIDATE-192 — Read-collaborative posture extends to the S2S read surface with AUTH-MODE-ORTHOGONAL property — `GET /ingestion/entities/{deg_oddrn}` is the canonical S2S read endpoint, applies the same unscoped read posture as ADR-CANDIDATE-003 BUT WITH NO AUTHENTICATION REQUIREMENT IN ANY MODE (the `/ingestion/**` whitelist makes UI auth orthogonal; the ingestion filter's path matcher excludes templated child paths)

**Severity**: HIGH
**Classification**: promote (NEW ADR; MIXED-SIGNAL — the read-collaborative-posture aspect is positive-intent extension of ADR-003; the auth-mode-orthogonal aspect is borderline whether intentional ADR or accumulated gap — surface explicitly to maintainer triage)
**Borderline flag**: `true` — the read-collaborative shape is consistent with ADR-003 (intentional) BUT the auth-mode-orthogonal reachability (unauthenticated in EVERY mode) is the load-bearing NEW property the S2S read surface introduces; whether the maintainer DELIBERATELY chose "S2S reads have no auth at all" or whether the gap evolved is the open question
**Pillars affected**: [P-09-security-access-control (the auth-mode-orthogonal reachability is a security architecture decision), P-10-integrations-ingestion (the S2S read surface), P-05-data-lineage (DEG membership is a lineage-adjacent surface)]
**Support count**: 1 sidecar PRIMARY SOURCE (batch Z getDataEntitiesByDEGOddrn) + cross-batch corroboration with ADR-CANDIDATE-003 (read-collaborative GET pattern at 9 surfaces) + ADR-CANDIDATE-027 (ingestion auth trust gradient — this ADR extends the gradient to the READ side)
**Axes present**: controllers (the IngestionController.getDataEntitiesByDEGOddrn method)
**Batch**: Z (2026-05-20)

**Surfaced by**:
- `getDataEntitiesByDEGOddrn.md:implicit_adrs.[0]` (HIGH) — "Read-collaborative posture extends to the S2S read surface — explicitly UNSCOPED reads by design" — evidence: IngestionController.java:75-79 (no @PreAuthorize) + DataEntityGroupServiceImpl.java:92-108 (no fetchAssociatedOwner) + ReactiveDataEntityRepositoryImpl.java:318-326 (no OWNERSHIP join) + the platform's consistent pattern of unscoped reads across the entire DEG-membership / DEG-lineage / search / search-facet surfaces (ADR-CANDIDATE-003 / 114 / 122 family per REFACTOR-024 + REFACTOR-203 + F-016) — intent_anchor: the pattern is platform-wide; every DEG-anchored read endpoint in the codebase applies the same unscoped posture. The S2S read endpoint matches the architectural shape of its UI-side siblings — confidence: HIGH
- `getDataEntitiesByDEGOddrn.md:security.auth_mode_relevance` (HIGH) — "`DISABLED | OAUTH2 | LDAP | LOGIN_FORM — UNAUTHENTICATED IN ALL FOUR MODES due to `/ingestion/**` WHITELIST_PATHS coverage`. The four UI auth modes do NOT protect this path because `SecurityConstants.WHITELIST_PATHS` line 96 (`/ingestion/**`) exempts the entire ingestion prefix from authentication. The S2S filter `IngestionDataEntitiesFilter` is gated by `auth.ingestion.filter.enabled` AND has a hard-coded path matcher of `POST /ingestion/entities` exactly — so it does NOT match this GET path even when enabled. **The auth-mode-orthogonal reachability is the load-bearing fact**: an operator cannot lock down this endpoint via ANY shipped configuration toggle."

**Decision statement**: The S2S read surface (`GET /ingestion/entities/{deg_oddrn}` is the canonical example) applies a TWO-PART architectural posture:

**Part A — Read-collaborative posture (the ADR-003 extension).** The endpoint applies the same unscoped read model as ADR-CANDIDATE-003's 9 surfaces (DataEntityController detail / lineage / attachments / directory + AlertController + ActivityController + SearchController + PermissionController + DataEntityAttachmentController):
- No `@PreAuthorize` on the controller method
- No SECURITY_RULES entry (the path is in `/ingestion/**` whitelist anyway)
- No `fetchAssociatedOwner()` call at the service layer
- No `OWNERSHIP` JOIN at the repository layer
- Any caller (when authenticated at all) reads ANY DEG's full member list — `oddrn` + `DataEntityType` per member — with zero owner-scoping, zero participation predicate, zero role check

The shape matches the platform-wide convention. The architectural intent is verifiable: every DEG-anchored read endpoint in the codebase applies the SAME unscoped posture (getDataEntityGroupsLineage from batch M + this endpoint from batch Z + the search-facet aggregations from batch M).

**Part B — Auth-mode-orthogonal reachability (the NEW load-bearing property).** Where ADR-003's surfaces are read-collaborative AMONG authenticated users (`.pathMatchers("/**").authenticated()` is the catch-all fallback), THIS surface is reachable **without any authentication in any auth mode** because of the COMPOUND of two unrelated configuration facts:

1. `SecurityConstants.WHITELIST_PATHS` line 96 includes `/ingestion/**` (the entire ingestion prefix is whitelisted from UI auth — for all four modes: DISABLED, LOGIN_FORM, OAUTH2, LDAP).

2. `IngestionDataEntitiesFilter.java:28` is hard-coded to `POST /ingestion/entities` EXACTLY (exact-literal path matcher; the templated child path `GET /ingestion/entities/{deg_oddrn}` does NOT match) AND is gated by `auth.ingestion.filter.enabled=false` (default).

The compound effect: this endpoint is anonymously reachable in EVERY shipped deployment configuration, INCLUDING when the operator has enabled `auth.ingestion.filter.enabled=true` believing they have locked down the ingestion surface (the auth-mode-orthogonal trap).

**The decision question (the borderline_flag)**: Is the auth-mode-orthogonal reachability INTENTIONAL (the maintainer chose "S2S read endpoints are unscoped AND uncovered by any auth mechanism, period — the implicit deployment-architecture assumption is that S2S consumers run on a trusted network") OR an ACCUMULATED GAP (the read-collaborative posture was authored for the authenticated UI surface; the S2S endpoint inherited the unscoped shape but the auth-mode whitelisting of `/ingestion/**` was a separate decision that compounded into the unauthenticated reachability without anyone explicitly noticing)?

The evidence is MIXED:
- **Toward intentional**: The ingestion contract is OpenAPI-driven from a separate repo (`opendatadiscovery-specification`); operators reading the live security doc (WebFetched 2026-05-20 from the postDataSetStatsList sibling) DO learn the compound — the doc explicitly states "`/ingestion/**` is whitelisted in Spring Security (SecurityConstants.WHITELIST_PATHS), so it never traverses the UI authentication chain." The compound is documented (positive signal).
- **Toward gap**: The endpoint's auth-mode-orthogonal reachability has no comment defending it; the maintainer's stance on "S2S reads are read-collaborative AND unauthenticated AND no toggle changes this" is implied, not declared. The operator-facing property name `auth.ingestion.filter.enabled` reads as namespace-scoped but covers a single endpoint — a real false-sense-of-security trap.

The architectural commitments (whichever way the maintainer triages the borderline_flag):

- **(a) S2S read endpoints inherit the read-collaborative shape.** Same as ADR-003 for the UI surface. No exception.
- **(b) S2S read endpoints have NO opt-in auth mechanism.** Unlike `POST /ingestion/entities` (which has the opt-in filter), this read endpoint has no toggle. To restrict it, an operator must deploy network-level controls (firewall rule, reverse proxy auth).
- **(c) Auth-mode whitelisting + filter-path scoping compound into auth-mode-orthogonal reachability.** A toggle that the operator believes covers the namespace covers a single endpoint. The compound is the load-bearing surprise.
- **(d) The blast radius is enumerable.** Combined with sequential DEG-id ODDRN generation (DataEntityGroupServiceImpl.java:191-200), an attacker iterating ids 1..N collects the full DEG-to-members mapping for the platform in O(N) requests, with no rate-limit, no audit log, no metric counter.

The decision extends ADR-CANDIDATE-027 (ingestion auth trust gradient) with a FOURTH TIER:
1. `POST /ingestion/datasources` — ALWAYS protected (unconditional `IngestionDataSourceFilter`)
2. `POST /ingestion/entities` — OPT-IN protected (gated by `auth.ingestion.filter.enabled`)
3. `POST /ingestion/alert/alertmanager` — NETWORK-DELEGATED (no filter, operator-network-layer responsibility)
4. **NEW (this ADR)**: `GET /ingestion/entities/{deg_oddrn}` — AUTH-MODE-ORTHOGONAL (no filter, no toggle, no UI auth either; the read-collaborative posture WITHOUT the .authenticated() fallback)

**Wisdom test**: PASS with borderline_flag explicit.
1. **Intentional?** PARTIAL — the read-collaborative posture (Part A) is intentional (consistent across 9+ surfaces); the auth-mode-orthogonal reachability (Part B) is accumulated from two separate decisions (the whitelist + the exact-path filter matcher) whose compound effect is structural but possibly unintended at authoring time. The live doc surfaces the compound (positive signal) but no comment in code defends it.
2. **Structural impact?** YES — every future S2S read endpoint must contend with the auth-mode-orthogonal default; every operator's threat model depends on this; the network-layer-only defence is the load-bearing operational assumption.
3. **Refactoring or structural?** STRUCTURAL — fixing the auth-mode-orthogonal reachability requires either narrowing the WHITELIST_PATHS scope (which would break F-008's filter compose semantics for POST `/ingestion/entities`) or extending the ingestion-filter path matcher to cover `/ingestion/**` (which is the REFACTOR-185 + REFACTOR-217 cluster's structural fix surface).

**Existing ADR**: none in `adrs/`. Composes deeply with ADR-CANDIDATE-003 (read-collaborative GET — the PART A shape), ADR-CANDIDATE-027 (ingestion auth trust gradient — this ADR EXTENDS to a fourth tier), ADR-CANDIDATE-006 (AlertManager network-delegated auth — the sibling on the write side with comparable network-layer-only defence), the F-008 5-vertex picture (the read-side complement of the destructive write).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-539 NEW batch Z (3 ingestion endpoints UNAUTHENTICATED in EVERY auth mode — getDataEntitiesByDEGOddrn + postDataSetStatsList + ingestMetrics; HIGH; the read-and-write-symmetric companion to REFACTOR-185)
- REFACTOR-185 STRENGTHENED batch Z (DISABLED-mode bypass — now 17-sidecar; the centerpiece writes; AUTH-MODE-ORTHOGONAL property added for read-side)
- REFACTOR-024 (cross-owner read posture — extends from UI surface to S2S surface)
- REFACTOR-203 (lineage cross-owner enumeration — sibling DEG-anchored surface)

**Proposed action**: Promote to `adrs/drafts/s2s-read-surface-auth-mode-orthogonal.md` (new ADR — borderline_flag REQUIRES maintainer triage). Document the two-part posture (Part A is intentional extension of ADR-003; Part B is the load-bearing auth-mode-orthogonal property + the open question of whether the compound was deliberate). The maintainer's triage decides whether to (a) ACCEPT the auth-mode-orthogonal reachability as a deployment-architecture stance (network-layer-only defence for S2S reads) and surface it on the live `/configuration-and-deployment/enable-security` page so operators evaluating ODD know the compound BEFORE deployment, OR (b) REJECT and treat as the structural fix scope of REFACTOR-539's HIGH-severity finding (narrow the whitelist, broaden the filter, add an S2S-read auth mechanism). Doc-side: the live S2S sub-page MUST surface this fourth tier of the auth trust gradient.

**Severity rationale**: HIGH — defines the platform's S2S read-surface security architecture; auth-mode-orthogonal reachability is a load-bearing operator-visible consequence; cross-references REFACTOR-539 (HIGH — 3 sibling endpoints share this property). Borderline_flag carried explicitly into the maintainer triage path.

---
