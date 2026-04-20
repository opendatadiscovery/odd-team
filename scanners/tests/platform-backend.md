---
id: tests/platform-backend
target_repo: odd-platform (local)
scope: Backend service and repository layer test coverage
estimated_items: 30-60
chunking: By service domain — scan 5-7 services per session
depends_on: []
priority: high
---

## Purpose

Identify backend service and repository classes that lack test coverage, focusing on business logic that could silently break.

## Method

1. List all service classes: `odd-platform-api/src/main/java/.../service/`
2. List all repository classes: `odd-platform-api/src/main/java/.../repository/reactive/`
3. List all existing test files: `odd-platform-api/src/test/java/`
4. Cross-reference: for each service/repository, check if a corresponding test exists
5. For services WITH tests, assess coverage quality:
   - Does the test cover the main happy path?
   - Does the test cover error/edge cases?
   - Is the test actually testing logic (not just calling methods)?

## Criteria for a Finding

- Service class has zero corresponding test file
- Service class has a test file but only tests trivial getters (not business logic)
- Repository class has no integration test with testcontainers
- Complex method (>30 lines, multiple branches) has no dedicated test case
- Service handles external integration (Slack, auth) with no mock-based test

## What to Check Per Service

1. Does `{ServiceName}Test.java` or `{ServiceName}IntegrationTest.java` exist?
2. If yes, does it test the public methods with meaningful assertions?
3. Are error paths tested (what happens when repository returns empty, when validation fails)?
4. For services with transactions, is rollback behavior tested?

## Output

Write to: `findings/tests-platform-backend/YYYY-MM-DD-batch-{N}.md`

Per finding:
- Service/repository class (full path)
- Public methods that lack test coverage
- Complexity/risk assessment (how likely is this to break silently?)
- Suggested test approach (unit test, integration with testcontainers, mock-based)

## Navigation Update

Update `navigation/domains/{feature}.md` test sections with discovered test locations.
