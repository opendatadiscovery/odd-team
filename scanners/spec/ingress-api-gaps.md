---
id: spec/ingress-api-gaps
target_repo: opendatadiscovery-specification (local) + odd-platform (local)
scope: Ingress API specification vs. actual platform implementation
estimated_items: 10-25
chunking: Can likely fit in one session
depends_on: []
priority: high
---

## Purpose

Identify discrepancies between the ODD Ingress API specification and the actual platform implementation — endpoints, request/response schemas, validation rules, and error responses.

## Method

1. Read the specification: `opendatadiscovery-specification/specification/`
2. Read the platform's Ingress API implementation:
   - Controller: find the ingestion controller
   - Service: ingestion service logic
   - Validation: request validation rules
   - OpenAPI: `odd-platform-specification/openapi.yaml` (platform's own spec)
3. Compare field-by-field:
   - Are all spec-defined fields accepted by the platform?
   - Does the platform accept fields not in the spec?
   - Do validation rules match (required vs. optional, type constraints)?
   - Do error responses match spec-defined error shapes?

## Criteria for a Finding

- Spec defines a field that platform ignores (accepts but doesn't store/process)
- Spec marks a field required but platform makes it optional (or vice versa)
- Platform accepts extra fields not in spec (undocumented extensions)
- Spec defines an endpoint that platform doesn't implement
- Platform implements ingestion logic that contradicts spec description
- Error response format differs from spec

## Output

Write to: `findings/spec-ingress-api-gaps/YYYY-MM-DD.md`

Per finding:
- Spec reference (file, section, field)
- Platform implementation (file, line)
- Nature of gap (missing, contradicting, undocumented extension)
- Which side should change (spec or platform) — initial assessment
