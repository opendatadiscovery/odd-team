## REFACTOR-280 — `AppError.url` carries the request URL into the UI's error banner, reflecting internal API paths on deployments without proxy stripping; defence-in-depth info-disclosure gap

**Severity**: LOW
**Category**: info-disclosure
**Pillars affected**: [P-09] — Security (defence-in-depth)
**Surfaced by**:
- `fetchDataEntityDetails.md:security.known_security_gaps[1]` (|-
    "**Error-payload reflection** — `AppError.url` carries the request URL into the UI's error banner. For a deployment behind a reverse proxy that strips internal paths, this is harmless; for a deployment exposing the platform directly, the banner reveals the backend's actual API path (`/api/dataentities/{id}`). Low-severity defense-in-depth gap.")

**Description**: The `AppError` envelope includes the request URL (`lib/errorHandling.tsx:20-25`). The `<AppErrorPage>` renders this URL in its banner. For deployments behind a reverse proxy that strips internal paths (the recommended deployment shape), the displayed URL is whatever the proxy presents. For deployments exposing the platform process directly (development, naive single-pod Kubernetes deployments, demo instances), the displayed URL is the literal backend path including `/api/...` segments.

This is a defence-in-depth info-disclosure: the URL itself is not sensitive (the OpenAPI spec is public), but exposing the EXACT backend path in user-visible error banners normalizes path-discovery for attackers and reduces friction for path-enumeration probes.

**Primary source citations**:
- `lib/errorHandling.tsx:20-25` — the URL field on AppError
- `fetchDataEntityDetails.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-086 codifies the AppError envelope. The URL field is part of the envelope; the disclosure is a presentation choice in `<AppErrorPage>`.

**Proposed remedy**: Make `<AppErrorPage>` URL-display configurable via an env / build-time flag. Default to STRIPPING the path in production builds, INCLUDING it in dev builds (operator-debugging). Alternatively: display only the HTTP method + a generic "request failed" message in production.

**Severity rationale**: LOW — defence-in-depth gap, not an active vulnerability. Fix is straightforward.

**Suggested backlog grouping**: `UI security hardening sprint`.

---
