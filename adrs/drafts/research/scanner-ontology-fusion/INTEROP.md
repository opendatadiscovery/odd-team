# INTEROP.md — Scanner ↔ Ontology Fusion (rev-13)

**Research thread**: scanner-ontology-fusion / INTEROP slice.
**Scope**: every concrete interface between files, agents, CLI primitives, and skills that the fusion needs. Cited against current artefacts on `main` (`lineage/odd-platform/feature-flows/index.yaml` v `generated_at_commit: 9ac6436e`; `lineage/odd-platform/doc-gaps/index.md` v 102 sidecars; `concepts/index.yaml` v10; `scanners/docs/{accuracy,coverage,quality}/*.md`; `.claude/agents/{graph-retriever,feature-reflector,odd-sme}.md`; `lineage/_extractor/src/lineage_extractor/cli.py` graph subcommands).
**Locked constraints**: (1) extend existing scanners — no new category; (2) annotate-only write-back — never substantive mutation; `(scanner_id, scan_run_date)` is the universal idempotency key.

---

## Part 1 — Scanner READING from the ontology (mode B clues)

### 1.0 The PRIMARY investigation target — `feature-flows/detail/F-*.yaml` *(maintainer-locked 2026-05-27)*

**`feature-flows/detail/F-*.yaml` is the primary investigation target. doc-gaps.md is a dedup/priority hint, never a coverage signal.** Per PITFALLS rule D13: the scanner MUST iterate the feature catalog and independently investigate each in-scope F-NNN. doc-gaps.md is consulted only AFTER per-feature investigation, to dedup against findings the reducer has already surfaced.

This re-frames the run shape: a mode-B scan-run is **feature-driven by default**, with doc-gap corroboration as a secondary write-back step. The pseudo-protocol for each in-scope F-NNN:

```
for F-NNN in feature_flows (filtered by scanner scope):
  read F-NNN detail                              # 1.1
  derive_expected_doc_path(F-NNN.pillar_id, F-NNN.pillar_anchored_feature_name)
  doc_exists = check(documentation/docs/{expected_doc_path})

  # Verification ladder (DESIGN-CHOICES §2) per clue class:
  for hop in F-NNN.chain:
    verify_against_code(hop.evidence)             # ladder rung 1/2: file_exists / assertion_about_code
  for facet in F-NNN.observed_vs_expected.facets:
    verify_against_code(facet.evidence)           # ladder rung 3 if cross_layer; else 2
  WebFetch(expected_doc_url)                       # ladder rung 4: doc_drift
  compare(F-NNN.description, doc_content)         # description-as-clue verification

  emit findings:
    - missing-page if doc_exists=false
    - drift if description-doc compare diverges
    - missing-caveat per facet not mentioned in doc
    - ontology-drift per hop whose evidence is stale

  write-back: scanner_reviews entry on F-NNN (2.1)
  dedup_lookup: matching DOC-GAP-NNN in doc-gaps.md (1.2)
  if matching: write corroborated_by_scanner on the doc-gap (2.3)
```

Doc-gaps consultation happens at the dedup step ONLY. A scan-run whose `scanner-feed/{date}.yaml` `clues_consumed[]` contains zero `source: feature-flow` entries in scope is marked `verification_class: corroboration-only` and does not count toward "feature audited" status (PITFALLS D13).

### 1.1 `feature-flows/detail/F-*.yaml` → scanner — the primary clue source

**Producer**: feature-flow-builder (writes), maintainer (curates).
**Consumer**: any scanner with `ontology_feed.enabled: true` (per §1.0 — all mode-B scanners iterate this catalog).
**File traversal**: glob `lineage/{repo}/feature-flows/detail/F-*.yaml`, sorted lexicographically by `feature_id`. The scanner reads `lineage/{repo}/feature-flows/index.yaml` first; if its `source_monolith_frontmatter.generated_at_commit` is stale by more than `staleness_threshold_commits` (default 50, see Part 5.1), the scanner WARNs and downgrades trust on every ontology citation in its session.

**Scope filtering**: the scanner's frontmatter declares its `feature_scope_filter:` (e.g. `pillar_id: [P-08]` for a management scanner; `target_repo_overlap: documentation+odd-platform` for the canonical accuracy scanner). Features outside scope are NOT investigated by this scanner; they belong to a different scanner's scope.

**Data shape consumed** (required fields):

| Field path | Type | Used by scanner for |
|---|---|---|
| `feature_id` | `F-NNN` string | Citation key — every scanner finding sourced from this flow emits `Source: ontology(F-NNN)`. |
| `pillar_id` / `pillar_anchored_id` / `pillar_anchored_feature_name` | string | Pillar-vs-doc-section homing check. A scanner finding for a feature in pillar P-08 expects coverage under the matching doc IA section. |
| `feature_name` + `description` | string / multiline | Vocabulary input to mode-B claim-vs-doc comparison. |
| `contributing_nodes[]` | list of node-id strings | Each entry resolves via `graph-node` (1.5) to a `source_file:source_line`. The scanner uses this list to know **where in code** to verify the doc claim — replaces grep. |
| `chain[].evidence` | string | Verbatim primary-source statement (e.g. `DataEntityController.java:139-147 — thin reactive pass-through`). The scanner treats this as a clue, not as truth; every cited file:line must be re-opened with `Read` before being repeated in a finding. |
| `observed_vs_expected.facets[]` | list of `{facet, observed, expected, drift_class, provenance}` | The scanner reads `drift_class` ∈ {`ui_amplification`, `disabled_mode_bypass`, `spec_says_X_impl_does_Y`, `structural_amplification_surface`, `missing_idempotency`, `untrusted_input_to_authoritative_state`, …}. Any `drift_class: spec_says_X_impl_does_Y` is a high-prior doc-accuracy clue. |
| `status` (implicit via `control_summary` / `test_matrix`) | enum | Skip flows where `control_summary` reports `0/N PROBED` — those are still in active enrichment and ontology citation risk is high. |
| `seeded_from` (optional) | `SHB-NNN` | Cross-link back to shoebox hypothesis (1.4). |
| `maintainer_curated` | bool | If `true`, the flow is human-blessed — the scanner SHOULD prioritise its evidence over agent-written sidecars. |

**Verified-against-code semantics**: a clue ingested from this file is **never** repeated verbatim into a scanner finding. The scanner re-opens `chain[].evidence`'s cited file:line via `Read`, confirms the line still exists at the claimed offset (substrate may have drifted), then re-states the claim in its own finding. If the line moved or vanished, the scanner emits a finding citing `ontology-drift: F-NNN hop-X evidence stale — was 'X' at file:L, now 'Y'` and writes back (Part 2.1) `ontology_corroborated: false` with `notes` naming the drift.

### 1.2 `lineage/{repo}/doc-gaps.md` → scanner — DEDUP/PRIORITY HINT ONLY (per §1.0 + D13)

**Producer**: doc-gap-finder reducer (independent skill).
**Consumer**: every doc/* scanner with `ontology_feed.enabled: true`, **AFTER per-feature investigation** (§1.0 + §1.1).
**Role limitation** *(load-bearing, maintainer-locked 2026-05-27)*: doc-gaps.md is a **dedup hint** (avoid emitting a finding that exactly matches an existing DOC-GAP-NNN) and a **priority hint** (lift triage priority on findings the reducer also surfaced — two independent signals = HIGH-confidence). It is **NEVER a coverage signal**: a feature absent from doc-gaps.md is NOT presumed documented; the scanner has already independently investigated it per §1.0.
**File traversal**: read `lineage/{repo}/doc-gaps/index.md` for the catalog overview + frontmatter (`findings_by_severity`, `findings_by_category`), then per-finding details from `lineage/{repo}/doc-gaps/detail/DOC-GAP-NNN.md`.

**Per-finding fields consumed**:

| Field | Source location | Use |
|---|---|---|
| `finding_id` | filename + headline | Citation key: `Source: doc-gap(DOC-GAP-001)`. |
| `category` | per-finding bullet | Filter axis (see below). |
| `surfaced_by[]` | per-finding evidence list | Sidecar paths the scanner cross-reads. |
| `evidence[]` | per-finding bullet list | WebFetch citations + sidecar references — already verified by doc-gap-finder. |
| `proposed_doc_action` | per-finding bullet | If scanner corroborates the gap, this becomes the proposed remediation in the new scanner finding. |
| `severity` | per-finding bullet (HIGH / MEDIUM / LOW) | Priority hint passed to triage. |

**Category filter (fusion-locked)**:

```
INGEST          = {missing-page, coverage-gap}    # scanner enumeration scope
LEAVE-FOR-TRIAGE = {broken-url, drift, missing-anchor, stale-page}
META-IGNORE     = {meta}
```

`missing-page` + `coverage-gap` are the only categories the scanner can independently *verify by reading code* (the feature exists; the page does not). `broken-url` / `drift` / `missing-anchor` / `stale-page` already represent doc-content-level findings that go through `/triage` direct ingest — re-routing them through a scanner adds noise without information.

**Dedup contract**: when scanner emits finding `F-NNN` for `documentation/docs/path/to/page.md` and an existing `DOC-GAP-MMM` (category in INGEST set) names the same page + the same surfaced sidecar, the scanner does **not** emit a new finding; instead it writes back `corroborated_by_scanner` (Part 2.3) on the existing gap. Identity comparison: `(doc_page_path, primary_surfaced_sidecar_path)` is the dedup key.

### 1.3 `lineage/{repo}/concepts.yaml` → scanner

**Producer**: concept-merger reducer.
**Consumer**: any scanner doing terminology drift detection (`docs/accuracy/feature-behavior`, `docs/quality/duplication`).
**File traversal**: `lineage/{repo}/concepts/index.yaml` + per-shard files under `lineage/{repo}/concepts/detail/{entities,operations,invariants,audiences,canonicalisation_candidates}/`.

**Used for two checks**:

1. **Canonical-term enforcement**: for each `entity` / `operation` / `invariant` concept named in the catalog, the scanner greps the relevant doc page for that exact term. Doc pages that describe the same concept under a different label (e.g. "data asset" instead of "Data Entity") emit a `non-canonical-term` finding citing `Source: concepts.yaml:entities[Data Entity].aliases`.
2. **Coverage-gap-by-concept**: any concept named in `concepts.yaml` with `surfaced_in_features: [F-NNN, ...]` and `referenced_in_doc_pages: []` (empty) is a coverage-gap clue. The scanner enqueues the concept-name as an enumeration axis on top of the route/controller/menu axes that `docs/coverage/undocumented-features.md` already runs.

**Frontmatter the scanner reads**: `catalog_version`, `canonical_vocabulary_source`, `canonical_vocabulary_fetched_at`. If `canonical_vocabulary_fetched_at` is more than 30 days old, the scanner WARNs (the canonical source may have drifted from the live docs site).

### 1.4 `lineage/{repo}/shoebox/detail/SHB-*.md` → scanner

**Producer**: shoebox layer (maintainer + feature-flow-builder).
**Consumer**: scanners that can opportunistically verify open hypotheses against code as a side-effect of their primary scan.
**File traversal**: glob `lineage/{repo}/shoebox/detail/SHB-*.md`, parse only the `**Category**:` line; ingest only entries with `Category: open` or `Category: clustering` (i.e. hypotheses still being evidence-built; `merged` / `superseded` / `closed` are skipped).

**Fields consumed**:

| Section | Use |
|---|---|
| `## Hypothesis` | The falsifiable statement the scanner can verify against code in this run. |
| `## Evidence` (bulleted file:line refs) | The substrate locations to verify against — the scanner re-reads each cited file. |
| `## Notes` (Caveat N blocks) | Each numbered caveat is independently verifiable; the scanner can confirm or refute one without confirming all. |

**Write-back convention**: if the scanner verifies (or refutes) a hypothesis as a by-product of its primary scan, it **appends** to the thread's existing `## evaluation` block:

```
scanner-docs-accuracy-feature-behavior 2026-05-27:
  verified — see findings/docs-accuracy-feature-behavior/2026-05-27-data-discovery.md F-007
  caveats_confirmed: [1, 4]
  caveats_refuted: []
  caveats_unverified: [2, 3]
  notes: |
    Caveat 1 (silent-default footgun) confirmed at application.yml:208 — key absent;
    Caveat 4 (clock-skew flicker) confirmed at DateTimeUtil.generateNow() callsite.
```

The scanner NEVER mutates the `## Hypothesis` / `## Evidence` / `## Notes` / `## Next` / `## Links` blocks — append-to-`## evaluation` is the only write surface.

### 1.5 `graph-search` / `graph-node` / `graph-neighbours` CLI primitives → scanner

**Producer**: `lineage-extractor` CLI (Python click app at `lineage/_extractor/src/lineage_extractor/cli.py`).
**Consumer**: any scanner that needs ad-hoc semantic discovery beyond its enumerated axes ("does the ontology already cover {topic}? if so, where?").

**Exact CLI command shapes** (always pass `--json`; run from workspace root):

```bash
# Semantic top-k search across all node types
lineage/_extractor/.venv/bin/lineage-extractor graph-search {repo} "{query text}" \
  --k 12 [--label CodeNode|Sidecar|Concept|ImplicitADR|RefactoringScope|DocGap|TestGap|Feature|FeatureReflection|Finding|Doc] \
  --json

# Full content of one node
lineage/_extractor/.venv/bin/lineage-extractor graph-node {repo} "{node_id}" --json

# Adjacency of one node (one row per edge)
lineage/_extractor/.venv/bin/lineage-extractor graph-neighbours {repo} "{node_id}" --json

# Bounded subgraph at a chosen depth
lineage/_extractor/.venv/bin/lineage-extractor graph-traverse {repo} "{node_id}" \
  --depth N --edge EXPOSES --edge CONFIGURES --limit 80 --json
```

**Expected output**: JSON array (search/neighbours/traverse) or JSON object (node). Always cite-bounded — every result carries `node_id` + `source_file:source_line`.

**Error handling**: the scanner MUST handle three failure modes:

| Exit code / signal | Cause | Scanner action |
|---|---|---|
| `click.ClickException: lineage dir not found` | repo mistyped | Hard-abort the scan; surface to maintainer (this is a config error, not a data error). |
| `click.ClickException: node not found: {id}` | invalid node_id (stale ontology citation, typo) | Log as `ontology-stale: node {id} cited at {source} no longer exists`; emit ontology-drift finding; continue. |
| Empty `search` result list | no ontology coverage for the query | Fall back to mode A (no ontology clue available) for that enumeration item. NOT an error. |

**Idempotency**: the scanner SHOULD cache responses per scan-run (key: full command string). First call builds the graph index (~8 s); subsequent calls are sub-second. Cache is in-memory; no on-disk cache (the build cache lives under `lineage/{repo}/graph/`).

---

## Part 2 — Scanner WRITING BACK to the ontology (annotate-only)

### 2.1 `feature-flows/detail/F-*.yaml` — `scanner_reviews:` block

**Idempotency key**: `(scanner_id, scan_run_date)`. Append-only list — later runs add entries; entries are NEVER overwritten in place. Maintainer can edit any entry by adding `maintainer_curated: true`, which becomes the lock flag (Part 5.4).

**Exact block shape**:

```yaml
scanner_reviews:
- scanner_id: docs-accuracy-feature-behavior   # REQUIRED — matches scanners/{cat}/{id}.md `id:` frontmatter
  scan_run_date: 2026-05-27                    # REQUIRED — ISO date of the scan-run
  scan_run_id: SR-20260527T091200Z             # OPTIONAL — unique per /scan invocation; useful when same scanner runs >1 in a day
  ontology_commit_consulted: 182530b           # REQUIRED — git short-SHA of the workspace HEAD at scan start
  doc_status: backlog                          # REQUIRED — one of {backlog, drafted, reviewed, live, invalidated}
  scanner_finding_ids: [F-007, F-014]          # REQUIRED if any findings emitted; the F-NNN IDs in findings/{scanner}/{date}.md
  doc_pages_touched:                           # REQUIRED — the user-facing pages this finding affects
    - "docs/features/active-platform-features/alerting.md"
  ontology_corroborated: true                  # REQUIRED — did the scanner's code verification match the ontology's claim?
  drift_class_observed: ui_amplification       # OPTIONAL — if scanner observed a new drift facet, name it (enum from feature-flow schema)
  notes: |-                                    # OPTIONAL but recommended
    Verified F-007 facet 'spec_says_X_impl_does_Y' against
    AlertManagerController.java:24-31 — confirmed; doc page silent on the
    webhook ingress's lack of auth check. Triaged as DOC-NNN with HIGH severity.
  maintainer_curated: false                    # OPTIONAL — set true after maintainer edits this entry
```

**Allowed enums**:

- `doc_status`: `backlog` (finding logged, no doc PR yet) | `drafted` (doc PR open) | `reviewed` (PR review-ready) | `live` (merged to `docs.opendatadiscovery.org`) | `invalidated` (subsequent scan disproved the finding; ontology / docs changed and the gap closed).
- `ontology_corroborated`: `true` | `false` | `partial`.
- `drift_class_observed`: any of the enum values present in `observed_vs_expected.facets[].drift_class` across `feature-flows/detail/F-*.yaml` (currently 14 distinct values; the scanner extends the enum freely — new values become candidates for the next concepts.yaml refresh).

**Conflict resolution**: two scanners writing to the same flow in the same day both append; their `(scanner_id, scan_run_date)` keys differ. Same scanner re-running on the same day: the second run REPLACES the first day's entry only if `scan_run_id` differs and the writer notes `supersedes: SR-...` in `notes`. Without a `scan_run_id`, the writer appends a sibling entry — never silently overwrites.

### 2.2 `lineage/{repo}/understanding/*.md` sidecar frontmatter

**Same `scanner_reviews:` block** as 2.1, inserted into the sidecar's YAML frontmatter (between `enrichment_status:` and `feature_hint:`). Idempotency key, enums, and conflict rules identical. The scanner annotates a sidecar when the finding pins a per-node defect rather than a cross-chain behaviour (e.g. an `@Value` consumer with an unsafe default — the finding is local to one sidecar, not the F-NNN chain).

**Limit**: scanner annotates AT MOST 5 sidecars per scan-run. Above that count, the cluster is structural and belongs on the F-NNN flow (2.1) or on a NEW shoebox thread the scanner emits (rare; gated by maintainer review).

### 2.3 `lineage/{repo}/doc-gaps/detail/DOC-GAP-NNN.md` — `corroborated_by_scanner:` list

**Append-only list at the bottom of the per-finding file**, before the `Batch Z append` historical section if present:

```markdown
## corroborated_by_scanner

- scanner: docs-accuracy-feature-behavior
  scan_run_date: 2026-05-27
  ontology_commit_consulted: 182530b
  scanner_finding_id: F-007                   # the F-NNN in findings/{scanner}/{date}.md
  verdict: confirmed                          # confirmed | partial | refuted
  notes: |
    Re-verified at AlertManagerController.java:24-31 — webhook ingress
    still ungated. Doc page (live WebFetch 2026-05-27 status 200) still
    silent on this caveat.
```

**Effect on the doc-gap's severity / priority**: the doc-gap-finder's frontmatter is NOT mutated; only the per-finding `.md` gets the appended block. Triage (Part 3.5) reads the `corroborated_by_scanner` list and lifts the priority of any doc-gap with ≥2 distinct scanner corroborations to `critical` (matches the workspace's published-mistake-class priority bar).

### 2.4 `lineage/{repo}/shoebox/detail/SHB-NNN.md` — append to `## evaluation`

Shape per 1.4 — append-only Markdown block, never replace earlier evaluation entries. Idempotency key: `(scanner_id, scan_run_date)`. Two scanners on the same day both append separate stanzas.

### 2.5 NEW file — `lineage/{repo}/scanner-feed/{date}-{scan_run_id}.yaml`

A per-scan-run reproducibility log. **Always emitted**, even when no ontology clues were consumed (so absence is informative).

```yaml
artefact: scanner-feed
scanner_id: docs-accuracy-feature-behavior
scan_run_id: SR-20260527T091200Z
scan_run_date: 2026-05-27
ontology_commit_consulted: 182530b
mode: B                                       # A (no ontology clues) | B (mode-B fusion) | mixed
clues_consumed:                               # ordered by consumption time
  - source: feature-flow
    id: F-007
    fields_read: [feature_id, contributing_nodes, chain[3].evidence, observed_vs_expected.facets[2]]
    verified_against_code: true
    findings_produced: [F-007, F-014]
  - source: doc-gap
    id: DOC-GAP-001
    fields_read: [category, surfaced_by, evidence]
    verified_against_code: true
    findings_produced: []                     # corroborated existing, no new finding
    dedup_action: wrote_back_corroboration
  - source: concept
    id: "concepts.yaml:entities[Data Entity]"
    fields_read: [aliases]
    findings_produced: [F-018]
  - source: shoebox
    id: SHB-001
    caveats_verified: [1, 4]
    write_back: appended_to_evaluation
  - source: graph-search
    query: "alert webhook ingress authentication"
    results_count: 7
    nodes_inspected: ["odd-platform java AlertManagerController controller-method:postAlerts"]
    findings_produced: []
agent_consultations:                          # Part 3 cross-agent calls
  feature_reflector_calls: 1
  odd_sme_calls: 0
  graph_retriever_calls: 2
write_backs:
  feature_flows: [F-007]
  sidecars: [odd-platform__java__AlertManagerController__controller-method__postAlerts.md]
  doc_gaps: [DOC-GAP-001]
  shoebox: [SHB-001]
warnings:
  - "feature-flows/index.yaml generated_at_commit 9ac6436e is 73 commits behind HEAD — trust downgraded"
```

**Producer guarantees**: this file is the single source of truth for "what did this scan-run consume from the ontology, and what did it write back?" Triage and `/review` read it; it is never edited after the scan-run completes.

---

## Part 3 — Agent interactions

### 3.1 `/scan` skill ↔ `graph-retriever` agent

**When**: scanner has an enumeration item for which its primary axis (route / controller / OpenAPI / config-prefix / menu) returns nothing, AND the scanner wants to confirm the ontology has no coverage for the surface before declaring "no ontology clue available" in its scanner-feed log.

**Invocation**: `/scan` spawns `graph-retriever` (defined in `.claude/agents/graph-retriever.md`) with a question shaped:

> "For repo {repo}, is there ontology coverage of {surface description}? Return cited node IDs (max 10) or empty if no coverage."

The retriever runs its bounded ≤10-iteration loop and returns:

```yaml
question: "ontology coverage of Alert webhook ingress authentication"
cited_node_ids:
  - "odd-platform java AlertManagerController controller-method:postAlerts"
  - "F-007"
  - "DOC-GAP-107"
confidence: HIGH
iterations_used: 4
```

**Idempotency / cache**: same `(repo, question)` string → cached result for the scan-run. The cache lives in the scan-run's in-memory state; the scanner-feed log records every distinct question + result for reproducibility.

**Budget**: hard cap **5 retriever invocations per scan-run**. Above 5, the scanner falls back to mode A for remaining items (justified: each retriever call is ≤10 graph-query iterations + LLM reasoning; the cumulative budget exceeds the value at >5 calls for a single scan).

### 3.2 `/scan` ↔ `feature-reflector` agent (PO consult)

**When**: scanner discovers a feature-flow whose product framing (the `feature_name` + `description` + `pillar_anchored_feature_name`) disagrees with the assembled chain, AND the scanner cannot independently judge which side is right without a top-down PO read. Typical trigger: `chain[].evidence` contradicts the `description` paragraph.

**Invocation**: scanner spawns `feature-reflector` (`.claude/agents/feature-reflector.md`) targeting the specific F-NNN with the question:

> "For F-NNN, does the user-observable promise (per description + pillar mission) match the assembled chain's behaviour? Return verdict + cited contradictions."

The reflector reads `feature-flows/detail/F-NNN.yaml` + all `contributing_nodes` sidecars + `system-mission.md` + live docs via `WebFetch`, generates 5-15 falsifiable hypotheses, validates each, and returns:

```yaml
feature_id: F-NNN
overall_verdict: contradicted             # confirmed | contradicted | partial | probe-needed
hypotheses_total: 8
hypotheses_confirmed: 5
hypotheses_contradicted: 2
hypotheses_partial: 1
hypotheses_probe_needed: 0
contradictions_cited:                     # the load-bearing output
  - hypothesis: "When userIds=[42] passed, response actor matches user 42"
    expected_at: "ActivityController.java:55 (per userIds query param naming)"
    actual_at: "ReactiveActivityRepositoryImpl.java:178 (binds to USER_OWNER_MAPPING.OWNER_ID)"
    severity: HIGH
output_file: lineage/{repo}/feature-reflections/detail/F-NNN.yaml
```

**Budget**: hard cap **3 PO consults per scan-run**. Justification: feature-reflector is the most expensive subagent (reads ~10-20 files, calls WebFetch, generates 5-15 hypotheses, validates each); >3 per scan saturates the LLM context for marginal value. Above 3, scanner emits findings without PO verdict and notes `PO consult deferred — exceeded scan-run budget` so triage can manually fire `/reflect-feature` on the highest-stakes items.

### 3.3 `/scan` ↔ `odd-sme` agent (domain consult)

**When**: scanner finds a feature whose pillar-mapping or industry-vocabulary alignment is ambiguous — e.g. ODD names a capability "Owner Association" but every comparable data-catalog system (DataHub / Amundsen / OpenMetadata) calls it "stewardship binding" or "ownership claim", and the doc page uses ODD's term without the synonym. The scanner alone cannot judge whether the divergence is a genuine deliberate term or an under-documented alias.

**Invocation**: scanner spawns `odd-sme` (`.claude/agents/odd-sme.md`) with the question:

> "Does ODD's {feature name} align with operator expectations for data-discovery systems? What do comparable systems call this capability? Cite live URLs."

Returns:

```yaml
question: "ODD's 'Owner Association' alignment"
alignment_verdict: partial               # aligned | partial | divergent | unknown
canonical_industry_term: "Ownership claim"
comparable_systems:
  - { system: DataHub, term: "Ownership", url: "https://datahubproject.io/docs/...", status: 200 }
  - { system: OpenMetadata, term: "Owners", url: "https://docs.open-metadata.org/...", status: 200 }
recommended_doc_action: |
  Add "also called: Ownership claim, Steward binding" to the Owner Association
  page's lead paragraph; link from main-concepts.md Terms & Aliases.
output_file: lineage/{repo}/sme-consultations/2026-05-27-owner-association.md
```

**Budget**: hard cap **2 SME consults per scan-run**. Justification: SME consults are external-network-bound (each one WebFetches 2-5 pages); rate-limit + signal-to-noise favours tight cap. Above 2, scanner emits findings without SME context and the triage step decides whether the surface warrants follow-up `/scan` consult.

### 3.4 `/scan` ↔ `doc-gap-finder` agent (sibling reducer — NO direct invocation)

**Today**: `/scan` and `/doc-gap-check` are independent skills; they produce parallel artefacts (findings + doc-gaps).
**Fusion (rev-13)**: explicitly DO NOT spawn `doc-gap-finder` from inside `/scan`. The scanner READS the latest `lineage/{repo}/doc-gaps/index.md` + per-finding files (1.2) and writes back corroborations (2.3). `doc-gap-finder` remains triggered exclusively by `/doc-gap-check`.

**Reason**: doc-gap-finder is a whole-corpus reducer; spawning it per-scan would multiply its cost N-fold for negligible coverage gain. The cross-feed direction is one-way: doc-gap-finder writes `doc-gaps.md` → scanner reads it.

**Punt**: whether `doc-gap-finder` should be subsumed into the scanner pipeline (or vice versa) is a rev-14 question. INTEROP scope locks the loose-coupling shape for rev-13.

### 3.5 `/triage` ↔ scanner mode-B output (scanner-feed log)

**Today**: `/triage` reads `findings/{scanner}/YYYY-MM-DD.md` files and creates `backlog/` items.
**Fusion**: `/triage` ALSO reads the matching `lineage/{repo}/scanner-feed/{date}-{scan_run_id}.yaml`. For each finding ID:

| Finding profile | Triage action |
|---|---|
| Listed in `clues_consumed[].findings_produced` AND the clue source is `feature-flow` or `doc-gap` corroboration | Priority lifted to `high` minimum (ontology corroboration = published-mistake risk). |
| Listed in `clues_consumed[].findings_produced` AND clue source is `concept` (non-canonical-term) | Priority `medium` default. |
| Listed in `clues_consumed[].findings_produced` AND clue source is `shoebox` (hypothesis verified) | Priority inherits the shoebox's `**Severity**:` field. |
| NOT listed in any `clues_consumed` entry → pure mode-A finding | Normal triage priority per `scanners/README.md`. |

Pure mode-A findings still flow through unchanged — fusion is additive, not replacing.

---

## Part 4 — Per-scanner frontmatter addition

Every scanner markdown gets an OPTIONAL `ontology_feed:` block. **Default `enabled: false`** — opt-in only, so we can pilot on a handful before broadening.

```yaml
---
id: docs/accuracy/feature-behavior
target_repo: documentation + odd-platform
scope: ...
estimated_items: 20-40
chunking: ...
depends_on: []
priority: critical
ontology_feed:
  enabled: true
  clue_sources:                                   # ordered = consumption order
    - feature-flows/detail/F-*.yaml
    - lineage/odd-platform/doc-gaps/                # the index + per-finding details
    - lineage/odd-platform/concepts/index.yaml
    - lineage/odd-platform/shoebox/detail/SHB-*.md
  verification_requirements:
    - "every clue cited as Source: ontology(F-NNN) must be independently verified against file:line in the upstream repo"
    - "no scanner finding may repeat a chain[].evidence string verbatim — re-state from the re-opened file"
  consultation_budget:
    graph-retriever: 5
    feature-reflector: 3
    odd-sme: 2
  write_back:
    enabled: true
    targets: [feature-flows, sidecars, doc-gaps, shoebox]
  staleness_threshold_commits: 50                 # WARN if ontology consulted_commit < HEAD - 50
  staleness_action: warn                          # warn | abort
---
```

**Pilot opt-in (rev-13 scope)**:

| Scanner | Recommended | Why |
|---|---|---|
| `docs/accuracy/feature-behavior` | YES | Highest ontology overlap — every F-NNN flow IS a feature-behaviour claim. Pilot anchor. |
| `docs/accuracy/integration-caveats` | YES | F-NNN flows surface integration / SDK / consumer caveats already — high reuse. |
| `docs/accuracy/config-options` | YES | `concepts.yaml` + config-prefix sidecars are direct evidence for config-option claims. |
| `docs/coverage/undocumented-features` | YES | F-NNN's `pillar_anchored_feature_name` + concepts.yaml entities are an axis 6 input. |
| `docs/coverage/missing-references` | YES (lighter) | concepts.yaml's `surfaced_in_features` ↔ `referenced_in_doc_pages` cross-ref is direct. |
| `docs/completeness/missing-limitations` | YES | `observed_vs_expected.facets[].drift_class` + shoebox caveats are limitation candidates. |
| `docs/completeness/missing-steps` | NO (rev-13) | Workflow-shape detection is not in the ontology yet; defer. |
| `docs/quality/duplication` | YES | concepts.yaml aliases + `canonicalisation_candidates` shard are exactly this scanner's input. |
| `docs/quality/rendering` | NO | Live-site rendering pass; ontology has no signal here. |
| `docs/quality/outbound-urls` | NO | URL probing; ontology has no signal here. |
| `docs/accuracy/architecture-drift` | YES (cautious) | implicit-adrs.md + refactoring-scopes.md are direct evidence; budget the SME consults tightly. |
| `docs/accuracy/deployment-guides` | YES (cautious) | Config-prefix + bean-factory sidecars are evidence; PO consult unlikely to add value. |
| `docs/accuracy/api-examples` | YES | OpenAPI-tag rollup sidecars + F-NNN endpoint shape are direct evidence. |
| `docs/coverage/integration-docs` | YES | navigation/repos.yaml + sidecar cross-refs are evidence. |
| `docs/coverage/missing-keywords` | NO (rev-13) | Keyword-density check; not ontology-shaped. |

**Never opt in (rev-13 + future)**:

| Scanner | Why never |
|---|---|
| `spec/openapi-accuracy` | Different domain — the spec IS partially the ontology's substrate; circular feedback risk. Spec scanners read the spec directly. |
| `spec/ingress-api-gaps` | Same reason. |
| `tests/*` (all 7 of them) | Test coverage is a downstream artefact of the ontology (`test-map.yaml`), not an input. Re-feeding test gaps into test scanners is circular. The test-coverage-mapper reducer is the right home. |

---

## Part 5 — Failure mode contracts

### 5.1 Stale ontology

**Trigger**: `feature-flows/index.yaml` `generated_at_commit` is more than `staleness_threshold_commits` (default 50) behind workspace HEAD.

**Contract — RECOMMEND: WARN and proceed with reduced trust** (not abort). Justification:
- Aborting blocks any scan during long enrichment-pause windows (sprint capacity dips); the workspace ships findings even during such windows today.
- The fusion is additive: mode-B clues are *hints*, not source-of-truth; the scanner re-verifies every clue against live code anyway (1.1, 1.4).
- Trust downgrade is concrete: every scanner finding sourced from a stale ontology gets `ontology_corroborated: stale_warning` in its `scanner_reviews` entry; triage de-prioritises by one tier.

The `ontology_feed.staleness_action: abort` override is available per-scanner for cases where the maintainer wants the harder gate.

### 5.2 Ontology lacks coverage

**Trigger**: `graph-search` returns empty for the scanner's query, AND no F-NNN / concept / shoebox match the surface.

**Contract**: scanner falls back to mode A for that enumeration item. The scanner-feed log records the empty `graph-search` call with `results_count: 0` and `findings_produced: []` so the absence is auditable.

**Side-benefit**: enumeration items that consistently produce empty `graph-search` results become input to the `/coverage` skill — they highlight ontology blind spots the next `/next-batch` run should prioritise.

### 5.3 Write-back race (two scanners annotate the same flow)

**Trigger**: two scanners run on the same day, both writing to `feature-flows/detail/F-007.yaml` `scanner_reviews:` list.

**Contract**: idempotency key `(scanner_id, scan_run_date)` — both entries are distinct (different `scanner_id`), so both append cleanly. The YAML write is a read-modify-write at the file level; the writer SHOULD use a simple file-lock convention (advisory: `lineage/{repo}/.write-locks/{file}.lock`) for >1-second writes. For sub-second writes the race window is negligible; the fusion accepts the eventual-consistency risk.

**Same-scanner same-day re-run**: see 2.1 — the writer either supersedes via `scan_run_id` + `notes: supersedes:` OR appends a sibling entry. Silent overwrite is forbidden.

### 5.4 Maintainer-curated annotation present

**Trigger**: a `scanner_reviews` entry has `maintainer_curated: true`.

**Contract**: scanner does NOT touch that entry. Subsequent scan-runs SKIP it and emit a `scanner-feed` log line:

```yaml
write_back_skipped:
  - target: "feature-flows/detail/F-007.yaml"
    entry_key: "(docs-accuracy-feature-behavior, 2026-05-20)"
    reason: maintainer_curated=true
    action: appended_new_entry_for_today_instead
```

The new run STILL appends its current-day entry (idempotency key differs) — maintainer-curated locking applies entry-by-entry, never to the whole flow.

---

## Part 6 — Data flow diagram (mode-B scan run end-to-end)

```
                  ┌──────────────────────────────────────────────────┐
                  │            workspace HEAD (commit 182530b)       │
                  └──────────────────────────────────────────────────┘
                                       │
                                       ▼
        ┌────────────────────────────────────────────────────────────────┐
        │ /scan docs/accuracy/feature-behavior                            │
        │   (scanner frontmatter: ontology_feed.enabled=true)             │
        └────────────────────────────────────────────────────────────────┘
                │
                │ 1. STALENESS CHECK
                ├─────────►  Read lineage/odd-platform/feature-flows/index.yaml
                │            generated_at_commit vs HEAD → WARN or proceed (5.1)
                │
                │ 2. CONSUME CLUES (Part 1)
                ├─────────►  Glob feature-flows/detail/F-*.yaml            (1.1)
                ├─────────►  Read doc-gaps/index.md + detail/DOC-GAP-*.md   (1.2)
                ├─────────►  Read concepts/index.yaml + shards              (1.3)
                ├─────────►  Glob shoebox/detail/SHB-*.md (open/clustering) (1.4)
                │
                │ 3. SEMANTIC AD-HOC LOOKUP (≤5 calls; 3.1)
                ├─────────►  spawn graph-retriever ──► graph-search/-node/-neighbours
                │
                │ 4. VERIFY AGAINST CODE
                ├─────────►  Read odd-platform/.../*.java/*.tsx via file:line
                │            cited in clues; re-state in scanner's voice.
                │
                │ 5. OPTIONAL CONSULTS
                ├─────────►  spawn feature-reflector (≤3; 3.2) on intent/impl drift
                ├─────────►  spawn odd-sme (≤2; 3.3) on vocabulary divergence
                │
                │ 6. EMIT FINDINGS
                ├─────────►  Write findings/docs-accuracy-feature-behavior/
                │              2026-05-27-{domain}.md   (F-NNN per finding)
                │
                │ 7. WRITE-BACK ANNOTATIONS (Part 2)
                ├─────────►  Append scanner_reviews entry to feature-flows/F-NNN.yaml
                ├─────────►  Append scanner_reviews entry to per-node sidecars (≤5)
                ├─────────►  Append corroborated_by_scanner block to DOC-GAP-NNN.md
                ├─────────►  Append to SHB-NNN.md ## evaluation block
                ├─────────►  Write lineage/odd-platform/scanner-feed/
                │              2026-05-27-SR-20260527T091200Z.yaml  (Part 2.5)
                │
                ▼
        ┌────────────────────────────────────────────────────────────────┐
        │ /triage findings/docs-accuracy-feature-behavior/2026-05-27-... │
        │   (reads scanner-feed log to lift priority on corroborated;    │
        │    3.5)                                                         │
        └────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                              backlog/docs-accuracy/
                              DOC-NNN-{slug}.md   ← lifted to high
                              for ontology-corroborated findings
```

---

## Quality-bar self-check

- Every interface names a SPECIFIC file path, CLI command, or agent type (no "the scanner reads the ontology" hand-waves).
- Every YAML shape names required vs optional fields, allowed enums (with values), and the idempotency key.
- Every cross-agent invocation has a hard budget cap (graph-retriever 5, feature-reflector 3, odd-sme 2) or an explicit no-budget statement with justification.
- Constraint locks honoured: no new scanner category; annotate-only write-back with `(scanner_id, scan_run_date)` keys, append-only lists, `maintainer_curated: true` lock flag, never overwrite.
- Sources cited inline: `lineage/odd-platform/feature-flows/index.yaml`, `lineage/odd-platform/doc-gaps/index.md`, `lineage/odd-platform/concepts/index.yaml`, `lineage/odd-platform/shoebox/detail/SHB-001-data-entity-staleness.md`, `lineage/_extractor/src/lineage_extractor/cli.py:302-405`, `.claude/agents/{graph-retriever,feature-reflector,odd-sme}.md`, `scanners/docs/accuracy/feature-behavior.md`, `scanners/docs/coverage/undocumented-features.md`, `scanners/README.md`, `lineage/odd-platform/feature-flows/detail/F-001.yaml`, `lineage/odd-platform/doc-gaps/detail/DOC-GAP-001.md`.
