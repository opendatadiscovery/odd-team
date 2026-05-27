---
id: docs/accuracy/feature-behavior
target_repo: documentation (local: ../documentation) + odd-platform (local)
scope: All documented features vs. actual platform behavior, including consumer-side integrations and SDK defaults
estimated_items: 20-40
chunking: By feature domain — run one domain per session
depends_on: []
priority: critical
ontology_feed:
  # Rev-13 pilot opt-in — mode B (ontology-fed).
  # Rationale: this is the canonical accuracy scanner. Feature-flows ALREADY carry
  # `observed_vs_expected.facets[]` — the drift-class taxonomy this scanner's Pass A
  # exists to surface. Mode B's per-feature iteration over F-NNN replaces the
  # session-by-session feature-domain selection with deterministic catalog walk.
  # Pass B (SDK depth) + Pass C (error/retry/timeout) STAY UNCHANGED — those are
  # the consumer-read passes that catch what the ontology can't see today.
  enabled: true
  substrate_repo: odd-platform
  primary_investigation_target: feature-flows   # per Rule 21 (literal value)
  feature_scope_filter:
    target_repo_overlap: documentation+odd-platform  # canonical accuracy scope
  clue_sources:                                 # ordered = consumption order; feature-flows ALWAYS first
    - feature-flows/detail/F-*.yaml             # PRIMARY — drift facets are this scanner's input
    - lineage/odd-platform/feature-reflections/detail/F-*.yaml  # PO-level intent-vs-impl verdicts
    - lineage/odd-platform/concepts/index.yaml  # canonical vocabulary (Gate 2 input)
    - lineage/odd-platform/shoebox/detail/SHB-*.md  # open hypotheses to verify opportunistically
    - lineage/odd-platform/doc-gaps/            # DEDUP/PRIORITY HINT ONLY — never coverage signal
  verification_requirements:
    - "every clue cited as Source: Ontology[F-NNN] must be independently verified against file:line"
    - "no scanner finding may repeat a chain[].evidence string verbatim — re-state from the re-opened file"
    - "Pass B (SDK depth) + Pass C (error/retry) still run on every feature regardless of ontology coverage"
    - "every observed_vs_expected.facet[].drift_class consumed becomes a doc-side check (does the doc warn about it?)"
  consultation_budget:
    graph-retriever: 5
    feature-reflector: 3                        # PO consults for intent-vs-impl drift
    odd-sme: 2                                  # domain consults for industry-vocabulary alignment
  write_back:
    enabled: true
    targets: [feature-flows, sidecars, doc-gaps, shoebox]
  staleness_threshold_commits: 50
  staleness_action: warn
---

## Purpose

Verify that documented feature descriptions accurately reflect the current implementation. Identify cases where docs describe behavior that no longer exists, has changed, never worked as described, or silently depends on an unsafe SDK default.

A feature can look correct end-to-end at the controller / service / repository level and still mislead operators if an SDK it depends on is wired with surprising defaults (timeouts, retries, region, TLS, auth). This scanner reads the consumer and integration code, not just the service chain.

## Method

**Mode B (ontology-fed) is the rev-13 default for this scanner** (per the `ontology_feed:` frontmatter). The mode-B per-feature pseudo-protocol (APPROACH.md §20.3) replaces "pick one feature domain per session" with deterministic iteration over the ontology's catalog of F-NNN feature flows. For each in-scope F-NNN: read end-to-end, derive expected doc location from `pillar_id + pillar_anchored_feature_name`, run the 3 passes below (A surface + B SDK depth + C error/retry) against the feature's chain + observed_vs_expected.facets, emit findings, write-back. **Pass B and Pass C are unchanged** — those consumer-read passes catch what the ontology cannot see today (SDK builder unsets, error-handler defaults, retry/timeout policy). Pass A's drift-detection now consumes `feature-flows[].observed_vs_expected.facets[].drift_class` directly as candidates.

For mode-A standalone runs (or when `ontology_feed:` is disabled), the original by-feature-domain procedure stands:

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
