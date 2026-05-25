## STRENGTHENS — Batch ZD (RBAC + Identity + Integration class-level — 4 new sidecars join the DISABLED-bypasses-SECURITY_RULES triangulation)

**Four new class-level sidecars promote REFACTOR-185's triangulation from 11 (post batch-F) to 15:**

- **PolicyController (CLASS-LEVEL)** — all THREE Policy mutation endpoints (POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE per SecurityConstants.java:163-168) are gated ONLY under non-DISABLED modes; under `auth.type=DISABLED` `DisabledAuthSecurityConfiguration.java:14-17` short-circuits with `.anyExchange().permitAll()` and ALL THREE mutations are anonymously reachable. Combined with the class-level audit silence (REFACTOR-097), an anonymous caller can author MANAGEMENT/ALL policies with no trace. Per `bugs_limitations_corner_cases[1]`: "auth.type=DISABLED bypasses POLICY_CREATE / POLICY_UPDATE / POLICY_DELETE — an unauthenticated caller can issue every CRUD."
- **RoleController (CLASS-LEVEL)** — all FOUR Role endpoints (3 mutations gated by ROLE_CREATE / ROLE_UPDATE / ROLE_DELETE + 1 GET ungated entirely) are reachable to ANY HTTP caller under DISABLED. Per `bugs_limitations_corner_cases[2]`: "Under auth.type=DISABLED (the bundled default), ALL FOUR endpoints are reachable unauthenticated."
- **IdentityController (CLASS-LEVEL)** — the IDENTITY-LAYER FACET of REFACTOR-185: under DISABLED, anonymous `GET /api/identity/whoami` returns 200 OK with `admin` + ALL 70+ permissions (the dummyOwner fallback per ADR-CANDIDATE-210). The UI's `WithPermissionsProvider` consumes the response and unlocks every Permission-gated UI control — anonymous callers walk the SPA as admin. Per `bugs_limitations_corner_cases[0]`: "the 17th sidecar in the 16-sidecar triangulation."
- **IntegrationController (CLASS-LEVEL)** — under DISABLED, both wizard endpoints are anonymously reachable (per REFACTOR-616 — internal hostname leak). Per `bugs_limitations_corner_cases[6]`: "Under `auth.type=DISABLED` the wizard surface is anonymously reachable — DisabledAuthSecurityConfiguration.java:13-18 applies `.anyExchange().permitAll()`."

**Updated triangulation count**: **15-sidecar** (was 11 after batch F).

**The strongest single triangulation in the catalog continues to grow.** REFACTOR-185 is now the canonical "blast radius of the DISABLED default" entry — surfaced across:
- RBAC: Policy + Role + Owner + Permission controllers + DataEntityOwnership + DataEntityStatus mutations
- Read: detail / lineage / activity / search / permissions discovery / identity / wizard
- Ingestion: postDataEntityList
- Identity: whoami (the SPECIAL case — under DISABLED returns synthetic admin)
- Integration: wizard registry + platform_url substitution leak

**Cross-batch refinement** (batch ZD):
- The IdentityController-class enrichment adds the IDENTITY-LAYER FACET — the centerpiece consequence of DISABLED is that anonymous callers BECOME admin at the SPA level. This shifts the blast-radius framing from "what can you call?" (REFACTOR-185 original) to "who do you become?" (REFACTOR-185 + REFACTOR-606 + ADR-CANDIDATE-210 composed).
- The IntegrationController-class enrichment adds the INFORMATION-DISCLOSURE FACET — DISABLED leaks operator-configured internal hostnames via the wizard's `platform_url` substitution (cross-link REFACTOR-616).
- The PolicyController + RoleController class-level enrichments confirm at the WHOLE-FILE scope (not just per-method) that the SECURITY_RULES gates are inert under DISABLED.

**Severity unchanged**: HIGH — operator-onboarding velocity vs blast radius trade-off; doc-side fix (live `/disabled-authentication` page) + boot-time WARN log (REFACTOR-073) is the cheapest remediation. The architectural commitment (ADR-CANDIDATE-029) means the default itself won't change without a deliberate ADR supersede.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-029 (DISABLED-as-default — REFACTOR-185 is the consequence the ADR accepts); ADR-CANDIDATE-210 (the IDENTITY-LAYER FACET — newly minted this batch); REFACTOR-073 (no boot-time security-posture validator — the cheapest mitigation gap).
- SUPERSEDES: none.
- CONFLICTS: none.
