## STRENGTHENS — Batch ZD (IdentityController class-level — no Cache-Control on the identity-bearing whoami response)

**One new class-level sidecar confirms the no-Cache-Control-on-sensitive-response pattern at the identity-exposure surface**:

- **IdentityController (CLASS-LEVEL)** — `IdentityController.java:25-28` uses bare `ResponseEntity::ok` (line 26) and `new ResponseEntity<>(dummyOwner(), HttpStatus.OK)` (line 27) — NO cache-control headers, NO Pragma, NO Expires. Per `bugs_limitations_corner_cases[1]`: "No `Cache-Control: no-store` on the identity-bearing response. Any shared HTTP intermediate (NGINX, browser back/forward cache, mobile carrier proxy) caching on URL alone could serve the previous caller's identity body to a later caller. Spring Security's default WebFluxSecurityHeadersConfiguration MAY inject `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` for authenticated responses, but under DISABLED no security chain runs."

The whoami endpoint is the CANONICAL identity-bearing response — the most user-specific surface on the API surface — and the absence of `Cache-Control: no-store` is the canonical case for the cross-cutting no-cache-control-on-sensitive-response pattern that batch A surfaced for token-rotation (REFACTOR-062). The IdentityController case is more severe than the token-rotation case because:
1. The whoami response is hit on EVERY SPA mount (high cardinality of caching opportunities).
2. Under DISABLED + REFACTOR-185, the response contains a synthetic admin identity claim — caching it would serve a "you are admin with all permissions" body to a later caller.
3. Spring Security's default no-cache header injection is INERT under DISABLED (DisabledAuthSecurityConfiguration wires no SecurityWebFilterChain).

The cross-batch finding: any identity-bearing or token-bearing response across the platform must carry explicit `Cache-Control: no-store`. The pattern is recurring (token-rotation + whoami so far); a future refactor that adds another identity-bearing endpoint should default to setting the header.

**Severity unchanged**: MEDIUM (latent — depends on intermediate cache behaviour; identity responses are the canonical case for explicit no-store).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-062 (token-rotation no-cache-control — same pattern at a different endpoint); cross-cutting no-cache-control-on-sensitive-response pattern (no separate REFACTOR-id; lives in this scope's family).
- SUPERSEDES: none.
- CONFLICTS: none.
