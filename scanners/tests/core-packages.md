---
id: tests/core-packages
target_repo: odd-models-package (local) + oddrn-generator (local if exists) + specification-contracts (remote)
scope: Test coverage for shared libraries used across the ecosystem
estimated_items: 10-20
chunking: One package per session
depends_on: []
priority: high
---

## Purpose

Assess test coverage for core packages that ALL other ODD components depend on. A bug here propagates everywhere — these need solid tests.

## Method

For each package:

1. Identify source modules
2. Find existing tests
3. Cross-reference coverage
4. Assess: do tests verify the contract (input/output shape) or just trivial behavior?

## Packages to Scan

### odd-models-package (local: ../odd-models-package)
- Generated Pydantic models from specification
- Serialization/deserialization correctness
- Model validation rules
- Backward compatibility (can old payloads still parse?)

### oddrn-generator (local: ../oddrn-generator if exists)
- ODDRN path generation for each data source type
- Format validation
- Edge cases (special characters, long paths, empty segments)

### specification-contracts (remote)
- Generated code validity
- Contract tests against spec

## Criteria for a Finding

- Core module has no tests
- Model serialization/deserialization is untested
- ODDRN generation for specific sources is untested
- No regression test for backward compatibility
- Validation rules exist in code but no test exercises them

## Output

Write to: `findings/tests-core-packages/YYYY-MM-DD-{package}.md`

Per finding:
- Package, module, untested logic
- Downstream impact (what breaks if this is wrong?)
- Suggested test approach
