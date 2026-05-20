## REFACTOR-279 — `AppError.message` falls back to literal string `'An error occurred'` when backend returns non-JSON body / no message field; 502/504 from intervening proxy renders SAME opaque banner as a real 404

**Severity**: MEDIUM
**Category**: error-mapping
**Pillars affected**: [P-01, P-02, P-04, P-05, P-06, P-07, P-08, P-09] — every primary-page-load thunk surface (14 thunks per the `switchOffErrorMessage` grep) inherits the gap
**Surfaced by**:
- `fetchDataEntityDetails.md:bugs_limitations_corner_cases[2]` (|-
    "**`AppError.message` falls back to the literal string `'An error occurred'`** when the backend returns a non-JSON body or a body without a `message` field. The detail page on error renders this generic string via `<AppErrorPage>`. A 502/504 from the platform process or an intervening proxy with an HTML error body becomes the same opaque banner as a real 404 — operators have no way to tell from the UI whether the entity doesn't exist or the backend is down.")

**Description**: The shared `AppError` envelope (`lib/errorHandling.tsx:5-26`) carries `{ status, statusText, url, message }`. The `message` field is populated by `body?.message || 'An error occurred'` (line 24). When the backend response body is:
- **JSON with `{message: "..."}` field** → `body.message` populates correctly.
- **JSON without `message` field** → falls back to literal `'An error occurred'`.
- **Non-JSON body** (e.g. HTML from an intervening proxy, plain-text error pages, empty body on 502/504) → `body` parse fails or yields no `message` field → falls back to literal `'An error occurred'`.

The `<AppErrorPage>` (`DataEntityDetails.tsx:116-119`) renders the envelope as a full-page banner. For a user looking at a "An error occurred" banner with status `502`, there is no UI affordance distinguishing:
- "The entity exists but the backend is currently overloaded (502 from proxy)."
- "The entity doesn't exist and the backend returned 404 with a generic body."
- "The backend is fully down and the proxy returned its own 502 HTML page."

Each is a different user remedy:
- 502 from proxy → retry in 30s.
- 404 → look elsewhere for the entity.
- Full backend down → wait for ops team / file a bug.

The generic fallback collapses all three into "An error occurred."

**Primary source citations**:
- `lib/errorHandling.tsx:12-26` — the fallback at line 24
- `DataEntityDetails.tsx:116-119` — the AppErrorPage rendering
- `fetchDataEntityDetails.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-086 codifies the two-mode error surface (toast vs `<AppErrorPage>`). The fallback message is a sub-behaviour of the AppError envelope; no ADR prescribes the absence of status-class differentiation.

**Proposed remedy**: Differentiate the fallback by status class:
- 4xx (404, 403) → "Entity not found or access denied" (specific).
- 5xx (500, 502, 503, 504) → "Backend service is temporarily unavailable. Please retry in a moment."
- Network error (no status) → "Unable to reach the backend. Check your network."

The differentiation lives in `<AppErrorPage>` or in a derived selector; the envelope retains the raw fields, the renderer interprets them.

**Severity rationale**: MEDIUM — UX gap; operators interpreting error banners on the production deployment have ambiguous information. Fix is straightforward.

**Suggested backlog grouping**: `UI error-surface hardening sprint`.

---
