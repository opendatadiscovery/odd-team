## REFACTOR-606 — `IdentityController.dummyOwner` uses `Arrays.asList(Permission.values())` — every new Permission auto-enters the DISABLED admin grant without code review

**Severity**: HIGH
**Category**: dynamic-blast-radius / missing-curated-allowlist
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the DISABLED-mode admin grant), P-08 Management & Administration (the UI's WithPermissionsProvider consumer chain)]

**Surfaced by**:
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "Under `auth.type=DISABLED`, an anonymous network caller hitting `GET /api/identity/whoami` receives 200 OK with `identity.username='admin'` and ALL 70+ Permission enum values. The dummy fallback's permission list is `Arrays.asList(Permission.values())` — the FULL set, dynamically expanded as the Permission enum grows; every new Permission added to components.yaml AUTOMATICALLY enters the DISABLED-mode admin-grant blast radius without any explicit code change in this file."
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:concepts.invariants.[4]` ("the dummy fallback's permission list is `Arrays.asList(Permission.values())` — the FULL set, dynamically expanded as the Permission enum grows")

**Statement**: `IdentityController.dummyOwner()` at lines 30-33 constructs the under-DISABLED fallback identity with `.permissions(Arrays.asList(Permission.values()))` — every Permission enum value defined in `components.yaml:158-235`. The Permission enum currently has 70+ values; every future Permission added to `components.yaml` (e.g. `WEBHOOK_CREATE`, `OWNER_TOKEN_REGENERATE`, a future GenAI-scoped permission) automatically enters the under-DISABLED admin grant without any explicit code change in this file. A maintainer adding a new Permission for a feature with no DISABLED-mode story expansion would silently widen the blast radius.

The decision is intentional per ADR-CANDIDATE-210 (the maintainer chose `Permission.values()` over a curated subset), but the consequence — that the absence of a curated subset is also the absence of an authoring checkpoint — is a refactoring scope. A future architectural pattern (curated subset of permissions for the DISABLED dummy, explicit allowlist) would catch the silent-expansion class.

**Evidence**:
- `IdentityController.java:32` (`Arrays.asList(Permission.values())`)
- `components.yaml:158-235` (70+ Permission enum values; future additions auto-enter the dummy)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-210 (NEW this batch) anchors the decision; the maintainer-encoded intent is "DISABLED-mode admin should always be the maximally-permissive caller". The refactoring scope is the absence of an authoring checkpoint when a new Permission is added — even if `Permission.values()` is the chosen shape, a comment or a unit test asserting "every new Permission was reviewed for DISABLED-mode inclusion" would catch the silent-expansion class.

**Proposed remedy**: Add a unit test asserting the contents of `Permission.values()` against an expected-list snapshot — a Permission addition that isn't reviewed for DISABLED-mode admin inclusion would fail the test, forcing the author to explicitly acknowledge the under-DISABLED grant expansion. Alternative remedy: replace `Permission.values()` with a curated `DISABLED_MODE_ADMIN_PERMISSIONS` constant (an explicit allowlist).

**Severity rationale**: HIGH — dynamic blast-radius expansion compounds with REFACTOR-185 (DISABLED bypasses SECURITY_RULES); every new Permission widens the blast radius the operator-onboarding-velocity ADR (CANDIDATE-029) accepts. Without a checkpoint, the platform's security debt grows monotonically with each new Permission.

**Suggested backlog grouping**: "GenAI hardening sprint" (Permission additions are most likely to come from new feature work — GenAI is the canonical next-feature surface; the checkpoint should land before GenAI's permission model expands).
