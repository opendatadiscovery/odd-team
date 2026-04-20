---
id: spec/openapi-accuracy
target_repo: odd-platform (local)
scope: Platform OpenAPI spec vs. actual controller implementation
estimated_items: 20-50
chunking: By API domain (data-entities endpoints, search endpoints, etc.) — one group per session
depends_on: []
priority: high
---

## Purpose

Verify that the platform's OpenAPI specification (`odd-platform-specification/openapi.yaml`) accurately reflects the actual controller implementations. Since controllers are generated from the spec, this checks for drift in the spec itself relative to the service layer behavior.

## Method

1. Read relevant section of `odd-platform-specification/openapi.yaml`
2. Find the generated controller interface it produces
3. Find the actual controller implementation
4. Trace into service layer — does the endpoint actually do what the spec says?
5. Check:
   - Response schema matches what service actually returns
   - Query parameters are actually used
   - Path parameters map to actual operations
   - Documented status codes match actual error handling

## Criteria for a Finding

- Endpoint spec says it returns field X, but service never populates it
- Endpoint spec documents query param that's accepted but ignored
- Endpoint spec says 404 on not-found, but service returns 400 or empty 200
- Endpoint spec has a description that contradicts implementation behavior
- Endpoint exists in spec but controller throws NotImplemented or TODO

## Output

Write to: `findings/spec-openapi-accuracy/YYYY-MM-DD-{api-group}.md`

Per finding:
- OpenAPI path and operation
- Controller + service files
- Discrepancy description
- Severity (misleading for API consumers? or cosmetic?)
