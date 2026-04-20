---
id: navigation/cross-repo-links
target_repo: all local repos
scope: Identify where repos reference each other and where links are missing
estimated_items: 15-30
chunking: One relationship direction per session
depends_on: [navigation/feature-entry-points]
priority: medium
---

## Purpose

Map the connection points between repositories and identify where cross-references are missing or broken. This helps agents understand how a change in one repo might require corresponding changes in another.

## Method

### Direction 1: Specification → Platform
1. For each Ingress API endpoint in specification, find the implementing controller in odd-platform
2. For each data model in specification, find the corresponding JOOQ/DB model in odd-platform
3. Report: where does spec define something that platform doesn't implement? Vice versa?

### Direction 2: Specification → Collectors
1. For each data model in specification, find usage in odd-collectors SDK (`odd-models` package)
2. For each field in spec models, check if collectors actually populate it
3. Report: fields defined in spec but never populated by any collector

### Direction 3: Platform OpenAPI → Collectors SDK
1. Platform Ingress API endpoints → SDK API client methods
2. Report: mismatches in expected request/response format

### Direction 4: Platform → Docs
1. Features implemented in platform → documentation coverage
2. (Overlaps with docs/coverage scanner but focuses on the linkage itself)

## Criteria for a Finding

- Spec defines a field that no collector populates and platform doesn't display
- Platform implements an endpoint not in the spec (undocumented extension)
- Collectors SDK targets an API version that differs from platform's current version
- A change in one repo would require a change in another but there's no comment/reference indicating this

## Output

Write to: `findings/navigation-cross-repo-links/YYYY-MM-DD-{direction}.md`

Also update: `navigation/domains/` files with cross-repo references discovered.
