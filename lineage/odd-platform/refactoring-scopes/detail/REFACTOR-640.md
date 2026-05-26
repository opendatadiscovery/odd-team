# REFACTOR-640 — `GET /api/owners` has no `SecurityRule`; any authenticated user enumerates the full Owner directory including PII-bearing names; under `auth.type=DISABLED` the endpoint is anonymously reachable

**Severity**: MEDIUM
**Category**: missing-auth (directory-enumeration) + missing-doc
**Pillars affected**: [P-08 Management & Administration (Owner directory), P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "**GET /api/owners is unauthenticated-read at the rule layer** — `SecurityConstants.SECURITY_RULES[143-147]` contains rules for POST/PUT/DELETE only. … `getOwnerList` (`OwnerController.java:30-38`) has no `@PreAuthorize`, no programmatic auth check, no SecurityRule. Any authenticated user (under LOGIN_FORM/OAUTH2/LDAP) can enumerate the entire Owner directory, including owners whose names may carry PII (e.g. `alice@acme.com`, `[Pseudonymous Researcher]`, internal team-name strings); under `auth.type=DISABLED` the endpoint is anonymously reachable. Consistent with the read-collaborative posture (ADR-CANDIDATE-003), but NOT documented in either the live `/owners` or `/permissions` doc pages. For a small platform team this is benign; for a public-facing deployment hosting personally-named owners, this is an information-disclosure surface."
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:stress_findings.auth_gates.[OwnerController.java:30-38]` — every "wrong-role caller" answer is "200 OK — there is no role/permission requirement. A caller holding only DATA_ENTITY_VIEW reads the full Owner directory; a caller holding only QUERY_EXAMPLE_VIEW reads the full Owner directory. ANY authenticated session is sufficient."

**Description**: The Owner directory is exposed via `GET /api/owners` with NO permission gate at any layer:
- Controller: no `@PreAuthorize`, no programmatic auth check.
- SecurityConstants: no SECURITY_RULES entry for the GET; falls through to `pathMatchers("/**").authenticated()`.
- Service: `OwnerServiceImpl.list` (lines 44-52) has no permission check.
- Repository: `ReactiveOwnerRepositoryImpl.list` applies only the soft-delete filter.

Combined with **REFACTOR-636** (the side-channel that grows the directory from 3 paths without OWNER_CREATE), the directory contains:
- Owner rows created via the explicit POST `/api/owners` (OWNER_CREATE-gated).
- Owner rows created via side-channels (Ownership / association request) — names supplied by users who hold only DATA_ENTITY_OWNERSHIP_CREATE.

The names are RAW STRINGS taken verbatim from form input — operators may have intended them to be:
- Personally-identifiable (`alice@acme.com`, `Alice Smith`).
- Internal team identifiers (`team-platform-engineering`, `ops-shift-A`).
- Organisational hierarchy (`director-vp-data`, `cfo`).
- Pseudonymised research handles (`pseudonymous-researcher-1`).

Any authenticated user reading the directory can:
- Enumerate team structure.
- Cross-correlate Owner names with data-entity ownership to map who owns what.
- Identify internal organisational hierarchy from name patterns.

Under `auth.type=DISABLED` (the default deployment), the endpoint is ANONYMOUSLY reachable; a network scanner identifies the workspace's full Owner directory in one GET.

**Operator-visible failure modes**:

1. **PII disclosure** — Owner names like `alice@acme.com` leak to every authenticated user; a security-conscious operator who restricts Data Entity reads per Policy still leaks Owner names.
2. **Organisational mapping** — Owner names + Data Entity ownership cross-correlation reveals team structure to any authenticated user.
3. **Multi-tenant cross-tenant exposure** — in a multi-tenant ODD deployment, every tenant's Owner names are visible to every other tenant's authenticated users.
4. **Anonymous-leak under DISABLED** — operator standing up a dev/sandbox deployment with DISABLED leaves the entire directory open to the local network.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../OwnerController.java:30-38` (the GET endpoint).
- `<odd-platform-api>/src/main/java/.../SecurityConstants.java:143-147` (the THREE mutation rules; NO GET rule).
- `<odd-platform-api>/src/main/java/.../OwnerServiceImpl.java:44-52` (the service; no auth check).
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` (the live owners doc; silent on the read posture).
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (the live permissions doc; no OWNER_READ defined).

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-003** (read-collaborative GET posture STRENGTHENED in batch ZF as Owner-specific instance) explicitly captures this as the PLATFORM-WIDE DEFAULT. The ADR's stance is "reads are authenticated-only; no per-permission gate is the deliberate posture". This REFACTOR captures the OPERATOR-ACTIONABLE choice when the maintainer wants to override the default for Owner specifically (e.g. for deployments with PII-bearing Owner names).

**Proposed remedy**: Three options, depending on the maintainer-stance on read-collaborative-for-Owner:

**Option A (preserve read-collaborative; disclose to operators)** — minor doc fix:
1. Extend `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/owners` to explicitly state: "Any authenticated user can enumerate the Owner directory via `GET /api/owners`. Do not place PII or organisationally-sensitive content in Owner names if your deployment serves untrusted authenticated users."
2. Add the same caveat to the `/permissions` page next to OWNER_CREATE.

**Option B (introduce OWNER_LIST_READ permission)** — structural change:
1. Add `OWNER_LIST_READ` to the PermissionDto enum.
2. Add a SECURITY_RULE entry for `/api/owners` GET → OWNER_LIST_READ.
3. Default-grant OWNER_LIST_READ to the existing roles that hold OWNER_CREATE / OWNER_UPDATE / OWNER_DELETE (preserves operator-onboarding UX); operators can revoke it for restricted roles.
4. Update live docs.
5. Add integration tests asserting 403 for a caller without OWNER_LIST_READ.

**Option C (per-name access control via Policy)** — structural change:
- Extend the Policy DSL to include `owner:read:*` conditions; gate `getOwnerList` to filter by policy. Significantly more complex; not recommended unless operator demand drives it.

The maintainer-recommended option (per Velocity bias + minimal disruption) is **Option A** — the read-collaborative posture is platform-wide per ADR-003; the gap is doc-disclosure not policy enforcement.

**Severity rationale**: MEDIUM — the read-collaborative posture is the platform's deliberate default (per ADR-003); the gap is the OPERATOR-VISIBLE doc-disclosure of what that posture implies for Owner names. Higher severity in PII-bearing deployments; benign in small-team deployments. Pairs with REFACTOR-636 (the side-channel that grows the directory) — together they shape the Owner-directory trust model.

**Suggested backlog grouping**: `Doc-disclosure hardening sprint` — pair with the Title / MetadataField / Tag / Namespace doc-disclosure siblings (each canonical instance of ADR-003 needs an operator-facing caveat at its docs anchor).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (read-collaborative posture — Owner is the 22nd instance); REFACTOR-617 (Policy GET unauthenticated — same shape on RBAC-config side); REFACTOR-554 (Tag popular list unauthenticated — sibling).
- SUPERSEDES: none.
- CONFLICTS: none.

---
