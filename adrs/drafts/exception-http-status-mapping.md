---
id: ADR-DRAFT-exception-http-status-mapping
title: "Exception → HTTP-status mapping: typed domain exceptions, and why IllegalArgumentException is not blanket-mapped"
status: draft
category: adr
target_repo: documentation
extends: ADR-0007
origin: "CTRIB-035 / opendatadiscovery/odd-platform#1762 (GATE-1 approved 2026-06-25)"
realises:
  - "odd-platform: controller/exception/ControllerAdvice.java (the single @RestControllerAdvice)"
  - "odd-platform: exception/ErrorCode.java + the typed ExceptionWithErrorCode hierarchy"
found_date: "2026-06-25"
---

# Exception → HTTP-status mapping policy

> **Status:** draft (proposed). Extends **ADR-0007** (Uniform reactive controller pipeline — *one* `@RestControllerAdvice`, no per-controller exception translation). ADR-0007 establishes *where* errors are translated; this ADR establishes *which exception maps to which status, and the rule a service follows to choose one* — including the deliberate decision **not** to blanket-map `IllegalArgumentException`.

## Context

ADR-0007 records that a single `controller/exception/ControllerAdvice.java` maps the exception hierarchy to HTTP status, and that controllers do no per-method translation. The *taxonomy* it maps (verified @ `f4cf0693`):

| Exception (thrown by services / framework) | Status | `ErrorCode` |
|---|---|---|
| `BadUserRequestException` | 400 | `USR001` (`BAD_REQUEST`) |
| `NotFoundException` | 404 | `USR002` |
| `UniqueConstraintException` | 400 | `USR003` |
| `CascadeDeleteException` | 400 | `USR004` |
| `WebExchangeBindException` (field errors) | 400 | `USR001` |
| `GenAIException` | 500 | `SYS001` |
| `ResponseStatusException` (framework-raised; #1760/#1761) | its own status | mapped from the status |
| **anything else** (catch-all `@ExceptionHandler(Exception.class)`) | **500** | `SYS001` (`"Internal Server Error"`, full stack logged) |

The recurring question — surfaced again by **#1762** — is what a service should throw to signal a **client** error, and whether a broad JVM exception like `IllegalArgumentException` should be auto-mapped to 400. `IllegalArgumentException` is thrown 45 times across `odd-platform-api` (verified @ `f4cf0693`); the large majority are **server/config/internal** faults: bean-init config (`notification/config/NotificationConfiguration.java`, `datacollaboration/config/DataCollaborationConfiguration.java`), internal jOOQ query building (`repository/util/JooqQueryHelper.java`), WAL replication decoding (`notification/wal/PostgresWALMessageDecoder.java`), internal mappers, and a missing permission-extractor bean (`service/permission/PermissionServiceImpl.java`). Only `service/PolicyJSONValidator.java` is genuine **user input**.

## Decision

1. **A service signals a *client* error by throwing a typed domain exception** — `BadUserRequestException` (400), `NotFoundException` (404), `UniqueConstraintException` / `CascadeDeleteException` (400) — **never a raw `IllegalArgumentException`**. The typed exception *is* the status contract; the central advice maps it (ADR-0007).
2. **`IllegalArgumentException` / `IllegalStateException` and other unchecked JVM exceptions are *server faults*** → they fall to the catch-all `@ExceptionHandler(Exception.class)` → **500 / `SYS001`**, with the full stack trace logged for on-call. This is correct: a server invariant violated (a missing bean, an internal jOOQ shape, a config gap) is the *server's* fault, the client did nothing wrong, and re-issuing the same valid request keeps failing until the deployment is fixed (the RFC 4xx-vs-5xx test).
3. **`IllegalArgumentException` is NOT blanket-mapped to 400.** A class-wide `@ExceptionHandler(IllegalArgumentException.class) → 400` is rejected because it would: (a) reclassify ~43 server/config/internal faults (and every `NumberFormatException` / failed `Enum.valueOf`, which subclass it) as client errors; (b) **suppress the 5xx signal on-call pages on** (400s don't page); (c) risk **leaking internal exception messages** to clients (the catch-all deliberately returns a generic body). Spring itself does not auto-map `IllegalArgumentException` for the same reason.
4. **Use `IllegalStateException` (not `IllegalArgumentException`) for a server-invariant violation** where the value is structurally valid but the server cannot serve it (e.g. a valid resource type with no wired extractor bean) — it reads as "the server is in an illegal state", and still maps to 500.

## Consequences

- The next contributor adding a validation guard has a rule: *user input that fails validation → `BadUserRequestException`; an internal invariant → `IllegalStateException`/leave-to-catch-all (500).* No new `@ExceptionHandler` is added for broad JVM exceptions.
- Error responses stay honest for monitoring: 4xx = the caller's problem, 5xx = ours (pages on-call). Internal fault text is not exposed to clients.
- **Worked example (CTRIB-035 / #1762):** `PolicyJSONValidator` now throws `BadUserRequestException("Policy is not valid: %s", detail)` → 400 `USR001` with the validation detail (the permission enum + field paths are already public via `GET /api/policies/schema`, so no new disclosure). The missing-extractor fallthrough in `PermissionServiceImpl` becomes `IllegalStateException` (stays 500, intent explicit).
- **Tracked separately (not this change):** the ingestion-metric extractor `IllegalArgumentException → 500` paths (machine input — `service/ingestion/metric/...`) and declaring error responses in the OpenAPI contract.

## Evidence (re-verify `file:line` at promotion — Gate A2)

- `controller/exception/ControllerAdvice.java` — the 8 `@ExceptionHandler`s + the catch-all; no `IllegalArgumentException` handler (the taxonomy table above).
- `exception/ErrorCode.java:8-14` — `USR001..USR004`, `SYS001`, `SYS002` (no `USR400`).
- `exception/BadUserRequestException.java` + `ExceptionWithErrorCode.java` — the typed `RuntimeException` carrying `ErrorCode.BAD_REQUEST`.
- `service/PolicyJSONValidator.java:24-33` — the user-input validator (the change locus).
- `service/permission/PermissionServiceImpl.java:42-49` — the server-invariant fallthrough (the `IllegalStateException` locus).
- Pinned by `AdrControllerAdviceMappingScanTest` (the handler-set source pin) — unaffected by this change (no handler added/removed).
