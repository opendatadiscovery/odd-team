# PR body — CTRIB-035 / #1762 (DRAFT)

**Title:** `fix(api): invalid policy JSON returns 400 instead of an opaque 500 (#1762)`

**Base:** `main`  ·  **Head:** `contrib/CTRIB-035-illegalargument-exception-contract`  ·  **draft: true**

---

## What

`POST`/`PUT /api/policies` with invalid policy JSON returned **HTTP 500 / `SYS001` / "Internal Server Error"** instead of a descriptive 400 — a user mistyping a permission saw a platform-crash status with no hint, while the validation detail sat only in the server log.

Root cause: `PolicyJSONValidator` signalled validation failure with a raw `IllegalArgumentException`; `ControllerAdvice` has no handler for that type, so it fell to the `@ExceptionHandler(Exception.class)` catch-all → 500.

Closes #1762.

## The fix (targeted — not a class-wide handler)

- **`PolicyJSONValidator`** now throws `BadUserRequestException` → **400 / `USR001`** with the validation detail in the response body (the permission enum + field paths are already public via `GET /api/policies/schema`, so no new disclosure). This is the platform's established typed-exception idiom and conforms to **ADR-0007** (centralised error translation; one advice maps the hierarchy).
- **`PermissionServiceImpl`** — the missing permission-extractor fallthrough is renamed `IllegalArgumentException` → `IllegalStateException`. A missing extractor bean for a *valid* resource type is a **server wiring gap (5xx)**, not bad client input — re-issuing the same valid request keeps failing until the deployment is fixed. **Status unchanged** (still 500, full diagnostic logged); the type makes the server-invariant intent explicit.

### Why not the class-wide `IllegalArgumentException → 400`

There are 45 `IllegalArgumentException` throw sites in `odd-platform-api`; ~43 are server/config/internal faults (bean-init config, internal jOOQ query building, WAL decoding, internal mappers). A blanket `@ExceptionHandler(IllegalArgumentException.class) → 400` would reclassify those as client errors, suppress the 5xx signal on-call pages on, risk leaking internal messages, and also catch every `NumberFormatException` / failed `Enum.valueOf`. Spring itself does not auto-map `IllegalArgumentException` for the same reason. (Full rationale + scope on the issue thread.)

## Tests

- **Unit** `PolicyJSONValidatorTest` — schema-invalid + malformed policy JSON → `BadUserRequestException` (400/`USR001`); a `%` in the validator detail is format-safe; a valid policy passes. RED on pre-fix (raw `IllegalArgumentException`).
- **Unit** `PermissionServiceImplTest` — a missing extractor → `IllegalStateException` (stays 5xx). RED on pre-fix.
- **Integration** `PolicyValidationErrorContractTest` (`BaseIntegrationTest` + `WebTestClient`) — `POST /api/policies` invalid JSON → **400 `USR001`** with body `"Policy is not valid: …"`. RED on pre-fix (500).
- **Reproduced live** before the fix: `POST /api/policies` invalid JSON → 500 `SYS001` (server log carried the IAE detail the client never saw).
- Full `:odd-platform-api:build` green on the branch (0 failures suite-wide); full e2e regression green-for-change (feature-complete 313 passed; the only non-green items are an unrelated sibling branch's unmerged i18n spec and two confirmed environmental timeout-flakes that pass on a quiet box; known-bugs RED-as-expected; multi-stack + ingestion-e2e green).

## Scope (deliberately bounded)

Tracked separately (kept out of this PR): the ingestion-metric extractor `IllegalArgumentException → 500` paths (machine input), and declaring error responses in the OpenAPI contract.

---

Milestone: 0.29.0
Docs: none — `policies.md` already documents the validation-error behaviour generically ("the platform returns an error rather than saving the policy"); it documents policy structure/behaviour, not HTTP status codes, so the statement stays true and is improved by the fix.
