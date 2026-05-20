## REFACTOR-217 — STRENGTHENED BATCH Z — SPEC-FILE PRIMARY SOURCE PIN — `openapi.yaml:973` PLURAL `/terms` + `openapi.yaml:1042` PLURAL `/terms/{term_id}` are the SOURCE OF TRUTH for the path; SecurityConstants.java:237-242 SINGULAR `/term` is the typo; direction of fix is DEFINITIVELY "fix SecurityConstants to match spec, NOT the reverse"

**Severity unchanged**: HIGH
**Updated support count**: now **3 sidecars** (1 batch-V primary source from addDataEntityTerm + 1 batch-Z openapi-spec file:line PRIMARY SOURCE + cross-batch concept catalog `data-entity-term-link-permission-bypass` invariant)
**Batch**: Z (2026-05-20)

**New surfaced_by**:
- `openapi.yaml.md:bugs_limitations_corner_cases.[6]` (HIGH) — "**SecurityConstants path-mismatch class — `openapi.yaml:973` PLURAL `/terms` vs SecurityConstants `/term` SINGULAR silently disables DATA_ENTITY_ADD_TERM authorization** — the spec declares the PLURAL form (the URL clients actually hit); SecurityConstants registers the SINGULAR form (a typo). Result: the SecurityRule never matches, the permission check is skipped, the SecurityWebFilterChain falls through to `.authenticated()`. ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP can link any term to any data entity. REFACTOR-217 documents the remedy; **the SPEC SIDE is correct, the SecurityConstants side is wrong**, but the gap demonstrates how the spec's path is the source of truth and divergence is a security incident."
- `openapi.yaml.md:security.known_security_gaps.[3]` (HIGH) — "**SecurityConstants path-mismatch confirmation point** — the spec's `/terms` PLURAL path is the source of truth; the SecurityConstants registration of `/term` SINGULAR is the silent bug. The spec IS correct; the security registration is wrong. This direction matters: the remedy per REFACTOR-217 is to change SecurityConstants to match the spec, not the spec to match SecurityConstants."

**Cross-batch picture — DIRECTION OF FIX IS PINNED**:

Prior to batch Z, REFACTOR-217 documented the path-mismatch with both file:line citations BUT the architectural framing left the direction implicit:
- Should we update `openapi.yaml` to SINGULAR `/term` to match SecurityConstants?
- Should we update `SecurityConstants.java` to PLURAL `/terms` to match openapi.yaml?
- The architectural pair (ADR-CANDIDATE-001 + ADR-CANDIDATE-189 NEW batch Z) declares OpenAPI is the source of truth, but the prior REFACTOR-217 framing did not name the direction explicitly.

Batch-Z's openapi-spec PRIMARY SOURCE confirms the direction DEFINITIVELY:

**Primary-source pin** — `openapi.yaml:973`:
```yaml
/api/dataentities/{data_entity_id}/terms:
  post:
    operationId: addDataEntityTerm
    ...
```

**Primary-source pin** — `openapi.yaml:1042`:
```yaml
/api/dataentities/{data_entity_id}/terms/{term_id}:
  delete:
    operationId: deleteTermFromDataEntity
    ...
```

The PLURAL `/terms` is the spec's authoritative declaration; the controller `@Override` (`DataEntityController.java:149-156` for POST + `DataEntityController.java:158-163` for DELETE) inherits the PLURAL path from the generated `DataEntityApi`. The URL clients ACTUALLY hit is the PLURAL form. The SecurityConstants entry at `SecurityConstants.java:237-242` registering SINGULAR `/term` is the typo — it NEVER matches the request the SecurityWebFilterChain dispatches.

**The architectural opinion (ADR-189 + ADR-001) now defends the direction of the fix**: per the contract-first stance, the spec is authoritative; any drift between code and spec is a code-side defect to fix in the code. Changing the spec to match the typo would VIOLATE the architectural pair (ADR-001's controller-side `@Override` of generated interfaces + ADR-189's spec-as-source-of-truth framing). The fix MUST be on the SecurityConstants side.

**Updated proposed remedy (DEFINITIVE DIRECTION)**:

```java
// SecurityConstants.java:237-239 — BEFORE
new SecurityRule(POST, "/api/dataentities/{data_entity_id}/term", DATA_ENTITY_ADD_TERM, ...)

// SecurityConstants.java:237-239 — AFTER
new SecurityRule(POST, "/api/dataentities/{data_entity_id}/terms", DATA_ENTITY_ADD_TERM, ...)
```

```java
// SecurityConstants.java:240-242 — BEFORE
new SecurityRule(DELETE, "/api/dataentities/{data_entity_id}/term/{term_id}", DATA_ENTITY_DELETE_TERM, ...)

// SecurityConstants.java:240-242 — AFTER
new SecurityRule(DELETE, "/api/dataentities/{data_entity_id}/terms/{term_id}", DATA_ENTITY_DELETE_TERM, ...)
```

Two-character fix (one `s` per line). Single PR. Plus a regression test in `DataEntityControllerTest` asserting a caller without `DATA_ENTITY_ADD_TERM` receives 403 on `POST /api/dataentities/{id}/terms`.

**Cross-batch insight — the META-FIX**:

The cross-batch picture reveals a structural class: ANY SecurityConstants path-string entry that does not literal-match an OpenAPI path declaration is a silent authz bypass. REFACTOR-217 (term-link) is the singular concrete instance surfaced so far; the META-fix is a build-time validator that compares EVERY SecurityConstants matcher's path string against EVERY openapi.yaml operation path — fail the build on any non-match. This is the cross-cutting prescription captured at REFACTOR-009 (no compile-time / test-time guard against SECURITY_RULES path-pattern drift). Batch Z's spec-file primary source ELEVATES REFACTOR-009 from "implementation gap" to "highest-leverage cross-cutting fix" — adding the build-time validator would catch EVERY path-mismatch class structurally before commit.

**Severity unchanged at HIGH** — silent authz bypass on a per-data-entity write surface under LOGIN_FORM/OAUTH2/LDAP; anonymous reachable under DISABLED. The direction-of-fix pin from batch Z's spec-file primary source resolves the prior ambiguity and concentrates the fix scope at the SecurityConstants side. The META-fix (build-time validator per REFACTOR-009) becomes the cross-cutting investment with the highest leverage.

---
