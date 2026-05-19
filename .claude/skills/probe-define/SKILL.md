---
name: probe-define
description: Generate probe-skeleton YAML files at `lineage/{repo}/probes/{P-NNN}.yaml` from `feature-flows.yaml`'s uncovered test-matrix cells. Each skeleton carries the feature_id + test_class + cross-references + a TODO-marked arrange/act/observe/assert block the maintainer fills in. Accelerates probe corpus growth — slice 4 of dynamic-verification ADR. Local-only per APPROACH.md section 5 rule 12.
argument-hint: --feature <feature-id> [--test-class unit|integration|performance|security] [--all-uncovered] [--out-id <P-NNN>]
allowed-tools: Read Grep Glob Bash(python3 *) Bash(ls *) Bash(cat *) Write
---

# Generate a probe skeleton from an uncovered cell (slice 4)

Drive the layer-5 probe-corpus growth. Each invocation produces (or refreshes) a probe-skeleton YAML at `lineage/{repo}/probes/{P-NNN}.yaml`. The skeleton carries enough scaffolding for the maintainer to fill in the arrange / act / observe / assert blocks with the specific behaviour the probe pins; the cross-references + frontmatter are pre-populated from feature-flows.yaml.

This skill is the maintainer-facing entry point for the canonical slice-4 deliverable per `adrs/drafts/dynamic-verification-layer.md`.

## Prerequisite

- `lineage/{repo}/feature-flows.yaml` exists with at least one feature.
- `lineage/{repo}/probes/` directory exists (`/probe-run` created it as part of slice 2).
- `python3` available (the skill uses a small inline script to compute the next-available probe ID and parse feature-flows.yaml).

## Argument forms

| Form | Behaviour |
|---|---|
| `/probe-define --feature <feature-id>` | Generate one skeleton for the first uncovered cell of that feature (lowest test_class index in `unit/integration/performance/security` order). |
| `/probe-define --feature <feature-id> --test-class <class>` | Generate one skeleton for the specified test_class of that feature. |
| `/probe-define --feature <feature-id> --all-uncovered` | Generate one skeleton per uncovered cell of the feature (up to 4 — one per test_class). |
| `/probe-define --feature <feature-id> --out-id P-NNN` | Override the auto-derived probe ID (default: next-available based on existing probes). |
| `/probe-define --all` | Generate skeletons across every feature × every uncovered cell. Useful for batch corpus growth. |

## Protocol

### 1. Orient (read-only)

- Read `lineage/{repo}/feature-flows.yaml`. Capture the feature(s) requested.
- For each requested feature, enumerate uncovered cells: those whose `test_matrix.<class>.state` is `GAP` or `PARTIAL`. (`PROBED-*` cells are already covered — skip.)
- Find the next available probe ID by scanning `lineage/{repo}/probes/P-*.yaml`. Convention: `P-NNN` where NNN starts at 001 and increments. Don't reuse IDs.
- Confirm the orchestration plan to the maintainer: list each skeleton that will be created.

### 2. Generate each skeleton

For each skeleton, write to `lineage/{repo}/probes/{P-NNN}.yaml` with this shape:

```markdown
---
probe_id: P-NNN
feature_id: F-NNN
test_class: <class>
verified_against_commit: <substrate manifest's last_scan_commit>
prompt_version: probe-runner/0.1.0
maintainer_curated: false   # set to true once the maintainer fills in the body
stack_profile: odd-minimal   # adjust if the test_class requires a different profile
expected_outcome: |
  TODO: in one paragraph, describe the user-observable behaviour this probe
  pins. Frame as a user-facing promise that the system either keeps (PASS-PASSING)
  or visibly breaks (PASS-PINNING-BUG). When the fix lands, the assertion flips.

  Refer to the related_refactoring_scopes / related_test_gaps / related_doc_gaps
  in cross_references below for what the probe is targeting.
---

# P-NNN — <descriptive title>

arrange:
  - kind: docker-compose-up
  # TODO: seed any data_source / data_entity / namespace rows the probe needs.
  # Use a unique numeric ID (1000 + probe-number is the slice-2/3 convention).
  - kind: sql
    query: |
      INSERT INTO data_source (id, oddrn, name)
      VALUES (NNNN, '//probe-source/db', 'probe-source-P-NNN')
      ON CONFLICT (id) DO NOTHING

  # TODO: add more seed steps as needed (data_entity, namespace, term, etc.)
  # Pre-load any initial state the probe will observe.

act:
  # TODO: the action whose effect the probe measures. Examples:
  #   - kind: rest
  #     method: GET | POST | PUT | DELETE
  #     path: /api/...
  #     body: {...}      # for POST/PUT; supports ${capture_name} substitution
  #     count: N         # for repeated calls
  #     expect_any_status: true   # for probes intentionally testing 4xx/5xx paths
  #   - kind: browser
  #     path: /dataentities/...
  #     wait_until: load
  #     post_settle_ms: 6000
  #     xhr_filter_regex: '^http://localhost:18080/api/...$'

observe:
  # TODO: capture measurable state. Examples:
  #   - kind: sql
  #     query: "SELECT view_count FROM data_entity WHERE id = NNNN"
  #     capture_as: final_view_count
  #   - kind: response_contains
  #     from: <act-step capture_as>
  #     item_field: id
  #     target_value: NNNN
  #     capture_as: entity_appeared
  #   - kind: latency_distribution
  #     over: "all act steps"
  #     capture_percentiles: [p50, p95, p99]
  #     capture_as: latency_curve

assert:
  # TODO: pin the user-observable behaviour. Format each assertion as a Python
  # expression using captured variable names. Safe-eval forbids function calls,
  # so use comparisons / membership / arithmetic only.
  - "TODO: replace with a real assertion"

cleanup:
  - kind: docker-compose-down
    destroy_volumes: true

cross_references:
  refactoring_scopes: [<auto-populated from feature-flows.yaml#F-NNN.related_refactoring_scopes>]
  test_gaps: [<auto-populated>]
  doc_gaps: [<auto-populated>]
  related_concepts: [<auto-populated>]
  retrospectives: [<auto-populated>]

realism_caveats: |
  TODO: what this probe approximates rather than fully verifies. Examples
  from slice-2/3 probes: stack_profile DISABLED-only (LOGIN_FORM/OAUTH2/LDAP
  variants deferred); image tag mismatched with substrate commit; small seed
  vs production-shape; etc.
```

### 3. Report

Concise output:

- Count of skeletons created
- Path of each created file
- Next steps: "Edit each skeleton's TODOs; run `/probe-run --validate <P-NNN>` to confirm well-formedness; then `/probe-run <P-NNN>` to execute against the local mirror."

## Rules

- **Never overwrite an existing probe file** unless `--force` is explicit (slice-4 doesn't expose `--force` yet — refuses to clobber).
- **Pre-populate cross-references** from feature-flows.yaml's `related_*` arrays. The probe-runner reads these on PASS/FAIL to merge sidecar confidence annotations.
- **Use the next-available numeric ID by default** (`max(existing P-NNN) + 1`).
- **Respect the stack_profile** the feature implies (currently always `odd-minimal`; slice-5 introduces variants).
- **Mark `maintainer_curated: false`** in the skeleton; the maintainer flips to `true` once the TODO blocks are filled in.
- **Local-only execution** per APPROACH.md section 5 rule 12: every step in the generated skeleton must be runnable on the local workstation. No remote URLs, no managed services.

## Cross-references

- ADR anchor: `adrs/drafts/dynamic-verification-layer.md` slice 4
- Runner: `lineage/_extractor/probe-runtime/runner.py` (executes the probes once filled in)
- Existing probes for shape reference: `lineage/odd-platform/probes/P-001.yaml` ... `P-009.yaml`
- Sidecar merge: `merge_probe_into_sidecars()` in `runner.py` — fires after PASS/FAIL and consults the probe's cross_references to update per-node sidecars

## Implementation note

This skill orchestrates a small Python helper that handles the feature-flows.yaml parse + the next-ID derivation. Inline implementation lives in the skill body when invoked:

```python
# Pseudocode:
import yaml, sys, re
from pathlib import Path

workspace = Path(".")
ff_path = workspace / "lineage" / "odd-platform" / "feature-flows.yaml"
docs = list(yaml.safe_load_all(ff_path.read_text()))
body = docs[1]
features = body["features"]

# Find next probe ID
existing_probes = sorted(p.name for p in (workspace / "lineage" / "odd-platform" / "probes").glob("P-*.yaml"))
max_n = max(int(re.match(r"P-(\d+)", n).group(1)) for n in existing_probes) if existing_probes else 0
next_n = max_n + 1

# For each feature × test_class combination requested, generate skeleton
# at lineage/odd-platform/probes/P-{next_n:03d}.yaml with the template above.
```

The skill body is intentionally light — it's a wrapper around the YAML write. No new subagent needed; the maintainer can fill in TODOs interactively after generation.
