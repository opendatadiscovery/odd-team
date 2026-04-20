---
id: docs/accuracy/architecture-drift
target_repo: odd-docs (remote) + odd-platform (local) + odd-collectors (local)
scope: Architecture documentation vs. actual system structure
estimated_items: 10-20
chunking: One repo per session
depends_on: []
priority: critical
---

## Purpose

Verify that architecture documentation (system diagrams, component descriptions, technology choices, data flow descriptions) accurately reflects the current codebase.

## Method

1. Fetch architecture/overview pages from odd-docs
2. For each architectural claim, verify against actual code structure:
   - Technology versions (Java version, Spring Boot version, React version, etc.)
   - Module/package structure
   - Data flow descriptions
   - Integration points between services
   - Database schema approach
   - Authentication architecture

## Criteria for a Finding

- Documented tech version doesn't match build files (build.gradle, package.json, pyproject.toml)
- Documented module structure doesn't match actual directory layout
- Documented data flow contradicts actual service interactions
- Documented deployment architecture references removed/renamed services
- Documented integration points (e.g., "Platform talks to X via Y") that no longer exist

## What to Check

### odd-platform
- `build.gradle` → actual dependency versions
- Directory structure → matches documented module layout?
- `docker/` → deployment topology matches docs?
- `application.yml` → integration points match docs?

### odd-collectors
- `pyproject.toml` → actual dependency versions
- Package structure → matches documented adapter pattern?
- SDK architecture → matches documented flow?

## Output

Write to: `findings/docs-accuracy-architecture-drift/YYYY-MM-DD-{repo}.md`

Per finding report:
- Doc page and the architectural claim
- What actually exists (file path, version string, structure)
- Nature of drift: renamed, removed, restructured, or version-bumped
- Impact: does the drift confuse a reader trying to navigate the code?
