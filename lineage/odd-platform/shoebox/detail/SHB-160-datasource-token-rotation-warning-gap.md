# SHB-160 — Datasource token regeneration confirms an "Are you sure?" prompt but never warns it breaks running ingestion

**Category**: clustering
**Severity**: HIGH

## Hypothesis

When operators click "Regenerate" on a datasource's collector token in Management → Datasources, the UI shows a ConfirmationDialog asking "Are you sure you want to regenerate token for «X»?" — but the dialog body NEVER warns that regeneration is a destructive in-place rotation that immediately kills the old token, with no grace period, and any collector still presenting the old token will start failing ingestion until the operator reconfigures it. The dialog MITIGATES an accidental click but does NOT inform an intentional one. An operator who knowingly clicks Regenerate (perhaps to rotate on a routine schedule) has no warning that they're about to break a running pipeline.

## Evidence

- `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceItem/DataSourceItemToken/DataSourceItemToken.tsx:37-49` — ConfirmationDialog body: `Regenerate token for "{name}"?` — no consequence text.
- `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceItem/DataSourceItem.tsx:110-121` — the warning that DOES appear ("Save token in a secure location. You will not be able to retrieve it again.") fires ONLY AFTER successful rotation — too late.
- (Cross-ref backend regenerateDataSourceToken sidecar) — destructive in-place UPDATE, no grace period, ingestion lockout.

## Notes

- The UI is the LAST chance to warn before the destructive action; this is exactly where the warning belongs.
- "Save token in a secure location" addresses the SECOND risk (one-time-reveal of the new token); the FIRST risk (the old token dies) is never surfaced.
- Operator-impact: an SRE rotating credentials during business hours can take their ingestion pipeline down for hours before discovering it — there's no "rotation event" log they could grep.
- A two-line fix: enrich the ConfirmationDialog body with "Warning: this immediately invalidates the current token; any collector still using it will stop ingesting until reconfigured."
- Also worth a grace-period feature: allow old + new tokens to coexist for N hours before old expires. That's a bigger refactor, but the warning is small.
- Cluster: this is an ENRICHER for F-031 (Data Source Lifecycle) and F-020 (Collector Lifecycle Management — token one-shot visibility).

## Next

1. Enrich the ConfirmationDialog body with the "this kills active ingestion" warning — two-line fix.
2. DOC-NNN — `docs.opendatadiscovery.org/features/management` doesn't document the regeneration consequences either.
3. File a forward-looking REFACTOR-NNN for a token-rotation grace period (old + new valid for N hours).
4. Promote: cluster_with F-031, F-020 as the operator-warning facet.

## Links

- cluster_with: [F-031, F-020, SHB-161, SHB-162]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: cluster — F-031 (Data Source Lifecycle, P-08) and F-020 (Collector Lifecycle, P-08) are both in this slice's pillar — within scope. But this thread is part of a 3-thread cluster (SHB-160 token-rotation warning + SHB-161 form-submit-fail-closes-modal + SHB-162 edit-replace-nulls) that collectively name the Data Source form UX class. The cluster's combined evidence is sufficient to graduate a "Data Source Form UX hardening" feature next batch — keeping these together (rather than splitting facets into F-031 piecemeal) preserves the form-class framing. HIGH severity per the destructive-rotation-no-warning operator impact.
