# Probe batch summary — 2026-05-19 — `--feature F-004`

- **Probes run**: 2
- **PASS**: 2
- **FAIL**: 0
- **ERROR / TIMEOUT / SCOPE_VIOLATION**: 0
- **Features measured**: 1 (F-004)

## Per-run outcomes

| Probe | Feature | Test class | Outcome | Run ID | Verdict |
|---|---|---|---|---|---|
| `P-007` | `F-004` | security | **PASS** | `R-20260519T020607Z-P-007` | all assertions passed |
| `P-009` | `F-004` | security | **PASS** | `R-20260519T020610Z-P-009` | all assertions passed |

## Per-feature aggregation

### F-004

- **Runs**: 2 (PASS=2 / FAIL=0 / ERROR=0)
- **Test classes empirically covered this batch**: security
- **Per-probe**:
  - `P-007` (security) → **PASS** — all assertions passed (run `R-20260519T020607Z-P-007`)
  - `P-009` (security) → **PASS** — all assertions passed (run `R-20260519T020610Z-P-009`)

## Layer-5 → layer-2 feedback

Each PASS/FAIL run above triggered a sidecar confidence merge (`## probe_verifications` section appended to each contributing sidecar in `lineage/{repo}/understanding/`). Per dynamic-verification ADR Rule 4.

## Cross-references

- Per-run artefacts: `lineage/odd-platform/probe-runs/2026-05-19-P-*.yaml`
- Feature catalog: `lineage/odd-platform/feature-flows.yaml`
- Investigator log (slice-5 probe-run section): `lineage/odd-platform/investigator-log.md`
