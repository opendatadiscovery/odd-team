# REFACTOR-639 — `GET /api/messages/{message_id}/url` returns HTTP 302 (Found) but the OpenAPI spec declares 301 (Moved Permanently); the live api-reference doc acknowledges the drift but the spec is unchanged

**Severity**: MEDIUM
**Category**: openapi-spec-impl-drift + status-code-drift
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-06 Configuration & Deployment]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "Status-code drift on `redirect`: OpenAPI declares `301 Moved Permanently` (`openapi.yaml:1788-1789`) but the controller emits `HttpStatus.FOUND` (302) (`DataCollaborationController.java:45`). Spec-generated client code (`generated-sources` in `odd-platform-ui`) may interpret the responses differently. Live api-reference doc page acknowledges the drift, but the OpenAPI YAML is still wrong."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:docs_link_semantic.doc_drift_findings.[1]` — "Live api-reference page acknowledges the 302-vs-301 drift on the `redirect` endpoint, but the OpenAPI spec at `openapi.yaml:1788-1789` STILL declares `301 Moved Permanently`. Spec-generated client code may interpret responses incorrectly. Three sources of truth disagree: code (302), spec (301), live doc (302 + note)."

**Description**: Three sources of truth disagree on the redirect endpoint's status code:

1. **Code**: `DataCollaborationController.java:45` — `ResponseEntity.status(HttpStatus.FOUND)` (302).
2. **OpenAPI spec**: `openapi.yaml:1788-1789` — `'301':\n  description: Moved Permanently`.
3. **Live api-reference doc**: `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` (WebFetched 2026-05-25 status 200) — "302 Found redirect … The OpenAPI spec declares `301 Moved Permanently` for this route; the platform actually serves `302 Found`. Operators should treat responses as 302."

The choice of 302 over 301 is ACTUALLY CORRECT for a dynamic redirect — 301 is cached aggressively by user agents (some caches don't revalidate for the lifetime of the cache), while 302 explicitly signals a temporary redirect that should be re-resolved on every request. The Slack permalink itself can change (e.g. message edited Slack-side, channel renamed); 301 would cause stale redirects.

The drift is therefore: **the code is correct; the spec is wrong**. The live doc acknowledges this but the spec is unchanged.

**Operator-visible failure modes**:

1. **OpenAPI-codegen clients mis-handle** — a third-party developer generating a client from the OpenAPI spec will write code expecting 301; the actual 302 response may be interpreted differently (some HTTP-client libraries cache 301 indefinitely; 302 they don't).

2. **Tooling discrepancy** — automated API contract testing tools that read the OpenAPI spec to drive assertions will fail on 302 (expecting 301). The platform's CI does not run such tests; third-party deployments may.

3. **Documentation reader confusion** — operators reading the live doc see "OpenAPI says 301, platform serves 302, treat as 302". The acknowledgment is operator-friendly but burdens the reader with knowing two different specifications.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../DataCollaborationController.java:45` (the 302 emission).
- `<odd-platform-specification>/openapi.yaml:1788-1789` (the 301 declaration).
- `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` (the live doc acknowledging the drift).

**Existing-ADR-or-implied-prescription**: Sibling pattern: REFACTOR-545 (OpenAPI status-code drift cluster — 9+ endpoint-level instances across 7+ controllers; spec declares 201 for Create+Update; controllers uniformly return 200; tests assert isOk() locking in 200 — close the gap by spec-fix, not code-fix). The same maintenance principle applies here: the code is right; the spec is wrong.

**Proposed remedy**: Two-part fix:

1. **Fix the OpenAPI spec** (lines 1788-1789 in the upstream `opendatadiscovery-specification` repo's `openapi.yaml`):

```yaml
# Before (wrong)
'301':
  description: Moved Permanently

# After (correct, matches impl)
'302':
  description: Found (temporary redirect to the provider's deep-link for the message; the link is regenerated on every call because Slack permalinks can change as the message is edited / channel renamed Slack-side)
```

2. **Regenerate the platform's generated-sources** (the OpenAPI codegen runs against the upstream spec via the Gradle dependency `io.github.opendatadiscovery:opendatadiscovery-specification:0.1.40` per IngestionController sidecar). Bump the spec version once the fix is merged upstream.

3. **Update live api-reference doc** to REMOVE the "spec declares 301; platform serves 302" caveat once the spec is fixed — the doc and spec align on 302.

4. **Add a regression test** asserting `response.getStatusCode() == HttpStatus.FOUND` (302) on a happy-path redirect call. The test locks the choice in; future maintainers cannot accidentally change to 301 without the test failing.

**Severity rationale**: MEDIUM — operator-actionable spec-vs-code drift; third-party clients are the affected population; the fix is upstream (in the `opendatadiscovery-specification` repo) and small. Pairs with REFACTOR-545 (the broader cluster of 201-vs-200 drifts across the platform) — the same maintenance principle (fix spec, not code; add tests to lock in).

**Suggested backlog grouping**: `OpenAPI spec drift hardening sprint` — bundle with REFACTOR-545's existing instances + the new MetadataField PageInfo theatre (REFACTOR-642) + Owner status-code drift (REFACTOR-641).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-545 (status-code-drift cluster — this is the 10th instance).
- SUPERSEDES: none.
- CONFLICTS: none.

---
