---
id: docs/accuracy/feature-behavior
target_repo: documentation (local: ../documentation) + odd-platform (local)
scope: All documented features vs. actual platform behavior
estimated_items: 20-40
chunking: By feature domain — run one domain per session
depends_on: []
priority: critical
---

## Purpose

Verify that documented feature descriptions accurately reflect the current implementation. Identify cases where docs describe behavior that no longer exists, has changed, or never worked as described.

## Method

For each feature domain (pick one per session from `navigation/features.yaml`):

1. Fetch the relevant documentation page(s) from the documentation repo
2. Read the corresponding code entry points from `navigation/domains/{feature}.md`
3. Cross-reference: for each claim in the docs, verify it against the code
4. **Repo boundary check**: if the domain navigation file lists only platform/collectors but the docs claim integration with an external tool, consult `navigation/repos.yaml` to identify any standalone repos that implement that integration. Never conclude "feature doesn't exist" based solely on absence from the two primary target repos.

## Criteria for a Finding

- Doc describes a UI element/button/tab that doesn't exist in current code
- Doc describes an API endpoint with wrong parameters or response shape
- Doc describes a workflow with steps that no longer apply
- Doc mentions configuration options that have been renamed or removed
- Doc screenshots show an outdated UI (infer from component code if elements changed)
- Doc describes behavior that contradicts the service/controller logic

## What to Check Per Feature

1. API endpoints: do documented paths/params match `openapi.yaml`?
2. UI elements: do documented components exist in `odd-platform-ui/src/components/`?
3. Configuration: do documented config keys exist in `application.yml`?
4. Workflows: does the described sequence match controller→service→repository flow?
5. **Cross-repo claims**: if docs claim integration with an external tool (profiler, GE, dbt, Spark, etc.), check `navigation/repos.yaml` for a dedicated repo and verify the claim against that repo's actual dependencies and code — not just the two target repos

## Output

Write to: `findings/docs-accuracy-feature-behavior/YYYY-MM-DD-{domain}.md`

Per finding report:
- Doc page and section
- The claim made in documentation
- What the code actually does (with file path + line reference)
- Whether the doc is wrong, outdated, or misleadingly incomplete
- Severity: critical (completely wrong), high (partially wrong), medium (misleading by omission)

## Navigation Update

As you trace features through the code, update `navigation/domains/{feature}.md` with any file paths you discover that aren't already listed.
