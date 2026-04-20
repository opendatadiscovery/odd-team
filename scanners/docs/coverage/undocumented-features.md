---
id: docs/coverage/undocumented-features
target_repo: documentation (local: ../documentation) + odd-platform (local)
scope: Platform features with no documentation
estimated_items: 10-30
chunking: Can likely fit in one session (enumerate features from routes + API)
depends_on: []
priority: medium
---

## Purpose

Identify platform features that have no corresponding documentation page or section in the documentation repo.

## Method

1. Enumerate features from odd-platform source:
   - UI routes in `odd-platform-ui/src/routes/` (each route = potential feature)
   - Top-level OpenAPI endpoint groups in `odd-platform-specification/openapi.yaml`
   - Menu items / navigation in UI components
   - Management pages in `odd-platform-ui/src/components/Management/`
2. Fetch SUMMARY.md from the documentation repo (defines gitbook navigation tree)
3. Cross-reference: for each feature found in code, check if docs exist

## Criteria for a Finding

- Feature has UI route but no documentation page
- Feature has OpenAPI endpoints but no API documentation
- Feature appears in platform menu but is not mentioned in docs at all
- Feature has been added in recent releases (check git log) with no doc update

## Output

Write to: `findings/docs-coverage-undocumented-features/YYYY-MM-DD.md`

Per finding:
- Feature name (as shown in UI or API)
- Evidence of existence (route path, component directory, API endpoint group)
- Whether it's completely undocumented or just missing from certain sections
- Estimated documentation effort (simple page vs. complex multi-section)

## Navigation Update

Discovered features should be added to `navigation/features.yaml` if not already present.
