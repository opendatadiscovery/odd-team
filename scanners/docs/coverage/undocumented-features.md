---
id: docs/coverage/undocumented-features
target_repo: documentation (local: ../documentation) + odd-platform (local)
scope: Platform features with no documentation
estimated_items: 10-30
chunking: Can likely fit in one session (enumerate features from routes + API)
depends_on: []
priority: medium
ontology_feed:
  # Rev-13 pilot opt-in — mode B (ontology-fed).
  # Rationale: this scanner already enumerates from code (5 axes per "Method" below);
  # ontology's feature-flows IS an enumeration. Mode B replaces the per-axis re-grep
  # with iteration over the ontology's catalog of named features. The cross-reference
  # half (SUMMARY.md presence) stays unchanged.
  enabled: true
  substrate_repo: odd-platform
  primary_investigation_target: feature-flows   # per Rule 21 (literal value)
  feature_scope_filter:
    target_repo_overlap: documentation+odd-platform  # any feature whose pillar maps to the docs IA
  clue_sources:                                 # ordered = consumption order; feature-flows ALWAYS first
    - feature-flows/detail/F-*.yaml             # PRIMARY (per Rule 21)
    - lineage/odd-platform/concepts/index.yaml  # canonical vocabulary (non-canonical-term detection)
    - lineage/odd-platform/shoebox/detail/SHB-*.md  # open hypotheses to verify opportunistically
    - lineage/odd-platform/doc-gaps/            # DEDUP/PRIORITY HINT ONLY — never coverage signal
  verification_requirements:
    - "every clue cited as Source: Ontology[F-NNN] must be independently verified against file:line"
    - "no scanner finding may repeat a chain[].evidence string verbatim — re-state from the re-opened file"
    - "per-feature pseudo-protocol per APPROACH.md §20.3 — read F-NNN end-to-end, derive expected doc, run ladder, emit findings, write back"
  consultation_budget:
    graph-retriever: 5
    feature-reflector: 3
    odd-sme: 2
  write_back:
    enabled: true
    targets: [feature-flows, sidecars, doc-gaps, shoebox]
  staleness_threshold_commits: 50
  staleness_action: warn
---

## Purpose

Identify platform features that have no corresponding documentation page or section in the documentation repo.

## Batch-assignment protocol (parallel-execution support)

The coverage manifest at `state/coverage/docs-coverage-undocumented-features.yaml` carries a `mode_b_iteration.batch_assignments:` block enumerating PRE-ASSIGNED disjoint feature batches (currently batch-3 through batch-11). This enables multiple `/scan` invocations to run IN PARALLEL across separate sessions / agents / overnight loop iterations without colliding on the same F-NNNs.

**How to consume a batch**:

1. Optionally pass `batch=batch-N` as the second arg to `/scan` (e.g. `/scan scanners/docs/coverage/undocumented-features.md batch=batch-3`). If omitted, the scanner picks the manifest's `next_pending_batch`.
2. The scanner reads the named batch's `features:` list — that IS the iteration set for this run (overrides the default 113-feature filter).
3. Set the batch's `status: pending` → `in-progress` at start. After successful emit of findings + scanner-feed log + write-backs, set to `scanned`.
4. The batch produces ITS OWN scanner-feed log + findings file (uniquely named by `scan_run_id`). Scanner_reviews writebacks target ONLY the batch's F-NNNs. The coverage-manifest `scanned_features` append is last-write-wins under parallel execution; rerun the manifest's `coverage_pct` recompute after the parallel cohort returns.

**When the assignment block is consumed empty** (every batch `status: scanned`): mode-B iteration is complete. Switch the scanner to fallback-to-axis-cross-check mode (the mode-A 5 axes below remain valid as substrate-coverage cross-checks per Method §46).

**When the substrate refreshes** (`manifest.yaml` advances past `staleness_threshold_commits`): regenerate the `batch_assignments:` block from the new F-NNN catalogue before continuing. The pre-assignment is substrate-commit-specific.

## Method

**Mode B (ontology-fed) is the rev-13 default for this scanner** (per the `ontology_feed:` frontmatter). The mode-B per-feature pseudo-protocol (APPROACH.md §20.3) replaces the per-axis enumeration: iterate `lineage/odd-platform/feature-flows/detail/F-*.yaml`, derive expected doc path per F-NNN, fetch live URL, emit findings, write-back annotation. The 5 enumeration axes below are retained as the **fallback / coverage-corroboration step**: any feature surface enumerated below that does NOT have a corresponding F-NNN in the ontology IS itself a substrate-coverage gap (per Rule 20 + LSN-025) and gets logged as `coverage_gap_for_scan:` in the scanner-feed.

The 5 axes (kept for mode-A standalone runs AND mode-B coverage cross-check):

Route + controller + OpenAPI axes alone are blind to cross-cutting capabilities (the i18n-class miss; see `retrospectives/LSN-013-research-punted-on-substrate-draft.md` and `adrs/drafts/code-lineage-substrate.md`):

1. **UI routes axis** — `odd-platform-ui/src/routes/` (each route = potential feature).
2. **Controllers / OpenAPI axis** — REST controllers + top-level OpenAPI endpoint groups in `odd-platform-specification/openapi.yaml`.
3. **Menu / Management axis** — Menu items in UI components; Management pages in `odd-platform-ui/src/components/Management/`.
4. **UI shell axis (added 2026-05-08 — closes the i18n class)** — Cross-cutting client-side capabilities not reachable from a route:
   - `odd-platform-ui/src/locales/` (i18n bootstrap; translation resources)
   - `odd-platform-ui/src/components/shared/elements/AppToolbar/` (each toolbar widget directory = a separate ui-shell node)
   - `odd-platform-ui/src/theme/` and any `ThemeProvider*` files (theme switching)
   - `odd-platform-ui/src/components/shared/elements/AppErrorPage/` (error-page family: 404, 500, unauthorized)
   - Auth flow files: `auth/`, login pages, OIDC/LDAP/S2S provider UIs (these are not in `routes/`)
   - Any TS file imported directly by `odd-platform-ui/src/index.tsx` is auto-promoted to a ui-shell-bootstrap node.
   - Any `<Component />` mounted inside the AppToolbar's render is auto-promoted to a ui-shell-widget node.
5. **Config-prefixes axis (added 2026-05-08)** — Top-level YAML namespaces in `application.yml` mapped to their `@ConfigurationProperties("<prefix>")` consumer class. Each prefix is a node; cross-reference to docs (does any doc page mention the prefix?).
6. **Cross-reference**: fetch SUMMARY.md from the documentation repo (defines GitBook navigation tree); for each enumerated feature, check whether a doc page exists or is planned.

## Criteria for a Finding

- Feature has UI route but no documentation page (axis 1)
- Feature has OpenAPI endpoints but no API documentation (axis 2)
- Feature appears in platform menu but is not mentioned in docs at all (axis 3)
- **Cross-cutting UI capability with no documentation** — i18n / theme / auth / error pages / toolbar widgets / app-shell bootstraps not appearing in any doc page (axis 4 — the i18n-class fix)
- **Config prefix with no documentation** — a `@ConfigurationProperties` prefix that is not mentioned in any deployment / configuration doc page (axis 5)
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
