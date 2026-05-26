## REFACTOR-660 — DataSetController's diff endpoint loads 2 versions' full field lists in-memory for recursive parent-oddrn change detection (`DatasetVersionServiceImpl.getParentOddrnChangedPojos:156-180`); no streaming, no pagination, no row-count guard; very-wide schemas (10K+ fields) materialise everything

**Severity**: LOW
**Category**: memory-bound-diff-no-streaming
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-01 Data Discovery (dataset structure), P-08 Performance]

**Surfaced by**:
- `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[5]` (LOW) — "**Diff endpoint loads 2 versions' full field lists in-memory** for recursive `getParentOddrnChangedPojos` (DatasetVersionServiceImpl.java:156-180). For very-wide datasets (hundreds-of-thousands of nested fields), this is a memory-bound operation; no streaming, no pagination, no row-count guard."

**Statement**: `GET /api/datasets/{id}/structure/diff` computes field-level diffs between two dataset versions. The implementation at `DatasetVersionServiceImpl.getParentOddrnChangedPojos:156-180` does in-memory recursive parent-oddrn change detection:

1. Loads ALL fields of both versions via `getDatasetVersionWithFields(List.of(v1, v2))` — fetched as a single result set
2. Builds maps: `versionToFieldsMap`, `firstVersionFields`, `secondVersionFields`, `versionDiffFields` — 4 maps over the union of both versions' fields
3. Recursive walk until convergence (parent-oddrn change propagates to all child columns)

For typical datasets (10-100 columns), this is fine. For very-wide datasets (BigQuery nested STRUCTs with thousands of leaf columns; Snowflake VARIANT-typed columns serialised as many leaf paths; protobuf schemas with deep message nesting), the algorithm allocates 4 × field_count maps PER REQUEST. No streaming, no pagination over fields, no row-count guard.

Operator-visible failure mode:
- 10K-field dataset, two versions diffed → 40K-row allocation in memory per request
- Multiple concurrent diffs → multiplied memory pressure
- Pathological case: ~100K-field dataset (deeply nested Avro / protobuf schemas) → potential OOM

**Evidence**:
- Recursive convergence: `DatasetVersionServiceImpl.java:156-180`
- Per-call allocation: `DatasetVersionServiceImpl.java:66-180`
- No row-count guard at any layer

**Existing-ADR-or-implied-prescription**: no governing ADR.

**Proposed remedy**:
- **Option A (row-count guard)**: read the field count first (`SELECT COUNT(*) FROM dataset_structure WHERE dataset_version_id IN (...)`); if count > threshold (e.g. 10K), return HTTP 413 Payload Too Large with a descriptive message.
- **Option B (streaming)**: stream the field comparison via a JOIN-then-paginate approach; emit diff rows incrementally; bounded memory.
- **Option C (rate-limit)**: limit concurrent diff requests platform-wide; bounded total memory.

Option A is the smallest change and protects against pathological cases.

**Severity rationale**: LOW — edge-case memory pressure for very-wide datasets; typical use is unaffected; not a security or correctness bug.

**Suggested backlog grouping**: `DataSet API hygiene sprint`.

**Coherence check** (LSN-018):
- STRENGTHENS: none directly.
- SUPERSEDES: none.
- CONFLICTS: none.

---
