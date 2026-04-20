---
id: docs/accuracy/api-examples
target_repo: odd-docs (remote) + odd-platform-specification (local)
scope: Documented API examples vs. actual OpenAPI specification
estimated_items: 10-25
chunking: Can likely fit in one session (API docs are bounded)
depends_on: []
priority: critical
---

## Purpose

Verify that API usage examples in documentation (curl commands, request/response samples) match the actual OpenAPI specification and implementation.

## Method

1. Fetch API documentation pages from odd-docs
2. Extract all API examples (endpoints, request bodies, response shapes)
3. Cross-reference against `odd-platform-specification/openapi.yaml`
4. For Ingress API, also check `opendatadiscovery-specification/specification/`

## Criteria for a Finding

- Documented endpoint path doesn't exist in OpenAPI spec
- Documented request body has wrong field names or types
- Documented response shape doesn't match spec's response schema
- Documented HTTP method is wrong
- Documented auth requirements don't match actual security scheme
- Documented status codes don't match spec

## Output

Write to: `findings/docs-accuracy-api-examples/YYYY-MM-DD.md`

Per finding:
- Doc page and the API example
- Actual OpenAPI spec path and schema
- Specific discrepancy (wrong field, wrong type, missing field, extra field)
