---
id: docs/accuracy/feature-behavior
target_repo: documentation (local: ../documentation) + odd-platform (local)
scope: All documented features vs. actual platform behavior, including consumer-side integrations and SDK defaults
estimated_items: 20-40
chunking: By feature domain — run one domain per session
depends_on: []
priority: critical
---

## Purpose

Verify that documented feature descriptions accurately reflect the current implementation. Identify cases where docs describe behavior that no longer exists, has changed, never worked as described, or silently depends on an unsafe SDK default.

A feature can look correct end-to-end at the controller / service / repository level and still mislead operators if an SDK it depends on is wired with surprising defaults (timeouts, retries, region, TLS, auth). This scanner reads the consumer and integration code, not just the service chain.

## Method

For each feature domain (pick one per session from `navigation/features.yaml`):

1. Fetch the relevant documentation page(s) from the documentation repo (post `origin/main` fetch — GitBook edits land directly on main).
2. Read the corresponding code entry points from `navigation/domains/{feature}.md`. Confirm the domain file lists **bean factories and SDK builders**, not just the controller / service / repository chain — if missing, add them before scanning so the next scan does not have to grep.
3. For each claim in the docs, verify it against the code. Three passes:
   - **Pass A — Surface**: claim vs. controller / service / repository behavior, UI components, API shape.
   - **Pass B — Integration / SDK depth** (MANDATORY for any feature backed by an external SDK or client): open the bean factory, enumerate every builder parameter, classify each as `configured | safely-defaulted | caveat-defaulted`. Every caveat-defaulted parameter is a potential finding.
   - **Pass C — Error / retry / timeout**: open the explicit handler, not "the SDK probably retries". Undocumented failure modes that change operator behavior (silent drops, unbounded retries, hardcoded timeouts) are findings.
4. **Repo boundary check**: if the domain navigation file lists only platform/collectors but the docs claim integration with an external tool, consult `navigation/repos.yaml` to identify any standalone repos that implement that integration. Never conclude "feature doesn't exist" based solely on absence from the two primary target repos.

## Criteria for a Finding

### Surface (Pass A)
- Doc describes a UI element/button/tab that doesn't exist in current code
- Doc describes an API endpoint with wrong parameters or response shape
- Doc describes a workflow with steps that no longer apply
- Doc mentions configuration options that have been renamed or removed
- Doc screenshots show an outdated UI (infer from component code if elements changed)
- Doc describes behavior that contradicts the service/controller logic

### Integration / SDK depth (Pass B) — the DOC-008 class
- A feature depends on an SDK whose builder leaves a parameter unset with an unsafe default in ODD's deployment context (e.g., region, TLS, auth, timeout, retries)
- An integration silently ignores a config key the doc says is respected
- A feature ships with an ephemeral / non-persistent default that the doc does not warn about (the 2026-04-21 attachment trap)
- Authentication flow defaults are unsafe or surprising given the documented deployment

### Error / retry / timeout (Pass C)
- Retry count / backoff strategy is undocumented but affects operator SLO
- Timeout is hardcoded and undocumented
- Failure mode is silent (e.g., notification drops on auth failure) and undocumented

## What to Check Per Feature

1. API endpoints: do documented paths/params match `openapi.yaml`?
2. UI elements: do documented components exist in `odd-platform-ui/src/components/`?
3. Configuration: do documented config keys exist in `application.yml` AND behave as documented at every consumer site?
4. Workflows: does the described sequence match controller → service → repository flow?
5. **SDK integrations**: for each external SDK the feature uses, the bean factory's builder must be audited (Pass B). Record every parameter's status.
6. **Error behavior**: is the documented failure mode the same as the code's actual failure mode?
7. **Cross-repo claims**: if docs claim integration with an external tool (profiler, GE, dbt, Spark, etc.), check `navigation/repos.yaml` for a dedicated repo and verify the claim against that repo's actual dependencies and code — not just the two target repos

## Output

Write to: `findings/docs-accuracy-feature-behavior/YYYY-MM-DD-{domain}.md`

Per finding report:
- Doc page and section
- The claim made in documentation (or the undocumented caveat)
- What the code actually does (with file path + line reference)
- **Consumer-read evidence** for integration-backed claims (bean factory, SDK builder, handler — by file:line)
- For SDK integrations, include the **unset-parameter table** from Pass B
- Whether the doc is wrong, outdated, misleadingly incomplete, or missing a caveat
- Severity: critical (data loss / security exposure / completely wrong), high (partially wrong or missing integration caveat), medium (misleading by omission)

Findings about integration-backed features without a Pass B audit are themselves incomplete — review should flag and re-scan.

## Navigation Update

As you trace features through the code, update `navigation/domains/{feature}.md` with any file paths you discover that aren't already listed — especially bean factories and SDK builders, which future scans need to find without grepping.
