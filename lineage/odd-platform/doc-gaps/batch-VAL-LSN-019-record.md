---
batch_id: VAL-LSN-019
batch_label: "Stress Protocol Rule 9 validation canary — 3-sidecar Tag triangulation refresh"
generated_at: "2026-05-20T00:00:00Z"
generated_at_commit: 80637ed
sidecars_consumed:
  - lineage/odd-platform/understanding/odd-platform__java__TagController__controller-class__TagController.md
  - lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTagRepositoryImpl.md
  - lineage/odd-platform/understanding/odd-platform__java__service__TagServiceImpl.md
new_findings:
  - id: DOC-GAP-255
    severity: HIGH
    category: code-vs-doc-drift
    drift_source: openapi-spec
    canary_headline: true
    detail_path: lineage/odd-platform/doc-gaps/detail/DOC-GAP-255.md
    one_line: "OpenAPI spec /api/tags claims 'sorted by popularity'; impl returns OLDEST size tags by tag.id ASC re-ranked among themselves (paginate-INSIDE-CTE drift)"
  - id: DOC-GAP-256
    severity: HIGH
    category: code-vs-doc-drift
    drift_source: published-docs
    detail_path: lineage/odd-platform/doc-gaps/detail/DOC-GAP-256.md
    one_line: "Published-docs propagation of the LSN-019 popular-tags lie across 3 live pages (tagging, catalog-overview, data-discovery)"
strengthened:
  - id: DOC-GAP-170
    dimension: "co-location on tagging.md — the page now carries 3 doc-vs-code drifts (168 side-door + 170 global-scope + 256 ordering)"
  - id: DOC-GAP-169
    dimension: "co-location on listMostPopular — the method now has 3 doc-vs-code drifts (169 case-sensitivity + 170 global-scope + 255/256 ordering)"
  - id: DOC-GAP-253
    dimension: "extends catalog-overview.md editorial-coherence finding from 5-axis to 6-axis (new axis: Top tags ordering claim)"
direct_webfetches_status_200:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    date: "2026-05-20"
    quoted_in: DOC-GAP-256
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    date: "2026-05-20"
    quoted_in: DOC-GAP-256
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    date: "2026-05-20"
    quoted_in: DOC-GAP-256
inherited_webfetches_status_200:
  - url: "/features/data-discovery/tagging"
    inherited_from: "DOC-GAP-168 + DOC-GAP-170 batch-N sidecar verifications"
    inherited_date: "2026-05-19"
    days_old: 1
  - url: "/features/data-discovery/catalog-overview"
    inherited_from: "DOC-GAP-253 batch-ZA sidecar"
    inherited_date: "2026-05-20"
    days_old: 0
  - url: "/configuration-and-deployment/enable-security/authorization/permissions"
    inherited_from: "DOC-GAP-168 sidecar"
    inherited_date: "2026-05-19"
    days_old: 1
coherence:
  strengthens: 3
  supersedes: 0
  conflicts_surfaced: 0
cross_references:
  - LSN-019
  - LSN-018
  - LSN-011
  - REFACTOR-487 (placeholder; adr-archaeologist parallel)
  - F-018
  - P-010
validation_outcome: PASS
validation_narrative: |
  The LSN-019 Stress Protocol Rule 9 — interrogate not transcribe — fired on this
  batch's 3 sidecars. The repository sidecar's stress_findings.B.[B1] emitted the
  NAME_BEHAVIOR_PAIRS drift with full SQL chain trace. The doc-gap-finder consumed
  the stress_findings block + cross-checked the OpenAPI spec (read fresh in this
  session) + WebFetched the 3 live doc pages that propagate the lie + emitted
  DOC-GAP-255 (OpenAPI primary source CANARY HEADLINE) + DOC-GAP-256 (live-docs
  propagation sibling). Rule 9 working as intended.

  Validation criterion: the doc-gap-finder produced a HIGH-severity finding rooted
  in the new stress_findings.name_behavior_pairs block, with empirical-evidence
  citation + proposed action + REFACTOR cross-link + coherence-sweep against
  3 existing entries (DOC-GAP-170 / 169 / 253 STRENGTHENED). 4-axis ✓:
  empirical-evidence ✓, proposed-doc-action ✓, REFACTOR-cross-link ✓, coherence ✓.

  Next-reducer-pass action: reconcile the index headline list with DOC-GAP-255 +
  DOC-GAP-256 + the strengthen footers per the established batch-R/Y/Z/ZA
  precedent (where detail/ shards were authored before the index reconciliation).

shard_count_on_disk: 256
index_frontmatter_total_findings_state: "stale at 197; deferred to next reducer pass"
yaml_safe_emit: true
maintainer_curated: false
---

# Batch VAL-LSN-019 record — Stress Protocol Rule 9 validation canary

This file is the canonical batch record for the VAL-LSN-019 (Stress Protocol Rule 9 validation canary) doc-gap-finder run. The 2 new DOC-GAPs are sharded at `detail/DOC-GAP-255.md` + `detail/DOC-GAP-256.md`. The next-reducer-pass action is to fold this batch record into the `index.md` reconciliation_note + headline list per the established batch-R / batch-Y / batch-Z / batch-ZA precedent.

## Canary outcome — PASS

The Stress Protocol Rule 9 (LSN-019 — file-analyser interrogates; does not transcribe) was bolted into `.claude/agents/file-analyser.md` on 2026-05-20. The 3 sidecars in this batch were enriched after that change. The repository sidecar's `stress_findings.B.[B1]` block emitted the smoking-gun LSN-019 NAME_BEHAVIOR_PAIRS drift with full SQL chain trace. The doc-gap-finder consumed the block + cross-checked the OpenAPI spec + WebFetched the 3 live doc-site pages that propagate the lie + emitted 2 HIGH-severity doc-gaps.

The four-axis validation criterion:
1. **Empirical evidence cited?** Yes — maintainer's 2026-05-20 demo.oddp.io test recorded in `retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:22-32` quoted verbatim in DOC-GAP-255.
2. **Proposed doc action concrete?** Yes — 4-part action covering OpenAPI spec edit (DOC-GAP-255) + 3-page editorial pass on live docs (DOC-GAP-256) + REFACTOR-487 cross-link + P-010 regression-pin.
3. **REFACTOR cross-link present?** Yes — REFACTOR-487 (placeholder; authored in parallel by adr-archaeologist in the same batch). The placeholder will resolve when the adr-archaeologist's batch lands.
4. **Coherence-sweep applied?** Yes — 3 existing entries STRENGTHENED (DOC-GAP-170 / 169 / 253) with the new dimension; 0 supersedes; 0 conflicts surfaced. No new DOC-GAP shadow-files an existing one.

The batch validates that Rule 9 generates correct downstream doc-gaps from the stress_findings block — not just probe-pins or refactor-scopes. The next 30 batches' file-analyser runs are expected to surface similar LSN-019-class drifts that the prior 26 batches missed.
