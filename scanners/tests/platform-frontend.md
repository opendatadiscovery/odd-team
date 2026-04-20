---
id: tests/platform-frontend
target_repo: odd-platform (local)
scope: React component and Redux slice test coverage
estimated_items: 20-50
chunking: By component directory — scan one top-level directory per session
depends_on: []
priority: medium
---

## Purpose

Identify frontend components and state management logic that lack test coverage.

## Method

1. List component directories: `odd-platform-ui/src/components/`
2. List Redux slices: `odd-platform-ui/src/redux/slices/`
3. List thunks: `odd-platform-ui/src/redux/thunks/`
4. Search for existing test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`)
5. Cross-reference: identify components/slices without tests

## Criteria for a Finding

- Component directory has zero test files
- Redux slice has no test for reducers/selectors
- Thunk has no test for async logic (success + error paths)
- Complex utility function in `lib/` has no unit test
- Component with significant conditional rendering has no test

## Priority Within Findings

Focus on:
- Components with business logic (not just layout/styling)
- Redux slices that transform data
- Utility functions used across multiple components
- Skip: purely presentational wrappers, simple styled-components

## Output

Write to: `findings/tests-platform-frontend/YYYY-MM-DD-{directory}.md`

Per finding:
- Component/slice/utility path
- What logic needs testing
- Suggested test approach (Vitest + React Testing Library patterns)
